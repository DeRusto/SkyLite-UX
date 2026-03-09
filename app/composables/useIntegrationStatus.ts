import { consola } from "consola";

import type { IntegrationStatus } from "~/types/integrations";

import { integrationServices } from "~/plugins/02.appInit";

// Module-level state shared across all callers
const integrationStatuses = ref<Map<string, IntegrationStatus>>(new Map());
const statusLoading = ref<Set<string>>(new Set());

export function useIntegrationStatus() {
  async function fetchIntegrationStatus(integrationId: string) {
    const service = integrationServices.get(integrationId);
    if (!service) {
      integrationStatuses.value.delete(integrationId);
      return;
    }

    statusLoading.value.add(integrationId);
    try {
      const status = await service.getStatus();
      integrationStatuses.value.set(integrationId, status);
    }
    catch (err) {
      consola.warn(`Failed to get status for integration ${integrationId}:`, err);
      integrationStatuses.value.set(integrationId, {
        isConnected: false,
        lastChecked: new Date(),
        error: "Failed to check status",
      });
    }
    finally {
      statusLoading.value.delete(integrationId);
    }
  }

  function getIntegrationStatus(integrationId: string): IntegrationStatus | null {
    return integrationStatuses.value.get(integrationId) || null;
  }

  function isStatusLoading(integrationId: string): boolean {
    return statusLoading.value.has(integrationId);
  }

  return {
    fetchIntegrationStatus,
    getIntegrationStatus,
    isStatusLoading,
  };
}
