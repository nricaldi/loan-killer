import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MoneyRuler from './MoneyRuler.vue'

const wrappers: VueWrapper[] = []
function render(value = '50', disabled = false) {
  const wrapper = mount(MoneyRuler, { props: { id: 'test-amount', label: 'Pay once', value, disabled,
    onChange(value: string) { void wrapper.setProps({ value }) },
  } })
  wrappers.push(wrapper)
  return wrapper
}
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})
function motionClock(reduced = false) {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }))
  vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => setTimeout(() => callback(performance.now()), 16))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
}
function gestures(wrapper: VueWrapper) {
  const strip = wrapper.get<HTMLElement>('[role="slider"]')
  strip.element.setPointerCapture = vi.fn()
  strip.element.hasPointerCapture = vi.fn(() => false)
  return async (type: string, x = 150, y = 20) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: y })
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } })
    strip.element.dispatchEvent(event)
    await wrapper.vm.$nextTick()
  }
}

describe('payment number ruler', () => {
  it('keeps scale labels whole while retaining exact externally entered amounts until the next adjustment', async () => {
    const wrapper = render('50.25')
    expect(wrapper.get('input').element.value).toBe('50.25')
    const labels = wrapper.findAll('.tick-label').map(label => label.text())
    expect(labels).toContain('$50')
    expect(labels).toContain('$55')
    expect(labels.every(label => !label.includes('.'))).toBe(true)
    await wrapper.get('[role="slider"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['55'])
    await wrapper.setProps({ value: '50.25' })
    await wrapper.get('input').trigger('keydown', { key: 'ArrowDown' })
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['50'])
    await wrapper.get('input').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('change')).toHaveLength(2)
  })

  it('accepts exact cents and clears to zero without a validation error', async () => {
    const wrapper = render()
    await wrapper.get('input').setValue('123.45')
    expect(wrapper.get('input').element.value).toBe('123.45')
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['123.45'])
    await wrapper.setProps({ value: '' })
    expect(wrapper.get('input').attributes('aria-invalid')).toBe('false')
    await wrapper.get('input').trigger('blur')
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['0'])
    await wrapper.setProps({ value: 'invalid' })
    const count = wrapper.emitted('change')?.length
    await wrapper.get('input').trigger('focus')
    expect(wrapper.get('input').element.value).toBe('invalid')
    expect(wrapper.emitted('change')?.length).toBe(count)
  })

  it('never displays negative marks, wraps, or changes a disabled ruler', async () => {
    const wrapper = render('0')
    expect(wrapper.findAll('.tick-label').every(mark => !mark.text().includes('-'))).toBe(true)
    await wrapper.get('[role="slider"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['0'])
    await wrapper.setProps({ value: '10000000' })
    await wrapper.get('[role="slider"]').trigger('keydown', { key: 'ArrowRight' })
    expect(wrapper.emitted('change')?.at(-1)).toEqual(['10000000'])
    await wrapper.setProps({ disabled: true })
    const count = wrapper.emitted('change')?.length
    await wrapper.get('[role="slider"]').trigger('keydown', { key: 'ArrowLeft' })
    expect(wrapper.emitted('change')?.length).toBe(count)
  })

  it('moves labels continuously, coasts from a fast release and snaps to a whole $5 notch', async () => {
    motionClock()
    const wrapper = render('50.25')
    const fire = gestures(wrapper)
    await fire('pointerdown')
    await vi.advanceTimersByTimeAsync(16)
    await fire('pointermove', 125, 32)
    expect(wrapper.get('.ruler-mark').attributes('style')).toContain('translate3d(')
    await vi.advanceTimersByTimeAsync(16)
    await fire('pointermove', 48, 60)
    const released = Number(wrapper.get('input').element.value)
    await fire('pointerup', 48, 60)
    await vi.advanceTimersByTimeAsync(600)
    const settled = Number(wrapper.get('input').element.value)
    expect(settled).toBeGreaterThan(released)
    expect(settled % 5).toBe(0)
    const count = wrapper.emitted('change')?.length
    await vi.advanceTimersByTimeAsync(600)
    expect(wrapper.emitted('change')?.length).toBe(count)
  })

  it('snaps a slow partial drag without a fling and retains horizontal control through vertical drift', async () => {
    motionClock()
    const wrapper = render()
    const fire = gestures(wrapper)
    await fire('pointerdown')
    await vi.advanceTimersByTimeAsync(30)
    await fire('pointermove', 110, 80)
    await vi.advanceTimersByTimeAsync(120)
    await fire('pointerup', 110, 80)
    await vi.advanceTimersByTimeAsync(240)
    expect(wrapper.get('input').element.value).toBe('50')
    await fire('pointerdown')
    await vi.advanceTimersByTimeAsync(30)
    await fire('pointermove', 48, 130)
    await vi.advanceTimersByTimeAsync(120)
    await fire('pointerup')
    await vi.advanceTimersByTimeAsync(240)
    expect(wrapper.get('input').element.value).toBe('55')
  })

  it('stops momentum for manual/date updates and pointer cancellation', async () => {
    motionClock()
    const wrapper = render()
    const fire = gestures(wrapper)
    await fire('pointerdown')
    await vi.advanceTimersByTimeAsync(16)
    await fire('pointermove', 48)
    await fire('pointerup', 48)
    await vi.advanceTimersByTimeAsync(32)
    await wrapper.setProps({ value: '123.45' })
    await vi.advanceTimersByTimeAsync(600)
    expect(wrapper.get('input').element.value).toBe('123.45')
    await fire('pointerdown')
    await vi.advanceTimersByTimeAsync(16)
    await fire('pointermove', 48)
    await fire('pointercancel')
    const count = wrapper.emitted('change')?.length
    await vi.advanceTimersByTimeAsync(600)
    expect(wrapper.emitted('change')?.length).toBe(count)
  })

  it('respects reduced motion and cancels scheduled animation on unmount', async () => {
    motionClock(true)
    const wrapper = render()
    const fire = gestures(wrapper)
    await fire('pointerdown')
    await vi.advanceTimersByTimeAsync(16)
    await fire('pointermove', 48)
    await fire('pointerup', 48)
    await vi.advanceTimersByTimeAsync(600)
    expect(wrapper.get('input').element.value).toBe('55')
    vi.stubGlobal('matchMedia', () => ({ matches: false }))
    await fire('pointerdown')
    await vi.advanceTimersByTimeAsync(16)
    await fire('pointermove', 48)
    await fire('pointerup', 48)
    expect(vi.getTimerCount()).toBeGreaterThan(0)
    wrappers.splice(wrappers.indexOf(wrapper), 1)
    wrapper.unmount()
    expect(vi.getTimerCount()).toBe(0)
  })
})
