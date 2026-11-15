# Loan Killer

A local, web-first student-loan planner built with Vue 3, TypeScript, and Vite. Track **multiple fixed-rate federal loans already in repayment** and compare minimum payments, a one-time payment today, increased monthly payments, or both.

## Run locally

```sh
npm ci
npm run dev
```

Use Node.js 22.13+ or 24+ (a current LTS release is recommended). Enter figures from your servicer, or select **Try an example**.

1. Add loans using figures from the same balance date, or try an example in the loan form.
2. All loans are included by default. Use a loan’s eye button to hide it from the estimate; hidden cards dim and stay editable. Open its eye to include it again. Hiding every loan leaves the list available to restore them.
3. Review three proportional, individually rounded bars with small gaps: charcoal for amount owed, red for future interest, and green for savings against minimum payments. The debt-free date is always labeled at the payoff point on the balance chart, with time saved shown in the chart header. Unpaid plans retain a 50-year balance view without invented payoff totals.
4. Use the linked payment controls on one shared white surface between the repayment bar and balance chart. **Pay once** and **Extra each month** use number rulers: swipe left to increase or right to decrease on a whole-$5 scale, or tap the borderless amount for exact cent entry. A fast swipe coasts and settles onto a notch; touch again to stop it. Arrow keys on a ruler and up/down in an amount field move to the next whole $5 notch, while left/right in a field remains caret navigation. Values, metrics, curves, and recipient labels update immediately. **Debt-free by** uses a compact month picker and earlier/later arrows, without a slider; changing it calculates the monthly extra needed while holding the one-time payment fixed except for a current-month full-payoff goal.
5. The gray dotted curve is the minimum-payment baseline; the solid charcoal curve is the selected extra-payment plan. Zero extra amounts show only the baseline.
6. With both amounts positive, expand **Compare payment options** to view one-time, monthly, and combined results using the same inputs. Each plan uses its own recommended loan target and monthly allocation method.
7. Confirmed loans save in this browser. Saved loan edits clear hypothetical scenarios; scope changes preserve the entered extra amounts and recompute them for the selected loans.

Cards group amounts for one combined plan: all one-time amounts are paid today, and recurring amounts form one extra monthly budget. The app recommends where to apply those totals. Returning both money fields to zero clears the preview. Clearing a tool input immediately counts as zero without a validation error and restores a visible zero on blur. Zero-valued money fields clear on focus without changing the underlying figure and restore zero if left empty.

The dashboard intentionally omits payment-by-payment inspection, schedules, the total-paid chart, and the former bottom detail panels. Calculation assumptions and engine behavior are documented below. Storage failures still surface with recovery actions.

All balances must come from the **same date**. After adding the first loan, the date is shared and read-only on additional loans. You can change the date while editing the only remaining loan. This avoids combining snapshots from different dates or guessing which payments you already made.

## Features

- Accessible loan entry, editing, confirmed removal, and local persistence.
- Per-loan inclusion toggles across totals, chart, and payment tools; all loans start included.
- A baseline cost and payoff outlook followed by guided extra-payment options.
- Live one-time, monthly, and combined previews with measured interest/time savings and a single shared balance chart.
- Automatic allocation recommendations, optional explanations/comparisons, and explicit monthly-extra budgeting.
- Compact loan cards with always-visible monthly payment editing and actionable low-payment suggestions.
- A unified impact summary, bounded unpaid curves, overpayment handling, and unavailable-estimate states.
- Responsive layouts, keyboard focus, and reduced-motion support.

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

Low-payment warnings offer a **10-year plan** amount, rounded up to a whole dollar and verified against the actual cent-rounded payment schedule to pay off within ten calendar years of the entered balance date. This is a suggested payoff goal, not a servicer-required minimum. Clicking it applies the payment in a loan card immediately; the loan editor still requires **Update loan**. If the entered dates make a ten-year payoff impossible, the suggestion is labeled **Try** instead. No number is offered without a complete modeled payoff.

Expanded extra-payment controls use one column, with the allocation directly below the amount. The high-contrast impact block emphasizes savings and payoff change; budget math and recommendation comparisons share the **Why this plan?** disclosure.

## Automatic allocation recommendations

Enter only the one-time and/or extra monthly amount. The app compares every one-time target in the current loan scope and both supported monthly strategies. Combined plans compare every target/strategy pair. One-time-only, monthly-only, and combined plans each retain their own winner, so switching the plan comparison updates the allocation, summary, and chart together.

Complete payoff estimates rank ahead of incomplete ones. Among complete options, the app minimizes projected remaining interest, then the overall payoff date, with stable IDs breaking exact ties. It shows the actual first extra monthly allocations, not a guess from starting rates or balances. A faster but more expensive alternative is flagged. Exact ties are identified, and no cheapest-plan claim is made if every option is incomplete.

**Why this plan?** contains the rule and the compared interest totals/payoff dates. These recommendations cover the modeled single-loan lump-sum targets and the two monthly methods; they do not claim a global optimum over arbitrary split payments. Lump sums above a target’s payoff amount remain unused. Invalid draft amounts preserve the last valid comparison.

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
- Valid amount and loan-scope changes refresh results and recommendations immediately. Returning both money controls to zero removes the preview and restores the baseline payoff month. Adding, updating, or removing a saved loan clears the scenario to prevent stale targets and estimates. Toggling loan visibility does not clear entered extra amounts.

## Extra monthly payments

- The monthly amount is **one additional budget across the plan**, not an extra payment for every loan. It begins on the earliest entered next-payment date and recurs on that original day, clamped for shorter months (January 31 → February 28 → March 31).
- Every loan still gets its minimum on its own entered due dates, unless already paid off. On a shared payment date the order is: one-time payment, all minimums due that day, then the extra pool.
- The entered extra budget follows the chosen strategy, covering interest before principal. A paid-off target passes the remainder to the next active loan on the same day.
- The playground and date solver **do not automatically reuse paid-off loans’ minimums**. The extra amount stays exactly what was entered; once a loan finishes, its minimum stops. This avoids changing the repayment policy when moving from $0 extra to a small positive amount.
- The low-level engine retains its rollover mode for explicit model comparisons (`rollFreedMinimums`); omitting that option preserves its existing default. The UI and goal solver explicitly pass `false`. All actual payments are capped at amounts owed.
- **Minimum-only and one-time-only plans do not roll over payments.** With $0 extra monthly, the monthly plan exactly matches the baseline and the combined plan exactly matches one-time only; zero does not silently enable a rollover-only strategy.
- The recommended one-time target receives the lump sum. Monthly payments still follow the recommended allocation method. Unused one-time overpayment is never redirected, including in the combined plan; freed minimums are not silently added to the playground budget.
- The comparison includes all applied payments in every total, not just the future scheduled minimums. A plan that never pays off within the model’s limit has no complete interest or payment total. Savings require both it and the baseline to have a complete payoff estimate.
- Monthly/combined schedules are capped at 1,200 original monthly due slots per loan and 1,200 monthly-extra slots. If unpaid, they report the projection limit rather than infer an interest-coverage classification from irregular extra-payment rows.
- These remain fixed-rate, simple-interest estimates, not servicer transactions.

## Strategies and projected milestones

- **Highest rate first (avalanche)** directs extra monthly money to the active loan with the highest nominal fixed rate. This is the engine default, but the recommendation compares both methods.
- **Smallest balance first (snowball)** directs it to the active loan with the smallest current total balance, including unpaid interest and interest accrued through that payment date. Priorities are re-evaluated after all minimums due that day; they are not frozen to original loan sizes. A lump sum may also change the next target.
- Equal-priority loans use stable loan IDs to break ties. Reordering the displayed loan records does not change the result.
- Both approaches use the same budget, scheduled due dates, rollover policy, fixed one-time target, and applied lump sum. Strategy only changes monthly and combined plans with positive extra monthly money. Zero monthly extra still means no rollover and no strategy-dependent change to the baseline.
- The engine computes actual modeled interest and calendar finish-date differences rather than declaring a guaranteed winner. Neither a cheaper result nor an earlier first payoff guarantees an earlier overall finish. Non-capitalized unpaid interest and per-payment rounding can also affect the cost ordering.
- Valid amount changes automatically compare both monthly methods and every applicable one-time target. Invalid money edits preserve the last valid result and show a warning. The chosen method and alternatives are available in the recommendation explanation.
- Strategy-to-strategy cost and time comparisons require both strategies to fully pay off, even if the minimum-payment baseline does not. Savings versus baseline separately require a complete baseline. The first known individual payoff may still be shown for an otherwise incomplete plan.
- Milestones use the selected plan’s actual simulated payoff dates, not allocation priority. Loans reaching zero on the same date share a milestone; duplicate names remain distinct through their IDs. The remaining-loan count only reaches zero when all loans have a known complete payoff.
- Each loan’s timing change is compared with that loan’s own baseline date, not the whole plan’s date. Unavailable baseline dates are labeled as unknown, and later dates are not disguised as positive savings.
- These are **projected milestones, not actual repayment history**. Known payoffs are shown even when another loan remains unresolved; unresolved loans never receive an invented date or debt-free milestone. Original minimums are reference amounts, not a claim that cash becomes available immediately on the payoff date.

## Calculation assumptions

- USD amounts are represented as integer cents.
- Simple interest accrues on principal using `principal × annual rate × actual days / 365`, rounded to cents at each payment. Unpaid interest does not itself accrue interest or automatically become principal.
- Payments cover unpaid accrued interest before principal. The final payment is capped at the balance owed.
- The monthly payment remains fixed until payoff. Due dates stay anchored to the initial next-payment day, clamped for shorter months (January 31 → February 28 → March 31).
- Minimum-only and one-time-only loans are simulated independently. Their combined monthly minimum falls as loans are paid off. Monthly/combined playground plans allocate only the shared extra budget; scheduled minimums stop as loans are paid off.
- Overall payoff is the last loan’s payoff date. Combined remaining interest and future payments are sums of complete individual projections, not an estimate based on an averaged rate. The displayed principal-weighted rate is informational only; if no principal remains, no combined rate is shown.
- Combined schedules group actual payment dates. Between a loan’s due dates, its displayed balance includes simple interest since its previous payment or the common balance date, rounded consistently with the individual calculation.
- **Remaining interest** includes unpaid interest at the balance date plus newly projected interest. **Total future payments** includes both principal and all remaining interest. Neither includes previously paid amounts.
- Subsidized and unsubsidized loans are modeled identically during normal repayment. Subsidy eligibility outside repayment is not modeled.
- No fees, variable rates, capitalization events, deferment, grace periods, income-driven repayment, or forgiveness. This is an estimate, not financial advice or a replacement for a servicer statement. Servicer day-count and rounding rules can differ.
- The independent-loan projection stops after 1,200 monthly payments. If unpaid, it does not claim a payoff date or complete interest total. An insufficient-payment warning means payments do not cover newly accrued interest over the final 12 simulated payments; other unpaid cases receive a projection-limit warning.
- A one-time payment is additional to the 1,200 scheduled-payment limit. Payment counts include it, and same-day grouped rows are marked when they include an extra payment.
- If any loan fails to pay off within its limit, combined balances and minimums are still shown, but overall payoff and complete interest totals are withheld. The balance chart shows the first 50 years of the entered payments, including growing or flat debt, without claiming a payoff date. Complete projections for other loans remain available individually.

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

The payoff outlook is the single location for headline metrics. The payment-card area retains the plan description, rationale, and comparison controls without a separate results panel. Incomplete baselines are labeled explicitly; savings are only shown when both projections have complete payoff estimates.

The repayment values and compact legend retain a stable layout before simulation, keeping chart position and height stable as amounts change. Hidden loans are excluded from recommendations and keep their saved data; visibility resets to all included on reload. Recipient labels describe the one-time allocation and the first extra recurring payment, which may move to other loans later.

The visual repayment breakdown uses starting principal plus accrued interest as amount owed, and future interest as the second segment, so already-accrued interest is counted once. The combined bars represent the minimum-payment total for a cheaper plan. Costlier previews show extra cost rather than a savings segment. Unpaid baselines show no fabricated savings. The chart annotation uses its shared calendar axis, and reduced-motion settings disable transitions.

There is no separate payoff timeline or repeated minimum-payment total above the bars. The chart is titled **Balance over time**, with a compact side-by-side legend below the plot and no appended dates. The chart labels the current payoff date directly without hover, shows time saved in a light-green header tag without an extra line, and identifies dates beyond the bounded chart without placing a false endpoint.


## Linked payoff goals

The three controls form one playground: repayment costs above, number rulers in the middle, and the balance curve below. Wide screens place both money controls and the date in one row; medium screens pair the money controls with the date below, and narrow screens stack the controls so neighboring amounts stay legible. Each ruler shows three widely spaced marks (current and neighbors), whole-dollar labels, and a fixed center notch, without a baseline line, minor ticks, pencil or money ± icons. Recycled labels move continuously with the pointer; quick swipes coast and ease onto the nearest whole $5 notch. A new touch or manual edit interrupts momentum. Reduced-motion settings disable coasting and animated settling. The strip captures touch movement, including vertical drift; surrounding content remains available for page scrolling, and pinch zoom remains enabled. Repeated swipes move across a whole-$5 scale without an arbitrary slider endpoint, within the supported $0–$10,000,000 amount range. The borderless fields retain exact cent entry, including values calculated by the date solver; neither manual nor solver amounts are rounded until the ruler is adjusted. Ruler visuals run independently from coalesced calculation updates during motion to avoid recomputing a portfolio on every pointer event.

The month picker and earlier/later arrows target the end of the selected calendar month. The solver searches cent-accurate monthly extras against actual schedules, holding the one-time payment fixed except for a current-month full-payoff goal. It checks supported allocation methods and one-time targets; the final recommendation must meet the goal before projected interest is minimized. The displayed month commits only after a successful calculation. A failed request restores the actual current payoff month. The goal controls only extra payments, never lowers saved minimums, and does not change the payment date.

Goal searches run in a debounced background worker. If workers cannot load, the same search yields between schedule evaluations on the main thread; input changes still cancel it. The last valid curve remains visible during calculation; changing an amount, changing included loans or leaving the screen cancels stale work. Impossible goals leave the current amounts intact and explain that a later month is needed. Returning the money fields to zero returns the goal to the baseline date (or no date for unpaid minimums). Loan-card allocation labels fit alongside the monthly input so new recommendations do not shift the chart.

The repayment bar sits on the page background. The compact controls share one white surface and the balance chart has its own card. Control labels remain visible; the date-control explanation remains available to assistive technology. Goal feedback sits beside **Debt-free by**: a spinner during calculation and a touch/keyboard-accessible details control for failures. Messages open over the page instead of reserving an empty row or moving the chart. Surfaces, typography, chart curves, and controls use a neutral palette; red and green convey interest and savings.

Regression checks reproduce the reported July 2052 baseline using the pictured balances/rates: $1 extra no longer activates a second rollover policy, and January 2051, June 2045, and March 2040 are each reachable with cent-accurate extras. The goal changes the planned extra above saved minimums; it never rewrites those minimums or fabricates an achieved date.

Current-month goals use a dedicated portfolio-wide payoff: principal, existing accrued interest, and new interest through today are calculated per loan, then paid across every included loan. The one-time field is filled with that exact total and recurring extra becomes zero. Allocation labels/details cover all loans, and excluded loans stay untouched. Unused amounts above the quote are identified; later recurring extras do not create payments after a full payoff. Time saved appears as a light-green tag at the chart header’s top right, with compact duration labels and the complete duration available to assistive technology and on hover.
