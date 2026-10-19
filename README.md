# Loan Killer

A local, web-first student-loan planner built with Vue 3, TypeScript, and Vite. Track **multiple fixed-rate federal loans already in repayment** and compare minimum payments, a one-time payment today, increased monthly payments, or both.

## Run locally

```sh
npm ci
npm run dev
```

Use Node.js 22.13+ or 24+ (a current LTS release is recommended). Enter figures from your servicer, or select **Try an example**.

1. Choose the balance date and add your first loan.
2. Select **Add another loan** or **+ Add loan** to enter another without replacing existing loans.
3. Use **All loans** for combined totals, or a loan’s name for its individual chart and schedule. **Edit** selects that loan and focuses the form.
4. Select **Update loan** to apply edits. Save before switching loans; unapplied edits are discarded when switching or canceling.
5. **Remove** asks for confirmation and only removes the selected loan from this planner, not your servicer account.
6. Select **What if I pay extra?**, choose a one-time target and amount, and set an extra monthly amount using the slider or exact amount field. Use 0 to leave either out, then **Compare payment**. Your saved loan figures and baseline remain unchanged.
7. All four plans show payoff dates, interest, total payments, and savings. Use a plan’s **View** button to inspect its curve against the baseline and its payment schedule. Monthly-only is selected by default when only monthly extra is positive; both positive selects the combined plan.
8. Choose **Monthly payoff strategy** before updating, or use the strategy comparison cards to inspect highest-rate-first versus smallest-balance-first using the last comparison’s same inputs. Follow the projected milestones to see which loans reach zero first.
9. Confirmed loan changes save automatically in this browser. Reopen the same site to restore your loan list and baseline without re-entering it. Draft fields and hypothetical scenarios still reset.

All balances must come from the **same date**. After adding the first loan, the date is shared and read-only on additional loans. You can change the date while editing the only remaining loan. This avoids combining snapshots from different dates or guessing which payments you already made.

## Features

- Accessible loan entry and field validation.
- Current principal, accrued unpaid interest, fixed rate, monthly minimum, balance date, and next payment date.
- Estimated debt-free date, remaining interest, and total future payments.
- A projected balance chart and payment-by-payment schedule.
- Stable loan identities, editing, confirmed removal, and a loan inventory with individual payoff dates.
- Combined balances, monthly minimums, principal-weighted rate, remaining interest, and an overall debt-free date.
- Combined schedules that respect each loan’s due dates, group payments on the same day, and include interest accruing between due dates on other loans.
- A one-time payment simulator with interest/principal allocation, unused-overpayment handling, payoff and interest comparisons, overlaid balance curves, and a scenario schedule.
- Extra monthly payments with a slider, exact cents entry, a visible starting monthly budget, selectable allocation strategy, and freed-minimum rollover.
- A four-plan comparison: minimums, one-time only, monthly only, and combined; each has its own complete-or-unavailable payoff estimates.
- Both the selected loan’s payoff change and the whole plan’s payoff change, so an earlier individual payoff isn’t mistaken for an earlier overall debt-free date.
- Same-budget strategy comparisons with actual interest, finish-date differences, and first projected loan payoffs.
- A projected loan-by-loan milestone timeline with baseline date comparisons, simultaneous-payoff grouping, and explicit unresolved loans.
- Explicit handling of insufficient payments and the 1,200-payment projection limit.
- Responsive layouts, keyboard focus, and reduced-motion support.
- Local persistence for confirmed loans, with restore validation, save-failure warnings, and explicit recovery rather than silent overwrites.

**No account, backend, analytics, or sync.** Confirmed loan records are kept in this browser’s local storage. The app does not upload them, connect to your servicer, or send payments.

## Local persistence

- **Add loan**, **Update loan**, and confirmed removals save the complete loan list, including stable IDs, example labels, rates, integer-cent amounts, and original balance/payment dates. Removing the last loan saves an empty plan so deleted loans do not return after refresh.
- Saved loans restore on startup; the first loan is prefilled for editing and the combined overview is shown. No write is made just because the app mounts.
- Only loan records persist. Unapplied/invalid edits, canceled drafts, selected views, scenario amounts, strategy selections, projected schedules, and milestones are not stored. They are recomputed or reset when returning.
- Stored records use a versioned JSON envelope under the single `loan-killer.loans` localStorage key. Records and portfolio invariants are validated before use. Unknown formats or any invalid record block restoration of the entire saved plan rather than silently omitting a loan. Unrecognized extra fields are not used or written.
- If browser access or a write fails, the app still works with the current in-memory plan and clearly warns that changes may be lost on refresh. **Retry saving** saves the latest complete in-memory plan when ordinary writes become available again.
- Failed restoration never triggers an automatic overwrite, including after entering new loans. **Replace saved copy** requires a separate confirmation, including an explicit warning if the current plan is empty. This recovery action only replaces this app’s loan key, not unrelated site data.
- Before ordinary saves, the app checks that the saved copy still matches what this tab last loaded or saved. A changed copy produces a warning instead of being overwritten automatically. There is no live tab synchronization or merging; avoid simultaneous edits across tabs. Reloading uses the saved copy and discards any unsaved changes in the current tab.
- Storage is scoped to the exact browser profile and origin: protocol, hostname, and port. `localhost:5173`, `127.0.0.1:5173`, and `127.0.0.1:4173` have separate saved copies. Moving to a different address or device does not transfer loans.
- Anyone using the same browser profile can access the data. The app does not encrypt its JSON copy. Clearing site data, storage eviction, or closing a private-browsing session can remove it. This is convenience storage, not a backup.
- Balances and dates are restored exactly as entered, not advanced to today. The app does not know which real payments happened. Check your figures and next-payment dates when returning; overdue next-payment dates still block new what-if calculations until updated.
- Export/import, backups, accounts, and cloud synchronization are intentionally **not** part of this feature.

## Extra payment today

- The payment date is your browser’s local date, refreshed when you submit the comparison. It is not backdated to the loan’s balance snapshot.
- A snapshot from an earlier date is supported when every loan’s next payment is still today or later. Interest accrues through today before the extra payment is applied. Future snapshots and past next-payment dates block the scenario; the app does not guess which earlier payments happened.
- The selected loan receives the payment only. Interest already owed, including interest accrued through today, is paid before principal.
- Scheduled minimums and due dates continue unchanged unless the loan is fully paid off. The extra payment happens before scheduled payments on the same day. We do not model paid-ahead status or skipped minimums; check your servicer’s overpayment instructions.
- An oversized payment is capped at the selected loan’s payoff balance. The unused portion is displayed, not paid, not redirected, and not included in total payments. Entering zero produces an unchanged comparison without an extra rounding event.
- Both plans’ total payments include all payments from the shared balance snapshot, including the **applied** one-time payment in the scenario. Interest savings are the difference in complete interest totals, not the lump sum itself. Paying a zero-interest loan sooner may save time without saving interest.
- Time changes use actual calendar dates, with calendar years/months/days rather than assuming 30-day months. If another loan takes longer, the overall date may stay unchanged even when the selected loan finishes earlier.
- If either plan has no complete payoff estimate, full interest and time savings are unavailable. A complete scenario can still be displayed even if the baseline does not pay off within its limit; unknown savings are never presented as infinite or zero.
- Per-payment rounding can create a small additional-interest difference for a tiny extra payment. Negative savings are preserved and explicitly labeled as additional interest.
- Edit the amount or target and select **Update comparison** to refresh results. **Clear scenario** removes it. Adding, updating, or removing a saved loan clears the scenario to prevent stale targets and estimates. Switching between loan views does not clear it.

## Extra monthly payments

- The monthly amount is **one additional budget across the plan**, not an extra payment for every loan. It begins on the earliest entered next-payment date and recurs on that original day, clamped for shorter months (January 31 → February 28 → March 31).
- Every loan still gets its minimum on its own entered due dates, unless already paid off. On a shared payment date the order is: one-time payment, all minimums due that day, then the extra/rollover pool.
- Extra and freed budget follows the chosen strategy, covering interest before principal. A paid-off target passes the remainder to the next active loan on the same day.
- A positive monthly increase enables rollover: the original minimum for a paid-off loan becomes available on each of that loan’s original monthly due dates. The unused portion of a final minimum also becomes available that same day. Minimums due on other dates are not spent early or skipped.
- This maintains the starting minimum-payment budget plus the extra monthly amount as loans finish. Available cash follows the entered due dates; initial and final partial cycles can spend less. All actual payments are capped at amounts owed, with no unused final budget counted as spending or carried forward after all loans are paid off.
- **Minimum-only and one-time-only plans do not roll over payments.** With $0 extra monthly, the monthly plan exactly matches the baseline and the combined plan exactly matches one-time only; zero does not silently enable a rollover-only strategy.
- The one-time target dropdown only affects the lump sum. It does not override the monthly strategy. Unused one-time overpayment is never redirected, including in the combined plan; recycling future minimums is a separate part of the monthly budget.
- The comparison includes all applied payments in every total, not just the future scheduled minimums. A plan that never pays off within the model’s limit has no complete interest or payment total. Savings require both it and the baseline to have a complete payoff estimate.
- Monthly/combined schedules are capped at 1,200 original monthly due slots per loan and 1,200 monthly-extra slots. If unpaid, they report the projection limit rather than infer an interest-coverage classification from irregular extra-payment rows.
- These remain fixed-rate, simple-interest estimates, not servicer transactions.

## Strategies and projected milestones

- **Highest rate first (avalanche)** directs extra monthly and freed minimum-payment money to the active loan with the highest nominal fixed rate. This remains the default.
- **Smallest balance first (snowball)** directs it to the active loan with the smallest current total balance, including unpaid interest and interest accrued through that payment date. Priorities are re-evaluated after all minimums due that day; they are not frozen to original loan sizes. A lump sum may also change the next target.
- Equal-priority loans use stable loan IDs to break ties. Reordering the displayed loan records does not change the result.
- Both approaches use the same budget, scheduled due dates, rollover policy, fixed one-time target, and applied lump sum. Strategy only changes monthly and combined plans with positive extra monthly money. Zero monthly extra still means no rollover and no strategy-dependent change to the baseline.
- The comparison shows actual modeled interest differences and calendar finish-date differences rather than declaring a guaranteed winner. Neither a cheaper result nor an earlier first payoff guarantees an earlier overall finish. Non-capitalized unpaid interest and per-payment rounding can also affect the cost ordering.
- Changing the form strategy is a draft edit until **Update comparison**. Strategy card buttons switch between already-computed results for the last captured amounts and payment date, update the form strategy, and preserve the selected plan. Other unapplied money edits remain drafts; they are not silently used by a strategy button.
- Strategy-to-strategy cost and time comparisons require both strategies to fully pay off, even if the minimum-payment baseline does not. Savings versus baseline separately require a complete baseline. The first known individual payoff may still be shown for an otherwise incomplete plan.
- Milestones use the selected plan’s actual simulated payoff dates, not allocation priority. Loans reaching zero on the same date share a milestone; duplicate names remain distinct through their IDs. The remaining-loan count only reaches zero when all loans have a known complete payoff.
- Each loan’s timing change is compared with that loan’s own baseline date, not the whole plan’s date. Unavailable baseline dates are labeled as unknown, and later dates are not disguised as positive savings.
- These are **projected milestones, not actual repayment history**. Known payoffs are shown even when another loan remains unresolved; unresolved loans never receive an invented date or debt-free milestone. Original minimums are reference amounts, not a claim that cash becomes available immediately on the payoff date.

## Calculation assumptions

- USD amounts are represented as integer cents.
- Simple interest accrues on principal using `principal × annual rate × actual days / 365`, rounded to cents at each payment. Unpaid interest does not itself accrue interest or automatically become principal.
- Payments cover unpaid accrued interest before principal. The final payment is capped at the balance owed.
- The monthly payment remains fixed until payoff. Due dates stay anchored to the initial next-payment day, clamped for shorter months (January 31 → February 28 → March 31).
- Minimum-only and one-time-only loans are simulated independently. Their combined monthly minimum falls as loans are paid off. Monthly/combined plans allocate a shared extra budget and roll freed minimums forward as described above.
- Overall payoff is the last loan’s payoff date. Combined remaining interest and future payments are sums of complete individual projections, not an estimate based on an averaged rate. The displayed principal-weighted rate is informational only; if no principal remains, no combined rate is shown.
- Combined schedules group actual payment dates. Between a loan’s due dates, its displayed balance includes simple interest since its previous payment or the common balance date, rounded consistently with the individual calculation.
- **Remaining interest** includes unpaid interest at the balance date plus newly projected interest. **Total future payments** includes both principal and all remaining interest. Neither includes previously paid amounts.
- Subsidized and unsubsidized loans are modeled identically during normal repayment. Subsidy eligibility outside repayment is not modeled.
- No fees, variable rates, capitalization events, deferment, grace periods, income-driven repayment, or forgiveness. This is an estimate, not financial advice or a replacement for a servicer statement. Servicer day-count and rounding rules can differ.
- The independent-loan projection stops after 1,200 monthly payments. If unpaid, it does not claim a payoff date or complete interest total. An insufficient-payment warning means payments do not cover newly accrued interest over the final 12 simulated payments; other unpaid cases receive a projection-limit warning.
- A one-time payment is additional to the 1,200 scheduled-payment limit. Payment counts include it, and same-day grouped rows are marked when they include an extra payment.
- If any loan fails to pay off within its limit, combined balances and minimums are still shown, but overall payoff, complete interest totals, and the combined chart are withheld. Complete projections for other loans remain available individually.

## Validate

```sh
npm run check      # typecheck, lint, tests, and production build
npm run test:watch
npm run preview    # serve the production build after npm run build
```

Tests cover the financial engines and UI, plus local storage round-trips, strict restoration, durable updates/removals, draft isolation, storage failures, recovery, and changed-copy protection. The calculation engines in `src/domain/` are independent of Vue. The chart uses SVG without a charting dependency.

## Feature chunks

1. ✅ Single-loan minimum-payment baseline.
2. ✅ Multiple loans and combined dashboard.
3. ✅ A hypothetical one-time payment today, targeting a chosen loan.
4. ✅ Extra monthly payments, including comparison with a combined one-time payment.
5. ✅ Highest-rate-first versus smallest-balance-first strategies and payoff milestones.
6. ✅ Local persistence for loans only, without export/import.

Actual balance history, export/import, and synchronization remain deferred.
