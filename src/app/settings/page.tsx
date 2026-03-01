import AppShell from "@/components/AppShell";
import SettingsPanel from "@/components/SettingsPanel";
import { requireSessionUser } from "@/lib/session";

export default async function SettingsPage() {
  await requireSessionUser();
  return (
    <AppShell>
      <SettingsPanel />
    </AppShell>
  );
}
