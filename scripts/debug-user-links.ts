import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const integrations = await prisma.integration.findMany({
    where: { service: "google-calendar" },
  });

  if (integrations.length === 0) {
    console.log("No Google Calendar integrations found.");
    return;
  }

  const integration = integrations[0];
  console.log(`Checking integration: ${integration.id}`);
  console.log("Settings:", JSON.stringify(integration.settings, null, 2));

  // We can't easily call the API handler directly without mocking H3 event
  // But we can replicate the logic or rely on the fact that we have the integration ID
  // and manually run the mapping logic to see if it SHOULD work.

  const users = await prisma.user.findMany();
  console.log(`Found ${users.length} users.`);

  for (const user of users) {
    console.log(`User ${user.name}:`, JSON.stringify(user.linkedCalendars));
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
