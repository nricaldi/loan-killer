<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { ProjectedLoan } from '../domain/portfolio'
import LoanPaymentChip from './LoanPaymentChip.vue'

defineProps<{ loans: ProjectedLoan[]; editingId: string | null; visibleLoanId: string | null }>()
const emit = defineEmits<{
  add: [event: MouseEvent]
  edit: [id: string, event: MouseEvent]
  view: [id: string]
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

async function remove(id: string) {
  pendingRemoval.value = null
  emit('remove', id)
  await nextTick()
  list.value?.querySelector<HTMLButtonElement>('.add-button')?.focus()
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
        <p class="loan-view-label">{{ visibleLoanId ? 'Focused on one loan' : 'Showing all loans' }}</p>
      </div>
      <button class="add-button" type="button" @click="emit('add', $event)">+ Add loan</button>
    </div>

    <ul>
      <li v-for="{ loan, projection } in loans" :key="loan.id" :data-loan-id="loan.id">
        <LoanPaymentChip :loan="loan" :selected="visibleLoanId === null || visibleLoanId === loan.id" @select="emit('view', loan.id)" @payment="emit('payment', loan.id, $event)">
          <template #actions>
            <div class="loan-actions">
              <button class="icon-button" type="button" :aria-label="`Edit ${loan.name}`" :title="`Edit ${loan.name}`" :aria-pressed="editingId === loan.id" @click="emit('edit', loan.id, $event)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m16 3 5 5M3 21l5-1L21 7a2.1 2.1 0 0 0-5-5L3 15Z" /></svg>
              </button>
              <button class="icon-button" type="button" :data-remove-id="loan.id" :aria-label="`Remove ${loan.name}`" :title="`Remove ${loan.name}`" @click="requestRemoval(loan.id)">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7M14 10v7" /></svg>
              </button>
            </div>
          </template>
          <p v-if="loan.monthlyPaymentCents === 0" class="loan-note">No required monthly payment</p>
          <p v-else-if="projection.status !== 'paid-off'" class="loan-warning">{{ projection.status === 'insufficient-payment' ? 'Payment needs attention' : 'Beyond projection limit' }}</p>
          <span v-if="loan.fromExample" class="example-label">From example</span>
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
.loan-view-label { margin: 0; font-size: var(--font-xs); color: var(--text-secondary); }

.add-button {
  flex-shrink: 0;
  background: var(--blue-light);
  color: var(--text-link);
  border: 1px solid var(--blue-border);
  border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3);
  font-size: var(--font-xs);
  font-weight: 600;
  min-height: 2.75rem;
}

ul {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 13rem), 1fr));
  gap: var(--space-3);
  list-style: none;
  padding: 0;
  margin: var(--space-3) 0 0;
}

li {
  min-width: 0;
}
.loan-note, .loan-warning, .remove-confirmation p {
  font-size: var(--font-xs);
  color: var(--text-muted);
  line-height: 1.7;
}

.loan-warning {
  color: var(--danger);
}

.loan-actions {
  display: flex;
  flex-shrink: 0;
}

.icon-button { display: grid; place-items: center; width: var(--size-icon-button); height: var(--size-icon-button); padding: 0; border: 0; border-radius: var(--radius-sm); background: transparent; color: var(--text-link); }
.icon-button:hover { background: var(--blue-primary); }
.icon-button:last-child:hover { color: var(--danger); }
.icon-button svg { width: var(--size-icon); height: var(--size-icon); }

@media (hover: hover) and (pointer: fine) {
  .loan-actions { opacity: 0; pointer-events: none; }
  li:hover .loan-actions, li:focus-within .loan-actions { opacity: 1; pointer-events: auto; }
}
@media (any-pointer: coarse) {
  .loan-actions { opacity: 1; pointer-events: auto; }
  .icon-button { width: var(--size-touch-target); height: var(--size-touch-target); }
}

.example-label {
  display: block;
  margin-top: var(--space-2);
  font-size: 0.65rem;
  color: var(--text-muted);
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

</style>
