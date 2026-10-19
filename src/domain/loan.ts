import { addMonths, daysBetween, parseDate } from './dates'

export type LoanType = 'subsidized' | 'unsubsidized'

export interface Loan {
  name: string
  type: LoanType
  principalCents: number
  accruedInterestCents: number
  annualRatePercent: number
  monthlyPaymentCents: number
  balanceDate: string
  nextPaymentDate: string
}

export interface Payment {
  kind: 'scheduled' | 'extra' | 'monthly-extra' | 'combined'
  date: string
  paymentCents: number
  newInterestCents: number
  interestPaidCents: number
  principalPaidCents: number
  principalCents: number
  accruedInterestCents: number
  balanceCents: number
}

export interface PaidOffProjection {
  status: 'paid-off'
  schedule: Payment[]
  payoffDate: string
  paymentCount: number
  futureInterestCents: number
  remainingInterestCents: number
  totalPaymentsCents: number
}

export interface UnpaidProjection {
  status: 'insufficient-payment' | 'projection-limit'
  schedule: Payment[]
}

export type Projection = PaidOffProjection | UnpaidProjection

export interface OneTimePayment {
  date: string
  amountCents: number
}

const MAX_PAYMENTS = 1_200

export function validateLoan(loan: Loan): void {
  for (const amount of [loan.principalCents, loan.accruedInterestCents, loan.monthlyPaymentCents]) {
    if (!Number.isSafeInteger(amount) || amount < 0 || amount > 1_000_000_000) {
      throw new Error('Money must be in whole cents between $0 and $10,000,000.')
    }
  }
  if (loan.principalCents + loan.accruedInterestCents === 0) {
    throw new Error('The loan must have a balance remaining.')
  }
  if (loan.monthlyPaymentCents === 0) throw new Error('The monthly payment must be greater than zero.')
  if (!Number.isFinite(loan.annualRatePercent) || loan.annualRatePercent < 0 || loan.annualRatePercent > 100) {
    throw new Error('The annual interest rate must be between 0% and 100%.')
  }
  const balanceDate = parseDate(loan.balanceDate)
  const paymentDate = parseDate(loan.nextPaymentDate)
  if (!balanceDate || !paymentDate || [balanceDate, paymentDate].some((date) => date.getUTCFullYear() < 1900 || date.getUTCFullYear() > 2100)) {
    throw new Error('Use valid dates between 1900 and 2100.')
  }
  if (daysBetween(loan.balanceDate, loan.nextPaymentDate) < 0) {
    throw new Error('The next payment cannot be before the balance date.')
  }
}

export interface LoanBalance {
  date: string
  principalCents: number
  accruedInterestCents: number
}

export function balanceAtDate(loan: Loan, balance: LoanBalance, date: string): number {
  return balance.principalCents + balance.accruedInterestCents
    + Math.round(balance.principalCents * loan.annualRatePercent / 100 * daysBetween(balance.date, date) / 365)
}

export function calculatePayment(
  loan: Loan,
  balance: LoanBalance,
  date: string,
  amountCents: number,
  kind: Payment['kind'],
): Payment {
  const newInterestCents = Math.round(balance.principalCents * loan.annualRatePercent / 100 * daysBetween(balance.date, date) / 365)
  const accruedInterestCents = balance.accruedInterestCents + newInterestCents
  const paymentCents = Math.min(amountCents, balance.principalCents + accruedInterestCents)
  const interestPaidCents = Math.min(paymentCents, accruedInterestCents)
  const principalPaidCents = paymentCents - interestPaidCents
  return {
    kind,
    date,
    paymentCents,
    newInterestCents,
    interestPaidCents,
    principalPaidCents,
    principalCents: balance.principalCents - principalPaidCents,
    accruedInterestCents: accruedInterestCents - interestPaidCents,
    balanceCents: balance.principalCents + accruedInterestCents - paymentCents,
  }
}

export function projectLoan(loan: Loan, extraPayment?: OneTimePayment): Projection {
  validateLoan(loan)
  if (extraPayment) {
    if (!Number.isSafeInteger(extraPayment.amountCents) || extraPayment.amountCents < 0 || extraPayment.amountCents > 1_000_000_000) {
      throw new Error('The extra payment must be in whole cents between $0 and $10,000,000.')
    }
    if (!parseDate(extraPayment.date) || extraPayment.date < loan.balanceDate || extraPayment.date > loan.nextPaymentDate) {
      throw new Error('The extra payment date must be between the balance date and next payment date.')
    }
  }
  const schedule: Payment[] = []
  let balance: LoanBalance = { date: loan.balanceDate, principalCents: loan.principalCents, accruedInterestCents: loan.accruedInterestCents }
  let futureInterestCents = 0
  let totalPaymentsCents = 0

  function applyPayment(date: string, amountCents: number, kind: Payment['kind']): boolean {
    const payment = calculatePayment(loan, balance, date, amountCents, kind)
    schedule.push(payment)
    balance = payment
    futureInterestCents += payment.newInterestCents
    totalPaymentsCents += payment.paymentCents
    return payment.balanceCents === 0
  }

  function paidOff(date: string): PaidOffProjection {
    return {
      status: 'paid-off',
      schedule,
      payoffDate: date,
      paymentCount: schedule.length,
      futureInterestCents,
      remainingInterestCents: loan.accruedInterestCents + futureInterestCents,
      totalPaymentsCents,
    }
  }

  if (extraPayment && extraPayment.amountCents > 0) {
    if (applyPayment(extraPayment.date, extraPayment.amountCents, 'extra')) return paidOff(extraPayment.date)
  }

  for (let index = 0; index < MAX_PAYMENTS; index++) {
    // Anchor every due date to the original day, so Jan 31 → Feb 28 → Mar 31.
    const date = addMonths(loan.nextPaymentDate, index)
    if (applyPayment(date, loan.monthlyPaymentCents, 'scheduled')) return paidOff(date)
  }

  const lastYear = schedule.slice(-12)
  const annualInterestCents = lastYear.reduce((sum, payment) => sum + payment.newInterestCents, 0)
  const annualPaymentsCents = lastYear.reduce((sum, payment) => sum + payment.paymentCents, 0)
  return {
    status: annualPaymentsCents <= annualInterestCents ? 'insufficient-payment' : 'projection-limit',
    schedule,
  }
}
