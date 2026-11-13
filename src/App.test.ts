import { mount, type VueWrapper } from '@vue/test-utils'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App.vue'
import { encodeLoans, LOAN_STORAGE_KEY } from './storage/loanStorage'

let wrapper: VueWrapper

// jsdom has no dialog top layer; real-browser checks cover native focus containment.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.open = true }
  HTMLDialogElement.prototype.close = function () { this.open = false }
})

afterAll(() => {
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'showModal')
  Reflect.deleteProperty(HTMLDialogElement.prototype, 'close')
})

beforeEach(() => {
  localStorage.removeItem(LOAN_STORAGE_KEY)
  vi.useFakeTimers()
  vi.setSystemTime(new Date(2025, 0, 1, 12))
  wrapper = mount(App, { attachTo: document.body })
})

afterEach(() => {
  wrapper.unmount()
  vi.restoreAllMocks()
  localStorage.removeItem(LOAN_STORAGE_KEY)
  vi.useRealTimers()
})

async function enterLoan(overrides: Record<string, string> = {}) {
  if (!wrapper.find('#loan-name').exists()) await wrapper.get('.header-add').trigger('click')
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

async function editLoan(name = 'Direct Loan 01') {
  const button = wrapper.get<HTMLButtonElement>(`[aria-label="Edit ${name}"]`)
  button.element.focus()
  await button.trigger('click')
}

describe('loan modal', () => {
  it('clears a submitted loan, validation errors, and example state for the next entry', async () => {
    const button = wrapper.get<HTMLButtonElement>('.header-add')
    button.element.focus()
    await enterLoan()
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(document.activeElement).toBe(button.element)
    expect(document.body.style.overflow).toBe('')
    await button.trigger('click')
    expect(wrapper.get('dialog').attributes('open')).toBeDefined()
    expect(document.activeElement).toBe(wrapper.get('#loan-name').element)
    expect(wrapper.get<HTMLInputElement>('#loan-name').element.value).toBe('')
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('')
    expect(wrapper.get<HTMLInputElement>('#annual-rate').element.value).toBe('')
    expect(wrapper.get<HTMLInputElement>('#monthly-payment').element.value).toBe('')
    expect(wrapper.get<HTMLInputElement>('#accrued-interest').element.value).toBe('0')
    expect(wrapper.get<HTMLInputElement>('#balance-date').element.readOnly).toBe(true)
    expect(wrapper.find('.example-notice').exists()).toBe(false)
    expect(wrapper.find('[aria-invalid="true"]').exists()).toBe(false)
  })

  it('handles Escape cancellation, discards drafts and restores focus and scrolling', async () => {
    document.body.style.overflow = 'auto'
    const button = wrapper.get<HTMLButtonElement>('.header-add')
    button.element.focus()
    await button.trigger('click')
    expect(document.body.style.overflow).toBe('hidden')
    await wrapper.get('#loan-name').setValue('Unsaved')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('dialog').trigger('cancel')
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(document.activeElement).toBe(button.element)
    expect(document.body.style.overflow).toBe('auto')
    await button.trigger('click')
    expect(wrapper.get<HTMLInputElement>('#loan-name').element.value).toBe('')
    expect(wrapper.find('[aria-invalid="true"]').exists()).toBe(false)
    await wrapper.get('.close-button').trigger('click')
    document.body.style.overflow = ''
  })

  it('closes on the backdrop, but not when interacting with the form', async () => {
    await wrapper.get('.header-add').trigger('click')
    await wrapper.get('#loan-name').trigger('click')
    expect(wrapper.find('dialog').exists()).toBe(true)
    await wrapper.get('dialog').trigger('click')
    expect(wrapper.find('dialog').exists()).toBe(false)
  })

  it('wraps Tab and Shift+Tab inside the dialog', async () => {
    await wrapper.get('.header-add').trigger('click')
    const first = wrapper.get<HTMLButtonElement>('.close-button')
    const last = wrapper.get<HTMLButtonElement>('.form-actions .text-button')
    last.element.focus()
    await last.trigger('keydown', { key: 'Tab' })
    expect(document.activeElement).toBe(first.element)
    await first.trigger('keydown', { key: 'Tab', shiftKey: true })
    expect(document.activeElement).toBe(last.element)
  })

  it('discards canceled edits and restores focus to the edit button after saving', async () => {
    await enterLoan()
    await editLoan()
    await wrapper.get('#principal').setValue('2000')
    await wrapper.get('.form-actions .text-button').trigger('click')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,025.00')
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Edit Direct Loan 01"]').element)
    await editLoan()
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('1000.00')
    await wrapper.get('#principal').setValue('2000')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('[aria-label="Edit Direct Loan 01"]').element)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$2,025.00')
    expect(wrapper.findAll('[data-loan-id]')).toHaveLength(1)
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

describe('loan management', () => {
  it('validates required fields and focuses the first invalid input', async () => {
    await wrapper.get('.header-add').trigger('click')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[role="alert"]').text()).toContain('Check the highlighted fields')
    expect(wrapper.get('#loan-name').attributes('aria-invalid')).toBe('true')
    expect(document.activeElement).toBe(wrapper.get('#loan-name').element)
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(false)
  })

  it('keeps the previous estimate until edits are explicitly applied', async () => {
    await enterLoan()
    await editLoan()
    await wrapper.get('#monthly-payment').setValue('1000')
    expect(wrapper.text()).toContain('You have changes.')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('Mar 1, 2025')
    expect(wrapper.text()).not.toContain('You have changes.')
  })

  it('prevents invalid edits from replacing a valid estimate', async () => {
    await enterLoan()
    await editLoan()
    await wrapper.get('#next-payment-date').setValue('2024-12-31')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('#next-date-error').text()).toContain('on or after the balance date')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
  })

  it('lets someone explore with an explicitly labeled example', async () => {
    await wrapper.get('.header-add').trigger('click')
    await wrapper.get('.example-button').trigger('click')
    expect(wrapper.text()).toContain('From example')
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(true)
    await editLoan('My federal student loan')
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('18000.00')
    expect(wrapper.get('#loan-details-heading').text()).toContain('Example')
  })

  it('persists confirmed removal and restores loans added afterwards', async () => {
    await enterLoan()
    await wrapper.get('[aria-label="Remove Direct Loan 01"]').trigger('click')
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(true)
    await wrapper.get('.remove-button').trigger('click')
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(false)
    expect(wrapper.find('#principal').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.header-add').element)
    expect(JSON.parse(localStorage.getItem(LOAN_STORAGE_KEY) ?? '{}').loans).toEqual([])
    await enterLoan()
    wrapper.unmount()
    wrapper = mount(App, { attachTo: document.body })
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
    expect(wrapper.find('dialog').exists()).toBe(false)
    await editLoan()
    expect(wrapper.get<HTMLInputElement>('#loan-name').element.value).toBe('Direct Loan 01')
  })

  it('warns beside an insufficient minimum in the editor and loan card, then recovers when raised', async () => {
    await enterLoan({ '#principal': '18000', '#annual-rate': '5.5', '#monthly-payment': '75' })
    const minimum = wrapper.get('[aria-label="Monthly minimum for Direct Loan 01"]')
    expect(minimum.classes()).toContain('payment-warning')
    expect(minimum.attributes('aria-describedby')).toContain('-warning')
    expect(wrapper.get('.minimum-warning > span').text()).toBe('Too low to pay off')
    expect(wrapper.find('.balance-chart.unpaid').exists()).toBe(true)
    expect(wrapper.find('.placeholder-metrics').exists()).toBe(false)
    expect(wrapper.findAll('button').filter((button) => button.text() === '+ Add loan')).toHaveLength(1)
    await editLoan()
    expect(wrapper.get('#monthly-payment').classes()).toContain('payment-warning')
    expect(wrapper.get('#payment-warning .suggest-payment').text()).toContain('10-year plan:')
    await wrapper.get('#monthly-payment').setValue('200')
    expect(wrapper.find('#payment-warning').exists()).toBe(false)
    expect(wrapper.get('#monthly-payment').classes()).not.toContain('payment-warning')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.find('.minimum-warning').exists()).toBe(false)
    expect(wrapper.find('.balance-chart.unpaid').exists()).toBe(false)
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(true)
  })

  it('distinguishes a slow decreasing balance from a payment that does not cover interest', async () => {
    await enterLoan({ '#principal': '100000', '#annual-rate': '0', '#monthly-payment': '1' })
    expect(wrapper.get('.minimum-warning > span').text()).toBe('Payoff beyond estimate')
    expect(wrapper.get('.minimum-warning').text()).not.toContain('does not cover ongoing interest')
    expect(wrapper.find('.balance-chart.unpaid').exists()).toBe(true)
  })

  it('adds another loan without replacing the first and displays combined totals', async () => {
    await enterLoan()
    await addSecondLoan()
    expect(wrapper.findAll('.loan-list li')).toHaveLength(2)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,525.00')
    expect(wrapper.get('[data-testid="monthly-minimum"]').text()).toBe('$550.00')
    expect(wrapper.get('[data-testid="remaining-interest"]').text()).toBe('$25.00')
    expect(wrapper.get('[data-testid="total-payments"]').text()).toBe('$1,525.00')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
    expect(wrapper.get('[data-testid="monthly-minimum"]').text()).toBe('$550.00')
  })

  it('prepopulates a new loan’s snapshot date and locks it to the existing loan', async () => {
    await enterLoan({ '#balance-date': '2024-12-15' })
    await wrapper.get('.add-button').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#balance-date').element.value).toBe('2024-12-15')
    expect(wrapper.get<HTMLInputElement>('#balance-date').element.readOnly).toBe(true)
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('')
    expect(wrapper.text()).toContain('Same balance date for all loans.')
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
    expect(wrapper.findAll('[data-loan-id]').map((item) => item.attributes('data-loan-id')).sort()).toEqual([...ids].sort())
    expect(wrapper.find('[aria-label="View Renamed loan"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$2,525.00')
    expect(wrapper.get('.all-loans').attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('[aria-label="View Direct Loan 02"]').element.closest('li')?.textContent).toContain('$500.00')
  })

  it('cancels adding a loan without saving a partial draft', async () => {
    await enterLoan()
    await wrapper.get('.add-button').trigger('click')
    await wrapper.get('#loan-name').setValue('Unsaved loan')
    await wrapper.get('.form-actions .text-button').trigger('click')
    expect(wrapper.find('dialog').exists()).toBe(false)
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
    expect(wrapper.find('dialog').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.add-button').element)
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
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,725.00')
  })

})

function remountApp() {
  wrapper.unmount()
  wrapper = mount(App, { attachTo: document.body })
}

describe('local loan persistence', () => {
  it('restores multiple loans, stable IDs, all fields and combined totals after a reload', async () => {
    await enterLoan()
    await addSecondLoan()
    const ids = wrapper.findAll('[data-loan-id]').map((item) => item.attributes('data-loan-id'))
    remountApp()
    expect(wrapper.findAll('[data-loan-id]').map((item) => item.attributes('data-loan-id'))).toEqual(ids)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,525.00')
    expect(wrapper.get('[data-testid="monthly-minimum"]').text()).toBe('$550.00')
    expect(wrapper.find('dialog').exists()).toBe(false)
    await wrapper.get('[aria-label="Edit Direct Loan 02"]').trigger('click')
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('500.00')
    expect(wrapper.get<HTMLInputElement>('#next-payment-date').element.value).toBe('2025-02-15')
  })

  it('persists updates and confirmed removals, without resurrecting removed loans', async () => {
    await enterLoan()
    await addSecondLoan()
    await editLoan('Direct Loan 02')
    await wrapper.get('#principal').setValue('700')
    await wrapper.get('#loan-name').setValue('Renamed loan')
    await wrapper.get('form').trigger('submit')
    await wrapper.get('[aria-label="Remove Direct Loan 01"]').trigger('click')
    await wrapper.get('.remove-button').trigger('click')
    remountApp()
    expect(wrapper.findAll('[data-loan-id]')).toHaveLength(1)
    expect(wrapper.find('[aria-label="View Renamed loan"]').exists()).toBe(true)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$700.00')
    await wrapper.get('[aria-label="Remove Renamed loan"]').trigger('click')
    await wrapper.get('.remove-button').trigger('click')
    remountApp()
    expect(wrapper.find('[data-testid="starting-balance"]').exists()).toBe(false)
  })

  it('does not save invalid or unapplied edits, canceled drafts, or hypothetical scenarios', async () => {
    await enterLoan()
    const saved = localStorage.getItem(LOAN_STORAGE_KEY)
    await editLoan()
    await wrapper.get('#principal').setValue('-1')
    await wrapper.get('form').trigger('submit')
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(saved)
    await wrapper.get('#principal').setValue('2000')
    await wrapper.get('.close-button').trigger('click')
    await wrapper.get('.one-time-choice').trigger('click')
    await wrapper.get('.monthly-choice').trigger('click')
    await wrapper.get('#extra-payment-amount').setValue('300')
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await wrapper.get('.scenario-form').trigger('submit')
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(saved)
    remountApp()
    await editLoan()
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('1000.00')
    expect(wrapper.find('#extra-payment-amount').exists()).toBe(false)
    expect(wrapper.find('#extra-monthly-amount').exists()).toBe(false)
    expect(wrapper.find('[data-testid="extra-payment-results"]').exists()).toBe(false)
    await wrapper.get('.close-button').trigger('click')
    await wrapper.get('.add-button').trigger('click')
    await wrapper.get('#loan-name').setValue('Unsaved draft')
    await wrapper.get('.form-actions .text-button').trigger('click')
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(saved)
  })

  it('keeps snapshot dates and entered balances instead of assuming real payments happened overnight', async () => {
    await enterLoan()
    vi.setSystemTime(new Date(2025, 2, 1, 12))
    remountApp()
    await editLoan()
    expect(wrapper.get<HTMLInputElement>('#balance-date').element.value).toBe('2025-01-01')
    expect(wrapper.get<HTMLInputElement>('#next-payment-date').element.value).toBe('2025-02-01')
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('1000.00')
    await wrapper.get('.close-button').trigger('click')
    await wrapper.get('.one-time-choice').trigger('click')
    await wrapper.get('#extra-payment-amount').setValue('100')
    expect(wrapper.text()).toContain('A next payment date is in the past')
  })

  it('restores explicitly labeled example loans and never writes unrelated site storage', async () => {
    const unrelated = 'loan-killer-test-unrelated'
    localStorage.setItem(unrelated, 'keep me')
    await wrapper.get('.header-add').trigger('click')
    await wrapper.get('.example-button').trigger('click')
    remountApp()
    expect(wrapper.text()).toContain('From example')
    await editLoan('My federal student loan')
    expect(wrapper.get<HTMLInputElement>('#principal').element.value).toBe('18000.00')
    expect(localStorage.getItem(unrelated)).toBe('keep me')
    localStorage.removeItem(unrelated)
  })

  it('preserves corrupt saved data until the user explicitly confirms replacement', async () => {
    const original = '{ unreadable loans'
    localStorage.setItem(LOAN_STORAGE_KEY, original)
    remountApp()
    expect(wrapper.get('.storage-notice [role="alert"]').text()).toContain('Saved loans couldn’t be restored')
    await enterLoan()
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,025.00')
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(original)
    await wrapper.get('.replace-copy').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('.cancel-replacement').element)
    await wrapper.get('.cancel-replacement').trigger('click')
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(original)
    expect(document.activeElement).toBe(wrapper.get('.replace-copy').element)
    await wrapper.get('.replace-copy').trigger('click')
    await wrapper.get('.replacement-confirmation button:last-child').trigger('click')
    expect(wrapper.find('.storage-notice [role="alert"]').exists()).toBe(false)
    expect(document.activeElement).toBe(wrapper.get('.header-add').element)
    remountApp()
    expect(wrapper.find('[aria-label="View Direct Loan 01"]').exists()).toBe(true)
  })

  it('protects unsupported formats and explicitly warns before replacing them with an empty plan', async () => {
    const future = '{"version":2,"loans":[]}'
    localStorage.setItem(LOAN_STORAGE_KEY, future)
    remountApp()
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(future)
    await wrapper.get('.replace-copy').trigger('click')
    expect(wrapper.get('.replacement-confirmation').text()).toContain('empty plan')
    await wrapper.get('.cancel-replacement').trigger('click')
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(future)
  })

  it('continues in memory if storage is inaccessible and can recover after explicit confirmation', async () => {
    const getter = vi.spyOn(window, 'localStorage', 'get').mockImplementation(() => { throw new DOMException('Blocked', 'SecurityError') })
    remountApp()
    await enterLoan()
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,025.00')
    expect(wrapper.find('.storage-notice [role="alert"]').exists()).toBe(true)
    getter.mockRestore()
    await wrapper.get('.replace-copy').trigger('click')
    await wrapper.get('.replacement-confirmation button:last-child').trigger('click')
    remountApp()
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,025.00')
  })

  it('shows write failures honestly, keeps memory edits, and retries the latest plan', async () => {
    await enterLoan()
    const saved = localStorage.getItem(LOAN_STORAGE_KEY)
    const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('Full', 'QuotaExceededError') })
    await editLoan()
    await wrapper.get('#principal').setValue('2000')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$2,025.00')
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(saved)
    expect(wrapper.get('.storage-notice [role="alert"]').text()).toContain('couldn’t be saved')
    write.mockRestore()
    await wrapper.get('.storage-actions button').trigger('click')
    expect(wrapper.find('.storage-notice [role="alert"]').exists()).toBe(false)
    remountApp()
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$2,025.00')
  })

  it('does not silently overwrite another tab’s newer saved loan list', async () => {
    await enterLoan()
    const otherCopy = encodeLoans([{
      id: 'other-tab', name: 'Other tab’s loan', type: 'subsidized', fromExample: false,
      principalCents: 50_000, accruedInterestCents: 0, annualRatePercent: 3,
      monthlyPaymentCents: 10_000, balanceDate: '2025-01-01', nextPaymentDate: '2025-02-15',
    }])
    localStorage.setItem(LOAN_STORAGE_KEY, otherCopy)
    await editLoan()
    await wrapper.get('#principal').setValue('2000')
    await wrapper.get('form').trigger('submit')
    expect(wrapper.get('.storage-notice [role="alert"]').text()).toContain('changed in another tab')
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(otherCopy)
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$2,025.00')
    remountApp()
    expect(wrapper.find('[aria-label="View Other tab’s loan"]').exists()).toBe(true)
  })
})

describe('guided payoff flow', () => {
  it('shows loans, baseline outlook, then choices without the removed analysis panels', async () => {
    await enterLoan()
    const loans = wrapper.get('.loan-list').element
    const outlook = wrapper.get('.journey-visual').element
    const choices = wrapper.get('#extra-payment').element
    expect(loans.compareDocumentPosition(outlook) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(outlook.compareDocumentPosition(choices) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,025.00')
    expect(wrapper.get('[data-testid="remaining-interest"]').text()).toBe('$25.00')
    expect(wrapper.get('[data-testid="total-payments"]').text()).toBe('$1,025.00')
    expect(wrapper.get('[data-testid="payoff-date"]').text()).toBe('May 1, 2025')
    expect(wrapper.find('#extra-payment-amount').exists()).toBe(false)
    expect(wrapper.find('#extra-monthly-amount').exists()).toBe(false)
    for (const selector of ['.payment-summary', '.schedule', '.inspection-details', '.chart-switch', '.balance-card', '.assumptions', '.storage-status', '.site-footer']) {
      expect(wrapper.find(selector).exists()).toBe(false)
    }
    expect(wrapper.findAll('figure')).toHaveLength(1)
  })

  it('lets a zero minimum be focused and left alone without saving a change', async () => {
    await enterLoan({ '#monthly-payment': '0' })
    const saved = localStorage.getItem(LOAN_STORAGE_KEY)
    const minimum = wrapper.get<HTMLInputElement>('[aria-label="Monthly minimum for Direct Loan 01"]')
    minimum.element.focus()
    expect(minimum.element.value).toBe('')
    expect(minimum.attributes('aria-invalid')).toBe('false')
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(saved)
    minimum.element.blur()
    expect(minimum.element.value).toBe('0.00')
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(saved)
  })

  it('makes scope explicit and never toggles a selected loan back to all loans', async () => {
    await enterLoan()
    await addSecondLoan()
    expect(wrapper.get('.all-loans').attributes('aria-pressed')).toBe('true')
    expect(wrapper.findAll('.chip-name').every((button) => button.attributes('aria-pressed') === 'false')).toBe(true)
    const loan = wrapper.get('[aria-label="View Direct Loan 02"]')
    await loan.trigger('click')
    await loan.trigger('click')
    expect(loan.attributes('aria-pressed')).toBe('true')
    expect(wrapper.get('.all-loans').attributes('aria-pressed')).toBe('false')
    expect(wrapper.get('.scope-label').text()).toBe('Direct Loan 02')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$500.00')
    await wrapper.get('.all-loans').trigger('click')
    expect(wrapper.get('.scope-label').text()).toBe('All loans')
    expect(wrapper.get('[data-testid="starting-balance"]').text()).toBe('$1,525.00')
  })

  it('opens a focused monthly control and updates one shared chart without changing the baseline', async () => {
    await enterLoan({ '#annual-rate': '6' })
    const saved = localStorage.getItem(LOAN_STORAGE_KEY)
    const baseline = wrapper.get('[data-testid="total-payments"]').text()
    const date = wrapper.get('[data-testid="payoff-date"]').text()
    await wrapper.get('.monthly-choice').trigger('click')
    expect(document.activeElement).toBe(wrapper.get('#extra-monthly-amount').element)
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    await wrapper.get('.presets button').trigger('click')
    expect(wrapper.find('.payment-summary').exists()).toBe(true)
    expect(wrapper.findAll('figure')).toHaveLength(1)
    expect(wrapper.find('.comparison-line').exists()).toBe(true)
    expect(wrapper.get('.balance-chart figcaption').text()).toContain('Minimum payments')
    expect(wrapper.get('.balance-chart figcaption').text()).toContain('With extra monthly payments')
    expect(wrapper.get('[data-testid="baseline-total"]').text()).toBe(baseline)
    expect(wrapper.get('[data-testid="baseline-date"]').text()).toBe(date)
    expect(localStorage.getItem(LOAN_STORAGE_KEY)).toBe(saved)
    await wrapper.get('#extra-monthly-amount').setValue('0')
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    expect(wrapper.find('.comparison-line').exists()).toBe(false)
  })

  it('compares only meaningful plans and preserves amounts while changing the viewed plan', async () => {
    await enterLoan()
    await wrapper.get('.monthly-choice').trigger('click')
    await wrapper.get('#extra-monthly-amount').setValue('100')
    expect(wrapper.find('.plan-comparison').exists()).toBe(false)
    await wrapper.get('.one-time-choice').trigger('click')
    await wrapper.get('#extra-payment-amount').setValue('300')
    expect(wrapper.findAll('[data-scenario-id]')).toHaveLength(4)
    expect(wrapper.get('[data-scenario-id="combined"] button').attributes('aria-pressed')).toBe('true')
    await wrapper.get('[data-scenario-id="one-time"] button').trigger('click')
    expect(wrapper.get('.payment-summary h3').text()).toBe('With $300.00 toward Direct Loan 01 today')
    expect(wrapper.get('.balance-chart figcaption').text()).toContain('With one-time payment')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('100')
    expect(wrapper.get<HTMLInputElement>('#extra-payment-amount').element.value).toBe('300')
    expect(wrapper.find('.schedule').exists()).toBe(false)
  })

  it('keeps both curves when minimums do not pay off and an extra monthly payment does', async () => {
    await enterLoan({ '#monthly-payment': '0', '#annual-rate': '6' })
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(false)
    await wrapper.get('.monthly-choice').trigger('click')
    await wrapper.get('#extra-monthly-amount').setValue('100')
    expect(wrapper.find('.comparison-line').exists()).toBe(true)
    expect(wrapper.find('[data-testid="payoff-date"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="plan-interest-saved"]').exists()).toBe(false)
    expect(wrapper.get('.horizon-note').text()).toContain('50 years')
    expect(wrapper.get('.balance-chart desc').text()).toContain('No payoff date is estimated')
    expect(wrapper.get('.balance-chart desc').text()).toContain('reaches zero')
  })

  it('recomputes preserved extra amounts for the explicit scope and resets them on saved edits', async () => {
    await enterLoan()
    await addSecondLoan()
    await wrapper.get('.monthly-choice').trigger('click')
    await wrapper.get('#extra-monthly-amount').setValue('100')
    await wrapper.get('.one-time-choice').trigger('click')
    await wrapper.get('#extra-payment-amount').setValue('50')
    await wrapper.get('[aria-label="View Direct Loan 02"]').trigger('click')
    expect(wrapper.get('.preview-scope').text()).toBe('Direct Loan 02')
    expect(wrapper.get<HTMLInputElement>('#extra-monthly-amount').element.value).toBe('100')
    expect(wrapper.get('.payment-summary h3').text()).toContain('Direct Loan 02')
    expect(wrapper.find('.strategy-field').exists()).toBe(false)
    await wrapper.get('.all-loans').trigger('click')
    expect(wrapper.get('.preview-scope').text()).toBe('All 2 loans')
    expect(wrapper.findAll('select')).toHaveLength(0)
    expect(wrapper.get('.impact-details .monthly-recommendation').text()).toContain('First extra payment:')
    await wrapper.get('[aria-label="Monthly minimum for Direct Loan 02"]').setValue('350')
    expect(wrapper.find('.payment-summary').exists()).toBe(false)
    expect(wrapper.find('#extra-monthly-amount').exists()).toBe(false)
  })
  it('adds scrollable payment cards and combines amounts when cards are edited or removed', async () => {
    await enterLoan()
    await wrapper.get('.monthly-choice').trigger('click')
    await wrapper.get('#extra-monthly-amount').setValue('25')
    await wrapper.get('.monthly-choice').trigger('click')
    const inputs = wrapper.findAll('.saving-card input')
    await inputs[1]!.setValue('50')
    expect(wrapper.findAll('.saving-card')).toHaveLength(2)
    expect(wrapper.get('.payment-summary h3').text()).toContain('$75.00 extra each month')
    await wrapper.get('.one-time-choice').trigger('click')
    await wrapper.get('#extra-payment-amount').setValue('100')
    expect(wrapper.findAll('.saving-card')).toHaveLength(3)
    expect(wrapper.get('.payment-summary h3').text()).toContain('$100.00')
    await wrapper.get('.remove-card').trigger('click')
    expect(wrapper.findAll('.saving-card')).toHaveLength(2)
    expect(wrapper.get('.payment-summary h3').text()).toContain('$50.00 extra each month')
    await wrapper.get('.saving-card input').setValue('oops')
    expect(wrapper.get('.saving-card input').attributes('aria-invalid')).toBe('true')
    expect(wrapper.find('.date-warning').exists()).toBe(true)
  })

})
