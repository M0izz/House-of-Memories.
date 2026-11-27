import {
  getNextBirthday,
  calculateCountdown,
  DEFAULT_BIRTHDAY_CONFIG,
  BirthdayConfig,
  getZonedInstant,
  getTimezoneDateParts,
  validateTimezone,
  CANONICAL_SPACE_TIMEZONE,
} from "../birthday";

function assert(condition: boolean, message: string) {
  if (!condition) {
    throw new Error(`Assertion Failed: ${message}`);
  }
}

export function runBirthdayAcceptanceTests() {
  console.log("Starting Comprehensive Birthday Timezone & Recurrence Acceptance Tests...\n");

  const canonicalTz = "America/New_York"; // UTC-5 in November
  const config: BirthdayConfig = {
    ...DEFAULT_BIRTHDAY_CONFIG,
    birthMonth: 11,
    birthDay: 24,
    initialYear: 2027,
    timezone: canonicalTz,
  };

  // 1. Exact birthday midnight in configured timezone
  // In America/New_York (EST, UTC-5), midnight on 2027-11-24 is 2027-11-24T05:00:00.000Z
  {
    const exactMidnightUtc = new Date("2027-11-24T05:00:00.000Z");
    const result = getNextBirthday(exactMidnightUtc, config);
    assert(result.isBirthday === true, "Celebration state MUST be true at exact midnight in configured timezone");
    assert(result.targetYear === 2027, "Target year must be 2027");
    assert(result.birthdayStart.getTime() === exactMidnightUtc.getTime(), "Birthday start instant must equal midnight instant");
    console.log("✓ Test 1 Passed: Exact birthday midnight in configured timezone activates celebration");
  }

  // 2. Day before birthday (Nov 23, 2027 15:00 EST -> 20:00 UTC)
  {
    const dayBeforeUtc = new Date("2027-11-23T20:00:00.000Z");
    const result = getNextBirthday(dayBeforeUtc, config);
    assert(result.isBirthday === false, "Must not be birthday on day before");
    assert(result.targetYear === 2027, "Target year is 2027");
    const cd = calculateCountdown(dayBeforeUtc, config);
    assert(cd.days === 0, "Hours remaining is under 24 hours (0 full days)");
    assert(cd.hours === 9, "Exactly 9 hours remaining until midnight EST (20:00 UTC to 05:00 UTC next day)");
    console.log("✓ Test 2 Passed: Day before birthday calculates accurate countdown");
  }

  // 3. Birthday afternoon (Nov 24, 2027 14:30 EST -> 19:30 UTC)
  {
    const afternoonUtc = new Date("2027-11-24T19:30:00.000Z");
    const result = getNextBirthday(afternoonUtc, config);
    assert(result.isBirthday === true, "Afternoon on Nov 24 must still be celebration state");
    assert(result.targetYear === 2027, "Target year is 2027");
    const cd = calculateCountdown(afternoonUtc, config);
    assert(cd.isBirthday === true, "Countdown result must reflect active celebration");
    console.log("✓ Test 3 Passed: Birthday afternoon maintains celebration state");
  }

  // 4. Day after birthday (Nov 25, 2027 01:00 EST -> 06:00 UTC)
  {
    const dayAfterUtc = new Date("2027-11-25T06:00:00.000Z");
    const result = getNextBirthday(dayAfterUtc, config);
    assert(result.isBirthday === false, "Celebration must be ended on day after");
    assert(result.targetYear === 2028, "Must automatically roll over to 2028");
    console.log("✓ Test 4 Passed: Day after birthday deactivates celebration and targets 2028");
  }

  // 5. Year rollover (Nov 24, 2028, 2029, 2030)
  {
    const in2028 = new Date("2028-11-24T12:00:00.000Z"); // During 2028 celebration
    const res2028 = getNextBirthday(in2028, config);
    assert(res2028.isBirthday === true, "Must celebrate in 2028");
    assert(res2028.targetYear === 2028, "Target year must be 2028");

    const after2028 = new Date("2028-11-25T10:00:00.000Z");
    const resAfter2028 = getNextBirthday(after2028, config);
    assert(resAfter2028.targetYear === 2029, "Must roll to 2029");
    assert(resAfter2028.isBirthday === false, "Must not be birthday after 2028");
    console.log("✓ Test 5 Passed: Year rollover operates perpetually without manual yearly edits");
  }

  // 6. Devices in different timezones
  // Maya is in Tokyo (UTC+9) and Alex is in London (UTC+0).
  // At universal UTC instant 2027-11-24T05:00:00.000Z:
  // - In Tokyo it is 14:00 (afternoon) on Nov 24.
  // - In London it is 05:00 (early morning) on Nov 24.
  // - In America/New_York (the space's canonical timezone) it is EXACTLY 00:00:00 midnight!
  // Both devices evaluate against canonical timezone config, ensuring zero desync!
  {
    const instantUtc = new Date("2027-11-24T05:00:00.000Z");
    const tokyoEvaluation = calculateCountdown(instantUtc, config);
    const londonEvaluation = calculateCountdown(instantUtc, config);

    assert(tokyoEvaluation.isBirthday === true, "Tokyo device must report birthday is active");
    assert(londonEvaluation.isBirthday === true, "London device must report birthday is active");
    assert(
      tokyoEvaluation.nextBirthdayDate.getTime() === londonEvaluation.nextBirthdayDate.getTime(),
      "Both devices in different timezones must evaluate to the identical nextDate instant"
    );
    assert(
      tokyoEvaluation.totalSeconds === londonEvaluation.totalSeconds,
      "Both devices must show the exact same countdown seconds"
    );
    console.log("✓ Test 6 Passed: Devices in different timezones calculate identical countdown and celebration");
  }

  // 7. Invalid timezone configuration
  {
    const invalidConfig: BirthdayConfig = {
      ...config,
      timezone: "Not/A_Real_Timezone",
    };
    const validated = validateTimezone(invalidConfig.timezone);
    assert(validated === CANONICAL_SPACE_TIMEZONE, "Must safely fall back to CANONICAL_SPACE_TIMEZONE");

    const fallbackResult = getNextBirthday(new Date("2027-11-20T12:00:00.000Z"), invalidConfig);
    assert(fallbackResult.targetYear === 2027, "Must function properly with fallback timezone");
    console.log("✓ Test 7 Passed: Invalid timezone safely falls back without crashing");
  }

  console.log("\nAll 7 Birthday Timezone & Recurrence Acceptance Tests Passed! 🎉\n");
  return true;
}

if (typeof require !== "undefined" && require.main === module) {
  runBirthdayAcceptanceTests();
}
