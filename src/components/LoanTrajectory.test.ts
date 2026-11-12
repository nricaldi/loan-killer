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

describe('chart header', () => {
  it('keeps a long-term payoff date and the combined minimum ahead of the chart switches', async () => {
    const portfolio = projectPortfolio(loans)!
    const wrapper = mount(LoanTrajectory, { props: { portfolio } })
    const summary = wrapper.get('.payoff-summary').element
    const minimum = wrapper.get('.chart-minimum').element
    const switches = wrapper.get('.chart-switch').element
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('Nov 13, 2051')
    expect(wrapper.get('[data-testid="chart-monthly-minimum"]').text()).toBe('$125.00 / mo')
    expect(summary.compareDocumentPosition(minimum) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(minimum.compareDocumentPosition(switches) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    await wrapper.get('.chart-switch button:first-child').trigger('click')
    expect(wrapper.find('.payments-chart').exists()).toBe(true)
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('Nov 13, 2051')
    expect(wrapper.get('[data-testid="chart-monthly-minimum"]').text()).toBe('$125.00 / mo')
    wrapper.unmount()
  })

  it('keeps the preview date and minimum in the same header when an extra payment is entered', async () => {
    const result = comparePaymentScenarios(loans, { loanId: loans[0]!.id, date: loans[0]!.balanceDate, oneTimeCents: 100_000, extraMonthlyCents: 0 })
    const wrapper = mount(LoanTrajectory, { props: { portfolio: result.oneTime.baseline } })
    const header = wrapper.get('.trajectory-heading').element
    await wrapper.setProps({ comparison: { portfolio: result.oneTime.scenario, label: 'With one-time payment' } })
    expect(wrapper.get('.trajectory-heading').element).toBe(header)
    expect(wrapper.get('.payoff-summary [data-testid="preview-payoff-date"]').text()).toBe('Nov 13, 2051')
    expect(wrapper.get('[data-testid="chart-monthly-minimum"]').text()).toBe('$125.00 / mo')
    expect(wrapper.find('.comparison-line').exists()).toBe(true)
    wrapper.unmount()
  })
})


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
    expect(wrapper.getComponent(BalanceChart).props('endPoint')!.balanceCents).toBeLessThan(100000)
    expect(wrapper.getComponent(BalanceChart).props('projection').schedule.every((payment) => payment.date <= '2076-10-21')).toBe(true)
    wrapper.unmount()
  })
})
