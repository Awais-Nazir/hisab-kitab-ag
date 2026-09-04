import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const createPersonalExpenseSchema = z.object({
    amount: z.number().positive(),
    description: z.string().min(1),
    category: z.string().optional(),
    accountId: z.string().optional(),
    date: z.string().optional(), // ISO date string
});

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const body = await req.json();
    const parsed = createPersonalExpenseSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json(
            { error: parsed.error.flatten() },
            { status: 400 }
        );
    }

    const { amount, description, category, accountId, date } = parsed.data;

    let verifiedAccountId: string | undefined;
    if (accountId) {
        const acc = await prisma.account.findUnique({
            where: { id: accountId },
        });
        if (acc && acc.ownerId === user.id) {
            verifiedAccountId = acc.id;
        }
    }

    const expense = await prisma.$transaction(async (tx) => {
        const exp = await tx.expense.create({
            data: {
                amount,
                description,
                category,
                accountId: verifiedAccountId,
                date: date ? new Date(date) : new Date(),
                ownerId: user.id,
            },
            include: {
                account: true,
            },
        });

        if (verifiedAccountId) {
            await tx.account.update({
                where: { id: verifiedAccountId },
                data: { balance: { decrement: amount } },
            });
        }

        return exp;
    });

    return NextResponse.json({ expense });
}

export async function GET() {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const expenses = await prisma.expense.findMany({
        where: { ownerId: user.id },
        include: {
            account: true,
        },
        orderBy: { date: "desc" },
    });

    return NextResponse.json({ expenses });
}