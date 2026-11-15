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
  await wrapper.get('#extra-payment-amount').setValue(amount)
}
async function monthly(amount = '100') {
  await wrapper.get('#extra-monthly-amount').setValue(amount)
}
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(new Date(2025, 0, 1, 12)) })
afterEach(() => { wrapper.unmount(); vi.useRealTimers() })

describe('guided payment exploration', () => {
  it('starts with two choices and no empty form or zero-impact result', () => {
    render()
    expect(wrapper.find('#extra-payment-amount').exists()).toBe(true)
    expect(wrapper.find('#extra-monthly-amount').exists()).toBe(true)
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    expect(wrapper.find('.plan-comparison').exists()).toBe(false)
    expect(wrapper.findAll('input[type="range"]')).toHaveLength(3)
  })

  it('opens and focuses the chosen control and supports quick amounts', async () => {
    render()
    wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.focus()
    expect(wrapper.find('#extra-payment-amount').exists()).toBe(true)
    await wrapper.get('[aria-label="Extra monthly payment slider"]').setValue('25')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('25')
    expect(wrapper.get('.payment-summary h3').text()).toBe('With $25.00 extra each month')
  })

  it('shows actual one-time savings and emits the matching plan without changing loan records', async () => {
    render()
    await oneTime()
    expect(wrapper.find('.impact-highlight').exists()).toBe(false)
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

  it('clears a focused zero without generating an invalid-input error or changing the last preview', async () => {
    render()
    await oneTime()
    const summary = wrapper.get('.payment-summary').text()
    const preview = wrapper.emitted('preview')?.at(-1)
    wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.focus()
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('')
    expect(wrapper.get('#extra-monthly-amount').attributes('aria-invalid')).toBe('false')
    expect(wrapper.get('.payment-summary').text()).toBe(summary)
    expect(wrapper.emitted('preview')?.at(-1)).toBe(preview)
    wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.blur()
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('0')
  })

  it.each(['-1', '1.234', '1e3', '1,000', '10000000.01'])('rejects invalid monthly amounts without replacing the last valid result: %s', async (value) => {
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
    expect(wrapper.find('.one-time-recommendation').exists()).toBe(false)
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
    expect(wrapper.get('.payment-summary h3').text()).toContain('Undergraduate loan')
    expect(wrapper.get('.tradeoff').text()).toBe('An alternative finishes 11 months sooner for $2.85 more interest.')
  })

  it('does not call an incomplete allocation a lowest-cost recommendation', async () => {
    render([{ ...loan, principalCents: 1000000000, annualRatePercent: 100, monthlyPaymentCents: 1 }, other])
    await monthly('0.01')
    expect(wrapper.find('.impact-highlight').exists()).toBe(false)
    expect(wrapper.get('.recommendation-details').text()).toContain('not a lowest-cost recommendation')
    expect(wrapper.find('[data-testid="plan-interest-saved"]').exists()).toBe(false)
  })

  it('shows a payable monthly plan without fabricating savings against an unpaid baseline', async () => {
    render([{ ...loan, monthlyPaymentCents: 0 }])
    await monthly()
    expect(wrapper.find('[data-testid="plan-interest-saved"]').exists()).toBe(false)
    expect(wrapper.find('.impact-highlight').exists()).toBe(false)
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

  it('clears the preview when both amounts return to zero', async () => {
    render()
    await oneTime()
    await monthly()
    await wrapper.get('#extra-payment-amount').setValue('0')
    await wrapper.get('#extra-monthly-amount').setValue('0')
    expect(wrapper.find('#extra-monthly-amount').exists()).toBe(true)
    expect(wrapper.find('#extra-payment-amount').exists()).toBe(true)
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    expect(wrapper.findAll('.saving-card')).toHaveLength(2)
    expect(wrapper.emitted('preview')?.at(-1)?.[0]).toBeNull()
  })
  it('treats cleared tool inputs as zero immediately', async () => {
    render()
    expect(wrapper.find('.reset-tools').exists()).toBe(false)
    await wrapper.get('#extra-payment-amount').setValue('0')
    await wrapper.get('#extra-monthly-amount').setValue('0')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await oneTime('100')
    await monthly('50')
    expect(wrapper.get<HTMLInputElement>('[aria-label="Extra monthly payment slider"]').element.value).toBe('50')
    const recurring = wrapper.get<HTMLInputElement>('#extra-monthly-amount')
    await recurring.setValue('')
    expect(recurring.attributes('aria-invalid')).toBe('false')
    expect(wrapper.get('.payment-summary h3').text()).not.toContain('extra each month')
    expect(wrapper.find('[role="alert"]').exists()).toBe(false)
    await recurring.trigger('blur')
    expect(recurring.element.value).toBe('0')
    await wrapper.get('#extra-payment-amount').setValue('')
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    expect(wrapper.find('.field-error').exists()).toBe(false)
    expect(wrapper.emitted('preview')?.at(-1)?.[0]).toBeNull()
    expect(wrapper.find('.reset-tools').exists()).toBe(false)
  })

  it('solves a payoff month while preserving the one-time payment and cancels pending goals when an amount is edited', async () => {
    render([{ ...loan, principalCents: 100000, accruedInterestCents: 0, annualRatePercent: 6, monthlyPaymentCents: 1000 }])
    await oneTime('100')
    await wrapper.get('#payoff-goal-month').setValue('2026-01')
    expect(wrapper.get('#goal-status').text()).toContain('Calculating')
    await vi.advanceTimersByTimeAsync(121)
    expect(Number(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value)).toBeGreaterThan(0)
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('100')
    const preview = wrapper.emitted('preview')!.at(-1)![0] as { projection: { status: string; payoffDate: string } }
    expect(preview.projection.status).toBe('paid-off')
    expect(preview.projection.payoffDate <= '2026-01-31').toBe(true)
    await wrapper.get('[aria-label="Debt-free date slider"]').setValue('6')
    await wrapper.get('#extra-payment-amount').setValue('0')
    await wrapper.get('#extra-monthly-amount').setValue('0')
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    expect(wrapper.get('#goal-status').text()).toBe('')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('0')
  })

  it('shows impossible goal feedback without replacing the current amounts', async () => {
    render([{ ...loan, nextPaymentDate: '2028-01-01' }])
    await oneTime('1')
    await wrapper.get('#payoff-goal-month').setValue('2025-02')
    await vi.advanceTimersByTimeAsync(121)
    expect(wrapper.get('#goal-status').text()).toContain('Try a later month')
    expect(wrapper.get('#goal-status').classes()).toContain('sr-only')
    expect(wrapper.get('.goal-feedback summary').attributes('aria-label')).toBe('Goal calculation details')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('0')
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('1')
  })

  it('ignores a worker reply after editing an amount has canceled the goal', async () => {
    class GoalWorker {
      static latest: GoalWorker
      onmessage?: (event: { data: unknown }) => void
      onerror?: () => void
      terminate = vi.fn()
      postMessage = vi.fn()
      constructor() { GoalWorker.latest = this }
    }
    vi.stubGlobal('Worker', GoalWorker)
    try {
      render()
      await wrapper.get('#payoff-goal-month').setValue('2025-03')
      await vi.advanceTimersByTimeAsync(121)
      const worker = GoalWorker.latest
      expect(worker.postMessage).toHaveBeenCalledOnce()
      await wrapper.get('#extra-payment-amount').setValue('0')
      await wrapper.get('#extra-monthly-amount').setValue('0')
      expect(worker.terminate).toHaveBeenCalledOnce()
      worker.onmessage?.({ data: { result: { extraMonthlyCents: 99900, payoffDate: '2025-03-01' } } })
      await wrapper.vm.$nextTick()
      expect(wrapper.find('.payment-summary').exists()).toBe(false)
      expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('0')
      expect(wrapper.get('#goal-status').text()).toBe('')
    } finally { vi.unstubAllGlobals() }
  })

})
