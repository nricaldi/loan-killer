import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoanRecord } from '../domain/portfolio'
import PaymentSimulator from './PaymentSimulator.vue'

const loan: LoanRecord = {
  id: 'loan-a',
  fromExample: false,
  name: 'Undergraduate loan',
  type: 'unsubsidized',
  principalCents: 100_000,
  accruedInterestCents: 2_500,
  annualRatePercent: 0,
  monthlyPaymentCents: 30_000,
  balanceDate: '2025-01-01',
  nextPaymentDate: '2025-02-01',
}

const otherLoan: LoanRecord = {
  ...loan,
  id: 'loan-b',
  name: 'Graduate loan',
  principalCents: 50_000,
  accruedInterestCents: 0,
  monthlyPaymentCents: 25_000,
  nextPaymentDate: '2025-02-15',
}

let wrapper: VueWrapper

function mountSimulator(loans: LoanRecord[] = [loan]) {
  wrapper = mount(PaymentSimulator, { props: { loans }, attachTo: document.body })
}

async function compare(amount: string) {
  await wrapper.get('#extra-payment-amount').setValue(amount)
  await wrapper.get('.scenario-form').trigger('submit')
}

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2025, 0, 1, 12))
})

afterEach(() => {
  wrapper?.unmount()
  vi.useRealTimers()
})

describe('one-time payment simulator', () => {
  it('clearly labels a payment today as hypothetical and preserves scheduled minimums', () => {
    mountSimulator()
    expect(wrapper.text()).toContain('WHAT-IF · NOT A REAL PAYMENT')
    expect(wrapper.text()).toContain('Modeled for today, Jan 1, 2025')
    expect(wrapper.text()).toContain('Scheduled minimums continue unless the loan is paid off')
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(false)
  })

  it('validates the amount and focuses the invalid field', async () => {
    mountSimulator()
    await compare('-100')
    expect(wrapper.get('#extra-amount-error').text()).toContain('up to two decimal places')
    expect(document.activeElement).toBe(wrapper.get('#extra-payment-amount').element)
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(false)
  })

  it('shows honest savings, allocation, totals including the lump sum, and overlaid curves', async () => {
    mountSimulator()
    await compare('300')
    expect(wrapper.get('[data-testid="extra-interest-saved"]').text()).toBe('$0.00')
    expect(wrapper.get('[data-testid="extra-time-saved"]').text()).toBe('1 month sooner')
    expect(wrapper.get('[data-testid="extra-to-interest"]').text()).toBe('$25.00')
    expect(wrapper.get('[data-testid="extra-to-principal"]').text()).toBe('$275.00')
    expect(wrapper.get('[data-testid="extra-balance-after"]').text()).toBe('$725.00')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Apr 1, 2025')
    expect(wrapper.get('[data-testid="extra-total-payments"]').text()).toBe('$1,025.00')
    expect(wrapper.find('.comparison-line').exists()).toBe(true)
    expect(wrapper.get('figure svg').text()).toContain('reaches zero on Apr 1, 2025')
    expect(wrapper.get('.schedule tbody tr').text()).toContain('Extra payment')
    expect(wrapper.get('[role="status"]').text()).toContain('Comparison updated')
  })

  it('shows unused excess without pretending it is paid or reassigned', async () => {
    mountSimulator()
    await compare('2000')
    expect(wrapper.get('[data-testid="extra-unused"]').text()).toContain('$975.00')
    expect(wrapper.get('[data-testid="extra-unused"]').text()).toContain('isn’t moved to another loan')
    expect(wrapper.get('[data-testid="extra-balance-after"]').text()).toBe('$0.00')
    expect(wrapper.get('[data-testid="extra-total-payments"]').text()).toBe('$1,025.00')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Jan 1, 2025')
    expect(wrapper.findAll('.schedule tbody tr')).toHaveLength(1)
  })

  it('allows zero without creating fake interest or time savings', async () => {
    mountSimulator()
    await compare('0')
    expect(wrapper.get('[data-testid="extra-interest-saved"]').text()).toBe('$0.00')
    expect(wrapper.get('[data-testid="extra-time-saved"]').text()).toBe('Same payoff date')
    expect(wrapper.get('[data-testid="extra-to-principal"]').text()).toBe('$0.00')
    expect(wrapper.find('.extra-tag').exists()).toBe(false)
  })

  it('distinguishes the selected loan’s early payoff from an unchanged whole-plan payoff', async () => {
    mountSimulator([loan, otherLoan])
    await wrapper.get('#extra-payment-target').setValue(otherLoan.id)
    await compare('500')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('May 1, 2025')
    expect(wrapper.get('[data-testid="extra-time-saved"]').text()).toBe('Same payoff date')
    expect(wrapper.get('.target-impact').text()).toContain('Graduate loan: Mar 15, 2025 → Jan 1, 2025')
    expect(wrapper.get('.target-impact').text()).toContain('2 months, 14 days sooner for this loan')
    expect(wrapper.get('.result-heading').text()).toContain('$500.00 toward Graduate loan')
  })

  it('keeps previous results explicitly labeled until new inputs are applied', async () => {
    mountSimulator()
    await compare('300')
    await wrapper.get('#extra-payment-amount').setValue('2000')
    expect(wrapper.text()).toContain('results below still show your last comparison')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Apr 1, 2025')
    await wrapper.get('.scenario-form').trigger('submit')
    expect(wrapper.text()).not.toContain('Inputs changed.')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Jan 1, 2025')
  })

  it('keeps the previous comparison when changed inputs are invalid', async () => {
    mountSimulator()
    await compare('300')
    await compare('1,000')
    expect(wrapper.find('#extra-amount-error').exists()).toBe(true)
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Apr 1, 2025')
  })

  it('clears the scenario and returns keyboard focus to the amount', async () => {
    mountSimulator()
    await compare('300')
    await wrapper.get('.result-heading button').trigger('click')
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('0')
    expect(document.activeElement).toBe(wrapper.get('#extra-payment-amount').element)
  })

  it('blocks unknown payment history instead of backdating a payment today', async () => {
    mountSimulator([{ ...loan, balanceDate: '2024-12-01', nextPaymentDate: '2024-12-31' }])
    expect(wrapper.text()).toContain('A next payment date is in the past')
    await compare('300')
    expect(wrapper.get('[role="alert"]').text()).toContain('won’t assume earlier payments happened')
    expect(document.activeElement).toBe(wrapper.get('[role="alert"]').element)
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(false)
  })

  it('refreshes the actual payment date at comparison time if the tab stays open overnight', async () => {
    mountSimulator()
    vi.setSystemTime(new Date(2025, 0, 2, 12))
    await compare('300')
    expect(wrapper.text()).toContain('Modeled for today, Jan 2, 2025')
    expect(wrapper.get('.allocation').text()).toContain('On Jan 2, 2025')
  })

  it('shows a now-payable scenario without inventing savings against an incomplete baseline', async () => {
    mountSimulator([{ ...loan, annualRatePercent: 12, monthlyPaymentCents: 500 }])
    await compare('900')
    expect(wrapper.get('[data-testid="extra-interest-saved"]').text()).toBe('Not available')
    expect(wrapper.get('[data-testid="extra-time-saved"]').text()).toBe('Not available')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).not.toBe('Beyond projection limit')
    expect(wrapper.get('figure svg title').text()).toBe('With one-time payment')
    expect(wrapper.find('.comparison-line').exists()).toBe(false)
  })

  it('does not chart or claim full savings while both plans remain unpaid', async () => {
    mountSimulator([{ ...loan, annualRatePercent: 12, monthlyPaymentCents: 100 }])
    await compare('1')
    expect(wrapper.get('[data-testid="extra-total-payments"]').text()).toBe('Not available')
    expect(wrapper.get('[data-testid="extra-time-saved"]').text()).toBe('Not available')
    expect(wrapper.find('figure').exists()).toBe(false)
    expect(wrapper.find('.schedule').exists()).toBe(false)
  })

  it('labels a negative rounding difference as additional interest rather than positive savings', async () => {
    vi.setSystemTime(new Date(2025, 0, 4, 12))
    mountSimulator([{ ...loan, annualRatePercent: 12 }])
    await compare('0.01')
    expect(wrapper.text()).toContain('ADDITIONAL INTEREST')
    expect(wrapper.get('[data-testid="extra-interest-saved"]').text()).toBe('$0.01')
    expect(wrapper.text()).toContain('very small extra payment can change the estimate')
  })

  it('draws a finite comparison when both plans pay off today', async () => {
    mountSimulator([{ ...loan, nextPaymentDate: loan.balanceDate, monthlyPaymentCents: 200_000 }])
    await compare('1025')
    expect(wrapper.get('[data-testid="extra-time-saved"]').text()).toBe('Same payoff date')
    expect(wrapper.get('figure').html()).not.toMatch(/NaN|Infinity/)
  })
})

describe('monthly and combined payment scenarios', () => {
  it('shows the initial monthly budget without changing the actual loan minimum', async () => {
    mountSimulator([loan, otherLoan])
    await wrapper.get('#extra-monthly-amount').setValue('150.25')
    expect(wrapper.get('[data-testid="monthly-budget"]').text()).toContain('$550.00 minimums + $150.25 extra = $700.25')
    expect(wrapper.text()).toContain('Starts Feb 1, 2025')
    expect(wrapper.text()).toContain('one extra amount for the plan, not per loan')
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(false)
  })

  it('supports a slider and exact amount entry without requiring a one-time payment', async () => {
    mountSimulator()
    const slider = wrapper.get<HTMLInputElement>('#extra-monthly-slider')
    await slider.setValue('100')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('100')
    expect(slider.attributes('aria-valuetext')).toBe('$100.00 extra per month')
    await wrapper.get('#extra-monthly-amount').setValue('1750.25')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-slider').element.value).toBe('1750.25')
    expect(Number(slider.attributes('max'))).toBeGreaterThanOrEqual(1750.25)
    await wrapper.get('.scenario-form').trigger('submit')
    expect(wrapper.get('[data-scenario-id="monthly"] button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Feb 1, 2025')
    expect(wrapper.find('.allocation').exists()).toBe(false)
  })

  it('shows all four plans and defaults to the combined plan when both inputs are positive', async () => {
    mountSimulator()
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await compare('300')
    expect(wrapper.findAll('[data-scenario-id]')).toHaveLength(4)
    expect(wrapper.get('[data-scenario-id="combined"] button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Mar 1, 2025')
    expect(wrapper.get('[data-testid="extra-time-saved"]').text()).toBe('2 months sooner')
    expect(wrapper.get('[data-testid="extra-total-payments"]').text()).toBe('$1,025.00')
    expect(wrapper.get('[data-scenario-id="minimum"]').text()).toContain('May 1, 2025')
    expect(wrapper.get('[data-scenario-id="one-time"]').text()).toContain('Apr 1, 2025')
    expect(wrapper.get('[data-scenario-id="monthly"]').text()).toContain('Apr 1, 2025')
    expect(wrapper.get('[data-testid="monthly-budget-note"]').text()).toContain('$400.00 per month')
    expect(wrapper.text()).toContain('Minimum-only and one-time-only plans do not roll payments over')
  })

  it('switches the inspected plan without recalculating or discarding either input', async () => {
    mountSimulator()
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await compare('300')
    await wrapper.get('[data-scenario-id="monthly"] button').trigger('click')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Apr 1, 2025')
    expect(wrapper.get('figure svg').text()).toContain('With extra monthly payments')
    expect(wrapper.get('.schedule').text()).toContain('Monthly extra / rollover')
    expect(wrapper.find('.allocation').exists()).toBe(false)
    await wrapper.get('[data-scenario-id="one-time"] button').trigger('click')
    expect(wrapper.get('figure svg').text()).toContain('With one-time payment')
    expect(wrapper.get('[data-testid="extra-to-principal"]').text()).toBe('$275.00')
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('300')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('100')
  })

  it.each(['-1', '', '1.234', '1e3', '1,000', '10000000.01'])('rejects invalid extra monthly amounts: %s', async (amount) => {
    mountSimulator()
    await wrapper.get('#extra-monthly-amount').setValue(amount)
    await compare('0')
    expect(wrapper.find('#extra-monthly-error').exists()).toBe(true)
    expect(document.activeElement).toBe(wrapper.get('#extra-monthly-amount').element)
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(false)
  })

  it('labels unapplied monthly edits and preserves the previous results until update', async () => {
    mountSimulator()
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await compare('300')
    await wrapper.get('#extra-monthly-amount').setValue('500')
    expect(wrapper.text()).toContain('results below still show your last comparison')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Mar 1, 2025')
    expect(wrapper.get('[data-testid="monthly-budget-note"]').text()).toContain('$400.00 per month')
    await wrapper.get('.scenario-form').trigger('submit')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Feb 1, 2025')
    expect(wrapper.get('[data-testid="monthly-budget-note"]').text()).toContain('$800.00 per month')
  })

  it('keeps all four zero-input plans equal and disables rollover', async () => {
    mountSimulator([loan, otherLoan])
    await wrapper.get('.scenario-form').trigger('submit')
    expect(wrapper.text()).toContain('Rollover is off')
    for (const plan of wrapper.findAll('[data-scenario-id]')) {
      expect(plan.text()).toContain('May 1, 2025')
      expect(plan.text()).toContain('$1,525.00')
      expect(plan.text()).toContain('Same payoff date')
    }
  })

  it('lets a monthly plan have a complete payoff without inventing savings against an unpaid baseline', async () => {
    mountSimulator([{ ...loan, annualRatePercent: 12, monthlyPaymentCents: 100 }])
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await wrapper.get('.scenario-form').trigger('submit')
    expect(wrapper.get('[data-testid="extra-interest-saved"]').text()).toBe('Not available')
    expect(wrapper.get('[data-testid="extra-time-saved"]').text()).toBe('Not available')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).not.toBe('Beyond projection limit')
    expect(wrapper.get('figure svg title').text()).toBe('With extra monthly payments')
    await wrapper.get('[data-scenario-id="one-time"] button').trigger('click')
    expect(wrapper.find('figure').exists()).toBe(false)
    expect(wrapper.get('[data-testid="extra-total-payments"]').text()).toBe('Not available')
  })

  it('clears both extra-payment controls and the four-plan comparison', async () => {
    mountSimulator()
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await compare('300')
    await wrapper.get('.result-heading button').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('0')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('0')
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(false)
  })
})
