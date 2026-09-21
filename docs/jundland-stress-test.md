# Jundland crafting-map stress test

Version 0.1.82. Primary target: 163 Langstaff Crests; Resource Saver 45%, Iron Depot and Runecube enabled. All seven selected recipes use Use + Void.

Result: all 12 craft-usable Jundland outputs feed positive crafting. Langstaff Crest has no crafting consumer and remains the primary target.

## Bugs found and fixed

- Selecting Coal -> Mount Banon previously added zero exploration when another branch was still missing supplies. Explicit source choices now gather the requested material independently; all location co-products connect to the shared pool.
- Adding Use + Void crafts could increase already selected exploration without asking. Each source choice now records an exploration amount. Adding crafts only reallocates those supplies; another source click explicitly authorizes more travel. The amounts survive save/load and can be removed or restored with Discard draft.
- Fixed-route sharing used theoretical maximum demands, letting a huge Hourglass opportunity starve smaller branches. It now balances achievable crafting shares on the actual route, after honoring forced crafts.
- Source choices now show additional explores and percentage increase before selection.

- Preview completion could move nodes during a click. Node interaction now pauses briefly during recalculation and resumes when the graph settles; scrolling and the inspector remain available.

## Actual browser sequence

1. Reproduce Coal -> Mount Banon with Spool of Copper and Energy Coil.
2. Add Ember Lagoon for Emberstone.
3. Add Spiky Bracelet from Monster Skull; choose Forest for Mushroom and Small Cave for Bone.
4. Add Machine Press from Machine Part, Belt Drive from Pulley, Pear Grease from Prickly Pear, and Hourglass from Sand using Use + Void.
5. Choose Highland Hills for Purple Flower and Whispering Creek for Blue Gel.
6. Review/apply, reload, verify positive counts; remove Mount Banon and confirm dependent crafts stop; discard removal and verify restoration.

## Final route

52,464,507 total explores, compared with 34,988,552 for the primary target alone. These are explicit user-style source choices, not a claim of a globally optimal route.

| Location | Explores |
| --- | ---: |
| Jundland Desert | 34,988,552 |
| Small Cave | 110,791 |
| Whispering Creek | 3,231,339 |
| Highland Hills | 9,941,462 |
| Forest | 590,652 |
| Mount Banon | 511,980 |
| Ember Lagoon | 3,089,731 |

## Crafted outputs

| Item | Crafts |
| --- | ---: |
| Spool of Copper | 18,502 |
| Energy Coil | 9,352 |
| Spiky Bracelet | 2,885 |
| Machine Press | 10,959 |
| Belt Drive | 14,660 |
| Pear Grease | 16,597 |
| Hourglass | 7,439 |

Spool of Copper includes crafts consumed by Energy Coil.

## Jundland materials consumed

Expected quantities are floored below; tests verify the unrounded balances.

| Material | Used in crafting |
| --- | ---: |
| Broken Pipe | 8,800 |
| Copper Wire | 127,600 |
| Machine Part | 45,347 |
| Monster Skull | 11,937 |
| Onyx Scorpion | 23,875 |
| Prickly Pear | 343,386 |
| Pulley | 20,220 |
| Sand | 5,130 |
| Scrap Metal | 105,600 |
| Scrap Wire | 51,597 |
| Small Bolt | 20,849 |
| Transistor | 161,241 |

## Verification

- Native Python suite: 125 tests passed.
- All 11 real-catalog acceptance cases passed in the shipped Pyodide/SciPy/HiGHS WASM runtime.
- JavaScript map, node-mode, source, startup, save, and interaction tests passed.
- Regression asserts that adding successive Use + Void recipes never changes chosen exploration counts, every craft-usable Jundland output has positive consumption, inventories conserve materials, and reload matches preview.
- Reproducible solver input: `experiments/jundland-stress-payload.json`; corresponding results: `experiments/jundland-stress-result.json`.
- Browser named save: `Jundland - all 12 crafting outputs`.


### External ingredients follow-up (0.1.83)

- Corn Oil: Corn stays in Farming even with a required quantity. Its potential
  demand offers an editable From inventory amount; it does not offer exploration.
- Engine: Small Screw and Small Spring stay in Other Sources, including when the
  craft is currently paused by Power Monitor's saved Void/Sell setting.
- A blocked selected downstream recipe no longer demotes its selected inputs
  behind unrelated crafts. Adding Corn Oil without Corn preserves Machine Press
  production (10,959 in the live seven-location example).
- The route stays at 52,464,507 explores. Adding 10,000 Corn as inventory enables
  Corn Oil without authorizing more exploration.
- Verified with 126 native Python tests, 12 acceptance cases in the shipped WASM
  solver, eight map/save JavaScript suites, and the local browser UI.


### Engine blockers follow-up (0.1.84)

- Resuming Power Monitor removes the user's pause; Engine still needs Small
  Screw, Small Spring, Small Gear, and Pocket Watch. The latter is explorable
  in Cane Pole Ridge, which is not in the current seven-location route.
- Zero-output craft inspectors now link to their unsupplied raw ingredients,
  including external supplies and missing exploration sources. Stocked
  intermediates bypass their upstream supply warnings.
- Native and WASM acceptance checks confirm that the three external ingredients
  alone leave Engine at zero; supplying Pocket Watch too enables production
  without adding any exploration. Inventory is never silently invented.
