import { NextResponse } from "next/server";
import { requireUser } from "@/lib/requireUser";
import { sendPushToUser, getContextualReminder } from "@/lib/web-push";

export const dynamic = "force-dynamic";

export async function POST() {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const reminder = getContextualReminder(new Date());

  const sentCount = await sendPushToUser(user.id, {
    title: reminder.title,
    body: reminder.body,
    url: "/dashboard",
  });

  if (sentCount === 0) {
    return NextResponse.json(
      {
        error: "No active device subscriptions found. Please enable Push Notifications first on this device.",
      },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    sentCount,
    message: `Test notification sent to ${sentCount} device(s)! Check your phone notification bar.`,
    notification: reminder,
  });
}
