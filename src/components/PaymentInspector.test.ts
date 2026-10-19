import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import { projectLoan, type PaidOffProjection } from '../domain/loan'
import PaymentInspector from './PaymentInspector.vue'

const projection = projectLoan({
  name: 'Loan', type: 'unsubsidized', principalCents: 100000, accruedInterestCents: 2500,
  annualRatePercent: 0, monthlyPaymentCents: 30000, balanceDate: '2025-01-01', nextPaymentDate: '2025-02-01',
}) as PaidOffProjection

function render() {
  return mount(PaymentInspector, { props: { payments: projection.schedule, balanceDate: '2025-01-01', initialBalanceCents: 102500, label: 'Minimum payments' } })
}

describe('payment timeline inspector', () => {
  it('shows exact cumulative principal, interest and remaining balance for each selected payment', async () => {
    const wrapper = render()
    expect(wrapper.get('dl').text()).toContain('$1,025.00')
    await wrapper.get('input').setValue('1')
    expect(wrapper.get('label strong').text()).toBe('Feb 1, 2025')
    expect(wrapper.findAll('dd').map((value) => value.text())).toEqual(['$275.00', '$25.00', '$725.00'])
    expect(wrapper.get('input').attributes('aria-valuetext')).toContain('$300.00 paid, $725.00 balance')
    await wrapper.get('input').setValue('4')
    expect(wrapper.findAll('dd').map((value) => value.text())).toEqual(['$1,000.00', '$25.00', '$0.00'])
    expect(wrapper.emitted('inspect')?.at(-1)).toEqual(['2025-05-01'])
    wrapper.unmount()
  })

  it('uses the shared chart date axis for pointer inspection and resets safely when the schedule changes', async () => {
    const wrapper = render()
    await wrapper.setProps({ endDate: '2025-09-01' })
    wrapper.vm.inspectRatio(0.5)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('label strong').text()).toBe('May 1, 2025')
    await wrapper.setProps({ payments: [projection.schedule[0]!] })
    expect(wrapper.get('label strong').text()).toBe('Jan 1, 2025')
    wrapper.vm.inspectRatio(1)
    await wrapper.vm.$nextTick()
    expect(wrapper.get('label strong').text()).toBe('Feb 1, 2025')
    expect(wrapper.html()).not.toMatch(/NaN|Infinity/)
    wrapper.unmount()
  })
})
