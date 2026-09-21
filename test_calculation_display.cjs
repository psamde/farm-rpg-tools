const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const source=fs.readFileSync('web/app.js','utf8');
const elements=new Map();
function el(id){if(!elements.has(id))elements.set(id,{textContent:'',classList:{values:new Set(),add(v){this.values.add(v);},remove(v){this.values.delete(v);},contains(v){return this.values.has(v);}}});return elements.get(id);}
const waiting=[],rendered=[],refreshes=[];
const ctx=vm.createContext({$:el,state:{targets:{a:20},provided_targets:{},secondary:[],areas:['forest'],planner_mode:'goals'},revision:0,timer:null,lastSuccess:null,targetSavings:{items:{a:{explores_saved:12}},complete:true},result:{id:'old',plans:[{}]},selected:0,
 targets:refresh=>refreshes.push(refresh),startingSupplyReport:()=>{throw Error('Previous supply report was cleared');},secondaryRows:()=>{throw Error('Previous craft quantities were cleared');},save(){},error(){},window:{dispatchEvent(){}},Event:class{},setTimeout(fn){fn();},clearTimeout(){},activeTargets:()=>ctx.state.targets,inventoryData:()=>({}),restorePlanChoice:()=>0,rememberPlanChoice(){},updateTargetSavings(){},document:{querySelector:()=>null},
 render(){rendered.push(ctx.result.id);},api:async url=>url==='/api/plan'?{job_id:'job'}:new Promise(resolve=>waiting.push(resolve))});
vm.runInContext(source.slice(source.indexOf('async function calculate('),source.indexOf('\nfunction render(')),ctx);
// Keep scheduled recalculation controlled by the test.
const timers=[];ctx.setTimeout=(fn,delay)=>{timers.push(fn);return timers.length;};
vm.runInContext(source.slice(source.indexOf('function changed('),source.indexOf('\nfunction eligibleTarget(')),ctx);
(async()=>{
 vm.runInContext('changed()',ctx);
 assert.equal(ctx.targetSavings.items.a.explores_saved,12);
 assert.equal(ctx.result.id,'old');assert.deepEqual(rendered,[]);
 const obsolete=vm.runInContext('calculate()',ctx);await new Promise(setImmediate);
 ctx.revision++;
 waiting.shift()({status:'complete',result:{id:'obsolete',plans:[{optimal_total_explores:99}]}});
 await obsolete;
 assert.equal(ctx.result.id,'old','an old response arriving after an edit must not replace the last valid plan');
 const fresh=vm.runInContext('calculate()',ctx);await new Promise(setImmediate);
 waiting.shift()({status:'comparisons',result:{id:'new',plans:[{optimal_total_explores:80}],inventory_savings:{items:{},complete:false}}});
 await new Promise(setImmediate);
 assert.deepEqual(rendered,['new']);
 assert.equal(ctx.targetSavings.items.a.explores_saved,12,'unfinished comparisons do not blank existing savings');
 timers.pop()();await new Promise(setImmediate);
 waiting.shift()({status:'complete',result:{id:'new',plans:[{optimal_total_explores:80}],inventory_savings:{items:{a:{explores_saved:8}},complete:true}}});
 await fresh;
 assert.equal(ctx.targetSavings.items.a.explores_saved,8);
 assert.equal(refreshes.filter(Boolean).length,1,'rankings update only on a completed route');
 console.log('Completed results persist through edits, stale responses are ignored, and savings wait for completed comparisons.');
})().catch(e=>{console.error(e);process.exitCode=1;});
