import { consola } from "consola";

import type { CreateShoppingListInput, CreateShoppingListItemInput, ShoppingListItem, ShoppingListWithOrder, UpdateShoppingListItemInput } from "~/types/database";

import { useAlertToast } from "~/composables/useAlertToast";
import { getErrorMessage } from "~/utils/error";

export function useShoppingLists() {
  const loading = ref(false);
  const error = ref<string | null>(null);

  const { data: shoppingLists } = useNuxtData<ShoppingListWithOrder[]>("native-shopping-lists");
  const { showError } = useAlertToast();

  const currentShoppingLists = computed(() => shoppingLists.value || []);

  const getShoppingLists = async () => {
    loading.value = true;
    error.value = null;
    try {
      await refreshNuxtData("native-shopping-lists");
      consola.debug("Use Shopping Lists: Shopping lists refreshed successfully");
    }
    catch (err) {
      error.value = getErrorMessage(err, "Failed to fetch shopping lists");
      consola.error("Use Shopping Lists: Error fetching shopping lists:", err);
      throw err;
    }
    finally {
      loading.value = false;
    }
  };

  const createShoppingList = async (listData: CreateShoppingListInput) => {
    const previousLists = shoppingLists.value ? JSON.parse(JSON.stringify(shoppingLists.value)) : [];
    const newList: any = {
      id: crypto.randomUUID(),
      name: listData.name,
      createdAt: new Date(),
      updatedAt: new Date(),
      order: (shoppingLists.value?.length || 0) + 1,
      items: [],
      _count: { items: 0 },
    };

    if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
      shoppingLists.value.push(newList);
    }

    try {
      const createdList = await $fetch<ShoppingListWithOrder>("/api/shopping-lists", {
        method: "POST" as any,
        body: listData,
      });

      if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
        const tempIndex = shoppingLists.value.findIndex((l: any) => l.id === newList.id);
        if (tempIndex !== -1) {
          shoppingLists.value[tempIndex] = createdList;
        }
      }

      return createdList;
    }
    catch (err) {
      if (shoppingLists.value) {
        shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
      }
      const message = getErrorMessage(err, "Failed to create shopping list");
      showError("Error", message);
      throw err;
    }
  };

  const updateShoppingList = async (listId: string, updates: { name?: string }) => {
    const previousLists = shoppingLists.value ? JSON.parse(JSON.stringify(shoppingLists.value)) : [];

    if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
      const listIndex = shoppingLists.value.findIndex((l: any) => l.id === listId);
      if (listIndex !== -1) {
        shoppingLists.value[listIndex] = { ...shoppingLists.value[listIndex], ...updates } as any;
      }
    }

    try {
      const updatedList = await $fetch<ShoppingListWithOrder>(`/api/shopping-lists/${listId}`, {
        method: "PUT" as any,
        body: updates,
      });

      return updatedList;
    }
    catch (err) {
      if (shoppingLists.value) {
        shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
      }
      const message = getErrorMessage(err, "Failed to update shopping list");
      showError("Error", message);
      throw err;
    }
  };

  const updateShoppingListItem = async (itemId: string, updates: UpdateShoppingListItemInput) => {
    const previousLists = shoppingLists.value ? JSON.parse(JSON.stringify(shoppingLists.value)) : [];

    if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
      for (let listIndex = 0; listIndex < shoppingLists.value.length; listIndex++) {
        const list = shoppingLists.value[listIndex];
        if (list) {
          const itemIndex = list.items?.findIndex((i: any) => i.id === itemId);
          if (itemIndex !== -1 && itemIndex !== undefined && list.items) {
            const updatedItems = [...list.items];
            updatedItems[itemIndex] = { ...updatedItems[itemIndex], ...updates } as any;
            shoppingLists.value[listIndex] = { ...list, items: updatedItems as any };
            break;
          }
        }
      }
    }

    try {
      const updatedItem = await $fetch<ShoppingListItem>(`/api/shopping-list-items/${itemId}`, {
        method: "PUT" as any,
        body: updates,
      });

      // Write back confirmed item
      if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
        for (let listIndex = 0; listIndex < shoppingLists.value.length; listIndex++) {
          const list = shoppingLists.value[listIndex];
          if (list) {
            const itemIndex = list.items?.findIndex((i: any) => i.id === itemId);
            if (itemIndex !== -1 && itemIndex !== undefined && list.items) {
              const confirmedItems = [...list.items];
              confirmedItems[itemIndex] = updatedItem as any;
              shoppingLists.value[listIndex] = { ...list, items: confirmedItems as any };
              break;
            }
          }
        }
      }

      return updatedItem;
    }
    catch (err) {
      if (shoppingLists.value) {
        shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
      }
      const message = getErrorMessage(err, "Failed to update item");
      showError("Error", message);
      throw err;
    }
  };

  const addItemToList = async (listId: string, itemData: CreateShoppingListItemInput) => {
    const previousLists = shoppingLists.value ? JSON.parse(JSON.stringify(shoppingLists.value)) : [];
    const tempId = crypto.randomUUID();
    const newItem: any = {
      id: tempId,
      name: itemData.name || "",
      checked: itemData.checked || false,
      order: itemData.order || 0,
      notes: itemData.notes || null,
      quantity: itemData.quantity || 1,
      unit: itemData.unit || null,
      label: itemData.label || null,
      food: itemData.food || null,
      shoppingListId: listId,
    };

    if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
      const listIndex = shoppingLists.value.findIndex((l: any) => l.id === listId);
      if (listIndex !== -1) {
        const list = shoppingLists.value[listIndex];
        if (list) {
          const updatedItems = [...(list.items || []), newItem];
          const newCount = list._count ? { ...list._count, items: (list._count.items || 0) + 1 } : { items: 1 };
          shoppingLists.value[listIndex] = { ...list, items: updatedItems as any, _count: newCount as any };
        }
      }
    }

    try {
      const createdItem = await $fetch<ShoppingListItem>(`/api/shopping-lists/${listId}/items`, {
        method: "POST" as any,
        body: itemData,
      });

      if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
        const listIndex = shoppingLists.value.findIndex((l: any) => l.id === listId);
        if (listIndex !== -1) {
          const list = shoppingLists.value[listIndex];
          if (list && list.items) {
            const tempIndex = list.items.findIndex((i: any) => i.id === tempId);
            if (tempIndex !== -1) {
              const updatedItems = [...list.items];
              updatedItems[tempIndex] = createdItem as any;
              shoppingLists.value[listIndex] = { ...list, items: updatedItems as any };
            }
          }
        }
      }

      return createdItem;
    }
    catch (err) {
      if (shoppingLists.value) {
        shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
      }
      const message = getErrorMessage(err, "Failed to add item");
      showError("Error", message);
      throw err;
    }
  };

  const deleteShoppingList = async (listId: string) => {
    const previousLists = shoppingLists.value ? JSON.parse(JSON.stringify(shoppingLists.value)) : [];

    if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
      const listIndex = shoppingLists.value.findIndex((l: any) => l.id === listId);
      if (listIndex !== -1) {
        shoppingLists.value.splice(listIndex, 1);
      }
    }

    try {
      await $fetch(`/api/shopping-lists/${listId}`, {
        method: "DELETE" as any,
      });
      return true;
    }
    catch (err) {
      if (shoppingLists.value) {
        shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
      }
      const message = getErrorMessage(err, "Failed to delete shopping list");
      showError("Error", message);
      throw err;
    }
  };

  const toggleItem = async (itemId: string, checked: boolean) => {
    return updateShoppingListItem(itemId, { checked });
  };

  const reorderShoppingList = async (listId: string, direction: "up" | "down") => {
    const previousLists = shoppingLists.value ? JSON.parse(JSON.stringify(shoppingLists.value)) : [];
    try {
      const sortedLists = [...currentShoppingLists.value].sort((a, b) => (a.order || 0) - (b.order || 0));
      const currentIndex = sortedLists.findIndex(list => list.id === listId);

      if (currentIndex === -1)
        return;

      let targetIndex;
      if (direction === "up" && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      }
      else if (direction === "down" && currentIndex < sortedLists.length - 1) {
        targetIndex = currentIndex + 1;
      }
      else {
        return;
      }

      const currentList = sortedLists[currentIndex];
      const targetUserList = sortedLists[targetIndex];

      if (!currentList || !targetUserList)
        return;

      const currentOrder = currentList.order || 0;
      const targetOrder = targetUserList.order || 0;

      const updatedLists = currentShoppingLists.value.map((list) => {
        if (list.id === currentList.id) {
          return { ...list, order: targetOrder };
        }
        if (list.id === targetUserList.id) {
          return { ...list, order: currentOrder };
        }
        return list;
      });

      if (shoppingLists.value) {
        shoppingLists.value.splice(0, shoppingLists.value.length, ...updatedLists as any);
      }

      const newOrder = updatedLists
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(list => list.id);

      await $fetch("/api/shopping-lists/reorder", {
        method: "PUT" as any,
        body: { listIds: newOrder },
      });
    }
    catch (err) {
      if (shoppingLists.value) {
        shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
      }
      const message = getErrorMessage(err, "Failed to reorder shopping list");
      showError("Error", message);
      throw err;
    }
  };

  const reorderItem = async (itemId: string, direction: "up" | "down") => {
    const previousLists = shoppingLists.value ? JSON.parse(JSON.stringify(shoppingLists.value)) : [];
    try {
      const listIndex = currentShoppingLists.value.findIndex(list =>
        list.items?.some(item => item.id === itemId),
      );

      if (listIndex === -1)
        return;

      const list = currentShoppingLists.value[listIndex];
      if (!list?.items)
        return;

      const sortedItems = [...list.items].sort((a, b) => (a.order || 0) - (b.order || 0));
      const currentIndex = sortedItems.findIndex(item => item.id === itemId);

      if (currentIndex === -1)
        return;

      let targetIndex;
      if (direction === "up" && currentIndex > 0) {
        targetIndex = currentIndex - 1;
      }
      else if (direction === "down" && currentIndex < sortedItems.length - 1) {
        targetIndex = currentIndex + 1;
      }
      else {
        return;
      }

      const currentItem = sortedItems[currentIndex];
      const targetItem = sortedItems[targetIndex];

      if (!currentItem || !targetItem)
        return;

      const currentOrder = currentItem.order || 0;
      const targetOrder = targetItem.order || 0;

      const updatedItems = list.items.map((item) => {
        if (item.id === currentItem.id) {
          return { ...item, order: targetOrder };
        }
        if (item.id === targetItem.id) {
          return { ...item, order: currentOrder };
        }
        return item;
      });

      if (shoppingLists.value && shoppingLists.value[listIndex]) {
        shoppingLists.value[listIndex] = { ...list, items: updatedItems as any } as any;
      }

      const newOrder = updatedItems
        .sort((a, b) => (a.order || 0) - (b.order || 0))
        .map(item => item.id);

      await $fetch("/api/shopping-list-items/reorder", {
        method: "PUT" as any,
        body: { itemIds: newOrder },
      });
    }
    catch (err) {
      if (shoppingLists.value) {
        shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
      }
      const message = getErrorMessage(err, "Failed to reorder item");
      showError("Error", message);
      throw err;
    }
  };

  const deleteCompletedItems = async (listId: string, completedItemIds?: string[]) => {
    const previousLists = shoppingLists.value ? JSON.parse(JSON.stringify(shoppingLists.value)) : [];

    if (shoppingLists.value && Array.isArray(shoppingLists.value)) {
      const listIndex = shoppingLists.value.findIndex((l: any) => l.id === listId);
      if (listIndex !== -1) {
        const list = shoppingLists.value[listIndex];
        if (list) {
          const itemsToDelete = completedItemIds || (list.items as any[])?.filter(item => item.checked).map(item => item.id) || [];
          if (itemsToDelete.length > 0) {
            const updatedItems = (list.items as any[])?.filter(item => !itemsToDelete.includes(item.id)) || [];
            const newCount = list._count ? { ...list._count, items: Math.max(0, (list._count.items || 0) - itemsToDelete.length) } : { items: updatedItems.length };
            shoppingLists.value[listIndex] = { ...list, items: updatedItems as any, _count: newCount as any } as any;
          }
        }
      }
    }

    try {
      await $fetch(`/api/shopping-lists/${listId}/items/clear-completed`, {
        method: "POST" as any,
        body: { action: "delete" },
      });
    }
    catch (err) {
      if (shoppingLists.value) {
        shoppingLists.value.splice(0, shoppingLists.value.length, ...previousLists);
      }
      const message = getErrorMessage(err, "Failed to clear completed items");
      showError("Error", message);
      throw err;
    }
  };

  return {
    shoppingLists: readonly(currentShoppingLists),
    loading: readonly(loading),
    error: readonly(error),
    getShoppingLists,
    createShoppingList,
    updateShoppingList,
    updateShoppingListItem,
    addItemToList,
    deleteShoppingList,
    toggleItem,
    reorderShoppingList,
    reorderItem,
    deleteCompletedItems,
  };
}
