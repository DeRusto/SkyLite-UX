import { PrismaClient } from "@prisma/client";
import { consola } from "consola";

const prisma = new PrismaClient();

async function main() {
  const integrations = await prisma.integration.findMany({
    where: { service: "google-calendar" },
  });

  if (integrations.length === 0) {
    consola.info("No Google Calendar integrations found.");
    return;
  }

  const integration = integrations[0];
  consola.info(`Checking integration: ${integration.id}`);
  consola.info("Settings:", JSON.stringify(integration.settings, null, 2));

  const users = await prisma.user.findMany();
  consola.info(`Found ${users.length} users.`);

  for (const user of users) {
    consola.info(`User ${user.name}:`, JSON.stringify(user.linkedCalendars));
  }
}

main()
  .catch((e) => {
    consola.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
