# Engine allocation check (0.1.85)

Reproduced the saved 163 Langstaff Crest plan with its fixed seven-location
route and 52,464,507 explores. Inputs are in
`experiments/engine-current-payload.json`; the original output is in
`experiments/engine-current-result.json`.

| Allocation | Engines | Corn Oil | Explores |
| --- | ---: | ---: | ---: |
| Current balanced choices | 282 | 15,891 | 52,464,507 |
| Engine alone | 452 | 0 | 52,464,507 |
| Engine requested first, other choices retained | 451 | 79 | 52,464,507 |

The first-priority case requests 452; whole-craft repair returns 451. It is
not proof that 451 is the exact integer optimum with the remaining crafts.

The balanced route supplies 19,154.295 Carbon Spheres and consumes 19,126.207,
leaving 28.088. Attempting one more Engine from the final shared inventory
reports a shortage of 18.119 Carbon Spheres. Large Scrap Wire, Scrap Metal,
Machine Part, and Transistor surpluses cannot replace that missing material.
Corn Oil competes for Carbon Spheres through Machine Press -> Steel Plate.

External raw ingredients now default to automatic supply. Only the amount
consumed by verified whole crafts is included in starting inventory, rounded
up. An explicitly entered inventory amount, including zero, disables automatic
supply for that ingredient. These supplies neither authorize extra exploration
nor act as anchors for self-feeding exploration demand. Pocket Watch remains
an exploration ingredient even when its source is not selected.


Verification: 127 native tests, 13 real-catalog acceptance cases in the shipped
browser WASM solver, and eight JavaScript map/save suites pass. The live map
confirmed Small Gear automatic supply of 135 for 282 Engines; a manual zero
stopped Engine, and restoring automatic supply resumed it. Test edits were
discarded afterward, retaining the user's entered inventory amounts.
