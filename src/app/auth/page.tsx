import { redirect } from "next/navigation";
import AuthForm from "@/components/AuthForm";
import { getSessionContext } from "@/lib/session";

export default async function AuthPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const next = (await searchParams).next;
  const returnTo = next && /^\/routines\/shared\/[a-f0-9]{48}$/.test(next) ? next : undefined;
  const session = await getSessionContext();
  if (session?.profile && session.activePlan) {
    redirect(returnTo ?? "/");
  }

  return (
    <main className="container">
      <AuthForm returnTo={returnTo} />
    </main>
  );
}
