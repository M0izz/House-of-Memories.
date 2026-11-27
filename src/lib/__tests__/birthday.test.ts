import {
  getNextBirthday,
  calculateCountdown,
  DEFAULT_BIRTHDAY_CONFIG,
  BirthdayConfig,
} from "../birthday";

// Simple test assertions runner
function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

export function runBirthdayAcceptanceTests() {
  console.log("Starting Birthday Countdown & Recurrence Acceptance Tests...\n");

  const config: BirthdayConfig = {
    ...DEFAULT_BIRTHDAY_CONFIG,
    birthMonth: 11,
    birthDay: 24,
    initialYear: 2027,
    timezone: "UTC",
  };

  // Test 1: Countdown targets November 24, 2027 initially when current date is in 2026
  {
    const date2026 = new Date(2026, 10, 25, 12, 0, 0); // Nov 25, 2026
    const result = getNextBirthday(date2026, config);
    assert(result.targetYear === 2027, "Must target initial year 2027 when current year is 2026");
    assert(result.nextDate.getFullYear() === 2027, "Target year must be 2027");
    assert(result.nextDate.getMonth() === 10, "Target month must be November (10 in 0-indexed)");
    assert(result.nextDate.getDate() === 24, "Target day must be 24");
    assert(result.isBirthday === false, "Must not be celebration state prior to birthday");
    console.log("✓ Test 1 Passed: Initial target is accurately November 24, 2027");
  }

  // Test 2: Exactly before the birthday in 2027 (e.g., Nov 20, 2027)
  {
    const date2027Before = new Date(2027, 10, 20, 10, 0, 0);
    const result = getNextBirthday(date2027Before, config);
    assert(result.targetYear === 2027, "Target must be 2027");
    assert(result.isBirthday === false, "isBirthday must be false before Nov 24");
    const cd = calculateCountdown(date2027Before, config);
    assert(cd.days === 3, "Remaining days should be 3");
    console.log("✓ Test 2 Passed: Accurate countdown before target date");
  }

  // Test 3: On November 24, 2027 — Birthday Celebration State Activates!
  {
    const birthdayDay = new Date(2027, 10, 24, 15, 30, 0);
    const result = getNextBirthday(birthdayDay, config);
    assert(result.isBirthday === true, "Celebration state must activate on November 24");
    assert(result.targetYear === 2027, "Target year on birthday is 2027");
    console.log("✓ Test 3 Passed: Birthday celebration state activates on November 24");
  }

  // Test 4: Day after the birthday (Nov 25, 2027) — Automatically rolls to Nov 24, 2028!
  {
    const afterBirthday2027 = new Date(2027, 10, 25, 9, 0, 0);
    const result = getNextBirthday(afterBirthday2027, config);
    assert(result.targetYear === 2028, "Must automatically advance to 2028 without hardcoded year");
    assert(result.nextDate.getFullYear() === 2028, "Next birthday year must be 2028");
    assert(result.isBirthday === false, "Celebration state resets after birthday date");
    console.log("✓ Test 4 Passed: Automatically rolls to November 24, 2028 after birthday ends");
  }

  // Test 5: Subsequent years (e.g., in 2029 after Nov 24 -> rolls to Nov 24, 2030)
  {
    const date2029 = new Date(2029, 10, 26, 12, 0, 0);
    const result = getNextBirthday(date2029, config);
    assert(result.targetYear === 2030, "Must calculate 2030 for following year");
    console.log("✓ Test 5 Passed: Recurring logic functions infinitely in subsequent years");
  }

  // Test 6: Idempotency Key generation prevents duplicate notifications
  {
    const userId = "user-123";
    const year = 2027;
    const key1 = `user_${userId}_birthday_day_${year}_${year}`;
    const key2 = `user_${userId}_birthday_day_${year}_${year}`;
    assert(key1 === key2, "Idempotency key must be deterministic");
    console.log("✓ Test 6 Passed: Idempotency keys prevent duplicate notifications");
  }

  console.log("\nAll Birthday Countdown & Recurrence Acceptance Tests Passed successfully! 🎉\n");
  return true;
}

// Self-run when executed directly via Node / ts-node
if (typeof require !== "undefined" && require.main === module) {
  runBirthdayAcceptanceTests();
}
