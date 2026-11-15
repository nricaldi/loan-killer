# Independent UI audit — f1c886b

Overall: **8/10**. The interface has a clear financial sequence and a consistent visual language. Extreme amounts now remain legible, and charts use honest proportional scales. The principal remaining cost is the long mobile path from a six-loan list to the results; the largest figures also force a less compact metric layout. Scores are judgment, not a calculated average.

| Category | Score | Evidence |
|---|---:|---|
| Visual hierarchy and scannability | 8 | Loans, total, scenario controls and balance chart follow an understandable sequence. Six long names push results well below the fold on phones. |
| Typography | 8 | Strong amount/name hierarchy and full wrapped names. The maximum idle ruler amount is grouped and readable; supplementary text is relatively small. |
| Spacing and alignment | 8 | Cards and controls align consistently across the grid and stacked layouts. At 320px large totals use three metric rows and wrap the total label. |
| Density and breathing room | 7 | Controls have space without feeling cramped; repeated long-name cards produce substantial vertical scrolling. |
| Component consistency | 8 | Related inputs, cards, switches and semantic colors are coherent; error and hidden states retain their context. |
| Responsive and accessible interaction | 8 | No document overflow in sampled states at four widths; selected coarse-pointer controls measure 44 × 44 CSS pixels and do not overlap. This is not a full accessibility audit. |

## Findings and priorities

1. **Low: long lists delay the payoff results on small screens.** In the six 80-character-name fixture at 320px, the selected date controls appear around 1,382px down the page in the hidden-loan state. Names remain distinguishable and actions remain reachable. Consider modestly reducing repeated card padding/gaps or offering an optional compact summary/navigation to results. Preserve full names and 44px targets. Tradeoff: compacting yields incremental savings and can make controls feel cramped; a summary adds interface complexity. See `terra-r3-six-320.png` and `terra-r3-active-375.png`.
2. **Low: extreme totals increase visual fragmentation on a narrow viewport.** At 320px, a roughly $20m balance moves the three metrics into separate rows and wraps “Total to repay”; values remain intact. Consider a responsive two-column arrangement only where measured text fits, or accept the current layout for this rare case. Do not shrink text or force a minimum visible bar segment: the tiny interest/savings portions correctly reflect their proportions. See `terra-r3-large-320.png` and `terra-r3-exact-320.png`.
3. **Low: some secondary chart and loan details are small.** Axis labels, rates and auxiliary explanations recede appropriately but may be harder to read for some users. Consider a modest size/contrast review with real-device and contrast testing; larger text will require additional chart margins or wrapping. No contrast ratio was measured here.

The normal chart's plan and baseline share a date extent, and the too-low-payment case shows a rising balance with a 50-year boundary and an explicit no-payoff message. The extreme-value bar's thin interest is appropriate to the numbers; do not distort its scale to make the segment prominent. These are visual observations, not a proof of the underlying financial calculation.

## Previous round-2 report comparison

Consulted `/tmp/loan-killer-audit/round-2-terra.md` after assessing the current captures. The reported `$20,000k` chart-label collision is resolved in the observed extreme case: the axis now uses `$20m` and clears the marker. The maximum minimum-payment field displays `10000000.00` in the 320px capture, including cents; a $9,999,999.99 value also fits. Six full names and selected 44px coarse targets remain intact. The previously noted long mobile list remains a low-priority tradeoff. The active benefit badge wraps at 320px and remains legible; this is acceptable. Large ruler idle values display grouping, while focusing exposes the exact ungrouped value.

## Method and limits

HEAD was `f1c886b45a2d00dc8e92cd0f0b63ca6701a78234`; the working tree was clean at inspection. Used isolated headless Chromium contexts with touch enabled at 320, 375, 768 and 1280 CSS pixels, 850px high. Captured empty, one and six long-name loans, add/edit dialogs, active $500 one-time and $100 monthly scenario, a hidden loan and excluded payment, a too-low $1 monthly payment, and maximum loan amounts. At all widths, both money rulers showed `9,999,999.99` idle and `9999999.99` on focus; entering `10000000.01` showed an error and explained the last valid comparison remains. The maximum $10,000,000 loan payment was visually captured with cents; the maximum permitted ruler value itself was not independently entered in this run. Add/edit forms were opened and visually inspected, but form submission and every validation path were not exercised. Selected icon, switch, date and increment buttons measured 44 × 44 CSS pixels with no pairwise overlap in the sampled hidden/excluded state, and document width matched viewport width. This geometry check does not prove gesture routing, keyboard traversal, screen-reader behavior, contrast, or native-device touch behavior. Native devices remain unverified. Local synthetic fixtures, host fonts, and headless rendering can differ from real use. Artifacts and scripts use `terra-r3-` in `/tmp/loan-killer-audit/`.
