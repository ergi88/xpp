import { accountsApi } from '@/api/accounts'
import { debtsApi, originDirectionSign } from '@/api/debts'
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
    // Direction-aware delta: (expense + i_owe) and (income + owed_to_me)
    // settle the debt → +amount. Opposite direction (lending / weird) grows
    // the debt → -amount. Updates both paid_amount and current_balance.
    const debt = await debtsApi.getById(txn.debtId)
    const directionSign =
      (txn.type === 'expense' && debt.debtType === 'i_owe') ||
      (txn.type === 'income' && debt.debtType === 'owed_to_me')
        ? 1
        : -1
    await debtsApi.updateBalance(txn.debtId, txn.amount * sign * directionSign)
  }

  // Origin TX side-effect: if this TX is the origin of any debt, bump that
  // debt's current_balance (only — paid_amount stays untouched because the
  // origin never had debt_id and doesn't represent a payment).
  if (txn.type !== 'transfer') {
    const allDebts = await debtsApi.getAll({ include_completed: true })
    const ownedDebt = allDebts.find((d) => d.originTransactionId === txn.id)
    if (ownedDebt && ownedDebt.id !== txn.debtId) {
      const direction = originDirectionSign(txn.type, ownedDebt.debtType)
      await debtsApi.updateOriginContribution(
        ownedDebt.id,
        txn.amount * sign * direction,
      )
    }
  }
}
