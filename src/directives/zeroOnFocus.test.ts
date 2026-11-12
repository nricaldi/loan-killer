import { mount, type VueWrapper } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import { ref } from 'vue'
import { vZeroOnFocus } from './zeroOnFocus'
let wrapper: VueWrapper
function render(initial = '0') {
  const amount = ref(initial)
  wrapper = mount({
    directives: { zeroOnFocus: vZeroOnFocus },
    setup: () => ({ amount, updates: ref(0) }),
    template: '<div><input v-model="amount" v-zero-on-focus /><output>{{ amount }}</output><button @click="updates++">{{ updates }}</button></div>',
  }, { attachTo: document.body })
  return amount
}
afterEach(() => wrapper.unmount())
describe('zero-on-focus editing', () => {
  it('clears the displayed zero without changing the model and survives unrelated rerenders', async () => {
    const amount = render()
    const input = wrapper.get<HTMLInputElement>('input')
    input.element.focus()
    expect(input.element.value).toBe('')
    expect(amount.value).toBe('0')
    await wrapper.get('button').trigger('click')
    expect(input.element.value).toBe('')
    input.element.blur()
    expect(input.element.value).toBe('0')
    expect(amount.value).toBe('0')
  })
  it('lets typing replace zero directly and keeps the new amount on blur', async () => {
    const amount = render('0.00')
    const input = wrapper.get<HTMLInputElement>('input')
    input.element.focus()
    await input.setValue('25')
    input.element.blur()
    expect(input.element.value).toBe('25')
    expect(amount.value).toBe('25')
  })
  it('restores a zero that was emptied after typing, without making blank positive amounts silently zero', async () => {
    const amount = render()
    const input = wrapper.get<HTMLInputElement>('input')
    input.element.focus()
    await input.setValue('25')
    await input.setValue('')
    input.element.blur()
    expect(amount.value).toBe('0')
    await input.setValue('100')
    input.element.focus()
    expect(input.element.value).toBe('100')
    await input.setValue('')
    input.element.blur()
    expect(amount.value).toBe('')
  })
  it('does not erase a zero the user explicitly types while editing', async () => {
    const amount = render()
    const input = wrapper.get<HTMLInputElement>('input')
    input.element.focus()
    await input.setValue('0')
    await wrapper.get('button').trigger('click')
    expect(input.element.value).toBe('0')
    expect(amount.value).toBe('0')
  })
})
