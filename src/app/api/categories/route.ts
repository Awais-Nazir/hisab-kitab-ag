import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const categorySchema = z.object({
    name: z.string().min(1).max(40),
    budget: z.number().positive().optional(),
    icon: z.string().optional(),
    color: z.string().optional(),
});

export async function GET() {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const categories = await prisma.category.findMany({
        where: { ownerId: user.id },
        orderBy: { name: "asc" },
    });

    return NextResponse.json({ categories });
}

export async function POST(req: NextRequest) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const body = await req.json();
    const parsed = categorySchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name, budget, icon, color } = parsed.data;

    const existing = await prisma.category.findUnique({
        where: { ownerId_name: { ownerId: user.id, name } },
    });
    if (existing) {
        // Update budget if provided
        const updated = await prisma.category.update({
            where: { id: existing.id },
            data: {
                budget: budget ?? existing.budget,
                icon: icon ?? existing.icon,
                color: color ?? existing.color,
            },
        });
        return NextResponse.json({ category: updated });
    }

    const category = await prisma.category.create({
        data: {
            ownerId: user.id,
            name,
            budget: budget ?? 1000,
            icon: icon ?? "tag",
            color: color ?? "#0F5C53",
        },
    });

    return NextResponse.json({ category });
}