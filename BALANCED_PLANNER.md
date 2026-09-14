# Balanced leftovers, v0.1.3

The existing leftovers UI now uses `balanced.py` by default. Reordering gives
a soft preference, caps still include intermediate crafts, and primary targets
remain reserved. Save settings are unchanged. The older allocator is retained
privately in `secondary.py` for regression comparisons, not as a UI option.

## What “balanced” means in this version

We balance **achievable craft shares**, as a practical proxy for broad mastery
progress. At a fixed route, each selected craft is compared with the maximum it
could make alone from the shared supply. A concave, diminishing-return score
rewards spreading progress across those normalized quantities. This is not an
exact average of raw-material consumption percentages, and it does not promise
that every selected craft has enough ingredients to be made.

The score approximates `log(1 + 9 * share)` at shares 0, .02, .05, .1, .2, .35,
.5, .75, and 1. List weights decrease smoothly from 1.5 for the first row to 1
for the last; with one row its weight is 1. Caps bound aggregate craft counts,
including quantities used downstream. Intermediary crafting counts toward
mastery even when its output is consumed by another selected craft.

## Extra exploring

Only rows with extra exploring enabled can justify additional exploring.
Their chosen ingredient supplies an exploration scoring reference. If no such
ingredient exists in the original supply, a drop-rate reference allows later
sources to participate. This reference normalizes the reward; it is **not** a
physical stock budget or a constraint freezing newly gathered ingredients.
Legacy/API calls lacking an ingredient select an existing recipe input when
possible. An empty legacy pool cannot initiate an unbounded crafting target.

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

`test_balanced.py` covers breadth, soft priority reversal, caps, intermediate
caps/order, missing external inputs, existing finished stock, input immutability,
empty targets, the large saved Diary/Ring chain, later Antler supplies, and
physical balances. The CI also retains the previous allocator's historical
tests, verifies saves and route/Craftworks logic, and runs saved cases in WASM.

`test_balanced_browser.cjs` is an optional real Edge integration check against a
local server. It loads the user's shared-pool scenario with Large Net/Antler
enabled, checks the new version and nonzero outputs, and verifies that the
existing cards fit a 390-pixel mobile viewport.
