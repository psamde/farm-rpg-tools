# Global shared-pool prototype — 2026-09-14

**Decision: do not replace the live planner with this objective.** The global
continuous matrix is fast, and solves the Antler feedback example. However,
strictly minimizing each anchor's remaining balance can suppress other wanted
crafts. This experiment makes that failure reproducible instead of hiding it
behind an order-dependent supply snapshot.

No application files, save format, release version, or deployment were changed.

## Model

The main save produces a model with 227 variables and 164 physical balance rows.
Variables represent explores by area, craft counts, retained selected outputs,
and remaining inventory. Every row enforces:

```
starting stock + exploration drops + crafted output
    = recipe inputs + primary goals + selected outputs + remaining inventory
```

Resource Saver, conditional drop tables, free Iron/Nails, craftable exploration
drops, starting stock, and caps on aggregate craft counts are included. All
areas participate simultaneously; later drops are visible to earlier goals.
Non-explorable ingredients must come from stock or the primary plan's already
declared external supply. The experiment does not invent unlimited supplies.

The `net_surplus` objective minimizes each assisted goal's remaining anchor
equivalents in priority order, then explores, then craft counts in priority
order at that exploration cost. An unused crafted intermediate still carries
its embedded ingredient value: turning material into unused bottles cannot
pretend to eliminate it. Earlier assisted outputs count as allocated; outputs
of other goals retain their ingredient value until their turn.

This tests a specific proposal; it is not the app's current credit-flow model.

## Measured results

Single sequential runs on this Windows PC, using the saved fixtures in this
repository. Times below exclude runtime startup, primary-plan computation,
ranked-plan enumeration, rendering, and optional “if first” comparisons. The
browser column is an actual headless Edge Web Worker running Pyodide and HiGHS
WASM. No phone performance claim is implied.

| Case | Native prototype | Edge worker | Expected explores |
| --- | ---: | ---: | ---: |
| Shared save, Net extra exploring off | 0.037 s | 0.263 s | 27,666,154 |
| Net first, Antler, extra exploring on | 0.042 s | 0.235 s | 58,892,635 |
| Net moved last | 0.039 s | 0.222 s | 27,803,492 |
| Net capped at 10,000 | 0.039 s | 0.221 s | 41,267,141 |
| Linked Lantern 90,001 | 0.040 s | 0.222 s | 58,893,289 |
| Aquamarine Ring first | 0.039 s | 0.232 s | 58,892,635 |
| All extra exploring off | 0.024 s | 0.152 s | 18,944,328 |
| Earlier anchored save | 0.036 s | 0.201 s | 27,803,492 |

Explore totals above are displayed rounded down; solver quantities remain
continuous. These are **different objectives**, not equivalent plans whose
smaller explore count proves an improvement.

For the same primary baseline, the live native allocator took 0.461 s with Net
off and 0.467 s with Net on, returning 53,550,834 explores and 6,885 Nets in both
cases. The prototype with Net first returns 17,749.742 expected Net crafts and
an Antler-equivalent residual below 0.00002. It incorporates newly generated
Antlers instead of freezing the original zero supply.

Native and WASM results agreed within two explores and one craft for every
tested output. Native material-balance error was below 1e-9; constraint
violations were below 1e-8. Browser and Node WASM harnesses also verify the
balances and compare outputs with native results.

## Why this is not ready

1. **The objective still gives unwanted results.** Several Diaries and
   Aquamarine Rings become zero. Maintaining the best earlier anchor balance
   can prevent later exploration that introduces more of that anchor. The
   solver is correctly solving the wrong product objective. Moving Net last
   consequently leaves about 129,186 Antler equivalents unallocated.
2. **Expected quantities are continuous.** Simply enabling integer explores
   and craft counts did not finish the main save within a separate 30-second
   wall-clock watchdog. The solver's own 20-second limit is not a sufficient
   wall-clock guard. Small integer test cases pass; a production conversion
   would need rounding/repair with balance checks and bounded runtime.
3. **Crafted anchors are restricted.** Only raw anchors and crafted anchors
   with a single nonfree raw precursor are supported. For example, White
   Parchment is represented in Feather equivalents. This is not an exact model
   of arbitrary multi-ingredient anchor availability.
4. **Priority semantics need more work.** Assisted goals get their anchor
   objectives first. Leftovers-only rows are allocated afterward at fixed total
   explore cost. This does not fully preserve a mixed list's current intended
   priority behavior. Primary reserves are hard, but individual locations may
   change at equal total cost.
5. This prototype solves one route over all allowed areas; it does not impose
   a maximum area count, enumerate ranked plans, schedule Craftworks, or verify
   inventory capacity over a route loop.

## Alternative tested: an explicit explore allowance

`objective_mode='budgeted_crafts'` requires a finite `explore_budget`. It
maximizes assisted craft counts by priority inside that allowance, minimizes
explores, then allocates other leftovers. It deliberately does not use the
ingredient selector as an objective. It is a different interaction model,
not an automatic fix for the existing toggle.

At 53,550,834 explores, it makes 26,740.48 expected Nets; at 60,000,000 explores,
31,687.43. Native solves took about 0.037 seconds and Edge about 0.22 seconds.
The first uncapped goal can consume the whole allowance, so lower priorities
can still get zero. Both runs leave zero unused Glass Bottles. This demonstrates
that a finite budget can prevent unlimited feedback without freezing supply,
but a useful UI would need explicit caps or another agreed balancing policy.

**Recommended next direction:** retain the global continuous physical matrix,
but choose a finite exploration/crafting tradeoff before integrating it. A
budget with target caps, or a bounded set of alternatives showing additional
explores versus additional crafts, is more predictable than promising to use
every last ingredient. Do not interpret these benchmarks as a completed fix.

## Reproduce

From the repository root (use `.venv/Scripts/python.exe` on Windows):

```powershell
python -m unittest experiments.test_global_pool
python -m experiments.benchmark_global
node experiments/benchmark_global_wasm.cjs
# Requires Playwright and Edge; PLAYWRIGHT_MODULE can be an absolute module path.
node experiments/benchmark_global_browser.cjs
```

The benchmark generates ignored fixtures and detailed JSON reports here.
`--skip-integer` skips the expensive integer probe; `--integer-only` runs just
that probe against previously generated fixtures. The external watchdog kills
only its own benchmark child process. The browser harness serves static assets
on an ephemeral localhost port and closes its browser and server afterward.

Tests cover convergent and divergent feedback, later drops feeding an earlier
goal, competing priorities, caps, no-extra behavior, unused intermediate
accounting, bounded exploration, integer toy cases, unchanged inputs, and an
explicit counterexample documenting the zero-surplus objective's failure.
