import { daysBetween } from './dates'
import { projectLoan } from './loan'
import { oneTimePaymentAvailability } from './oneTimePayment'
import { summarizePortfolio, validatePortfolio, type LoanRecord } from './portfolio'

// Pay every included loan today; accrue interest separately before allocating.
export function payoffToday(loans: readonly LoanRecord[], date: string) {
  const unavailable = oneTimePaymentAvailability(loans, date)
  if (unavailable) throw new Error(unavailable)
  validatePortfolio(loans)
  const allocations = loans.map(loan => ({
    loanId: loan.id, loanName: loan.name,
    amountCents: loan.principalCents + loan.accruedInterestCents
      + Math.round(loan.principalCents * loan.annualRatePercent / 100 * daysBetween(loan.balanceDate, date) / 365),
  }))
  const totalCents = allocations.reduce((sum, item) => sum + item.amountCents, 0)
  if (totalCents > 1_000_000_000) throw new Error('The full payoff exceeds the supported one-time payment limit.')
  const portfolio = summarizePortfolio(loans.map((loan, index) => ({ loan, projection: projectLoan(loan, { date, amountCents: allocations[index]!.amountCents }) })))!
  return { totalCents, allocations, portfolio }
}
