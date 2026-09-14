// Run from the repository root after python -m experiments.benchmark_global.
const fs = require('fs');
const path = require('path');
const assert = require('node:assert/strict');
(async () => {
  const startup = performance.now();
  const py = await require('../web/vendor/pyodide/pyodide.js').loadPyodide({indexURL:path.resolve('web/vendor/pyodide')});
  await py.loadPackage('scipy');
  for (const name of ['planner.py','secondary.py','wasm_solver.py'])
    py.FS.writeFile('/home/pyodide/'+name,fs.readFileSync(name,'utf8'));
  py.FS.writeFile('/home/pyodide/global_pool.py',fs.readFileSync('experiments/global_pool.py','utf8'));
  const highs = await require('../web/vendor/highs/highs.js')();
  py.globals.set('highs_solve',(lp,opts)=>JSON.stringify(highs.solve(lp,JSON.parse(opts))));
  py.globals.set('catalog_json',fs.readFileSync('data/catalog.json','utf8'));
  py.runPython(`import json
from wasm_solver import install
install(highs_solve)
from global_pool import optimize
catalog = json.loads(catalog_json)`);
  const startupSeconds=(performance.now()-startup)/1000;
  const fixtures=JSON.parse(fs.readFileSync('experiments/fixtures.json','utf8'));
  const native=JSON.parse(fs.readFileSync('experiments/native-results.json','utf8'));
  const results=[];
  for (const f of fixtures) {
    py.globals.set('fixture_json',JSON.stringify(f));
    const t=performance.now();
    try {
      const r=JSON.parse(py.runPython(`f=json.loads(fixture_json)
json.dumps(optimize(catalog,f['primary'],f['goals'],f['areas'],**f.get('options',{})))`));
      const expected=native.find(x=>x.name===f.name).prototype;
      assert(expected,'Native case failed');
      assert(Math.abs(r.explores-expected.explores)<2,`${f.name}: explores disagree`);
      for (const g of f.goals)
        assert(Math.abs(r.crafts[g.item_id]-expected.crafts[g.item_id])<1,`${f.name}: craft ${g.item_id} disagrees`);
      assert(r.balance_error<1e-5);
      assert(r.constraint_violation<1e-5);
      results.push({name:f.name,wall_seconds:(performance.now()-t)/1000,...r});
      console.log(f.name,r.seconds.toFixed(3)+'s',r.explores);
    } catch(e) { results.push({name:f.name,error:String(e)}); process.exitCode=1; }
  }
  fs.writeFileSync('experiments/wasm-results.json',JSON.stringify({startup_seconds:startupSeconds,results},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
