import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import PaymentStrategyPicker from './PaymentStrategyPicker.vue'

describe('monthly strategy radio cards', () => {
  it('labels the group and each option with a title and description', () => {
    const wrapper = mount(PaymentStrategyPicker, { props: { modelValue: 'highest-rate' } })
    expect(wrapper.get('legend').text()).toBe('Monthly payoff strategy')
    expect(wrapper.findAll('input[type="radio"]')).toHaveLength(2)
    expect(wrapper.get('.selected').text()).toContain('Highest rate first')
    for (const input of wrapper.findAll('input')) {
      expect(wrapper.get(`[id="${input.attributes('aria-labelledby')}"]`).text()).not.toBe('')
      expect(wrapper.get(`[id="${input.attributes('aria-describedby')}"]`).text()).not.toBe('')
    }
    expect(wrapper.text()).toContain('Avalanche')
    expect(wrapper.text()).toContain('Snowball')
    wrapper.unmount()
  })

  it('emits a typed strategy change and reflects externally selected strategies', async () => {
    const wrapper = mount(PaymentStrategyPicker, { props: { modelValue: 'highest-rate' } })
    await wrapper.get('input[value="smallest-balance"]').setValue()
    expect(wrapper.emitted('update:modelValue')).toEqual([['smallest-balance']])
    await wrapper.setProps({ modelValue: 'smallest-balance' })
    expect(wrapper.get('.selected strong').text()).toBe('Smallest balance first')
    expect(wrapper.get<HTMLInputElement>('input[value="smallest-balance"]').element.checked).toBe(true)
    expect(wrapper.get<HTMLInputElement>('input[value="highest-rate"]').element.checked).toBe(false)
    wrapper.unmount()
  })
})
