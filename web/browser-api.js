// Static files only: this adapter keeps the UI API while jobs run in a worker.
const browserPlanner=(()=>{
 let bundle,worker=null,active=null,serial=0;const jobs=new Map();
 async function data(){return bundle??=fetch('catalog.json').then(r=>{if(!r.ok)throw Error('Could not load catalog');return r.json();});}
 function cancel(){if(worker){worker.terminate();worker=null;}if(active&&jobs.has(active))jobs.set(active,{status:'error',error:'Superseded by a newer plan.'});active=null;}
 async function api(url,payload){
  if(url==='/api/catalog')return (await data()).metadata;
  if(url.startsWith('/api/item/')){const c=(await data()).catalog,item=c.items[url.split('/').at(-1)];if(!item)throw Error('Item not found');return {item,sources:item.source_ids.map(id=>{const s=c.sources[id];return {...s,location_name:c.locations[s.location_id]?.name};})};}
  if(url.startsWith('/api/consumers/')){const c=(await data()).catalog,ref=url.split('/').at(-1),seen=new Set(),queue=[ref];while(queue.length){const id=queue.pop();for(const parent of Object.keys(c.items[id].used_in||{}))if(!seen.has(parent)){seen.add(parent);queue.push(parent);}}return [...seen].map(id=>({id,name:c.items[id].name,direct:Object.hasOwn(c.items[id].direct_ingredients,ref)})).sort((a,b)=>a.name.localeCompare(b.name));}
  if(url==='/api/plan'){
   if(active)cancel();const id=String(++serial);active=id;jobs.set(id,{status:'queued'});
   while(jobs.size>8)jobs.delete(jobs.keys().next().value);
   if(!worker)worker=new Worker(new URL('python-worker.js',document.baseURI));
   worker.onmessage=({data})=>{if(active!==id)return;jobs.set(id,data);if(data.status==='complete'||data.status==='error')active=null;};
   worker.onerror=e=>{if(active!==id)return;jobs.set(id,{status:'error',error:e.message||'Browser calculation failed.'});active=null;worker?.terminate();worker=null;};
   worker.postMessage(payload);return {job_id:id};
  }
  if(url.startsWith('/api/jobs/'))return jobs.get(url.split('/').at(-1))||{status:'error',error:'Plan was replaced.'};
  throw Error('Unknown local request');
 }
 return {api,cancel};
})();
