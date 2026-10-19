import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { comparePaymentScenarios } from '../domain/paymentScenarios'
import { projectPortfolio, type LoanRecord } from '../domain/portfolio'
import PayoffMilestones from './PayoffMilestones.vue'

const first: LoanRecord = {
  id: 'loan-a', name: 'Direct loan', fromExample: false, type: 'unsubsidized',
  principalCents: 100_000, accruedInterestCents: 0, annualRatePercent: 0, monthlyPaymentCents: 30_000,
  balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}
const second = { ...first, id: 'loan-b', principalCents: 50_000, monthlyPaymentCents: 25_000, nextPaymentDate: '2025-02-15' }

describe('projected payoff milestones', () => {
  it('labels dates as projections, displays actual payoff order, and counts down remaining loans', () => {
    const portfolio = projectPortfolio([first, second])
    if (!portfolio) throw new Error('Expected portfolio')
    const wrapper = mount(PayoffMilestones, { props: { portfolio, baseline: portfolio, planLabel: 'Minimum only' } })
    expect(wrapper.text()).toContain('PROJECTED · NOT ACTUAL PROGRESS')
    expect(wrapper.text()).toContain('not payments you’ve made')
    expect(wrapper.findAll('[data-milestone-date]').map((step) => step.attributes('data-milestone-date'))).toEqual(['2025-03-15', '2025-05-01'])
    expect(wrapper.text()).toContain('1 loan remaining')
    expect(wrapper.findAll('.finish-milestone')).toHaveLength(1)
    expect(wrapper.get('.finish-milestone').text()).toContain('Projected debt-free')
    expect(wrapper.text()).toContain('Same payoff date as baseline')
    wrapper.unmount()
  })

  it('groups loans paid off together without dropping duplicate names', () => {
    const portfolio = projectPortfolio([first, { ...first, id: second.id }])
    if (!portfolio) throw new Error('Expected portfolio')
    const wrapper = mount(PayoffMilestones, { props: { portfolio, baseline: portfolio, planLabel: 'Example' } })
    expect(wrapper.findAll('[data-milestone-date]')).toHaveLength(1)
    expect(wrapper.findAll('[data-milestone-loan-id]')).toHaveLength(2)
    expect(wrapper.text()).toContain('2 loans reach zero')
    wrapper.unmount()
  })

  it('does not give an overall finish milestone to a partially unpaid portfolio', () => {
    const portfolio = projectPortfolio([{ ...first, annualRatePercent: 100, monthlyPaymentCents: 1 }, second])
    if (!portfolio) throw new Error('Expected portfolio')
    const wrapper = mount(PayoffMilestones, { props: { portfolio, baseline: portfolio, planLabel: 'Example' } })
    expect(wrapper.findAll('[data-milestone-date]')).toHaveLength(1)
    expect(wrapper.text()).toContain('Still beyond the projection limit')
    expect(wrapper.find('.finish-milestone').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Projected debt-free')
    wrapper.unmount()
  })

  it('explains when no known payoff can be shown', () => {
    const portfolio = projectPortfolio([{ ...first, annualRatePercent: 100, monthlyPaymentCents: 1 }])
    if (!portfolio) throw new Error('Expected portfolio')
    const wrapper = mount(PayoffMilestones, { props: { portfolio, baseline: portfolio, planLabel: 'Example' } })
    expect(wrapper.text()).toContain('None of these loans reaches zero')
    expect(wrapper.find('time').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows a full payoff today as hypothetical rather than actual history', () => {
    const result = comparePaymentScenarios([first], { loanId: first.id, date: first.balanceDate, oneTimeCents: 100_000, extraMonthlyCents: 0 })
    const wrapper = mount(PayoffMilestones, { props: { portfolio: result.oneTime.scenario, baseline: result.oneTime.baseline, planLabel: 'One-time only' } })
    expect(wrapper.get('time').attributes('datetime')).toBe(first.balanceDate)
    expect(wrapper.text()).toContain('4 months sooner than baseline')
    expect(wrapper.text()).toContain('not payments you’ve made')
    wrapper.unmount()
  })

  it('preserves unavailable baseline timing and later payoff changes rather than claiming a positive saving', () => {
    const result = comparePaymentScenarios([{ ...first, annualRatePercent: 12, monthlyPaymentCents: 100 }], { loanId: first.id, date: first.balanceDate, oneTimeCents: 0, extraMonthlyCents: 10_000 })
    const monthly = result.scenarios[2]
    if (!monthly) throw new Error('Expected monthly plan')
    const wrapper = mount(PayoffMilestones, { props: { portfolio: monthly.portfolio, baseline: result.oneTime.baseline, planLabel: 'Extra monthly' } })
    expect(wrapper.text()).toContain('Baseline payoff unavailable')
    wrapper.unmount()
    const baseline = projectPortfolio([first])
    const delayed = projectPortfolio([{ ...first, nextPaymentDate: '2025-03-01' }])
    if (!baseline || !delayed) throw new Error('Expected portfolio')
    const later = mount(PayoffMilestones, { props: { portfolio: delayed, baseline, planLabel: 'Delayed example' } })
    expect(later.text()).toContain('1 month later than baseline')
    later.unmount()
  })
})
