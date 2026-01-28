import { hashPin, timingSafeStringEqual, verifyPin } from "../server/utils/security";

/* eslint-disable no-console */
async function runTests() {
  console.log("Running security utils tests...");

  let passed = 0;
  let failed = 0;

  function assert(condition: boolean, message: string) {
    if (condition) {
      console.log(`✅ ${message}`);
      passed++;
    }
    else {
      console.error(`❌ ${message}`);
      failed++;
    }
  }

  // Test 1: Hashing
  const pin = "1234";
  const hash = await hashPin(pin);
  assert(hash.startsWith("SCRYPT:"), "Hash starts with SCRYPT:");
  assert(hash.split(":").length === 3, "Hash has 3 parts (prefix, salt, key)");

  // Test 2: Verify correct pin
  const isValid = await verifyPin(pin, hash);
  assert(isValid, "Verifies correct PIN");

  // Test 3: Verify incorrect pin
  const isInvalid = await verifyPin("wrong", hash);
  assert(!isInvalid, "Rejects incorrect PIN");

  // Test 4: Verify legacy plaintext
  const isLegacyInvalid = await verifyPin(pin, pin);
  assert(!isLegacyInvalid, "Rejects legacy plaintext PIN as invalid hash format");

  // Test 5: Verify invalid hash format
  const isGarbageInvalid = await verifyPin(pin, "garbage");
  assert(!isGarbageInvalid, "Rejects garbage hash");

  // Test 6: Timing safe string equal - equal strings
  const isEqual = timingSafeStringEqual("test", "test");
  assert(isEqual, "timingSafeStringEqual returns true for equal strings");

  // Test 7: Timing safe string equal - different strings same length
  const isDifferent = timingSafeStringEqual("test", "best");
  assert(!isDifferent, "timingSafeStringEqual returns false for different strings");

  // Test 8: Timing safe string equal - different lengths
  const isDifferentLength = timingSafeStringEqual("test", "testing");
  assert(!isDifferentLength, "timingSafeStringEqual returns false for different lengths");

  // Test 9: Timing safe string equal - invalid types
  // @ts-expect-error testing invalid type
  const isInvalidType = timingSafeStringEqual("test", 123);
  assert(!isInvalidType, "timingSafeStringEqual returns false for invalid types");

  console.log(`\nTests completed. Passed: ${passed}, Failed: ${failed}`);
  if (failed > 0) {
    process.exit(1);
  }
}

runTests().catch(console.error);
