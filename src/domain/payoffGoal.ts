import { addMonths, parseDate } from './dates'
import { oneTimePaymentAvailability } from './oneTimePayment'
import { payoffToday } from './payoffToday'
import { recommendPayments } from './paymentRecommendations'
import { projectPortfolio, type LoanRecord } from './portfolio'
import { createRecurringPaymentCalendar, createRecurringPaymentProjector } from './recurringPayments'

export interface PayoffGoalRequest {
  date: string
  goalMonth: string
  oneTimeCents: number
  extraMonthlyHintCents?: number
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
export function* payoffGoalSearch(loans: readonly LoanRecord[], request: PayoffGoalRequest): Generator<void, { extraMonthlyCents: number; payoffDate: string; oneTimeCents?: number } | null> {
  const deadline = goalMonthEnd(request.goalMonth)
  if (!loans.length || deadline < request.date) return null
  const unavailable = oneTimePaymentAvailability(loans, request.date)
  if (unavailable) throw new Error(unavailable)
  if (request.goalMonth === request.date.slice(0, 7)) {
    const quote = payoffToday(loans, request.date)
    return { extraMonthlyCents: 0, payoffDate: request.date, oneTimeCents: quote.totalCents }
  }
  if (request.oneTimeCents > 0) {
    try {
      const quote = payoffToday(loans, request.date)
      if (request.oneTimeCents >= quote.totalCents) return { extraMonthlyCents: 0, payoffDate: request.date, oneTimeCents: request.oneTimeCents }
    } catch { /* A later goal may still fit the monthly limit when a full lump sum does not. */ }
  }
  const calendar = createRecurringPaymentCalendar(loans)
  const cache = new Map<number, boolean>()
  const targets = request.oneTimeCents > 0 ? [...loans].sort((a, b) => a.id.localeCompare(b.id)) : [undefined]
  const strategies = loans.length === 1 ? ['highest-rate'] as const : ['highest-rate', 'smallest-balance'] as const
  // During bracketing we only need to know whether any supported allocation
  // reaches the deadline. Avoid building baseline/comparison/ranking results for
  // every candidate, and stop as soon as a feasible allocation is found.
  function* meets(cents: number): Generator<void, boolean> {
    if (cache.has(cents)) return cache.get(cents)!
    const project = createRecurringPaymentProjector(loans, cents, false, calendar)
    for (const target of targets) {
      const payment = target ? { loanId: target.id, amountCents: request.oneTimeCents, date: request.date } : undefined
      for (const strategy of strategies) {
        const projection = project(payment, strategy)!.projection
        const fits = projection.status === 'paid-off' && projection.payoffDate <= deadline
        yield
        if (fits) { cache.set(cents, true); return true }
        if (cents === 0) break // Strategies cannot change a minimum-only schedule.
      }
    }
    cache.set(cents, false)
    return false
  }
  function result(cents: number) {
    // Rank the final verified budget normally so the reported date matches the
    // lowest-interest deadline-compatible plan actually displayed by the UI.
    if (cents === 0 && request.oneTimeCents === 0) {
      const projection = projectPortfolio(loans)!.projection
      return projection.status === 'paid-off' ? { extraMonthlyCents: 0, payoffDate: projection.payoffDate } : null
    }
    const plans = recommendPayments(loans, { date: request.date, oneTimeCents: request.oneTimeCents, extraMonthlyCents: cents, payoffBy: deadline, rollFreedMinimums: false }, calendar).plans
    const date = plans[cents > 0 ? request.oneTimeCents > 0 ? 'combined' : 'monthly' : 'one-time']?.option.payoffDate
    return date && date <= deadline ? { extraMonthlyCents: cents, payoffDate: date } : null
  }
  const zeroMeets = yield* meets(0)
  if (zeroMeets) return result(0)
  let low = 0
  let high = 10000
  const limit = 1_000_000_000
  const hint = request.extraMonthlyHintCents
  if (hint !== undefined && Number.isSafeInteger(hint) && hint >= 0 && hint <= limit) {
    // Use a small budget-derived band for nearby months; every bound is still
    // checked against real schedules before the usual cent-accurate search.
    const months = Math.max(1, (Number(deadline.slice(0, 4)) - Number(request.date.slice(0, 4))) * 12 + Number(deadline.slice(5, 7)) - Number(request.date.slice(5, 7)))
    const budget = loans.reduce((sum, loan) => sum + loan.monthlyPaymentCents, hint)
    const band = Math.max(8, Math.ceil(budget / months * 2))
    low = Math.max(0, hint - band)
    let lowerMeets = false
    if (low > 0) { lowerMeets = yield* meets(low) }
    if (lowerMeets) { high = low; low = 0 }
    else {
      high = Math.min(limit, hint + band)
      while (true) {
        const highMeets = yield* meets(high)
        if (highMeets) break
        if (high === limit) return null
        low = high
        high = Math.min(limit, Math.max(high + band, high * 2))
      }
    }
  } else {
    while (true) {
      const highMeets = yield* meets(high)
      if (highMeets) break
      if (high === limit) return null
      low = high
      high = Math.min(limit, high * 2)
    }
  }
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2)
    const middleMeets = yield* meets(middle)
    if (middleMeets) high = middle
    else low = middle
  }
  return result(high)
}

export function monthlyExtraForGoal(loans: readonly LoanRecord[], request: PayoffGoalRequest) {
  const search = payoffGoalSearch(loans, request)
  let step = search.next()
  while (!step.done) step = search.next()
  return step.value
}
