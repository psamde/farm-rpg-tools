# Crafting-map acceptance audit (read-only)

Acceptance scenario: 125 Ant Apples, Resource Saver 45%, Iron Depot and Rune Cube on. Highland Hills provides Feathers, Fern Leaf, Purple Flower. Add White/Green/Purple Parchment and Leather/Green/Purple Diary using Use + Void, select Forest for Mushroom, then add Wooden Bow. Only Highland Hills and Forest enabled in executable runs to isolate intended route.

## P0: Addition order selects the only diary that survives

Reproduction scripts: `experiments/audit-model.py`, `audit-map-permutations.cjs`, `audit-solver.py`. Outputs: `audit-map-permutations.json`, `audit-solver-results.json`.

All three diaries initially have `available=0` because no Mushroom exists. All six diary-add permutations were tested. `craftMapPotential` raises only the first diary's cap to about 259,046, leaving the other two at cap 0. Forest selection promotes only that first diary. The backend correctly respects the resulting zero caps.

| First diary | Leather | Green | Purple | Total explores |
|---|---:|---:|---:|---:|
| Leather | 259,043 | 0 | 0 | 15,359,628 |
| Green | 0 | 259,010 | 0 | 14,994,343 |
| Purple | 0 | 0 | 258,929 | 14,992,117 |

Root: `web/craft-map-model.js:178` uses a sequential one-pass mutable `proposed` list. Earlier hypothetical diaries consume all shared White Parchment before later potential aims are calculated. `craftMapAddOptions` also treats earlier optional drafts as hard claims. `balanced.py` cannot reverse these decisions because each candidate has an explicit upper bound of zero.

## P0: Optional caps are mistaken for required quantities after sourcing

Forest click turns off `available_only` even while `consumer_mode` stays `available`. `mapComputePreview` then treats every `!g.available_only` cap as a hard required quantity. Balanced sharing below a cap produces shortfalls, disables Apply, and makes `mapRender` discard the solved preview visually. The map reverts to the old base with only the one proposed source edge, so Forest's other real outputs can appear unconnected.

Root: `web/craft-map.js` source handler, preview shortfall condition, and solvedPreview switch. User intent is present as consumer_mode but overridden by the older available_only flag.

## P1: Wooden Bow cannot reclaim optional intermediates

After a mathematically balanced three-diary route, `craftMapAddOptions` says only **4 Wooden Bows** are possible from Wood or Straw. It shows 68,962 missing Fern Leaf for a 100,000-bow proposal. Yet the shared backend can produce 100,000 bows with no additional exploration and unchanged diaries by reducing surplus Green Parchment from 178,627 to 145,294.

Root: candidate estimates operate on the final surplus of previously solved crafts; they never release optional intermediate consumption. They measure append-only feasibility, unlike the global solver, which is allowed to rebalance.

Wooden Bow's actual direct recipe is 1 Fern Leaf + 2 Twine + 2 Iron + 4 Wood; Twine uses Wood and Straw. This cross-branch interaction belongs in acceptance tests.

## Proven viable shared solve

With all three diary aims positive and an explicit existing proportional Mushroom group, current backend returns:

- Highland Hills: 7,895,153 explores.
- Forest: 7,100,104 explores.
- Total: **14,995,257** explores.
- Leather, Green, Purple Diaries: **86,347 each**.
- Optional 100,000 Wooden Bows can be added without changing those diary counts or total explores.

These numbers are a feasible regression witness, not the only acceptable optimizer result. The existing concave utility without exact proportional group also gives all three >82k (86,239 / 82,179 / 90,625). Core solver is capable; the map creates incoherent inputs.

## Test blind spots

- `test_craft_map.cjs` potential test contains only one diary, so it cannot detect sibling starvation or insertion-order dependence.
- `test_map_node_modes.cjs` mocks `craftMapAddOptions` to a constant and maps mostly one consumer; it does not exercise real recipes/shared supplies.
- `test_map_sources.cjs` hand-builds source gaps and checks text only; it does not generate potential demand from a real graph or click a source.
- `test_map_supply.cjs` mocks completed output arrays empty; it therefore never detects valid optional outputs being rejected as shortfalls or hidden solved source edges.
- Backend balanced tests receive already-correct caps/groups. They do not test translating UI actions into those inputs.

## Recommended repair contract

1. Store selected crafts and explicit user intent separately from current calculated craft counts. A currently unavailable Use + Void craft must remain eligible, not gain a hard zero upper bound.
2. Compute all optional potential aims from a common primary supply snapshot, then allocate shared supplies jointly. Never spend one sibling's hypothetical production before computing another's potential.
3. Use one consumer mode for required-vs-optional behavior; treat only user force/limit rules that actually require quantity as hard preview shortfalls. A zero output may need a UI explanation, but must not erase other valid results.
4. Source selections enable route locations and wire every matching visible item output automatically from the resulting flow. Explicit per-item source intent and actual location outputs are different facts; distinguish them.
5. Candidate feasibility must allow the same rebalancing as the final solve, or label a cheap preview as approximate. Do not disable the desired mode solely from append-only leftover calculations.
6. Regression harness should drive actual map handlers/model into the real solver for all six diary orders, source-before/source-after, one-step vs intermediate apply, and adding Wooden Bow last. Assert all diaries positive and reasonably balanced, no phantom missing Forest outputs, conserved stock, and no unexpected optional-to-required changes.
