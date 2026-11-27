export interface BirthdayConfig {
  recipientName: string;
  birthMonth: number; // 1 - 12 (11 = November)
  birthDay: number; // 1 - 31 (24)
  initialYear: number; // 2027
  timezone: string;
  deliveryTime: string; // "09:00"
  widgetEnabled: boolean;
  dayBeforeReminder: boolean;
  birthdayNotifications: boolean;
}

export const DEFAULT_BIRTHDAY_CONFIG: BirthdayConfig = {
  recipientName: "Maya",
  birthMonth: 11,
  birthDay: 24,
  initialYear: 2027,
  timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC" : "UTC",
  deliveryTime: "09:00",
  widgetEnabled: true,
  dayBeforeReminder: true,
  birthdayNotifications: true,
};

export interface CountdownResult {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  totalSeconds: number;
  isBirthday: boolean;
  nextBirthdayDate: Date;
  targetYear: number;
  formattedTargetDate: string;
}

/**
 * Extracts date components for a given Date object in a specific IANA timezone.
 */
export function getTimezoneDateParts(date: Date, timeZone: string) {
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const getPart = (type: string) => {
      const p = parts.find((pt) => pt.type === type);
      return p ? parseInt(p.value, 10) : 0;
    };
    return {
      year: getPart("year"),
      month: getPart("month"),
      day: getPart("day"),
      hour: getPart("hour"),
      minute: getPart("minute"),
      second: getPart("second"),
    };
  } catch {
    // Fallback if timezone string is invalid
    return {
      year: date.getFullYear(),
      month: date.getMonth() + 1,
      day: date.getDate(),
      hour: date.getHours(),
      minute: date.getMinutes(),
      second: date.getSeconds(),
    };
  }
}

/**
 * Calculates the next occurrence of the birthday.
 * Supports:
 * - Recurring annually on month/day without hardcoding future years
 * - Initial target floor (e.g., Nov 24, 2027)
 * - Celebration state on the exact birthday date in the configured timezone
 * - Automatic rollover to the following year once the birthday has passed
 */
export function getNextBirthday(
  now: Date = new Date(),
  config: Partial<BirthdayConfig> = {}
): { nextDate: Date; isBirthday: boolean; targetYear: number } {
  const birthMonth = config.birthMonth ?? DEFAULT_BIRTHDAY_CONFIG.birthMonth; // 11
  const birthDay = config.birthDay ?? DEFAULT_BIRTHDAY_CONFIG.birthDay; // 24
  const initialYear = config.initialYear ?? DEFAULT_BIRTHDAY_CONFIG.initialYear; // 2027
  const timezone = config.timezone ?? DEFAULT_BIRTHDAY_CONFIG.timezone;

  // Extract current date components strictly in the configured timezone
  const tzParts = getTimezoneDateParts(now, timezone);
  const currentYear = tzParts.year;
  const currentMonth = tzParts.month;
  const currentDate = tzParts.day;

  // Check if today is the birthday in the configured timezone
  const isTodayBirthday = currentMonth === birthMonth && currentDate === birthDay && currentYear >= initialYear;

  let targetYear = currentYear;

  if (currentYear < initialYear) {
    targetYear = initialYear;
  } else {
    // Check if we are before, on, or past the birthday in this year
    if (currentMonth < birthMonth || (currentMonth === birthMonth && currentDate < birthDay)) {
      targetYear = currentYear;
    } else if (isTodayBirthday) {
      targetYear = currentYear;
    } else {
      targetYear = currentYear + 1;
    }
  }

  // Target birthday midnight in the target year
  const nextDate = new Date(Date.UTC(targetYear, birthMonth - 1, birthDay, 0, 0, 0, 0));

  return {
    nextDate,
    isBirthday: isTodayBirthday,
    targetYear,
  };
}

/**
 * Calculates the remaining countdown metrics (days, hours, minutes, seconds).
 */
export function calculateCountdown(
  now: Date = new Date(),
  config: Partial<BirthdayConfig> = {}
): CountdownResult {
  const { nextDate, isBirthday, targetYear } = getNextBirthday(now, config);

  const diffMs = nextDate.getTime() - now.getTime();
  const totalSeconds = Math.max(0, Math.floor(diffMs / 1000));

  const days = Math.floor(totalSeconds / (3600 * 24));
  const hours = Math.floor((totalSeconds % (3600 * 24)) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  const formattedTargetDate = nextDate.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });

  return {
    days,
    hours,
    minutes,
    seconds,
    totalSeconds,
    isBirthday,
    nextBirthdayDate: nextDate,
    targetYear,
    formattedTargetDate,
  };
}

// Client-side storage keys
const STORAGE_KEY_CONFIG = "hom_birthday_config_v1";
const STORAGE_KEY_WIDGET_POS = "hom_widget_pos_v1";
const STORAGE_KEY_WIDGET_MIN = "hom_widget_minimized_v1";

export function loadSavedBirthdayConfig(): BirthdayConfig {
  if (typeof window === "undefined") return DEFAULT_BIRTHDAY_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CONFIG);
    if (!raw) return DEFAULT_BIRTHDAY_CONFIG;
    return { ...DEFAULT_BIRTHDAY_CONFIG, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_BIRTHDAY_CONFIG;
  }
}

export function saveBirthdayConfig(config: BirthdayConfig): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_CONFIG, JSON.stringify(config));
  } catch (err) {
    console.error("Failed to save birthday config:", err);
  }
}

export function loadWidgetMinimized(): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(STORAGE_KEY_WIDGET_MIN) === "true";
  } catch {
    return false;
  }
}

export function saveWidgetMinimized(minimized: boolean): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY_WIDGET_MIN, String(minimized));
  } catch {}
}
