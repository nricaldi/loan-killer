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

async function enterLoan(overrides: Record<string, string> = {}) {
  const fields = {
    '#loan-name': 'Direct Loan 01',
    '#principal': '1000',
    '#accrued-interest': '25',
    '#annual-rate': '0',
    '#monthly-payment': '300',
    '#balance-date': '2025-01-01',
    '#next-payment-date': '2025-02-01',
    ...overrides,
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
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('18000.00')
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(true)
  })

  it('clears the form and estimate without persisting the loan', async () => {
    await enterLoan()
    await wrapper.get('[aria-label="Remove Direct Loan 01"]').trigger('click')
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(true)
    await wrapper.get('.remove-button').trigger('click')
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

async function addSecondLoan(overrides: Record<string, string> = {}) {
  await wrapper.get('.add-button').trigger('click')
  await enterLoan({
    '#loan-name': 'Direct Loan 02',
    '#principal': '500',
    '#accrued-interest': '0',
    '#monthly-payment': '250',
    '#next-payment-date': '2025-02-15',
    ...overrides,
  })
}

describe('multiple-loan dashboard', () => {
  it('adds another loan without replacing the first and displays combined totals', async () => {
    await enterLoan()
    await addSecondLoan()
    expect(wrapper.findAll('.loan-list li')).toHaveLength(2)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,525.00')
    expect(wrapper.get('[data-testid="monthly-minimum"]').text()).toBe('$550.00')
    expect(wrapper.get('[data-testid="remaining-interest"]').text()).toBe('$25.00')
    expect(wrapper.get('[data-testid="total-payments"]').text()).toBe('$1,525.00')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
    expect(wrapper.text()).toContain('6 payments across 2 loans')
    expect(wrapper.text()).toContain('freed payments aren’t rolled over')
    expect(wrapper.findAll('tbody tr')).toHaveLength(6)
  })

  it('prepopulates a new loan’s snapshot date and locks it to the existing loan', async () => {
    await enterLoan({ '#balance-date': '2024-12-15' })
    await wrapper.get('.add-button').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#balance-date').element.value).toBe('2024-12-15')
    expect(wrapper.get<HTMLInputElement>('#balance-date').element.readOnly).toBe(true)
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('')
    expect(wrapper.text()).toContain('Matches your other loans.')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,025.00')
  })

  it('rejects a mismatched balance date even if a read-only field is programmatically changed', async () => {
    await enterLoan()
    await addSecondLoan({ '#balance-date': '2025-01-02' })
    expect(wrapper.get('#balance-date-error').text()).toContain('match the other loan balances')
    expect(wrapper.findAll('.loan-list li')).toHaveLength(1)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,025.00')
  })

  it('keeps the portfolio unchanged when an invalid new loan is submitted', async () => {
    await enterLoan()
    await addSecondLoan({ '#principal': '-1' })
    expect(wrapper.find('#principal-error').exists()).toBe(true)
    expect(wrapper.findAll('.loan-list li')).toHaveLength(1)
    expect(wrapper.get('[data-testid="monthly-minimum"]').text()).toBe('$300.00')
  })

  it('switches between combined and individual loan details', async () => {
    await enterLoan()
    await addSecondLoan()
    await wrapper.get('[aria-label="View Direct Loan 02"]').trigger('click')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$500.00')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('Mar 15, 2025')
    expect(wrapper.findAll('tbody tr')).toHaveLength(2)
    await wrapper.get('.overview-tabs button').trigger('click')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,525.00')
    expect(wrapper.findAll('tbody tr')).toHaveLength(6)
  })

  it('edits a specific loan without duplicating it or modifying another loan', async () => {
    await enterLoan()
    await addSecondLoan()
    const ids = wrapper.findAll('[data-loan-id]').map((item) => item.attributes('data-loan-id'))
    await wrapper.get('[aria-label="Edit Direct Loan 01"]').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('#loan-name').element)
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('1000.00')
    await wrapper.get('#principal').setValue('2000')
    await wrapper.get('#loan-name').setValue('Renamed loan')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.findAll('[data-loan-id]').map((item) => item.attributes('data-loan-id'))).toEqual(ids)
    expect(wrapper.find('[aria-label="View Renamed loan"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$2,025.00')
    await wrapper.get('.overview-tabs button').trigger('click')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$2,525.00')
    expect(wrapper.get('[aria-label="View Direct Loan 02"]').element.closest('li')?.textContent).toContain('$500.00')
  })

  it('cancels adding a loan without saving a partial draft', async () => {
    await enterLoan()
    await wrapper.get('.add-button').trigger('click')
    await wrapper.get('#loan-name').setValue('Unsaved loan')
    await wrapper.get('.form-actions .text-button').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#loan-name').element.value).toBe('Direct Loan 01')
    expect(wrapper.findAll('.loan-list li')).toHaveLength(1)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,025.00')
  })

  it('allows removal to be canceled and then removes only the confirmed loan', async () => {
    await enterLoan()
    await addSecondLoan()
    await wrapper.get('[aria-label="Remove Direct Loan 01"]').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('.remove-confirmation .text-button').element)
    await wrapper.get('.remove-confirmation .text-button').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Remove Direct Loan 01"]').element)
    expect(wrapper.findAll('.loan-list li')).toHaveLength(2)
    await wrapper.get('[aria-label="Remove Direct Loan 01"]').trigger('click')
    await wrapper.get('.remove-button').trigger('click')
    expect(wrapper.findAll('.loan-list li')).toHaveLength(1)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$500.00')
    expect(wrapper.get('[data-testid="monthly-minimum"]').text()).toBe('$250.00')
    expect(wrapper.get<HTMLInputElement>('#loan-name').element.value).toBe('Direct Loan 02')
    expect(document.activeElement).toBe(wrapper.get('.add-button').element)
  })

  it('returns to the combined view after removing the loan being viewed and edited', async () => {
    await enterLoan()
    await addSecondLoan()
    await wrapper.get('[aria-label="Edit Direct Loan 02"]').trigger('click')
    await wrapper.get('[aria-label="Remove Direct Loan 02"]').trigger('click')
    await wrapper.get('.remove-button').trigger('click')
    expect(wrapper.get('.overview-tabs button').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,025.00')
    expect(wrapper.get<HTMLInputElement>('#loan-name').element.value).toBe('')
    expect(wrapper.get<HTMLInputElement>('#balance-date').element.readOnly).toBe(true)
    await wrapper.get('[aria-label="Edit Direct Loan 01"]').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#balance-date').element.readOnly).toBe(false)
  })

  it('hides overall payoff estimates for a mixed healthy and insufficient-payment portfolio', async () => {
    await enterLoan()
    await addSecondLoan({ '#annual-rate': '12', '#monthly-payment': '1' })
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,525.00')
    expect(wrapper.text()).toContain('Some loans need a payment check.')
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="remaining-interest"]').exists()).toBe(false)
    expect(wrapper.find('[data-testid="total-payments"]').exists()).toBe(false)
    expect(wrapper.find('figure').exists()).toBe(false)
    await wrapper.get('[aria-label="View Direct Loan 01"]').trigger('click')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
    await wrapper.get('[aria-label="View Direct Loan 02"]').trigger('click')
    expect(wrapper.text()).toContain('This payment isn’t getting you to zero.')
    expect(wrapper.findAll('tbody tr')).toHaveLength(12)
  })

  it('supports loans with identical names using stable IDs', async () => {
    await enterLoan()
    await addSecondLoan({ '#loan-name': 'Direct Loan 01' })
    const rows = wrapper.findAll('[data-loan-id]')
    expect(rows).toHaveLength(2)
    expect(rows[0]?.attributes('data-loan-id')).not.toBe(rows[1]?.attributes('data-loan-id'))
    await rows[1]!.get('[aria-label="Edit Direct Loan 01"]').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('500.00')
    await wrapper.get('#principal').setValue('700')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('.overview-tabs button').trigger('click')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,725.00')
  })

  it('retains a single loan’s exact fixed rate in its details', async () => {
    await enterLoan({ '#annual-rate': '5.1234' })
    expect(wrapper.get('.balance-facts > div:nth-child(2) strong').text()).toBe('5.1234%')
  })

  it('handles interest-only balances without inventing a combined interest rate', async () => {
    await enterLoan({ '#principal': '0', '#annual-rate': '12' })
    expect(wrapper.get('.balance-facts > div:nth-child(2) strong').text()).toBe('12%')
    expect(wrapper.get('[data-testid="total-payments"]').text()).toBe('$25.00')
    await addSecondLoan({ '#principal': '0', '#accrued-interest': '15', '#annual-rate': '5' })
    expect(wrapper.get('.balance-facts > div:nth-child(2) strong').text()).toBe('—')
    expect(wrapper.get('[data-testid="remaining-interest"]').text()).toBe('$40.00')
    expect(wrapper.get('[data-testid="total-payments"]').text()).toBe('$40.00')
    expect(wrapper.get('figure').html()).not.toMatch(/NaN|Infinity/)
  })
})

describe('one-time scenarios in the loan dashboard', () => {
  it('compares a lump sum without modifying the baseline or entered loan', async () => {
    await enterLoan()
    await wrapper.get('#extra-payment-amount').setValue('300')
    await wrapper.get('.scenario-form').trigger('submit')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Apr 1, 2025')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,025.00')
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('1000.00')
    expect(wrapper.get<HTMLInputElement>('#monthly-payment').element.value).toBe('300.00')
    expect(wrapper.get('.scenario-link').attributes('href')).toBe('#extra-payment')
  })

  it('clears a previous scenario when saved balances change, but not for unapplied edits', async () => {
    await enterLoan()
    await wrapper.get('#extra-payment-amount').setValue('300')
    await wrapper.get('.scenario-form').trigger('submit')
    await wrapper.get('#principal').setValue('2000')
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(true)
    await wrapper.get('form').trigger('submit')
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('0')
  })

  it('resets the target safely after a loan is removed and removes the simulator when empty', async () => {
    await enterLoan()
    await addSecondLoan()
    const options = wrapper.findAll('#extra-payment-target option')
    await wrapper.get('#extra-payment-target').setValue(options[1]!.attributes('value'))
    await wrapper.get('#extra-payment-amount').setValue('500')
    await wrapper.get('.scenario-form').trigger('submit')
    await wrapper.get('[aria-label="Remove Direct Loan 02"]').trigger('click')
    await wrapper.get('.remove-button').trigger('click')
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(false)
    expect(wrapper.findAll('#extra-payment-target option')).toHaveLength(1)
    await wrapper.get('#extra-payment-amount').setValue('100')
    await wrapper.get('.scenario-form').trigger('submit')
    expect(wrapper.get('.result-heading').text()).toContain('Direct Loan 01')
    await wrapper.get('[aria-label="Remove Direct Loan 01"]').trigger('click')
    await wrapper.get('.remove-button').trigger('click')
    expect(wrapper.find('#extra-payment').exists()).toBe(false)
  })
})

describe('recurring scenarios in the dashboard', () => {
  it('keeps the baseline and saved minimum unchanged while comparing all four plans', async () => {
    await enterLoan()
    await wrapper.get('#extra-payment-amount').setValue('300')
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await wrapper.get('.scenario-form').trigger('submit')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
    expect(wrapper.get('[data-testid="monthly-minimum"]').text()).toBe('$300.00')
    expect(wrapper.get<HTMLInputElement>('#monthly-payment').element.value).toBe('300.00')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Mar 1, 2025')
    expect(wrapper.findAll('[data-scenario-id]')).toHaveLength(4)
    await wrapper.get('.overview-tabs button').trigger('click')
    expect(wrapper.get('[data-testid="extra-payoff-date"]').text()).toBe('Mar 1, 2025')
  })

  it('resets recurring budgets and scenario targets after a saved loan changes', async () => {
    await enterLoan()
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await wrapper.get('.scenario-form').trigger('submit')
    await wrapper.get('#principal').setValue('2000')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(false)
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('0')
    expect(wrapper.get('[data-testid="monthly-budget"]').text()).toContain('$300.00 starting monthly budget')
  })
})
