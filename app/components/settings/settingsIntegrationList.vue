<script setup lang="ts">
import type { Integration } from "~/types/database";

import { useIntegrationStatus } from "~/composables/useIntegrationStatus";
import { integrationRegistry } from "~/types/integrations";

type Props = {
  integrations: Integration[];
  integrationsLoading: boolean;
  servicesInitializing: boolean;
  activeTab: string;
  availableTabs: string[];
};

type Emits = {
  toggle: [integrationId: string, enabled: boolean];
  edit: [integration: Integration | null];
  changeTab: [type: string];
};

defineProps<Props>();
const emit = defineEmits<Emits>();

const { getIntegrationStatus, isStatusLoading } = useIntegrationStatus();

function getIntegrationIcon(type: string) {
  switch (type) {
    case "calendar": return "i-lucide-calendar-days";
    case "todo": return "i-lucide-list-todo";
    case "shopping": return "i-lucide-shopping-cart";
    case "meal": return "i-lucide-utensils";
    case "photos": return "i-lucide-image";
    case "weather": return "i-lucide-cloud-sun";
    default: return "i-lucide-plug";
  }
}

function getIntegrationTypeLabel(type: string) {
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function getIntegrationIconUrl(integration: Integration) {
  if (integration.icon)
    return integration.icon;
  const config = integrationRegistry.get(`${integration.type}:${integration.service}`);
  return config?.icon || null;
}
</script>

<template>
  <div>
    <!-- Tab navigation -->
    <div class="border-b border-default mb-6">
      <nav
        class="-mb-px flex space-x-6"
        aria-label="Integration categories"
      >
        <button
          v-for="type in availableTabs"
          :key="type"
          type="button"
          class="whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-1.5 min-h-[44px]"
          :class="[
            activeTab === type
              ? 'border-primary text-primary'
              : 'border-transparent text-muted hover:text-toned hover:border-muted',
          ]"
          @click="emit('changeTab', type)"
        >
          <UIcon :name="getIntegrationIcon(type)" class="h-4 w-4" />
          {{ getIntegrationTypeLabel(type) }}
        </button>
      </nav>
    </div>

    <!-- Loading state -->
    <div
      v-if="integrationsLoading"
      class="text-center py-8"
    >
      <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto" />
      <p class="text-default mt-2">
        Loading integrations...
      </p>
    </div>

    <!-- Services initializing -->
    <div
      v-else-if="servicesInitializing"
      class="text-center py-8"
    >
      <UIcon name="i-lucide-loader-2" class="animate-spin h-8 w-8 mx-auto" />
      <p class="text-default mt-2">
        Initializing integration services...
      </p>
    </div>

    <!-- Empty state -->
    <div
      v-else-if="integrations.length === 0"
      class="text-center py-8"
    >
      <div class="flex items-center justify-center gap-2 text-default">
        <UIcon name="i-lucide-frown" class="h-10 w-10" />
        <div class="text-center">
          <p class="text-lg">
            No {{ getIntegrationTypeLabel(activeTab) }} integrations configured
          </p>
          <p class="text-dimmed">
            Connect external services to enhance your experience
          </p>
        </div>
      </div>
    </div>

    <!-- Integration list -->
    <div
      v-else
      class="space-y-4"
    >
      <div
        v-for="integration in integrations"
        :key="integration.id"
        class="flex items-center justify-between p-4 rounded-lg border"
        :class="[
          integration.enabled
            ? 'border-primary bg-primary/10'
            : 'border-default bg-default',
        ]"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-10 h-10 rounded-full flex items-center justify-center text-inverted"
            :class="[integration.enabled ? 'bg-accented' : 'bg-muted']"
          >
            <img
              v-if="getIntegrationIconUrl(integration)"
              :src="getIntegrationIconUrl(integration) || undefined"
              :alt="`${integration.service} icon`"
              class="h-5 w-5"
              style="object-fit: contain"
            >
            <UIcon
              v-else
              :name="getIntegrationIcon(integration.type)"
              class="h-5 w-5"
            />
          </div>
          <div class="flex-1 min-w-0">
            <p class="font-medium text-highlighted">
              {{ integration.name }}
            </p>
            <p class="text-sm text-muted capitalize">
              {{ integration.service }}
            </p>
            <!-- Connection status indicator -->
            <div
              v-if="integration.enabled"
              class="flex items-center gap-1 mt-1"
            >
              <template v-if="isStatusLoading(integration.id)">
                <UIcon name="i-lucide-loader-2" class="h-3 w-3 animate-spin text-muted" />
                <span class="text-xs text-muted">Checking...</span>
              </template>
              <template v-else-if="getIntegrationStatus(integration.id)">
                <template v-if="getIntegrationStatus(integration.id)?.isConnected">
                  <span class="inline-block w-2 h-2 rounded-full bg-success" />
                  <span class="text-xs text-success">Connected</span>
                </template>
                <template v-else-if="getIntegrationStatus(integration.id)?.error">
                  <span class="inline-block w-2 h-2 rounded-full bg-error" />
                  <span
                    class="text-xs text-error truncate max-w-[150px]"
                    :title="getIntegrationStatus(integration.id)?.error"
                  >
                    {{ getIntegrationStatus(integration.id)?.error }}
                  </span>
                </template>
                <template v-else>
                  <span class="inline-block w-2 h-2 rounded-full bg-warning" />
                  <span class="text-xs text-warning">Disconnected</span>
                </template>
              </template>
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <USwitch
            :model-value="integration.enabled"
            color="primary"
            unchecked-icon="i-lucide-x"
            checked-icon="i-lucide-check"
            size="xl"
            :aria-label="`Toggle ${integration.name} integration`"
            @update:model-value="emit('toggle', integration.id, $event)"
          />
          <UButton
            variant="ghost"
            size="sm"
            icon="i-lucide-edit"
            :aria-label="`Edit ${integration.name}`"
            @click="emit('edit', integration)"
          />
        </div>
      </div>
    </div>
  </div>
</template>
