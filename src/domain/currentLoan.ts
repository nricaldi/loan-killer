import { addMonths } from './dates'
import type { Loan } from './loan'

// Saved amounts are the user's working balances. Rebase the forecast, without
// inventing payments or interest transactions since their last visit.
export function currentLoan<T extends Pick<Loan, 'nextPaymentDate'>>(loan: T, date: string): T {
  let months = 0
  let nextPaymentDate = loan.nextPaymentDate
  while (nextPaymentDate < date) {
    nextPaymentDate = addMonths(loan.nextPaymentDate, ++months)
  }
  return { ...loan, balanceDate: date, nextPaymentDate }
}
