// Optional real-browser check. Set PLAYWRIGHT_MODULE to a Playwright installation.
const fs=require('fs'), path=require('path'), http=require('http'), assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async()=>{
  const root=path.resolve('web');
  const server=http.createServer((req,res)=>{
    if(req.url==='/'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Isolated solver benchmark</title>');}
    const file=path.resolve(root,'.'+decodeURIComponent(req.url.split('?')[0]));
    if(!file.startsWith(root+path.sep)){res.statusCode=403;return res.end();}
    if(!fs.existsSync(file)||!fs.statSync(file).isFile()){res.statusCode=404;return res.end();}
    res.setHeader('Content-Type',file.endsWith('.wasm')?'application/wasm':file.endsWith('.js')?'application/javascript':'application/octet-stream');
    fs.createReadStream(file).pipe(res);
  });
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  let browser;
  try{
    browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
    const page=await browser.newPage();
    await page.goto('http://127.0.0.1:'+server.address().port);
    const files=Object.fromEntries(['planner.py','secondary.py','wasm_solver.py'].map(n=>[n,fs.readFileSync(n,'utf8')]));
    files['global_pool.py']=fs.readFileSync('experiments/global_pool.py','utf8');
    const inputs={files,catalog:fs.readFileSync('data/catalog.json','utf8'),fixtures:JSON.parse(fs.readFileSync('experiments/fixtures.json','utf8'))};
    const result=await page.evaluate(async inputs=>{
      const origin=location.origin;
      const code=`
importScripts('${origin}/vendor/pyodide/pyodide.js','${origin}/vendor/highs/highs.js');
onmessage=async({data})=>{try{
 const start=performance.now();
 const highs=await Module({locateFile:n=>'${origin}/vendor/highs/'+n});
 const py=await loadPyodide({indexURL:'${origin}/vendor/pyodide/'});
 await py.loadPackage('scipy');
 for(const [n,text] of Object.entries(data.files)) py.FS.writeFile('/home/pyodide/'+n,text);
 py.globals.set('highs_solve',(lp,opts)=>JSON.stringify(highs.solve(lp,JSON.parse(opts))));
 py.globals.set('catalog_json',data.catalog);
 py.runPython('import json\\nfrom wasm_solver import install\\ninstall(highs_solve)\\nfrom global_pool import optimize\\ncatalog=json.loads(catalog_json)');
 const startup_seconds=(performance.now()-start)/1000,results=[];
 for(const f of data.fixtures){
  py.globals.set('fixture_json',JSON.stringify(f));
  results.push({name:f.name,...JSON.parse(py.runPython("f=json.loads(fixture_json)\\njson.dumps(optimize(catalog,f['primary'],f['goals'],f['areas'],**f.get('options',{})))"))});
 }
 postMessage({startup_seconds,results});
}catch(e){postMessage({error:String(e)});}};`;
      const url=URL.createObjectURL(new Blob([code],{type:'application/javascript'}));
      const worker=new Worker(url);
      try{return await new Promise((resolve,reject)=>{
        const timer=setTimeout(()=>reject(Error('Browser benchmark exceeded 60 seconds')),60000);
        worker.onmessage=e=>{clearTimeout(timer);resolve(e.data);};
        worker.onerror=e=>{clearTimeout(timer);reject(Error(e.message));};
        worker.postMessage(inputs);
      });}finally{worker.terminate();URL.revokeObjectURL(url);}
    },inputs);
    assert(!result.error,result.error);
    const native=JSON.parse(fs.readFileSync('experiments/native-results.json','utf8'));
    for(const r of result.results){
      const expected=native.find(x=>x.name===r.name).prototype;
      assert(Math.abs(r.explores-expected.explores)<2,r.name);
      for(const [ref,q] of Object.entries(expected.crafts)) assert(Math.abs(r.crafts[ref]-q)<1,r.name+' '+ref);
      console.log(r.name,r.seconds.toFixed(3)+'s');
    }
    fs.writeFileSync('experiments/browser-results.json',JSON.stringify(result,null,2));
  }finally{if(browser)await browser.close();await new Promise(resolve=>server.close(resolve));}
})().catch(e=>{console.error(e);process.exitCode=1;});
