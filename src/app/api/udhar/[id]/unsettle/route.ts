import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id: entryId } = await params;

  const entry = await prisma.udharEntry.findUnique({
    where: { id: entryId },
    include: { person: true, account: true, settleAccount: true },
  });

  if (!entry || entry.ownerId !== user.id) {
    return NextResponse.json({ error: "Udhar entry not found" }, { status: 404 });
  }

  if (!entry.isSettled) {
    return NextResponse.json({ error: "This entry is not settled" }, { status: 400 });
  }

  const amt = Number(entry.amount);

  const updated = await prisma.$transaction(async (tx) => {
    // Revert the balance impact made during settlement
    if (entry.settleAccountId) {
      if (entry.type === "DENA") {
        // Was paid back out of an account (decremented) -> Refund the account
        await tx.account.update({
          where: { id: entry.settleAccountId },
          data: { balance: { increment: amt } },
        });
      } else {
        // Was received into an account (incremented) -> Deduct back from account
        await tx.account.update({
          where: { id: entry.settleAccountId },
          data: { balance: { decrement: amt } },
        });
      }
    }

    const unsettledEntry = await tx.udharEntry.update({
      where: { id: entryId },
      data: {
        isSettled: false,
        settledAt: null,
        settleAccountId: null,
      },
      include: {
        person: true,
        account: true,
        settleAccount: true,
      },
    });

    return unsettledEntry;
  });

  return NextResponse.json({ entry: updated, message: "Settlement undone successfully" });
}
