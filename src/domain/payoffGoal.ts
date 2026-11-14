import { addMonths, parseDate } from './dates'
import { oneTimePaymentAvailability } from './oneTimePayment'
import { recommendPayments } from './paymentRecommendations'
import { projectPortfolio, type LoanRecord } from './portfolio'

export interface PayoffGoalRequest {
  date: string
  goalMonth: string
  oneTimeCents: number
}

export function goalMonthEnd(month: string): string {
  const first = parseDate(`${month}-01`)
  if (!first) throw new Error('Choose a valid payoff month.')
  const next = parseDate(addMonths(`${month}-01`, 1))!
  next.setUTCDate(next.getUTCDate() - 1)
  return next.toISOString().slice(0, 10)
}

// Search whole-dollar monthly extras against real schedules. The goal constrains
// the recommendation, so a cheaper but later alternative cannot miss the date.
export function monthlyExtraForGoal(loans: readonly LoanRecord[], request: PayoffGoalRequest) {
  const deadline = goalMonthEnd(request.goalMonth)
  if (!loans.length || deadline < request.date) return null
  const unavailable = oneTimePaymentAvailability(loans, request.date)
  if (unavailable) throw new Error(unavailable)
  const cache = new Map<number, string | null>()
  function payoff(dollars: number): string | null {
    if (cache.has(dollars)) return cache.get(dollars)!
    let date: string | null
    if (dollars === 0 && request.oneTimeCents === 0) {
      const projection = projectPortfolio(loans)!.projection
      date = projection.status === 'paid-off' ? projection.payoffDate : null
    } else {
      const plans = recommendPayments(loans, { date: request.date, oneTimeCents: request.oneTimeCents, extraMonthlyCents: dollars * 100, payoffBy: deadline }).plans
      date = plans[dollars > 0 ? request.oneTimeCents > 0 ? 'combined' : 'monthly' : 'one-time']?.option.payoffDate ?? null
    }
    cache.set(dollars, date)
    return date
  }
  const meets = (dollars: number) => { const date = payoff(dollars); return date !== null && date <= deadline }
  if (meets(0)) return { extraMonthlyCents: 0, payoffDate: payoff(0)! }
  let low = 0
  let high = 100
  const limit = 10_000_000
  while (!meets(high)) {
    if (high === limit) return null
    low = high
    high = Math.min(limit, high * 2)
  }
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    if (meets(middle)) high = middle
    else low = middle
  }
  return { extraMonthlyCents: high * 100, payoffDate: payoff(high)! }
}
