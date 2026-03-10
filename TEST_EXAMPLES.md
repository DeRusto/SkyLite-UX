# SkyLite-UX Test Examples - Implementation Starter Kit

This document provides concrete, copy-paste-ready test examples for SkyLite-UX's critical features.

---

## 1. Unit Test: useUsers Composable

**File:** `app/__tests__/composables/useUsers.test.ts`

```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMemoryHistory, createRouter } from "vue-router";

import { useUsers } from "~/composables/useUsers";

// Mock data
const mockUsers = [
  { id: "1", name: "Alice", role: "ADULT", color: "#FF6B6B" },
  { id: "2", name: "Bob", role: "CHILD", color: "#4ECDC4" },
];

describe("useUsers Composable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("fetchUsers", () => {
    it("should load users successfully", async () => {
      // Note: This assumes fetch is mocked at a higher level
      // or you use a fetch library that can be mocked
      const { fetchUsers, users, loading } = useUsers();

      // Mock the API response
      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers),
        })
      ) as any;

      await fetchUsers();

      expect(users.value).toEqual(mockUsers);
      expect(loading.value).toBe(false);
    });

    it("should handle fetch errors gracefully", async () => {
      const { fetchUsers, error, loading } = useUsers();

      global.fetch = vi.fn(() =>
        Promise.reject(new Error("Network error"))
      ) as any;

      await expect(fetchUsers()).rejects.toThrow();
      expect(error.value).toBeTruthy();
      expect(loading.value).toBe(false);
    });

    it("should set loading state during fetch", async () => {
      const { fetchUsers, loading } = useUsers();

      global.fetch = vi.fn(() =>
        new Promise(resolve => setTimeout(() => resolve({
          ok: true,
          json: () => Promise.resolve(mockUsers),
        }), 100))
      ) as any;

      const promise = fetchUsers();
      expect(loading.value).toBe(true);

      await promise;
      expect(loading.value).toBe(false);
    });
  });

  describe("getUser", () => {
    it("should return user by ID", async () => {
      const { getUser, users } = useUsers();
      users.value = mockUsers;

      const user = getUser("1");
      expect(user).toEqual(mockUsers[0]);
    });

    it("should return undefined for non-existent user", async () => {
      const { getUser, users } = useUsers();
      users.value = mockUsers;

      const user = getUser("999");
      expect(user).toBeUndefined();
    });
  });

  describe("createUser", () => {
    it("should create new user and update local state", async () => {
      const { createUser, users } = useUsers();
      users.value = mockUsers.slice();

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ id: "3", name: "Charlie", role: "CHILD" }),
        })
      ) as any;

      const newUser = await createUser({ name: "Charlie", role: "CHILD" });

      expect(newUser.id).toBe("3");
      expect(users.value).toHaveLength(3);
    });

    it("should validate user name", async () => {
      const { createUser } = useUsers();

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 400,
        })
      ) as any;

      await expect(
        createUser({ name: "", role: "CHILD" })
      ).rejects.toThrow();
    });
  });

  describe("deleteUser", () => {
    it("should remove user from list", async () => {
      const { deleteUser, users } = useUsers();
      users.value = mockUsers.slice();

      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: true })
      ) as any;

      await deleteUser("1");
      expect(users.value).toHaveLength(1);
      expect(users.value[0].id).toBe("2");
    });

    it("should handle deletion errors", async () => {
      const { deleteUser, error } = useUsers();

      global.fetch = vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 500,
        })
      ) as any;

      await expect(deleteUser("1")).rejects.toThrow();
      expect(error.value).toBeTruthy();
    });
  });

  describe("reorderUsers", () => {
    it("should reorder users by indices", async () => {
      const { reorderUsers, users } = useUsers();
      users.value = mockUsers.slice();

      global.fetch = vi.fn(() =>
        Promise.resolve({ ok: true })
      ) as any;

      await reorderUsers([
        { id: "2", order: 0 },
        { id: "1", order: 1 },
      ]);

      // Note: Order should be reflected in local state
      expect(users.value[0].id).toBe("2");
    });

    it("should validate reorder indices are unique", async () => {
      const { reorderUsers } = useUsers();

      // Attempt to reorder with duplicate indices
      await expect(
        reorderUsers([
          { id: "1", order: 0 },
          { id: "2", order: 0 }, // Duplicate!
        ])
      ).rejects.toThrow();
    });
  });
});
```

---

## 2. API Route Test: Chore Verification

**File:** `server/api/__tests__/chores/[id]/verify.post.test.ts`

```typescript
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { prismaMock } from "../../test-utils";

// Mock Prisma
vi.mock("~/lib/prisma", () => ({
  default: prismaMock,
}));

describe("POST /api/chores/[id]/verify", () => {
  const mockChore = {
    id: "chore-1",
    title: "Clean kitchen",
    points: 10,
    completedBy: "user-2", // Child
    completionDate: new Date("2026-02-21"),
    status: "COMPLETED",
  };

  const mockUsers = {
    child: { id: "user-2", name: "Bob", role: "CHILD", points: 50 },
    adult: { id: "user-1", name: "Alice", role: "ADULT" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should verify chore and award points to child", async () => {
    // Mock: Fetch the chore
    prismaMock.chore.findUnique.mockResolvedValue(mockChore);

    // Mock: Fetch child to verify role
    prismaMock.user.findUnique.mockResolvedValue(mockUsers.child);

    // Mock: Award points
    prismaMock.userPoints.create.mockResolvedValue({
      id: "points-1",
      userId: "user-2",
      amount: 10,
      reason: "Chore verified",
    });

    // Mock the handler
    const { default: handler } = await import("./verify.post");
    const result = await handler({
      context: { params: { id: "chore-1" } },
      body: { verifiedBy: "user-1" }, // Adult verifying
    });

    expect(result.status).toBe("VERIFIED");
    expect(prismaMock.userPoints.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          userId: "user-2",
          amount: 10,
        },
      })
    );
  });

  it("should reject verification if chore not completed", async () => {
    const incompleteChore = { ...mockChore, status: "PENDING" };
    prismaMock.chore.findUnique.mockResolvedValue(incompleteChore);

    const { default: handler } = await import("./verify.post");

    expect(handler({
      context: { params: { id: "chore-1" } },
      body: { verifiedBy: "user-1" },
    })).rejects.toThrow("Chore is not in COMPLETED status");
  });

  it("should reject if verifier is not an adult", async () => {
    prismaMock.chore.findUnique.mockResolvedValue(mockChore);
    prismaMock.user.findUnique.mockResolvedValue(mockUsers.child);

    const { default: handler } = await import("./verify.post");

    expect(handler({
      context: { params: { id: "chore-1" } },
      body: { verifiedBy: "user-2" }, // Child trying to verify
    })).rejects.toThrow("Only adults can verify chores");
  });

  it("should not double-verify same chore", async () => {
    const verifiedChore = { ...mockChore, status: "VERIFIED" };
    prismaMock.chore.findUnique.mockResolvedValue(verifiedChore);

    const { default: handler } = await import("./verify.post");

    expect(handler({
      context: { params: { id: "chore-1" } },
      body: { verifiedBy: "user-1" },
    })).rejects.toThrow("Chore is already verified");
  });

  it("should handle missing chore", async () => {
    prismaMock.chore.findUnique.mockResolvedValue(null);

    const { default: handler } = await import("./verify.post");

    expect(handler({
      context: { params: { id: "chore-999" } },
      body: { verifiedBy: "user-1" },
    })).rejects.toThrow("Chore not found");
  });

  it("should broadcast change to all connected clients", async () => {
    prismaMock.chore.findUnique.mockResolvedValue(mockChore);
    prismaMock.user.findUnique.mockResolvedValue(mockUsers.adult);
    prismaMock.userPoints.create.mockResolvedValue({
      id: "points-1",
      userId: "user-2",
      amount: 10,
    });

    const broadcastSpy = vi.fn();
    vi.mock("../../plugins/02.syncManager", () => ({
      broadcastNativeDataChange: broadcastSpy,
    }));

    const { default: handler } = await import("./verify.post");
    await handler({
      context: { params: { id: "chore-1" } },
      body: { verifiedBy: "user-1" },
    });

    // Verify broadcast was called
    expect(broadcastSpy).toHaveBeenCalledWith(
      "chores",
      "update",
      "chore-1"
    );
  });

  it("should handle concurrent verification attempts", async () => {
    prismaMock.chore.findUnique.mockResolvedValue(mockChore);
    prismaMock.user.findUnique.mockResolvedValue(mockUsers.adult);

    const { default: handler } = await import("./verify.post");

    // Simulate two concurrent verification requests
    const promise1 = handler({
      context: { params: { id: "chore-1" } },
      body: { verifiedBy: "user-1" },
    });

    const promise2 = handler({
      context: { params: { id: "chore-1" } },
      body: { verifiedBy: "user-1" },
    });

    // Second request should fail or be idempotent
    // Depending on implementation
    const results = await Promise.allSettled([promise1, promise2]);
    expect(results.some(r => r.status === "fulfilled")).toBe(true);
  });
});
```

---

## 3. E2E Test: Chore Completion Workflow

**File:** `tests/chores/chore-completion-workflow.spec.ts`

```typescript
import { expect, Page, test } from "@playwright/test";

// Fixtures for test data
const testData = {
  household: { familyName: "Test Family" },
  adultUser: { name: "Parent", password: "adult123", role: "ADULT" },
  childUser: { name: "Child", password: "child123", role: "CHILD" },
  chore: { title: "Clean bedroom", points: 15 },
};

test.describe("Chore Completion Workflow", () => {
  let adultPage: Page;
  let childPage: Page;

  test.beforeEach(async ({ browser }) => {
    // Create two browser contexts (adult and child)
    const adultContext = await browser.newContext();
    const childContext = await browser.newContext();

    adultPage = await adultContext.newPage();
    childPage = await childContext.newPage();

    // Setup household and users via API
    await setupTestHousehold(adultPage);
  });

  test("should complete full chore workflow: create → assign → complete → verify", async () => {
    // STEP 1: Adult creates chore
    await adultPage.goto("/chores");
    await adultPage.click("[data-testid='create-chore-btn']");
    await adultPage.fill("[data-testid='chore-title-input']", testData.chore.title);
    await adultPage.fill("[data-testid='chore-points-input']", testData.chore.points.toString());
    await adultPage.click("[data-testid='assign-child-btn']");
    await adultPage.click(`[data-testid='user-${testData.childUser.name}']`);
    await adultPage.click("[data-testid='save-chore-btn']");

    // STEP 2: Verify chore appears in child's view
    await childPage.goto("/chores");
    await expect(childPage.locator("[data-testid='chore-item']")).toContainText(testData.chore.title);
    await expect(childPage.locator("[data-testid='chore-points']")).toContainText(testData.chore.points);

    // STEP 3: Child marks chore complete
    await childPage.click("[data-testid='chore-item']");
    await childPage.click("[data-testid='mark-complete-btn']");

    // STEP 4: Verify success message
    const successToast = childPage.locator("[data-testid='success-toast']");
    await expect(successToast).toContainText("marked as complete");
    await expect(childPage.locator("[data-testid='chore-status']")).toContainText("PENDING_VERIFICATION");

    // STEP 5: Adult sees pending verification
    await adultPage.goto("/chores");
    const pendingChore = adultPage.locator("[data-testid='pending-verification-badge']").first();
    await expect(pendingChore).toBeVisible();

    // STEP 6: Adult verifies chore
    await adultPage.locator("[data-testid='pending-verification-badge']").first().click();
    await adultPage.click("[data-testid='verify-chore-btn']");
    const verifyConfirm = adultPage.locator("[data-testid='confirm-verify-btn']");
    await expect(verifyConfirm).toBeVisible();
    await adultPage.click("[data-testid='confirm-verify-btn']");

    // STEP 7: Verify success
    const verifyToast = adultPage.locator("[data-testid='success-toast']");
    await expect(verifyToast).toContainText("verified");
    await expect(adultPage.locator("[data-testid='chore-status']")).toContainText("VERIFIED");

    // STEP 8: Verify child's points increased
    await childPage.goto("/dashboard");
    const pointsDisplay = childPage.locator("[data-testid='user-points']");
    const initialPoints = 0;
    const expectedPoints = initialPoints + testData.chore.points;

    // Wait for real-time update (SSE)
    await expect(pointsDisplay).toContainText(expectedPoints.toString());

    // STEP 9: Verify points appear in history
    await childPage.goto("/dashboard");
    await childPage.click("[data-testid='points-history-btn']");
    const historyItem = childPage.locator("[data-testid='history-item']").first();
    await expect(historyItem).toContainText(testData.chore.title);
    await expect(historyItem).toContainText(`+${testData.chore.points}`);
  });

  test("should prevent child from verifying own chore", async () => {
    // Setup: Create chore and mark complete
    await setupChoreAndMarkComplete(adultPage, childPage, testData.chore);

    // Child tries to access verification
    await childPage.goto("/chores");
    const verifyBtn = childPage.locator("[data-testid='verify-chore-btn']");

    // Verify button should not exist or be disabled
    await expect(verifyBtn).not.toBeVisible();
  });

  test("should prevent double-verification", async () => {
    // Setup: Create chore and verify
    await setupChoreAndMarkComplete(adultPage, childPage, testData.chore);
    await adultPage.goto("/chores");
    await adultPage.click("[data-testid='verify-chore-btn']");
    await adultPage.click("[data-testid='confirm-verify-btn']");

    // Try to verify again
    await adultPage.reload();
    const verifyBtn = adultPage.locator("[data-testid='verify-chore-btn']");
    await expect(verifyBtn).toBeDisabled();

    const errorToast = adultPage.locator("[data-testid='error-toast']");
    if (await errorToast.isVisible()) {
      await expect(errorToast).toContainText("already verified");
    }
  });

  test("should handle network errors gracefully", async () => {
    // Setup: Create chore
    await setupChoreAndMarkComplete(adultPage, childPage, testData.chore);

    // Simulate network error during verification
    await adultPage.context().setOffline(true);
    await adultPage.click("[data-testid='verify-chore-btn']");
    await adultPage.click("[data-testid='confirm-verify-btn']");

    // Verify error is shown
    const errorToast = adultPage.locator("[data-testid='error-toast']");
    await expect(errorToast).toBeVisible();
    await expect(errorToast).toContainText(/network|offline/);

    // Bring connection back
    await adultPage.context().setOffline(false);
    await expect(adultPage.locator("[data-testid='retry-btn']")).toBeVisible();
    await adultPage.click("[data-testid='retry-btn']");

    // Verify succeeds
    await expect(adultPage.locator("[data-testid='success-toast']")).toBeVisible();
  });

  test("should show real-time updates via SSE", async () => {
    // Setup: Create chore
    await setupChoreAndMarkComplete(adultPage, childPage, testData.chore);

    // Adult verifies chore
    await adultPage.goto("/chores");
    await adultPage.click("[data-testid='verify-chore-btn']");
    await adultPage.click("[data-testid='confirm-verify-btn']");

    // Child should see update in real-time without refresh
    await expect(childPage.locator("[data-testid='chore-status']")).toContainText("VERIFIED");
  });

  test("should clear completion state on chore refresh", async () => {
    // Setup
    await setupChoreAndMarkComplete(adultPage, childPage, testData.chore);

    // Child refreshes page
    await childPage.reload();

    // Chore should still show as completed/pending verification
    const status = childPage.locator("[data-testid='chore-status']");
    await expect(status).toContainText(/PENDING_VERIFICATION|COMPLETED/);
  });

  test("should handle adult declining chore verification", async () => {
    // Setup
    await setupChoreAndMarkComplete(adultPage, childPage, testData.chore);

    // Adult opens verification dialog
    await adultPage.goto("/chores");
    const chore = adultPage.locator("[data-testid='pending-verification-badge']").first();
    await chore.click();

    // Adult clicks "Decline"
    await adultPage.click("[data-testid='decline-chore-btn']");
    const confirmDecline = adultPage.locator("[data-testid='confirm-decline-btn']");
    await expect(confirmDecline).toBeVisible();
    await adultPage.click("[data-testid='confirm-decline-btn']");

    // Verify status changed
    await expect(adultPage.locator("[data-testid='chore-status']")).toContainText("DECLINED");

    // Child should see it was declined
    await childPage.reload();
    const declinedStatus = childPage.locator("[data-testid='chore-status']");
    await expect(declinedStatus).toContainText("DECLINED");
  });
});

// Helper functions
async function setupTestHousehold(page: Page) {
  await page.goto("/");
  // Use API to create household and users instead of UI
  await page.request.post("/api/household/settings", {
    data: { familyName: testData.household.familyName },
  });
}

async function setupChoreAndMarkComplete(
  adultPage: Page,
  childPage: Page,
  chore: { title: string; points: number }
) {
  // Adult creates and assigns chore
  await adultPage.goto("/chores");
  await adultPage.click("[data-testid='create-chore-btn']");
  await adultPage.fill("[data-testid='chore-title-input']", chore.title);
  await adultPage.fill("[data-testid='chore-points-input']", chore.points.toString());
  await adultPage.click("[data-testid='assign-child-btn']");
  await adultPage.click(`[data-testid='user-${testData.childUser.name}']`);
  await adultPage.click("[data-testid='save-chore-btn']");

  // Child marks complete
  await childPage.goto("/chores");
  await childPage.click("[data-testid='chore-item']");
  await childPage.click("[data-testid='mark-complete-btn']");
  await childPage.locator("[data-testid='success-toast']").waitFor();
}
```

---

## 4. E2E Test: Reward Redemption (Race Condition)

**File:** `tests/rewards/concurrent-redemption.spec.ts`

```typescript
import { expect, test } from "@playwright/test";

test.describe("Reward Redemption - Race Conditions", () => {
  test("should handle simultaneous redemptions correctly", async ({ browser, baseURL }) => {
    // Create two child contexts
    const childContext1 = await browser.newContext();
    const childContext2 = await browser.newContext();
    const page1 = await childContext1.newPage();
    const page2 = await childContext2.newPage();

    // Setup: Create reward worth 50 points, child has 100 points
    await setupRewardTest(baseURL, {
      childStartingPoints: 100,
      rewardPoints: 50,
    });

    await page1.goto(`${baseURL}/rewards`);
    await page2.goto(`${baseURL}/rewards`);

    // Wait for page load
    await expect(page1.locator("[data-testid='reward-item']")).toBeVisible();

    // Both children click redeem simultaneously
    const redeemPromise1 = page1.click("[data-testid='redeem-reward-btn']");
    const redeemPromise2 = page2.click("[data-testid='redeem-reward-btn']");

    await Promise.all([redeemPromise1, redeemPromise2]);

    // Confirm both redemptions
    await page1.click("[data-testid='confirm-redeem-btn']");
    await page2.click("[data-testid='confirm-redeem-btn']");

    // EXPECTED: Only ONE should succeed
    // - One shows success
    // - One shows "insufficient points"
    // - Both can't have 50 points deducted (100 - 50 - 50 = 0, not negative)

    const successCount = (
      (await page1.locator("[data-testid='success-toast']").isVisible() ? 1 : 0)
      + (await page2.locator("[data-testid='success-toast']").isVisible() ? 1 : 0)
    );

    const insufficientCount = (
      (await page1.locator("[data-testid='error-toast']:has-text('sufficient')").isVisible() ? 1 : 0)
      + (await page2.locator("[data-testid='error-toast']:has-text('sufficient')").isVisible() ? 1 : 0)
    );

    // Verify only one succeeded
    expect(successCount + insufficientCount).toBe(2);
    expect(successCount).toBe(1);
    expect(insufficientCount).toBe(1);
  });

  test("should not duplicate points deduction on retry", async ({ page, baseURL }) => {
    // Setup
    await setupRewardTest(baseURL, {
      childStartingPoints: 50,
      rewardPoints: 50,
    });

    await page.goto(`${baseURL}/rewards`);

    // First redemption
    await page.click("[data-testid='redeem-reward-btn']");
    await page.click("[data-testid='confirm-redeem-btn']");

    // Should have 0 points now
    let pointsBalance = await page.locator("[data-testid='points-balance']").textContent();
    expect(pointsBalance).toContain("0");

    // Refresh and check state persisted
    await page.reload();
    pointsBalance = await page.locator("[data-testid='points-balance']").textContent();
    expect(pointsBalance).toContain("0");

    // Try to redeem again (should fail - no points)
    const secondRedeemBtn = page.locator("[data-testid='redeem-reward-btn']");
    if (await secondRedeemBtn.isEnabled()) {
      await secondRedeemBtn.click();
      await page.click("[data-testid='confirm-redeem-btn']");

      // Should show error
      const errorToast = page.locator("[data-testid='error-toast']");
      await expect(errorToast).toBeVisible();
    }
  });

  test("should show pending approval status to adult", async ({ browser, baseURL }) => {
    const adultContext = await browser.newContext();
    const childContext = await browser.newContext();
    const adultPage = await adultContext.newPage();
    const childPage = await childContext.newPage();

    // Setup
    await setupRewardTest(baseURL, { childStartingPoints: 100, rewardPoints: 50 });

    // Child redeems
    await childPage.goto(`${baseURL}/rewards`);
    await childPage.click("[data-testid='redeem-reward-btn']");
    await childPage.click("[data-testid='confirm-redeem-btn']");
    await expect(childPage.locator("[data-testid='success-toast']")).toBeVisible();

    // Adult should see pending approval
    await adultPage.goto(`${baseURL}/rewards`);
    const pendingBadge = adultPage.locator("[data-testid='pending-approval-badge']");
    await expect(pendingBadge).toBeVisible();

    // Adult approves
    await adultPage.click("[data-testid='pending-approval-badge']");
    await adultPage.click("[data-testid='approve-redemption-btn']");

    // Verify points deducted
    const pointsBalance = await adultPage.locator("[data-testid='child-points-balance']");
    await expect(pointsBalance).toContainText("50"); // 100 - 50
  });
});

async function setupRewardTest(baseURL: string | undefined, config: { childStartingPoints: number; rewardPoints: number }) {
  // Use API to create test data
  const createRewardResponse = await fetch(`${baseURL}/api/rewards`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name: "Test Reward",
      points: config.rewardPoints,
      description: "Test reward for concurrent testing",
    }),
  });

  if (!createRewardResponse.ok) {
    throw new Error("Failed to create reward");
  }

  // Set child's starting points
  const setPointsResponse = await fetch(`${baseURL}/api/users/child-user-id/points`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      amount: config.childStartingPoints,
    }),
  });

  if (!setPointsResponse.ok) {
    throw new Error("Failed to set points");
  }
}
```

---

## 5. Test Utilities and Helpers

**File:** `server/api/__tests__/test-utils.ts`

```typescript
import type { PrismaClient } from "@prisma/client";

import { vi } from "vitest";

/**
 * Mock Prisma for API route testing
 */
export const prismaMock: Partial<PrismaClient> = {
  user: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any,
  chore: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any,
  reward: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any,
  userPoints: {
    findMany: vi.fn(),
    create: vi.fn(),
  } as any,
  calendarEvent: {
    findUnique: vi.fn(),
    findMany: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  } as any,
};

/**
 * Reset all mocks between tests
 */
export function resetPrismaMocks() {
  Object.values(prismaMock).forEach((model) => {
    if (model && typeof model === "object") {
      Object.values(model).forEach((fn) => {
        if (typeof fn === "function" && fn.mockClear) {
          fn.mockClear();
        }
      });
    }
  });
}

/**
 * Create mock user for tests
 */
export function createMockUser(overrides = {}) {
  return {
    id: `user-${Math.random().toString(36).substr(2, 9)}`,
    name: "Test User",
    role: "CHILD",
    color: "#FF6B6B",
    avatar: null,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock chore for tests
 */
export function createMockChore(overrides = {}) {
  return {
    id: `chore-${Math.random().toString(36).substr(2, 9)}`,
    title: "Test Chore",
    description: null,
    points: 10,
    assignedTo: "user-1",
    status: "PENDING",
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock reward for tests
 */
export function createMockReward(overrides = {}) {
  return {
    id: `reward-${Math.random().toString(36).substr(2, 9)}`,
    name: "Test Reward",
    points: 50,
    description: null,
    createdAt: new Date(),
    ...overrides,
  };
}

/**
 * Create mock calendar event for tests
 */
export function createMockCalendarEvent(overrides = {}) {
  return {
    id: `event-${Math.random().toString(36).substr(2, 9)}`,
    title: "Test Event",
    description: null,
    start: new Date("2026-02-21T10:00:00Z"),
    end: new Date("2026-02-21T11:00:00Z"),
    allDay: false,
    color: null,
    location: null,
    createdAt: new Date(),
    ...overrides,
  };
}
```

---

## 6. Playwright Configuration Updates

**File:** `playwright.config.ts` (updated)

```typescript
import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,

  reporter: [
    ["html", { open: "never" }],
    ["list"],
    ["json", { outputFile: "test-results.json" }],
    // Add for CI
    ...(process.env.CI ? [["github"]] : []),
  ],

  use: {
    baseURL: "http://localhost:8877",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    actionTimeout: 10000,
    navigationTimeout: 30000,
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    // Add for multi-browser testing
    ...(process.env.CI
      ? [
          {
            name: "firefox",
            use: { ...devices["Desktop Firefox"] },
          },
        ]
      : []),
  ],

  // Auto-start dev server
  webServer: {
    command: process.env.CI ? "npm run build && npm run preview" : "npm run dev",
    url: "http://localhost:8877",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },

  // Global setup for test data
  globalSetup: require.resolve("./tests/global-setup.ts"),
});
```

**File:** `tests/global-setup.ts` (new)

```typescript
import { chromium, FullConfig } from "@playwright/test";

async function globalSetup(config: FullConfig) {
  // Optional: Setup test data before running tests
  // E.g., seed database with test users
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();

  // Navigate to app
  await page.goto("http://localhost:8877");

  // Setup test household via API
  try {
    await page.request.post("http://localhost:8877/api/household/settings", {
      data: {
        familyName: "Test Family",
        choreMode: "POINTS",
      },
    });
  }
  catch (error) {
    console.warn("Could not setup test household:", error);
  }

  await context.close();
  await browser.close();
}

export default globalSetup;
```

---

## 7. Package.json Test Scripts (Add These)

```json
{
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug",
    "test:settings": "playwright test tests/regression-settings-features.spec.ts",
    "test:unit": "vitest",
    "test:unit:ui": "vitest --ui",
    "test:unit:coverage": "vitest --coverage",
    "test:all": "npm run test:unit && npm run test",
    "test:ci": "npm run type-check && npm run lint && npm run test:unit && npm run test"
  },
  "devDependencies": {
    "@playwright/test": "^1.58.2",
    "@testing-library/vue": "^8.0.0",
    "@vitest/ui": "^1.0.0",
    "jsdom": "^23.0.0",
    "vitest": "^1.0.0",
    "vitest-mock-extended": "^1.1.0"
  }
}
```

---

## Summary

These examples provide a complete testing foundation for SkyLite-UX:

1. **Unit tests** for composables (reusable patterns)
2. **API route tests** for complex business logic
3. **E2E tests** for critical user workflows
4. **Test utilities** for mock data and helpers
5. **Configuration** for Playwright and test framework setup

Start with the chore completion E2E test (it's the most complex workflow) and expand from there.
