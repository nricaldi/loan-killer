import { addMonths } from './dates'
import { balanceAtDate, calculatePayment, validateLoan, type LoanBalance, type Payment, type Projection } from './loan'
import {
  projectPortfolio,
  summarizePortfolio,
  validatePortfolio,
  type LoanRecord,
  type PortfolioProjection,
  type TargetedOneTimePayment,
} from './portfolio'
import { oneTimePaymentAvailability } from './oneTimePayment'

export type RepaymentStrategy = 'highest-rate' | 'smallest-balance'

export const strategyNames: Record<RepaymentStrategy, string> = {
  'highest-rate': 'Highest rate first',
  'smallest-balance': 'Smallest balance first',
}

export function validateRepaymentStrategy(strategy: string): asserts strategy is RepaymentStrategy {
  if (strategy !== 'highest-rate' && strategy !== 'smallest-balance') {
    throw new Error('Choose highest rate first or smallest balance first.')
  }
}

interface DueDate {
  loans: number[]
  extraMonthly: boolean
}

interface LoanLedger {
  loan: LoanRecord
  balance: LoanBalance
  schedule: Payment[]
}

export function recurringStartDate(loans: readonly LoanRecord[]): string | null {
  return loans.reduce<string | null>((first, loan) => first === null || loan.nextPaymentDate < first ? loan.nextPaymentDate : first, null)
}

export function projectRecurringPayments(
  loans: readonly LoanRecord[],
  extraMonthlyCents: number,
  extraPayment?: TargetedOneTimePayment,
  strategy: RepaymentStrategy = 'highest-rate',
): PortfolioProjection | null {
  validateRepaymentStrategy(strategy)
  if (!Number.isSafeInteger(extraMonthlyCents) || extraMonthlyCents < 0 || extraMonthlyCents > 1_000_000_000) {
    throw new Error('The extra monthly amount must be in whole cents between $0 and $10,000,000.')
  }
  if (!loans.length) return null
  if (extraMonthlyCents === 0) return projectPortfolio(loans, extraPayment)
  validatePortfolio(loans)
  loans.forEach(validateLoan)
  if (extraPayment) {
    const unavailable = oneTimePaymentAvailability(loans, extraPayment.date)
    if (unavailable) throw new Error(unavailable)
    if (!loans.some((loan) => loan.id === extraPayment.loanId)) throw new Error('Choose an existing loan for the extra payment.')
    if (!Number.isSafeInteger(extraPayment.amountCents) || extraPayment.amountCents < 0 || extraPayment.amountCents > 1_000_000_000) {
      throw new Error('The extra payment must be in whole cents between $0 and $10,000,000.')
    }
  }

  const firstExtraDate = recurringStartDate(loans)
  if (!firstExtraDate) return null
  const events = new Map<string, DueDate>()
  function eventOn(date: string): DueDate {
    let event = events.get(date)
    if (!event) {
      event = { loans: [], extraMonthly: false }
      events.set(date, event)
    }
    return event
  }
  for (let month = 0; month < 1_200; month++) {
    eventOn(addMonths(firstExtraDate, month)).extraMonthly = true
    loans.forEach((loan, index) => eventOn(addMonths(loan.nextPaymentDate, month)).loans.push(index))
  }
  if (extraPayment && extraPayment.amountCents > 0) eventOn(extraPayment.date)

  const ledgers: LoanLedger[] = loans.map((loan) => ({
    loan,
    balance: { date: loan.balanceDate, principalCents: loan.principalCents, accruedInterestCents: loan.accruedInterestCents },
    schedule: [],
  }))
  function pay(ledger: LoanLedger, date: string, amount: number, kind: Payment['kind']): number {
    if (amount <= 0 || ledger.balance.principalCents + ledger.balance.accruedInterestCents === 0) return 0
    const payment = calculatePayment(ledger.loan, ledger.balance, date, amount, kind)
    ledger.schedule.push(payment)
    ledger.balance = payment
    return payment.paymentCents
  }

  for (const [date, event] of [...events].sort(([left], [right]) => left.localeCompare(right))) {
    if (extraPayment && date === extraPayment.date && extraPayment.amountCents > 0) {
      const target = ledgers.find(({ loan }) => loan.id === extraPayment.loanId)
      if (!target) throw new Error('Missing extra payment target.')
      pay(target, date, extraPayment.amountCents, 'extra')
    }

    let extraBudget = event.extraMonthly ? extraMonthlyCents : 0
    // Reserve every minimum due today before allocating any extra or freed minimum.
    for (const index of event.loans) {
      const ledger = ledgers[index]
      if (!ledger) throw new Error('Missing loan ledger.')
      const used = pay(ledger, date, ledger.loan.monthlyPaymentCents, 'scheduled')
      extraBudget += ledger.loan.monthlyPaymentCents - used
    }
    // Snowball priorities use today's balances after minimums, not the initial loan sizes.
    const priority = ledgers
      .filter(({ balance }) => balance.principalCents + balance.accruedInterestCents > 0)
      .map((ledger) => ({ ledger, balanceCents: balanceAtDate(ledger.loan, ledger.balance, date) }))
      .sort((left, right) => (strategy === 'highest-rate'
        ? right.ledger.loan.annualRatePercent - left.ledger.loan.annualRatePercent
        : left.balanceCents - right.balanceCents)
        || left.ledger.loan.id.localeCompare(right.ledger.loan.id))
    for (const { ledger } of priority) {
      if (extraBudget <= 0) break
      if (balanceAtDate(ledger.loan, ledger.balance, date) > 0) {
        extraBudget -= pay(ledger, date, extraBudget, 'monthly-extra')
      }
    }
    if (ledgers.every(({ balance }) => balance.principalCents + balance.accruedInterestCents === 0)) break
  }

  return summarizePortfolio(ledgers.map(({ loan, balance, schedule }) => {
    const lastPayment = schedule.at(-1)
    let projection: Projection = { status: 'projection-limit', schedule }
    if (balance.principalCents + balance.accruedInterestCents === 0 && lastPayment) {
      const futureInterestCents = schedule.reduce((sum, payment) => sum + payment.newInterestCents, 0)
      projection = {
        status: 'paid-off',
        schedule,
        payoffDate: lastPayment.date,
        paymentCount: schedule.length,
        futureInterestCents,
        remainingInterestCents: loan.accruedInterestCents + futureInterestCents,
        totalPaymentsCents: schedule.reduce((sum, payment) => sum + payment.paymentCents, 0),
      }
    }
    return { loan, projection }
  }))
}
