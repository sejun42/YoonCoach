import { redirect } from "next/navigation";
import AppShell from "@/components/AppShell";
import HomeDashboard from "@/components/HomeDashboard";
import { getSessionContext } from "@/lib/session";

export default async function HomePage() {
  const session = await getSessionContext();
  if (!session) {
    redirect("/auth");
  }
  if (!session.profile || !session.activePlan) {
    redirect("/onboarding");
  }

  return (
    <AppShell>
      <HomeDashboard />
    </AppShell>
  );
}
