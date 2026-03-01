import AppShell from "@/components/AppShell";
import CoachingPanel from "@/components/CoachingPanel";
import { requireSessionUser } from "@/lib/session";

export default async function CoachingPage() {
  await requireSessionUser();
  return (
    <AppShell>
      <CoachingPanel />
    </AppShell>
  );
}
