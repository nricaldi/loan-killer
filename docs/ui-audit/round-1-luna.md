# Loan Killer UI audit — round 1

**Reviewed head:** `1071e302f674126774e583bfc2677ddeac417033`  
**Overall: 7/10** — a coherent, capable dashboard with strong compact loan cards and a clear monochrome visual system. The main weakness is that the selected repayment trajectory can become visually misleading at phone widths when payoff times are very different; several dense metric labels also break awkwardly at 320px.

## Scores

| Category | Score | Evidence |
|---|---:|---|
| Visual hierarchy and scannability | 7/10 | “Your loans” and debt total lead, followed by payment exploration and one balance chart. In the six-loan 320px capture, this intentionally becomes a tall single column; the principal metric remains easy to spot, but the amount-owed value wraps at its cents. Scenario commentary and collapsed details follow chart results at the bottom. |
| Typography | 7/10 | Avenir/Segoe UI stack, tabular money, consistent weights, generally readable labels. At 320px three-column metric values wrap ($49,650.00 and $11,605.16 split after decimal digits); long card names ellipsize without an exposed full-name affordance. Eyebrow text at 0.6rem is quite small, but secondary. |
| Spacing and alignment | 8/10 | Loan cards and controls align cleanly across 320, 375, 768 and 1280; no horizontal overflow observed. Even at 320px the eye/edit/remove controls remain separated. In the modal the close affordance is separated from form fields and the dialog scrolls. |
| Density and breathing room | 8/10 | Six cards remain scannable at 320px without turning into a cramped table; dates remain above separate one-time/monthly cards. Cards have visible whitespace around payment fields. Save space by trimming repeated vertical gaps only modestly; do not compress card targets or combine the rulers. |
| Component consistency | 8/10 | Surfaces, borders, controls and selected scenario treatments are consistent; red marks interest/insufficient payment, green marks saved amount. The chart line and metric display have a mismatch under short payoff scenarios, and the missing-result metric’s “Saved” position can make “Not available” look like a savings amount. |
| Responsive and accessible interaction | 7/10 | No horizontal overflow at target widths. Coarse pointer CSS grows action buttons to 44px and switches expose checked state; modal is native dialog with focus containment, escape close, initial focus, and return focus. Screen reader labels exist for icon and inclusion controls. Actual native mobile hardware was not tested. Chart crowding at early payoff is a usability concern; keyboard/date behavior not exhaustively audited. |

## Ranked findings

1. **High — short payoff plans make the chart hard to interpret on mobile.** In the 375px two-loan scenario, adding $150 once and $100/month pays one loan quickly. The selected solid line drops almost vertically at the chart’s left edge and then follows the zero baseline nearly the full 50-year plot. It overlaps the horizontal zero line and its payoff label, making the selected trajectory difficult to distinguish. Source: [BalanceChart.vue](/home/nico/dev/personal/loan-killer/src/components/BalanceChart.vue:35) and [LoanTrajectory.vue](/home/nico/dev/personal/loan-killer/src/components/LoanTrajectory.vue:25). **Improvement:** use a chart window ending at the later relevant payoff date for paid-off comparisons (baseline and selected plan), with a short fixed visual right margin; retain the 50-year horizon only when a projection is incomplete. Ensure x-axis dates and endpoint label use that same window. Tradeoff: changing the scale after selecting a scenario makes comparisons less temporally uniform, so state the displayed range through axis labels; do not add helper paragraphs.

2. **Medium — key currency totals break across lines at 320px.** In the six-loan screenshot, the 3-column Amount owed value shows `$49,650.0` then `0`; Future interest similarly splits. This is a real scan/read defect, not just taste. Source: [LoanTrajectory.vue](/home/nico/dev/personal/loan-killer/src/components/LoanTrajectory.vue:66). **Improvement:** at <=22rem, switch metric values to a two-column arrangement with Saved on the second row, or use a smaller 12px tabular value while keeping the three semantic labels together. Prefer the two-row layout to preserve legibility; its tradeoff is a small increase in vertical height.

3. **Medium — long loan names are truncated with no way to reveal the full text in the card.** A long synthetic loan name renders as “Very long private…” at 320px, so users cannot verify which entry a card represents. The icon buttons carry full accessible names, but sighted users have no corresponding reveal. Source: [LoanPaymentChip.vue](/home/nico/dev/personal/loan-killer/src/components/LoanPaymentChip.vue:46). **Improvement:** allow the name to wrap to at most two lines (or show full name on card focus/activation) while retaining the existing compact card layout and control targets. Tradeoff: unusually long names add card height; the 80-character form cap bounds this.

4. **Low — “Saved” can visually read as a positive result when unavailable.** In the insufficient-payment case, the metric column says “Saved” with a green “Not available,” even though there is no complete estimate. Source: [LoanTrajectory.vue](/home/nico/dev/personal/loan-killer/src/components/LoanTrajectory.vue:56). **Improvement:** render the label in neutral text and the value in neutral color when `interestSaved === null` (and use “Unavailable” only if it fits without extra explanatory copy). Tradeoff: less emphasis on the empty metric, which is appropriate because it is not a savings outcome.

## Scenario and viewport observations

- Empty state is centered and plainly identifies the first action; at 320–1280 it has no overflow.
- One and six loans render in the expected compact cards. At desktop, the card list uses an auto-fill grid; tablet/phone naturally collapse to one column.
- Add/edit form opens in a native modal. At 375px the edit modal fits width, scrolls vertically, exposes the close control and shows low-payment warning plus suggested payment. I did not inspect every form validation/error combination.
- Insufficient minimum payment is clearly marked in red on the card and shows a ten-year plan suggestion. In this synthetic case, overall repayment remains incomplete and the savings metric is the issue described above.
- Active one-time and monthly inputs show the $5 ruler notches, exact editable amount, ± controls, and separate inclusion switches. The selected plan adds allocation tags to the loan card and comparison text below the chart. One-time-only, monthly-only and combined states were rendered; switches visually communicate excluded state.
- Date tool remains above separate money cards as requested; the date labels and chart metrics hierarchy are clear. Screens show no date ticks. The 320px chart labels remain legible but the plotted early payoff trajectory has little horizontal room.
- Empty, 1-loan and 6-loan cases were captured at 320, 375, 768 and 1280. All reported `documentElement.scrollWidth === innerWidth`.

## Method and limits

Read the Vue source and CSS at the stated commit. Inspected the production app at `http://127.0.0.1:4173` using isolated Playwright with the provided headless shell. Browser localStorage fixtures contained only synthetic records; contexts were closed after capture. Screenshots are desktop-browser viewport emulations at the requested CSS widths, not native-device tests. I exercised add/edit opening, one-time and monthly values, inclusion switches, chart/metrics, and low-payment data; I did not conduct a complete keyboard-only, screen-reader, or browser-zoom audit. Screenshot artifacts document representative states; there is no claim of exhaustive functional verification.

## Artifacts

- [Empty state, 320px](/tmp/loan-killer-audit/luna-empty-320.png)
- [Six loans, 320px](/tmp/loan-killer-audit/luna-6loans-320.png)
- [Six loans, 1280px](/tmp/loan-killer-audit/luna-6loans-1280.png)
- [Combined scenario, 375px](/tmp/loan-killer-audit/luna-scenario-combined-375.png)
- [Monthly-only scenario, 375px](/tmp/loan-killer-audit/luna-scenario-monthly-only-375.png)
- [Edit modal, 375px](/tmp/loan-killer-audit/luna-edit-375.png)
