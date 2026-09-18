import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";
import { reconcileAccount } from "@/lib/account-balance";

const settleUdharSchema = z.object({
  accountId: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id: entryId } = await params;

  const entry = await prisma.udharEntry.findUnique({
    where: { id: entryId },
    include: { person: true },
  });

  if (!entry || entry.ownerId !== user.id) {
    return NextResponse.json({ error: "Udhar entry not found" }, { status: 404 });
  }

  if (entry.isSettled) {
    return NextResponse.json({ error: "This entry is already settled" }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = settleUdharSchema.safeParse(body);
  const accountId = parsed.success ? parsed.data.accountId : undefined;

  let verifiedAccountId: string | undefined = undefined;
  let targetAccount: any = null;
  if (accountId) {
    const acc = await prisma.account.findUnique({ where: { id: accountId } });
    if (acc && acc.ownerId === user.id) {
      verifiedAccountId = acc.id;
      targetAccount = acc;
    }
  }

  const amt = Number(entry.amount);

  if (entry.type === "DENA" && verifiedAccountId && targetAccount) {
    if (Number(targetAccount.balance) < amt) {
      return NextResponse.json(
        {
          error: `Insufficient balance in ${targetAccount.name}. Available balance is ${Number(
            targetAccount.balance
          )}, but ${amt} is required. Account balance cannot go negative.`,
        },
        { status: 400 }
      );
    }
  }

  const updated = await prisma.$transaction(async (tx) => {
    if (verifiedAccountId) {
      if (entry.type === "LENA") {
        // You received your loaned money back -> increment account balance
        await tx.account.update({
          where: { id: verifiedAccountId },
          data: { balance: { increment: amt } },
        });
      } else {
        // You paid back your borrowed debt -> verify balance and decrement
        const freshAcc = await tx.account.findUnique({ where: { id: verifiedAccountId } });
        if (!freshAcc || Number(freshAcc.balance) < amt) {
          throw new Error(
            `Insufficient balance in ${freshAcc?.name || "account"}. Available: ${Number(
              freshAcc?.balance || 0
            )}, Required: ${amt}.`
          );
        }
        await tx.account.update({
          where: { id: verifiedAccountId },
          data: { balance: { decrement: amt } },
        });
      }
    }

    const settledEntry = await tx.udharEntry.update({
      where: { id: entryId },
      data: {
        isSettled: true,
        settledAt: new Date(),
        settleAccountId: verifiedAccountId,
      },
      include: {
        person: true,
        account: true,
        settleAccount: true,
      },
    });

    if (verifiedAccountId) {
      await reconcileAccount(verifiedAccountId, tx);
    }

    return settledEntry;
  });

  return NextResponse.json({ entry: updated });
}
