import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { daysBetween } from '../domain/dates'
import { comparePaymentScenarios } from '../domain/paymentScenarios'
import { projectPortfolio, type LoanRecord } from '../domain/portfolio'
import BalanceChart from './BalanceChart.vue'
import LoanTrajectory from './LoanTrajectory.vue'

const loans: LoanRecord[] = Array.from({ length: 5 }, (_, index) => ({
  id: `loan-${index}`, name: `Loan ${index + 1}`, type: 'unsubsidized', fromExample: false,
  principalCents: 752_500, accruedInterestCents: 0, annualRatePercent: 0,
  monthlyPaymentCents: 2_500, balanceDate: '2026-10-21', nextPaymentDate: '2026-11-13',
}))

describe('unpaid balance projection', () => {
  it('shows 50 years of growing debt without inventing a payoff or a zero endpoint', () => {
    const portfolio = projectPortfolio([{ ...loans[0]!, principalCents: 1800000, annualRatePercent: 5.5, monthlyPaymentCents: 7500 }])!
    const wrapper = mount(LoanTrajectory, { props: { portfolio } })
    const chart = wrapper.getComponent(BalanceChart)
    const projection = chart.props('projection')
    expect(projection.status).toBe('insufficient-payment')
    expect(projection.schedule.every((payment) => payment.date <= '2076-10-21')).toBe(true)
    expect(chart.props('endPoint')!.date).toBe('2076-10-21')
    expect(chart.props('endPoint')!.balanceCents).toBeGreaterThan(1800000)
    expect(chart.get('desc').text()).toContain('No payoff date is estimated')
    expect(chart.get('desc').text()).not.toContain('reaches zero')
    expect(chart.findAll('.endpoint').at(-1)!.attributes('style')).not.toContain('top: 100%')
    expect(wrapper.find('[data-testid="remaining-interest"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('aggregates mixed paid and unpaid loans and accrues through the exact 50-year endpoint', () => {
    const portfolio = projectPortfolio([
      { ...loans[0]!, principalCents: 100000, monthlyPaymentCents: 0, annualRatePercent: 0 },
      { ...loans[1]!, principalCents: 50000, monthlyPaymentCents: 25000, annualRatePercent: 0 },
    ])!
    const wrapper = mount(LoanTrajectory, { props: { portfolio } })
    const chart = wrapper.getComponent(BalanceChart)
    expect(chart.props('initialBalanceCents')).toBe(150000)
    expect(chart.props('projection').schedule.at(-1)!.balanceCents).toBe(100000)
    expect(chart.props('endPoint')).toEqual({ date: '2076-10-21', balanceCents: 100000 })
    expect(chart.get('desc').text()).toContain('$1,000.00 on Oct 21, 2076')
    expect(chart.get('.projection-line').attributes('d')).not.toContain('NaN')
    wrapper.unmount()
  })

  it('includes interest through the horizon when no payment falls within the window', () => {
    const portfolio = projectPortfolio([{ ...loans[0]!, principalCents: 100000, annualRatePercent: 10, monthlyPaymentCents: 0, nextPaymentDate: '2099-01-01' }])!
    const wrapper = mount(LoanTrajectory, { props: { portfolio } })
    const chart = wrapper.getComponent(BalanceChart)
    expect(chart.props('projection').schedule).toHaveLength(0)
    expect(chart.props('endPoint')!.balanceCents).toBe(100000 + Math.round(100000 * 0.1 * daysBetween('2026-10-21', '2076-10-21') / 365))
    expect(chart.get('.projection-line').attributes('d')).not.toContain('NaN')
    wrapper.unmount()
  })

  it('keeps flat zero-interest debt visible and updates an incomplete monthly preview', async () => {
    const records = [{ ...loans[0]!, principalCents: 100000, monthlyPaymentCents: 0 }]
    const portfolio = projectPortfolio(records)!
    const wrapper = mount(LoanTrajectory, { props: { portfolio } })
    expect(wrapper.getComponent(BalanceChart).props('endPoint')!.balanceCents).toBe(100000)
    const result = comparePaymentScenarios(records, { loanId: records[0]!.id, date: records[0]!.balanceDate, oneTimeCents: 0, extraMonthlyCents: 1 })
    const monthly = result.scenarios.find(({ id }) => id === 'monthly')!.portfolio
    await wrapper.setProps({ comparison: { portfolio: monthly, label: 'With extra monthly payments' } })
    expect(wrapper.getComponent(BalanceChart).props('comparison')!.endPoint!.balanceCents).toBeLessThan(100000)
    expect(wrapper.getComponent(BalanceChart).props('projection').schedule.every((payment) => payment.date <= '2076-10-21')).toBe(true)
    wrapper.unmount()
  })
  it('updates the same metrics while retaining baseline totals and dates, then restores them on reset', async () => {
    const records = [{ ...loans[0]!, principalCents: 100000, annualRatePercent: 6, monthlyPaymentCents: 10000 }]
    const portfolio = projectPortfolio(records)!
    const wrapper = mount(LoanTrajectory, { props: { portfolio } })
    const baselineTotal = wrapper.get('[data-testid="total-payments"]').text()
    const baselineDate = wrapper.get('[data-testid="payoff-date"]').text()
    const result = comparePaymentScenarios(records, { loanId: records[0]!.id, date: records[0]!.balanceDate, oneTimeCents: 20000, extraMonthlyCents: 5000 })
    const plan = result.scenarios.find(({ id }) => id === 'combined')!.portfolio
    await wrapper.setProps({ comparison: { portfolio: plan, label: 'With extra payments' } })
    expect(wrapper.findAll('.segment-labels > div')).toHaveLength(3)
    expect(wrapper.get('.repayment-track').attributes('aria-label')).toContain(baselineTotal)
    expect(wrapper.get('desc').text()).toContain(baselineDate)
    expect(wrapper.get('[data-testid="total-payments"]').text()).not.toBe(baselineTotal)
    expect(wrapper.get('[data-testid="payoff-date"]').text()).not.toBe(baselineDate)
    expect(wrapper.get('[data-testid="plan-interest-saved"]').text()).toContain('saved')
    expect(wrapper.get('[data-testid="plan-time-saved"]').text()).toContain('sooner')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,000.00')
    await wrapper.setProps({ comparison: null })
    expect(wrapper.get('[data-testid="total-payments"]').text()).toBe(baselineTotal)
    expect(wrapper.find('[data-testid="baseline-total"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('shows an achievable preview without inventing savings against unpaid minimums', async () => {
    const records = [{ ...loans[0]!, principalCents: 100000, monthlyPaymentCents: 0 }]
    const portfolio = projectPortfolio(records)!
    const result = comparePaymentScenarios(records, { loanId: records[0]!.id, date: records[0]!.balanceDate, oneTimeCents: 0, extraMonthlyCents: 10000 })
    const plan = result.scenarios.find(({ id }) => id === 'monthly')!.portfolio
    const wrapper = mount(LoanTrajectory, { props: { portfolio, comparison: { portfolio: plan, label: 'Monthly' } } })
    expect(wrapper.get('[data-testid="total-payments"]').text()).toBe('$1,000.00')
    expect(wrapper.get('.repayment-track').attributes('aria-label')).toContain('Baseline savings unavailable')
    expect(wrapper.get('desc').text()).toContain('No payoff date is estimated')
    expect(wrapper.find('[data-testid="plan-interest-saved"]').exists()).toBe(false)
    wrapper.unmount()
  })

  it('counts accrued interest in amount owed once and conserves the full repayment bar', async () => {
    const records = [{ ...loans[0]!, principalCents: 100000, accruedInterestCents: 2500, annualRatePercent: 6, monthlyPaymentCents: 10000 }]
    const portfolio = projectPortfolio(records)!
    const result = comparePaymentScenarios(records, { loanId: records[0]!.id, date: records[0]!.balanceDate, oneTimeCents: 20000, extraMonthlyCents: 5000 })
    const plan = result.scenarios.find(({ id }) => id === 'combined')!.portfolio
    const wrapper = mount(LoanTrajectory, { props: { portfolio, comparison: { portfolio: plan, label: 'Combined' } } })
    const width = (selector: string) => Number.parseFloat(wrapper.get(selector).attributes('style')!.replace('width:', ''))
    expect(width('.debt-segment') + width('.interest-segment') + width('.saved-segment')).toBeCloseTo(100, 8)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,025.00')
    expect(wrapper.get('.repayment-track').attributes('aria-label')).toContain('$25.00 accrued interest')
    expect(wrapper.get('.repayment-track').attributes('aria-label')).toContain('Amount owed $1,025.00')
    await wrapper.setProps({ comparison: null })
    expect(width('.saved-segment')).toBe(0)
    expect(width('.debt-segment') + width('.interest-segment')).toBeCloseTo(100, 8)
    wrapper.unmount()
  })

  it('renders a zero-interest, same-date plan without NaN widths or positions', () => {
    const portfolio = projectPortfolio([{ ...loans[0]!, principalCents: 10000, monthlyPaymentCents: 10000, nextPaymentDate: loans[0]!.balanceDate }])!
    const wrapper = mount(LoanTrajectory, { props: { portfolio } })
    expect(wrapper.get('.interest-segment').attributes('style')).toContain('width: 0%')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('Oct 21, 2026')
    expect(wrapper.html()).not.toContain('NaN')
    wrapper.unmount()
  })

  it('shows additional cost rather than a saved segment for a negative rounding difference', () => {
    const records = [{ ...loans[0]!, principalCents: 100000, accruedInterestCents: 2500, annualRatePercent: 12, monthlyPaymentCents: 30000, balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01' }]
    const portfolio = projectPortfolio(records)!
    const result = comparePaymentScenarios(records, { loanId: records[0]!.id, date: '2025-01-04', oneTimeCents: 1, extraMonthlyCents: 0 })
    const plan = result.scenarios.find(({ id }) => id === 'one-time')!.portfolio
    const wrapper = mount(LoanTrajectory, { props: { portfolio, comparison: { portfolio: plan, label: 'One-time' } } })
    expect(wrapper.get('.segment-labels').text()).toContain('Extra cost')
    expect(wrapper.get('[data-testid="plan-interest-saved"]').text()).toContain('$0.01')
    expect(wrapper.get('.saved-segment').attributes('style')).toContain('width: 0%')
    wrapper.unmount()
  })

})
