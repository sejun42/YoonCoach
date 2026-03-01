import { redirect } from "next/navigation";
import OnboardingWizard from "@/components/OnboardingWizard";
import { getSessionContext } from "@/lib/session";

export default async function OnboardingPage() {
  const session = await getSessionContext();
  if (!session) {
    redirect("/auth");
  }
  if (session.profile && session.activePlan) {
    redirect("/");
  }

  return (
    <main className="container py-4">
      <OnboardingWizard />
    </main>
  );
}
