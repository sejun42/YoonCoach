import TrackerWorkspace from "@/components/TrackerWorkspace";
import { requireSessionUser } from "@/lib/session";

export default async function TrackerLayout({ children }: { children: React.ReactNode }) {
  const userId = await requireSessionUser();
  return <TrackerWorkspace key={userId}>{children}</TrackerWorkspace>;
}
