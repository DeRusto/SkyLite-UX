<script setup lang="ts">
import type { JsonObject } from "type-fest";

import type { CreateShoppingListInput, CreateShoppingListItemInput, Integration, RawIntegrationItem, ShoppingList, ShoppingListItem } from "~/types/database";
import type { DialogField, ShoppingListWithIntegration } from "~/types/ui";

import GlobalFloatingActionButton from "~/components/global/globalFloatingActionButton.vue";
import GlobalList from "~/components/global/globalList.vue";
import ShoppingListDialog from "~/components/shopping/shoppingListDialog.vue";
import ShoppingListItemDialog from "~/components/shopping/shoppingListItemDialog.vue";
import { useAlertToast } from "~/composables/useAlertToast";
import { useStableDate } from "~/composables/useStableDate";
import { getFieldsForItem, getIntegrationFields } from "~/integrations/integrationConfig";
import { integrationRegistry } from "~/types/integrations";

const { parseStableDate, getStableDate } = useStableDate();

function getDateWithFallback(dateString: string | Date | null): Date {
  if (!dateString)
    return getStableDate();
  return dateString instanceof Date ? dateString : parseStableDate(dateString);
}

const {
  shoppingLists: nativeShoppingLists,
  loading: nativeLoading,
  createShoppingList,
  updateShoppingList,
  deleteShoppingList,
  addItemToList,
  updateShoppingListItem,
  reorderItem,
  reorderShoppingList,
  deleteCompletedItems,
} = useShoppingLists();

const {
  shoppingLists: integrationLists,
  shoppingIntegrations,
  loading: integrationLoading,
  addItemToList: addItemToIntegrationList,
  updateShoppingListItem: updateIntegrationItem,
  toggleItem: toggleIntegrationItem,
  clearCompletedItems: clearIntegrationCompletedItems,
} = useShoppingIntegrations();

const listDialog = ref(false);
const itemDialog = ref(false);
const selectedListId = ref<string>("");
const editingList = ref<ShoppingList | null>(null);
const editingItem = ref<ShoppingListItem | null>(null);

const { showError, showWarning, showSuccess } = useAlertToast();

function normalizeIntegrationItem(item: RawIntegrationItem): ShoppingListItem {
  return {
    id: String(item.id),
    name: String(item.name ?? ""),
    checked: Boolean(item.checked),
    order: Number(item.order ?? 0),
    notes: item.notes ?? null,
    quantity: Number(item.quantity ?? 1),
    unit: item.unit ?? null,
    label: null,
    food: item.food ?? null,
    integrationData: item.integrationData as JsonObject | undefined,
    source: "integration",
    integrationId: undefined,
  };
}

const nativeListsWithSource = computed(() => {
  return nativeShoppingLists.value.map(list => ({
    ...list,
    source: "native" as const,
  }));
});

const integrationListsWithSource = computed(() => {
  const lists = integrationLists.value ?? [];
  const result: ShoppingList[] = [];
  for (const list of lists) {
    const integration = (shoppingIntegrations.value as readonly Integration[]).find(i => i.id === list.integrationId);
    const hasClearCapability = integration && getIntegrationCapabilities(integration.id).includes("clear_items");
    const filteredItems = Array.isArray(list.items)
      ? list.items
          .map(normalizeIntegrationItem)
          .filter(item => hasClearCapability || !item.checked)
      : [];

    result.push({
      id: String(list.id),
      name: String(list.name ?? ""),
      order: Number(list.order ?? 0),
      createdAt: getDateWithFallback(list.createdAt),
      updatedAt: getDateWithFallback(list.updatedAt),
      items: filteredItems,
      source: "integration",
      integrationId: list.integrationId ?? undefined,
      integrationName: integration?.name || list.integrationName || "Integration",
      integrationIcon: integration ? getIntegrationIconUrl(integration) : list.integrationIcon ?? null,
    });
  }
  return result;
});

const allShoppingLists = computed(() => {
  return [...nativeListsWithSource.value, ...integrationListsWithSource.value] as ShoppingList[];
});

const isLoading = computed(() => {
  return nativeLoading.value || integrationLoading.value;
});

const transformedShoppingLists = computed(() => {
  return allShoppingLists.value.map(list => ({
    id: list.id,
    name: list.name,
    order: list.order || 0,
    createdAt: parseStableDate(list.createdAt),
    updatedAt: parseStableDate(list.updatedAt),
    items: list.items,
    _count: list._count,
    source: list.source || "native",
    integrationId: list.integrationId,
    integrationName: list.integrationName,
    integrationIcon: list.integrationIcon,
  })) as ShoppingListWithIntegration[];
});

function openCreateList() {
  editingList.value = null;
  listDialog.value = true;
}

function openAddItem(listId: string) {
  selectedListId.value = listId;
  editingItem.value = null;
  itemDialog.value = true;
}

function openEditItem(item: ShoppingListItem) {
  const list = findItemList(item.id);
  if (list?.source === "integration") {
    editingItem.value = {
      ...item,
      integrationId: list.integrationId,
      source: "integration",
    };
  }
  else {
    editingItem.value = { ...item };
  }
  itemDialog.value = true;
}

async function handleListSave(listData: CreateShoppingListInput) {
  try {
    if (editingList.value?.id) {
      await updateShoppingList(editingList.value.id, listData);
      showSuccess("List Updated", "Shopping list updated successfully");
    }
    else {
      await createShoppingList(listData);
      showSuccess("List Created", "Shopping list created successfully");
    }
  }
  catch {
    return;
  }
  finally {
    listDialog.value = false;
    editingList.value = null;
  }
}

async function handleListDelete() {
  if (!editingList.value?.id)
    return;
  try {
    await deleteShoppingList(editingList.value.id);
    showSuccess("List Deleted", "Shopping list deleted successfully");
  }
  catch {
    return;
  }
  finally {
    listDialog.value = false;
    editingList.value = null;
  }
}

async function handleItemSave(itemData: CreateShoppingListItemInput) {
  try {
    let targetList: ShoppingList | undefined;
    if (editingItem.value?.id) {
      targetList = allShoppingLists.value.find(list =>
        list.items?.some((item: ShoppingListItem) => item.id === editingItem.value!.id),
      );
    }
    else {
      targetList = allShoppingLists.value.find(list => list.id === selectedListId.value);
    }

    if (!targetList) {
      showError("Target list not found");
      return;
    }

    const isIntegrationList = targetList.source === "integration";

    if (editingItem.value?.id) {
      if (isIntegrationList && targetList.integrationId) {
        await updateIntegrationItem(targetList.integrationId, editingItem.value.id, itemData);
      }
      else {
        await updateShoppingListItem(editingItem.value.id, itemData);
      }
      showSuccess("Item Updated", "Item updated successfully");
    }
    else {
      if (isIntegrationList && targetList.integrationId) {
        await addItemToIntegrationList(targetList.integrationId, targetList.id, itemData);
      }
      else {
        await addItemToList(targetList.id, itemData);
      }
      showSuccess("Item Added", "Item added to list");
    }
  }
  catch {
    return;
  }
  finally {
    itemDialog.value = false;
    editingItem.value = null;
  }
}

async function handleItemDelete(_itemId: string) {
  showWarning("Warning", "Deleting individual items is not yet supported.");
  itemDialog.value = false;
  editingItem.value = null;
}

async function handleToggleItem(itemId: string, checked: boolean) {
  try {
    const targetList = allShoppingLists.value.find(list =>
      list.items?.some((item: ShoppingListItem) => item.id === itemId),
    );
    if (!targetList)
      return;

    const isIntegrationList = targetList.source === "integration";

    if (isIntegrationList && targetList.integrationId) {
      await toggleIntegrationItem(targetList.integrationId, itemId, checked);
    }
    else {
      await updateShoppingListItem(itemId, { checked });
    }
  }
  catch {
    // Handled by composable
  }
}

async function handleDeleteList(listId: string) {
  try {
    const list = allShoppingLists.value.find(l => l.id === listId);
    if (list?.source === "native" || !list?.source) {
      await deleteShoppingList(listId);
      showSuccess("List Deleted", "Shopping list deleted successfully");
    }
    else {
      showWarning("Warning", "Deleting lists in integrations is not yet supported.");
    }
  }
  catch {
    // Handled by composable
  }
}

async function handleReorderItem(itemId: string, direction: "up" | "down") {
  try {
    const list = findItemList(itemId);
    if (!list)
      return;

    if (list.source === "integration") {
      showWarning("Reorder Not Supported", "Reordering items in integration lists is not currently supported.");
    }
    else {
      await reorderItem(itemId, direction);
    }
  }
  catch {
    // Handled by composable
  }
}

async function handleReorderList(listId: string, direction: "up" | "down") {
  try {
    const list = allShoppingLists.value.find(l => l.id === listId);
    if (!list)
      return;

    if (list.source === "integration") {
      showWarning("Reorder Not Supported", "Reordering integration lists is not currently supported.");
    }
    else {
      await reorderShoppingList(listId, direction);
    }
  }
  catch {
    // Handled by composable
  }
}

async function handleClearCompleted(listId: string) {
  try {
    const list = allShoppingLists.value.find(l => l.id === listId);
    if (!list)
      return;

    if (list.source === "integration") {
      if (!list.integrationId)
        return;
      await clearIntegrationCompletedItems(list.integrationId, listId);
    }
    else {
      await deleteCompletedItems(listId);
    }
    showSuccess("Items Cleared", "Completed items removed");
  }
  catch {
    // Handled by composable
  }
}

function findItemList(itemId: string) {
  return allShoppingLists.value.find(list =>
    list.items?.some((item: ShoppingListItem) => item.id === itemId),
  );
}

function getIntegrationIconUrl(integration: { icon?: string | null; type: string; service: string }) {
  if (integration.icon) {
    return integration.icon;
  }

  const config = integrationRegistry.get(`${integration.type}:${integration.service}`);
  return config?.icon || null;
}

function getIntegrationCapabilities(integrationId: string): string[] {
  const integrations = shoppingIntegrations.value as Integration[];
  const integration = integrations.find(i => i.id === integrationId);
  if (!integration)
    return [];

  const config = integrationRegistry.get(`${integration.type}:${integration.service}`);
  return config?.capabilities || [];
}

function hasCapability(integrationId: string, capability: string): boolean {
  const capabilities = getIntegrationCapabilities(integrationId);
  return capabilities.includes(capability);
}

function getIntegrationType(): string | undefined {
  if (editingItem.value?.source === "integration") {
    const integrations: Integration[] = shoppingIntegrations.value as Integration[];
    const integration = integrations.find(i => i.id === editingItem.value?.integrationId);
    return integration?.service;
  }

  if (selectedListId.value) {
    const selectedList = allShoppingLists.value.find(list => list.id === selectedListId.value);
    if (selectedList?.source === "integration") {
      const integrations: Integration[] = shoppingIntegrations.value as Integration[];
      const integration = integrations.find(i => i.id === selectedList.integrationId);
      return integration?.service;
    }
  }

  return undefined;
}

function getItemIntegrationCapabilities(): string[] | undefined {
  if (editingItem.value?.source === "integration") {
    if (!editingItem.value.integrationId) {
      return undefined;
    }
    return getIntegrationCapabilities(editingItem.value.integrationId);
  }

  if (selectedListId.value) {
    const selectedList = allShoppingLists.value.find(list => list.id === selectedListId.value);
    if (selectedList?.source === "integration") {
      if (!selectedList.integrationId) {
        return undefined;
      }
      return getIntegrationCapabilities(selectedList.integrationId);
    }
  }

  return undefined;
}

function getFilteredFieldsForItem(item: ShoppingListItem, integrationType: string | undefined): DialogField[] {
  const baseFields: DialogField[] = integrationType
    ? getIntegrationFields(integrationType)
    : [
        {
          key: "name",
          label: "Item Name",
          type: "text" as const,
          placeholder: "Milk, Bread, Apples, etc.",
          required: true,
          canEdit: true,
        },
        {
          key: "quantity",
          label: "Quantity",
          type: "number" as const,
          min: 0,
          canEdit: true,
        },
        {
          key: "unit",
          label: "Unit",
          type: "text" as const,
          placeholder: "Can, Box, etc.",
          canEdit: true,
        },
        {
          key: "notes",
          label: "Notes",
          type: "textarea" as const,
          placeholder: "Additional notes (optional)",
          canEdit: true,
        },
      ];

  return getFieldsForItem(item, integrationType, baseFields) as DialogField[];
}
</script>

<template>
  <div class="flex h-[calc(100vh-2rem)] w-full flex-col rounded-lg">
    <div class="py-5 sm:px-4 sticky top-0 z-40 bg-default border-b border-default">
      <GlobalDateHeader />
    </div>

    <div class="flex-1 overflow-y-auto">
      <GlobalList
        :lists="transformedShoppingLists"
        :loading="isLoading"
        empty-state-icon="i-lucide-shopping-cart"
        empty-state-title="No shopping lists found"
        empty-state-description="Create your first shopping list to get started"
        show-quantity
        :show-notes="true"
        show-reorder
        :show-edit="(list) => {
          const shoppingList = list as ShoppingListWithIntegration;
          return shoppingList.source === 'native';
        }"
        :show-add="(list) => {
          const shoppingList = list as ShoppingListWithIntegration;
          return shoppingList.source === 'native' || (shoppingList.integrationId ? hasCapability(shoppingList.integrationId, 'add_items') : false);
        }"
        :show-edit-item="(list) => {
          const shoppingList = list as ShoppingListWithIntegration;
          return shoppingList.source === 'native' || (shoppingList.integrationId ? hasCapability(shoppingList.integrationId, 'edit_items') : false);
        }"
        :show-completed="(list) => {
          const shoppingList = list as ShoppingListWithIntegration;
          return shoppingList.source === 'native' || (shoppingList.integrationId ? hasCapability(shoppingList.integrationId, 'clear_items') : false);
        }"
        show-integration-icons
        @create="openCreateList"
        @edit="editingList = $event as ShoppingListWithIntegration; listDialog = true"
        @delete="handleDeleteList"
        @add-item="openAddItem"
        @edit-item="(item) => openEditItem(item as ShoppingListItem)"
        @toggle-item="handleToggleItem"
        @reorder-item="handleReorderItem"
        @reorder-list="handleReorderList"
        @clear-completed="handleClearCompleted"
      />
    </div>

    <GlobalFloatingActionButton
      icon="i-lucide-plus"
      label="Create new shopping list"
      color="primary"
      size="lg"
      position="bottom-right"
      @click="openCreateList"
    />

    <ShoppingListDialog
      :is-open="listDialog"
      :list="editingList"
      :integration-capabilities="editingList?.source === 'integration' && editingList.integrationId ? getIntegrationCapabilities(editingList.integrationId) : undefined"
      @close="listDialog = false; editingList = null"
      @save="handleListSave"
      @delete="handleListDelete"
    />

    <ShoppingListItemDialog
      :is-open="itemDialog"
      :item="editingItem"
      :fields="getFilteredFieldsForItem(editingItem ?? { integrationData: {} } as ShoppingListItem, getIntegrationType())"
      :integration-capabilities="getItemIntegrationCapabilities()"
      @close="itemDialog = false; selectedListId = ''; editingItem = null"
      @save="handleItemSave"
      @delete="handleItemDelete"
    />
  </div>
</template>
