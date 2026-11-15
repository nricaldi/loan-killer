import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import DateRuler from './DateRuler.vue'
import RulerStrip from './RulerStrip.vue'

const wrappers: VueWrapper[] = []
function render() {
  const wrapper = mount(DateRuler, { props: { month: '2030-01', anchor: '2026-11-15', maxMonths: 600, busy: false, status: '', disabled: false } })
  wrappers.push(wrapper)
  return wrapper
}
function clock(reduced = false) {
  vi.useFakeTimers()
  vi.stubGlobal('matchMedia', () => ({ matches: reduced }))
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(performance.now()), 16))
  vi.stubGlobal('cancelAnimationFrame', (id: number) => clearTimeout(id))
}
function gesture(wrapper: VueWrapper) {
  const strip = wrapper.get<HTMLElement>('[role="slider"]')
  strip.element.setPointerCapture = vi.fn()
  strip.element.hasPointerCapture = vi.fn(() => false)
  return async (type: string, x = 150) => {
    const event = new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, clientX: x, clientY: 20 })
    Object.defineProperties(event, { pointerId: { value: 1 }, isPrimary: { value: true } })
    strip.element.dispatchEvent(event)
    await wrapper.vm.$nextTick()
  }
}
afterEach(() => {
  wrappers.splice(0).forEach(wrapper => wrapper.unmount())
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('settled payoff-date ruler', () => {
  it('previews months locally through a fling and requests exactly one goal after settling', async () => {
    clock()
    const wrapper = render()
    const fire = gesture(wrapper)
    await fire('pointerdown')
    await vi.advanceTimersByTimeAsync(16)
    await fire('pointermove', 125)
    expect(wrapper.find('.ruler-mark').exists()).toBe(false)
    expect(wrapper.findAll('.sliding-month').some(label => /\d\.\d/.test(label.attributes('style') ?? ''))).toBe(true)
    await vi.advanceTimersByTimeAsync(16)
    await fire('pointermove', 48)
    expect(wrapper.get<HTMLInputElement>('#payoff-goal-month').element.value).toBe('2030-02')
    expect(wrapper.emitted('goal')).toBeUndefined()
    await fire('pointerup', 48)
    await vi.advanceTimersByTimeAsync(200)
    expect(wrapper.emitted('goal')).toBeUndefined()
    await vi.advanceTimersByTimeAsync(400)
    expect(wrapper.emitted('goal')).toHaveLength(1)
    const month = wrapper.emitted('goal')![0]![0] as string
    expect(month > '2030-02').toBe(true)
    expect(wrapper.get<HTMLInputElement>('#payoff-goal-month').element.value).toBe(month)
  })

  it('updates repeated month taps immediately while waiting for the latest calculated result', async () => {
    const wrapper = render()
    const earlier = wrapper.get('[aria-label="Pay off one month earlier"]')
    await earlier.trigger('click')
    await wrapper.setProps({ busy: true })
    await earlier.trigger('click')
    await earlier.trigger('click')
    expect(wrapper.emitted('goal')?.map(args => args[0])).toEqual(['2029-12', '2029-11', '2029-10'])
    expect(wrapper.get<HTMLInputElement>('#payoff-goal-month').element.value).toBe('2029-10')
    await wrapper.setProps({ month: '2029-12' })
    expect(wrapper.get<HTMLInputElement>('#payoff-goal-month').element.value).toBe('2029-10')
    await wrapper.setProps({ month: '2029-10', busy: false })
    expect(wrapper.get<HTMLInputElement>('#payoff-goal-month').element.value).toBe('2029-10')
  })

  it('supports exact month entry and restores the achieved month if its goal fails', async () => {
    const wrapper = render()
    await wrapper.get('#payoff-goal-month').setValue('2028-07')
    expect(wrapper.emitted('goal')?.at(-1)).toEqual(['2028-07'])
    expect(wrapper.get<HTMLInputElement>('#payoff-goal-month').element.value).toBe('2028-07')
    await wrapper.setProps({ busy: true })
    await wrapper.setProps({ busy: false, status: 'This date cannot be reached.' })
    await wrapper.vm.$nextTick()
    expect(wrapper.get<HTMLInputElement>('#payoff-goal-month').element.value).toBe('2030-01')
  })

  it('cancels pending motion when a money edit resets the date', async () => {
    clock()
    const wrapper = render()
    const fire = gesture(wrapper)
    await fire('pointerdown')
    await vi.advanceTimersByTimeAsync(16)
    await fire('pointermove', 48)
    await fire('pointerup', 48)
    await vi.advanceTimersByTimeAsync(100)
    await (wrapper.vm as unknown as { reset: () => Promise<void> }).reset()
    await vi.advanceTimersByTimeAsync(600)
    expect(wrapper.emitted('goal')).toBeUndefined()
    expect(wrapper.get<HTMLInputElement>('#payoff-goal-month').element.value).toBe('2030-01')
  })

  it('uses identical momentum in month and money units, with a single final date emission', async () => {
    clock()
    const displacements: number[] = []
    for (const step of [1, 500]) {
      const wrapper = mount(RulerStrip, { props: { value: 20 * step, step, max: 1000 * step, label: 'Test ruler', disabled: false, format: String, settledOnly: step === 1 } })
      wrappers.push(wrapper)
      const fire = gesture(wrapper)
      await fire('pointerdown')
      await vi.advanceTimersByTimeAsync(16)
      await fire('pointermove', 48)
      await fire('pointerup', 48)
      await vi.advanceTimersByTimeAsync(600)
      const changes = wrapper.emitted('change')!
      displacements.push(Number(changes.at(-1)![0]) / step - 20)
      if (step === 1) expect(changes).toHaveLength(1)
    }
    expect(displacements[0]).toBe(displacements[1])
    expect(displacements[0]).toBeGreaterThan(1)
  })
})
