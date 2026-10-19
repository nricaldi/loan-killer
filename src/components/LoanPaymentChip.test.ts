import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import type { LoanRecord } from '../domain/portfolio'
import LoanPaymentChip from './LoanPaymentChip.vue'

const loan: LoanRecord = {
  id: 'loan', name: 'Loan 2', type: 'unsubsidized', fromExample: false,
  principalCents: 100000, accruedInterestCents: 0, annualRatePercent: 5,
  monthlyPaymentCents: 30000, balanceDate: '2026-10-19', nextPaymentDate: '2026-11-19',
}

describe('editable loan chip', () => {
  it('emits a zero minimum but never saves blank or negative values', async () => {
    const wrapper = mount(LoanPaymentChip, { props: { loan, selected: true } })
    await wrapper.get('input').setValue('0')
    expect(wrapper.emitted('payment')).toEqual([[0]])
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('false')
    await wrapper.setProps({ loan: { ...loan, monthlyPaymentCents: 0 } })
    for (const value of ['', '-1', '0.001']) {
      await wrapper.get('input').setValue(value)
      expect(wrapper.get('input').attributes('aria-invalid')).toBe('true')
      expect(wrapper.emitted('payment')).toEqual([[0]])
    }
    await wrapper.get('input').setValue('0.00')
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('false')
    expect(wrapper.emitted('select')).toBeUndefined()
    wrapper.unmount()
  })

  it('shows the saved principal plus unpaid interest and its balance date on each card', async () => {
    const wrapper = mount(LoanPaymentChip, { props: { loan: { ...loan, accruedInterestCents: 2500 }, selected: false } })
    expect(wrapper.get('.chip-balance strong').text()).toBe('$1,025.00')
    expect(wrapper.get('.chip-balance span').text()).toBe('left as of Oct 19, 2026')
    await wrapper.setProps({ loan: { ...loan, principalCents: 50000, accruedInterestCents: 1000 } })
    expect(wrapper.get('.chip-balance strong').text()).toBe('$510.00')
    wrapper.unmount()
  })

  it('selects a loan independently from editing its payment', async () => {
    const wrapper = mount(LoanPaymentChip, { props: { loan, selected: false } })
    await wrapper.get('button').trigger('click')
    expect(wrapper.emitted('select')).toHaveLength(1)
    await wrapper.get('input').setValue('350.25')
    expect(wrapper.emitted('payment')).toEqual([[35025]])
    expect(wrapper.emitted('select')).toHaveLength(1)
    wrapper.unmount()
  })

  it('syncs external modal edits without reformatting the amount while typing', async () => {
    const wrapper = mount(LoanPaymentChip, { props: { loan, selected: true } })
    await wrapper.get('input').setValue('400')
    await wrapper.setProps({ loan: { ...loan, monthlyPaymentCents: 40000 } })
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('400')
    await wrapper.setProps({ loan: { ...loan, monthlyPaymentCents: 50025 } })
    expect(wrapper.get<HTMLInputElement>('input').element.value).toBe('500.25')
    expect(wrapper.get('button').attributes('aria-pressed')).toBe('true')
    wrapper.unmount()
  })
})
