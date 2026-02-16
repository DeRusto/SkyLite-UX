<script setup lang="ts">
import { consola } from "consola";

import GlobalFloatingActionButton from "~/components/global/globalFloatingActionButton.vue";
import RewardDialog from "~/components/rewards/rewardDialog.vue";
import SettingsPinDialog from "~/components/settings/settingsPinDialog.vue";

const { showSuccess, showError, showWarning } = useAlertToast();

// PIN protection for reward management
const isPinDialogOpen = ref(false);
const isRewardManagementUnlocked = ref(false);
const hasAdultPin = ref(false);

// Check if adult PIN is set
async function checkAdultPin() {
  try {
    const settings = await $fetch<{ hasAdultPin: boolean }>("/api/household/settings");
    hasAdultPin.value = settings.hasAdultPin;
  }
  catch (err) {
    consola.warn("Rewards: Failed to check household settings:", err);
  }
}

type Reward = {
  id: string;
  name: string;
  description: string | null;
  pointCost: number;
  quantityAvailable: number | null;
  expiresAt: string | null;
  icon: string | null;
};

type User = {
  id: string;
  name: string;
  avatar: string | null;
  role: string;
};

type UserPoints = {
  currentBalance: number;
  totalEarned: number;
  totalSpent: number;
};

type Redemption = {
  id: string;
  rewardId: string;
  userId: string;
  redeemedAt: string;
  pointsSpent: number;
  status: "PENDING" | "APPROVED" | "REJECTED";
  reward: Reward;
  user: { id: string; name: string; avatar: string | null; color: string | null };
  approvedBy: { id: string; name: string } | null;
};

const rewards = ref<Reward[]>([]);
const users = ref<User[]>([]);
const selectedUserId = ref<string | null>(null);
const userPoints = ref<UserPoints | null>(null);
const pendingRedemptions = ref<Redemption[]>([]);

const loading = ref(true);
const redeeming = ref<string | null>(null);
const approving = ref<string | null>(null);

const showCreateDialog = ref(false);
const editingReward = ref<Reward | null>(null);
const pendingRewardAction = ref<(() => void) | null>(null);
const showRedeemConfirm = ref(false);
const showRejectConfirm = ref(false);
const pendingRedeemReward = ref<Reward | null>(null);
const pendingRejectRedemption = ref<Redemption | null>(null);

// Check if current user is an adult
const selectedUser = computed(() => users.value.find(u => u.id === selectedUserId.value));
const isAdult = computed(() => selectedUser.value?.role === "ADULT");

// Watch user selection to reset unlock state or prompt for PIN
watch(selectedUserId, (newId, oldId) => {
  if (newId !== oldId) {
    isRewardManagementUnlocked.value = false;
    // Only prompt for PIN if we already had a selected user (ignore initial set)
    if (isAdult.value && oldId) {
      isPinDialogOpen.value = true;
    }
  }
});

// PIN protection handlers
function handleCreateReward() {
  if (isAdult.value && !isRewardManagementUnlocked.value) {
    pendingRewardAction.value = () => {
      editingReward.value = null;
      showCreateDialog.value = true;
    };
    isPinDialogOpen.value = true;
  }
  else if (isAdult.value) {
    editingReward.value = null;
    showCreateDialog.value = true;
  }
}

function handleEditReward(reward: Reward) {
  if (isAdult.value && !isRewardManagementUnlocked.value) {
    pendingRewardAction.value = () => {
      editingReward.value = reward;
      showCreateDialog.value = true;
    };
    isPinDialogOpen.value = true;
  }
  else if (isAdult.value) {
    editingReward.value = reward;
    showCreateDialog.value = true;
  }
}

function handlePinVerified() {
  isRewardManagementUnlocked.value = true;
  if (pendingRewardAction.value) {
    pendingRewardAction.value();
    pendingRewardAction.value = null;
  }
}

// Fetch rewards
async function fetchRewards() {
  try {
    const data = await $fetch<Reward[]>("/api/rewards");
    rewards.value = data;
  }
  catch (error) {
    console.error("Failed to fetch rewards:", error);
  }
}

// Fetch users
async function fetchUsers() {
  try {
    const data = await $fetch<User[]>("/api/users");
    users.value = data;
    const firstUser = data[0];
    if (firstUser && !selectedUserId.value) {
      selectedUserId.value = firstUser.id;
    }
  }
  catch (error) {
    console.error("Failed to fetch users:", error);
  }
}

// Fetch user points
async function fetchUserPoints() {
  if (!selectedUserId.value)
    return;
  try {
    const data = await $fetch<UserPoints>(`/api/users/${selectedUserId.value}/points`);
    userPoints.value = data;
  }
  catch (error) {
    console.error("Failed to fetch user points:", error);
    userPoints.value = { currentBalance: 0, totalEarned: 0, totalSpent: 0 };
  }
}

// Fetch pending redemptions (for adult approval)
async function fetchPendingRedemptions() {
  try {
    const data = await $fetch<Redemption[]>("/api/rewards/redemptions?status=PENDING");
    pendingRedemptions.value = data;
  }
  catch (error) {
    console.error("Failed to fetch pending redemptions:", error);
  }
}

// Current points display
const currentPoints = computed(() => userPoints.value?.currentBalance ?? 0);

// Can redeem a reward
function canRedeem(reward: Reward): boolean {
  if (reward.pointCost > currentPoints.value)
    return false;
  if (reward.quantityAvailable !== null && reward.quantityAvailable <= 0)
    return false;
  if (reward.expiresAt && new Date(reward.expiresAt) < new Date())
    return false;
  return true;
}

// Request redemption confirmation
function requestRedeemReward(rewardId: string) {
  if (!selectedUserId.value) {
    showWarning("No User Selected", "Please select a user first");
    return;
  }

  const reward = rewards.value.find(r => r.id === rewardId);
  if (!reward)
    return;

  pendingRedeemReward.value = reward;
  showRedeemConfirm.value = true;
}

// Confirm redeem a reward
async function confirmRedeemReward() {
  if (!selectedUserId.value || !pendingRedeemReward.value)
    return;

  showRedeemConfirm.value = false;
  const rewardId = pendingRedeemReward.value.id;

  try {
    redeeming.value = rewardId;
    const result = await $fetch<{ requiresApproval: boolean; message: string }>(`/api/rewards/${rewardId}/redeem`, {
      method: "POST",
      body: { userId: selectedUserId.value },
    });

    if (result.requiresApproval) {
      showWarning("Approval Required", result.message);
    }
    else {
      showSuccess("Reward Redeemed!", result.message);
    }

    // Refresh data
    await Promise.all([
      fetchRewards(),
      fetchUserPoints(),
      fetchPendingRedemptions(),
    ]);
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string } };
    const message = fetchError.data?.message || "Failed to redeem reward";
    showError("Redemption Failed", message);
  }
  finally {
    redeeming.value = null;
    pendingRedeemReward.value = null;
  }
}

// Approve a pending redemption (adult only)
async function approveRedemption(redemptionId: string) {
  if (!selectedUserId.value || !isAdult.value)
    return;

  try {
    approving.value = redemptionId;
    await $fetch(`/api/rewards/redemptions/${redemptionId}/approve`, {
      method: "POST",
      body: { approvedByUserId: selectedUserId.value },
    });

    showSuccess("Approved", "Redemption approved!");

    // Refresh data
    await Promise.all([
      fetchRewards(),
      fetchPendingRedemptions(),
    ]);
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string } };
    const message = fetchError.data?.message || "Failed to approve redemption";
    showError("Approval Failed", message);
  }
  finally {
    approving.value = null;
  }
}

// Request rejection confirmation
function requestRejectRedemption(redemption: Redemption) {
  pendingRejectRedemption.value = redemption;
  showRejectConfirm.value = true;
}

// Confirm reject a pending redemption (adult only)
async function confirmRejectRedemption() {
  if (!selectedUserId.value || !isAdult.value || !pendingRejectRedemption.value)
    return;

  showRejectConfirm.value = false;
  const redemptionId = pendingRejectRedemption.value.id;

  try {
    approving.value = redemptionId;
    await $fetch(`/api/rewards/redemptions/${redemptionId}/reject`, {
      method: "POST",
      body: { rejectedByUserId: selectedUserId.value },
    });

    showWarning("Rejected", "Redemption rejected.");

    // Refresh data
    await fetchPendingRedemptions();
  }
  catch (error: unknown) {
    const fetchError = error as { data?: { message?: string } };
    const message = fetchError.data?.message || "Failed to reject redemption";
    showError("Rejection Failed", message);
  }
  finally {
    approving.value = null;
    pendingRejectRedemption.value = null;
  }
}

// Watch for user selection changes
watch(selectedUserId, () => {
  fetchUserPoints();
});

onMounted(async () => {
  loading.value = true;
  await Promise.all([
    fetchRewards(),
    fetchUsers(),
    fetchPendingRedemptions(),
    checkAdultPin(),
  ]);
  await fetchUserPoints();
  loading.value = false;
});
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default">
      <GlobalDateHeader />
    </div>

    <div class="flex-1 bg-default p-6 overflow-auto">
      <div class="max-w-6xl mx-auto">
        <!-- Header with points balance and user selector -->
        <div class="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-4">
          <h1 class="text-2xl font-bold text-highlighted">
            Rewards
          </h1>
          <div class="flex flex-col sm:flex-row items-start sm:items-center gap-4">
            <!-- User selector -->
            <div v-if="users && users.length > 0" class="flex items-center gap-2">
              <span class="text-sm text-muted">Acting as:</span>
              <select
                v-model="selectedUserId"
                class="border border-default rounded px-2 py-1 text-sm bg-default"
              >
                <option
                  v-for="user in users"
                  :key="user.id"
                  :value="user.id"
                >
                  {{ user.name }}
                </option>
              </select>
            </div>
            <!-- Points balance -->
            <div class="flex items-center gap-2 bg-warning/10 px-4 py-2 rounded-lg border border-warning/20">
              <UIcon name="i-lucide-star" class="w-5 h-5 text-warning" />
              <span class="font-semibold text-highlighted">{{ currentPoints }}</span>
              <span class="text-muted">points available</span>
            </div>
          </div>
        </div>

        <!-- Pending Approvals Section (Adult only) -->
        <div v-if="isAdult && pendingRedemptions.length > 0" class="mb-8">
          <h2 class="text-lg font-semibold text-highlighted mb-4">
            <UIcon name="i-lucide-clock" class="w-5 h-5 inline mr-2" />
            Pending Approvals ({{ pendingRedemptions.length }})
          </h2>
          <div class="space-y-2">
            <div
              v-for="redemption in pendingRedemptions"
              :key="redemption.id"
              class="bg-warning/5 border border-warning/20 rounded-lg p-4 flex items-center justify-between"
            >
              <div class="flex items-center gap-3">
                <img
                  :src="redemption.user.avatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(redemption.user.name)}&size=32`"
                  class="w-8 h-8 rounded-full"
                  :alt="redemption.user.name"
                >
                <div>
                  <span class="font-medium text-highlighted">{{ redemption.user.name }}</span>
                  <span class="text-muted"> wants to redeem </span>
                  <span class="font-medium text-highlighted">{{ redemption.reward.name }}</span>
                  <span class="text-muted"> for </span>
                  <span class="font-semibold text-warning">{{ redemption.pointsSpent }} pts</span>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <UButton
                  size="sm"
                  color="success"
                  :loading="approving === redemption.id"
                  :disabled="!!approving"
                  @click="approveRedemption(redemption.id)"
                >
                  <UIcon name="i-lucide-check" class="w-4 h-4 mr-1" />
                  Approve
                </UButton>
                <UButton
                  size="sm"
                  color="error"
                  variant="soft"
                  :loading="approving === redemption.id"
                  :disabled="!!approving"
                  @click="requestRejectRedemption(redemption)"
                >
                  <UIcon name="i-lucide-x" class="w-4 h-4 mr-1" />
                  Reject
                </UButton>
              </div>
            </div>
          </div>
        </div>

        <!-- Loading state -->
        <div v-if="loading" class="flex items-center justify-center py-12">
          <UIcon name="i-lucide-loader-2" class="w-8 h-8 animate-spin text-primary" />
          <span class="ml-2 text-muted">Loading rewards...</span>
        </div>

        <!-- Empty state -->
        <div v-else-if="rewards.length === 0" class="flex flex-col items-center justify-center py-12">
          <UIcon name="i-lucide-gift" class="w-16 h-16 text-muted mb-4" />
          <h2 class="text-xl font-semibold text-highlighted mb-2">
            No rewards available
          </h2>
          <p class="text-muted text-center max-w-md">
            Rewards can be redeemed using points earned from completing chores. Check back soon for available rewards!
          </p>
          <UButton
            v-if="isAdult"
            class="mt-4"
            @click="handleCreateReward"
          >
            <UIcon :name="hasAdultPin && !isRewardManagementUnlocked ? 'i-lucide-lock' : 'i-lucide-plus'" class="w-4 h-4 mr-1" />
            {{ hasAdultPin && !isRewardManagementUnlocked ? 'Unlock to Create Reward' : 'Create First Reward' }}
          </UButton>
        </div>

        <!-- Rewards grid -->
        <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div
            v-for="reward in rewards"
            :key="reward.id"
            class="bg-default rounded-lg border border-default p-4 hover:shadow-md transition-shadow"
            :class="{ 'opacity-50': !canRedeem(reward) }"
          >
            <div class="flex items-start justify-between mb-3">
              <div class="flex items-center gap-3">
                <div class="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <UIcon
                    :name="reward.icon || 'i-lucide-gift'"
                    class="w-6 h-6 text-primary"
                  />
                </div>
                <div>
                  <h3 class="font-semibold text-highlighted">
                    {{ reward.name }}
                  </h3>
                  <div class="flex items-center gap-1 text-warning">
                    <UIcon name="i-lucide-star" class="w-4 h-4" />
                    <span class="font-medium">{{ reward.pointCost }} pts</span>
                  </div>
                </div>
              </div>
              <UButton
                v-if="isAdult && isRewardManagementUnlocked"
                icon="i-lucide-pencil"
                size="xs"
                color="neutral"
                variant="ghost"
                aria-label="Edit reward"
                @click.stop="handleEditReward(reward)"
              />
            </div>

            <p v-if="reward.description" class="text-sm text-muted mb-3">
              {{ reward.description }}
            </p>

            <div class="flex items-center justify-between mt-4">
              <div class="flex items-center gap-2">
                <span v-if="reward.quantityAvailable !== null" class="text-xs text-muted">
                  {{ reward.quantityAvailable }} left
                </span>
                <span v-if="reward.expiresAt" class="text-xs text-error">
                  Expires {{ new Date(reward.expiresAt).toLocaleDateString() }}
                </span>
              </div>
              <UButton
                size="sm"
                :color="canRedeem(reward) ? 'primary' : 'neutral'"
                :disabled="!canRedeem(reward) || !!redeeming"
                :loading="redeeming === reward.id"
                @click="requestRedeemReward(reward.id)"
              >
                <UIcon name="i-lucide-gift" class="w-4 h-4 mr-1" />
                Redeem
              </UButton>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating action button for creating rewards (adult only) -->
    <GlobalFloatingActionButton
      v-if="isAdult"
      :icon="!isRewardManagementUnlocked ? 'i-lucide-lock' : 'i-lucide-plus'"
      :label="!isRewardManagementUnlocked ? 'Unlock to manage rewards' : 'Add new reward'"
      color="primary"
      size="lg"
      position="bottom-right"
      @click="handleCreateReward"
    />

    <!-- Create/Edit Reward Dialog -->
    <RewardDialog
      :is-open="showCreateDialog"
      :reward="editingReward"
      @close="showCreateDialog = false"
      @created="fetchRewards"
      @updated="fetchRewards"
      @deleted="fetchRewards"
    />

    <!-- Redeem Confirmation Modal -->
    <GlobalDialog
      :is-open="showRedeemConfirm"
      title="Confirm Redemption"
      save-label="Redeem"
      @close="showRedeemConfirm = false"
      @save="confirmRedeemReward"
    >
      <template #header-icon>
        <UIcon name="i-lucide-gift" class="w-5 h-5 text-primary" />
      </template>

      <div v-if="pendingRedeemReward" class="py-2">
        <p class="text-muted">
          Are you sure you want to redeem
          <span class="font-semibold text-highlighted">{{ pendingRedeemReward.name }}</span>
          for <span class="font-semibold text-warning">{{ pendingRedeemReward.pointCost }} points</span>?
        </p>
      </div>
    </GlobalDialog>

    <!-- Reject Confirmation Modal -->
    <GlobalDialog
      :is-open="showRejectConfirm"
      title="Reject Redemption"
      save-label="Reject"
      save-color="error"
      @close="showRejectConfirm = false"
      @save="confirmRejectRedemption"
    >
      <template #header-icon>
        <UIcon name="i-lucide-x-circle" class="w-5 h-5 text-error" />
      </template>

      <div v-if="pendingRejectRedemption" class="py-2">
        <p class="text-muted">
          Are you sure you want to reject
          <span class="font-semibold text-highlighted">{{ pendingRejectRedemption.user.name }}'s</span>
          request to redeem
          <span class="font-semibold text-highlighted">{{ pendingRejectRedemption.reward.name }}</span>?
        </p>
      </div>
    </GlobalDialog>

    <!-- PIN verification dialog -->
    <SettingsPinDialog
      :is-open="isPinDialogOpen"
      :user-id="selectedUserId"
      title="Adult Verification Required"
      @close="isPinDialogOpen = false"
      @verified="handlePinVerified"
    />
  </div>
</template>
