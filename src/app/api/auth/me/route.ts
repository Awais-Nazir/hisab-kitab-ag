import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/getCurrentUser";
import { prisma } from "@/lib/prisma";
import { z } from "zod";

const updateProfileSchema = z.object({
    name: z.string().min(1).optional(),
    currency: z.string().min(1).max(10).optional(),
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

    const updated = await prisma.user.update({
        where: { id: user.id },
        data: {
            name: parsed.data.name ?? user.name,
            currency: parsed.data.currency ?? user.currency,
        },
    });

    if (parsed.data.name && user.selfPersonId) {
        await prisma.person.update({
            where: { id: user.selfPersonId },
            data: { name: parsed.data.name },
        });
    }

    return NextResponse.json({
        user: {
            id: updated.id,
            email: updated.email,
            name: updated.name,
            currency: updated.currency,
            selfPersonId: updated.selfPersonId,
        },
    });
}