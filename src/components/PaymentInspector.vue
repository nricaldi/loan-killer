<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { daysBetween } from '../domain/dates'
import type { Payment } from '../domain/loan'
import { formatDate, money } from '../format'

const props = defineProps<{ payments: readonly Payment[]; balanceDate: string; initialBalanceCents: number; label: string; endDate?: string }>()
const emit = defineEmits<{ inspect: [date: string] }>()
const id = useId()
const index = ref(0)
const timeline = computed(() => {
  let principal = 0
  let interest = 0
  return [
    { date: props.balanceDate, principal: 0, interest: 0, balance: props.initialBalanceCents },
    ...props.payments.map((payment) => {
      principal += payment.principalPaidCents
      interest += payment.interestPaidCents
      return { date: payment.date, principal, interest, balance: payment.balanceCents }
    }),
  ]
})
const current = computed(() => timeline.value[Math.min(index.value, timeline.value.length - 1)]!)
watch(timeline, () => { index.value = 0 })
watch(current, (point) => emit('inspect', point.date))

function inspectRatio(ratio: number) {
  const duration = daysBetween(props.balanceDate, props.endDate ?? timeline.value.at(-1)?.date ?? props.balanceDate)
  const target = Math.max(0, Math.min(1, ratio)) * duration
  let nearest = 0
  for (const [index, point] of timeline.value.entries()) {
    if (Math.abs(daysBetween(props.balanceDate, point.date) - target) <= Math.abs(daysBetween(props.balanceDate, timeline.value[nearest]!.date) - target)) nearest = index
  }
  index.value = nearest
}

defineExpose({ inspectRatio })
</script>

<template>
  <div class="payment-inspector">
    <label :for="`${id}-timeline`">Explore payments <strong>{{ formatDate(current.date) }}</strong></label>
    <input :id="`${id}-timeline`" v-model.number="index" type="range" min="0" :max="timeline.length - 1" step="1" :aria-valuetext="`${label}, ${formatDate(current.date)}: ${money(current.principal + current.interest)} paid, ${money(current.balance)} balance`" />
    <dl>
      <div><dt>Principal paid</dt><dd>{{ money(current.principal) }}</dd></div>
      <div><dt>Interest paid</dt><dd>{{ money(current.interest) }}</dd></div>
      <div><dt>Balance left</dt><dd>{{ money(current.balance) }}</dd></div>
    </dl>
    <p>{{ label }} · Hover, touch, or use the slider to inspect a payment.</p>
  </div>
</template>

<style scoped>
.payment-inspector { margin-top: var(--space-4); padding: var(--space-3); border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--surface-muted); }
label { display: flex; flex-wrap: wrap; justify-content: space-between; gap: var(--space-2); font-size: var(--font-xs); color: var(--text-secondary); }
label strong { color: var(--text); font-weight: 600; }
input { display: block; width: 100%; min-height: 2rem; margin: var(--space-1) 0; accent-color: var(--chart-line); cursor: pointer; }
dl { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: var(--space-2); margin: 0; }
dt { font-size: var(--font-xs); color: var(--text-muted); }
dd { margin: var(--space-1) 0 0; font-size: var(--font-sm); font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
p { margin: var(--space-2) 0 0; font-size: 0.65rem; color: var(--text-muted); line-height: 1.5; }
</style>
