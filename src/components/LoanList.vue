<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { ProjectedLoan } from '../domain/portfolio'
import { money } from '../format'
import LoanPaymentChip from './LoanPaymentChip.vue'

defineProps<{ loans: ProjectedLoan[]; editingId: string | null; hiddenLoanIds: string[]; allocations: { loanId: string; monthlyCents: number; oneTimeCents: number }[] }>()
const emit = defineEmits<{
  edit: [id: string, event: MouseEvent]
  toggle: [id: string]
  remove: [id: string]
  payment: [id: string, cents: number]
}>()
const pendingRemoval = ref<string | null>(null)
const list = ref<HTMLElement | null>(null)

async function requestRemoval(id: string) {
  pendingRemoval.value = id
  await nextTick()
  list.value?.querySelector<HTMLButtonElement>('.remove-confirmation .text-button')?.focus()
}

function remove(id: string) {
  pendingRemoval.value = null
  emit('remove', id)
}

async function cancelRemoval() {
  const id = pendingRemoval.value
  pendingRemoval.value = null
  await nextTick()
  const buttons = list.value?.querySelectorAll<HTMLButtonElement>('[data-remove-id]')
  Array.from(buttons ?? []).find((button) => button.dataset.removeId === id)?.focus()
}
</script>

<template>
  <section ref="list" class="loan-list" aria-labelledby="loans-heading">
    <div class="list-heading">
      <div class="list-title">
        <h2 id="loans-heading">Your loans <span>{{ loans.length }}</span></h2>
      </div>
      <slot name="add" />
    </div>

    <ul>
      <li v-for="{ loan } in loans" :key="loan.id" :data-loan-id="loan.id">
        <LoanPaymentChip :loan="loan" :hidden="hiddenLoanIds.includes(loan.id)" @payment="emit('payment', loan.id, $event)">
          <template #actions>
            <div class="loan-actions">
              <button class="icon-button visibility-toggle" type="button" :aria-label="`${hiddenLoanIds.includes(loan.id) ? 'Include' : 'Hide'} ${loan.name}`" :aria-pressed="!hiddenLoanIds.includes(loan.id)" @click="emit('toggle', loan.id)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" aria-hidden="true"><path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /><path v-if="hiddenLoanIds.includes(loan.id)" d="m3 3 18 18" /></svg>
              </button>
              <button class="icon-button" type="button" :aria-label="`Edit ${loan.name}`" :title="`Edit ${loan.name}`" :aria-pressed="editingId === loan.id" @click="emit('edit', loan.id, $event)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5M3 21l5-1L21 7a2.1 2.1 0 0 0-5-5L3 15Z" /></svg>
              </button>
              <button class="icon-button" type="button" :data-remove-id="loan.id" :aria-label="`Remove ${loan.name}`" :title="`Remove ${loan.name}`" @click="requestRemoval(loan.id)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
              </button>
            </div>
          </template>
          <div v-for="allocation in allocations.filter(item => item.loanId === loan.id)" :key="allocation.loanId" class="allocation-tags">
            <span v-if="allocation.oneTimeCents">{{ money(allocation.oneTimeCents) }} today</span>
            <span v-if="allocation.monthlyCents">+{{ money(allocation.monthlyCents) }}/mo next payment</span>
          </div>
          <div v-if="pendingRemoval === loan.id" class="remove-confirmation" role="group" :aria-label="`Confirm removal of ${loan.name}`">
            <p>Remove this loan from your plan? This won’t affect your actual loan.</p>
            <div>
              <button class="text-button" type="button" @click="cancelRemoval">Keep loan</button>
              <button class="remove-button" type="button" @click="remove(loan.id)">Remove loan</button>
            </div>
          </div>
        </LoanPaymentChip>
      </li>
    </ul>
  </section>
</template>

<style scoped>
.list-heading, .remove-confirmation > div {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
}

.list-heading h2 > span {
  color: var(--text-muted);
  font-size: var(--font-sm);
  margin-left: var(--space-2);
}
.list-title { display: flex; align-items: baseline; flex-wrap: wrap; gap: var(--space-2) var(--space-3); }

ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 22rem), 1fr));
  gap: var(--space-3);
  list-style: none;
  padding: 0;
  margin: var(--space-3) 0 0;
}

li {
  min-width: 0;
}
.remove-confirmation p { font-size: var(--font-sm); color: var(--text-secondary); line-height: 1.5; }

.loan-actions {
  display: flex;
  flex-shrink: 0;
}

.icon-button { display: grid; place-items: center; width: var(--size-icon-button); height: var(--size-icon-button); padding: 0; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--text-link); }
.icon-button:hover { background: var(--blue-primary); }
.icon-button:last-child:hover { color: var(--danger); }
.icon-button svg { width: var(--size-icon); height: var(--size-icon); }

@media (any-pointer: coarse) {
  .loan-actions { opacity: 1; pointer-events: auto; }
  .icon-button { width: var(--size-touch-target); height: var(--size-touch-target); }
}

.remove-confirmation {
  background: var(--surface-muted);
  border: 1px solid var(--border);
  border-radius: var(--radius-sm);
  padding: var(--space-3);
  margin-top: var(--space-3);
}

.remove-confirmation p {
  margin: 0 0 var(--space-3);
}

.remove-button {
  border: 1px solid var(--danger);
  border-radius: var(--radius-sm);
  background: var(--surface);
  color: var(--danger);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-xs);
  min-height: 2.5rem;
}

.allocation-tags { display: flex; flex-wrap: wrap; gap: 6px; grid-column: 1 / -1; font-size: 12px; color: var(--text-link); }
@media (max-width: 22rem) { .icon-button { width: 2rem; height: 2rem; } }
</style>
