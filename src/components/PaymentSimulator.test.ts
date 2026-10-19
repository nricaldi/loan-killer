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

function mountSimulator(loans: LoanRecord[] = [loan], embedded = false) {
  wrapper = mount(PaymentSimulator, { props: { loans, embedded }, attachTo: document.body })
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
    expect(wrapper.text()).not.toContain('WHAT-IF · NOT A REAL PAYMENT')
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
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

  it('updates one-time results live when the amount changes', async () => {
    mountSimulator()
    await compare('300')
    await wrapper.get('#extra-payment-amount').setValue('2000')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Jan 1, 2025')
    expect(wrapper.text()).not.toContain('last valid comparison')
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
  it('keeps the unified summary in sync with plans selected in the comparison section', async () => {
    mountSimulator([loan], true)
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await wrapper.get('#extra-payment-amount').setValue('300')
    expect(wrapper.findAll('#extra-payment .payment-summary')).toHaveLength(1)
    expect(wrapper.find('.live-result').exists()).toBe(false)
    expect(wrapper.get('[data-testid="plan-interest-saved"]').text()).toBe(wrapper.get('[data-testid="extra-interest-saved"]').text())
    expect(wrapper.get('[data-testid="plan-time-saved"]').text()).toBe('2 months sooner')
    expect(wrapper.get('[data-testid="monthly-budget"]').element.closest('.payment-summary')).not.toBeNull()
    await wrapper.get('[data-scenario-id="monthly"] button').trigger('click')
    expect(wrapper.get('.payment-summary h3').text()).toBe('With $100.00 extra each month')
    expect(wrapper.get('[data-testid="plan-time-saved"]').text()).toBe('1 month sooner')
    await wrapper.get('[data-scenario-id="one-time"] button').trigger('click')
    expect(wrapper.get('.payment-summary h3').text()).toBe('With $300.00 toward Undergraduate loan today')
    expect(wrapper.get('[data-testid="monthly-budget"]').text()).toContain('$0.00 extra = $300.00')
    expect(wrapper.get('[data-testid="plan-interest-saved"]').text()).toBe(wrapper.get('[data-testid="extra-interest-saved"]').text())
  })

  it('preserves the last valid summary and budget while invalid edits are clearly flagged', async () => {
    mountSimulator([loan], true)
    await wrapper.get('#extra-monthly-amount').setValue('100')
    const summary = wrapper.get('.payment-summary').text()
    const input = wrapper.get<HTMLInputElement>('#extra-monthly-amount')
    input.element.focus()
    await input.setValue('1.234')
    expect(wrapper.get('.payment-summary').text()).toBe(summary)
    expect(wrapper.get('[data-testid="monthly-budget"]').text()).toContain('$100.00 extra = $400.00')
    expect(wrapper.text()).toContain('last valid comparison')
    expect(document.activeElement).toBe(input.element)
    await wrapper.get('.payment-summary button').trigger('click')
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    expect(wrapper.get('.summary-placeholder [data-testid="monthly-budget"]').text()).toContain('$0.00 extra = $300.00')
    expect(document.activeElement).toBe(input.element)
  })

  it('emits a live chart preview and clears it on reset and unmount', async () => {
    mountSimulator()
    await wrapper.get('#extra-monthly-amount').setValue('100')
    const emitted = wrapper.emitted('preview')?.at(-1)
    expect(emitted?.[0]).toMatchObject({ projection: { payoffDate: '2025-04-01' } })
    expect(emitted?.[1]).toBe('With extra monthly payments · Highest rate first')
    await wrapper.get('.result-heading button').trigger('click')
    expect(wrapper.emitted('preview')?.at(-1)?.[0]).toBeNull()
    wrapper.unmount()
    expect(wrapper.emitted('preview')?.at(-1)).toEqual([null, ''])
  })

  it('labels invalid live input while preserving the last valid comparison without stealing focus', async () => {
    mountSimulator()
    await wrapper.get('#extra-monthly-amount').setValue('100')
    const field = wrapper.get<HTMLInputElement>('#extra-monthly-amount')
    field.element.focus()
    await field.setValue('1.234')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Apr 1, 2025')
    expect(wrapper.text()).toContain('last valid comparison')
    expect(document.activeElement).toBe(field.element)
  })

  it('shows the initial monthly budget without changing the actual loan minimum', async () => {
    mountSimulator([loan, otherLoan])
    await wrapper.get('#extra-monthly-amount').setValue('150.25')
    expect(wrapper.get('[data-testid="monthly-budget"]').text()).toContain('$550.00 minimums + $150.25 extra = $700.25')
    expect(wrapper.text()).toContain('Starts Feb 1, 2025')
    expect(wrapper.text()).toContain('one extra amount for the plan, not per loan')
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(true)
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

  it('updates monthly results and budget live without submitting', async () => {
    mountSimulator()
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await compare('300')
    await wrapper.get('#extra-monthly-amount').setValue('500')
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
    expect(wrapper.get('figure svg title').text()).toBe('With extra monthly payments · Highest rate first')
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

const strategyLoans: LoanRecord[] = [
  { ...loan, principalCents: 100_000, accruedInterestCents: 0, annualRatePercent: 12, monthlyPaymentCents: 10_000 },
  { ...otherLoan, principalCents: 20_000, accruedInterestCents: 0, annualRatePercent: 3, monthlyPaymentCents: 5_000 },
]

describe('strategy selection and milestones', () => {
  it('shows the first actual monthly allocation beside the budget and updates it with the strategy', async () => {
    mountSimulator(strategyLoans, true)
    expect(wrapper.find('.strategy-field .strategy-picker').exists()).toBe(true)
    expect(wrapper.get('.strategy-target').text()).toContain('Add an extra monthly budget')
    await wrapper.get('#extra-monthly-amount').setValue('50')
    expect(wrapper.get('.strategy-target').text()).toContain('Feb 1, 2025')
    expect(wrapper.get('.strategy-target li').text()).toBe('Undergraduate loan$50.00')
    await wrapper.get('input[type="radio"][value="smallest-balance"]').setValue()
    expect(wrapper.get('.strategy-target li').text()).toBe('Graduate loan$50.00')
    await wrapper.get('#extra-monthly-amount').setValue('0')
    expect(wrapper.find('.strategy-target li').exists()).toBe(false)
  })

  it('updates the monthly target after a one-time payment retires the highest-rate loan', async () => {
    mountSimulator(strategyLoans, true)
    await wrapper.get('#extra-monthly-amount').setValue('50')
    await wrapper.get('#extra-payment-amount').setValue('1000')
    expect(wrapper.get('.strategy-target li').text()).toBe('Graduate loan$150.00')
    expect(wrapper.get('.strategy-target').text()).toContain('freed minimums')
  })

  it('skips loans paid off by their minimum before choosing a smallest-balance target', async () => {
    mountSimulator([strategyLoans[0]!, { ...otherLoan, principalCents: 5000, monthlyPaymentCents: 5000, nextPaymentDate: loan.nextPaymentDate }], true)
    await wrapper.get('input[type="radio"][value="smallest-balance"]').setValue()
    await wrapper.get('#extra-monthly-amount').setValue('50')
    expect(wrapper.get('.strategy-target li strong').text()).toBe('Undergraduate loan')
  })

  it('shows all first-date recipients when the monthly budget pays across multiple loans', async () => {
    mountSimulator(strategyLoans, true)
    await wrapper.get('#extra-monthly-amount').setValue('1500')
    expect(wrapper.findAll('.strategy-target li strong').map((target) => target.text())).toEqual(['Undergraduate loan', 'Graduate loan'])
  })

  it('does not claim a monthly target when the one-time payment already retires every loan', async () => {
    mountSimulator([loan], true)
    await wrapper.get('#extra-payment-amount').setValue('2000')
    await wrapper.get('#extra-monthly-amount').setValue('100')
    expect(wrapper.find('.strategy-target li').exists()).toBe(false)
    expect(wrapper.get('.strategy-target').text()).toContain('No active balance remains')
  })

  it('keeps comparison plans outside the payment controls and still synchronizes their strategy choices', async () => {
    mountSimulator(strategyLoans, true)
    await wrapper.get('#extra-monthly-amount').setValue('50')
    expect(wrapper.get('.plan-comparison').element.closest('#extra-payment')).toBeNull()
    await wrapper.get('[data-strategy-id="smallest-balance"] button').trigger('click')
    expect(wrapper.get('.strategy-target li strong').text()).toBe('Graduate loan')
  })

  it('combines one-time and monthly payments into one live summary with a shared budget', async () => {
    mountSimulator(strategyLoans, true)
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    await wrapper.get('#extra-payment-amount').setValue('100')
    const firstImpact = wrapper.get('.payment-summary').text()
    expect(firstImpact).toContain('You’ll save in interest')
    expect(firstImpact).toContain('Debt-free across all loans')
    await wrapper.get('#extra-monthly-amount').setValue('50')
    expect(wrapper.get('.payment-summary').text()).not.toBe(firstImpact)
    expect(wrapper.get('.payment-summary h3').text()).toContain('$50.00 extra each month')
    expect(wrapper.findAll('.payment-summary')).toHaveLength(1)
    expect(wrapper.find('.one-time-impact').exists()).toBe(false)
    expect(wrapper.get('[data-testid="monthly-budget"]').element.closest('.payment-summary')).not.toBeNull()
    await wrapper.get('#extra-payment-target').setValue(otherLoan.id)
    expect(wrapper.get('.payment-summary').text()).toContain('$100.00 applied to Graduate loan')
    await wrapper.get('#extra-payment-amount').setValue('0')
    expect(wrapper.get('.payment-summary h3').text()).toBe('With $50.00 extra each month')
  })

  it('exposes one-time controls and strategy cards without requiring disclosure or refresh', async () => {
    mountSimulator(strategyLoans, true)
    expect(wrapper.get('#extra-payment-amount').element.closest('details')).toBeNull()
    expect(wrapper.get('#extra-payment-target').element.closest('details')).toBeNull()
    expect(wrapper.get('.strategy-picker').element.closest('details')).toBeNull()
    expect(wrapper.find('button[type="submit"]').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Refresh comparison')
    await wrapper.get('#extra-payment-amount').setValue('100')
    const firstTotal = wrapper.get('.payment-summary').text()
    expect(firstTotal).toContain('$100.00 applied to Undergraduate loan')
    const firstPreview = wrapper.emitted('preview')?.at(-1)?.[0]
    await wrapper.get('#extra-payment-target').setValue(otherLoan.id)
    expect(wrapper.get('.payment-summary').text()).toContain('$100.00 applied to Graduate loan')
    expect(wrapper.get('.payment-summary').text()).not.toBe(firstTotal)
    expect(wrapper.emitted('preview')?.at(-1)?.[0]).not.toEqual(firstPreview)
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('100')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('0')
  })

  it('updates combined previews immediately from radio cards without changing the lump-sum target', async () => {
    mountSimulator(strategyLoans, true)
    await wrapper.get('#extra-payment-amount').setValue('25')
    await wrapper.get('#extra-monthly-amount').setValue('50')
    const before = wrapper.get('.payment-summary').text()
    await wrapper.get('input[type="radio"][value="smallest-balance"]').setValue()
    expect(wrapper.get('.payment-summary').text()).not.toBe(before)
    expect(wrapper.get<HTMLSelectElement>('#extra-payment-target').element.value).toBe(loan.id)
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('25')
    expect(wrapper.get('[data-scenario-id="combined"] button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.emitted('preview')?.at(-1)?.[1]).toContain('Smallest balance first')
  })

  it('shows excess one-time money as unused next to the controls', async () => {
    mountSimulator([loan], true)
    await wrapper.get('#extra-payment-amount').setValue('2000')
    expect(wrapper.get('.payment-summary').text()).toContain('$1,025.00 applied to Undergraduate loan')
    expect(wrapper.get('.payment-summary').text()).toContain('$975.00 unused; it isn’t moved to another loan')
  })

  it('compares the same budget and displays the measured interest-versus-first-payoff tradeoff', async () => {
    mountSimulator(strategyLoans)
    await wrapper.get('#extra-monthly-amount').setValue('50')
    await compare('0')
    expect(wrapper.get('[data-testid="monthly-budget-note"]').text()).toContain('$200.00 per month')
    expect(wrapper.get('[data-strategy-id="highest-rate"]').text()).toContain('$40.17')
    expect(wrapper.get('[data-strategy-id="highest-rate"]').text()).toContain('Jun 15, 2025')
    expect(wrapper.get('[data-strategy-id="smallest-balance"]').text()).toContain('$42.12')
    expect(wrapper.get('[data-strategy-id="smallest-balance"]').text()).toContain('Apr 1, 2025')
    expect(wrapper.get('[data-testid="strategy-difference"]').text()).toContain('Highest rate first costs $1.95 less interest')
    expect(wrapper.get('[data-testid="strategy-difference"]').text()).toContain('same debt-free date')
    expect(wrapper.findAll('[data-milestone-date]')[0]?.attributes('data-milestone-date')).toBe('2025-06-15')
    expect(wrapper.get('[data-testid="extra-total-payments"]').text()).toBe('$1,240.17')
  })

  it('applies a strategy selected in the form and updates the chart and payoff timeline', async () => {
    mountSimulator(strategyLoans)
    await wrapper.get('input[type="radio"][value="smallest-balance"]').setValue()
    await wrapper.get('#extra-monthly-amount').setValue('50')
    await compare('0')
    expect(wrapper.get('[data-strategy-id="smallest-balance"] button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="extra-total-payments"]').text()).toBe('$1,242.12')
    expect(wrapper.get('figure svg').text()).toContain('Smallest balance first')
    expect(wrapper.findAll('[data-milestone-date]')[0]?.attributes('data-milestone-date')).toBe('2025-04-01')
    expect(wrapper.get('[data-testid="monthly-budget-note"]').text()).toContain('smallest current balance')
  })

  it('switches cached strategies while preserving the selected scenario and the baseline', async () => {
    mountSimulator(strategyLoans)
    await wrapper.get('#extra-monthly-amount').setValue('50')
    await compare('0')
    const baseline = wrapper.get('[data-scenario-id="minimum"]').text()
    const oneTime = wrapper.get('[data-scenario-id="one-time"]').text()
    await wrapper.get('[data-strategy-id="smallest-balance"] button').trigger('click')
    expect(wrapper.get<HTMLInputElement>('input[type="radio"][value="smallest-balance"]').element.checked).toBe(true)
    expect(wrapper.get('[data-scenario-id="monthly"] button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-scenario-id="minimum"]').text()).toBe(baseline)
    expect(wrapper.get('[data-scenario-id="one-time"]').text()).toBe(oneTime)
    expect(wrapper.get('[data-testid="extra-total-payments"]').text()).toBe('$1,242.12')
    expect(wrapper.get('[role="status"]').text()).toContain('Smallest balance first')
    expect(wrapper.text()).not.toContain('Inputs changed.')
  })

  it('uses the current live budget when inspecting another strategy', async () => {
    mountSimulator(strategyLoans)
    await wrapper.get('#extra-monthly-amount').setValue('50')
    await compare('0')
    await wrapper.get('#extra-monthly-amount').setValue('1000')
    await wrapper.get('[data-strategy-id="smallest-balance"] button').trigger('click')
    expect(wrapper.text()).not.toContain('last valid comparison')
    expect(wrapper.get('[data-testid="monthly-budget-note"]').text()).toContain('$1,150.00 per month')
    expect(wrapper.get('[data-testid="extra-total-payments"]').text()).toBe('$1,211.49')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('1000')
  })

  it('updates milestones and results live when the strategy changes', async () => {
    mountSimulator(strategyLoans)
    await wrapper.get('#extra-monthly-amount').setValue('50')
    await compare('0')
    await wrapper.get('input[type="radio"][value="smallest-balance"]').setValue()
    expect(wrapper.get('[data-strategy-id="smallest-balance"] button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('[data-milestone-date]')[0]?.attributes('data-milestone-date')).toBe('2025-04-01')
  })

  it('explains why zero monthly extra and one-time-only plans do not change by strategy', async () => {
    mountSimulator(strategyLoans)
    await wrapper.get('input[type="radio"][value="smallest-balance"]').setValue()
    await compare('100')
    expect(wrapper.text()).toContain('changing strategy does not change any payment')
    expect(wrapper.find('[data-strategy-id]').exists()).toBe(false)
    await wrapper.get('#extra-monthly-amount').setValue('50')
    await wrapper.get('.scenario-form').trigger('submit')
    await wrapper.get('[data-scenario-id="one-time"] button').trigger('click')
    expect(wrapper.text()).toContain('Strategy doesn’t change the one-time target')
    expect(wrapper.find('[data-strategy-id]').exists()).toBe(false)
    const compareMonthly = wrapper.findAll('.comparison-links button').find((button) => button.text() === 'Compare monthly strategies')
    await compareMonthly?.trigger('click')
    expect(wrapper.findAll('[data-strategy-id]')).toHaveLength(2)
  })

  it('shows that either strategy has identical results when there is only one loan', async () => {
    mountSimulator()
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await compare('0')
    expect(wrapper.get('[data-testid="strategy-difference"]').text()).toContain('same estimated remaining interest')
    expect(wrapper.text()).toContain('With one loan, allocation order can’t change the result')
  })

  it('keeps unresolved loans separate from known milestones and withholds a cost winner', async () => {
    mountSimulator([
      { ...loan, principalCents: 1_000_000_000, accruedInterestCents: 0, annualRatePercent: 100, monthlyPaymentCents: 1 },
      { ...otherLoan, principalCents: 100, monthlyPaymentCents: 100 },
    ])
    await wrapper.get('#extra-monthly-amount').setValue('0.01')
    await compare('0')
    expect(wrapper.get('[data-testid="strategy-difference"]').text()).toContain('Complete payoff estimates are needed')
    expect(wrapper.get('[data-testid="unresolved-milestones"]').text()).toContain('Undergraduate loan')
    expect(wrapper.findAll('[data-milestone-date]')).toHaveLength(1)
    expect(wrapper.get('[data-testid="payoff-milestones"]').text()).toContain('1 loan remaining')
    expect(wrapper.find('.finish-milestone').exists()).toBe(false)
  })

  it('derives the cost winner instead of assuming highest rate is always cheapest', async () => {
    mountSimulator([
      { ...loan, principalCents: 0, accruedInterestCents: 100_600, annualRatePercent: 100, monthlyPaymentCents: 1_000 },
      { ...otherLoan, principalCents: 10_000, annualRatePercent: 12, monthlyPaymentCents: 1_000 },
    ])
    await wrapper.get('#extra-monthly-amount').setValue('50')
    await compare('0')
    expect(wrapper.get('[data-testid="strategy-difference"]').text()).toContain('Smallest balance first costs')
    expect(wrapper.get('[data-testid="strategy-difference"]').text()).toContain('Smallest balance first finishes 14 days sooner')
  })

  it('compares calendar finish dates in the correct direction when strategies finish on different days', async () => {
    mountSimulator([{ ...strategyLoans[0]!, principalCents: 96_200 }, strategyLoans[1]!])
    await wrapper.get('#extra-monthly-amount').setValue('50')
    await compare('0')
    expect(wrapper.get('[data-testid="strategy-difference"]').text()).toContain('Highest rate first finishes 17 days sooner')
  })

  it('resets strategy, results, and milestones when clearing the scenario', async () => {
    mountSimulator(strategyLoans)
    await wrapper.get('input[type="radio"][value="smallest-balance"]').setValue()
    await wrapper.get('#extra-monthly-amount').setValue('50')
    await compare('0')
    await wrapper.get('.result-heading button').trigger('click')
    expect(wrapper.get<HTMLInputElement>('input[type="radio"][value="highest-rate"]').element.checked).toBe(true)
    expect(wrapper.find('[data-testid="payoff-milestones"]').exists()).toBe(false)
  })
})
