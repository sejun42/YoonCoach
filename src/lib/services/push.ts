import { db } from "@/lib/db";

type PushPayload = {
  title: string;
  body: string;
  url: string;
};

type WebPushModule = {
  setVapidDetails: (contactEmail: string, publicKey: string, privateKey: string) => void;
  sendNotification: (
    subscription: { endpoint: string; keys: { p256dh: string; auth: string } },
    payload?: string
  ) => Promise<unknown>;
};

let configured = false;
let pushModule: WebPushModule | null = null;

async function getWebPush() {
  if (pushModule) {
    return pushModule;
  }

  const mod = await import("web-push");
  pushModule = ((mod as unknown as { default?: WebPushModule }).default ||
    (mod as unknown as WebPushModule)) as WebPushModule;
  return pushModule;
}

export async function configureWebPush() {
  if (configured) {
    return true;
  }

  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY;
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY;
  const email = process.env.WEB_PUSH_EMAIL;

  if (!publicKey || !privateKey || !email) {
    return false;
  }

  const webPush = await getWebPush();
  webPush.setVapidDetails(email, publicKey, privateKey);
  configured = true;
  return true;
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  const ready = await configureWebPush();
  if (!ready) {
    return { sent: 0, skipped: 1 };
  }

  const webPush = await getWebPush();
  const subscriptions = await db.pushSubscription.findMany({
    where: { userId, revokedAt: null }
  });

  let sent = 0;
  let skipped = 0;

  for (const sub of subscriptions) {
    try {
      await webPush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: {
            p256dh: sub.p256dh,
            auth: sub.auth
          }
        },
        JSON.stringify(payload)
      );
      sent += 1;
    } catch {
      skipped += 1;
      await db.pushSubscription.update({
        where: { id: sub.id },
        data: { revokedAt: new Date() }
      });
    }
  }

  return { sent, skipped };
}

function localHm(now: Date, timezone: string) {
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: timezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false
    }).format(now);
  } catch {
    return `${String(now.getUTCHours()).padStart(2, "0")}:${String(now.getUTCMinutes()).padStart(2, "0")}`;
  }
}

export async function sendDailyDigestForNow(now: Date) {
  const users = await db.userSetting.findMany({
    include: {
      user: {
        include: {
          profile: true,
          plans: {
            where: { isActive: true },
            orderBy: { updatedAt: "desc" },
            take: 1
          }
        }
      }
    }
  });

  let sent = 0;
  let targetedUsers = 0;
  for (const setting of users) {
    const timezone = setting.user.profile?.timezone || "UTC";
    if (localHm(now, timezone) !== setting.notifyTime) {
      continue;
    }

    const plan = setting.user.plans[0];
    if (!plan) {
      continue;
    }
    targetedUsers += 1;

    const payload1 = {
      title: "공복 체중 기록 시간",
      body: "오늘 체중 1회만 입력해도 코칭 정확도가 올라갑니다.",
      url: "/"
    };
    const payload2 = {
      title: "오늘 목표 매크로",
      body: `${plan.targetCalories}kcal | 탄 ${plan.targetCarbsG}g 단 ${plan.targetProteinG}g 지 ${plan.targetFatG}g`,
      url: "/"
    };

    const first = await sendPushToUser(setting.userId, payload1);
    const second = await sendPushToUser(setting.userId, payload2);
    sent += first.sent + second.sent;
  }

  return { usersScanned: users.length, usersTargeted: targetedUsers, notificationsSent: sent };
}
