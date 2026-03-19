// Korean public holidays (2025-2027) — static lookup by MM-DD or exact YYYY-MM-DD for lunar-based holidays

const FIXED_HOLIDAYS: Record<string, string> = {
  "01-01": "신정",
  "03-01": "삼일절",
  "05-05": "어린이날",
  "06-06": "현충일",
  "08-15": "광복절",
  "10-03": "개천절",
  "10-09": "한글날",
  "12-25": "성탄절",
};

// Lunar-based holidays (manually listed for 2025-2027)
const LUNAR_HOLIDAYS: Record<string, string> = {
  // 2025 설날
  "2025-01-28": "설날 연휴",
  "2025-01-29": "설날",
  "2025-01-30": "설날 연휴",
  // 2025 부처님오신날
  "2025-05-05": "부처님오신날",
  // 2025 추석
  "2025-10-05": "추석 연휴",
  "2025-10-06": "추석",
  "2025-10-07": "추석 연휴",
  // 2026 설날
  "2026-02-16": "설날 연휴",
  "2026-02-17": "설날",
  "2026-02-18": "설날 연휴",
  // 2026 부처님오신날
  "2026-05-24": "부처님오신날",
  // 2026 추석
  "2026-09-24": "추석 연휴",
  "2026-09-25": "추석",
  "2026-09-26": "추석 연휴",
  // 2027 설날
  "2027-02-06": "설날 연휴",
  "2027-02-07": "설날",
  "2027-02-08": "설날 연휴",
  // 2027 부처님오신날
  "2027-05-13": "부처님오신날",
  // 2027 추석
  "2027-10-14": "추석 연휴",
  "2027-10-15": "추석",
  "2027-10-16": "추석 연휴",
};

function formatMMDD(date: Date): string {
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${m}-${d}`;
}

function formatYMD(date: Date): string {
  const y = date.getFullYear();
  return `${y}-${formatMMDD(date)}`;
}

export function getHolidayName(date: Date): string | null {
  return LUNAR_HOLIDAYS[formatYMD(date)] ?? FIXED_HOLIDAYS[formatMMDD(date)] ?? null;
}

export function isHoliday(date: Date): boolean {
  return getHolidayName(date) !== null;
}

export function isSunday(date: Date): boolean {
  return date.getDay() === 0;
}
