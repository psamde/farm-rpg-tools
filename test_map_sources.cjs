const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const text=fs.readFileSync('web/craft-map.js','utf8');let placed=false;const host={innerHTML:''};
const source=(location_id,rate)=>({kind:'explore',location_id,location_name:location_id,expected_drops_per_explore:rate});
const ctx=vm.createContext({mapCandidateToken:0,mapInspectorView:null,mapPotential:{graph:{nodes:[{id:"hide",name:"Hide",kind:"item",missing:40}]}},$:id=>id==='mapOptions'?host:id==='mapFindSources'?{after:h=>{placed=h===host;}}:null,state:{areas:['Forest','Cave'],map_sources:{mushroom:['Forest']}},mapGraph:{nodes:[{id:'mushroom',kind:'item',missing:100},{id:'hide',name:'Hide',kind:'item',missing:0}]},mapPlan:{areas:[]},mapPreview:{preview_plan:{areas:[{location_id:'Forest'}]}},catalog:{locations:[{id:'Forest',name:'Forest'},{id:'Cave',name:'Cave'}]},api:async path=>({sources:path.endsWith('mushroom')?[source('Forest',1),source('Cave',2)]:[source('Forest',.5)]}),explorationYieldMultiplier:()=>1,fmt:String,esc:String,itemName:(_,name)=>name});
// Supply the UI's current-view adapter: the base route is empty but the solved
// preview already includes Forest. Its source card must reflect that preview.
vm.runInContext('function mapEstimateInputs(){return {plan:mapPreview?.preview_plan||mapPlan};}',ctx);
vm.runInContext(text.slice(text.indexOf('async function mapSources'),text.indexOf('function mapUnusedText')),ctx);
(async()=>{
 await ctx.mapSources('mushroom');assert(placed,'source list belongs immediately after its trigger');
 assert.match(host.innerHTML,/Hide · Covers this shortage/);assert.match(host.innerHTML,/No other missing ingredients supplied/);
 const cards=[...host.innerHTML.matchAll(/<button class="map-candidate"[^>]*data-map-area="([^"]+)"[^>]*>([\s\S]*?)<\/button>/g)];
 assert.deepEqual(cards.map(m=>m[1]),['Cave','Forest'],'preserve rate ordering for comparison');
 assert.doesNotMatch(cards[0][2],/Hide/,'Cave must not claim Forest-only coverage');assert.match(cards[0][2],/Add this location/);
 assert.match(cards[1][2],/Already in route/);assert.match(cards[1][2],/Hide · Covers this shortage/);assert.match(host.innerHTML,/Remove Forest source/);
 ctx.mapPotential.graph.nodes[0].missing=0;ctx.mapGraph.links=[{from:'hide',to:'leather'}];await ctx.mapSources('mushroom');assert.match(host.innerHTML,/Hide · Also supplies this connected ingredient/);
 ctx.mapPreview=null;await ctx.mapSources('mushroom');assert.match(host.innerHTML,/Selected source/,'a selected but unsolved source must not claim to be in the route');
 console.log('Source placement, sorted comparisons, Hide coverage, and selected-versus-solved route labels passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
