const {loadPyodide}=require('./web/vendor/pyodide/pyodide.js'),fs=require('node:fs'),assert=require('node:assert/strict');
(async()=>{const py=await loadPyodide({indexURL:require('node:path').resolve('web/vendor/pyodide')});await py.loadPackage('scipy');
for(const name of ['planner.py','secondary.py','browser_engine.py','wasm_solver.py'])py.FS.writeFile('/home/pyodide/'+name,fs.readFileSync(name,'utf8'));
const highs=await require('./web/vendor/highs/highs.js')();py.globals.set('highs_solve',(lp,opts)=>JSON.stringify(highs.solve(lp,JSON.parse(opts))));py.runPython('from wasm_solver import install\ninstall(highs_solve)');
py.globals.set('catalog_json',fs.readFileSync('data/catalog.json','utf8'));
py.runPython('import json, sys\nsys.path.insert(0,"/home/pyodide")\nfrom browser_engine import compute\ncatalog=json.loads(catalog_json)');
for(const fixture of JSON.parse(fs.readFileSync('parity-fixtures.json','utf8'))){py.globals.set('payload_json',JSON.stringify(fixture.payload));const got=JSON.parse(py.runPython('json.dumps(compute(catalog,json.loads(payload_json)))'));const expected=fixture.result;
assert.equal(got.plans[0].optimal_total_explores,expected.plans[0].optimal_total_explores);
assert.deepEqual(got.plans[0].secondary?.targets.map(t=>t.crafts),expected.plans[0].secondary?.targets.map(t=>t.crafts));
console.log('PASS',fixture.payload.targets,fixture.payload.planner_mode,got.plans[0].optimal_total_explores);
}
})().catch(e=>{console.error(String(e));process.exit(1)});
