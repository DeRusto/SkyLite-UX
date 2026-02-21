<script setup lang="ts">
const props = withDefaults(defineProps<{
  isOpen: boolean;
  title: string;
  isSubmitting?: boolean;
  isReadOnly?: boolean;
  error?: string | null;
  showDelete?: boolean;
  isDeleting?: boolean;
  canDelete?: boolean;
  saveLabel?: string;
  deleteLabel?: string;
  cancelLabel?: string;
  maxWidth?: string; // e.g., 'max-w-[425px]'
  showSave?: boolean;
  saveColor?: "error" | "info" | "success" | "warning" | "primary" | "secondary" | "neutral";
  saveVariant?: "solid" | "outline" | "ghost" | "soft" | "subtle";
}>(), {
  isSubmitting: false,
  isReadOnly: false,
  error: null,
  showDelete: false,
  isDeleting: false,
  canDelete: true,
  saveLabel: "Save",
  deleteLabel: "Delete",
  cancelLabel: "Cancel",
  maxWidth: "max-w-[425px]",
  showSave: true,
  saveColor: "primary",
  saveVariant: "solid",
});

const emit = defineEmits<{
  (e: "close"): void;
  (e: "save"): void;
  (e: "delete"): void;
}>();

const { isDesktop } = useBreakpoint();

function handleClose() {
  if (!props.isSubmitting && !props.isDeleting) {
    emit("close");
  }
}
</script>

<template>
  <UModal
    :open="isOpen"
    :fullscreen="!isDesktop"
    :ui="{
      overlay: 'bg-black/50',
      content: isDesktop ? `w-full ${maxWidth} mx-4 max-h-[90vh] flex flex-col overflow-hidden` : 'h-full flex flex-col',
    }"
    @update:open="(val) => !val && handleClose()"
  >
    <template #content>
      <div class="flex-1 flex flex-col bg-default overflow-hidden">
        <!-- Mobile header -->
        <div
          v-if="!isDesktop"
          class="flex items-center justify-between p-3 border-b border-default shrink-0"
        >
          <UButton
            color="neutral"
            variant="ghost"
            @click="handleClose"
          >
            {{ cancelLabel }}
          </UButton>
          <h2 class="text-base font-semibold leading-6 truncate px-2">
            {{ title }}
          </h2>
          <UButton
            v-if="!isReadOnly && showSave"
            :color="saveColor"
            :variant="saveVariant"
            :loading="isSubmitting"
            :disabled="isSubmitting"
            @click="emit('save')"
          >
            {{ saveLabel }}
          </UButton>
          <div v-else class="w-[60px]" />
        </div>

        <!-- Desktop header -->
        <div
          v-if="isDesktop"
          class="flex items-center justify-between p-4 border-b border-default shrink-0"
        >
          <div class="flex items-center gap-2 overflow-hidden">
            <slot name="header-icon" />
            <h2 class="text-base font-semibold leading-6 truncate">
              {{ title }}
            </h2>
          </div>
          <UButton
            color="neutral"
            variant="ghost"
            icon="i-lucide-x"
            class="-my-1"
            aria-label="Close dialog"
            @click="handleClose"
          />
        </div>

        <!-- Content -->
        <div :class="isDesktop ? 'p-4 space-y-6 overflow-y-auto' : 'flex-1 overflow-y-auto p-4 space-y-6'">
          <div
            v-if="error"
            role="alert"
            class="bg-error/10 text-error rounded-md px-3 py-2 text-sm mb-4"
          >
            {{ error }}
          </div>
          <slot />
        </div>

        <!-- Desktop footer -->
        <div
          v-if="isDesktop"
          class="flex justify-between p-4 border-t border-default shrink-0"
        >
          <div class="flex gap-2">
            <UButton
              v-if="showDelete && canDelete"
              color="error"
              variant="ghost"
              icon="i-lucide-trash"
              :loading="isDeleting"
              :disabled="isDeleting"
              @click="emit('delete')"
            >
              {{ deleteLabel }}
            </UButton>
            <slot name="footer-left" />
          </div>
          <div class="flex gap-2">
            <UButton
              color="neutral"
              variant="ghost"
              @click="handleClose"
            >
              {{ cancelLabel }}
            </UButton>
            <UButton
              v-if="!isReadOnly && showSave"
              :color="saveColor"
              :variant="saveVariant"
              :loading="isSubmitting"
              :disabled="isSubmitting"
              @click="emit('save')"
            >
              {{ saveLabel }}
            </UButton>
          </div>
        </div>

        <!-- Mobile footer/delete section -->
        <div
          v-if="!isDesktop && (showDelete && canDelete || $slots['footer-left'])"
          class="p-4 pb-[env(safe-area-inset-bottom,16px)] border-t border-default shrink-0 space-y-2"
        >
          <slot name="footer-left" />
          <UButton
            v-if="showDelete && canDelete"
            color="error"
            variant="soft"
            icon="i-lucide-trash"
            class="w-full"
            :loading="isDeleting"
            :disabled="isDeleting"
            @click="emit('delete')"
          >
            {{ deleteLabel }}
          </UButton>
        </div>
      </div>
    </template>
  </UModal>
</template>
