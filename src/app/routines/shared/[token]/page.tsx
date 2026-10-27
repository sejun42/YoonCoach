import { notFound } from "next/navigation";
import { getSessionUserId } from "@/lib/auth";
import SharedRoutine from "@/components/SharedRoutine";

export const metadata = { title: "공유 루틴 | YoonCoach", robots: { index: false, follow: false } };
export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!/^[a-f0-9]{48}$/.test(token)) notFound();
  return <SharedRoutine token={token} signedIn={!!await getSessionUserId()} />;
}
