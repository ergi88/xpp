import { accountsApi } from '@/api/accounts'
import { debtsApi } from '@/api/debts'
import type { Transaction } from '@/types'

type Sign = 1 | -1

export async function applyTransactionEffects(
  txn: Transaction,
  sign: Sign,
): Promise<void> {
  // Split children do not touch account balance — the parent already does.
  const touchesAccount = !txn.parentId

  if (touchesAccount) {
    if (txn.type === 'income') {
      await accountsApi.updateBalance(txn.account.id, txn.amount * sign)
    } else if (txn.type === 'expense') {
      await accountsApi.updateBalance(txn.account.id, -txn.amount * sign)
    } else if (txn.type === 'transfer') {
      const toAmount = txn.toAmount ?? txn.amount
      await accountsApi.updateBalance(txn.account.id, -txn.amount * sign)
      if (txn.toAccount) {
        await accountsApi.updateBalance(txn.toAccount.id, toAmount * sign)
      }
    }
  }

  if (txn.debtId) {
    // Positive delta = more paid = remaining debt decreases.
    await debtsApi.updateBalance(txn.debtId, txn.amount * sign)
  }
}
