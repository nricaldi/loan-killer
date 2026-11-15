import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PaymentStrategyPicker from './PaymentStrategyPicker.vue'

describe('compact monthly strategy selection', () => {
  it('provides a labeled native select with two concise choices', () => {
    const wrapper = mount(PaymentStrategyPicker, { props: { modelValue: 'highest-rate' } })
    expect(wrapper.get('label').attributes('for')).toBe(wrapper.get('select').attributes('id'))
    expect(wrapper.get('label').text()).toBe('Apply monthly extra to')
    expect(wrapper.findAll('option').map((option) => option.text())).toEqual(['Highest rate first', 'Smallest balance first'])
    expect(wrapper.find('.strategy-card').exists()).toBe(false)
    wrapper.unmount()
  })
  it('emits a typed change and reflects externally selected strategies', async () => {
    const wrapper = mount(PaymentStrategyPicker, { props: { modelValue: 'highest-rate' } })
    await wrapper.get('select').setValue('smallest-balance')
    expect(wrapper.emitted('update:modelValue')).toEqual([['smallest-balance']])
    await wrapper.setProps({ modelValue: 'smallest-balance' })
    expect(wrapper.get<HTMLSelectElement>('select').element.value).toBe('smallest-balance')
    wrapper.unmount()
  })
})
