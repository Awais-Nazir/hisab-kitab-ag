import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const DEFAULT_ACCOUNTS = [
    { name: "Cash", type: "CASH", color: "#1E7D46", icon: "cash", balance: 0 },
    { name: "NayaPay", type: "WALLET", color: "#F97316", icon: "wallet", balance: 0 },
    { name: "SadaPay", type: "WALLET", color: "#06B6D4", icon: "wallet", balance: 0 },
    { name: "Bank Account", type: "BANK", color: "#0F5C53", icon: "bank", balance: 0 },
    { name: "Udhar Khata", type: "UDHAR_KHATA", color: "#8B5CF6", icon: "book", balance: 0 },
];

const createAccountSchema = z.object({
    name: z.string().min(1).max(50),
    type: z.enum(["CASH", "BANK", "WALLET", "UDHAR_KHATA"]).default("CASH"),
    balance: z.number().default(0),
    color: z.string().optional().default("#0F5C53"),
    icon: z.string().optional().default("wallet"),
});

export async function GET() {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    let accounts = await prisma.account.findMany({
        where: { ownerId: user.id },
        orderBy: { createdAt: "asc" },
    });

    // Auto-seed default accounts if user has none
    if (accounts.length === 0) {
        await prisma.account.createMany({
            data: DEFAULT_ACCOUNTS.map((a) => ({
                ownerId: user.id,
                name: a.name,
                type: a.type,
                color: a.color,
                icon: a.icon,
                balance: a.balance,
            })),
        });

        accounts = await prisma.account.findMany({
            where: { ownerId: user.id },
            orderBy: { createdAt: "asc" },
        });
    }

    return NextResponse.json({ accounts });
}

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const body = await req.json();
    const parsed = createAccountSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name, type, balance, color, icon } = parsed.data;

    const existing = await prisma.account.findUnique({
        where: { ownerId_name: { ownerId: user.id, name } },
    });
    if (existing) {
        return NextResponse.json({ error: "An account with this name already exists" }, { status: 400 });
    }

    const account = await prisma.account.create({
        data: {
            ownerId: user.id,
            name,
            type,
            initialBalance: balance,
            balance,
            color,
            icon,
        },
    });

    return NextResponse.json({ account });
}
