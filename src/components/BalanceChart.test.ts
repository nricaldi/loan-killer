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

  it('labels the actual payoff point and integrates time savings without another timeline', () => {
    const baseline = projectLoan(loan)
    const scenario = projectLoan(loan, { date: loan.balanceDate, amountCents: 30000 })
    const wrapper = mount(BalanceChart, { props: { balanceDate: loan.balanceDate, initialBalanceCents: 102500, projection: baseline, comparison: { projection: scenario, label: 'With one-time payment' } } })
    expect(wrapper.get('.payoff-label [data-testid="payoff-date"]').text()).toBe('Apr 1, 2025')
    expect(wrapper.get('.payoff-label').attributes('style')).toContain('75%')
    expect(wrapper.get('.time-saved-range').attributes('style')).toContain('width: 25%')
    expect(wrapper.get('[data-testid="baseline-date"]').text()).toBe('May 1, 2025')
    expect(wrapper.get('[data-testid="plan-time-saved"]').text()).toBe('1 month sooner')
    wrapper.unmount()
  })

  it('keeps a payoff beyond the chart visible without attaching it to a false endpoint', () => {
    const incomplete = { status: 'insufficient-payment' as const, schedule: [] }
    const wrapper = mount(BalanceChart, { props: { balanceDate: loan.balanceDate, initialBalanceCents: 102500, projection: incomplete, endPoint: { date: '2075-01-01', balanceCents: 102500 }, payoffDate: '2080-01-01' } })
    expect(wrapper.find('.payoff-label').exists()).toBe(false)
    expect(wrapper.get('.payoff-result').text()).toContain('Jan 1, 2080 · beyond this chart')
    expect(wrapper.find('.time-saved-range').exists()).toBe(false)
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

describe('incomplete comparison curves', () => {
  it('ends an unpaid extra-payment curve at its real balance rather than drawing it to zero', () => {
    const baseline = projectLoan({ ...loan, monthlyPaymentCents: 0 })
    const scenario = projectLoan({ ...loan, monthlyPaymentCents: 1 })
    const wrapper = mount(BalanceChart, {
      props: {
        balanceDate: loan.balanceDate, initialBalanceCents: 102500,
        projection: { ...baseline, schedule: baseline.schedule.slice(0, 600) },
        comparison: { projection: { ...scenario, schedule: scenario.schedule.slice(0, 600) }, label: 'With extra payments' },
      },
    })
    expect(wrapper.get('.comparison-line').attributes('d')).not.toContain('L720,220')
    expect(wrapper.get('.comparison-endpoint').attributes('style')).not.toContain('top: 100%')
    expect(wrapper.get('desc').text()).not.toContain('reaches zero')
    expect(wrapper.find('.inspection-details').exists()).toBe(false)
    wrapper.unmount()
  })
})
