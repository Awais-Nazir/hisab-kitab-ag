import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id: entryId } = await params;

  const entry = await prisma.udharEntry.findUnique({
    where: { id: entryId },
  });

  if (!entry || entry.ownerId !== user.id) {
    return NextResponse.json({ error: "Udhar entry not found" }, { status: 404 });
  }

  const amt = Number(entry.amount);

  await prisma.$transaction(async (tx) => {
    // If not settled and had an accountId, revert the original creation impact
    if (!entry.isSettled && entry.accountId) {
      if (entry.type === "LENA") {
        // Was decremented on creation -> refund
        await tx.account.update({
          where: { id: entry.accountId },
          data: { balance: { increment: amt } },
        });
      } else {
        // Was incremented on creation -> reverse
        await tx.account.update({
          where: { id: entry.accountId },
          data: { balance: { decrement: amt } },
        });
      }
    }

    // If settled and had a settleAccountId, revert the settlement impact
    if (entry.isSettled && entry.settleAccountId) {
      if (entry.type === "LENA") {
        // Was incremented on settlement -> reverse
        await tx.account.update({
          where: { id: entry.settleAccountId },
          data: { balance: { decrement: amt } },
        });
      } else {
        // Was decremented on settlement -> refund
        await tx.account.update({
          where: { id: entry.settleAccountId },
          data: { balance: { increment: amt } },
        });
      }
    }

    await tx.udharEntry.delete({ where: { id: entryId } });
  });

  return NextResponse.json({ success: true });
}
