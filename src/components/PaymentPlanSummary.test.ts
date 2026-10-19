import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { comparePaymentScenarios, type ExtraScenarioId, type PaymentScenarioRequest } from '../domain/paymentScenarios'
import type { LoanRecord } from '../domain/portfolio'
import { money } from '../format'
import PaymentPlanSummary from './PaymentPlanSummary.vue'

const loan: LoanRecord = {
  id: 'loan-a', fromExample: false, name: 'Loan A', type: 'unsubsidized',
  principalCents: 100000, accruedInterestCents: 2500, annualRatePercent: 5.5,
  monthlyPaymentCents: 30000, balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}

function render(loans = [loan], request: Partial<PaymentScenarioRequest> = {}, selected: ExtraScenarioId = 'one-time') {
  const result = comparePaymentScenarios(loans, { loanId: loan.id, oneTimeCents: 30000, extraMonthlyCents: 0, date: loan.balanceDate, ...request })
  return { result, wrapper: mount(PaymentPlanSummary, { props: { result, selected } }) }
}

describe('unified payment plan summary', () => {
  it('highlights measured interest and calendar time savings from a lump sum', () => {
    const { result, wrapper } = render()
    expect(wrapper.get('h3').text()).toBe('With $300.00 toward Loan A today')
    expect(wrapper.get('[data-testid="plan-interest-saved"]').text()).toBe(money(result.oneTime.savings!.interestCents))
    expect(wrapper.get('[data-testid="plan-time-saved"]').text()).toBe('1 month sooner')
    expect(wrapper.get('[data-testid="plan-payoff-date"]').text()).toBe('Apr 1, 2025')
    expect(wrapper.attributes('aria-live')).toBe('polite')
    wrapper.unmount()
  })

  it('distinguishes an earlier target-loan payoff from an unchanged whole-plan date', () => {
    const other: LoanRecord = { ...loan, id: 'loan-b', name: 'Loan B', principalCents: 50000, accruedInterestCents: 0, annualRatePercent: 0, monthlyPaymentCents: 25000, nextPaymentDate: '2025-02-15' }
    const { wrapper } = render([loan, other], { loanId: other.id, oneTimeCents: 50000 })
    expect(wrapper.get('[data-testid="plan-time-saved"]').text()).toBe('Same payoff date')
    expect(wrapper.text()).toContain('This loan’s payoff: 2 months, 14 days sooner')
    wrapper.unmount()
  })

  it('withholds savings when the baseline does not pay off instead of inventing a benefit', () => {
    const { wrapper } = render([{ ...loan, annualRatePercent: 12, monthlyPaymentCents: 100 }], { oneTimeCents: 90000 })
    expect(wrapper.get('[data-testid="plan-interest-saved"]').text()).toBe('Not available')
    expect(wrapper.get('[data-testid="plan-time-saved"]').text()).toBe('Not available')
    expect(wrapper.text()).toContain('Complete savings need payoff estimates for both plans')
    wrapper.unmount()
  })

  it('calls a negative rounding difference additional interest, not savings', () => {
    const { wrapper } = render([{ ...loan, annualRatePercent: 12 }], { oneTimeCents: 1, date: '2025-01-04' })
    expect(wrapper.text()).toContain('Additional interest')
    expect(wrapper.get('[data-testid="plan-interest-saved"]').text()).toBe('$0.01')
    expect(wrapper.text()).not.toContain('You’ll save in interest')
    wrapper.unmount()
  })

  it('caps the displayed payment at the amount applied and calls out unused excess', () => {
    const { wrapper } = render([loan], { oneTimeCents: 200000 })
    expect(wrapper.get('h3').text()).toBe('With $1,025.00 toward Loan A today')
    expect(wrapper.text()).toContain('$975.00 unused; it isn’t moved to another loan')
    wrapper.unmount()
  })

  it('uses combined savings, not one-time-only savings, when both payments are included', () => {
    const { result, wrapper } = render([loan], { extraMonthlyCents: 10000 }, 'combined')
    const combined = result.scenarios.find(({ id }) => id === 'combined')!
    expect(wrapper.get('h3').text()).toBe('With $300.00 toward Loan A today and $100.00 extra each month')
    expect(wrapper.get('[data-testid="plan-interest-saved"]').text()).toBe(money(combined.savings!.interestCents))
    expect(combined.savings!.interestCents).not.toBe(result.oneTime.savings!.interestCents)
    expect(wrapper.get('[data-testid="plan-time-saved"]').text()).toBe('2 months sooner')
    expect(wrapper.get('[data-testid="monthly-budget"]').text()).toBe('$300.00 minimums + $100.00 extra = $400.00 starting monthly budget')
    expect(wrapper.text()).not.toContain('Preview total')
    wrapper.unmount()
  })

  it('updates its description, budget, and savings to match plans selected in the comparison section', async () => {
    const { result, wrapper } = render([loan], { extraMonthlyCents: 10000 }, 'combined')
    await wrapper.setProps({ selected: 'monthly' })
    expect(wrapper.get('h3').text()).toBe('With $100.00 extra each month')
    expect(wrapper.text()).toContain('This preview excludes your one-time payment')
    expect(wrapper.text()).not.toContain('applied to Loan A')
    expect(wrapper.get('[data-testid="plan-interest-saved"]').text()).toBe(money(result.scenarios.find(({ id }) => id === 'monthly')!.savings!.interestCents))
    await wrapper.setProps({ selected: 'one-time' })
    expect(wrapper.get('h3').text()).toBe('With $300.00 toward Loan A today')
    expect(wrapper.get('[data-testid="monthly-budget"]').text()).toContain('$0.00 extra = $300.00')
    expect(wrapper.text()).toContain('This preview excludes your extra monthly budget')
    wrapper.unmount()
  })

  it('does not claim savings from a zero-extra plan and emits reset requests', async () => {
    const { wrapper } = render([loan], { oneTimeCents: 0 })
    expect(wrapper.get('h3').text()).toBe('With your saved minimum payments')
    expect(wrapper.get('[data-testid="plan-interest-saved"]').text()).toBe('$0.00')
    expect(wrapper.get('[data-testid="plan-time-saved"]').text()).toBe('Same payoff date')
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('clear')).toHaveLength(1)
    wrapper.unmount()
  })
})
