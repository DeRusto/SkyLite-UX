const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

(async () => {
  const calendars = await prisma.integration.findMany({
    where: { type: 'calendar' }
  });
  console.log('Calendar integrations:', JSON.stringify(calendars, null, 2));
  await prisma.$disconnect();
})();
