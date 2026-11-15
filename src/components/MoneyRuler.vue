<script setup lang="ts">
import { computed, ref } from 'vue'
import { vZeroOnFocus } from '../directives/zeroOnFocus'
import { parseMoney } from '../domain/loanForm'
import { money } from '../format'
import RulerStrip from './RulerStrip.vue'

const props = defineProps<{ id: string; label: string; value: string; disabled: boolean }>()
const emit = defineEmits<{ change: [value: string] }>()
const amount = computed(() => props.value.trim() === '' ? 0 : parseMoney(props.value))
const input = ref<HTMLInputElement | null>(null)
const ruler = ref<InstanceType<typeof RulerStrip> | null>(null)
const moving = computed(() => ruler.value?.moving ?? false)
const inputValue = computed(() => moving.value ? String((ruler.value?.selected ?? 0) / 100) : props.value)
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
function stop() { ruler.value?.stop() }
function interaction(active: boolean, pointer = false) { if (active && pointer) input.value?.blur() }
function keydown(event: KeyboardEvent) {
  if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
    event.preventDefault()
    ruler.value?.nudge(event.key === 'ArrowUp' ? 1 : -1)
  }
}
defineExpose({ stop })
</script>

<template>
  <div class="money-ruler" :class="{ disabled }">
    <label :for="id">{{ label }}</label>
    <div class="value-navigation"><button type="button" :aria-label="`Decrease ${label.toLowerCase()} by five dollars`" :disabled="disabled || (amount ?? 0) <= 0" @click="ruler?.nudge(-1)">−</button><div class="amount-value" :style="{ '--digits': Math.max(4, inputValue.length + 1) }"><span aria-hidden="true">$</span><input :id="id" ref="input" v-zero-on-focus :value="inputValue" :style="{ width: `${Math.max(1, inputValue.length)}ch` }" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" :disabled="disabled" :aria-invalid="amount === null" :aria-describedby="amount === null ? `${id}-error` : undefined" @focus="stop" @input="emit('change', ($event.target as HTMLInputElement).value)" @blur="value.trim() === '' && emit('change', '0')" @keydown="keydown" @keydown.enter.prevent="input?.blur()" /></div><button type="button" :aria-label="`Increase ${label.toLowerCase()} by five dollars`" :disabled="disabled || (amount ?? 0) >= 1_000_000_000" @click="ruler?.nudge(1)">+</button></div>
    <RulerStrip ref="ruler" :value="amount" :max="1_000_000_000" :step="500" :aria-scale="100" :value-text="money" :label="`${label} ruler`" :format="value => currency.format(value / 100)" :disabled="disabled" :aria-describedby="`${id}-help`" @change="emit('change', String($event / 100))" @interaction="interaction" />
    <p :id="`${id}-help`" class="sr-only">Swipe left to increase or right to decrease in whole five-dollar steps. Fast swipes coast and snap to a notch; touch again to stop. Use arrow keys, or tap the amount to enter an exact value.</p>
    <p v-if="amount === null && !disabled" :id="`${id}-error`" class="field-error">Enter $0–$10,000,000 with up to two decimal places.</p>
  </div>
</template>

<style scoped>
.money-ruler { container-type: inline-size; min-width: 0; text-align: center; }
label { font-size: 12px; font-weight: 650; color: var(--text-secondary); }
.value-navigation { display: grid; grid-template-columns: 36px minmax(0, 1fr) 36px; align-items: center; gap: 12px; }
.value-navigation button { width: 36px; height: 36px; min-height: 36px; padding: 0; border: 0; border-radius: 10px; background: var(--surface-muted); color: var(--text-secondary); font-size: 22px; }
.value-navigation button:hover:not(:disabled) { background: var(--border); }
.value-navigation button:disabled { opacity: .3; cursor: default; }
.amount-value { flex: 0 1 auto; min-width: 0; display: flex; align-items: baseline; justify-content: center; min-height: 46px; margin-top: 5px; font-size: clamp(16px, calc((100cqi - 96px) / var(--digits) * 1.5), 32px); font-weight: 650; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.amount-value input { font: inherit; letter-spacing: inherit; min-width: 1ch; flex: 0 0 auto; max-width: calc(100% - 1ch); min-height: 44px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--text); text-align: center; }
.amount-value input[aria-invalid='true'] { color: var(--danger); }

.field-error { margin: 4px 0 0; color: var(--danger); font-size: 12px; }
</style>
