## 2025-05-15 - Plaintext PIN Storage
**Vulnerability:** The `parentPin` used for restricted actions was stored as plaintext in the database and verified using direct string comparison.
**Learning:** Even fields labeled as "PIN" or "simple codes" are effective passwords and must be protected. Developers may overlook this for "low security" features, but it exposes user credentials if the DB is compromised.
**Prevention:** Enforce hashing for ALL authorization secrets. Use `node:crypto` or `bcrypt` standard libraries. Implemented `scrypt` hashing with salt for `parentPin`.
