const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');

(async () => {
  const py = await require('./web/vendor/pyodide/pyodide.js').loadPyodide({indexURL: path.resolve('web/vendor/pyodide')});
  await py.loadPackage('scipy');
  for (const name of ['planner.py', 'secondary.py', 'browser_engine.py', 'wasm_solver.py']) {
    py.FS.writeFile('/home/pyodide/' + name, fs.readFileSync('web/' + name, 'utf8'));
  }
  const highs = await require('./web/vendor/highs/highs.js')();
  py.globals.set('highs_solve', (lp, opts) => JSON.stringify(highs.solve(lp, JSON.parse(opts))));
  py.globals.set('catalog_json', fs.readFileSync('data/catalog.json', 'utf8'));
  py.globals.set('payload_json', fs.readFileSync('test_bottle_plan.json', 'utf8'));
  const result = JSON.parse(py.runPython(`
import json
from wasm_solver import install
install(highs_solve)
from browser_engine import compute
json.dumps(compute(json.loads(catalog_json), json.loads(payload_json), deferred=[]))
`));
  assert(result.plans.length);
  for (const plan of result.plans) {
    assert(plan.optimal_total_explores < 40_000_000);
    assert.equal(plan.targets[0].craft_quantity, 90_000);
    const bottle = plan.item_balances.find(b => b.item_id === '117');
    assert(bottle.consumed_by_crafting > 40_000);
    assert(bottle.expected_unused < 1);
    for (const row of plan.item_balances) {
      const supplied = row.starting_inventory + row.expected_exploration_drops + row.crafted + row.free_perk_supply;
      assert(Math.abs(supplied - row.consumed_by_crafting - row.expected_final_inventory) < 1e-6, row.name);
    }
    console.log('PASS', plan.optimal_total_explores, 'explores;', bottle.crafted, 'bottles crafted;', bottle.expected_unused, 'unused');
  }
})().catch(error => { console.error(error); process.exit(1); });
