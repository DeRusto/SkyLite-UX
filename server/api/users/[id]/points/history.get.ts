import prisma from "~/lib/prisma";

export default defineEventHandler(async (event) => {
  const userId = getRouterParam(event, "id");

  if (!userId) {
    throw createError({
      statusCode: 400,
      statusMessage: "User ID is required",
    });
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true },
  });

  if (!user) {
    throw createError({
      statusCode: 404,
      statusMessage: "User not found",
    });
  }

  const query = getQuery(event);
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit as string, 10) || 50));
  const cursor = query.cursor as string | undefined;

  let lastChoreId: string | undefined;
  let lastRedemptionId: string | undefined;

  if (cursor) {
    const parts = cursor.split("|");
    lastChoreId = parts[0] || undefined;
    lastRedemptionId = parts[1] || undefined;
  }

  // To correctly get the items for a specific page in a merged stream using cursor-based pagination,
  // we fetch (limit + 1) items from each source independently starting after their respective cursors.
  // We then merge, sort, and slice to the requested limit.
  const fetchCount = limit + 1;

  // Get chore completions (points earned)
  const choreCompletions = await prisma.choreCompletion.findMany({
    where: {
      userId,
      status: "APPROVED",
    },
    include: {
      chore: {
        select: { id: true, name: true },
      },
    },
    orderBy: { completedAt: "desc" },
    take: fetchCount,
    ...(lastChoreId ? { cursor: { id: lastChoreId }, skip: 1 } : {}),
  });

  // Get reward redemptions (points spent)
  const redemptions = await prisma.rewardRedemption.findMany({
    where: {
      userId,
      status: "APPROVED",
    },
    include: {
      reward: {
        select: { id: true, name: true },
      },
    },
    orderBy: { redeemedAt: "desc" },
    take: fetchCount,
    ...(lastRedemptionId ? { cursor: { id: lastRedemptionId }, skip: 1 } : {}),
  });

  // Combine and sort history
  const combinedHistory = [
    ...choreCompletions.map(c => ({
      id: c.id,
      type: "earned" as const,
      description: `Completed: ${c.chore.name}`,
      points: c.pointsAwarded,
      date: c.completedAt,
    })),
    ...redemptions.map(r => ({
      id: r.id,
      type: "spent" as const,
      description: `Redeemed: ${r.reward.name}`,
      points: -r.pointsSpent,
      date: r.redeemedAt,
    })),
  ].sort((a, b) => {
    const dateA = a.date ? new Date(a.date).getTime() : 0;
    const dateB = b.date ? new Date(b.date).getTime() : 0;
    return dateB - dateA;
  });

  const history = combinedHistory.slice(0, limit);
  const hasMore = combinedHistory.length > limit;

  let nextCursor: string | undefined;
  if (hasMore) {
    // To generate the next cursor, we find the last seen ID for each source within or before the current page results
    const lastChore = [...history].reverse().find(i => i.type === "earned");
    const lastRedemption = [...history].reverse().find(i => i.type === "spent");

    const nextChoreId = lastChore?.id || lastChoreId || "";
    const nextRedemptionId = lastRedemption?.id || lastRedemptionId || "";
    nextCursor = `${nextChoreId}|${nextRedemptionId}`;
  }

  return {
    userId,
    userName: user.name,
    history,
    limit,
    nextCursor,
    hasMore,
  };
});
