import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";
import { sendWebPush } from "@/lib/web-push";

export const dynamic = "force-dynamic";

const subscribeSchema = z.object({
  endpoint: z.string().url("Invalid push endpoint"),
  keys: z.object({
    p256dh: z.string().min(1),
    auth: z.string().min(1),
  }),
  userAgent: z.string().optional(),
});

export async function POST(req: NextRequest) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  try {
    const body = await req.json();
    const parsed = subscribeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { endpoint, keys, userAgent } = parsed.data;

    // Upsert subscription in database
    const subscription = await prisma.pushSubscription.upsert({
      where: { endpoint },
      update: {
        userId: user.id,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || req.headers.get("user-agent") || undefined,
        updatedAt: new Date(),
      },
      create: {
        userId: user.id,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        userAgent: userAgent || req.headers.get("user-agent") || undefined,
      },
    });

    // Send an immediate welcome push notification to confirm it works
    await sendWebPush(
      { endpoint: subscription.endpoint, p256dh: subscription.p256dh, auth: subscription.auth },
      {
        title: "Hisab Kitab • Push Reminders Active",
        body: "Bahi, notification reminders active ho chuki hain! Ab rozana kharcha bhoolne ka koi chance nahi! 🚀",
        url: "/dashboard",
      }
    );

    return NextResponse.json({ success: true, subscriptionId: subscription.id });
  } catch (err) {
    console.error("Failed to save push subscription:", err);
    return NextResponse.json({ error: "Failed to save push subscription" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  try {
    const { endpoint } = await req.json();
    if (endpoint) {
      await prisma.pushSubscription.deleteMany({
        where: { endpoint, userId: user.id },
      });
    } else {
      // Unsubscribe all devices for user
      await prisma.pushSubscription.deleteMany({
        where: { userId: user.id },
      });
    }

    return NextResponse.json({ success: true, message: "Unsubscribed successfully" });
  } catch (err) {
    console.error("Failed to unsubscribe:", err);
    return NextResponse.json({ error: "Failed to unsubscribe" }, { status: 500 });
  }
}
