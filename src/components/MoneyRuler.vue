<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { vZeroOnFocus } from '../directives/zeroOnFocus'
import { parseMoney } from '../domain/loanForm'
import { money } from '../format'

const props = defineProps<{ id: string; label: string; value: string; disabled: boolean }>()
const emit = defineEmits<{ change: [value: string] }>()
const LIMIT = 1_000_000_000
const STEP = 500
const amount = computed(() => props.value.trim() === '' ? 0 : parseMoney(props.value))
const cents = computed(() => amount.value ?? 0)
const input = ref<HTMLInputElement | null>(null)
const strip = ref<HTMLElement | null>(null)
const offset = ref(0)
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2, minimumFractionDigits: 0 })
const adjacent = computed(() => [-1, 1].map(direction => ({
  direction,
  value: cents.value + direction * STEP,
})).filter(item => item.value >= 0 && item.value <= LIMIT))
let drag: { id: number; x: number; y: number; start: number; spacing: number; locked: boolean } | null = null
function update(value: number) { emit('change', String(Math.max(0, Math.min(LIMIT, value)) / 100)) }
function keydown(event: KeyboardEvent) {
  // Left/right remain caret navigation when editing an exact amount.
  if (event.currentTarget === input.value && ['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  const direction = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 0
  if (direction && !props.disabled) {
    event.preventDefault()
    update(cents.value + direction * STEP)
  }
}
function start(event: PointerEvent) {
  if (props.disabled || event.button !== 0 || !event.isPrimary) return
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: cents.value, spacing: Math.max(70, Math.min(130, (strip.value?.clientWidth ?? 300) * .34)), locked: false }
}
function move(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  const dx = drag.x - event.clientX
  const dy = event.clientY - drag.y
  if (!drag.locked) {
    if (Math.abs(dy) > 7 && Math.abs(dy) > Math.abs(dx)) { finish(); return }
    if (Math.abs(dx) < 7) return
    drag.locked = true
    strip.value?.setPointerCapture(event.pointerId)
  }
  const steps = Math.round(dx / drag.spacing)
  const next = Math.max(0, Math.min(LIMIT, drag.start + steps * STEP))
  // Boundaries stop the visual as well as the amount; lifting always stops immediately.
  offset.value = next === 0 || next === LIMIT ? 0 : -(dx - steps * drag.spacing)
  if (next !== cents.value) update(next)
}
function finish() {
  const id = drag?.id
  drag = null
  offset.value = 0
  if (id !== undefined && strip.value?.hasPointerCapture(id)) strip.value.releasePointerCapture(id)
}
watch(() => props.disabled, value => { if (value) finish() })
</script>

<template>
  <div class="money-ruler" :class="{ disabled }">
    <label :for="id">{{ label }}</label>
    <div class="amount-value"><span aria-hidden="true">$</span><input :id="id" ref="input" v-zero-on-focus :value="value" :style="{ width: `${Math.max(1, value.length)}ch` }" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" :disabled="disabled" :aria-invalid="amount === null" :aria-describedby="amount === null ? `${id}-error` : undefined" @input="emit('change', ($event.target as HTMLInputElement).value)" @blur="value.trim() === '' && emit('change', '0')" @keydown="keydown" @keydown.enter.prevent="input?.blur()" /></div>
    <div ref="strip" class="number-strip" role="slider" :tabindex="disabled ? -1 : 0" :aria-label="`${label} ruler`" aria-valuemin="0" :aria-valuemax="LIMIT / 100" :aria-valuenow="cents / 100" :aria-valuetext="money(cents)" :aria-disabled="disabled" :aria-describedby="`${id}-help`" @keydown="keydown" @pointerdown="start" @pointermove="move" @pointerup="finish" @pointercancel="finish" @lostpointercapture="finish" @blur="finish">
      <span v-for="item in adjacent" :key="item.direction" class="neighbor" :class="item.direction < 0 ? 'previous' : 'next'" :style="{ transform: `translateX(${offset}px)` }" aria-hidden="true">{{ currency.format(item.value / 100) }}</span>
      <span class="center-notch" aria-hidden="true" />
    </div>
    <p :id="`${id}-help`" class="sr-only">Swipe left to increase or right to decrease by five dollars. Use arrow keys, or tap the amount to enter an exact value.</p>
    <p v-if="amount === null" :id="`${id}-error`" class="field-error">Enter $0–$10,000,000 with up to two decimal places.</p>
  </div>
</template>

<style scoped>
.money-ruler { min-width: 0; text-align: center; }
label { font-size: 12px; font-weight: 650; color: var(--text-secondary); }
.amount-value { display: flex; align-items: baseline; justify-content: center; min-height: 52px; margin-top: 5px; font-size: clamp(24px, 4vw, 32px); font-weight: 650; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.amount-value input { font: inherit; letter-spacing: inherit; min-width: 1ch; max-width: calc(100% - 1.2ch); min-height: 44px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--text); text-align: center; }
.amount-value input[aria-invalid='true'] { color: var(--danger); }
.number-strip { position: relative; height: 58px; margin-top: 0; overflow: hidden; border-radius: 4px; cursor: ew-resize; touch-action: pan-y pinch-zoom; user-select: none; -webkit-user-select: none; }
.neighbor { position: absolute; top: 10px; width: 40%; font-size: 14px; font-variant-numeric: tabular-nums; color: var(--text-secondary); white-space: nowrap; pointer-events: none; }
.previous { left: 0; }
.next { right: 0; }
.center-notch { position: absolute; width: 2px; height: 15px; left: calc(50% - 1px); top: 12px; border-radius: 2px; background: var(--text); pointer-events: none; }
.disabled { opacity: .5; }
.disabled .number-strip { cursor: default; }
.field-error { margin: 4px 0 0; color: var(--danger); font-size: 12px; }
</style>
