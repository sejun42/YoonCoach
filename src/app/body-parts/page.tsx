import AppShell from "@/components/AppShell";
import BodyPartCalendar from "@/components/BodyPartCalendar";
import { requireSessionUser } from "@/lib/session";

export default async function BodyPartsPage() {
  await requireSessionUser();

  return (
    <AppShell>
      <BodyPartCalendar />
    </AppShell>
  );
}
