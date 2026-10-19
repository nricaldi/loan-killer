import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { compareOneTimePayment } from '../domain/oneTimePayment'
import type { LoanRecord } from '../domain/portfolio'
import { money } from '../format'
import OneTimePaymentImpact from './OneTimePaymentImpact.vue'

const loan: LoanRecord = {
  id: 'loan-a', fromExample: false, name: 'Loan A', type: 'unsubsidized',
  principalCents: 100000, accruedInterestCents: 2500, annualRatePercent: 5.5,
  monthlyPaymentCents: 30000, balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}

describe('one-time payment impact', () => {
  it('highlights measured interest and calendar time savings from a lump sum', () => {
    const comparison = compareOneTimePayment([loan], { loanId: loan.id, amountCents: 30000, date: loan.balanceDate })
    const wrapper = mount(OneTimePaymentImpact, { props: { comparison } })
    expect(wrapper.get('h3').text()).toBe('With this $300.00 one-time payment')
    expect(wrapper.get('[data-testid="one-time-interest-impact"]').text()).toBe(money(comparison.savings!.interestCents))
    expect(wrapper.get('[data-testid="one-time-payoff-impact"]').text()).toBe('1 month sooner')
    expect(wrapper.text()).toContain('Extra monthly payments aren’t included')
    expect(wrapper.attributes('aria-live')).toBe('polite')
    wrapper.unmount()
  })

  it('distinguishes an earlier target-loan payoff from an unchanged whole-plan date', () => {
    const other: LoanRecord = { ...loan, id: 'loan-b', name: 'Loan B', principalCents: 50000, accruedInterestCents: 0, annualRatePercent: 0, monthlyPaymentCents: 25000, nextPaymentDate: '2025-02-15' }
    const comparison = compareOneTimePayment([loan, other], { loanId: other.id, amountCents: 50000, date: loan.balanceDate })
    const wrapper = mount(OneTimePaymentImpact, { props: { comparison } })
    expect(wrapper.get('[data-testid="one-time-payoff-impact"]').text()).toBe('Same payoff date')
    expect(wrapper.get('.target-payoff-impact').text()).toBe('Loan B: 2 months, 14 days sooner')
    wrapper.unmount()
  })

  it('withholds savings when the baseline does not pay off instead of inventing a benefit', () => {
    const comparison = compareOneTimePayment([{ ...loan, annualRatePercent: 12, monthlyPaymentCents: 100 }], { loanId: loan.id, amountCents: 90000, date: loan.balanceDate })
    const wrapper = mount(OneTimePaymentImpact, { props: { comparison } })
    expect(wrapper.get('[data-testid="one-time-interest-impact"]').text()).toBe('Not available')
    expect(wrapper.get('[data-testid="one-time-payoff-impact"]').text()).toBe('Not available')
    expect(wrapper.text()).toContain('Complete savings need payoff estimates for both plans')
    wrapper.unmount()
  })

  it('calls a negative rounding difference additional interest, not savings', () => {
    const comparison = compareOneTimePayment([{ ...loan, annualRatePercent: 12 }], { loanId: loan.id, amountCents: 1, date: '2025-01-04' })
    const wrapper = mount(OneTimePaymentImpact, { props: { comparison } })
    expect(wrapper.text()).toContain('Additional interest')
    expect(wrapper.get('[data-testid="one-time-interest-impact"]').text()).toBe('$0.01')
    expect(wrapper.text()).not.toContain('You’ll save in interest')
    wrapper.unmount()
  })

  it('caps the displayed payment at the amount applied and calls out unused excess', () => {
    const comparison = compareOneTimePayment([loan], { loanId: loan.id, amountCents: 200000, date: loan.balanceDate })
    const wrapper = mount(OneTimePaymentImpact, { props: { comparison } })
    expect(wrapper.get('h3').text()).toBe('With this $1,025.00 one-time payment')
    expect(wrapper.text()).toContain('$975.00 unused; it isn’t moved to another loan')
    wrapper.unmount()
  })
})
