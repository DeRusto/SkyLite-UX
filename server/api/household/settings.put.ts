import prisma from "~/lib/prisma";

type LinkedCalendarEntry = {
  type: "HOLIDAY" | "FAMILY";
  integrationId: string;
  calendarId: string;
};

type UpdateHouseholdSettingsBody = {
  familyName?: string;
  choreCompletionMode?: "SELF_CLAIM" | "ADULT_VERIFY";
  rewardApprovalThreshold?: number | null;
  linkedCalendars?: LinkedCalendarEntry[];
  holidayColor?: string;
  familyColor?: string;
  pinProtectionEnabled?: boolean;
};

export default defineEventHandler(async (event) => {
  const body = await readBody<UpdateHouseholdSettingsBody>(event);

  // Get current settings or create if doesn't exist
  let settings = await prisma.householdSettings.findFirst();

  if (!settings) {
    settings = await prisma.householdSettings.create({
      data: {
        familyName: "Our Family",
        choreCompletionMode: "SELF_CLAIM",
        rewardApprovalThreshold: null,
      },
    });
  }

  // Validate inputs
  if (body.familyName !== undefined && (typeof body.familyName !== "string" || body.familyName.trim() === "")) {
    throw createError({
      statusCode: 400,
      statusMessage: "Family name cannot be empty",
    });
  }

  if (body.choreCompletionMode !== undefined && !["SELF_CLAIM", "ADULT_VERIFY"].includes(body.choreCompletionMode)) {
    throw createError({
      statusCode: 400,
      statusMessage: "Invalid chore completion mode",
    });
  }

  if (body.rewardApprovalThreshold !== undefined && body.rewardApprovalThreshold !== null) {
    if (typeof body.rewardApprovalThreshold !== "number" || body.rewardApprovalThreshold < 0) {
      throw createError({
        statusCode: 400,
        statusMessage: "Reward approval threshold must be a non-negative number",
      });
    }
  }

  if (body.pinProtectionEnabled !== undefined && typeof body.pinProtectionEnabled !== "boolean") {
    throw createError({
      statusCode: 400,
      statusMessage: "PIN protection enabled must be a boolean",
    });
  }

  // Update settings
  const updatedSettings = await prisma.householdSettings.update({
    where: { id: settings.id },
    data: {
      ...(body.familyName !== undefined && { familyName: body.familyName.trim() }),
      ...(body.choreCompletionMode !== undefined && { choreCompletionMode: body.choreCompletionMode }),
      ...(body.rewardApprovalThreshold !== undefined && { rewardApprovalThreshold: body.rewardApprovalThreshold }),
      ...(body.linkedCalendars !== undefined && { linkedCalendars: body.linkedCalendars }),
      ...(body.holidayColor !== undefined && { holidayColor: body.holidayColor }),
      ...(body.familyColor !== undefined && { familyColor: body.familyColor }),
      ...(body.pinProtectionEnabled !== undefined && { pinProtectionEnabled: body.pinProtectionEnabled }),
    },
  });

  return {
    id: updatedSettings.id,
    familyName: updatedSettings.familyName,
    choreCompletionMode: updatedSettings.choreCompletionMode,
    rewardApprovalThreshold: updatedSettings.rewardApprovalThreshold,
    linkedCalendars: updatedSettings.linkedCalendars,
    holidayColor: updatedSettings.holidayColor,
    familyColor: updatedSettings.familyColor,
    pinProtectionEnabled: updatedSettings.pinProtectionEnabled,
  };
});
