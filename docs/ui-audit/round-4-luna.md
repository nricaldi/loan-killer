# Loan Killer UI audit — round 4

**Reviewed commit:** `070a78860005188a390229e5ed9b787f02bd4271`  
**Overall: 8/10** — the compact layout remains readable, the new mobile route to results works by keyboard, and hidden loan text remains legible at rest. I found no horizontal overflow at 320, 375, 768, or 1280 CSS px. The main unresolved presentation issue is still the balance chart’s shared long time horizon, which can make a much earlier payoff look compressed.

## Scores

| Category | Score | Evidence |
|---|---:|---|
| Visual hierarchy and scannability | 8/10 | At 320/375, “Your loans” and count lead into the list, then the “View results” link, cards, and repayment summary. At 320, the six-card list makes the result start substantially farther down the page; the anchor is easy to find before the cards. The repayment total and principal/interest split remain distinct. |
| Typography | 8/10 | Six long names wrap across multiple lines at 320/375 without clipping; balances and rates remain readable beside the names. Tabular money values and grouped large totals retain clear emphasis. Small chart labels stay secondary. |
| Spacing and alignment | 8/10 | Cards share consistent padding and row spacing. At 320, name, balance/rate, minimum, and actions wrap into a predictable sequence. The View results link is 44px high. The dense six-card page is tall but not cramped. |
| Density and breathing room | 8/10 | White cards and gray page background preserve separation without excess decoration. Six long names produce a long page, particularly at 320, but the payment inputs and action controls retain room. Avoid shrinking these repeated card rows further. |
| Component consistency | 9/10 | Cards, edit/hide/remove icons, payment inputs, totals, date controls, and chart use a coherent set of surfaces and spacing. Hidden loans keep the same card layout, with the eye-slash/pressed state identifying exclusion. |
| Responsive and accessible interaction | 8/10 | Fresh runs at all four widths had no horizontal overflow or page errors. The shortcut was visible at 320/375 and absent at 768/1280. Enter activated it at 320/375, focused `#repayment-heading`, and native anchor scrolling placed that heading at the viewport top. At 375 the target measured 101×44px. An empty required loan name focused the invalid name field and exposed `aria-invalid="true"` with `aria-describedby="name-error"`. Native touch, screen readers, zoom, and physical swipe behavior were not tested. |

## Ranked findings and tradeoffs

1. **Medium — a shared long chart horizon compresses an earlier payoff.** The chart shows the full comparison horizon, but when the selected payoff is much earlier than the baseline, the selected trajectory can fall near the start and remain at zero over much of the plot. This makes the timing difference harder to scan. Keep the shared full-horizon chart for honest scale comparison; consider an optional clearly labeled early-payoff detail or alternate view. Tradeoff: another scale or view adds complexity and needs clear labeling to prevent false comparison.

2. **Low — six long names still make the 320px page tall.** All six names in the fresh capture wrap legibly, with no clipping or horizontal scroll. This is a content-driven height cost. Collapsing detail or truncating names could shorten the page but would make identifying and comparing loans harder; keeping the full names is the better current tradeoff.

## Round-3 comparison and current-revision checks

- **Mobile results route confirmed:** the shortcut appears before the cards only at narrow widths, activates with Enter, scrolls natively to the repayment heading, and focuses it. The 44px minimum height is preserved. No horizontal overflow occurred at the four tested widths.
- **Hidden-card opacity confirmed:** after moving both pointer and focus away, computed opacity is `0.85`; the secondary rate color is `rgb(85, 85, 85)` on white. The supplied round-3 source-based compositing estimate is about 5.11:1 for this secondary text at 0.85 opacity over `#f5f5f5`; that estimate is not a direct contrast measurement of every rendered pixel. Focus/hover restores full opacity.
- **Six long names confirmed:** distinct endings remain represented and names wrap cleanly at 320/375; balances, rate, and minimum inputs remain visible. The page is taller at 320, without clipping.
- **States checked:** active payment controls, excluded loans, hidden loan card, and an invalid empty-name form submission were captured. The invalid submission focused the name input and associated its error text. The empty-name case does not cover every numeric validation or warning branch.
- **Chart concern remains:** the round-3 shared-horizon tradeoff is still the main actionable visual finding. I did not change the underlying scale recommendation.

## Coverage and limits

- Fresh six-loan screenshots at 320, 375, 768, and 1280 CSS px; mobile keyboard navigation checked at 320/375. Document width matched viewport width at all four.
- Active, hidden, excluded, and invalid-name captures at 375px. Hidden opacity was checked after removing hover and focus.
- Browser testing used supplied headless Chrome with emulated viewport and touch settings. This does not establish behavior on native devices or with VoiceOver/TalkBack. Rendered contrast, browser zoom, and physical touch gestures were not verified.
- Read-only audit of the production build served at `http://127.0.0.1:4173`; application source, Git state, and server were left unchanged.

## Fresh artifacts

- [Six loans, 320px](/tmp/loan-killer-audit/luna-r4-six-320.png)
- [Six loans, 375px](/tmp/loan-killer-audit/luna-r4-six-375.png)
- [Six loans, 768px](/tmp/loan-killer-audit/luna-r4-six-768.png)
- [Six loans, 1280px](/tmp/loan-killer-audit/luna-r4-six-1280.png)
- [Hidden loan, 375px](/tmp/loan-killer-audit/luna-r4-hidden-375.png)
- [Excluded loans, 375px](/tmp/loan-killer-audit/luna-r4-excluded-375.png)
- [Active payment controls, 375px](/tmp/loan-killer-audit/luna-r4-active-375.png)
- [Invalid name, 375px](/tmp/loan-killer-audit/luna-r4-invalid-375.png)
