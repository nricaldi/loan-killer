import { daysBetween } from './dates'
import { projectLoan, type Loan, type Payment, type Projection, type PaidOffProjection, type OneTimePayment } from './loan'

export interface TargetedOneTimePayment extends OneTimePayment {
  loanId: string
}

export interface LoanRecord extends Loan {
  id: string
  fromExample: boolean
}

export interface ProjectedLoan {
  loan: LoanRecord
  projection: Projection
}

export interface PortfolioProjection {
  loans: ProjectedLoan[]
  balanceDate: string
  principalCents: number
  accruedInterestCents: number
  monthlyPaymentCents: number
  annualInterestCents: number
  weightedRatePercent: number | null
  projection: Projection
}

function combineSchedules(loans: ProjectedLoan[]): PaidOffProjection {
  const events = new Map<string, { loanIndex: number; payment: Payment }[]>()
  for (const [loanIndex, { projection }] of loans.entries()) {
    for (const payment of projection.schedule) {
      const payments = events.get(payment.date) ?? []
      payments.push({ loanIndex, payment })
      events.set(payment.date, payments)
    }
  }

  const states = loans.map(({ loan }) => ({
    date: loan.balanceDate,
    principalCents: loan.principalCents,
    accruedInterestCents: loan.accruedInterestCents,
  }))
  const schedule: Payment[] = []
  let previousBalance = loans.reduce((sum, { loan }) => sum + loan.principalCents + loan.accruedInterestCents, 0)

  for (const [date, payments] of [...events].sort(([left], [right]) => left.localeCompare(right))) {
    let paymentCents = 0
    let interestPaidCents = 0
    let principalPaidCents = 0
    for (const { loanIndex, payment } of payments) {
      states[loanIndex] = payment
      paymentCents += payment.paymentCents
      interestPaidCents += payment.interestPaidCents
      principalPaidCents += payment.principalPaidCents
    }

    let principalCents = 0
    let accruedInterestCents = 0
    for (const [index, { loan }] of loans.entries()) {
      const state = states[index]
      if (!state) throw new Error('Missing loan state.')
      principalCents += state.principalCents
      // Other loans accrue interest even when only one loan makes a payment today.
      accruedInterestCents += state.accruedInterestCents + Math.round(
        state.principalCents * loan.annualRatePercent / 100 * daysBetween(state.date, date) / 365,
      )
    }
    const balanceCents = principalCents + accruedInterestCents
    let kind: Payment['kind'] = 'combined'
    if (payments.every(({ payment }) => payment.kind === 'scheduled')) kind = 'scheduled'
    else if (payments.every(({ payment }) => payment.kind === 'extra')) kind = 'extra'
    else if (payments.every(({ payment }) => payment.kind === 'monthly-extra')) kind = 'monthly-extra'
    schedule.push({
      kind,
      date,
      paymentCents,
      newInterestCents: balanceCents - previousBalance + paymentCents,
      interestPaidCents,
      principalPaidCents,
      principalCents,
      accruedInterestCents,
      balanceCents,
    })
    previousBalance = balanceCents
  }

  let paymentCount = 0
  let futureInterestCents = 0
  let remainingInterestCents = 0
  let totalPaymentsCents = 0
  for (const { projection } of loans) {
    if (projection.status !== 'paid-off') throw new Error('Only complete schedules can be combined.')
    paymentCount += projection.paymentCount
    futureInterestCents += projection.futureInterestCents
    remainingInterestCents += projection.remainingInterestCents
    totalPaymentsCents += projection.totalPaymentsCents
  }
  const lastPayment = schedule.at(-1)
  if (!lastPayment) throw new Error('A payoff projection must include a payment.')

  return {
    status: 'paid-off',
    schedule,
    payoffDate: lastPayment.date,
    paymentCount,
    futureInterestCents,
    remainingInterestCents,
    totalPaymentsCents,
  }
}

export function validatePortfolio(records: readonly LoanRecord[]): void {
  const first = records[0]
  if (!first) return
  if (records.some((loan) => loan.balanceDate !== first.balanceDate)) {
    throw new Error('Use the same balance date for every loan in a combined estimate.')
  }
  if (new Set(records.map((loan) => loan.id)).size !== records.length) {
    throw new Error('Every loan needs a unique ID.')
  }
}

export function projectPortfolio(records: readonly LoanRecord[], extraPayment?: TargetedOneTimePayment): PortfolioProjection | null {
  if (!records.length) return null
  validatePortfolio(records)
  if (extraPayment && !records.some((loan) => loan.id === extraPayment.loanId)) {
    throw new Error('Choose an existing loan for the extra payment.')
  }

  const loans = records.map((loan) => ({
    loan,
    projection: projectLoan(loan, loan.id === extraPayment?.loanId ? extraPayment : undefined),
  }))
  return summarizePortfolio(loans)
}

export function summarizePortfolio(loans: ProjectedLoan[]): PortfolioProjection | null {
  const records = loans.map(({ loan }) => loan)
  const first = records[0]
  if (!first) return null
  const principalCents = records.reduce((sum, loan) => sum + loan.principalCents, 0)
  const accruedInterestCents = records.reduce((sum, loan) => sum + loan.accruedInterestCents, 0)
  const monthlyPaymentCents = records.reduce((sum, loan) => sum + loan.monthlyPaymentCents, 0)
  const annualInterestCents = records.reduce((sum, loan) => sum + loan.principalCents * loan.annualRatePercent / 100, 0)
  const blockedLoans = loans.filter(({ projection }) => projection.status !== 'paid-off')
  const singleLoan = loans.length === 1 ? loans[0] : undefined
  let projection: Projection
  if (singleLoan) {
    projection = singleLoan.projection
  } else if (blockedLoans.length) {
    projection = {
      status: blockedLoans.some(({ projection }) => projection.status === 'insufficient-payment')
        ? 'insufficient-payment'
        : 'projection-limit',
      schedule: [],
    }
  } else {
    projection = combineSchedules(loans)
  }

  return {
    loans,
    balanceDate: first.balanceDate,
    principalCents,
    accruedInterestCents,
    monthlyPaymentCents,
    annualInterestCents,
    weightedRatePercent: principalCents ? annualInterestCents / principalCents * 100 : null,
    projection,
  }
}
