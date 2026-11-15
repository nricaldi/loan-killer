<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { vZeroOnFocus } from '../directives/zeroOnFocus'
import { parseMoney } from '../domain/loanForm'
import { money } from '../format'

const props = defineProps<{ id: string; label: string; value: string; disabled: boolean }>()
const emit = defineEmits<{ change: [value: string] }>()
const LIMIT = 1_000_000_000
const STEP = 500
const amount = computed(() => props.value.trim() === '' ? 0 : parseMoney(props.value))
const input = ref<HTMLInputElement | null>(null)
const strip = ref<HTMLElement | null>(null)
const position = ref(amount.value ?? 0)
const moving = ref(false)
const width = ref(300)
const spacing = computed(() => Math.max(70, Math.min(130, width.value * .34)))
const clamp = (value: number) => Math.max(0, Math.min(LIMIT, value))
const snapped = (value: number) => clamp(Math.round(value / STEP) * STEP)
const selected = computed(() => moving.value ? snapped(position.value) : amount.value ?? 0)
const inputValue = computed(() => moving.value ? String(selected.value / 100) : props.value)
const currency = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 })
// Recycle offscreen marks by their monetary value, keeping visible labels continuous.
const marks = computed(() => {
  const center = Math.round(position.value / STEP)
  return [-2, -1, 0, 1, 2].map(offset => {
    const value = (center + offset) * STEP
    const distance = (value - position.value) / STEP
    return {
      value, x: distance * spacing.value,
      opacity: Math.min(1, Math.abs(distance) * 1.5),
      edgeOpacity: Math.max(0, Math.min(1, (1.3 - Math.abs(distance)) * 4)),
    }
  }).filter(mark => mark.value >= 0 && mark.value <= LIMIT)
})
type Sample = { time: number; position: number }
let drag: { id: number; x: number; y: number; start: number; spacing: number; locked: boolean; samples: Sample[] } | null = null
let frame: number | undefined
let observer: ResizeObserver | undefined
let lastPublished = amount.value ?? 0
let lastPublishedAt = -Infinity
function update(value: number) {
  lastPublished = value
  emit('change', String(value / 100))
}
function publish(force = false) {
  const now = performance.now()
  if (selected.value !== lastPublished && (force || now - lastPublishedAt >= 64)) {
    lastPublishedAt = now
    update(selected.value)
  }
}
function cancelMotion() {
  if (frame !== undefined) cancelAnimationFrame(frame)
  frame = undefined
}
function releaseCapture() {
  const id = drag?.id
  drag = null
  if (id !== undefined && strip.value?.hasPointerCapture(id)) strip.value.releasePointerCapture(id)
}
function stop() {
  const wasMoving = moving.value
  cancelMotion()
  releaseCapture()
  if (wasMoving) { position.value = snapped(position.value); publish(true) }
  moving.value = false
  if (!wasMoving) position.value = amount.value ?? lastPublished
}
function keydown(event: KeyboardEvent) {
  if (event.currentTarget === input.value && ['ArrowLeft', 'ArrowRight'].includes(event.key)) return
  const direction = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 0
  if (direction && !props.disabled) {
    event.preventDefault()
    stop()
    // The first adjustment from an exact amount joins the whole $5 scale.
    const current = amount.value ?? 0
    const next = clamp((direction > 0 ? Math.floor(current / STEP) + 1 : Math.ceil(current / STEP) - 1) * STEP)
    position.value = next
    update(next)
  }
}
function start(event: PointerEvent) {
  if (props.disabled || event.button !== 0 || !event.isPrimary) return
  cancelMotion()
  input.value?.blur()
  // A new touch stops a fling at its current position, without jumping to its destination.
  drag = { id: event.pointerId, x: event.clientX, y: event.clientY, start: position.value, spacing: spacing.value, locked: false, samples: [{ time: performance.now(), position: position.value }] }
}
function move(event: PointerEvent) {
  if (!drag || drag.id !== event.pointerId) return
  const dx = drag.x - event.clientX
  const dy = event.clientY - drag.y
  if (!drag.locked) {
    if (Math.abs(dx) < 4 && Math.abs(dy) < 4) return
    drag.locked = true
    moving.value = true
    strip.value?.setPointerCapture(event.pointerId)
  }
  if (event.cancelable) event.preventDefault()
  const now = performance.now()
  position.value = clamp(drag.start + dx / drag.spacing * STEP)
  drag.samples.push({ time: now, position: position.value })
  drag.samples = drag.samples.filter(sample => now - sample.time <= 90)
  publish()
}
function settle(velocity = 0) {
  const from = position.value
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const target = snapped(from + (reduced ? 0 : Math.max(-20, Math.min(20, velocity)) * 180))
  const duration = reduced || from === target ? 0 : Math.abs(velocity) > .5 ? 540 : 180
  if (!duration) {
    position.value = target
    publish(true)
    moving.value = false
    return
  }
  const started = performance.now()
  function animate(now: number) {
    const progress = Math.min(1, (now - started) / duration)
    // Ease-out preserves the release speed and pulls the final position into a notch.
    position.value = from + (target - from) * (1 - (1 - progress) ** 3)
    publish(progress === 1)
    if (progress < 1) frame = requestAnimationFrame(animate)
    else { frame = undefined; moving.value = false }
  }
  frame = requestAnimationFrame(animate)
}
function finish(event?: PointerEvent) {
  if (event && drag && drag.id !== event.pointerId) return
  const current = drag
  releaseCapture()
  if (current?.locked) {
    const samples = current.samples
    const first = samples[0]
    const last = samples.at(-1)
    const elapsed = first && last ? last.time - first.time : 0
    const velocity = first && last && elapsed >= 8 && performance.now() - last.time < 90
      ? (last.position - first.position) / elapsed : 0
    settle(velocity)
  } else if (moving.value) settle()
}
function cancelGesture() {
  if (!drag) return
  releaseCapture()
  cancelMotion()
  if (moving.value) { position.value = snapped(position.value); publish(true) }
  moving.value = false
}
watch(() => props.value, () => {
  // Our own coalesced emissions must not reset the sub-pixel animation position.
  if (amount.value === lastPublished && moving.value) return
  cancelMotion()
  releaseCapture()
  moving.value = false
  lastPublished = amount.value ?? lastPublished
  position.value = amount.value ?? position.value
})
watch(() => props.disabled, value => { if (value) stop() })
onMounted(() => {
  if (strip.value) {
    width.value = strip.value.clientWidth || 300
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(entries => { width.value = entries[0]?.contentRect.width || 300 })
      observer.observe(strip.value)
    }
  }
  window.addEventListener('blur', stop)
  document.addEventListener('visibilitychange', stop)
})
defineExpose({ stop })
onBeforeUnmount(() => {
  cancelMotion()
  releaseCapture()
  observer?.disconnect()
  window.removeEventListener('blur', stop)
  document.removeEventListener('visibilitychange', stop)
})
</script>

<template>
  <div class="money-ruler" :class="{ disabled }">
    <label :for="id">{{ label }}</label>
    <div class="amount-value"><span aria-hidden="true">$</span><input :id="id" ref="input" v-zero-on-focus :value="inputValue" :style="{ width: `${Math.max(1, inputValue.length)}ch` }" type="text" inputmode="decimal" autocomplete="off" spellcheck="false" :disabled="disabled" :aria-invalid="amount === null" :aria-describedby="amount === null ? `${id}-error` : undefined" @focus="stop" @input="emit('change', ($event.target as HTMLInputElement).value)" @blur="value.trim() === '' && emit('change', '0')" @keydown="keydown" @keydown.enter.prevent="input?.blur()" /></div>
    <div ref="strip" class="number-strip" role="slider" :tabindex="disabled ? -1 : 0" :aria-label="`${label} ruler`" aria-valuemin="0" :aria-valuemax="LIMIT / 100" :aria-valuenow="selected / 100" :aria-valuetext="money(selected)" :aria-disabled="disabled" :aria-describedby="`${id}-help`" @keydown="keydown" @pointerdown="start" @pointermove="move" @pointerup="finish" @pointercancel="cancelGesture" @lostpointercapture="cancelGesture">
      <span v-for="mark in marks" :key="mark.value" class="ruler-mark" :style="{ transform: `translate3d(${mark.x}px, 0, 0)`, opacity: mark.edgeOpacity }" aria-hidden="true"><span class="tick-label" :style="{ opacity: mark.opacity }">{{ currency.format(mark.value / 100) }}</span><i /></span>
      <span class="center-notch" aria-hidden="true" />
    </div>
    <p :id="`${id}-help`" class="sr-only">Swipe left to increase or right to decrease in whole five-dollar steps. Fast swipes coast and snap to a notch; touch again to stop. Use arrow keys, or tap the amount to enter an exact value.</p>
    <p v-if="amount === null" :id="`${id}-error`" class="field-error">Enter $0–$10,000,000 with up to two decimal places.</p>
  </div>
</template>

<style scoped>
.money-ruler { min-width: 0; text-align: center; }
label { font-size: 12px; font-weight: 650; color: var(--text-secondary); }
.amount-value { display: flex; align-items: baseline; justify-content: center; min-height: 52px; margin-top: 5px; font-size: clamp(24px, 4vw, 32px); font-weight: 650; letter-spacing: -.04em; font-variant-numeric: tabular-nums; }
.amount-value input { font: inherit; letter-spacing: inherit; min-width: 1ch; max-width: calc(100% - 1.2ch); min-height: 44px; padding: 0; border: 0; border-radius: 3px; background: transparent; color: var(--text); text-align: center; }
.amount-value input[aria-invalid='true'] { color: var(--danger); }
.number-strip { position: relative; height: 64px; margin-top: 0; overflow: hidden; border-radius: 4px; cursor: grab; touch-action: pinch-zoom; user-select: none; -webkit-user-select: none; overscroll-behavior-x: contain; }
.number-strip:active { cursor: grabbing; }
.number-strip::before, .number-strip::after { content: ''; position: absolute; z-index: 2; top: 0; bottom: 0; width: 16px; pointer-events: none; }
.number-strip::before { left: 0; background: linear-gradient(to right, var(--surface), transparent); }
.number-strip::after { right: 0; background: linear-gradient(to left, var(--surface), transparent); }
.ruler-mark { position: absolute; left: 50%; top: 8px; width: 0; height: 42px; pointer-events: none; will-change: transform; }
.tick-label { display: block; position: absolute; left: -55px; width: 110px; text-align: center; font-size: 14px; font-variant-numeric: tabular-nums; color: var(--text-secondary); white-space: nowrap; }
.ruler-mark i { position: absolute; top: 28px; left: -.5px; width: 1px; height: 10px; background: var(--text-placeholder); }
.center-notch { position: absolute; width: 2px; height: 18px; left: calc(50% - 1px); top: 32px; border-radius: 2px; background: var(--text); pointer-events: none; }
.disabled { opacity: .5; }
.disabled .number-strip { cursor: default; }
.field-error { margin: 4px 0 0; color: var(--danger); font-size: 12px; }
</style>
