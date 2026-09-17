import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const updateSchema = z.object({
    amount: z.number().positive(),
    description: z.string().min(1),
    category: z.string().optional(),
    accountId: z.string().nullable().optional(),
    date: z.string().optional(),
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
        include: { account: true },
    });
    if (!existing || existing.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { amount, description, category, accountId, date } = parsed.data;

    // Determine new account ID
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

    const oldAmount = Number(existing.amount);
    const oldAccountId = existing.accountId;

    try {
        const expense = await prisma.$transaction(async (tx) => {
            if (oldAccountId && targetAccountId && oldAccountId === targetAccountId) {
                // Same account: adjust difference
                const diff = amount - oldAmount;
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
                // 1. Refund old account
                if (oldAccountId) {
                    await tx.account.update({
                        where: { id: oldAccountId },
                        data: { balance: { increment: oldAmount } },
                    });
                }
                // 2. Deduct from new account
                if (targetAccountId) {
                    const freshAcc = await tx.account.findUnique({ where: { id: targetAccountId } });
                    if (!freshAcc || Number(freshAcc.balance) < amount) {
                        throw new Error(
                            `Insufficient balance in ${freshAcc?.name || "account"}. Available: ${Number(
                                freshAcc?.balance || 0
                            )}, Required: ${amount}. Account balance cannot go negative.`
                        );
                    }
                    await tx.account.update({
                        where: { id: targetAccountId },
                        data: { balance: { decrement: amount } },
                    });
                }
            }

            return tx.expense.update({
                where: { id },
                data: {
                    amount,
                    description,
                    category,
                    accountId: targetAccountId,
                    date: date ? new Date(date) : existing.date,
                },
                include: { account: true },
            });
        });

        return NextResponse.json({ expense });
    } catch (err) {
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
    if (!existing || existing.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
        if (existing.accountId) {
            await tx.account.update({
                where: { id: existing.accountId },
                data: { balance: { increment: Number(existing.amount) } },
            });
        }
        await tx.expense.delete({ where: { id } });
    });

    return NextResponse.json({ success: true });
}
