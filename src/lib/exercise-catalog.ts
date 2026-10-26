import type { BodyPartKey } from "./body-parts";

export const exerciseTagKeys = ["chest", "back", "shoulders", "front_legs", "back_legs", "biceps", "triceps", "core"] as const;
export type ExerciseTag = (typeof exerciseTagKeys)[number];
export const equipmentKeys = ["machine", "barbell", "dumbbell", "smith", "cable", "bodyweight"] as const;
export type Equipment = (typeof equipmentKeys)[number];
export const equipmentLabels: Record<Equipment, string> = { machine: "머신", barbell: "바벨", dumbbell: "덤벨", smith: "스미스", cable: "케이블", bodyweight: "맨몸 / 추가 중량" };
export type Exercise = { id: string; name: string; tags: ExerciseTag[]; equipment: Equipment; custom?: boolean };

function group(prefix: string, brand: string, equipment: Equipment, tags: ExerciseTag[], names: string[]): Exercise[] {
  // IDs derive from the full exercise name, never from its position in the catalog.
  return names.map((name) => ({ id: prefix + ":" + name, name: brand + name, tags, equipment }));
}

export const exerciseCatalog: Exercise[] = [
  ...group("chest-bb", "바벨 ", "barbell", ["chest"], ["플랫 벤치프레스", "인클라인 벤치프레스"]),
  ...group("chest-db", "덤벨 ", "dumbbell", ["chest"], ["플라이", "인클라인 플라이", "플랫 프레스", "인클라인 프레스"]),
  ...group("chest-smith", "스미스 ", "smith", ["chest"], ["플랫 프레스", "인클라인 프레스"]),
  ...group("chest-hammer", "해머 ", "machine", ["chest"], ["슈퍼 인클라인 프레스", "체스트 프레스"]),
  ...group("chest-panatta", "파나타 ", "machine", ["chest"], ["슈퍼 인클라인 프레스", "디클라인 프레스", "체스트 프레스", "디클라인 플라이"]),
  ...group("chest-mts", "해머 MTS ", "machine", ["chest"], ["체스트 프레스", "인클라인 프레스", "디클라인 프레스"]),
  ...group("chest-machine", "", "machine", ["chest"], ["팩덱 플라이", "싸이벡스 체스트 프레스"]),
  ...group("chest-cable", "", "cable", ["chest"], ["케이블 플라이", "로우 투 하이 케이블 플라이"]),
  ...group("chest-body", "", "bodyweight", ["chest", "triceps"], ["딥스", "푸시업"]),
  ...group("chest-extra", "덤벨 ", "dumbbell", ["chest"], ["스퀴즈 프레스"]),

  ...group("back-iso", "해머 ISO ", "machine", ["back"], ["와이드 랫풀다운", "프론트 풀다운", "DY 로우", "레터럴 로우", "로우 로우", "하이 로우"]),
  ...group("back-panatta", "파나타 ", "machine", ["back"], ["써큘러 풀다운", "하이 로우", "티바 로우", "로우 로우"]),
  ...group("back-machine", "", "machine", ["back"], ["메가매스 리니어 티바 로우", "프라임 시티드 로우"]),
  ...group("back-select", "해머 셀렉트 ", "machine", ["back"], ["랫풀다운 머신", "시티드 로우"]),
  ...group("back-mts", "해머 MTS ", "machine", ["back"], ["프론트 풀다운", "DY 로우", "하이 로우"]),
  ...group("back-cable", "", "cable", ["back"], ["롱풀", "랫풀다운", "스트레이트 암 풀다운"]),
  ...group("back-db", "덤벨 ", "dumbbell", ["back"], ["풀오버", "원암 로우", "체스트 서포티드 로우", "벤트오버 로우"]),
  ...group("back-bb", "바벨 ", "barbell", ["back"], ["벤트오버 로우", "펜들레이 로우", "언더그립 로우"]),
  ...group("back-body", "", "bodyweight", ["back", "biceps"], ["풀업", "친업"]),

  ...group("shoulder-db", "덤벨 ", "dumbbell", ["shoulders"], ["숄더 프레스", "사이드 레터럴 레이즈", "벤트오버 레이즈", "후면 로우", "아놀드 프레스", "프론트 레이즈"]),
  ...group("shoulder-bb", "", "barbell", ["shoulders"], ["바벨 OHP"]),
  ...group("shoulder-machine", "", "machine", ["shoulders"], ["싸이벡스 숄더 프레스", "해머 MTS 숄더 프레스", "리버스 팩덱 플라이", "짐80 숄더 프레스", "해머 사이드 레터럴 레이즈 머신", "파나타 스탠딩 사이드 레터럴 레이즈"]),
  ...group("shoulder-cable", "케이블 ", "cable", ["shoulders"], ["사이드 레터럴 레이즈", "익스터널 로테이션", "리어 델트 플라이"]),
  ...group("shoulder-smith", "스미스 ", "smith", ["shoulders"], ["숄더 프레스"]),

  ...group("legs-cybex-front", "싸이벡스 ", "machine", ["front_legs"], ["이너타이", "레그 익스텐션"]),
  ...group("legs-cybex-rear", "싸이벡스 ", "machine", ["back_legs"], ["아웃타이", "라잉 레그 컬"]),
  ...group("legs-hammer-front", "해머 ", "machine", ["front_legs"], ["이너타이", "레그 익스텐션", "싱글 레그 익스텐션", "레그 프레스"]),
  ...group("legs-hammer-rear", "해머 ", "machine", ["back_legs"], ["아웃타이", "라잉 레그 컬", "닐링 레그 컬"]),
  ...group("legs-squat-machine", "", "machine", ["front_legs", "back_legs"], ["짐80 핵스쿼트", "시타델 핵스쿼트", "시타델 핵프레스", "파나타 파워 스쿼트", "파나타 펜듈럼 스쿼트"]),
  ...group("legs-bb-front", "바벨 ", "barbell", ["front_legs", "back_legs"], ["백 스쿼트", "프론트 스쿼트"]),
  ...group("legs-smith", "스미스 ", "smith", ["front_legs", "back_legs"], ["백 스쿼트", "프론트 스쿼트"]),
  ...group("legs-bb-rear", "바벨 ", "barbell", ["back_legs"], ["스티프 데드리프트", "루마니안 데드리프트", "힙 쓰러스트"]),
  ...group("legs-dead", "바벨 ", "barbell", ["back_legs", "back"], ["컨벤셔널 데드리프트"]),
  ...group("legs-db-rear", "덤벨 ", "dumbbell", ["back_legs"], ["스티프 데드리프트"]),
  ...group("legs-db-extra", "덤벨 ", "dumbbell", ["front_legs", "back_legs"], ["불가리안 스플릿 스쿼트", "워킹 런지", "고블릿 스쿼트"]),
  ...group("legs-extra", "", "machine", ["back_legs"], ["시티드 레그 컬"]),

  ...group("arms-hammer-bi", "해머 ", "machine", ["biceps"], ["프리처 컬"]),
  ...group("arms-hammer-tri", "해머 ", "machine", ["triceps"], ["트라이셉스 익스텐션"]),
  ...group("arms-cable-bi", "", "cable", ["biceps"], ["케이블 컬"]),
  ...group("arms-cable-tri", "", "cable", ["triceps"], ["케이블 푸시다운"]),
  ...group("arms-bb-bi", "", "barbell", ["biceps"], ["바벨 컬", "이지바 컬"]),
  ...group("arms-bb-tri", "", "barbell", ["triceps"], ["라잉 트라이셉스 익스텐션"]),
  ...group("arms-db-tri", "덤벨 ", "dumbbell", ["triceps"], ["원암 오버헤드 트라이셉스 익스텐션", "투암 오버헤드 트라이셉스 익스텐션", "트라이셉스 킥백"]),
  ...group("arms-db-bi", "덤벨 ", "dumbbell", ["biceps"], ["해머 컬", "인클라인 컬", "컨센트레이션 컬"]),

  ...group("other-face", "", "cable", ["shoulders", "back"], ["페이스풀"]),
  ...group("core-cable", "", "cable", ["core"], ["케이블 크런치"]),
  ...group("core-body", "", "bodyweight", ["core"], ["행잉 레그 레이즈", "리버스 크런치"])
];

export const exerciseGroups: { key: string; label: string; tags: BodyPartKey[] }[] = [
  { key: "all", label: "전체", tags: [] }, { key: "chest", label: "가슴", tags: ["chest"] },
  { key: "back", label: "등", tags: ["back"] }, { key: "shoulders", label: "어깨", tags: ["shoulders"] },
  { key: "front_legs", label: "전면하체", tags: ["front_legs"] }, { key: "back_legs", label: "후면하체", tags: ["back_legs"] },
  { key: "arms", label: "팔", tags: ["biceps", "triceps"] }, { key: "other", label: "그 외", tags: ["core"] }
];

export function searchExercise(exercise: Exercise, query: string) {
  const normalize = (value: string) => value.toLowerCase().replace(/헤머/g, "해머").replace(/렛/g, "랫").replace(/플렛/g, "플랫")
    .replace(/사레레/g, "사이드레터럴레이즈").replace(/라트익/g, "라잉트라이셉스익스텐션").replace(/[\s_-]/g, "");
  return normalize(exercise.name).includes(normalize(query));
}
