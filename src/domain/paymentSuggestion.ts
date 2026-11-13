import { addMonths } from './dates'
import { projectLoan, type Loan } from './loan'

export interface PaymentSuggestion {
  amountCents: number
  payoffDate: string
  tenYear: boolean
}
const cache = new Map<string, PaymentSuggestion | null>()
const MAX_PAYMENT = 1_000_000_000

// This is a modeled payoff goal, not a claim about the servicer's required
// minimum. Search the actual cent-rounded schedule, then round up to a dollar.
export function suggestMonthlyPayment(loan: Loan): PaymentSuggestion | null {
  const key = JSON.stringify([loan.principalCents, loan.accruedInterestCents, loan.annualRatePercent, loan.balanceDate, loan.nextPaymentDate])
  if (cache.has(key)) return cache.get(key)!
  const horizon = addMonths(loan.balanceDate, 120)
  const project = (amountCents: number) => projectLoan({ ...loan, monthlyPaymentCents: amountCents })
  const maximum = project(MAX_PAYMENT)
  let suggestion: PaymentSuggestion | null = null
  if (maximum.status === 'paid-off') {
    const tenYear = maximum.payoffDate <= horizon
    const meetsGoal = (amountCents: number) => {
      const result = project(amountCents)
      return result.status === 'paid-off' && (!tenYear || result.payoffDate <= horizon)
    }
    let low = 1
    let high = MAX_PAYMENT
    while (low < high) {
      const middle = Math.floor((low + high) / 2)
      if (meetsGoal(middle)) high = middle
      else low = middle + 1
    }
    const amountCents = Math.min(MAX_PAYMENT, Math.ceil(low / 100) * 100)
    const result = project(amountCents)
    if (result.status === 'paid-off') suggestion = { amountCents, payoffDate: result.payoffDate, tenYear }
  }
  if (cache.size >= 64) cache.delete(cache.keys().next().value!)
  cache.set(key, suggestion)
  return suggestion
}
