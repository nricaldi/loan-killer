<script setup lang="ts">
import { computed, ref, useId, watch } from 'vue'
import { parseMoney } from '../domain/loanForm'
import type { LoanRecord } from '../domain/portfolio'
import { money } from '../format'

const props = defineProps<{ loan: LoanRecord; selected: boolean }>()
const emit = defineEmits<{ select: []; payment: [cents: number] }>()
const id = useId()
const amount = ref((props.loan.monthlyPaymentCents / 100).toFixed(2))
const cents = computed(() => parseMoney(amount.value))
const invalid = computed(() => cents.value === null)

watch(() => props.loan.monthlyPaymentCents, (value) => {
  if (parseMoney(amount.value) !== value) amount.value = (value / 100).toFixed(2)
})

function updatePayment(event: Event) {
  if (!(event.target instanceof HTMLInputElement)) return
  amount.value = event.target.value
  if (!invalid.value && cents.value !== null && cents.value !== props.loan.monthlyPaymentCents) {
    emit('payment', cents.value)
  }
}
</script>

<template>
  <div class="loan-chip" :class="{ selected }" :data-chip-id="loan.id">
    <div class="chip-header">
      <button class="chip-name" type="button" :aria-label="`Show ${loan.name} in chart`" :aria-pressed="selected" @click="emit('select')">{{ loan.name }}</button>
      <slot name="actions" />
    </div>
    <p class="chip-balance"><strong>{{ money(loan.principalCents + loan.accruedInterestCents) }}</strong></p>
    <p class="chip-rate">{{ loan.annualRatePercent }}% fixed · {{ loan.type === 'subsidized' ? 'Subsidized' : 'Unsubsidized' }}</p>
    <div class="chip-payment">
      <label :for="`${id}-payment`">Min. / month</label>
      <div class="payment-input"><span aria-hidden="true">$</span><input :id="`${id}-payment`" :value="amount" type="text" inputmode="decimal" :aria-label="`Monthly minimum for ${loan.name}`" :aria-invalid="invalid" :aria-describedby="invalid ? `${id}-error` : 'loan-payment-help'" @input="updatePayment" /></div>
    </div>
    <p v-if="invalid" :id="`${id}-error`" class="field-error" role="status">Use $0–$10,000,000, up to 2 decimals. Estimate uses the last valid minimum.</p>
    <slot />
  </div>
</template>

<style scoped>
.loan-chip { height: 100%; min-width: 0; padding: var(--space-3); background: var(--surface); border: 1px solid var(--border-strong); border-radius: var(--radius-md); }
.loan-chip.selected { border-color: var(--chart-line); background: var(--blue-light); }
.chip-header { display: flex; align-items: center; justify-content: space-between; gap: var(--space-1); }
.chip-name { flex: 1; min-width: 0; padding: 0; min-height: var(--size-icon-button); border: 0; background: transparent; color: var(--text-link); text-align: left; font-size: var(--font-sm); font-weight: 650; overflow-wrap: anywhere; }
.chip-name[aria-pressed='true'] { text-decoration: underline; text-underline-offset: 0.25em; }
.chip-balance { margin: var(--space-1) 0; }
.chip-balance strong { font-size: var(--font-lg); font-variant-numeric: tabular-nums; letter-spacing: -0.03em; overflow-wrap: anywhere; }
.chip-rate { font-size: var(--font-xs); color: var(--text-secondary); line-height: 1.6; }
.chip-rate { margin: 0 0 var(--space-3); }
.chip-payment { display: flex; align-items: center; justify-content: space-between; gap: var(--space-2); margin-top: var(--space-1); }
label { font-size: var(--font-xs); color: var(--text-secondary); white-space: nowrap; flex-shrink: 0; }
.payment-input { position: relative; flex: 1; min-width: 0; }
.payment-input span { position: absolute; left: var(--space-2); top: 50%; transform: translateY(-50%); color: var(--text-secondary); font-size: var(--font-xs); pointer-events: none; }
input { width: 100%; min-height: 2.75rem; padding: var(--space-2) var(--space-2) var(--space-2) 1.3rem; background: var(--surface); color: var(--text); border: 1px solid var(--border-strong); border-radius: var(--radius-sm); font-size: var(--font-sm); font-variant-numeric: tabular-nums; }
input[aria-invalid='true'] { border-color: var(--danger); }
.field-error { margin: var(--space-2) 0 0; font-size: var(--font-xs); color: var(--danger); line-height: 1.5; }
@media (max-width: 60rem) {
  /* iOS Safari zooms focused fields when their text is smaller than 16px. */
  input { font-size: var(--font-md); }
}
</style>
