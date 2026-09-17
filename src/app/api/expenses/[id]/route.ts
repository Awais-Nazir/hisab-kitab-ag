import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";
import { reconcileAccount } from "@/lib/account-balance";

const shareEntrySchema = z.object({
  personId: z.string(),
  amount: z.number().nonnegative(),
});

const updateExpenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  category: z.string().optional(),
  accountId: z.string().nullable().optional(),
  date: z.string().optional(),
  payments: z.array(shareEntrySchema).optional(),
  splits: z.array(shareEntrySchema).optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id } = await params;
  const existing = await prisma.expense.findUnique({
    where: { id },
    include: { payments: true, splits: true },
  });

  if (!existing || (existing.ownerId !== user.id && existing.workspaceId === null)) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = updateExpenseSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { amount, description, category, accountId, date, payments, splits } = parsed.data;

  // Determine target account
  let targetAccountId: string | null = existing.accountId;
  if (accountId !== undefined) {
    if (accountId) {
      const acc = await prisma.account.findUnique({ where: { id: accountId } });
      if (!acc || acc.ownerId !== user.id) {
        return NextResponse.json({ error: "Invalid account" }, { status: 400 });
      }
      targetAccountId = acc.id;
    } else {
      targetAccountId = null;
    }
  }

  const oldAccountId = existing.accountId;

  // Validation if shared
  const isShared = Boolean((splits && splits.length > 0) || (payments && payments.length > 0));
  if (isShared && splits && splits.length > 0) {
    const splitSum = splits.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(splitSum - amount) > 0.05) {
      return NextResponse.json(
        { error: `Splits sum to ${splitSum.toFixed(2)} but expense is ${amount.toFixed(2)}` },
        { status: 400 }
      );
    }
  }
  if (isShared && payments && payments.length > 0) {
    const paymentSum = payments.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(paymentSum - amount) > 0.05) {
      return NextResponse.json(
        { error: `Payments sum to ${paymentSum.toFixed(2)} but expense is ${amount.toFixed(2)}` },
        { status: 400 }
      );
    }
  }

  try {
    const updated = await prisma.$transaction(async (tx) => {
      // Clear old splits and payments
      await tx.expenseSplit.deleteMany({ where: { expenseId: id } });
      await tx.expensePayment.deleteMany({ where: { expenseId: id } });

      const expense = await tx.expense.update({
        where: { id },
        data: {
          amount,
          description,
          category,
          accountId: targetAccountId,
          date: date ? new Date(date) : existing.date,
          ...(splits && splits.length > 0
            ? { splits: { create: splits.map((s) => ({ personId: s.personId, shareAmount: s.amount })) } }
            : {}),
          ...(payments && payments.length > 0
            ? { payments: { create: payments.map((p) => ({ personId: p.personId, amountPaid: p.amount })) } }
            : {}),
        },
        include: {
          splits: { include: { person: true } },
          payments: { include: { person: true } },
          account: true,
        },
      });

      // Centralized ledger reconciliation for old and new accounts
      if (oldAccountId) {
        await reconcileAccount(oldAccountId, tx);
      }
      if (targetAccountId && targetAccountId !== oldAccountId) {
        await reconcileAccount(targetAccountId, tx);
      }

      return expense;
    });

    return NextResponse.json({ expense: updated });
  } catch (err: any) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update expense" },
      { status: 400 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, errorResponse } = await requireUser();
  if (!user) return errorResponse;

  const { id } = await params;
  const existing = await prisma.expense.findUnique({ where: { id } });
  if (!existing || (existing.ownerId !== user.id && existing.workspaceId === null)) {
    return NextResponse.json({ error: "Expense not found" }, { status: 404 });
  }

  const accountId = existing.accountId;

  await prisma.$transaction(async (tx) => {
    await tx.expenseSplit.deleteMany({ where: { expenseId: id } });
    await tx.expensePayment.deleteMany({ where: { expenseId: id } });
    await tx.expense.delete({ where: { id } });

    if (accountId) {
      await reconcileAccount(accountId, tx);
    }
  });

  return NextResponse.json({ success: true });
}
