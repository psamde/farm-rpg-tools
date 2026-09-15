const fs=require('fs'),path=require('path'),assert=require('node:assert/strict');
(async()=>{
 const py=await require('./web/vendor/pyodide/pyodide.js').loadPyodide({indexURL:path.resolve('web/vendor/pyodide')});
 await py.loadPackage('scipy');
 for(const name of ['planner.py','secondary.py','balanced.py','browser_engine.py','wasm_solver.py'])
  py.FS.writeFile('/home/pyodide/'+name,fs.readFileSync('web/'+name,'utf8'));
 const highs=await require('./web/vendor/highs/highs.js')();
 py.globals.set('highs_solve',(lp,opts)=>JSON.stringify(highs.solve(lp,JSON.parse(opts))));
 py.globals.set('catalog_json',fs.readFileSync('data/catalog.json','utf8'));
 py.globals.set('payload_json',fs.readFileSync('test_purple_bag_plan.json','utf8'));
 const runs=JSON.parse(py.runPython(`
import json
from wasm_solver import install
install(highs_solve)
from browser_engine import compute
catalog=json.loads(catalog_json)
payload=json.loads(payload_json)
runs=[]
for saver,rune in [(0,False),(45,False),(0,True),(45,True)]:
    result=compute(catalog,{**payload,'resource_saver':saver,'runecube':rune},deferred=[])
    p=result['plans'][0]
    for b in p['item_balances']:
        supplied=b['starting_inventory']+b['expected_exploration_drops']+b['crafted']+b['free_perk_supply']
        assert abs(supplied-b['consumed_by_crafting']-b['expected_final_inventory'])<1e-5
    runs.append(dict(saver=saver,rune=rune,explores=p['optimal_total_explores'],
        primary=p['secondary']['primary_explores'],cache=result['performance']['primary_cache_hit'],
        bags=next(t['crafts'] for t in p['secondary']['targets'] if t['item_id']=='539'),
        reference=p['secondary']['exploration_reference_crafts']['539']))
json.dumps(runs)
`));
 for(const r of runs){assert(!r.cache);assert(r.bags>=9990);assert(Math.abs(r.reference-20000*(1+r.saver/100)**2)<1e-5);}
 assert(runs[1].bags>runs[0].bags*2);
 assert.equal(runs[0].primary,runs[1].primary);
 assert.notEqual(runs[0].explores,runs[2].explores);
 console.log('Stored bottles and Resource Saver/Runecube combinations verified:',JSON.stringify(runs));
})().catch(e=>{console.error(e);process.exitCode=1;});
