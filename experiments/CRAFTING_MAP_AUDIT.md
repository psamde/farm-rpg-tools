# Crafting-map acceptance audit — v0.1.73

Date: 2026-09-17. Audit only: no application changes or deployment were made in this run. Existing uncommitted v0.1.72–0.1.73 work was left intact.

## Acceptance scenario

Primary: collect 125 Ant Apple. Use Feathers, Fern Leaf, and Purple Flower to make Leather, Green, and Purple Diaries, with every optional craft set to Use + Void. Add Forest to supply Mushroom and Hide together. Then add Wooden Bow to consume Wood and Straw. Wooden Bow also needs Fern Leaf, so it must compete with optional Green Parchment rather than fail against a frozen allocation.

Expected properties:

- Adding the same recipes in a different order does not starve the recipes added later.
- Use + Void is a soft goal that remains active at zero current production; it is not a permanent zero cap or an exact obligation.
- The three diaries share their common inputs proportionally. Explicitly forced consumers, when present, reserve their quantities; the soft consumers share what remains.
- Forest is one source node whose actual output edges include every relevant material it supplies, including Mushroom, Hide, Wood, and Straw.
- A feasible balanced partial result can be reviewed and applied without changing soft goals to forced ones.
- Adding Wooden Bow can reallocate resources away from excess optional intermediates without erasing user choices or breaking the primary goal.
- Preview, graph, review, apply, and save/reload describe the same plan.

## Evidence and results

### Real UI run A: exact scenario

New isolated `http://localhost:8770` origin, v0.1.73. Resource Saver 0 and default perks. User's original `127.0.0.1:8770` tab and draft were untouched.

Actions: primary Ant Apple 125 → White/Green/Purple Parchment via Use + Void → Leather/Green/Purple Diary via Use + Void → Mushroom source Forest → Review → Wooden Bow via Use + Void → Mushroom Share 100% → Forest → Review again.

| Stage | Result |
|---|---|
| Primary route | 7,978,300 explores, Highland Hills |
| Initial parchment crafts | White 126,534; Green 126,484; Purple 126,548 |
| Initial diaries | All zero because Mushroom/Hide are missing |
| After Forest selection | Diary aims become 126,535 / 126,485 / 126,549; White Parchment aim becomes 379,569 |
| Computed preview | 14,838,663 explores; diaries 43,987 / 44,269 / 38,277 |
| Apply | Disabled: soft diary aims are incorrectly treated as required quantities |
| Explicit Share 100% | Diaries 42,182 / 42,165 / 42,186; Apply still disabled |
| Wooden Bow | Stays zero despite Forest preview; map does not rebalance shared Fern Leaf |

Forest's source card DID list Hide in this particular sequence, and later listed Straw. Missing source-comparison information is state/sequence dependent, not universally absent.

### Six model permutations + actual solver

Controlled settings: Ant Apple 125, Resource Saver 45%, Iron Depot on, Runecube on. Same parchment nodes, all six diary-add orders. Full records: `experiments/audit-map-permutations.json` and `experiments/audit-solver-results.json`.

Current map potential generation promotes only the first diary to about 259,000 crafts, leaving the others at zero. Feeding that generated request to the actual solver reproduces first-diary-only production. Leather-first needs 15,359,628 explores; Green-first 14,994,343; Purple-first 14,992,117. This is order dependence before the solver, not evidence that the other two recipes are infeasible.

With a coherent shared-demand request, the existing solver finds:

| Output / route | Quantity |
|---|---:|
| Leather Diary | 86,347 |
| Green Diary | 86,347 |
| Purple Diary | 86,347 |
| Wooden Bow, with a test cap of 100,000 | 100,000 |
| Highland Hills explores | 7,895,153 |
| Forest explores | 7,100,104 |
| Total explores | 14,995,257 |

Adding those 100,000 bows does not increase explores in this experiment. The solver reduces surplus Green Parchment from 178,627 to 145,294, freeing Fern Leaf. This is a feasibility witness, not a claim that 100,000 is the maximum bow count or that the result is globally optimal.

### Real UI run B: alternate order/source timing

An independent UI agent used `http://localhost.:8770`. Resetting that origin's seeded sample was blocked by automatic approval review, so this run retained the seeded primary plan and added Ant Apple. It is an alternate interaction test, not a numerically comparable duplicate of run A.

After adding Green Parchment and Green Diary with Use + Void and selecting Forest for Mushroom, the preview increased from 8,927,499 to 17,851,423 explores by expanding Highland Hills and Gary's Crushroom. Forest remained a proposed, uncalculated location. The action named selecting Forest only allowed that location; it did not bind the source choice. Apply succeeded in this alternate run: Forest disappeared from the graph, while Mushroom still offered Remove Forest source and Add this location simultaneously. The persisted source setting and calculated route disagreed.

## Confirmed bugs

| ID | Severity | Failure | Cause / evidence |
|---|---|---|---|
| B01 | Blocker | Use + Void freezes at zero when ingredients are missing. | `craftMapAddOptions` returns `available: 0`; the add handler stores it as the solver's hard `cap: 0`. Adding supply cannot reliably revive the recipe. |
| B02 | Blocker | Recipe order changes who gets shared materials. | `craftMapPotential` mutates earlier proposed goals while evaluating later goals. Six permutations select different winning diaries. |
| B03 | Blocker | Potential can over-claim shared intermediates. | UI run A promises the full White Parchment pool to all three diaries, triples its aim, and creates a 759,105 Feathers shortage. |
| B04 | Blocker | Selecting a source turns soft aims into mandatory obligations. | Handler clears `available_only` but retains `consumer_mode: available`; review checks `available_only` instead of the explicit mode. |
| B05 | Blocker | A valid balanced result cannot be applied. | B04 produces shortfalls against generated full aims. Apply is disabled even when the solver produces tens of thousands of each diary. |
| B06 | High | Graph hides the computed preview when any aim has a shortfall. | `solvedPreview` requires zero shortfalls. The UI then displays old supplies, missing Mushroom/Hide, and an uncalculated Forest while review says calculation is complete. |
| B07 | High | Forest is not shown connected to all relevant outputs. | Pending source selection stores only the clicked item edge. B06 prevents the solved Forest output edges from replacing it. |
| B08 | High | Wooden Bow cannot access resources locked in earlier optional intermediates. | Map AddOptions offers only 4 bows in the controlled already-balanced plan. Actual solver makes 100,000 by reducing surplus Green Parchment, with no extra explores or fewer diaries. |
| B09 | High | Balanced sharing is not the automatic Use + Void default. | A `demand_group` is only established by the separate Share control. Ordinary all-Use + Void interactions need extra manual repair and can remain blocked afterward. |
| B10 | High | Selecting Forest can produce a route that omits Forest. | Source selection is reduced to an allowed-area list, while all existing route areas remain candidates. Confirmed in alternate UI run B. |
| B11 | Medium | Source card contradicts its own selection state. | Same Forest card says Remove Forest source and Add this location. Selection and solved-route presence are conflated. |
| B12 | Medium | Clicking another item changes the visible explore count back to the old plan. | Run A shows 14.84M preview; opening Wood options returns to 7.98M / one location. |
| B13 | Medium | Usage semantics are split across incompatible fields. | `consumer_mode`, `available_only`, `void_source`, hard `cap`, node-label arrays, and source selections are changed independently. The review request drops `available_only` and `void_source`; source selection changes one interpretation but not the others. |
| B14 | Low | Unlimited supplies show actionable-looking potential demand. | Iron shows Unlimited and Potential demand 126,504 after Bow is added. |
| B15 | Medium | Potential demand can be counted again after the preview has fulfilled the proposed craft. | Alternate UI run B retained old Mushroom/White Parchment potential after Green Diary activation; prospective drafts are reused against the solved preview. |
| B16 | Medium | Zero stock can be advertised as a feasible use-all craft. | `all` is clamped to at least one, and sub-10 gaps are filtered before labeling readiness. Leather Diary showed Can use all · 1 crafts / no significant gaps while Use + Void correctly offered zero. |

The synthetic review harness in `experiments/audit-review-state.cjs` isolates B04–B07: an available consumer is promoted from cap 0 to 100; solver supplies 50; Apply is disabled; the solved preview is hidden; only Forest→Mushroom is stored, not Forest→Hide.

## Why previous green tests missed this

The unit tests exercised isolated actions with mocked empty result lists, tiny independent recipes, or manually supplied demand groups. They did not execute the complete user journey from zero-output diary additions through source selection, shared allocation, review, apply, and a subsequent competing craft. The map, its preview request, and the solver were each tested against different assumptions.

Additional architectural detail and executable commands: `experiments/audit-architecture.md`.

## Recommended repair order

1. Define one persisted recipe intent: soft Use + Void, forced demand, explicit cap, or disabled. Keep desired/potential quantity separate from computed production. A soft recipe making zero must remain eligible.
2. Replace sequential draft-cap generation with joint shared-pool allocation. Freeze the overall exploration reference to prevent self-feeding loops, not each recipe's output at click time. Include optional intermediates in reallocation.
3. Treat a location selection as one source action covering its full output vector. Derive item links and coverage from that source. Make removal update the same source object and clearly handle areas required by primary goals.
4. Always display the newest valid computed result, with unmet hard demands shown separately. Only unmet hard goals should block apply; soft shortfalls should not.
5. Make the exact scenario an end-to-end acceptance suite: all six diary orders, Forest before/after diaries, Bow before/after review, source removal/re-add, mixed Force/Use + Void, and save/reload. Check material conservation, stable node choices, equivalent counts within rounding, and no unsolicited extra location.

No more isolated UI patches should be called complete until that full journey passes.
