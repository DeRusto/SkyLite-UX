/* eslint-disable no-console */
import { hashPin, verifyPin } from "../server/utils/security";

async function runTests() {
  console.log("Starting security tests...");

  const testPin = "1234";

  // Test 1: Hashing
  console.log("Test 1: Hashing PIN...");
  const hash = await hashPin(testPin);
  console.log("Generated hash:", hash);

  if (!hash.includes(":")) {
    throw new Error("Hash format invalid (should contain colon)");
  }

  // Test 2: Verification (Success)
  console.log("Test 2: Verifying correct PIN...");
  const isValid = await verifyPin(hash, testPin);
  if (isValid !== true) {
    throw new Error("Verification failed for correct PIN");
  }
  console.log("✅ Correct PIN verified");

  // Test 3: Verification (Failure)
  console.log("Test 3: Verifying incorrect PIN...");
  const isInvalid = await verifyPin(hash, "0000");
  if (isInvalid !== false) {
    throw new Error("Verification succeeded for incorrect PIN");
  }
  console.log("✅ Incorrect PIN rejected");

  // Test 4: Verification (Legacy Plaintext)
  console.log("Test 4: Verifying legacy plaintext...");
  const isLegacyValid = await verifyPin("1234", "1234");
  if (isLegacyValid !== true) {
    throw new Error("Verification failed for legacy plaintext");
  }
  console.log("✅ Legacy plaintext verified");

  // Test 5: Verification (Legacy Plaintext Invalid)
  console.log("Test 5: Verifying legacy plaintext (wrong pin)...");
  const isLegacyInvalid = await verifyPin("1234", "0000");
  if (isLegacyInvalid !== false) {
    throw new Error("Verification succeeded for legacy incorrect PIN");
  }
  console.log("✅ Legacy incorrect PIN rejected");

  // Test 6: Null handling
  console.log("Test 6: Verifying null hash...");
  const isNullValid = await verifyPin(null, "1234");
  if (isNullValid !== false) {
    throw new Error("Verification succeeded for null hash");
  }
  console.log("✅ Null hash rejected");

  console.log("🎉 All security tests passed!");
}

runTests().catch(err => {
  console.error("❌ Test failed:", err);
  process.exit(1);
});
