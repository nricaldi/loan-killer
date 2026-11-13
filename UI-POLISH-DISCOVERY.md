# UI polish discovery

Goal: make the impact of a one-time payment or a monthly increase immediately visible.

Scope: source-based audit of the current Vue templates, styles, and payment-preview state flow. No browser walkthrough or viewport validation yet. Layout risks below follow from the CSS; exact wrapping and scrolling need visual verification. No application behavior changed in this pass.

## Main finding

The dashboard gives baseline repayment totals more visual weight than the action and its impact. The monthly increase is hidden, the impact is compressed into a sidebar, and loan selection silently changes the scope of the simulation. The existing live calculation is a strong foundation: valid payment edits already update the chart without a submit button.

## Quick wins, in priority order

1. **Expose both payment inputs.** In `PaymentSimulator.vue`, replace the one-time-only section heading with “Extra payments.” Keep “One-time payment” and “Extra per month” visible together; put allocation strategy and rules behind a disclosure. Monthly payments are a core action, not an advanced option. Place both inputs before the shared impact summary, including on mobile.
2. **Give the impact room.** `PaymentPlanSummary.vue` puts three metrics into equal columns inside a 22rem simulator with nested padding. Use two prominent metrics—interest saved and time saved—with the new debt-free date on its own row. Match the initial placeholder to this layout. Remove the fixed 13.25rem minimum height if it leaves unnecessary space after simplification.
3. **Move emphasis from baseline cost to results.** `LoanOverview.vue` starts with three large cards and gives total repayment the darkest fill. Make baseline figures a compact neutral group. Reserve the strongest emphasis for payment impact; keep the baseline comparison explicit. Do not make baseline figures appear to change with a hypothetical payment.
4. **Replace implicit loan toggling with explicit scope.** `LoanList.vue` marks every loan selected in the all-loans view; clicking one focuses it, and clicking it again restores all. Add an explicit “All loans” choice and a clear selected loan state. A loan click changes the overview, chart, simulator inputs, and applicable monthly budget—not just the chart described by the button's accessible name. Make scope part of the control instead of explaining it in a secondary label.
5. **Cut decorative and repeated copy.** Remove the empty-state eyebrow and motivational heading, footer tagline/version, loan-form eyebrow/intro, chart interaction instructions, and strategy tagline/aliases. Use direct titles: “Add your first loan,” “Compare plans,” and “Payment strategy.” Remove “Preview only · updates the chart instantly” once the input/result grouping makes that relationship clear. Shorten “See the payment-by-payment breakdown” to “Payment schedule.”
6. **Remove competing add actions.** The global header and loan list both have “+ Add loan.” Keep one consistent entry point. On the empty state, make the main action dominant and shorten the secondary action to “Try an example.” Currently that secondary action opens the form, where a second example action must be clicked; make it load the example directly or label it accurately.
7. **Make loan cards easier to scan.** `LoanPaymentChip.vue` combines name, hidden edit/remove actions, balance, rate/type, and an editable minimum in cards that can be only 13rem wide. Move loan type to the editor/details, give long names a full row, and use a predictable action menu or visible edit action. Avoid revealing controls only on hover. Keep the minimum clearly identified as saved data, since changing it persists immediately and clears the hypothetical scenario.
8. **Trim the comparison expansion.** `ScenarioComparison.vue` repeats the main savings metrics, then renders four cards, budget prose, strategy comparison, allocation, and another schedule. Start with the four-plan comparison; disclose allocation and strategy details separately. Avoid repeating the schedule already available below the main chart. Hide irrelevant strategy content when monthly extra is zero and redundant comparisons when there is only one loan.

## Other cramped experiences

- **Desktop chart header:** payoff, minimum, and chart-view buttons share a wrapping flex row. Give chart-view controls a separate toolbar; avoid reducing the chart to accommodate sidebar text.
- **Mobile content order:** the chart slot precedes the simulator, and the layout stacks below 60rem. Inputs and results therefore follow the entire chart/inspector/schedule entry point. Bring payment controls and impact ahead of the chart in the mobile reading and focus order.
- **Loan editor:** the 36rem modal has 3rem of inner horizontal padding; paired fields require two 14rem columns plus a gap. They stack at the modal's maximum width, making the form longer than the paired markup suggests. Set realistic column widths and stack intentionally on narrow screens. Keep actions reachable while scrolling.
- **Typography:** important context uses 0.6–0.75rem text, including baseline labels, payoff comparison, and savings labels. Simplify the content and raise remaining essential labels rather than fitting more tiny text into each card.
- **Payment inspector:** three equal metric columns and repeated interaction instructions compete with the actual before/after outcome. Keep inspection subordinate to the payment impact.

## Copy that should become structure

- Show the monthly equation as aligned values: minimums + extra = monthly total. This replaces repeated budget paragraphs.
- Make “Today” part of the one-time input label and “per month” part of the recurring input. Keep exact allocation dates in details.
- Use concise strategy choices, “Highest rate first” and “Smallest balance first”; show the next allocation only when relevant.
- Keep principal and unpaid interest in a labeled balance group. Preserve their distinction; consider accepting comma-formatted amounts so formatting does not require instructions.
- Keep shared balance date as a group-level fact rather than repeating a date explanation under every field.

Retain actionable errors, stale-result warnings, unused-payment amounts, unavailable-estimate states, and storage failures. Shorten them where possible; they communicate real state rather than compensate for layout. Preserve accessible field names and repair `aria-describedby` references whenever helper elements are removed.

## Suggested implementation order

1. Core workspace: visible one-time/monthly inputs, larger impact summary, mobile ordering, quieter baseline totals.
2. Scope and loan management: explicit all-loans selection, clearer saved minimum editing, calmer cards and editor.
3. Secondary content: remove duplicate comparison output and decorative copy; consolidate allocation and assumptions.

## Visual validation for the implementation pass

Check empty, one-loan, multi-loan, and long-name states at 375px, 768px, and desktop widths. Exercise one-time only, monthly only, combined, reset, invalid input after a valid result, an oversized payment, and no baseline payoff. Confirm that scope changes and minimum edits cannot leave results attached to the wrong loans. Verify keyboard order follows the input → impact → chart flow, and that savings/date values remain readable without truncation. Run the existing component and calculation checks after implementation.

## Implemented on this branch

The final page order is loans → baseline outlook and one balance chart → guided extra-payment choices. Scope is explicit and selecting the same loan is idempotent. The comparison expansion only appears when both extra amounts are positive and contains compact plan rows. Zero inputs no longer create a savings preview. Gray dotted baseline and blue scenario curves share the chart, including incomplete projections with a shared 50-year horizon. Payment schedules/inspection, total-paid chart switching, balance details, routine storage/assumption panels, and footer are removed from the dashboard. Storage errors and recovery remain available.

Inline low-payment warnings, compact loan rows, a smaller loan editor, and explicit mobile text sizing remain part of the polish pass.

The exploration section now sits directly on the page background. Flat payment rows replace nested cards, with compact amount summaries that preserve the active preview. Monthly strategy uses a concise native selector. Zero-on-focus editing applies to money fields in exploration, loan entry, and saved minimums without creating a model change just from focus.

Allocation now follows the entered amounts automatically. The app compares all in-scope one-time targets and both monthly methods, chooses lowest projected interest with overall payoff date as the tie-breaker, and retains separate recommended allocations for one-time, monthly, and combined views. The primary UI shows where to pay; optional explanations expose alternatives, ties, and cost/time tradeoffs. Incomplete estimates never receive a cheapest-plan claim.

The six-loan density pass keeps cards but combines each name, balance, and rate into a compact scan target with the monthly input and actions alongside. Low-payment warnings now offer a whole-dollar, model-verified ten-year payoff goal. Expanded exploration is single-column, repeated recommendation labels/instructions and dividers are removed, and savings/time impact sit in one high-contrast block. Secondary payment math and recommendation explanation share one disclosure.
