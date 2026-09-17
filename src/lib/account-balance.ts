import { prisma as defaultPrisma } from "./prisma";

type PrismaTx = any;

/**
 * Recalculates and updates the exact balance of an account from its immutable ledger entries:
 *   Balance = Initial Balance
 *           + Deposits
 *           + Transfers In
 *           - Transfers Out
 *           - Expenses paid from this account (personal or user's payment share in shared expenses)
 *           - Settlements paid by user from this account
 *           + Settlements received by user into this account
 *           - Udhar given from this account (LENA)
 *           + Udhar taken into this account (DENA)
 *           + Udhar settled into this account (LENA settled)
 *           - Udhar settled out from this account (DENA settled)
 */
export async function reconcileAccount(
  accountId: string | null | undefined,
  tx?: PrismaTx
): Promise<number | null> {
  if (!accountId) return null;
  const db = tx || defaultPrisma;

  const account = await db.account.findUnique({
    where: { id: accountId },
    select: { id: true, ownerId: true, initialBalance: true },
  });

  if (!account) return null;

  const user = await db.user.findUnique({
    where: { id: account.ownerId },
    select: { selfPersonId: true },
  });

  const selfPersonId = user?.selfPersonId;

  // 1. Initial Balance
  const initialBalance = Number(account.initialBalance || 0);

  // 2. Deposits
  const depositsAgg = await db.accountDeposit.aggregate({
    where: { accountId },
    _sum: { amount: true },
  });
  const sumDeposits = Number(depositsAgg._sum.amount || 0);

  // 3. Transfers In
  const tfToAgg = await db.accountTransfer.aggregate({
    where: { toAccountId: accountId },
    _sum: { amount: true },
  });
  const sumTfTo = Number(tfToAgg._sum.amount || 0);

  // 4. Transfers Out
  const tfFromAgg = await db.accountTransfer.aggregate({
    where: { fromAccountId: accountId },
    _sum: { amount: true },
  });
  const sumTfFrom = Number(tfFromAgg._sum.amount || 0);

  // 5. Expenses linked to this account
  const expenses = await db.expense.findMany({
    where: { accountId },
    select: {
      amount: true,
      payments: {
        select: {
          personId: true,
          amountPaid: true,
        },
      },
    },
  });

  let sumExpenses = 0;
  for (const exp of expenses) {
    if (exp.payments && exp.payments.length > 0) {
      if (selfPersonId) {
        const selfPayment = exp.payments.find((p: any) => p.personId === selfPersonId);
        if (selfPayment) {
          sumExpenses += Number(selfPayment.amountPaid);
        }
      }
    } else {
      sumExpenses += Number(exp.amount);
    }
  }

  // 6. Settlements
  let sumSettlementsPaid = 0;
  let sumSettlementsReceived = 0;

  if (selfPersonId) {
    const sPaidAgg = await db.settlement.aggregate({
      where: { accountId, fromPersonId: selfPersonId },
      _sum: { amount: true },
    });
    sumSettlementsPaid = Number(sPaidAgg._sum.amount || 0);

    const sRecAgg = await db.settlement.aggregate({
      where: { accountId, toPersonId: selfPersonId },
      _sum: { amount: true },
    });
    sumSettlementsReceived = Number(sRecAgg._sum.amount || 0);
  }

  // 7. Udhar
  const udharGivenAgg = await db.udharEntry.aggregate({
    where: { accountId, type: "LENA" },
    _sum: { amount: true },
  });
  const sumUdharGiven = Number(udharGivenAgg._sum.amount || 0);

  const udharTakenAgg = await db.udharEntry.aggregate({
    where: { accountId, type: "DENA" },
    _sum: { amount: true },
  });
  const sumUdharTaken = Number(udharTakenAgg._sum.amount || 0);

  const udharSettledInAgg = await db.udharEntry.aggregate({
    where: { settleAccountId: accountId, type: "LENA", isSettled: true },
    _sum: { amount: true },
  });
  const sumUdharSettledIn = Number(udharSettledInAgg._sum.amount || 0);

  const udharSettledOutAgg = await db.udharEntry.aggregate({
    where: { settleAccountId: accountId, type: "DENA", isSettled: true },
    _sum: { amount: true },
  });
  const sumUdharSettledOut = Number(udharSettledOutAgg._sum.amount || 0);

  // Compute exact balance
  const rawBalance =
    initialBalance +
    sumDeposits +
    sumTfTo -
    sumTfFrom -
    sumExpenses -
    sumSettlementsPaid +
    sumSettlementsReceived -
    sumUdharGiven +
    sumUdharTaken +
    sumUdharSettledIn -
    sumUdharSettledOut;

  // Round to 2 decimal places to avoid floating point precision issues
  const calculatedBalance = Math.round(rawBalance * 100) / 100;

  await db.account.update({
    where: { id: accountId },
    data: { balance: calculatedBalance },
  });

  return calculatedBalance;
}

/**
 * Reconciles all accounts for a specific user
 */
export async function reconcileUserAccounts(
  userId: string,
  tx?: PrismaTx
): Promise<Record<string, number>> {
  const db = tx || defaultPrisma;
  const accounts = await db.account.findMany({
    where: { ownerId: userId },
    select: { id: true, name: true },
  });

  const result: Record<string, number> = {};
  for (const acc of accounts) {
    const bal = await reconcileAccount(acc.id, db);
    if (bal !== null) {
      result[acc.name] = bal;
    }
  }

  return result;
}
