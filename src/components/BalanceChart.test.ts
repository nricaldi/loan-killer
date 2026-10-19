import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { projectLoan, type Loan } from '../domain/loan'
import BalanceChart from './BalanceChart.vue'

const loan: Loan = {
  name: 'Direct loan',
  type: 'unsubsidized',
  principalCents: 100_000,
  accruedInterestCents: 2_500,
  annualRatePercent: 0,
  monthlyPaymentCents: 30_000,
  balanceDate: '2025-01-01',
  nextPaymentDate: '2025-02-01',
}

describe('payoff comparison chart', () => {
  it('draws the extra payment as an immediate drop, not a gradual reduction before today', () => {
    const baseline = projectLoan(loan)
    const scenario = projectLoan(loan, { date: loan.balanceDate, amountCents: 30_000 })
    if (baseline.status !== 'paid-off' || scenario.status !== 'paid-off') throw new Error('Expected payoff')
    const wrapper = mount(BalanceChart, {
      props: {
        balanceDate: loan.balanceDate,
        initialBalanceCents: 102_500,
        projection: baseline,
        comparison: { projection: scenario, label: 'With one-time payment' },
      },
    })
    expect(wrapper.get('.comparison-line').attributes('d')).toContain('L0.00,64.39')
    expect(wrapper.get('.comparison-line').attributes('d')).toContain('L540.00,220.00 L720,220')
    expect(wrapper.get('.comparison-endpoint').attributes('style')).toContain('left: 75%')
    expect(wrapper.get('svg').text()).toContain('reaches zero on Apr 1, 2025')
    expect(wrapper.get('figcaption').text()).toContain('With one-time payment')
    wrapper.unmount()
  })

  it('uses the later payoff date as the shared time axis', () => {
    const baseline = projectLoan(loan)
    const scenario = projectLoan(loan, { date: loan.balanceDate, amountCents: 30_000 })
    if (baseline.status !== 'paid-off' || scenario.status !== 'paid-off') throw new Error('Expected payoff')
    const wrapper = mount(BalanceChart, {
      props: {
        balanceDate: loan.balanceDate,
        initialBalanceCents: 102_500,
        projection: scenario,
        comparison: { projection: baseline, label: 'Minimum payments only' },
      },
    })
    expect(wrapper.findAll('.date-labels span').at(-1)?.text()).toBe('May 2025')
    expect(wrapper.get('.projection-line').attributes('d')).toContain('L540.00,220.00')
    expect(wrapper.get('.comparison-endpoint').attributes('style')).toContain('left: 100%')
    wrapper.unmount()
  })
})
