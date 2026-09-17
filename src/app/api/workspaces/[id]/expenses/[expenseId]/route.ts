import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

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
    splits: z.array(shareEntrySchema).min(1),
    payments: z.array(shareEntrySchema).min(1),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id: workspaceId, expenseId } = await params;

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const existing = await prisma.expense.findUnique({
        where: { id: expenseId },
        include: { payments: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateExpenseSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }
    const { amount, description, category, accountId, date, splits, payments } = parsed.data;

    const splitSum = splits.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(splitSum - amount) > 0.01) {
        return NextResponse.json(
            { error: `Splits sum to ${splitSum.toFixed(2)} but expense is ${amount.toFixed(2)}` },
            { status: 400 }
        );
    }
    const paymentSum = payments.reduce((s, x) => s + x.amount, 0);
    if (Math.abs(paymentSum - amount) > 0.01) {
        return NextResponse.json(
            { error: `Payments sum to ${paymentSum.toFixed(2)} but expense is ${amount.toFixed(2)}` },
            { status: 400 }
        );
    }

    const memberIds = (
        await prisma.workspaceMember.findMany({
            where: { workspaceId },
            select: { personId: true },
        })
    ).map((m) => m.personId);
    const allParticipants = [...splits.map((s) => s.personId), ...payments.map((p) => p.personId)];
    const invalid = allParticipants.find((id) => !memberIds.includes(id));
    if (invalid) {
        return NextResponse.json(
            { error: "All participants must be members of this workspace" },
            { status: 400 }
        );
    }

    let targetAccountId: string | null = existing.accountId;
    if (accountId !== undefined) {
        if (accountId) {
            const acc = await prisma.account.findUnique({ where: { id: accountId } });
            if (acc && acc.ownerId === user.id) {
                targetAccountId = acc.id;
            } else {
                return NextResponse.json({ error: "Invalid account" }, { status: 400 });
            }
        } else {
            targetAccountId = null;
        }
    }

    // Old payment by user
    const oldSelfPayment = existing.payments.find((p) => p.personId === user.selfPersonId);
    const oldSelfPaidAmount = oldSelfPayment ? Number(oldSelfPayment.amountPaid) : 0;
    const oldAccountId = existing.accountId;

    // New payment by user
    const newSelfPayment = payments.find((p) => p.personId === user.selfPersonId);
    const newSelfPaidAmount = newSelfPayment ? newSelfPayment.amount : 0;

    try {
        const expense = await prisma.$transaction(async (tx) => {
            // Reconcile user account deductions
            if (oldAccountId && targetAccountId && oldAccountId === targetAccountId) {
                const diff = newSelfPaidAmount - oldSelfPaidAmount;
                if (diff > 0) {
                    const freshAcc = await tx.account.findUnique({ where: { id: targetAccountId } });
                    if (!freshAcc || Number(freshAcc.balance) < diff) {
                        throw new Error(
                            `Insufficient balance in ${freshAcc?.name || "account"}. Available: ${Number(
                                freshAcc?.balance || 0
                            )}, Additional required: ${diff}. Account balance cannot go negative.`
                        );
                    }
                    await tx.account.update({
                        where: { id: targetAccountId },
                        data: { balance: { decrement: diff } },
                    });
                } else if (diff < 0) {
                    await tx.account.update({
                        where: { id: targetAccountId },
                        data: { balance: { increment: Math.abs(diff) } },
                    });
                }
            } else {
                // Account changed or added/removed
                if (oldAccountId && oldSelfPaidAmount > 0) {
                    await tx.account.update({
                        where: { id: oldAccountId },
                        data: { balance: { increment: oldSelfPaidAmount } },
                    });
                }
                if (targetAccountId && newSelfPaidAmount > 0) {
                    const freshAcc = await tx.account.findUnique({ where: { id: targetAccountId } });
                    if (!freshAcc || Number(freshAcc.balance) < newSelfPaidAmount) {
                        throw new Error(
                            `Insufficient balance in ${freshAcc?.name || "account"}. Available: ${Number(
                                freshAcc?.balance || 0
                            )}, Required: ${newSelfPaidAmount}. Account balance cannot go negative.`
                        );
                    }
                    await tx.account.update({
                        where: { id: targetAccountId },
                        data: { balance: { decrement: newSelfPaidAmount } },
                    });
                }
            }

            await tx.expenseSplit.deleteMany({ where: { expenseId } });
            await tx.expensePayment.deleteMany({ where: { expenseId } });
            return tx.expense.update({
                where: { id: expenseId },
                data: {
                    amount,
                    description,
                    category,
                    accountId: targetAccountId,
                    date: date ? new Date(date) : existing.date,
                    splits: { create: splits.map((s) => ({ personId: s.personId, shareAmount: s.amount })) },
                    payments: { create: payments.map((p) => ({ personId: p.personId, amountPaid: p.amount })) },
                },
                include: { splits: { include: { person: true } }, payments: { include: { person: true } }, account: true },
            });
        });

        return NextResponse.json({ expense });
    } catch (err) {
        return NextResponse.json(
            { error: err instanceof Error ? err.message : "Failed to update shared expense" },
            { status: 400 }
        );
    }
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; expenseId: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id: workspaceId, expenseId } = await params;
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const existing = await prisma.expense.findUnique({
        where: { id: expenseId },
        include: { payments: true },
    });
    if (!existing || existing.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
        if (existing.accountId) {
            const selfPayment = existing.payments.find((p) => p.personId === user.selfPersonId);
            const selfPaidAmount = selfPayment ? Number(selfPayment.amountPaid) : 0;
            if (selfPaidAmount > 0) {
                await tx.account.update({
                    where: { id: existing.accountId },
                    data: { balance: { increment: selfPaidAmount } },
                });
            }
        }
        await tx.expenseSplit.deleteMany({ where: { expenseId } });
        await tx.expensePayment.deleteMany({ where: { expenseId } });
        await tx.expense.delete({ where: { id: expenseId } });
    });

    return NextResponse.json({ success: true });
}
