import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const transferSchema = z.object({
    fromAccountId: z.string().min(1),
    toAccountId: z.string().min(1),
    amount: z.number().positive(),
    note: z.string().optional(),
    date: z.string().optional(),
});

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const body = await req.json();
    const parsed = transferSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { fromAccountId, toAccountId, amount, note, date } = parsed.data;

    if (fromAccountId === toAccountId) {
        return NextResponse.json({ error: "Source and destination accounts must be different" }, { status: 400 });
    }

    const [fromAccount, toAccount] = await Promise.all([
        prisma.account.findUnique({ where: { id: fromAccountId } }),
        prisma.account.findUnique({ where: { id: toAccountId } }),
    ]);

    if (!fromAccount || fromAccount.ownerId !== user.id) {
        return NextResponse.json({ error: "Source account not found" }, { status: 404 });
    }
    if (!toAccount || toAccount.ownerId !== user.id) {
        return NextResponse.json({ error: "Destination account not found" }, { status: 404 });
    }

    const [transfer, updatedFrom, updatedTo] = await prisma.$transaction([
        prisma.accountTransfer.create({
            data: {
                ownerId: user.id,
                fromAccountId,
                toAccountId,
                amount,
                note: note || undefined,
                date: date ? new Date(date) : new Date(),
            },
            include: {
                fromAccount: true,
                toAccount: true,
            },
        }),
        prisma.account.update({
            where: { id: fromAccountId },
            data: { balance: { decrement: amount } },
        }),
        prisma.account.update({
            where: { id: toAccountId },
            data: { balance: { increment: amount } },
        }),
    ]);

    return NextResponse.json({ transfer, updatedFrom, updatedTo });
}

export async function GET() {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const transfers = await prisma.accountTransfer.findMany({
        where: { ownerId: user.id },
        include: {
            fromAccount: true,
            toAccount: true,
        },
        orderBy: { date: "desc" },
        take: 50,
    });

    return NextResponse.json({ transfers });
}
