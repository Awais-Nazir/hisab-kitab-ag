import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

function dayBounds(offsetDays: number) {
    const d = new Date();
    d.setDate(d.getDate() - offsetDays);
    const start = new Date(d);
    start.setHours(0, 0, 0, 0);
    const end = new Date(d);
    end.setHours(23, 59, 59, 999);
    return { start, end, label: start.toLocaleDateString(undefined, { weekday: "short", day: "numeric" }) };
}

function weekBounds(offsetWeeks: number) {
    const now = new Date();
    const end = new Date(now);
    end.setDate(end.getDate() - offsetWeeks * 7);
    end.setHours(23, 59, 59, 999);

    const start = new Date(end);
    start.setDate(start.getDate() - 6);
    start.setHours(0, 0, 0, 0);

    const label = `${start.toLocaleDateString(undefined, { month: "short", day: "numeric" })} - ${end.toLocaleDateString(undefined, { day: "numeric" })}`;
    return { start, end, label };
}

export async function GET(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    if (!user.selfPersonId) {
        return NextResponse.json(
            { error: "Account setup incomplete — no self-person found" },
            { status: 500 }
        );
    }

    const range = req.nextUrl.searchParams.get("range") || "week";

    const intervals =
        range === "month"
            ? Array.from({ length: 4 }, (_, i) => weekBounds(3 - i))
            : Array.from({ length: 7 }, (_, i) => dayBounds(6 - i));

    const results = await Promise.all(
        intervals.map(async ({ start, end, label }) => {
            const [personal, mySplits] = await Promise.all([
                prisma.expense.findMany({
                    where: {
                        ownerId: user.id,
                        workspaceId: null,
                        splits: { none: {} },
                        payments: { none: {} },
                        date: { gte: start, lte: end },
                    },
                    select: { amount: true },
                }),
                prisma.expenseSplit.findMany({
                    where: {
                        personId: user.selfPersonId!,
                        expense: { date: { gte: start, lte: end } },
                    },
                    select: { shareAmount: true },
                }),
            ]);
            const personalTotal = personal.reduce((s, e) => s + Number(e.amount), 0);
            const splitTotal = mySplits.reduce((s, e) => s + Number(e.shareAmount), 0);
            return { label, total: Math.round((personalTotal + splitTotal) * 100) / 100 };
        })
    );

    return NextResponse.json({ days: results });
}