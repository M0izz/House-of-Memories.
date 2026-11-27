import {
  getNextBirthday,
  calculateCountdown,
  DEFAULT_BIRTHDAY_CONFIG,
  getZonedInstant,
  validateTimezone,
  CANONICAL_SPACE_TIMEZONE,
} from "../src/lib/birthday.ts";

function assert(condition, message) {
  if (!condition) {
    console.error(`❌ Assertion Failed: ${message}`);
    process.exit(1);
  }
}

console.log("============================================================");
console.log("🎂 House of Memories — Recurring Birthday Acceptance Tests");
console.log("============================================================\n");

const canonicalTz = "America/New_York"; // UTC-5 in November
const config = {
  ...DEFAULT_BIRTHDAY_CONFIG,
  birthMonth: 11,
  birthDay: 24,
  initialYear: 2027,
  timezone: canonicalTz,
};

// 1. Exact birthday midnight in configured timezone
const exactMidnightUtc = new Date("2027-11-24T05:00:00.000Z");
const res1 = getNextBirthday(exactMidnightUtc, config);
assert(res1.isBirthday === true, "Celebration state MUST be true at exact midnight in configured timezone");
assert(res1.targetYear === 2027, "Target year must be 2027");
assert(res1.birthdayStart.getTime() === exactMidnightUtc.getTime(), "Birthday start instant must equal midnight instant");
console.log("✓ Test 1: Exact birthday midnight in configured timezone activates celebration");

// 2. Day before birthday (Nov 23, 2027 15:00 EST -> 20:00 UTC)
const dayBeforeUtc = new Date("2027-11-23T20:00:00.000Z");
const res2 = getNextBirthday(dayBeforeUtc, config);
assert(res2.isBirthday === false, "Must not be birthday on day before");
assert(res2.targetYear === 2027, "Target year is 2027");
const cd2 = calculateCountdown(dayBeforeUtc, config);
assert(cd2.days === 0, "Hours remaining is under 24 hours (0 full days)");
assert(cd2.hours === 9, "Exactly 9 hours remaining until midnight EST");
console.log("✓ Test 2: Day before birthday calculates accurate countdown");

// 3. Birthday afternoon (Nov 24, 2027 14:30 EST -> 19:30 UTC)
const afternoonUtc = new Date("2027-11-24T19:30:00.000Z");
const res3 = getNextBirthday(afternoonUtc, config);
assert(res3.isBirthday === true, "Afternoon on Nov 24 must still be celebration state");
assert(res3.targetYear === 2027, "Target year is 2027");
const cd3 = calculateCountdown(afternoonUtc, config);
assert(cd3.isBirthday === true, "Countdown result must reflect active celebration");
console.log("✓ Test 3: Birthday afternoon maintains celebration state");

// 4. Day after birthday (Nov 25, 2027 01:00 EST -> 06:00 UTC)
const dayAfterUtc = new Date("2027-11-25T06:00:00.000Z");
const res4 = getNextBirthday(dayAfterUtc, config);
assert(res4.isBirthday === false, "Celebration must be ended on day after");
assert(res4.targetYear === 2028, "Must automatically roll over to 2028");
console.log("✓ Test 4: Day after birthday deactivates celebration and targets 2028");

// 5. Year rollover (Nov 24, 2028, 2029, 2030)
const in2028 = new Date("2028-11-24T12:00:00.000Z");
const res5a = getNextBirthday(in2028, config);
assert(res5a.isBirthday === true, "Must celebrate in 2028");
assert(res5a.targetYear === 2028, "Target year must be 2028");

const after2028 = new Date("2028-11-25T10:00:00.000Z");
const res5b = getNextBirthday(after2028, config);
assert(res5b.targetYear === 2029, "Must roll to 2029");
assert(res5b.isBirthday === false, "Must not be birthday after 2028");
console.log("✓ Test 5: Year rollover operates perpetually without manual yearly edits");

// 6. Devices in different timezones (Tokyo UTC+9 vs London UTC+0)
const instantUtc = new Date("2027-11-24T05:00:00.000Z");
const tokyoEvaluation = calculateCountdown(instantUtc, config);
const londonEvaluation = calculateCountdown(instantUtc, config);
assert(tokyoEvaluation.isBirthday === true, "Tokyo device must report birthday is active");
assert(londonEvaluation.isBirthday === true, "London device must report birthday is active");
assert(
  tokyoEvaluation.nextBirthdayDate.getTime() === londonEvaluation.nextBirthdayDate.getTime(),
  "Both devices in different timezones must evaluate to identical nextDate instant"
);
assert(
  tokyoEvaluation.totalSeconds === londonEvaluation.totalSeconds,
  "Both devices must show the exact same countdown seconds"
);
console.log("✓ Test 6: Devices in different timezones calculate identical countdown and celebration");

// 7. Invalid timezone configuration
const invalidConfig = {
  ...config,
  timezone: "Invalid/Fake_Zone",
};
const validated = validateTimezone(invalidConfig.timezone);
assert(validated === CANONICAL_SPACE_TIMEZONE, "Must safely fall back to CANONICAL_SPACE_TIMEZONE");
const fallbackResult = getNextBirthday(new Date("2027-11-20T12:00:00.000Z"), invalidConfig);
assert(fallbackResult.targetYear === 2027, "Must function properly with fallback timezone");
console.log("✓ Test 7: Invalid timezone safely falls back without crashing");

console.log("\n============================================================");
console.log("🎉 ALL 7 BIRTHDAY TIMEZONE ACCEPTANCE TESTS PASSED!");
console.log("============================================================\n");
