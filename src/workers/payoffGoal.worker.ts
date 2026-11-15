import { monthlyExtraForGoal, type PayoffGoalRequest } from '../domain/payoffGoal'
import type { LoanRecord } from '../domain/portfolio'

self.onmessage = (event: MessageEvent<{ loans: LoanRecord[]; request: PayoffGoalRequest }>) => {
  try {
    self.postMessage({ result: monthlyExtraForGoal(event.data.loans, event.data.request) })
  } catch (error) {
    self.postMessage({ error: error instanceof Error ? error.message : 'Could not calculate this goal.' })
  }
}
