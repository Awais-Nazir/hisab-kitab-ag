import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";
import { reconcileAccount } from "@/lib/account-balance";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ batchId: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { batchId } = await params;

    const rows = await prisma.settlement.findMany({
        where: { batchId },
        include: { workspace: true, fromPerson: true, toPerson: true },
    });
    if (
        rows.length === 0 ||
        rows.some(
            (r) =>
                (r.workspace && r.workspace.ownerId !== user.id) ||
                (!r.workspace && r.fromPerson.ownerId !== user.id && r.toPerson.ownerId !== user.id)
        )
    ) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const accountIds = Array.from(
        new Set(rows.map((r) => r.accountId).filter(Boolean) as string[])
    );

    await prisma.$transaction(async (tx) => {
        await tx.settlement.deleteMany({ where: { batchId } });
        for (const accId of accountIds) {
            await reconcileAccount(accId, tx);
        }
    });

    return NextResponse.json({ success: true });
}