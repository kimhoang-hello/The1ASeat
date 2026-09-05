# V1 audit and V2 implementation contract

- Preserve the existing `Game` model, DOM renderer, one requestAnimationFrame loop, pointer capture, keyboard controls, exponential movement smoothing, forgiving collision bounds, resize handling and visibility pause.
- Preserve program logos, Ghế 1A brand tokens, Vietnamese controls, score breakdown and the Avios contrast fix.
- V1 resets all transient gameplay state correctly and stops on time/fatal balance. New combo, boost, award, challenge and feedback state must join that same reset lifecycle.
- V1 multiplier calculation is the single place to extend scoring. V2 normal points use combo × chaos × strongest applicable temporary boost, capped at 10×. Fixed-value bonus catches stay fixed. No point value comes from the URL.
- Extend spawn weights and spacing checks; do not introduce a second spawning system. Add a safe-lane check for near-simultaneous hazards and a mild, capped performance adjustment.
- Guard non-finite update/movement/score inputs. Keep persistence, share APIs and analytics failures outside gameplay.
- Keep result essentials screenshot-friendly; retain the program breakdown in an expandable section.

Phase gates: automated regression tests after each phase; browser rounds after the gameplay phases and the finished social/retention UI. Final balancing uses seeded simulation of the actual game model plus browser playtests. Simulations are tuning evidence, not a substitute for real-device touch testing.

## Completion notes

All four V2 phases are implemented. The final V2 rank tuning sets POINTS LEGEND at 30,000: seeded precise-controller simulations reach it in roughly 1% of runs at both tested widths. V2.1 does not adjust that tuning. The simulation uses 150 seeds per stationary, casual and precise controller at widths 356 and 1038, for 900 rounds; it is a reproducible model check, not a prediction of human difficulty.

Per later user steering, V2's three social controls are removed. Challenge parsing and target gameplay remain. Vietnamese result labels replace ARRIVALS, FLIGHT COMPLETED, TIME'S UP, FINAL SCORE, NEW PERSONAL BEST and YOU BEAT THE CHALLENGE. V2.1 replaces the old one-line summary with one compact Vietnamese gameplay insight.
