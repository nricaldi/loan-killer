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

// Yield after each schedule evaluation so a worker failure can use the same
// search cooperatively on the main thread, without one long blocking task.
export function* payoffGoalSearch(loans: readonly LoanRecord[], request: PayoffGoalRequest): Generator<void, { extraMonthlyCents: number; payoffDate: string } | null> {
  const deadline = goalMonthEnd(request.goalMonth)
  if (!loans.length || deadline < request.date) return null
  const unavailable = oneTimePaymentAvailability(loans, request.date)
  if (unavailable) throw new Error(unavailable)
  const cache = new Map<number, string | null>()
  function payoff(cents: number): string | null {
    if (cache.has(cents)) return cache.get(cents)!
    let date: string | null
    if (cents === 0 && request.oneTimeCents === 0) {
      const projection = projectPortfolio(loans)!.projection
      date = projection.status === 'paid-off' ? projection.payoffDate : null
    } else {
      const plans = recommendPayments(loans, { date: request.date, oneTimeCents: request.oneTimeCents, extraMonthlyCents: cents, payoffBy: deadline, rollFreedMinimums: false }).plans
      date = plans[cents > 0 ? request.oneTimeCents > 0 ? 'combined' : 'monthly' : 'one-time']?.option.payoffDate ?? null
    }
    cache.set(cents, date)
    return date
  }
  const meets = (cents: number) => { const date = payoff(cents); return date !== null && date <= deadline }
  const zeroMeets = meets(0)
  yield
  if (zeroMeets) return { extraMonthlyCents: 0, payoffDate: payoff(0)! }
  let low = 0
  let high = 10000
  const limit = 1_000_000_000
  while (true) {
    const highMeets = meets(high)
    yield
    if (highMeets) break
    if (high === limit) return null
    low = high
    high = Math.min(limit, high * 2)
  }
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    const middleMeets = meets(middle)
    yield
    if (middleMeets) high = middle
    else low = middle
  }
  return { extraMonthlyCents: high, payoffDate: payoff(high)! }
}

export function monthlyExtraForGoal(loans: readonly LoanRecord[], request: PayoffGoalRequest) {
  const search = payoffGoalSearch(loans, request)
  let step = search.next()
  while (!step.done) step = search.next()
  return step.value
}
