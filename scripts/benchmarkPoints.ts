import { PrismaClient } from "@prisma/client";
import { consola } from "consola";

const prisma = new PrismaClient();

async function main() {
  consola.info("Starting benchmark...");

  // Create test user
  const user = await prisma.user.create({
    data: {
      name: "Benchmark User",
      email: "benchmark@example.com",
    },
  });

  const userId = user.id;
  consola.info(`Created test user: ${userId}`);

  const ITERATIONS = 100;

  // --- Baseline: Two Queries ---
  consola.info("Running Baseline (Two Queries)...");
  let baselineTotalTime = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const start = process.hrtime();

    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true },
    });

    if (!u)
      throw new Error("User not found in baseline");

    let p = await prisma.userPoints.findUnique({
      where: { userId },
    });

    if (!p) {
      p = await prisma.userPoints.create({
        data: { userId },
      });
    }

    const end = process.hrtime(start);
    baselineTotalTime += end[0] * 1000 + end[1] / 1e6; // milliseconds
  }

  const baselineAvg = baselineTotalTime / ITERATIONS;
  consola.info(`Baseline Average Time: ${baselineAvg.toFixed(3)} ms`);

  // Cleanup points created by baseline (optional, but good for isolation if we wanted to test creation)
  // But here we want to test read performance mostly.
  // We'll leave points there so optimized run also benefits from existence.

  // --- Optimized: Single Query ---
  consola.info("Running Optimized (Single Query)...");
  let optimizedTotalTime = 0;

  for (let i = 0; i < ITERATIONS; i++) {
    const start = process.hrtime();

    const u = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        points: true,
      },
    });

    if (!u)
      throw new Error("User not found in optimized");

    let p = u.points;

    if (!p) {
      p = await prisma.userPoints.create({
        data: { userId },
      });
    }

    const end = process.hrtime(start);
    optimizedTotalTime += end[0] * 1000 + end[1] / 1e6;
  }

  const optimizedAvg = optimizedTotalTime / ITERATIONS;
  consola.info(`Optimized Average Time: ${optimizedAvg.toFixed(3)} ms`);

  // Calculate improvement
  const improvement = baselineAvg - optimizedAvg;
  const percent = (improvement / baselineAvg) * 100;

  consola.success(`Improvement: ${improvement.toFixed(3)} ms (${percent.toFixed(1)}%)`);

  // Cleanup
  // Delete points first because of foreign key constraint (cascade might handle it, but being explicit is safer)
  // Actually schema says onDelete: Cascade for user->points relationship?
  // Let's check schema:
  // model UserPoints { ... user User @relation(fields: [userId], references: [id], onDelete: Cascade) ... }
  // So deleting user should delete points.

  await prisma.user.delete({ where: { id: userId } });
  consola.info("Cleaned up test user.");
}

main()
  .catch((e) => {
    consola.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
