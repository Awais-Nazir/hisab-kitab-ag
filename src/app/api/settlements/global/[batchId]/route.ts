import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireUser } from "@/lib/requireUser";

export async function DELETE(
    req: NextRequest,
    { params }: { params: Promise<{ batchId: string }> }
) {
    const { user, errorResponse } = await requireUser();
    if (!user) return errorResponse;

    const { batchId } = await params;

    const rows = await prisma.settlement.findMany({
        where: { batchId },
        include: { workspace: true },
    });
    if (rows.length === 0 || rows.some((r) => r.workspace.ownerId !== user.id)) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
        // Revert any account adjustments made by settlements in this batch
        for (const r of rows) {
            if (r.accountId) {
                if (r.fromPersonId === user.selfPersonId) {
                    // User was payer (account decremented) -> increment back
                    await tx.account.update({
                        where: { id: r.accountId },
                        data: { balance: { increment: r.amount } },
                    });
                } else if (r.toPersonId === user.selfPersonId) {
                    // User was receiver (account incremented) -> decrement back
                    await tx.account.update({
                        where: { id: r.accountId },
                        data: { balance: { decrement: r.amount } },
                    });
                }
            }
        }
        await tx.settlement.deleteMany({ where: { batchId } });
    });

    return NextResponse.json({ success: true });
}