<script setup lang="ts">
import { nextTick, ref } from 'vue'
import MoneyRuler from './MoneyRuler.vue'
import DateRuler from './DateRuler.vue'

defineProps<{
  cards: { id: number; kind: 'monthly' | 'one-time'; amount: string; enabled: boolean }[]
  disabled: boolean
  balanceCents: number
  minimumCents: number
  goalMonth: string
  goalAnchor: string
  goalMaxMonths: number
  goalBusy: boolean
  goalStatus: string
  goalDisabled: boolean
  errors: { amount?: string; monthly?: string; general?: string }
  hasChanges: boolean
}>()
const emit = defineEmits<{
  amount: [id: number, value: string]
  toggle: [id: number]
  goal: [month: string]
  submit: []
}>()
const inputId = (kind: 'monthly' | 'one-time') => kind === 'monthly' ? 'extra-monthly-amount' : 'extra-payment-amount'
const rulers = ref<InstanceType<typeof MoneyRuler>[]>([])
const dateRuler = ref<InstanceType<typeof DateRuler> | null>(null)
let preparingGoal = false
let goalIntent = 0
function stopMoney() {
  preparingGoal = true
  rulers.value.forEach(ruler => ruler.stop())
  preparingGoal = false
}
function changeAmount(id: number, value: string) {
  if (!preparingGoal) { goalIntent++; void dateRuler.value?.reset() }
  emit('amount', id, value)
}
function toggle(id: number) {
  stopMoney()
  goalIntent++
  void dateRuler.value?.reset()
  emit('toggle', id)
}
async function chooseGoal(month: string) {
  const intent = ++goalIntent
  stopMoney()
  // Commit a coasting amount before starting the date calculation.
  await nextTick()
  if (intent === goalIntent) emit('goal', month)
}
</script>

<template>
  <section id="extra-payment" class="simulator" aria-labelledby="extra-payment-heading">
    <div class="explore-heading"><h2 id="extra-payment-heading">Explore payments</h2></div>
    <form class="scenario-form" novalidate @submit.prevent="emit('submit')">
      <section class="goal-control" :aria-busy="goalBusy">
        <DateRuler ref="dateRuler" :month="goalMonth" :anchor="goalAnchor" :max-months="goalMaxMonths" :busy="goalBusy" :status="goalStatus" :disabled="goalDisabled" @engage="stopMoney" @goal="chooseGoal">
          <div class="goal-feedback-slot"><span v-if="goalBusy" class="goal-spinner" aria-hidden="true" /><details v-else-if="goalStatus" :key="goalStatus" class="goal-feedback" @keydown.esc="($event.currentTarget as HTMLDetailsElement).open = false"><summary aria-label="Goal calculation details" :title="goalStatus">!</summary><p>{{ goalStatus }}</p></details></div>
        </DateRuler>

        <p id="goal-help" class="sr-only">Swipe the date in one-month steps or choose a month to calculate the monthly extra needed once the date settles. This month uses a full one-time payoff and no monthly extra; other goals keep your one-time payment fixed.</p>
        <p id="goal-status" class="sr-only" role="status">{{ goalBusy ? 'Calculating monthly extra…' : goalStatus }}</p>
      </section>
      <div class="exploration-options">
        <section v-for="card in cards" :key="card.id" class="saving-card" :class="{ excluded: !card.enabled }">
          <button class="payment-toggle" type="button" role="switch" :aria-label="card.kind === 'monthly' ? 'Include extra monthly payment' : 'Include one-time payment'" :aria-checked="card.enabled" :disabled="disabled" @click="toggle(card.id)"><span /></button>
          <MoneyRuler :id="inputId(card.kind)" ref="rulers" :label="card.kind === 'monthly' ? 'Extra each month' : 'Pay once'" :value="card.amount" :disabled="disabled || !card.enabled" @change="changeAmount(card.id, $event)" />
        </section>
      </div>
      <p v-if="Object.keys(errors).length" class="field-error" role="alert" tabindex="-1">{{ errors.general ?? 'Check the highlighted fields.' }}</p>
      <p v-if="hasChanges" class="date-warning" role="status">Invalid inputs aren’t applied; the chart and results still show your last valid comparison.</p>
    </form>
  </section>
</template>

<style scoped>
.simulator { margin: 12px 0; min-width: 0; }
.explore-heading { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
h2 { font-size: 16px; margin: 0; }
.scenario-form { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; margin-top: 8px; }
.exploration-options { display: contents; }
.saving-card, .goal-control { position: relative; min-width: 0; padding: 12px; border: 0; border-radius: var(--radius-lg); background: var(--surface); }
.goal-control { grid-column: 1 / -1; padding: 6px 12px; }
.excluded :deep(.money-ruler) { opacity: .5; }
.payment-toggle { position: absolute; z-index: 1; right: 8px; top: 2px; display: flex; align-items: center; width: 44px; height: 36px; padding: 9px 6px; border: 0; background: transparent; cursor: pointer; }
.payment-toggle::before { content: ''; position: absolute; width: 32px; height: 18px; border-radius: 10px; background: var(--border-strong); }
.payment-toggle[aria-checked='true']::before { background: var(--text); }
.payment-toggle span { position: relative; width: 12px; height: 12px; border-radius: 50%; background: var(--surface); transform: translateX(3px); transition: transform 120ms ease; }
.payment-toggle[aria-checked='true'] span { transform: translateX(17px); }
.payment-toggle:disabled { cursor: default; opacity: .5; }
.saving-card :deep(label) { display: block; padding: 0 34px; min-height: 18px; }
.date-warning { font-size: 12px; line-height: 1.5; color: var(--text-secondary); margin: 8px 0 0; }
.goal-feedback-slot { display: flex; align-items: center; justify-content: center; width: 20px; height: 18px; flex: 0 0 20px; }
.goal-feedback { position: relative; }
.goal-feedback summary { display: grid; place-items: center; width: 32px; height: 32px; border-radius: 50%; background: var(--surface); color: var(--danger); font-weight: 700; cursor: pointer; list-style: none; }
.goal-feedback summary::-webkit-details-marker { display: none; }
.goal-feedback p { position: absolute; z-index: 5; top: 100%; left: 50%; transform: translateX(-70%); width: min(18rem, calc(100vw - 4rem)); margin: 6px 0 0; padding: 12px; border: 1px solid var(--border-strong); border-radius: var(--radius-sm); background: var(--surface); color: var(--text-secondary); box-shadow: var(--shadow-modal); font-size: 12px; line-height: 1.5; }
.goal-spinner { width: 14px; height: 14px; border: 2px solid var(--border-strong); border-top-color: var(--chart-line); border-radius: 50%; animation: goal-spin 800ms linear infinite; }
@keyframes goal-spin { to { transform: rotate(360deg); } }
@media (prefers-reduced-motion: reduce) { .goal-spinner { animation: none; } }
.field-error { margin: 8px 0 0; color: var(--danger); font-size: 12px; }
@media (max-width: 39.99rem) {
  .scenario-form { grid-template-columns: minmax(0, 1fr); }
}
@media (min-width: 600px) { .goal-feedback p { left: 0; transform: none; } }
@media (min-width: 64rem) {
  .scenario-form { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
.scenario-form > .field-error, .scenario-form > .date-warning { grid-column: 1 / -1; }
@media (prefers-reduced-motion: reduce) { .payment-toggle span { transition: none; } }
@media (any-pointer: coarse) { .payment-toggle { height: 44px; top: 0; } .saving-card :deep(label) { display: flex; align-items: center; justify-content: center; min-height: 32px; } }
</style>
