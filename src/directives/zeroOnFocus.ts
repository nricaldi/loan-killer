import type { ObjectDirective } from 'vue'

interface EditingState {
  originalZero: string | null
  pristine: boolean
  focus: () => void
  input: () => void
  blur: () => void
}
const states = new WeakMap<HTMLInputElement, EditingState>()
const isZero = (value: string) => /^0+(?:\.0+)?$/.test(value.trim())

// Clear only the presentation on focus. The saved/model value stays zero until
// the user actually types, so merely opening a field cannot alter a projection.
export const vZeroOnFocus: ObjectDirective<HTMLInputElement> = {
  mounted(element) {
    const state: EditingState = {
      originalZero: null, pristine: true,
      focus() {
        state.pristine = true
        state.originalZero = isZero(element.value) ? element.value : null
        if (state.originalZero !== null) element.value = ''
      },
      input() { state.pristine = false },
      blur() {
        if (state.originalZero !== null && element.value.trim() === '') {
          element.value = state.originalZero
          element.dispatchEvent(new Event('input', { bubbles: true }))
        }
        state.originalZero = null
      },
    }
    states.set(element, state)
    element.addEventListener('focus', state.focus)
    element.addEventListener('input', state.input)
    element.addEventListener('blur', state.blur)
  },
  updated(element) {
    const state = states.get(element)
    if (state && state.originalZero !== null && state.pristine && document.activeElement === element && isZero(element.value)) element.value = ''
  },
  beforeUnmount(element) {
    const state = states.get(element)
    if (!state) return
    element.removeEventListener('focus', state.focus)
    element.removeEventListener('input', state.input)
    element.removeEventListener('blur', state.blur)
    states.delete(element)
  },
}
