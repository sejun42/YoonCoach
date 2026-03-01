import { redirect } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import { db } from "@/lib/db";

export async function requireSessionUser() {
  const userId = await getSessionUserId();
  if (!userId) {
    redirect("/auth");
  }
  return userId;
}

export async function getSessionContext() {
  const userId = await getSessionUserId();
  if (!userId) {
    return null;
  }

  const [user, profile, activePlan] = await Promise.all([
    db.user.findUnique({ where: { id: userId } }),
    db.profile.findUnique({ where: { userId } }),
    db.plan.findFirst({
      where: { userId, isActive: true },
      orderBy: { updatedAt: "desc" }
    })
  ]);

  if (!user) {
    return null;
  }

  return { user, profile, activePlan };
}
