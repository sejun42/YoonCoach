export const bodyPartKeys = ["chest", "shoulders", "back", "legs", "front_legs", "back_legs", "arms", "biceps", "triceps"] as const;
export type BodyPartKey = (typeof bodyPartKeys)[number];
export type WorkoutLog = { id: string; date: string; body_part: BodyPartKey };
export type PartLastDate = { body_part: BodyPartKey; date: string };

export const currentBodyParts = [
  { key: "chest", label: "가슴", color: "#df526c" },
  { key: "shoulders", label: "어깨", color: "#8763c7" },
  { key: "back", label: "등", color: "#298bc5" },
  { key: "front_legs", label: "전면하체", color: "#799b27" },
  { key: "back_legs", label: "후면하체", color: "#168971" },
  { key: "biceps", label: "이두", color: "#cd8321" },
  { key: "triceps", label: "삼두", color: "#c35d36" }
] as const;

export const legacyBodyParts = [
  { key: "legs", label: "하체 (기존)", color: "#6e7c85" },
  { key: "arms", label: "팔 (기존)", color: "#a38154" }
] as const;
export const allBodyParts = [...currentBodyParts, ...legacyBodyParts];

export function recommendPart(lastDates: PartLastDate[]) {
  // Legacy combined records cannot tell us which split muscle was trained.
  const dates = new Map(lastDates.map((part) => [part.body_part, part.date]));
  return [...currentBodyParts].sort((a, b) => (dates.get(a.key) ?? "").localeCompare(dates.get(b.key) ?? ""))[0];
}
