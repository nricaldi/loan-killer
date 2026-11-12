import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { LoanRecord } from '../domain/portfolio'
import PaymentSimulator from './PaymentSimulator.vue'

const loan: LoanRecord = {
  id: 'loan-a', fromExample: false, name: 'Undergraduate loan', type: 'unsubsidized',
  principalCents: 100000, accruedInterestCents: 2500, annualRatePercent: 0,
  monthlyPaymentCents: 30000, balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}
const other: LoanRecord = { ...loan, id: 'loan-b', name: 'Graduate loan', principalCents: 50000, accruedInterestCents: 0, monthlyPaymentCents: 25000, nextPaymentDate: '2025-02-15' }
let wrapper: VueWrapper
function render(loans = [loan]) {
  wrapper = mount(PaymentSimulator, { props: { loans }, attachTo: document.body })
}
async function oneTime(amount = '300') {
  if (wrapper.get('.one-time-choice').attributes('aria-expanded') === 'false') await wrapper.get('.one-time-choice').trigger('click')
  await wrapper.get('#extra-payment-amount').setValue(amount)
}
async function monthly(amount = '100') {
  if (wrapper.get('.monthly-choice').attributes('aria-expanded') === 'false') await wrapper.get('.monthly-choice').trigger('click')
  await wrapper.get('#extra-monthly-amount').setValue(amount)
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2025, 0, 1, 12)) })
afterEach(() => { wrapper.unmount(); vi.useRealTimers() })

describe('guided payment exploration', () => {
  it('starts with two choices and no empty form or zero-impact result', () => {
    render()
    expect(wrapper.get('#extra-payment-amount').isVisible()).toBe(false)
    expect(wrapper.get('#extra-monthly-amount').isVisible()).toBe(false)
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    expect(wrapper.find('.plan-comparison').exists()).toBe(false)
    expect(wrapper.find('input[type="range"]').exists()).toBe(false)
  })

  it('opens and focuses the chosen control and supports quick amounts', async () => {
    render()
    await wrapper.get('.monthly-choice').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('#extra-monthly-amount').element)
    expect(wrapper.get('#extra-payment-amount').isVisible()).toBe(false)
    await wrapper.get('#monthly-controls .presets button').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('25')
    expect(wrapper.get('.payment-summary h3').text()).toBe('With $25.00 extra each month')
  })

  it('shows actual one-time savings and emits the matching plan without changing loan records', async () => {
    render()
    await oneTime()
    expect(wrapper.get('[data-testid="plan-interest-saved"]').text()).toBe('$0.00')
    expect(wrapper.get('[data-testid="plan-time-saved"]').text()).toBe('1 month sooner')
    expect(wrapper.get('[data-testid="plan-payoff-date"]').text()).toBe('Apr 1, 2025')
    expect(wrapper.get('.payment-summary h3').text()).toBe('With $300.00 toward Undergraduate loan today')
    expect(wrapper.emitted('preview')?.at(-1)?.[1]).toBe('With one-time payment')
    expect(loan.monthlyPaymentCents).toBe(30000)
    expect(loan.principalCents).toBe(100000)
  })

  it('returns to the baseline when extras reach zero, including after scope changes', async () => {
    render([loan, other])
    await oneTime()
    await oneTime('0')
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    expect(wrapper.emitted('preview')?.at(-1)?.[0]).toBeNull()
    await wrapper.setProps({ loans: [other] })
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    expect(wrapper.text()).not.toContain('Same payoff date')
  })

  it('combines both choices and compares four options without duplicate analysis', async () => {
    render()
    await oneTime()
    await monthly()
    expect(wrapper.get('.payment-summary h3').text()).toContain('$300.00 toward Undergraduate loan today and $100.00 extra each month')
    expect(wrapper.get('[data-scenario-id="combined"] button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('[data-scenario-id]')).toHaveLength(4)
    expect(wrapper.find('.savings-grid').exists()).toBe(false)
    expect(wrapper.find('.schedule').exists()).toBe(false)
    expect(wrapper.find('figure').exists()).toBe(false)
    await wrapper.get('[data-scenario-id="monthly"] button').trigger('click')
    expect(wrapper.get('.payment-summary h3').text()).toBe('With $100.00 extra each month')
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('300')
    await wrapper.get('[data-scenario-id="one-time"] button').trigger('click')
    expect(wrapper.get('.payment-summary').text()).toContain('This preview excludes your extra monthly budget')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('100')
  })

  it('compacts both rows without clearing amounts, target, strategy, selection, or preview', async () => {
    render([loan, other])
    await oneTime()
    await monthly()
    await wrapper.get('[data-scenario-id="monthly"] button').trigger('click')
    const preview = wrapper.emitted('preview')?.at(-1)
    const summary = wrapper.get('.payment-summary').text()
    await wrapper.get('.compact-all').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('.monthly-choice').element)
    expect(wrapper.get('#extra-payment-amount').isVisible()).toBe(false)
    expect(wrapper.get('#extra-monthly-amount').isVisible()).toBe(false)
    expect(wrapper.get('.one-time-choice .option-amount').text()).toBe('$300.00')
    expect(wrapper.get('.monthly-choice .option-amount').text()).toBe('$100.00/mo')
    expect(wrapper.get('.payment-summary').text()).toBe(summary)
    expect(wrapper.emitted('preview')?.at(-1)).toBe(preview)
    await wrapper.get('.one-time-choice').trigger('click')
    await wrapper.get('.monthly-choice').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('300')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('100')
    expect(wrapper.find('#extra-payment-target').exists()).toBe(false)
    expect(wrapper.find('.strategy-picker').exists()).toBe(false)
    expect(wrapper.get('[data-scenario-id="monthly"] button').attributes('aria-pressed')).toBe('true')
  })

  it('clears a focused zero without generating an invalid-input error or changing the last preview', async () => {
    render()
    await oneTime()
    const summary = wrapper.get('.payment-summary').text()
    const preview = wrapper.emitted('preview')?.at(-1)
    await wrapper.get('.monthly-choice').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('')
    expect(wrapper.get('#extra-monthly-amount').attributes('aria-invalid')).toBe('false')
    expect(wrapper.get('.payment-summary').text()).toBe(summary)
    expect(wrapper.emitted('preview')?.at(-1)).toBe(preview)
    wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.blur()
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('0')
  })

  it.each(['-1', '', '1.234', '1e3', '1,000', '10000000.01'])('rejects invalid monthly amounts without replacing the last valid result: %s', async (value) => {
    render()
    await monthly()
    const result = wrapper.get('.payment-summary').text()
    const field = wrapper.get<HTMLInputElement>('#extra-monthly-amount')
    field.element.focus()
    await field.setValue(value)
    expect(field.attributes('aria-invalid')).toBe('true')
    expect(wrapper.get('.payment-summary').text()).toBe(result)
    expect(wrapper.text()).toContain('last valid comparison')
    expect(document.activeElement).toBe(field.element)
  })

  it('focuses an invalid one-time amount on submission', async () => {
    render()
    await oneTime('-1')
    await wrapper.get('.scenario-form').trigger('submit')
    expect(document.activeElement).toBe(wrapper.get('#extra-payment-amount').element)
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
  })

  it('keeps an oversized payment visibly unused instead of redirecting it', async () => {
    render([loan, other])
    await oneTime('2000')
    expect(wrapper.get('.payment-summary').text()).toContain('$975.00 unused; it isn’t moved to another loan')
    expect(wrapper.get('.payment-summary h3').text()).toBe('With $1,025.00 toward Undergraduate loan today')
  })

  it('replaces excluded targets while preserving amounts when loan scope changes', async () => {
    render([loan, other])
    await oneTime('100')
    await monthly('50')
    await wrapper.setProps({ loans: [other] })
    expect(wrapper.find('#extra-payment-target').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('100')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('50')
    expect(wrapper.get('.payment-summary h3').text()).toContain('Graduate loan')
    expect(wrapper.find('.strategy-field').exists()).toBe(false)
  })

  it('recommends the better one-time loan without asking the user to choose a target', async () => {
    render([
      { ...loan, principalCents: 0, accruedInterestCents: 100000, annualRatePercent: 100, monthlyPaymentCents: 1000 },
      { ...other, principalCents: 10000, annualRatePercent: 12, monthlyPaymentCents: 1000 },
    ])
    await oneTime('50')
    expect(wrapper.findAll('select')).toHaveLength(0)
    expect(wrapper.get('.one-time-recommendation').text()).toContain('Pay $50.00 toward Graduate loan today')
    expect(wrapper.get('.payment-summary h3').text()).toContain('Graduate loan')
    expect(wrapper.get('.recommendation-details .recommended').text()).toContain('Graduate loan')
    expect(wrapper.findAll('.recommendation-details tbody tr')).toHaveLength(2)
  })

  it('automatically compares monthly methods and shows where the first extra payment goes', async () => {
    render([
      { ...loan, principalCents: 0, accruedInterestCents: 100000, annualRatePercent: 100, monthlyPaymentCents: 1000 },
      { ...other, principalCents: 10000, annualRatePercent: 12, monthlyPaymentCents: 1000 },
    ])
    await monthly('50')
    expect(wrapper.get('.monthly-recommendation').text()).toContain('$50.00 to Graduate loan')
    expect(wrapper.get('.recommendation-details .recommended').text()).toContain('Smallest balance first')
    await wrapper.get('#extra-monthly-amount').setValue('100')
    expect(wrapper.get('.monthly-recommendation').text()).toContain('$100.00 to Graduate loan')
    expect(wrapper.get('[data-testid="monthly-budget"]').text()).toContain('$20.00 minimums + $100.00 extra = $120.00')
    expect(wrapper.findAll('select')).toHaveLength(0)
  })

  it('shows the cost/time tradeoff instead of claiming the lowest-interest target is also fastest', async () => {
    render([
      { ...loan, accruedInterestCents: 0, annualRatePercent: 24, monthlyPaymentCents: 20000 },
      { ...other, principalCents: 100000, annualRatePercent: 1, monthlyPaymentCents: 1000 },
    ])
    await oneTime('100')
    expect(wrapper.get('.one-time-recommendation').text()).toContain('Undergraduate loan')
    expect(wrapper.get('.tradeoff').text()).toBe('An alternative finishes 11 months sooner for $2.85 more interest.')
  })

  it('does not call an incomplete allocation a lowest-cost recommendation', async () => {
    render([{ ...loan, principalCents: 1000000000, annualRatePercent: 100, monthlyPaymentCents: 1 }, other])
    await monthly('0.01')
    expect(wrapper.get('.monthly-recommendation').text()).toContain('No complete payoff estimate yet')
    expect(wrapper.get('.recommendation-details').text()).toContain('not a lowest-cost recommendation')
    expect(wrapper.find('[data-testid="plan-interest-saved"]').exists()).toBe(false)
  })

  it('shows a payable monthly plan without fabricating savings against an unpaid baseline', async () => {
    render([{ ...loan, monthlyPaymentCents: 0 }])
    await monthly()
    expect(wrapper.find('[data-testid="plan-interest-saved"]').exists()).toBe(false)
    expect(wrapper.get('[data-testid="plan-total-payments"]').text()).toBe('$1,025.00')
    expect(wrapper.get('.payment-summary').text()).toContain('savings aren’t available')
  })

  it('blocks unknown payment history and refreshes today when comparing after midnight', async () => {
    render()
    await oneTime()
    vi.setSystemTime(new Date(2025, 0, 2, 12))
    await oneTime('100')
    expect(wrapper.emitted('preview')?.at(-1)?.[0]).not.toBeNull()
    vi.setSystemTime(new Date(2025, 2, 1, 12))
    await oneTime('200')
    expect(wrapper.get('[role="alert"]').text()).toContain('Update')
    expect(wrapper.text()).toContain('last valid comparison')
  })

  it('clears both choices, the preview, and errors and restores focus to exploration', async () => {
    render()
    await oneTime()
    await monthly()
    await wrapper.get('.payment-summary button').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('0')
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('0')
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    expect(wrapper.get('.monthly-choice').attributes('aria-expanded')).toBe('false')
    expect(document.activeElement).toBe(wrapper.get('.monthly-choice').element)
    expect(wrapper.emitted('preview')?.at(-1)?.[0]).toBeNull()
  })
})
