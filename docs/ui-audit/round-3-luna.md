# Loan Killer UI audit — round 3

**Reviewed commit:** `f1c886b45a2d00dc8e92cd0f0b63ca6701a78234`  
**Overall: 8/10** — the compact layouts remain readable and the money ruler now groups large idle amounts while preserving raw editing. I found no major responsive or hierarchy defect at the requested viewport sizes. The shared chart time horizon still makes an early payoff hard to read when compared with a far later baseline, and the narrow 320px layout with six long names is necessarily tall.

## Scores

| Category | Score | Evidence |
|---|---:|---|
| Visual hierarchy and scannability | 8/10 | Brand, loan count, cards, repayment summary, payment controls, and balance chart form a clear reading order. In the six-loan 320px capture the card names and balances remain distinct. A short payoff against a distant baseline still compresses one series on the shared chart. |
| Typography | 8/10 | Numeric values use tabular figures and remain grouped/legible. Long loan names wrap rather than clip. The small labels and chart axis text are secondary but readable at 320px. |
| Spacing and alignment | 8/10 | Six cards use consistent padding, action placement, and card gaps. 44×44px action controls were measured at 320/375/768/1280; mobile’s additional vertical rows for long names and actions account for the greater page length. |
| Density and breathing room | 8/10 | Card layout remains compact without shrinking primary text or touch areas. The 320px six-loan page is long, but the cards do not feel cramped. Avoid compressing the repeated card or control spacing further. |
| Component consistency | 9/10 | Cards, neutral surfaces, warning treatment, chart, and payment controls are consistent. This commit resolves the round-2 exception: the idle ruler renders `$10,000,000`, while focus exposes the exact raw `10000000` value. |
| Responsive and accessible interaction | 8/10 | Measured `scrollWidth` equaled viewport width at all four widths, with no page errors in the capture run. Coarse-pointer loan action buttons measured 44×44px. Forms use labels and invalid-field focus logic in source; native devices, screen readers, zoom, and actual touch gestures were not tested. |

## Findings and prioritized fixes

1. **Medium — shared long chart horizon can visually flatten a much earlier payoff.** This persists from round 2. With a decades-long baseline and a selected plan that pays off much earlier, the selected line falls near the left edge and stays at zero for most of the shared plot. The common scale represents the full comparison honestly, so I do not recommend distorting it. Consider adding a compact, clearly labeled earlier-payoff inset or a second view while retaining the full-horizon comparison. Tradeoff: another chart element/view adds visual complexity and duplicate scale interpretation.

2. **Low — six long loan names create a tall 320px page.** Names wrap legibly and remain distinguishable; the existing 80-character limit bounds the growth. This is a density cost, not a clipping defect. A collapsed details mode could shorten the list, but adds interaction and makes comparison less immediate; preserving names is preferable for now.

## Round-2 verification

- **Resolved:** grouped idle ruler values now use locale separators. At 375px `$10,000,000` rendered as `10,000,000` beside the currency symbol; focusing exposed raw `10000000` for exact editing. A cents-bearing supported input was previously proven in round 2 as `$1,000,000.25`, and the current code’s idle formatter selects two fraction digits when the raw value contains a decimal.
- **Still open:** chart readability for widely separated payoff dates remains as described above. Preserve an honest shared scale if changing the visualization.
- Round-2 resolved issues remain resolved in the fresh captures: metric amounts do not wrap, long names wrap rather than clip, unavailable savings uses neutral styling, and card controls remain separated.

## Coverage and limitations

- Fresh screenshots for six loans at 320, 375, 768, and 1280 CSS pixels. The measured document width equaled viewport width at each size; six loans appeared in the list. No browser page errors were captured.
- A supported `$10,000,000` ruler value was checked idle and focused. Invalid `$10,000,000.25` showed the documented `$0–$10,000,000` validation error; it is beyond the supported limit and is not a valid maximum case.
- Normal balances and an active payment scenario were captured; two long names have a shared prefix and distinct endings. The active screenshot was at 320px.
- Action target geometry was measured at 44×44px for coarse-pointer emulation. The four-width capture run verified no horizontal overflow.
- The supplied Round-2 audit artifacts were used to cross-check six-loan layouts, active/hidden/excluded scenarios, payment warnings, and the add/edit form states. This round’s fresh form completion was not fully measured: the new add form accepted the valid `$10,000,000.00` principal and `$0.01` monthly payment and closed, so the follow-up zero-payment check did not execute. Form labels, range guidance, invalid focus behavior, and low-payment warning flow are also present in source, but those details should be treated as source inspection or prior-round evidence, not a fresh round-3 interaction measurement.
- Browser testing used headless Chrome with emulated CSS widths and coarse pointer; it is not a native phone/tablet test. Actual devices, VoiceOver/TalkBack, browser zoom, and physical swipe behavior remain unverified.
- Read-only audit. App source and commit history were not changed.

## Fresh artifacts

- [Six loans, 320px](/tmp/loan-killer-audit/luna-r3-six-320.png)
- [Six loans, 375px](/tmp/loan-killer-audit/luna-r3-six-375.png)
- [Six loans, 768px](/tmp/loan-killer-audit/luna-r3-six-768.png)
- [Six loans, 1280px](/tmp/loan-killer-audit/luna-r3-six-1280.png)
- [Maximum supported ruler value, 375px](/tmp/loan-killer-audit/luna-r3-max-375.png)
- [Active payment scenario, six loans, 320px](/tmp/loan-killer-audit/luna-r3-active-320.png)
- [Maximum amount form interaction, 320px](/tmp/loan-killer-audit/luna-r3-form-320.png)

Capture scripts use `luna-r3` prefixes under `/tmp/loan-killer-audit`. The maximum-form screenshot shows the accepted form state and will need regeneration if the interaction is captured again; it is not linked as completed evidence.
