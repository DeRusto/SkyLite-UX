import type { Integration } from "@prisma/client";

// Settings keys holding credentials. They stay server-side: they are removed
// from API responses and preserved by PUT /api/integrations/:id when a client
// sends settings back without them.
export const SECRET_SETTINGS_KEYS = ["clientSecret", "accessToken", "tokenExpiry"] as const;

export function sanitizeSettings(settings: unknown) {
  if (!settings || typeof settings !== "object")
    return settings;

  const sanitized = { ...settings } as Record<string, unknown>;

  for (const key of SECRET_SETTINGS_KEYS)
    delete sanitized[key];

  return sanitized;
}

export function sanitizeIntegration(integration: Integration) {
  return {
    id: integration.id,
    name: integration.name,
    type: integration.type,
    service: integration.service,
    icon: integration.icon,
    enabled: integration.enabled,
    settings: sanitizeSettings(integration.settings),
    createdAt: integration.createdAt,
    updatedAt: integration.updatedAt,
  };
}
