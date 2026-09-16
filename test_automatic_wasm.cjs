const fs=require('fs'),path=require('path');
(async()=>{
 const py=await require('./web/vendor/pyodide/pyodide.js').loadPyodide({indexURL:path.resolve('web/vendor/pyodide')});await py.loadPackage('scipy');
 for(const name of ['planner.py','secondary.py','balanced.py','browser_engine.py','wasm_solver.py','automatic.py','test_automatic.py','test_planner.py','farmdata.py'])py.FS.writeFile('/home/pyodide/'+name,fs.readFileSync(name,'utf8'));
 const highs=await require('./web/vendor/highs/highs.js')();py.globals.set('highs_solve',(lp,opts)=>JSON.stringify(highs.solve(lp,JSON.parse(opts))));
 py.globals.set('catalog_json',fs.readFileSync('data/catalog.json','utf8'));
 console.log(py.runPython(`
from wasm_solver import install
install(highs_solve)
import unittest,json
from test_automatic import AutomaticTests
assert unittest.TextTestRunner().run(unittest.defaultTestLoader.loadTestsFromTestCase(AutomaticTests)).wasSuccessful()
from browser_engine import compute,automatic_compute
c=json.loads(catalog_json)
payload=dict(targets={'754':10000},areas=['explore:'+str(i) for i in range(1,11)]+['explore:13'],iron_depot=True,runecube=True,resource_saver=45,max_extra_locations=1)
r=automatic_compute(c,payload)
for o in r['options']:
    assert len(o['metrics']['new_locations'])<=o['max_extra_locations']
    assert r['plans_checked']<=1000
    applied=compute(c,dict(payload,secondary=o['goals'],automatic_areas=o['areas']))
    p=next(p for p in applied['plans'] if p['area_set_id']==o['plan']['area_set_id'])
    assert p['optimal_total_explores']==o['plan']['optimal_total_explores']
    assert [(g['item_id'],g['crafts']) for g in p.get('secondary',{}).get('targets',[])]==[(g['item_id'],g['crafts']) for g in o['plan'].get('secondary',{}).get('targets',[])]
json.dumps({'plans_checked':r['plans_checked'],'options':[o['metrics'] for o in r['options']]})
`));
})().catch(e=>{console.error(e);process.exitCode=1});
