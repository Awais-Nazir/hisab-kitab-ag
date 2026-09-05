import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateProfileSchema = z.object({
    name: z.string().min(1).optional(),
    currency: z.string().min(1).max(10).optional(),
    image: z.string().nullable().optional(),
});

export async function GET() {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ user: null }, { status: 401 });
    }
    return NextResponse.json({
        user: {
            id: user.id,
            email: user.email,
            name: user.name,
            image: user.image || null,
            currency: user.currency || "PKR",
            selfPersonId: user.selfPersonId,
        },
    });
}

export async function PATCH(req: NextRequest) {
    const user = await getCurrentUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name: newName, currency: newCurrency, image: newImage } = parsed.data;

    const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
            name: newName ?? user.name,
            currency: newCurrency ?? user.currency,
            ...(newImage !== undefined ? { image: newImage } : {}),
        },
    });

    if (user.selfPersonId && (newName !== undefined || newImage !== undefined)) {
        await prisma.person.update({
            where: { id: user.selfPersonId },
            data: {
                ...(newName ? { name: newName } : {}),
                ...(newImage !== undefined ? { image: newImage } : {}),
            },
        });
    }

    return NextResponse.json({
        user: {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            image: updated.image || null,
            currency: updated.currency,
            selfPersonId: updated.selfPersonId,
        },
    });
}