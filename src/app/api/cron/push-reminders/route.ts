import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  sendWebPush,
  getContextualReminder,
  isEligibleRandomReminderSlot,
} from "@/lib/web-push";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  const isVercelCron = req.headers.get("user-agent")?.includes("vercel-cron");
  const url = new URL(req.url);
  const isForce = url.searchParams.get("force") === "true";

  // Security check: allow if Vercel cron header, valid CRON_SECRET Bearer, or query secret
  const querySecret = url.searchParams.get("secret");
  const isAuthorized =
    isVercelCron ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`) ||
    (cronSecret && querySecret === cronSecret);

  if (!isAuthorized && process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();

  // Check whether current time matches today's dynamic random window
  if (!isForce && !isEligibleRandomReminderSlot(now)) {
    return NextResponse.json({
      skipped: true,
      reason: `Current hour (${now.getHours()}) is not in today's randomized reminder slot. Slots fluctuate daily.`,
      time: now.toISOString(),
    });
  }

  // Pick a fresh contextual message (morning / afternoon / night / weekend)
  const reminder = getContextualReminder(now);

  // Fetch all active subscriptions across users
  const subscriptions = await prisma.pushSubscription.findMany({
    select: {
      id: true,
      endpoint: true,
      p256dh: true,
      auth: true,
      userId: true,
    },
  });

  if (subscriptions.length === 0) {
    return NextResponse.json({
      message: "No registered device push subscriptions found",
      sent: 0,
    });
  }

  let successCount = 0;
  let failureCount = 0;

  for (const sub of subscriptions) {
    const success = await sendWebPush(sub, {
      title: reminder.title,
      body: reminder.body,
      url: "/dashboard",
    });

    if (success) {
      successCount++;
    } else {
      failureCount++;
    }
  }

  return NextResponse.json({
    success: true,
    reminderSent: reminder,
    totalDevices: subscriptions.length,
    successCount,
    failureCount,
    timestamp: now.toISOString(),
  });
}
