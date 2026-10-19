import { describe, expect, it } from 'vitest'
import { projectLoan, type Loan } from './loan'
import { daysBetween } from './dates'

const loan: Loan = {
  name: 'Direct Loan 01',
  type: 'unsubsidized',
  principalCents: 100_000,
  accruedInterestCents: 0,
  annualRatePercent: 12,
  monthlyPaymentCents: 10_000,
  balanceDate: '2025-01-01',
  nextPaymentDate: '2025-02-01',
}

describe('single-loan payoff projection', () => {
  it('pays off a zero-interest loan with a capped final payment', () => {
    const result = projectLoan({ ...loan, annualRatePercent: 0, monthlyPaymentCents: 30_000 })
    expect(result.status).toBe('paid-off')
    if (result.status !== 'paid-off') throw new Error('Expected payoff')
    expect(result.schedule.map((payment) => payment.paymentCents)).toEqual([30_000, 30_000, 30_000, 10_000])
    expect(result.payoffDate).toBe('2025-05-01')
    expect(result.paymentCount).toBe(4)
    expect(result.totalPaymentsCents).toBe(100_000)
    expect(result.remainingInterestCents).toBe(0)
    expect(result.schedule.at(-1)?.balanceCents).toBe(0)
  })

  it('calculates daily simple interest using actual days and a 365-day denominator', () => {
    const result = projectLoan(loan)
    expect(result.schedule[0]).toMatchObject({
      date: '2025-02-01',
      newInterestCents: 1_019,
      interestPaidCents: 1_019,
      principalPaidCents: 8_981,
      principalCents: 91_019,
      accruedInterestCents: 0,
      balanceCents: 91_019,
    })
    expect(result.schedule[1]?.newInterestCents).toBe(838)
  })

  it('uses the same 365-day denominator in a leap year', () => {
    const result = projectLoan({ ...loan, balanceDate: '2024-02-01', nextPaymentDate: '2024-03-01' })
    expect(result.schedule[0]?.newInterestCents).toBe(953)
  })

  it('pays already-accrued interest first and counts it once in remaining interest', () => {
    const result = projectLoan({ ...loan, accruedInterestCents: 2_500, annualRatePercent: 0 })
    expect(result.status).toBe('paid-off')
    if (result.status !== 'paid-off') throw new Error('Expected payoff')
    expect(result.schedule[0]?.interestPaidCents).toBe(2_500)
    expect(result.schedule[0]?.principalPaidCents).toBe(7_500)
    expect(result.remainingInterestCents).toBe(2_500)
    expect(result.futureInterestCents).toBe(0)
    expect(result.totalPaymentsCents).toBe(102_500)
  })

  it('does not charge interest on unpaid interest or capitalize it', () => {
    const result = projectLoan({ ...loan, accruedInterestCents: 100_000, monthlyPaymentCents: 100 })
    expect(result.schedule[0]?.newInterestCents).toBe(1_019)
    expect(result.schedule[0]?.principalCents).toBe(100_000)
    expect(result.schedule[1]?.newInterestCents).toBe(921)
    expect(result.schedule[1]?.principalCents).toBe(100_000)
  })

  it('does not reject a loan just because initial accrued interest takes time to clear', () => {
    const result = projectLoan({ ...loan, accruedInterestCents: 200_000, annualRatePercent: 5 })
    expect(result.status).toBe('paid-off')
    expect(result.schedule[11]?.principalPaidCents).toBe(0)
    expect(result.schedule.at(-1)?.balanceCents).toBe(0)
  })

  it('preserves the original due day through short months', () => {
    const result = projectLoan({ ...loan, nextPaymentDate: '2025-01-31' })
    expect(result.schedule.slice(0, 3).map((payment) => payment.date)).toEqual([
      '2025-01-31', '2025-02-28', '2025-03-31',
    ])
  })

  it('allows a payment today without charging an extra day of interest', () => {
    const result = projectLoan({ ...loan, nextPaymentDate: loan.balanceDate, monthlyPaymentCents: 200_000 })
    expect(result.status).toBe('paid-off')
    expect(result.schedule[0]?.newInterestCents).toBe(0)
    expect(result.schedule[0]?.paymentCents).toBe(100_000)
    expect(result.schedule).toHaveLength(1)
  })

  it('identifies payments that cannot cover accruing interest', () => {
    const result = projectLoan({ ...loan, monthlyPaymentCents: 100 })
    expect(result.status).toBe('insufficient-payment')
    expect(result.schedule).toHaveLength(1_200)
    expect(result).not.toHaveProperty('payoffDate')
    expect(result).not.toHaveProperty('remainingInterestCents')
  })

  it.each([0, 12])('keeps a zero-payment loan unpaid at %s%% interest without inventing payoff totals', (annualRatePercent) => {
    const result = projectLoan({ ...loan, annualRatePercent, monthlyPaymentCents: 0 })
    expect(result.status).toBe('insufficient-payment')
    expect(result).not.toHaveProperty('payoffDate')
    expect(result).not.toHaveProperty('remainingInterestCents')
    expect(result.schedule.every(({ paymentCents, principalCents }) => paymentCents === 0 && principalCents === loan.principalCents)).toBe(true)
    expect(result.schedule[0]?.balanceCents).toBe(annualRatePercent === 0 ? 100_000 : 101_019)
  })

  it('allows a one-time payoff on a loan with no required monthly payment', () => {
    const input = { ...loan, monthlyPaymentCents: 0 }
    expect(projectLoan(input, { date: loan.balanceDate, amountCents: 100_000 })).toMatchObject({
      status: 'paid-off', payoffDate: loan.balanceDate, totalPaymentsCents: 100_000,
    })
    expect(projectLoan(input, { date: loan.balanceDate, amountCents: 50_000 }).status).toBe('insufficient-payment')
  })

  it('does not mistake one short initial period for sustainable repayment', () => {
    const result = projectLoan({ ...loan, balanceDate: '2025-01-30', nextPaymentDate: '2025-01-31', monthlyPaymentCents: 500 })
    expect(result.schedule[0]?.principalPaidCents).toBeGreaterThan(0)
    expect(result.status).toBe('insufficient-payment')
  })

  it('distinguishes a very slow payoff from a payment below interest', () => {
    const result = projectLoan({ ...loan, annualRatePercent: 0, principalCents: 200_000, monthlyPaymentCents: 100 })
    expect(result.status).toBe('projection-limit')
    expect(result.schedule.at(-1)?.balanceCents).toBe(80_000)
  })

  it('can pay accrued interest when there is no remaining principal', () => {
    const result = projectLoan({ ...loan, principalCents: 0, accruedInterestCents: 1_234 })
    expect(result.status).toBe('paid-off')
    expect(result.schedule[0]?.paymentCents).toBe(1_234)
    expect(result.schedule[0]?.newInterestCents).toBe(0)
  })

  it('models subsidized and unsubsidized loans identically during normal repayment', () => {
    expect(projectLoan({ ...loan, type: 'subsidized' })).toEqual(projectLoan(loan))
  })

  it('reconciles all principal, interest, payments, and balances to the cent', () => {
    const input = { ...loan, principalCents: 1_800_000, accruedInterestCents: 7_500, annualRatePercent: 5.5, monthlyPaymentCents: 20_000 }
    const result = projectLoan(input)
    if (result.status !== 'paid-off') throw new Error('Expected payoff')
    let previousDate = input.balanceDate
    let previousPrincipal = input.principalCents
    let previousInterest = input.accruedInterestCents
    for (const payment of result.schedule) {
      expect(payment.newInterestCents).toBe(Math.round(previousPrincipal * 0.055 * daysBetween(previousDate, payment.date) / 365))
      expect(payment.paymentCents).toBe(payment.interestPaidCents + payment.principalPaidCents)
      expect(payment.principalCents).toBe(previousPrincipal - payment.principalPaidCents)
      expect(payment.accruedInterestCents).toBe(previousInterest + payment.newInterestCents - payment.interestPaidCents)
      expect(payment.balanceCents).toBe(payment.principalCents + payment.accruedInterestCents)
      expect(payment.balanceCents).toBeGreaterThanOrEqual(0)
      previousDate = payment.date
      previousPrincipal = payment.principalCents
      previousInterest = payment.accruedInterestCents
    }
    expect(result.totalPaymentsCents).toBe(input.principalCents + result.remainingInterestCents)
    expect(result.remainingInterestCents).toBe(input.accruedInterestCents + result.futureInterestCents)
    expect(result.schedule.reduce((sum, payment) => sum + payment.principalPaidCents, 0)).toBe(input.principalCents)
    expect(result.schedule.reduce((sum, payment) => sum + payment.interestPaidCents, 0)).toBe(result.remainingInterestCents)
    expect(result.schedule.reduce((sum, payment) => sum + payment.paymentCents, 0)).toBe(result.totalPaymentsCents)
  })

  it.each([
    { principalCents: -1 },
    { principalCents: 1.5 },
    { principalCents: Number.NaN },
    { principalCents: 1_000_000_001 },
    { principalCents: 0, accruedInterestCents: 0 },
    { monthlyPaymentCents: -1 },
    { monthlyPaymentCents: Number.POSITIVE_INFINITY },
    { accruedInterestCents: -1 },
    { annualRatePercent: -1 },
    { annualRatePercent: Number.NaN },
    { annualRatePercent: 101 },
    { balanceDate: '2025-02-29' },
    { balanceDate: '1899-01-01' },
    { nextPaymentDate: '2101-01-01' },
    { nextPaymentDate: '2024-12-31' },
  ])('rejects invalid model input: %j', (changes) => {
    expect(() => projectLoan({ ...loan, ...changes })).toThrow()
  })
})
