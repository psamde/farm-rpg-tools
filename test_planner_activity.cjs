const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const {create}=require('./web/planner-activity.js');
let now=0,next=0;const timers=new Map(),views=[];
const clock={now:()=>now,setTimeout(fn,ms){timers.set(++next,{fn,at:now+ms});return next;},clearTimeout(id){timers.delete(id);},setInterval(fn,ms){timers.set(++next,{fn,at:now+ms,interval:ms});return next;},clearInterval(id){timers.delete(id);}};
function advance(ms){const end=now+ms;for(;;){const entry=[...timers].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!entry)break;const [id,t]=entry;now=t.at;if(t.interval)t.at+=t.interval;else timers.delete(id);t.fn();}now=end;}
const ui=create(v=>views.push(v),clock),latest=()=>views.at(-1);
ui.update({id:'fast',status:'queued'});advance(200);ui.update({id:'fast',status:'complete'});advance(1000);
assert.equal(views.length,0,'fast calculations should not flash an indicator');
ui.update({id:'a',status:'queued'});ui.update({id:'a',status:'running',message:'Loading Python and SciPy in your browser…'});advance(400);
assert.equal(latest().title,'Starting calculator…');assert.equal(latest().visible,true);
advance(2000);assert.equal(latest().seconds,2);
ui.update({id:'a',status:'comparisons'});assert.equal(latest().title,'Your plan is ready');assert.equal(latest().state,'busy');
ui.update({id:'a',status:'complete'});assert.equal(latest().state,'done');advance(1200);assert.equal(latest().visible,false);
ui.update({id:'draft',status:'queued',action:'guided'});advance(400);assert.equal(latest().title,'Checking your crafts…');
ui.update({id:'a',status:'error'});assert.equal(latest().state,'busy','obsolete job events cannot overwrite a current preview');
ui.update({id:'draft',status:'cancelled'});assert.equal(latest().visible,false);advance(4000);assert.equal(latest().visible,false);
ui.update({id:'failed',status:'queued'});ui.update({id:'failed',status:'error'});assert.equal(latest().state,'error');advance(4500);assert.equal(latest().visible,false);
ui.update({id:'done',status:'queued'});advance(400);ui.update({id:'done',status:'complete'});
ui.update({id:'new',status:'queued'});advance(1200);assert.equal(latest().visible,true);assert.equal(latest().state,'busy','old completion timers cannot hide a new calculation');
ui.destroy();assert.equal(timers.size,0);

// The real adapter emits one common lifecycle for route jobs and map previews.
const workers=[],events=[];
class Worker{constructor(){workers.push(this);}postMessage(){}terminate(){this.terminated=true;}}
const ctx={Worker,URL,CustomEvent:class{constructor(type,{detail}){this.type=type;this.detail=detail;}},dispatchEvent:e=>events.push(e.detail),document:{baseURI:'http://localhost/',querySelector:()=>({textContent:'vtest'})},fetch:async()=>({ok:true,json:async()=>({metadata:{items:[]}})})};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('web/browser-api.js','utf8')+';globalThis.api=browserPlanner;',ctx);
(async()=>{
 await ctx.api.api('/api/catalog');assert.deepEqual(events.map(e=>e.status),['queued','complete']);
 await ctx.api.api('/api/plan',{action:'guided'});assert.equal(events.at(-1).action,'guided');
 const old=workers[0].onmessage;
 await ctx.api.api('/api/plan',{});assert.equal(events.at(-2).status,'cancelled');
 old({data:{status:'complete'}});assert.equal(events.at(-1).status,'queued');
 workers[1].onmessage({data:{status:'comparisons',result:{large:'payload'}}});assert.equal(events.at(-1).status,'comparisons');assert.equal(events.at(-1).result,undefined);
 workers[1].onerror({message:'failed'});assert.equal(events.at(-1).status,'error');assert.equal(workers[1].terminated,true);
 console.log('Activity timing, startup, map previews, background estimates, cancellation, replacement and errors passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
