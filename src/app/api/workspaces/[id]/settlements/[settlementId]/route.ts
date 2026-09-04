import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const updateSettleSchema = z.object({
    fromPersonId: z.string(),
    toPersonId: z.string(),
    amount: z.number().positive(),
    note: z.string().optional(),
    date: z.string().optional(),
    accountId: z.string().optional().nullable(),
});

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id: workspaceId, settlementId } = await params;
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const existing = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!existing || existing.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateSettleSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const memberIds = (
        await prisma.workspaceMember.findMany({ where: { workspaceId }, select: { personId: true } })
    ).map((m) => m.personId);
    if (!memberIds.includes(parsed.data.fromPersonId) || !memberIds.includes(parsed.data.toPersonId)) {
        return NextResponse.json({ error: "Both people must be members of this workspace" }, { status: 400 });
    }

    const newAccountId = parsed.data.accountId || null;
    const newAmount = parsed.data.amount;

    const settlement = await prisma.$transaction(async (tx) => {
        // 1. Revert previous account adjustment
        if (existing.accountId) {
            if (existing.fromPersonId === user.selfPersonId) {
                await tx.account.update({
                    where: { id: existing.accountId },
                    data: { balance: { increment: existing.amount } },
                });
            } else if (existing.toPersonId === user.selfPersonId) {
                await tx.account.update({
                    where: { id: existing.accountId },
                    data: { balance: { decrement: existing.amount } },
                });
            }
        }

        // 2. Apply new account adjustment
        if (newAccountId) {
            if (parsed.data.fromPersonId === user.selfPersonId) {
                await tx.account.update({
                    where: { id: newAccountId },
                    data: { balance: { decrement: newAmount } },
                });
            } else if (parsed.data.toPersonId === user.selfPersonId) {
                await tx.account.update({
                    where: { id: newAccountId },
                    data: { balance: { increment: newAmount } },
                });
            }
        }

        // 3. Update the settlement record
        return tx.settlement.update({
            where: { id: settlementId },
            data: {
                fromPersonId: parsed.data.fromPersonId,
                toPersonId: parsed.data.toPersonId,
                amount: newAmount,
                note: parsed.data.note,
                date: parsed.data.date ? new Date(parsed.data.date) : existing.date,
                accountId: newAccountId,
            },
        });
    });

    return NextResponse.json({ settlement });
}

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ id: string; settlementId: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id: workspaceId, settlementId } = await params;
    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    const existing = await prisma.settlement.findUnique({ where: { id: settlementId } });
    if (!existing || existing.workspaceId !== workspaceId) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
        if (existing.accountId) {
            const isSelfPayer = existing.fromPersonId === user.selfPersonId;
            const isSelfReceiver = existing.toPersonId === user.selfPersonId;
            if (isSelfPayer) {
                // Was decremented on creation -> refund
                await tx.account.update({
                    where: { id: existing.accountId },
                    data: { balance: { increment: existing.amount } },
                });
            } else if (isSelfReceiver) {
                // Was incremented on creation -> reverse
                await tx.account.update({
                    where: { id: existing.accountId },
                    data: { balance: { decrement: existing.amount } },
                });
            }
        }
        await tx.settlement.delete({ where: { id: settlementId } });
    });
    return NextResponse.json({ success: true });
}