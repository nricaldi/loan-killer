<script setup lang="ts">
import { nextTick, ref } from 'vue'
import type { ProjectedLoan } from '../domain/portfolio'
import { formatDate, money } from '../format'

defineProps<{ loans: ProjectedLoan[]; editingId: string | null }>()
const emit = defineEmits<{
  add: [event: MouseEvent]
  edit: [id: string, event: MouseEvent]
  view: [id: string]
  remove: [id: string]
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
  <section ref="list" class="panel loan-list" aria-labelledby="loans-heading">
    <div class="list-heading">
      <div>
        <p class="eyebrow">ALL IN ONE PLACE</p>
        <h2 id="loans-heading">Your loans <span>{{ loans.length }}</span></h2>
      </div>
      <button class="add-button" type="button" @click="emit('add', $event)">+ Add loan</button>
    </div>

    <ul>
      <li v-for="{ loan, projection } in loans" :key="loan.id" :data-loan-id="loan.id">
        <div class="loan-topline">
          <button class="loan-title" type="button" :aria-label="`View ${loan.name}`" @click="emit('view', loan.id)">{{ loan.name }}</button>
          <strong>{{ money(loan.principalCents + loan.accruedInterestCents) }}</strong>
        </div>
        <p class="loan-type">{{ loan.type === 'subsidized' ? 'Subsidized' : 'Unsubsidized' }} · {{ loan.annualRatePercent }}% fixed</p>
        <div class="loan-facts">
          <span>{{ money(loan.monthlyPaymentCents) }} / month</span>
          <span v-if="projection.status === 'paid-off'">Paid off {{ formatDate(projection.payoffDate, true) }}</span>
          <span v-else class="loan-warning">{{ projection.status === 'insufficient-payment' ? 'Payment needs attention' : 'Beyond projection limit' }}</span>
        </div>
        <div v-if="pendingRemoval !== loan.id" class="loan-actions">
          <button class="text-button" type="button" :aria-label="`Edit ${loan.name}`" :aria-pressed="editingId === loan.id" @click="emit('edit', loan.id, $event)">Edit</button>
          <button class="text-button" type="button" :data-remove-id="loan.id" :aria-label="`Remove ${loan.name}`" @click="requestRemoval(loan.id)">Remove</button>
          <span v-if="loan.fromExample" class="example-label">From example</span>
        </div>
        <div v-else class="remove-confirmation" role="group" :aria-label="`Confirm removal of ${loan.name}`">
          <p>Remove this loan from your plan? This won’t affect your actual loan.</p>
          <div>
            <button class="text-button" type="button" @click="cancelRemoval">Keep loan</button>
            <button class="remove-button" type="button" @click="remove(loan.id)">Remove loan</button>
          </div>
        </div>
      </li>
    </ul>
    <p class="list-note">Each loan keeps its own minimum. Payments aren’t rolled over when another loan is paid off.</p>
  </section>
</template>

<style scoped>
.loan-list {
  padding: var(--space-6);
}

.list-heading, .loan-topline, .loan-actions, .remove-confirmation > div {
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
  list-style: none;
  padding: 0;
  margin: var(--space-5) 0 0;
}

li {
  border-top: 1px solid var(--border);
  padding-block: var(--space-4);
}

.loan-topline {
  align-items: start;
  font-size: var(--font-sm);
}

.loan-topline > strong {
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}

.loan-title {
  padding: 0;
  border: 0;
  background: transparent;
  color: var(--text-link);
  text-align: left;
  font-size: inherit;
  font-weight: 600;
  line-height: 1.6;
  overflow-wrap: anywhere;
}

.loan-title:hover {
  text-decoration: underline;
  text-underline-offset: 0.2em;
}

.loan-type, .loan-facts, .list-note, .remove-confirmation p {
  font-size: var(--font-xs);
  color: var(--text-muted);
  line-height: 1.7;
}

.loan-type {
  margin: var(--space-1) 0 var(--space-2);
}

.loan-facts {
  display: flex;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--space-1) var(--space-3);
}

.loan-warning {
  color: var(--danger);
}

.loan-actions {
  justify-content: start;
  margin-top: var(--space-2);
}

.loan-actions button {
  min-height: 2.5rem;
}

.example-label {
  font-size: 0.65rem;
  color: var(--text-muted);
  margin-left: auto;
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

.list-note {
  border-top: 1px solid var(--border);
  padding-top: var(--space-4);
  margin: 0;
}

@media (max-width: 25rem) {
  .loan-list {
    padding: var(--space-4);
  }
}
</style>
