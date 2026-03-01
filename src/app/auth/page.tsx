import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getSessionContext } from "@/lib/session";

export default async function AuthPage() {
  const session = await getSessionContext();
  if (session?.profile && session.activePlan) {
    redirect("/");
  }

  return (
    <main className="container">
      <AuthForm />
    </main>
  );
}
