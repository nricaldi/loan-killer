import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { comparePaymentScenarios } from '../domain/paymentScenarios'
import { projectPortfolio, type LoanRecord } from '../domain/portfolio'
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
