<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'

const props = withDefaults(defineProps<{
  value: number | null
  min?: number
  max: number
  step: number
  label: string
  disabled: boolean
  format: (value: number) => string
  compact?: boolean
  settledOnly?: boolean
  ariaScale?: number
  valueText?: (value: number) => string
}>(), { min: 0, compact: false, settledOnly: false, ariaScale: 1, valueText: undefined })
const emit = defineEmits<{
  change: [value: number]
  preview: [value: number]
  interaction: [active: boolean, pointer?: boolean]
}>()
const amount = computed(() => props.value)
const idleValue = ref(props.value ?? props.min)
const strip = ref<HTMLElement | null>(null)
const position = ref(amount.value ?? 0)
const moving = ref(false)
const width = ref(300)
const spacing = computed(() => Math.max(70, Math.min(130, width.value * .34)))
const clamp = (value: number) => Math.max(props.min, Math.min(props.max, value))
const snapped = (value: number) => clamp(Math.round(value / props.step) * props.step)
const selected = computed(() => moving.value ? snapped(position.value) : idleValue.value)
// Recycle offscreen marks by their monetary value, keeping visible labels continuous.
const marks = computed(() => {
  const center = Math.round(position.value / props.step)
  return [-2, -1, 0, 1, 2].map(offset => {
    const value = (center + offset) * props.step
    const distance = (value - position.value) / props.step
    return {
      value, x: distance * spacing.value,
      opacity: Math.min(1, Math.abs(distance) * 1.5),
      edgeOpacity: Math.max(0, Math.min(1, (1.3 - Math.abs(distance)) * 4)),
    }
  }).filter(mark => mark.value >= props.min && mark.value <= props.max)
})
type Sample = { time: number; position: number }
let drag: { id: number; x: number; y: number; start: number; spacing: number; locked: boolean; samples: Sample[] } | null = null
let frame: number | undefined
let observer: ResizeObserver | undefined
let lastPublished = amount.value ?? 0
let lastPublishedAt = -Infinity
function update(value: number) {
  lastPublished = value
  emit('change', value)
}
function publish(force = false) {
  if (props.settledOnly && !force) return
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
  idleValue.value = wasMoving ? snapped(position.value) : amount.value ?? lastPublished
  moving.value = false
  position.value = idleValue.value
  emit('interaction', false)
}
function cancel() {
  cancelMotion()
  releaseCapture()
  idleValue.value = amount.value ?? idleValue.value
  position.value = idleValue.value
  lastPublished = idleValue.value
  moving.value = false
  emit('interaction', false)
}
function nudge(direction: number) {
  if (props.disabled) return
  const current = selected.value
  cancelMotion()
  releaseCapture()
  emit('interaction', true)
  moving.value = false
  const next = clamp((direction > 0 ? Math.floor(current / props.step) + 1 : Math.ceil(current / props.step) - 1) * props.step)
  position.value = next
  idleValue.value = next
  update(next)
  emit('interaction', false)
}
function keydown(event: KeyboardEvent) {
  const direction = ['ArrowRight', 'ArrowUp'].includes(event.key) ? 1 : ['ArrowLeft', 'ArrowDown'].includes(event.key) ? -1 : 0
  if (direction && !props.disabled) { event.preventDefault(); nudge(direction) }
}
function start(event: PointerEvent) {
  if (props.disabled || event.button !== 0 || !event.isPrimary) return
  cancelMotion()
  emit('interaction', true, true)
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
  position.value = clamp(drag.start + dx / drag.spacing * props.step)
  drag.samples.push({ time: now, position: position.value })
  drag.samples = drag.samples.filter(sample => now - sample.time <= 90)
  publish()
}
function settle(velocity = 0) {
  const from = position.value
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches
  const target = snapped(from + (reduced ? 0 : Math.max(-.04, Math.min(.04, velocity / props.step)) * props.step * 180))
  const duration = reduced || from === target ? 0 : Math.abs(velocity / props.step) > .001 ? 540 : 180
  if (!duration) {
    position.value = target
    publish(true)
    idleValue.value = target
    moving.value = false
    emit('interaction', false)
    return
  }
  const started = performance.now()
  function animate(now: number) {
    const progress = Math.min(1, (now - started) / duration)
    // Ease-out preserves the release speed and pulls the final position into a notch.
    position.value = from + (target - from) * (1 - (1 - progress) ** 3)
    publish(progress === 1)
    if (progress < 1) frame = requestAnimationFrame(animate)
    else { frame = undefined; idleValue.value = target; moving.value = false; emit('interaction', false) }
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
  else emit('interaction', false)
}
function cancelGesture() {
  if (!drag) return
  releaseCapture()
  cancelMotion()
  if (moving.value) { position.value = snapped(position.value); publish(true) }
  idleValue.value = snapped(position.value)
  moving.value = false
  emit('interaction', false)
}
watch(selected, value => emit('preview', value))
watch(() => props.value, () => {
  // Our own coalesced emissions must not reset the sub-pixel animation position.
  if (amount.value === lastPublished && moving.value) return
  cancelMotion()
  releaseCapture()
  moving.value = false
  lastPublished = amount.value ?? lastPublished
  position.value = amount.value ?? position.value
  idleValue.value = amount.value ?? idleValue.value
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
defineExpose({ stop, cancel, nudge, selected, moving, start, move, finish, cancelGesture })
onBeforeUnmount(() => {
  cancelMotion()
  releaseCapture()
  observer?.disconnect()
  window.removeEventListener('blur', stop)
  document.removeEventListener('visibilitychange', stop)
})
</script>

<template>
  <div ref="strip" class="number-strip" :class="{ disabled, compact }" role="slider" :tabindex="disabled ? -1 : 0" :aria-label="label" :aria-valuemin="min / ariaScale" :aria-valuemax="max / ariaScale" :aria-valuenow="selected / ariaScale" :aria-valuetext="(valueText ?? format)(selected)" :aria-disabled="disabled" @keydown="keydown" @pointerdown="start" @pointermove="move" @pointerup="finish" @pointercancel="cancelGesture" @lostpointercapture="cancelGesture">
    <span v-for="mark in (compact ? [] : marks)" :key="mark.value" class="ruler-mark" :style="{ transform: `translate3d(${mark.x}px, 0, 0)`, opacity: mark.edgeOpacity }" aria-hidden="true"><span class="tick-label" :style="{ opacity: mark.opacity }">{{ format(mark.value) }}</span><i /></span>
    <span v-if="!compact" class="center-notch" aria-hidden="true" />
  </div>
</template>

<style scoped>
.number-strip { position: relative; height: 54px; margin-top: 0; overflow: hidden; border-radius: 4px; cursor: grab; touch-action: pinch-zoom; user-select: none; -webkit-user-select: none; overscroll-behavior-x: contain; }
.number-strip.compact::before, .number-strip.compact::after { display: none; }
.number-strip.compact { height: 44px; background: transparent; }
.number-strip:active { cursor: grabbing; }
.number-strip::before, .number-strip::after { content: ''; position: absolute; z-index: 2; top: 0; bottom: 0; width: 16px; pointer-events: none; }
.number-strip::before { left: 0; background: linear-gradient(to right, var(--surface), transparent); }
.number-strip::after { right: 0; background: linear-gradient(to left, var(--surface), transparent); }
.ruler-mark { position: absolute; left: 50%; top: 8px; width: 0; height: 42px; pointer-events: none; will-change: transform; }
.tick-label { display: block; position: absolute; left: -55px; width: 110px; text-align: center; font-size: 14px; font-variant-numeric: tabular-nums; color: var(--text-secondary); white-space: nowrap; }
.ruler-mark i { position: absolute; top: 28px; left: -.5px; width: 1px; height: 10px; background: var(--text-placeholder); }
.center-notch { position: absolute; width: 2px; height: 18px; left: calc(50% - 1px); top: 32px; border-radius: 2px; background: var(--text); pointer-events: none; }
.disabled { opacity: .5; cursor: default; }
</style>
