import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

const updateWorkspaceSchema = z.object({
    name: z.string().min(1).max(60),
});

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id } = await params;
    const workspace = await prisma.workspace.findUnique({
        where: { id },
        include: {
            members: {
                include: { person: true },
            },
        },
    });

    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    return NextResponse.json({ workspace });
}

export async function PATCH(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id } = await params;
    const workspace = await prisma.workspace.findUnique({ where: { id } });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    const body = await req.json();
    const parsed = updateWorkspaceSchema.safeParse(body);
    if (!parsed.success) {
        return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const updated = await prisma.workspace.update({
        where: { id },
        data: { name: parsed.data.name.trim() },
    });

    return NextResponse.json({ workspace: updated });
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { id } = await params;
    const workspace = await prisma.workspace.findUnique({ where: { id } });
    if (!workspace || workspace.ownerId !== user.id) {
        return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }

    await prisma.$transaction([
        prisma.expensePayment.deleteMany({ where: { expense: { workspaceId: id } } }),
        prisma.expenseSplit.deleteMany({ where: { expense: { workspaceId: id } } }),
        prisma.expense.deleteMany({ where: { workspaceId: id } }),
        prisma.settlement.deleteMany({ where: { workspaceId: id } }),
        prisma.workspaceMember.deleteMany({ where: { workspaceId: id } }),
        prisma.workspace.delete({ where: { id } }),
    ]);

    return NextResponse.json({ success: true });
}
