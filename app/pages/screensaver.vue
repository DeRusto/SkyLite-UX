<script setup lang="ts">
import { consola } from "consola";
// Screensaver page - displays photos full-screen and dismisses on touch

const { deactivateScreensaver } = useScreensaver();

type ScreensaverPhoto = {
  id: string;
  url: string;
};

// Fallback photos in case no Immich integration is configured
const fallbackPhotos = [
  "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1920&q=80",
  "https://images.unsplash.com/photo-1469474968028-56623f02e42e?w=1920&q=80",
  "https://images.unsplash.com/photo-1426604966848-d7adac402bff?w=1920&q=80",
  "https://images.unsplash.com/photo-1501854140801-50d01698950b?w=1920&q=80",
  "https://images.unsplash.com/photo-1441974231531-c6227db76b6e?w=1920&q=80",
];

const photos = ref<string[]>([...fallbackPhotos]);
const currentPhotoIndex = ref(0);
const isTransitioning = ref(false);
const displayDuration = ref(8000); // 8 seconds per photo, updated from settings
let slideInterval: ReturnType<typeof setInterval> | null = null;

// Current time for clock display
const currentTime = ref(new Date());
let timeInterval: ReturnType<typeof setInterval> | null = null;

const currentPhoto = computed(() => photos.value[currentPhotoIndex.value]);

const formattedTime = computed(() => {
  return currentTime.value.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
});

const formattedDate = computed(() => {
  return currentTime.value.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
});

// Fetch real photos from the screensaver API
async function fetchPhotos() {
  try {
    const data = await $fetch<{
      photos: ScreensaverPhoto[];
      total: number;
    }>("/api/screensaver/photos", {
      query: { count: 30 },
    });

    if (data.photos && data.photos.length > 0) {
      photos.value = data.photos.map(p => p.url);
      consola.info(`Loaded ${data.photos.length} photos for screensaver`);
    }
    else {
      consola.info("No Immich photos available, using fallback photos");
      photos.value = [...fallbackPhotos];
    }
  }
  catch (err) {
    consola.warn("Failed to fetch screensaver photos, using fallbacks:", err);
    photos.value = [...fallbackPhotos];
  }
}

// Fetch screensaver settings for display duration
async function fetchSettings() {
  try {
    const settings = await $fetch<{
      photoDisplaySeconds: number;
      showClock: boolean;
    }>("/api/screensaver/settings");

    if (settings.photoDisplaySeconds) {
      displayDuration.value = settings.photoDisplaySeconds * 1000;
    }
  }
  catch (err) {
    consola.warn("Failed to fetch screensaver settings:", err);
  }
}

function nextPhoto() {
  if (photos.value.length <= 1)
    return;

  isTransitioning.value = true;
  setTimeout(() => {
    currentPhotoIndex.value = (currentPhotoIndex.value + 1) % photos.value.length;
    isTransitioning.value = false;
  }, 500); // Match CSS transition duration
}

function handleDismiss() {
  // Clean up intervals
  if (slideInterval) {
    clearInterval(slideInterval);
    slideInterval = null;
  }
  if (timeInterval) {
    clearInterval(timeInterval);
    timeInterval = null;
  }
  // Deactivate screensaver and navigate to calendar
  deactivateScreensaver();
}

onMounted(async () => {
  // Fetch settings and photos
  await fetchSettings();
  await fetchPhotos();

  // Start photo slideshow
  slideInterval = setInterval(nextPhoto, displayDuration.value);

  // Start clock updates
  timeInterval = setInterval(() => {
    currentTime.value = new Date();
  }, 1000);
});

onUnmounted(() => {
  if (slideInterval) {
    clearInterval(slideInterval);
  }
  if (timeInterval) {
    clearInterval(timeInterval);
  }
});

// Define page meta to use screensaver layout (no sidebar)
definePageMeta({
  layout: "screensaver",
});
</script>

<template>
  <div
    class="fixed inset-0 z-50 bg-black cursor-pointer"
    role="button"
    tabindex="0"
    aria-label="Touch anywhere to exit screensaver"
    @click="handleDismiss"
    @touchstart.prevent="handleDismiss"
    @keydown.escape="handleDismiss"
    @keydown.space="handleDismiss"
    @keydown.enter="handleDismiss"
  >
    <!-- Photo background -->
    <div
      class="absolute inset-0 bg-cover bg-center transition-opacity duration-500"
      :class="{ 'opacity-0': isTransitioning, 'opacity-100': !isTransitioning }"
      :style="{ backgroundImage: `url(${currentPhoto})` }"
    />

    <!-- Dark overlay for better text readability -->
    <div class="absolute inset-0 bg-black/20" />

    <!-- Clock overlay - positioned bottom-right by default -->
    <div class="absolute bottom-8 right-8 text-white text-right drop-shadow-lg">
      <div class="text-6xl font-light tracking-wide">
        {{ formattedTime }}
      </div>
      <div class="text-xl font-light opacity-90 mt-1">
        {{ formattedDate }}
      </div>
    </div>

    <!-- Hint text -->
    <div class="absolute bottom-4 left-1/2 transform -translate-x-1/2 text-white/50 text-sm">
      Touch anywhere to return to calendar
    </div>
  </div>
</template>
