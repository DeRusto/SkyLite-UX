import { Priority, PrismaClient } from "@prisma/client";
import { consola } from "consola";
import { performance } from "node:perf_hooks";

const prisma = new PrismaClient();

async function main() {
  const TEST_COLUMN_NAME = "BENCHMARK_TEST_COLUMN";

  // Clean up previous runs
  const existingColumn = await prisma.todoColumn.findFirst({
    where: { name: TEST_COLUMN_NAME },
  });

  if (existingColumn) {
    consola.info("Cleaning up previous benchmark data...");
    await prisma.todoColumn.delete({
      where: { id: existingColumn.id },
    });
  }

  // Create test column
  const column = await prisma.todoColumn.create({
    data: {
      name: TEST_COLUMN_NAME,
    },
  });

  consola.info(`Created test column: ${column.id}`);

  // Create 5000 old completed todos
  const oldDate = new Date();
  oldDate.setDate(oldDate.getDate() - 30); // 30 days ago

  const batchSize = 1000;
  for (let i = 0; i < 5000; i += batchSize) {
    const todos = Array.from({ length: batchSize }).map((_, index) => ({
      title: `Old Completed Todo ${i + index}`,
      completed: true,
      updatedAt: oldDate,
      todoColumnId: column.id,
      priority: Priority.MEDIUM,
      order: i + index,
    }));

    await prisma.todo.createMany({
      data: todos,
    });
    consola.info(`Created ${i + batchSize} old todos...`);
  }

  // Create 100 active todos
  const activeTodos = Array.from({ length: 100 }).map((_, index) => ({
    title: `Active Todo ${index}`,
    completed: false,
    updatedAt: new Date(),
    todoColumnId: column.id,
    priority: Priority.MEDIUM,
    order: index,
  }));

  await prisma.todo.createMany({
    data: activeTodos,
  });
  consola.info("Created 100 active todos.");

  // Measure baseline
  consola.info("Measuring baseline performance...");

  const start = performance.now();

  // Simulating the query logic from server/api/todos/index.get.ts
  const todos = await prisma.todo.findMany({
    where: { todoColumnId: column.id },
    include: {
      todoColumn: {
        select: {
          id: true,
          name: true,
          order: true,
          isDefault: true,
          user: {
            select: {
              id: true,
              name: true,
              avatar: true,
            },
          },
        },
      },
    },
    orderBy: [
      { todoColumnId: "asc" },
      { completed: "asc" },
      { order: "asc" },
    ],
  });

  const end = performance.now();

  consola.info(`Fetched ${todos.length} todos in ${(end - start).toFixed(2)}ms`);

  // Clean up
  await prisma.todoColumn.delete({
    where: { id: column.id },
  });
  consola.info("Cleaned up test data.");
}

main()
  .catch((e) => {
    consola.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
