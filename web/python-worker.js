importScripts('vendor/pyodide/pyodide.js','vendor/highs/highs.js','solver-experiments.js');
let runtime,experiments;
async function initialize(){
 const highs=await Module({locateFile:name=>new URL('vendor/highs/'+name,self.location.href).href});
 experiments=solverExperiments(highs);
 const py=await loadPyodide({indexURL:new URL('vendor/pyodide/',self.location.href).href});
 await py.loadPackage('scipy');
 for(const name of ['planner.py','secondary.py','browser_engine.py','wasm_solver.py']){const response=await fetch(name);if(!response.ok)throw Error('Could not load '+name);py.FS.writeFile('/home/pyodide/'+name,await response.text());}
 const response=await fetch('catalog.json');if(!response.ok)throw Error('Could not load catalog');
 py.globals.set('catalog_json',JSON.stringify((await response.json()).catalog));
 py.globals.set('highs_solve',(lp,opts)=>JSON.stringify(experiments.solve(lp,JSON.parse(opts))));
 py.runPython('from wasm_solver import install\ninstall(highs_solve)');
 py.runPython('import json, sys\nsys.path.insert(0, "/home/pyodide")\nfrom browser_engine import compute\ncatalog = json.loads(catalog_json)');
 return py;
}
self.onmessage=async({data})=>{try{
 self.postMessage({status:'running',message:'Loading Python and SciPy in your browser...'});
 const py=await (runtime??=initialize());
 experiments.configure(data.performance);
 py.globals.set('payload_json',JSON.stringify(data));
 let comparing=false;
 py.globals.set('report_progress',(done,total)=>{if(!comparing)self.postMessage({status:'running',done,total,message:'Calculating on your device...'});});
 py.runPython('deferred = []\nplan_result = compute(catalog, json.loads(payload_json), report_progress, deferred)');
 const snapshot=()=>{const result=JSON.parse(py.runPython('json.dumps(plan_result, allow_nan=False)'));result.performance.solver=experiments.stats();return result;};
 self.postMessage({status:'comparisons',result:snapshot()});
 // Suppress primary progress messages while optional comparisons run.
 comparing=true;
 while(py.runPython('len(deferred)')){
  py.runPython('deferred.pop(0)()');
  self.postMessage({status:'comparisons',result:snapshot()});
 }
 self.postMessage({status:'complete',result:snapshot()});
}catch(error){runtime=null;self.postMessage({status:'error',error:error.message});}};
