## 2025-10-01 - Missing Foreign Key Indexes
**Learning:** Prisma does not automatically add indexes to foreign keys in PostgreSQL. This leads to sequential scans on heavy queries like fetching todos by column or chores by user.
**Action:** Always verify schema foreign keys have `@@index` in `prisma/schema.prisma`.
