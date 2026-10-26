import { notFound } from "next/navigation";
import { calendarDateSchema } from "@/lib/schemas";
import WorkoutEditor from "@/components/WorkoutEditor";

export default async function WorkoutPage({ params }: { params: Promise<{ date: string }> }) {
  const { date } = await params;
  if (!calendarDateSchema.safeParse(date).success) notFound();
  return <WorkoutEditor key={date} date={date} />;
}
