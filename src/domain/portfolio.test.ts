import { describe, expect, it } from 'vitest'
import { daysBetween } from './dates'
import { projectLoan } from './loan'
import { projectPortfolio, type LoanRecord } from './portfolio'

const first: LoanRecord = {
  id: 'loan-a',
  fromExample: false,
  name: 'Direct Loan A',
  type: 'unsubsidized',
  principalCents: 100_000,
  accruedInterestCents: 2_500,
  annualRatePercent: 0,
  monthlyPaymentCents: 30_000,
  balanceDate: '2025-01-01',
  nextPaymentDate: '2025-02-01',
}

const second: LoanRecord = {
  ...first,
  id: 'loan-b',
  name: 'Direct Loan B',
  type: 'subsidized',
  principalCents: 50_000,
  accruedInterestCents: 0,
  monthlyPaymentCents: 25_000,
  nextPaymentDate: '2025-02-15',
}

describe('minimum-payment portfolio', () => {
  it('returns no projection for an empty portfolio', () => {
    expect(projectPortfolio([])).toBeNull()
  })

  it('preserves the single-loan projection without changing its schedule', () => {
    expect(projectPortfolio([first])?.projection).toEqual(projectLoan(first))
  })

  it('combines principal, existing interest, minimum payments, and remaining costs', () => {
    const portfolio = projectPortfolio([first, second])
    expect(portfolio).toMatchObject({
      balanceDate: '2025-01-01',
      principalCents: 150_000,
      accruedInterestCents: 2_500,
      monthlyPaymentCents: 55_000,
      annualInterestCents: 0,
      weightedRatePercent: 0,
      projection: {
        status: 'paid-off',
        payoffDate: '2025-05-01',
        paymentCount: 6,
        totalPaymentsCents: 152_500,
        remainingInterestCents: 2_500,
        futureInterestCents: 0,
      },
    })
  })

  it('uses actual due dates rather than treating all payments as simultaneous', () => {
    const portfolio = projectPortfolio([first, second])
    expect(portfolio?.projection.schedule.map(({ date, balanceCents }) => [date, balanceCents])).toEqual([
      ['2025-02-01', 122_500],
      ['2025-02-15', 97_500],
      ['2025-03-01', 67_500],
      ['2025-03-15', 42_500],
      ['2025-04-01', 12_500],
      ['2025-05-01', 0],
    ])
  })

  it('groups simultaneous payments and caps each loan’s final payment independently', () => {
    const portfolio = projectPortfolio([first, { ...second, nextPaymentDate: first.nextPaymentDate }])
    expect(portfolio?.projection.schedule.map(({ paymentCents }) => paymentCents)).toEqual([
      55_000, 55_000, 30_000, 12_500,
    ])
    expect(portfolio?.projection.schedule.at(-1)?.balanceCents).toBe(0)
  })

  it('does not roll freed payments into the remaining loan', () => {
    const portfolio = projectPortfolio([first, second])
    const original = projectLoan(first)
    expect(portfolio?.loans[0]?.projection).toEqual(original)
    expect(portfolio?.projection).toMatchObject({ payoffDate: '2025-05-01' })
    expect(portfolio?.projection.schedule.find(({ date }) => date === '2025-04-01')?.paymentCents).toBe(30_000)
  })

  it('includes interest accruing on loans whose next payment is on another date', () => {
    const portfolio = projectPortfolio([
      { ...first, principalCents: 100_000, accruedInterestCents: 0, annualRatePercent: 12 },
      { ...second, principalCents: 100_000, annualRatePercent: 12 },
    ])
    const payment = portfolio?.projection.schedule[0]
    expect(payment).toMatchObject({
      date: '2025-02-01',
      paymentCents: 30_000,
      interestPaidCents: 1_019,
      principalPaidCents: 28_981,
      principalCents: 171_019,
      accruedInterestCents: 1_019,
      balanceCents: 172_038,
      newInterestCents: 2_038,
    })
  })

  it('reconciles the merged schedule to independent principal and interest totals', () => {
    const portfolio = projectPortfolio([
      { ...first, annualRatePercent: 5.5, nextPaymentDate: '2025-01-31' },
      { ...second, annualRatePercent: 6.75, nextPaymentDate: '2025-01-15' },
      { ...second, id: 'loan-c', principalCents: 180_000, accruedInterestCents: 750, annualRatePercent: 3.25, nextPaymentDate: '2025-01-15' },
    ])
    if (!portfolio || portfolio.projection.status !== 'paid-off') throw new Error('Expected payoff')
    const result = portfolio.projection
    expect(result.totalPaymentsCents).toBe(portfolio.principalCents + result.remainingInterestCents)
    expect(result.schedule.reduce((sum, row) => sum + row.paymentCents, 0)).toBe(result.totalPaymentsCents)
    expect(result.schedule.reduce((sum, row) => sum + row.principalPaidCents, 0)).toBe(portfolio.principalCents)
    expect(result.schedule.reduce((sum, row) => sum + row.interestPaidCents, 0)).toBe(result.remainingInterestCents)
    expect(result.schedule.reduce((sum, row) => sum + row.newInterestCents, 0)).toBe(result.futureInterestCents)
    for (const row of result.schedule) {
      expect(row.balanceCents).toBe(row.principalCents + row.accruedInterestCents)
      const independentBalance = portfolio.loans.reduce((sum, { loan, projection }) => {
        const lastPayment = projection.schedule.filter((payment) => payment.date <= row.date).at(-1)
        const principal = lastPayment?.principalCents ?? loan.principalCents
        const accrued = lastPayment?.accruedInterestCents ?? loan.accruedInterestCents
        const asOf = lastPayment?.date ?? loan.balanceDate
        return sum + principal + accrued + Math.round(principal * loan.annualRatePercent / 100 * daysBetween(asOf, row.date) / 365)
      }, 0)
      expect(row.balanceCents).toBe(independentBalance)
    }
  })

  it('weights the displayed rate by principal, not by loan count or unpaid interest', () => {
    const portfolio = projectPortfolio([
      { ...first, annualRatePercent: 6 },
      { ...second, annualRatePercent: 3, accruedInterestCents: 100_000 },
    ])
    expect(portfolio?.annualInterestCents).toBe(7_500)
    expect(portfolio?.weightedRatePercent).toBe(5)
  })

  it('does not invent a weighted rate when only accrued interest remains', () => {
    const portfolio = projectPortfolio([
      { ...first, principalCents: 0 },
      { ...second, principalCents: 0, accruedInterestCents: 100 },
    ])
    expect(portfolio?.weightedRatePercent).toBeNull()
    expect(portfolio?.annualInterestCents).toBe(0)
    expect(portfolio?.projection.status).toBe('paid-off')
  })

  it('withholds overall payoff totals if even one loan cannot pay off', () => {
    const portfolio = projectPortfolio([first, { ...second, annualRatePercent: 12, monthlyPaymentCents: 100 }])
    expect(portfolio?.principalCents).toBe(150_000)
    expect(portfolio?.projection.status).toBe('insufficient-payment')
    expect(portfolio?.projection).not.toHaveProperty('payoffDate')
    expect(portfolio?.projection).not.toHaveProperty('remainingInterestCents')
    expect(portfolio?.projection.schedule).toEqual([])
    expect(portfolio?.loans[0]?.projection.status).toBe('paid-off')
  })

  it('distinguishes a projection-limit loan from an insufficient-payment loan', () => {
    const portfolio = projectPortfolio([first, { ...second, monthlyPaymentCents: 1 }])
    expect(portfolio?.projection.status).toBe('projection-limit')
  })

  it('handles all loans paying off on the snapshot date', () => {
    const portfolio = projectPortfolio([
      { ...first, nextPaymentDate: first.balanceDate, monthlyPaymentCents: 500_000 },
      { ...second, nextPaymentDate: second.balanceDate, monthlyPaymentCents: 500_000 },
    ])
    expect(portfolio?.projection).toMatchObject({ payoffDate: first.balanceDate, paymentCount: 2 })
    expect(portfolio?.projection.schedule).toHaveLength(1)
    expect(portfolio?.projection.schedule[0]?.paymentCents).toBe(152_500)
  })

  it('rejects mismatched snapshot dates instead of assuming past payments', () => {
    expect(() => projectPortfolio([first, { ...second, balanceDate: '2025-01-02' }])).toThrow('same balance date')
  })

  it('supports duplicate names while requiring distinct loan IDs', () => {
    expect(projectPortfolio([first, { ...second, name: first.name }])?.loans).toHaveLength(2)
    expect(() => projectPortfolio([first, { ...second, id: first.id }])).toThrow('unique ID')
  })

  it('does not mutate input records and produces the same combined schedule regardless of ordering', () => {
    const records = [Object.freeze({ ...first }), Object.freeze({ ...second })]
    const before = structuredClone(records)
    expect(projectPortfolio(records)?.projection).toEqual(projectPortfolio([...records].reverse())?.projection)
    expect(records).toEqual(before)
  })
})
