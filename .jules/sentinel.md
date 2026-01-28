## 2026-01-26 - [Parent PIN Plaintext Storage]

**Vulnerability:** Parent PIN was stored in plaintext in the database (`household_settings` table), allowing anyone with database access to view the PIN.
**Learning:** The schema comment said "// Encrypted PIN", but the implementation used simple string comparison. Always verify implementation matches comments/documentation.
**Prevention:** Use `scrypt` or similar hashing algorithms to hash sensitive data before storage. Implemented a migration strategy to lazily hash legacy PINs upon next verification.

## 2026-01-28 - [Timing Attack in PIN Verification]

**Vulnerability:** Legacy plaintext PIN verification used `===` for string comparison, allowing timing attacks to guess the PIN character by character.
**Learning:** Even when migrating to secure hashes, the backward compatibility layer for legacy data must also be secure. `Buffer.from()` throws on non-string inputs, creating a DoS vector if not guarded.
**Prevention:** Use constant-time comparison (e.g., `crypto.timingSafeEqual`) for all secret comparisons, including legacy fallbacks. Ensure input types are strictly validated before creating Buffers.
