<script setup lang="ts">
import { computed, nextTick, ref, watch } from 'vue'
import { addMonths, parseDate } from '../domain/dates'
import { formatDate } from '../format'
import RulerStrip from './RulerStrip.vue'

const props = defineProps<{ month: string; anchor: string; maxMonths: number; busy: boolean; status: string; disabled: boolean }>()
const emit = defineEmits<{ goal: [month: string]; engage: [] }>()
const ruler = ref<InstanceType<typeof RulerStrip> | null>(null)
const input = ref<HTMLInputElement | null>(null)
const editing = ref(false)
const phase = ref<'idle' | 'moving' | 'pending'>('idle')
const draft = ref<string | null>(null)
function index(month: string) {
  if (!month || !parseDate(`${month}-01`)) return Math.min(120, props.maxMonths)
  return Math.max(0, Math.min(props.maxMonths, (Number(month.slice(0, 4)) - Number(props.anchor.slice(0, 4))) * 12 + Number(month.slice(5, 7)) - Number(props.anchor.slice(5, 7))))
}
const source = ref(index(props.month))
const monthAt = (value: number) => addMonths(props.anchor, value).slice(0, 7)
const displayMonth = computed(() => draft.value ?? props.month)
const displayIndex = computed(() => index(displayMonth.value))
const slidingMonths = computed(() => {
  const position = ruler.value?.position ?? source.value
  const center = Math.round(position)
  return [-2, -1, 0, 1, 2].map(offset => ({ value: center + offset, distance: center + offset - position }))
    .filter(item => item.value >= 0 && item.value <= props.maxMonths)
})
const monthFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' })
const longMonth = (value: number) => monthFormatter.format(new Date(`${monthAt(value)}-01T00:00:00Z`))
watch(() => ruler.value?.moving, moving => { if (moving) editing.value = false })
function reconcile() {
  phase.value = 'idle'
  draft.value = null
  source.value = index(props.month)
  if (input.value) input.value.value = props.month
}
async function reset() {
  ruler.value?.cancel()
  reconcile()
  await nextTick()
  reconcile()
}
function engage() {
  phase.value = 'moving'
  emit('engage')
}
function interaction(active: boolean) {
  if (active) engage()
  else if (phase.value === 'moving') {
    if (props.busy) phase.value = 'pending'
    else reconcile()
  }
}
function preview(value: number) { if (phase.value === 'moving') draft.value = monthAt(value) }
function commit(value: number) {
  source.value = value
  draft.value = monthAt(value)
  phase.value = 'pending'
  emit('goal', draft.value)
}
function manual(event: Event) {
  const month = (event.target as HTMLInputElement).value
  if (!month || !parseDate(`${month}-01`)) return
  if (month < props.anchor.slice(0, 7) || month > monthAt(props.maxMonths)) { void reset(); return }
  ruler.value?.cancel()
  commit(index(month))
}
function openEditor() {
  if (props.disabled || editing.value || ruler.value?.moving) return
  editing.value = true
  input.value?.focus()
}
function focus() {
  editing.value = true
  engage()
}
function forward(event: PointerEvent, action: 'start' | 'move' | 'finish' | 'cancelGesture') {
  if ((event.target as HTMLElement).closest('button, .number-strip, .date-feedback')) return
  if (action === 'cancelGesture') ruler.value?.cancelGesture()
  else ruler.value?.[action](event)
}
watch(() => props.month, () => { if (phase.value === 'idle') reconcile() })
watch(() => props.busy, async (busy, wasBusy) => {
  if (!busy && wasBusy && phase.value !== 'moving') { await nextTick(); reconcile() }
})
watch(() => props.status, status => { if (status && !props.busy && phase.value !== 'moving') reconcile() })
watch([() => props.anchor, () => props.maxMonths, () => props.disabled], () => { void reset() })
defineExpose({ reset })
</script>

<template>
  <div class="date-ruler" @pointerdown="forward($event, 'start')" @pointermove="forward($event, 'move')" @pointerup="forward($event, 'finish')" @pointercancel="forward($event, 'cancelGesture')">
    <div class="date-label"><label for="payoff-goal-month">Debt-free by</label><span class="date-feedback"><slot /></span></div>
    <div class="month-navigation">
      <button type="button" aria-label="Pay off one month earlier" :disabled="disabled || !displayMonth || displayIndex === 0" @click="ruler?.nudge(-1)">‹</button>
      <div class="month-window" :class="{ editing }" @click="openEditor"><span v-if="!displayMonth" class="sliding-month" aria-hidden="true">Choose month</span><span v-for="item in slidingMonths" v-show="!!displayMonth" :key="item.value" class="sliding-month" :style="{ transform: `translate3d(${item.distance * 100}%, 0, 0)` }" aria-hidden="true">{{ longMonth(item.value) }}</span><input id="payoff-goal-month" ref="input" type="month" :value="displayMonth" :min="anchor.slice(0, 7)" :max="monthAt(maxMonths)" :disabled="disabled" aria-describedby="goal-help goal-status" @focus="focus" @blur="editing = false; interaction(false)" @change="manual" /></div>
      <button type="button" aria-label="Pay off one month later" :disabled="disabled || !displayMonth || displayIndex >= maxMonths" @click="ruler?.nudge(1)">›</button>
    </div>
    <RulerStrip ref="ruler" compact :value="source" :max="maxMonths" :step="1" label="Debt-free date ruler" :format="value => formatDate(`${monthAt(value)}-01`, true)" :disabled="disabled" settled-only aria-describedby="goal-help goal-status" @preview="preview" @change="commit" @interaction="interaction" />
  </div>
</template>

<style scoped>
.date-ruler { touch-action: pinch-zoom; position: relative; display: flex; align-items: center; justify-content: space-between; gap: 8px; min-width: 0; text-align: center; }
.date-label { position: relative; z-index: 2; pointer-events: none; display: flex; align-items: center; justify-content: center; gap: 4px; min-height: 18px; }
.date-feedback { pointer-events: auto; position: absolute; top: 0; left: calc(50% + 48px); }
label { font-size: 12px; font-weight: 650; color: var(--text-secondary); }
.month-navigation { position: relative; z-index: 2; pointer-events: none; display: flex; align-items: center; justify-content: center; min-width: 0; min-height: 44px; margin-top: 0; }
.month-navigation button { pointer-events: auto; z-index: 3; width: 36px; height: 36px; min-height: 36px; flex: 0 0 36px; padding: 0; border: 0; border-radius: 10px; background: var(--surface-muted); color: var(--text-secondary); font-size: 22px; }
.month-navigation button:disabled { opacity: .3; cursor: default; }
.month-window { position: relative; width: 15rem; max-width: calc(100% - 72px); height: 44px; overflow: hidden; pointer-events: auto; font-size: clamp(16px, 1.6vw, 20px); font-weight: 650; }
.sliding-month { position: absolute; inset: 0; display: grid; place-items: center; white-space: nowrap; will-change: transform; pointer-events: none; }
.month-window input { pointer-events: none; position: absolute; inset: 0; width: 100%; min-width: 0; height: 44px; padding: 0; border: 0; background: transparent; color: var(--text); font: inherit; opacity: 0; }
.month-window.editing input, .month-window input:focus-visible { pointer-events: auto; opacity: 1; background: var(--surface); }
.month-window.editing .sliding-month { visibility: hidden; }
.month-navigation button:hover:not(:disabled) { background: var(--border); }
.date-ruler :deep(.number-strip.compact) { position: absolute; inset: 0; height: 100%; }
@media (max-width: 599px) { .date-ruler { flex-wrap: wrap; justify-content: center; gap: 0; } .date-label { flex: 0 0 100%; } .month-navigation { max-width: 100%; } }
</style>
