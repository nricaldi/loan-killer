import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'

let wrapper: VueWrapper

beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2025, 0, 1, 12))
  wrapper = mount(App, { attachTo: document.body })
})

afterEach(() => {
  wrapper.unmount()
  vi.useRealTimers()
})

async function enterLoan() {
  const fields = {
    '#loan-name': 'Direct Loan 01',
    '#principal': '1000',
    '#accrued-interest': '25',
    '#annual-rate': '0',
    '#monthly-payment': '300',
    '#balance-date': '2025-01-01',
    '#next-payment-date': '2025-02-01',
  }
  for (const [selector, value] of Object.entries(fields)) {
    await wrapper.get(selector).setValue(value)
  }
  await wrapper.get('form').trigger('submit')
}

describe('single-loan baseline', () => {
  it('starts with an empty state and an explicit temporary-storage warning', () => {
    expect(wrapper.text()).toContain('Let’s find yours.')
    expect(wrapper.text()).toContain('Refreshing or closing the page clears them.')
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#balance-date').element.value).toBe('2025-01-01')
  })

  it('validates required fields and focuses the first invalid input', async () => {
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('Check the highlighted fields')
    expect(wrapper.get('#loan-name').attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(wrapper.get('#loan-name').element)
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(false)
  })

  it('shows payoff date, interest, total payments, chart, and a complete schedule', async () => {
    await enterLoan()
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
    expect(wrapper.get('[data-testid="remaining-interest"]').text()).toBe('$25.00')
    expect(wrapper.get('[data-testid="total-payments"]').text()).toBe('$1,025.00')
    expect(wrapper.get('figure svg[role="img"]').text()).toContain('This is a projection, not actual payment history.')
    expect(wrapper.findAll('tbody tr')).toHaveLength(4)
    expect(wrapper.findAll('tbody tr').at(-1)?.text()).toContain('$125.00')
    expect(wrapper.findAll('tbody tr').at(-1)?.text()).toContain('$0.00')
    expect(wrapper.get('[aria-live="polite"]').text()).toContain('4 payments remaining')
  })

  it('keeps the previous estimate until edits are explicitly applied', async () => {
    await enterLoan()
    await wrapper.get('#monthly-payment').setValue('1000')
    expect(wrapper.text()).toContain('You have changes.')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('Mar 1, 2025')
    expect(wrapper.text()).not.toContain('You have changes.')
  })

  it('prevents invalid edits from replacing a valid estimate', async () => {
    await enterLoan()
    await wrapper.get('#next-payment-date').setValue('2024-12-31')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('#next-date-error').text()).toContain('on or after the balance date')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
  })

  it('lets someone explore with an explicitly labeled example', async () => {
    await wrapper.get('.example-button').trigger('click')
    expect(wrapper.text()).toContain('Example figures loaded.')
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('18000')
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(true)
  })

  it('clears the form and estimate without persisting the loan', async () => {
    await enterLoan()
    await wrapper.get('.text-button').trigger('click')
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('')
    expect(document.activeElement).toBe(wrapper.get('#loan-name').element)
    await enterLoan()
    wrapper.unmount()
    wrapper = mount(App, { attachTo: document.body })
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#loan-name').element.value).toBe('')
  })

  it('warns about insufficient payments without inventing a payoff or interest total', async () => {
    await enterLoan()
    await wrapper.get('#annual-rate').setValue('12')
    await wrapper.get('#monthly-payment').setValue('1')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('This payment isn’t getting you to zero.')
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remaining-interest"]').exists()).toBe(false)
    expect(wrapper.find('figure').exists()).toBe(false)
    expect(wrapper.findAll('tbody tr')).toHaveLength(12)
  })

  it('handles a same-day full payoff chart', async () => {
    await enterLoan()
    await wrapper.get('#monthly-payment').setValue('1025')
    await wrapper.get('#next-payment-date').setValue('2025-01-01')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('Jan 1, 2025')
    expect(wrapper.get('figure').html()).not.toMatch(/NaN|Infinity/)
    expect(wrapper.findAll('tbody tr')).toHaveLength(1)
  })

  it('explains the projection limit without mislabeling a slow loan as below interest', async () => {
    await enterLoan()
    await wrapper.get('#monthly-payment').setValue('0.01')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.text()).toContain('The payoff is beyond this projection.')
    expect(wrapper.text()).not.toContain('This payment isn’t getting you to zero.')
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="total-payments"]').exists()).toBe(false)
  })
})
