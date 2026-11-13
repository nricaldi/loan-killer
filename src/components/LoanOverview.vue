<script setup lang="ts">
import type { PortfolioProjection } from '../domain/portfolio'
import LoanTrajectory from './LoanTrajectory.vue'
defineProps<{ portfolio: PortfolioProjection; comparison?: { portfolio: PortfolioProjection; label: string } | null }>()
</script>

<template>
  <div class="overview">
    <slot name="loans" />
    <slot name="journey"><LoanTrajectory :portfolio="portfolio" :comparison="comparison" /></slot>
  </div>
</template>

<style scoped>
.overview { display: grid; gap: var(--space-6); min-width: 0; }
</style>
