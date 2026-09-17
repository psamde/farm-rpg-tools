# Crafting-map repair — v0.1.74

This local repair follows the failures recorded in `CRAFTING_MAP_AUDIT.md`.

## What changed

The map persists recipe intent separately from calculated production. An uncapped Use + Void selection stays active when it currently produces zero. Selecting a source no longer turns estimated production into a forced quantity.

Map requests use a joint allocation model. Forced quantities reserve materials first; optional final recipes share progress, and surplus intermediate crafts use what remains. Adding a new recipe can reclaim materials from surplus intermediates. Exploration is anchored to primary supplies to avoid self-feeding growth, and only explicitly selected sources can add exploration. All outputs from those locations are shared by every recipe.

The graph displays the latest solved preview even when a forced quantity has a shortage. Only unmet forced quantities block Apply. Saving preserves sources, modes, optional upper bounds, and paused-node intent rather than freezing computed outputs.

## Acceptance example

125 Ant Apple, Resource Saver 45%, Runecube and Iron Depot enabled. Add White, Green, and Purple Parchment, then Leather, Green, and Purple Diary, all through Use + Void. Choose Forest for Mushroom. Add Wooden Bow through Fern Leaf's direct recipes.

| Output or location | Calculated quantity |
|---|---:|
| Leather Diary | 86,364 |
| Green Diary | 86,353 |
| Purple Diary | 86,326 |
| Wooden Bow | 194,277 |
| White Parchment, including consumed crafts | 178,651 |
| Green Parchment, including consumed crafts | 113,868 |
| Purple Parchment, including consumed crafts | 178,572 |
| Forest explores | 7,100,109 |
| Highland Hills explores | 7,895,153 |
| Total explores | 14,995,262 |

Adding Bow leaves exploration and diary quantities unchanged. It releases Fern Leaf from surplus Green Parchment and uses Forest's Wood and Straw. These are expected-yield estimates and a balanced feasible allocation, not a claim of a globally optimal integer solution.

## Verification

- All six diary insertion orders produce the same result using the real catalog and solver.
- Sources added before or after recipes, source removal, capped optional recipes, mixed forced/soft consumers, percentage requests, blocked recipes, conservation of materials, preview/apply/reload equivalence.
- The nine acceptance cases pass through both native SciPy and the actual Pyodide/SciPy/HiGHS WASM adapter using built web assets.
- Real map handlers and renderer are tested with nonempty calculation results; save tests verify the persisted intent contract.
- Live browser: added all seven optional recipes through the interface, selected Forest from Mushroom's source list, confirmed that the source comparison mentions Hide, obtained the quantities above, reviewed, applied, saved, and reloaded a named plan on an isolated localhost origin. Counts and source choices survived reload. Removing Forest paused the diaries and Bow; restoring Forest recovered the same result. Removing and re-adding Bow also preserved the result. The user's original tab and draft were not reset.

Live testing also caught three presentation bugs beyond the original audit: background calculations closing the active recipe chooser; candidate shortages based on the old route rather than the current preview; and selected crafted outputs incorrectly displaying zero unused because they were stored as reserved secondary output. Regression coverage was added for these cases.

Final checks passed: 123 Python tests; the built WASM acceptance suite; map model, intent, workflow (11 cases), node-mode, supply, source, save, empty-state, and guided-option JavaScript suites; JavaScript syntax checks and `git diff --check`.

The open recipe chooser stays stable while a background preview finishes. Its existing estimates refresh when reopened or when a custom quantity is edited; adding a recipe always invokes the current solver. This keeps buttons from disappearing beneath the pointer.

## Re-run

```powershell
.\.venv\Scripts\python.exe -m unittest discover -q
.\.venv\Scripts\python.exe build_static.py
node test_map_wasm.cjs
node test_map_intents.cjs
node test_map_workflow.cjs
node test_map_node_modes.cjs
node test_map_supply.cjs
node test_save.cjs
```

No deployment is part of this repair run.
