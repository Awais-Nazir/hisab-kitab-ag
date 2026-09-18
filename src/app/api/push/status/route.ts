import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export const dynamic = "force-dynamic";

export async function GET() {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const count = await prisma.pushSubscription.count({
    where: { userId: user.id },
  });

  return NextResponse.json({
    isSubscribed: count > 0,
    deviceCount: count,
  });
}
