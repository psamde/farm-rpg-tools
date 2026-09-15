# Balanced leftovers, v0.1.7

The existing leftovers UI now uses `balanced.py` by default. Reordering is visual only. Explicit priorities get first claim when their complete
recipe inputs do not overlap another priority. Both conflicting selections remain
checked but inactive. Free Iron/Nails do not conflict with Iron Depot enabled.
Caps include intermediate crafts and primary targets remain reserved. Old saves
load with no priorities; legacy ingredient choices no longer affect solving. The older allocator is retained
privately in `secondary.py` for regression comparisons, not as a UI option.

## What “balanced” means in this version

We balance **achievable craft shares**, as a practical proxy for broad mastery
progress. At a fixed route, each selected craft is compared with the maximum it
could make alone from the shared supply. A concave, diminishing-return score
rewards spreading progress across those normalized quantities. This is not an
exact average of raw-material consumption percentages, and it does not promise
that every selected craft has enough ingredients to be made.

The score approximates `log(1 + 9 * share)` at shares 0, .02, .05, .1, .2, .35,
.5, .75, and 1. All normal rows have equal weight. Valid priorities have weight 3
during route selection and receive their solo maximum on the chosen route before
balancing other crafts (subject to conservative output rounding). Caps bound aggregate craft counts,
including quantities used downstream. Intermediary crafting counts toward
mastery even when its output is consumed by another selected craft.

## Extra exploring

Only rows with extra exploring enabled can justify additional exploring.
Their entire recipe supplies a finite scoring reference: the smallest positive supported
craft quantity among feasible direct inputs, falling back to existing ingredients
further down the recipe if no direct input is available. Missing branches may
be explored for; abundant incidental drops do not inflate the whole goal.
Direct intermediate supply is computed with a shared-stock LP, preserving existing
bottles and avoiding shared-raw double spending. There is no user-selected anchor.
An empty recipe pool does not justify its own extra exploration, but can share
new drops generated for other crafts. The reference is a scoring scale, not a
physical stock budget; the material balance remains the source of truth.

The route score charges 0.25 per primary-route-equivalent of extra explores.
For passive inputs, the reference cost comes from the explorable raw ingredients
represented by the supplied stock. Rewards saturate while exploration retains
a positive cost, preventing self-replenishing ingredients from causing endless
exploration. These are fixed defaults for this first UI trial, not user-facing
performance or objective switches.

After selecting extra exploration, every selected craft—including leftovers-only
rows—shares all available supplies. We compute solo maxima for that route and
apply balanced allocation. A disabled row never gets a separate exploring step.
“Alone on this route” is a continuous upper estimate, not the old counterfactual
“if first” result. Tiny differences from rounding are not marked as conflicts.

## Accuracy and limits

Primary exploration and primary crafting remain fixed for each ranked baseline.
Additional locations are planned jointly. If the maximum area count would be
exceeded, retain the highest-used new locations within the remaining slots and
resolve. This is a heuristic for area selection, not an optimal mixed-integer
route search. Reports explicitly set `solver.optimal` to false.

The allocator solves continuous linear programs for speed in Pyodide/HiGHS.
It rounds retained outputs down, repairs intermediates in dependency order,
and checks every expected material balance. If rounding would overdraw a raw
material or violate a cap, it conservatively reduces retained outputs together
until the plan is feasible. This can leave small unused amounts. No separate
integer search runs on the UI path. Non-explorable inputs are limited to actual
provided stock; missing ingredients are reported for zero-output crafts.

## Validation

`test_balanced.py` covers breadth, order independence, explicit priority/conflict handling, caps, intermediate
caps/order, missing external inputs, existing finished stock, input immutability,
empty targets, the large saved Diary/Ring chain, later Antler supplies, and
physical balances. The CI also retains the previous allocator's historical
tests, verifies saves and route/Craftworks logic, and runs saved cases in WASM.

`test_balanced_browser.cjs` is an optional real Edge integration check against a
local server. It loads the user's shared-pool scenario with Large Net/Antler
enabled, checks the new version and nonzero outputs, and verifies that the
existing cards fit a 390-pixel mobile viewport.
