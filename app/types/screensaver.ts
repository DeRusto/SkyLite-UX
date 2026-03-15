// Screensaver-specific types shared between settingsScreensaver.vue and its sub-components.
// Note: app/integrations/immich/immichPhotos.ts defines a DIFFERENT ImmichPerson type
// ({id, name, thumbnailPath}) used for the integration registry. This type is the more
// detailed shape returned by the Immich People API used in screensaver settings.

export type ImmichPerson = {
  id: string;
  name: string;
  birthDate: string | null;
  thumbnailUrl: string;
  type: "person" | "pet";
};

export type ScreensaverSettingsData = {
  id: string;
  enabled: boolean;
  activationMode: string;
  idleTimeoutMinutes: number;
  scheduleStart: string | null;
  scheduleEnd: string | null;
  photoDisplaySeconds: number;
  transitionEffect: string;
  showClock: boolean;
  clockPosition: string;
  selectedPhotoSource: string | null;
  photoIntegrations: Array<{
    id: string;
    name: string;
    service: string;
    settings: Record<string, unknown> | null;
    enabled: boolean;
  }>;
};
