import { describe, expect, it } from 'vitest'
import { comparePaymentScenarios } from './paymentScenarios'
import { buildPayoffTimeline } from './payoffMilestones'
import { projectPortfolio, type LoanRecord } from './portfolio'

const first: LoanRecord = {
  id: 'loan-a', name: 'Direct loan', fromExample: false, type: 'unsubsidized',
  principalCents: 100_000, accruedInterestCents: 0, annualRatePercent: 0, monthlyPaymentCents: 30_000,
  balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}
const second: LoanRecord = { ...first, id: 'loan-b', principalCents: 50_000, monthlyPaymentCents: 25_000, nextPaymentDate: '2025-02-15' }

describe('projected payoff milestones', () => {
  it('sorts actual payoff dates and counts remaining loans rather than sorting by target priority', () => {
    const baseline = projectPortfolio([first, second])
    if (!baseline) throw new Error('Expected portfolio')
    const timeline = buildPayoffTimeline(baseline, baseline)
    expect(timeline.milestones.map(({ date, remainingLoans }) => [date, remainingLoans])).toEqual([
      ['2025-03-15', 1], ['2025-05-01', 0],
    ])
    expect(timeline.milestones[0]?.loans[0]?.id).toBe(second.id)
    expect(timeline.unresolved).toEqual([])
  })

  it('groups simultaneous payoffs and preserves duplicate names with distinct IDs', () => {
    const baseline = projectPortfolio([first, { ...second, principalCents: first.principalCents, monthlyPaymentCents: first.monthlyPaymentCents, nextPaymentDate: first.nextPaymentDate }])
    if (!baseline) throw new Error('Expected portfolio')
    const timeline = buildPayoffTimeline(baseline, baseline)
    expect(timeline.milestones).toHaveLength(1)
    expect(timeline.milestones[0]?.loans.map(({ id }) => id)).toEqual([first.id, second.id])
    expect(timeline.milestones[0]?.remainingLoans).toBe(0)
  })

  it('compares each loan with its own baseline rather than the overall finish date', () => {
    const result = comparePaymentScenarios([first, second], { loanId: second.id, date: first.balanceDate, oneTimeCents: 50_000, extraMonthlyCents: 0 })
    const timeline = buildPayoffTimeline(result.oneTime.scenario, result.oneTime.baseline)
    expect(timeline.milestones[0]).toMatchObject({ date: first.balanceDate, remainingLoans: 1, loans: [{ id: second.id, baselinePayoffDate: '2025-03-15', daysSaved: 73 }] })
    expect(timeline.milestones[1]?.loans[0]?.daysSaved).toBe(0)
  })

  it('shows known payoffs without inventing an overall debt-free milestone for unresolved loans', () => {
    const baseline = projectPortfolio([{ ...first, annualRatePercent: 100, monthlyPaymentCents: 1 }, second])
    if (!baseline) throw new Error('Expected portfolio')
    const timeline = buildPayoffTimeline(baseline, baseline)
    expect(timeline.milestones).toHaveLength(1)
    expect(timeline.milestones[0]?.remainingLoans).toBe(1)
    expect(timeline.unresolved).toEqual([{ id: first.id, name: first.name }])
  })

  it('leaves baseline timing unknown when extra payments make an otherwise unpaid loan payable', () => {
    const result = comparePaymentScenarios([{ ...first, annualRatePercent: 12, monthlyPaymentCents: 100 }], { loanId: first.id, date: first.balanceDate, oneTimeCents: 0, extraMonthlyCents: 10_000 })
    const monthly = result.scenarios[2]
    if (!monthly) throw new Error('Expected monthly plan')
    const timeline = buildPayoffTimeline(monthly.portfolio, result.oneTime.baseline)
    expect(timeline.milestones[0]?.loans[0]).toMatchObject({ baselinePayoffDate: null, daysSaved: null })
    expect(timeline.milestones[0]?.remainingLoans).toBe(0)
  })

  it('supports no known payoffs and does not mutate either projection', () => {
    const baseline = projectPortfolio([{ ...first, annualRatePercent: 100, monthlyPaymentCents: 1 }])
    if (!baseline) throw new Error('Expected portfolio')
    const before = structuredClone(baseline)
    expect(buildPayoffTimeline(baseline, baseline)).toEqual({ milestones: [], unresolved: [{ id: first.id, name: first.name }] })
    expect(baseline).toEqual(before)
  })
})
