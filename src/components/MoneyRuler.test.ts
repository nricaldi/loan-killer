import { mount } from '@vue/test-utils'
import { describe, expect, it, vi } from 'vitest'
import MoneyRuler from './MoneyRuler.vue'

function render(value = '50', disabled = false) {
  return mount(MoneyRuler, { props: { id: 'test-amount', label: 'Pay once', value, disabled } })
}

describe('payment number ruler', () => {
  it('shows neighboring amounts and adjusts exactly five dollars from precise typed amounts', async () => {
    const wrapper = render('50.25')
    expect(wrapper.get('.previous').text()).toBe('$45.25')
    expect(wrapper.get('.next').text()).toBe('$55.25')
    await wrapper.get('[role="slider"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['55.25'])
    await wrapper.get('input').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['45.25'])
    wrapper.unmount()
  })

  it('accepts exact cents and clears to zero without a validation error', async () => {
    const wrapper = render()
    await wrapper.get('input').setValue('123.45')
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['123.45'])
    await wrapper.setProps({ value: '' })
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('false')
    await wrapper.get('input').trigger('blur')
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['0'])
    wrapper.unmount()
  })

  it('never displays negative neighbors, wraps, or changes a disabled ruler', async () => {
    const wrapper = render('0')
    expect(wrapper.find('.previous').exists()).toBe(false)
    await wrapper.get('[role="slider"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['0'])
    await wrapper.setProps({ value: '10000000' })
    expect(wrapper.find('.next').exists()).toBe(false)
    await wrapper.get('[role="slider"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['10000000'])
    await wrapper.setProps({ disabled: true })
    const count = wrapper.emitted('change')?.length
    await wrapper.get('[role="slider"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('change')?.length).toBe(count)
    wrapper.unmount()
  })

  it('supports repeated drags and releases without inertia, but leaves vertical gestures alone', async () => {
    const wrapper = render()
    const strip = wrapper.get<HTMLElement>('[role="slider"]')
    strip.element.setPointerCapture = vi.fn()
    strip.element.hasPointerCapture = vi.fn(() => false)
    const pointer = { pointerId: 1, isPrimary: true }
    async function fire(type: string, values = {}) {
      const event = new MouseEvent(type, { bubbles: true, button: 0, ...values })
      Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } })
      strip.element.dispatchEvent(event)
      await wrapper.vm.$nextTick()
    }
    await fire('pointerdown', { ...pointer, clientX: 150, clientY: 20 })
    await fire('pointermove', { ...pointer, clientX: 48, clientY: 20 })
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['55'])
    await wrapper.setProps({ value: '55' })
    await fire('pointerup', pointer)
    await fire('pointermove', { ...pointer, clientX: 0, clientY: 20 })
    expect(wrapper.emitted('change')).toHaveLength(1)
    await fire('pointerdown', { ...pointer, clientX: 150, clientY: 20 })
    await fire('pointermove', { ...pointer, clientX: 48, clientY: 20 })
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['60'])
    await fire('pointercancel', pointer)
    const count = wrapper.emitted('change')?.length
    await fire('pointerdown', { ...pointer, clientX: 150, clientY: 20 })
    await fire('pointermove', { ...pointer, clientX: 145, clientY: 50 })
    await fire('pointermove', { ...pointer, clientX: 0, clientY: 50 })
    expect(wrapper.emitted('change')?.length).toBe(count)
    wrapper.unmount()
  })
})
