import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const settleSchema = z.object({
    fromPersonId: z.string(),
    toPersonId: z.string(),
    amount: z.number().positive(),
    note: z.string().optional(),
    accountId: z.string().optional(),
    date: z.string().optional(),
});

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id: workspaceId } = await params;

    const workspace = await prisma.workspace.findUnique({
        where: { id: workspaceId },
    });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = settleSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const memberIds = (
        await prisma.workspaceMember.findMany({
            where: { workspaceId },
            select: { personId: true },
        })
    ).map((m) => m.personId);

    if (
        !memberIds.includes(parsed.data.fromPersonId) ||
        !memberIds.includes(parsed.data.toPersonId)
    ) {
        return NextResponse.json(
            { error: "Both people must be members of this workspace" },
            { status: 400 }
        );
    }

    const { fromPersonId, toPersonId, amount, note, accountId, date } = parsed.data;

    let verifiedAccountId: string | undefined = undefined;
    let targetAccount: any = null;
    if (accountId) {
        const acc = await prisma.account.findUnique({ where: { id: accountId } });
        if (acc && acc.ownerId === user.id) {
            verifiedAccountId = acc.id;
            targetAccount = acc;
        }
    }

    const isSelfPayer = fromPersonId === user.selfPersonId;
    const isSelfReceiver = toPersonId === user.selfPersonId;

    if (verifiedAccountId && isSelfPayer && targetAccount) {
        if (Number(targetAccount.balance) < Number(amount)) {
            return NextResponse.json(
                {
                    error: `Insufficient balance in ${targetAccount.name}. Available: ${Number(
                        targetAccount.balance
                    )}, Required: ${amount}. Account balance cannot go negative.`,
                },
                { status: 400 }
            );
        }
    }

    const settlement = await prisma.$transaction(async (tx) => {
        if (verifiedAccountId) {
            if (isSelfPayer) {
                // User paid out of this account -> verify balance and decrement
                const freshAcc = await tx.account.findUnique({ where: { id: verifiedAccountId } });
                if (!freshAcc || Number(freshAcc.balance) < Number(amount)) {
                    throw new Error(
                        `Insufficient balance in ${freshAcc?.name || "account"}. Available: ${Number(
                            freshAcc?.balance || 0
                        )}, Required: ${amount}.`
                    );
                }
                await tx.account.update({
                    where: { id: verifiedAccountId },
                    data: { balance: { decrement: amount } },
                });
            } else if (isSelfReceiver) {
                // User received into this account -> increment
                await tx.account.update({
                    where: { id: verifiedAccountId },
                    data: { balance: { increment: amount } },
                });
            }
        }

        const s = await tx.settlement.create({
            data: {
                workspaceId,
                fromPersonId,
                toPersonId,
                amount,
                note,
                accountId: verifiedAccountId,
                date: date ? new Date(date) : new Date(),
            },
            include: { fromPerson: true, toPerson: true, account: true },
        });

        return s;
    });

    return NextResponse.json({ settlement });
}

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id: workspaceId } = await params;

    const workspace = await prisma.workspace.findUnique({ where: { id: workspaceId } });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const settlements = await prisma.settlement.findMany({
        where: { workspaceId },
        include: { fromPerson: true, toPerson: true, account: true },
        orderBy: { date: "desc" },
    });

    return NextResponse.json({ settlements });
}