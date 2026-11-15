# Independent UI audit — 070a788

Overall: **8/10**. The page is compact and orderly, with an understandable path from loans to repayment and scenario comparison. The new mobile shortcut substantially improves navigation through long lists while preserving full names. The remaining concerns are minor readability and density tradeoffs, not reasons to distort scales or shrink targets. Scores are independent judgment, not a calculated average.

| Category | Score | Observed evidence |
|---|---:|---|
| Visual hierarchy and scannability | 8 | Loan inputs precede the prominent total, scenarios, and chart. The underlined View results shortcut is visible before six cards on phones; similar long names still require careful reading. |
| Typography | 8 | Loan names and amounts are distinct and full names wrap. Small rate, chart-axis, and supporting labels recede; large values remain legible in the sampled maximum fixture. |
| Spacing and alignment | 8 | Consistent card edges and control alignment across stacked and grid layouts. The narrow maximum-value layout uses more metric rows but avoids clipping. |
| Density and breathing room | 8 | Cards and controls are compact without appearing crowded. Six 80-character names still make a long page, but navigation now bypasses it. |
| Component consistency | 8 | Cards, input frames, switches and scenario panels share a coherent treatment. Hidden and excluded states remain distinguishable in the sampled view. |
| Responsive and accessible interaction | 8 | No horizontal document overflow or overlap among sampled controls at 320, 375, 768 and 1280px. Enter on the mobile shortcut focuses and scrolls to the repayment heading; selected target geometry is at least 44px. This is not a complete accessibility audit. |

## Ranked actionable issues

1. **Low — secondary information remains small.** Rates, axis labels and supporting annotations are readable in the captures but may be difficult for some users. Review them on real devices and consider a modest type-size increase where space permits. The tradeoff is wrapping or extra chart margins; preserve the compact primary layout. The source-based round-3 calculation puts hidden secondary text at 5.11:1 and muted text at 4.06:1; the latter does not meet 4.5:1 for normal text if that source color and compositing apply to a given text element. This is a lead for an element-level audit, not a claim that every muted element fails.
2. **Low — long names still create a long scroll when editing multiple loans.** At 320px all six names wrap and remain distinguishable, and View results bypasses the cards. Keep the shortcut; only consider an optional compact presentation if research shows repeated editing is burdensome. Further compression risks cramped controls or obscuring names, and another control adds clutter.
3. **Low — extreme totals fragment the narrow summary.** The large-value capture preserves numbers and proportionate thin segments while metrics stack. Accepting this rare extra height is reasonable; consider alternative columns only when measured text fits. Do not enforce a misleading minimum bar size.

The active comparison has a common date extent for plan and minimums. The $1 monthly payment fixture reports no complete estimate and shows a rising balance with a 50-year boundary; the warning is visible next to the field. These are visual observations, not verification of financial calculations.

## Comparison with round 3

Round 3's main concern was the mobile route through six long-name cards. The current View results link addresses that navigation cost without reducing card targets or truncating names. At 320 and 375px, keyboard Enter moved focus to `repayment-heading` and brought it to the top of the viewport; the link target was at least 44px high. The link was not visible at 768 or 1280px. The hidden loan's observed computed opacity after blur and pointer exit is 0.85, with rate text rgb(85, 85, 85); this improves the contrast tradeoff documented in the parent verification, though muted text deserves the element-level review above. Density improves from 7 to 8; other scores and overall remain 8. Large-value stacking and small auxiliary labels remain low-priority tradeoffs.

## Method and limitations

HEAD was `070a78860005188a390229e5ed9b787f02bd4271`, with a clean working tree at inspection. Fresh isolated headless Chromium contexts used 320, 375, 768 and 1280 CSS-pixel viewports, 850px high and touch enabled. Captured empty, one and six 80-character-name loans, add/edit dialogs, active monthly and one-time amounts, hidden loan with excluded payment, insufficient payment, and large values. Checked document width and geometry of sampled controls; there were no detected overlaps. A separate keyboard check tested Enter and focus on the shortcut and its visibility at all four widths. The loan payment too low to pay off was inspected; exhaustive form validation, every interaction, native touch devices and screen readers were not tested. Contrast values above come from the prior source-based calculation, not fresh rendered-pixel measurement. Headless fonts and synthetic fixtures may differ from real use. Artifacts are `/tmp/loan-killer-audit/terra-r4-*`; screenshots include `terra-r4-six-320.png`, `terra-r4-active-1280.png`, `terra-r4-excluded-375.png`, `terra-r4-unpaid-768.png`, and `terra-r4-large-320.png`.
