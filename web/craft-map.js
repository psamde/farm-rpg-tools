/* Desktop-first map UI; the existing planner remains the authority for quantities. */
const craftMap=document.createElement('section');craftMap.id='craftMap';craftMap.className='panel craft-map';
craftMap.innerHTML=`<div class="map-header"><div><p class="eyebrow">FOLLOW THE MATERIALS</p><h2>Crafting map</h2></div><label>Tower level <input id="mapTower" type="number" min="0" max="10000" step="1" value="0"></label><button id="mapReviewTop" class="primary" disabled>Review &amp; apply changes</button><button id="mapNext" type="button">Next warning</button><button id="mapExpand" type="button">Expand map</button><button id="mapZoomOut" type="button" aria-label="Zoom out">−</button><button id="mapZoomIn" type="button" aria-label="Zoom in">+</button></div><div class="map-intro"><span>Click an item to use it. Add supplies where needed, then review your changes.</span><details class="map-help"><summary>Help</summary><p>Sources are on the left; your goals are on the right. Use + on an item to find recipes. Expand a location to see its unused drops.</p><p>Missing supplies appear at the top. Choose a source or bring the ingredients yourself. Changes stay in draft until you apply them.</p><p>Use + and − to zoom, and scroll to move around. Leave Unused and Void/Sell pause connected optional crafts. Your primary goals stay protected.</p></details></div><div class="map-display-settings"><span id="mapUnusedLabel">Unused items to show</span><div id="mapUnusedMode" class="modebuttons" role="group" aria-labelledby="mapUnusedLabel"><button type="button" data-unused-mode="all" aria-pressed="false">All</button><button type="button" data-unused-mode="top" aria-pressed="true">Top X</button><button type="button" data-unused-mode="none" aria-pressed="false">None</button></div><input id="mapUnusedCount" type="number" min="1" max="1000" step="1" value="6" aria-label="Number of top unused items"><span class="hint">Across the route. Expand a location for its other unused crafting materials. Needed ingredients stay visible.</span></div><div class="map-legend"><span class="legend-fulfilled">Fully used / goal met</span><span class="legend-unused">Items left to use</span><span class="legend-pending">Missing supplies / proposed craft</span></div><div class="map-workspace"><div id="mapViewport" class="map-viewport" tabindex="0" aria-label="Crafting graph"><div id="mapStage" class="map-stage"><div id="mapCanvas" class="map-canvas"><div id="mapLanes"></div><svg id="mapEdges" aria-hidden="true"></svg><div id="mapNodes"></div></div></div></div><aside id="mapInspector" class="map-inspector" aria-label="Selected item details"></aside></div><div class="map-footer"><span id="mapSummary" role="status"></span><span id="mapPending"></span><button id="mapPreview" type="button" class="primary" disabled>Review &amp; apply changes</button><button id="mapDiscard" type="button" disabled>Discard draft</button></div><dialog id="mapReviewDialog" aria-labelledby="mapReviewTitle"><div class="sectiontitle"><h2 id="mapReviewTitle">Review changes</h2><button id="mapCloseReview" type="button" aria-label="Close review">Close</button></div><p id="mapReviewStatus" role="status"></p><div id="mapPreviewResult" class="map-preview" hidden></div></dialog>`;
$('routePanel').after(craftMap);
let mapInspectDraft=null;
let mapPotential=null;
let mapInspectorView=null;
$('mapCloseReview').onclick=()=>$('mapReviewDialog').close();
let mapLaneSignature="";
let mapGraph=null,mapPlan=null,mapDrafts=[],mapExtraAreas=new Set(),mapExpanded=new Set(),mapPositions={},mapSelected=null,mapScale=1,mapJob=0,mapRevision=0,mapPreview=null,mapVisit=new Set(),mapProposedLinks=[],mapCandidateToken=0;
let mapOriginal=null;let mapExcludedAreas=new Set();let mapPreviewTimer=null;
function mapBeginEdit(){if(!mapOriginal)mapOriginal=JSON.parse(JSON.stringify({secondary:state.secondary,map_planning:state.map_planning,map_sources:state.map_sources,map_source_explores:state.map_source_explores,map_node_usage:state.map_node_usage,map_hidden:state.map_hidden,map_voided:state.map_voided,map_use_void:state.map_use_void,inventory:state.inventory,passive_inventory:state.passive_inventory}));}
function mapChangeCount(){return mapDrafts.length+(mapOriginal?1:0);}
function mapGoals(){return [...new Map([...state.secondary,...mapDrafts].map(g=>[g.item_id,g])).values()];}
function mapGoalIntent(g,applyBlocks=true){return craftMapGoalIntent(items,state,g,applyBlocks);}
function mapRequestGoals(){return mapGoals().map(g=>mapGoalIntent(g));}
function mapEstimateInputs(){
 // A solved draft is already reflected in its balances. Carry the full user
 // intent so the model can restore and share that pool, without adding the
 // same draft production to the solved result a second time.
 return {plan:mapPreview?.preview_plan||mapPlan,settings:{...state,secondary:mapRequestGoals()},drafts:[]};
}
function mapCraftAddOptions(id,focus){const {plan,settings,drafts}=mapEstimateInputs();return craftMapAddOptions(items,plan,settings,drafts,id,focus);}
function mapCraftGaps(id,count){const {plan,settings,drafts}=mapEstimateInputs();return craftMapCandidateGaps(items,plan,settings,drafts,id,count);}
function mapQueuePreview(){clearTimeout(mapPreviewTimer);if(mapChangeCount()&&!mapBusy())$('mapNodes').inert=true;mapPreviewTimer=setTimeout(()=>{if(mapChangeCount()&&!mapBusy())mapComputePreview(false);},350);}
function mapHasCrafts(id){return Object.values(items).some(item=>Object.hasOwn(item.direct_ingredients||{},id));}
function mapCount(q){return fmt(Math.floor(q||0));}
function mapCurrent(){return result?.plans?.[selected];}
function mapBusy(){return $('status').classList.contains('loading')||$('resultContent').classList.contains('stale');}
function mapChanged(){clearTimeout(mapPreviewTimer);$('mapNodes').inert=false;mapJob++;if(mapPreviewRunning){browserPlanner.cancel();mapPreviewRunning=false;}mapPreview=null;$('mapPreviewResult').hidden=true;mapRender();}
function mapRender(){
 const p=mapCurrent();if(!p){craftMap.hidden=true;return;}craftMap.hidden=false;
 if(mapPlan!==p){$('mapNodes').inert=false;mapOriginal=null;mapExcludedAreas.clear();mapPlan=p;mapDrafts=[];mapInspectDraft=null;mapExtraAreas.clear();mapProposedLinks=[];mapPreview=null;$('mapPreviewResult').hidden=true;}
 $('mapTower').value=state.tower_level||0;$('mapUnusedMode').querySelectorAll('[data-unused-mode]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.unusedMode===(state.map_unused_mode||'top'))));$('mapUnusedCount').value=state.map_unused_count??6;$('mapUnusedCount').hidden=(state.map_unused_mode||'top')!=='top';
 const solvedPreview=Boolean(mapPreview?.preview_plan);let shown=solvedPreview?mapPreview.preview_plan:p;
 if(!solvedPreview&&mapOriginal){
  const key=state.planner_mode==='passive'?'passive_inventory':'inventory',before=JSON.parse(mapOriginal[key]||'{}'),after=inventoryData();
  shown=JSON.parse(JSON.stringify(p));
  for(const [id,q] of Object.entries(after)){const extra=q-(before[id]||0);if(extra<=0)continue;let b=shown.item_balances.find(b=>b.item_id===id);if(!b){b={item_id:id,expected_unused:0,starting_inventory:0,crafted:0};shown.item_balances.push(b);}b.expected_unused=(b.expected_unused||0)+extra;b.starting_inventory=(b.starting_inventory||0)+extra;}
 }
 mapGraph=buildCraftMap(items,shown,{...state,secondary:mapGoals(),map_use_void:state.map_use_void},[...(solvedPreview?[]:mapDrafts),...(mapInspectDraft?[mapInspectDraft]:[])],[...mapExpanded]);
 mapPotential=craftMapPotential(items,shown,state,mapRequestGoals());
 const exactPotential=mapPreview?.preview_plan?.map_potential||mapPreview?.map_potential||shown.map_potential;
 if(exactPotential){mapPotential.goals=exactPotential.goals||[];}
 for(const node of mapGraph.nodes){const possible=mapPotential.graph.nodes.find(n=>n.id===node.id);const exact=exactPotential?.missing?.find(r=>r.item_id===node.id);node.potentialDemand=node.free||node.autoSupply?0:exactPotential?(exact?.quantity||0):Math.max(0,(possible?.need||0)-(node.need||0));node.potentialMissing=node.free||node.autoSupply?0:exactPotential?(exact?.quantity||0):Math.max(0,(possible?.missing||0)-(node.missing||0));}
 if(exactPotential)mapPotential.graph={...mapPotential.graph,nodes:mapGraph.nodes.map(n=>({...n,missing:n.potentialMissing}))};
 for(const draft of mapDrafts){const node=mapGraph.nodes.find(n=>n.id===draft.item_id);if(node&&solvedPreview&&draft.consumer_mode==='fixed')node.previewAim=draft.cap;}
 const activeGoals=[...state.secondary,...mapDrafts,...(mapInspectDraft?[mapInspectDraft]:[])];
 mapGraph.nodes=mapGraph.nodes.filter(n=>n.protected||n.explorationSupplied||!state.map_hidden.includes(n.id)||craftMapDependents(items,activeGoals,n.id).length);
 const visibleIds=new Set(mapGraph.nodes.map(n=>n.id));mapGraph.links=mapGraph.links.filter(l=>visibleIds.has(l.from)&&visibleIds.has(l.to));
 for(const id of mapExtraAreas){const area=catalog.locations.find(a=>a.id===id);if(!area||shown.areas.some(a=>a.location_id===id))continue;mapGraph.nodes.push({id:'area:'+id,location:id,kind:'area',name:area.name,depth:0,proposed:true,explores:0,outputs:[]});}
 for(const link of solvedPreview?[]:mapProposedLinks)if(mapGraph.nodes.some(n=>n.id===link.to))mapGraph.links.push(link);
 const layout=laneLayoutCraftMap(mapGraph.nodes,mapGraph.links,items,explorationMenuOrder);
 const signature=JSON.stringify([mapGraph.nodes.map(n=>[n.id,n.depth]),layout.assignments]);
 if(signature!==mapLaneSignature||!Object.keys(mapPositions).length){mapPositions=layout.positions;mapLaneSignature=signature;}
 $('mapLanes').innerHTML=layout.lanes.map(l=>`<div class="map-lane" style="top:${l.y}px;height:${l.height}px"><span>${esc(l.name)}</span></div>`).join('');
 const width=Math.max(1000,...mapGraph.nodes.map(n=>mapPositions[n.id].x+240)),height=Math.max(570,layout.height,...mapGraph.nodes.map(n=>mapPositions[n.id].y+126));
 $('mapCanvas').style.width=width+'px';$('mapCanvas').style.height=height+'px';$('mapEdges').setAttribute('width',width);$('mapEdges').setAttribute('height',height);
 $('mapNodes').innerHTML=mapGraph.nodes.map(n=>{
  const pos=mapPositions[n.id],area=catalog.locations.find(a=>a.id===n.location);
  const icon=n.kind==='item'?itemIcon(n.id):area?.image?`<img class="gameicon" src="${esc(area.image.startsWith('/')?'https://farmrpg.com'+area.image:area.image)}" alt="">`:'<span class="map-source-icon">⌖</span>';
  const label=n.kind==='item'?`${icon}<span>${esc(n.name)}</span>${mmBadge(n.id)}`:`${icon}<span>${esc(n.name)}</span>`;
  const badges=craftMapNodeLabels(n,mapGraph.nodes,mapGraph.links);const choice=state.map_node_usage?.[n.id];if(choice?.mode==='force')badges.mode='Force Use All';if(choice?.mode==='limit')badges.mode='Use up to '+mapCount(choice.amount);
  const role=n.primary?'PRIMARY GOAL':n.draft?'PROPOSED CRAFT':n.secondary?'LEFTOVER CRAFT':n.missing>=10?'MISSING INGREDIENT':n.kind==='area'?(n.proposed?'PROPOSED LOCATION':'EXPLORATION'):n.kind==='inventory'?'SUPPLIES':n.free?'FREE WITH PERK':n.draftCrafts?'INTERMEDIATE NEEDED':'INGREDIENT';
  const pausedBy=n.kind==='item'&&n.crafts<1?craftMapBlockingInputs(items,state,n.id):[];
  const detail=n.kind==='area'?(n.proposed?'Preview to calculate explores':mapCount(n.explores)+' explores'):n.kind==='inventory'?'Inventory and free perk supplies':n.free?'Unlimited':n.previewAim!=null?mapCount(n.crafts)+' / '+mapCount(n.previewAim)+' crafts':n.missing>=10?'':n.primary?mapCount(state.targets[n.id])+' wanted':n.draft?(solvedPreview?mapCount(n.crafts)+' crafts':mapDrafts.find(g=>g.item_id===n.id)?.consumer_mode==='available'?'Use + Void · calculating':mapCount(n.draftCrafts)+' craft aim'):n.draftCrafts?mapCount(n.draftCrafts)+' more crafts needed':n.secondary&&n.crafts<1?(pausedBy.length?'0 crafts · blocked by '+pausedBy.map(id=>items[id].name).join(', '):'0 crafts · supplies needed'):n.crafts?mapCount(n.crafts)+' crafts · '+mapUnusedText(n):mapUnusedText(n);
  return `<article class="map-node ${n.kind} usage-${craftMapUsage(n)} ${n.primary?'goal':''} ${n.draft||n.warningBlocked||n.missing>=10||n.proposed?'phantom':''} ${mapSelected===n.id?'selected':''}" tabindex="0" aria-label="Inspect ${esc(n.name)}" data-map-node="${esc(n.id)}" style="left:${pos.x}px;top:${pos.y}px"><div class="map-node-handle"><span class="map-required-label ${badges.requirement==='REQUIRED NODE'?'required':'optional'}">${badges.requirement}</span><small>${role}</small></div><button class="map-node-label" data-map-open="${esc(n.id)}">${label}</button>${detail?`<p>${detail}</p>`:""}${n.potentialDemand>=10?`<p>Potential demand: ${mapCount(Math.ceil(n.potentialDemand))}</p>`:""}${n.missing>=10?`<button class="map-gap" data-map-gap="${esc(n.id)}" aria-label="Show missing ${esc(n.name)}">⚠ ${mapCount(Math.ceil(n.missing))} missing</button>`:""}${badges.mode?`<div class="map-choice-label">${badges.mode}</div>`:""}${n.kind==='area'&&!n.proposed?`<button class="map-area-toggle" data-map-toggle-area="${esc(n.location)}" aria-expanded="${(state.map_expanded_areas||[]).includes(n.location)}">${(state.map_expanded_areas||[]).includes(n.location)?'− Collapse extra items':'+ Show all unused'}</button>`:''}${n.kind==='item'&&mapHasCrafts(n.id)?`<button class="map-port" data-map-port="${esc(n.id)}" aria-label="Choose a craft using ${esc(n.name)}" title="Choose a craft">+</button>`:''}</article>`;
 }).join('');
 $('mapNodes').querySelectorAll('[data-item-info]').forEach(el=>{el.removeAttribute('data-item-info');if(el.tagName==='IMG')el.draggable=false;});mapDrawEdges();mapZoom(mapScale);
 $('mapSummary').textContent=`${mapPreview?.preview_plan?'Preview: ':''}${mapCount(shown.optimal_total_explores)} explores · ${shown.areas.length} locations · ${mapGraph.nodes.filter(n=>n.primary).length} primary goals`;
 $('mapPending').textContent=mapChangeCount()?`${mapChangeCount()} changes not applied · ${visibleCraftMapGaps(Object.entries(mapGraph.missing)).length} missing materials`:'';
 $('mapPreview').disabled=!mapChangeCount()||mapBusy();$('mapDiscard').disabled=!mapChangeCount()&&!mapInspectDraft;$('mapReviewTop').disabled=$('mapPreview').disabled;$('mapReviewTop').textContent=mapChangeCount()?'Review & apply '+mapChangeCount()+' changes':'Review & apply changes';
 if(!mapSelected)$('mapInspector').innerHTML='<h3>Put your leftovers to work</h3><p>Click an item to see your options. Next warning takes you to missing supplies.</p>';
}
function mapDrawEdges(){
 if(!mapGraph)return;const curves=mapGraph.links.filter(l=>mapPositions[l.from]&&mapPositions[l.to]);
 $('mapEdges').innerHTML='<defs><marker id="mapArrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="currentColor"/></marker></defs>'+curves.map(l=>{const a=mapPositions[l.from],b=mapPositions[l.to],x=a.x+206,y=a.y+60,end=b.x,ey=b.y+60,mid=(x+end)/2;return `<path class="${l.phantom?'pending':''}" d="M${x},${y} C${mid},${y} ${mid},${ey} ${end},${ey}" marker-end="url(#mapArrow)"><title>${l.quantity>0?mapCount(l.quantity)+' items':'Recipe connection — no current consumption'}</title></path>`;}).join('');
}
function mapSelect(id,{preserveOptions=false}={}){
 // Preview completion may occur while someone is filtering or expanding a
 // recipe. Keep that live subtree (and any request filling it) intact, while
 // refreshing the selected item's quantities and controls around it.
 const view=preserveOptions&&mapInspectorView?.id===id?mapInspectorView:null;
 const options=view?$('mapOptions'):null;
 mapSelected=id;if(!view){mapCandidateToken++;mapInspectorView=null;}mapRender();const n=mapGraph.nodes.find(n=>n.id===id);if(!n)return;
 if(n.kind==='area'){const outputs=n.outputs||[];$('mapInspector').innerHTML=`<h3>${esc(n.name)}</h3><p>${n.proposed?'Proposed extra source. The solver will calculate the amount.':mapCount(n.explores)+' expected explores'}</p><p class="hint">Show an output to connect it to this location. Each item appears only once in the map.</p>${outputs.sort((a,b)=>b.expected_drops-a.expected_drops).map(o=>`<button class="map-output" data-map-reveal="${esc(o.item_id)}">${itemName(o.item_id,items[o.item_id]?.name||o.item_id)}<strong>${mapCount(o.expected_drops)}</strong></button>`).join('')}`;return;}
 if(n.kind==='inventory'){$('mapInspector').innerHTML='<h3>Starting supplies</h3><p>These come from Starting inventory, passive production, or free perk supplies. Change their amounts in the existing input controls.</p>';return;}
 const opportunity=towerOpportunity(id,state.tower_level||0,globalThis.TOWER_MM),draft=mapDrafts.find(g=>g.item_id===id),applied=state.secondary.find(g=>g.item_id===id);
 const pausedBy=n.crafts<1?craftMapBlockingInputs(items,state,id):[];
 const consumers=mapGoals().filter(g=>craftMapDependents(items,[g],id).length&&g.item_id!==id);
 const inventoryNeed=craftMapInventoryNeed(n,items[id]);
 const externalSupply=!!n.externalSource&&!items[id]?.explorable,enteredSupply=inventoryData();
 const missingInputs=n.crafts<1&&items[id]?.craftable?craftMapMissingInputs(items,mapGraph.nodes,id):[];
 $('mapInspector').innerHTML=`<h3>${itemName(id,n.name)}</h3>${opportunity?`<p class="map-tower-note">${opportunity.type} · Tower ${opportunity.level} · ${opportunity.level>(state.tower_level||0)?opportunity.level-(state.tower_level||0)+' levels ahead':'Earlier requirement'}</p>`:''}<p>${n.free?'Unlimited perk supply':n.crafts<1&&(n.secondary||n.draft)?'0 crafts':mapUnusedText(n)}${n.need?` · ${mapCount(Math.ceil(n.need))} needed by proposed crafts`:''}</p>${mapChangeCount()?'<p class="map-draft-note">Changes aren’t applied yet. Review them when you’re ready.</p>':''}${pausedBy.length?`<div class="map-gap-list">${pausedBy.map(ref=>`<button data-map-jump="${ref}">${itemName(ref,items[ref].name)} is set to ${state.map_node_usage[ref].mode==='void'?'Void/Sell':'Leave Unused'} →</button>`).join('')}</div>`:''}${missingInputs.length?`<div class="map-gap-list"><p>Missing supplies</p>${missingInputs.map(ref=>`<button data-map-jump="${ref}">${itemName(ref,items[ref].name)} <small>${craftMapExternalSource(items[ref])?'Adjust supplies':'Choose a source'}</small> &rarr;</button>`).join('')}<p class="hint">Select an ingredient to adjust its supplies or choose an exploration source.</p></div>`:''}${mapInspectDraft?`<div class="map-gap-list">${mapCraftGaps(mapInspectDraft.item_id,mapInspectDraft.cap).filter(([,q])=>q>=10).map(([ref,q])=>`<button class="map-gap" data-map-jump="${ref}">⚠ ${mapCount(Math.ceil(q))} ${esc(items[ref].name)} missing →</button>`).join('')}</div><p class="map-draft-note">Checking ${esc(items[mapInspectDraft.item_id].name)}; not added yet.</p><button data-map-add="${mapInspectDraft.item_id}" data-map-quantity="${mapInspectDraft.cap}" data-map-custom="${!!mapInspectDraft.automatic_supply}">Add this craft to draft</button>`:''}${draft&&draft.consumer_mode!=='available'?`<label>Required crafts <input id="mapDraftQuantity" type="number" min="0" max="100000000" step="1" value="${draft.cap}"></label>${draft.cap===0?'<p class="hint">Recipe added at 0 crafts. Set a quantity to see which supplies it needs.</p>':''}`:''}${applied&&!draft&&applied.consumer_mode!=='available'?`<label>Required crafts <input id="mapAppliedCap" type="number" min="0" max="100000000" step="1" placeholder="No cap" value="${applied.cap??''}"></label>${n.crafts<1?'<p class="map-gap">Not enough supplies to craft this yet. Dashed links show its ingredients.</p>':''}`:''}${n.potentialDemand>=10?`<div class="map-potential"><p>Potential demand: <strong>${mapCount(Math.ceil(n.potentialDemand))}</strong></p>${items[id]?.explorable?'<button id="mapMeetPotential">Meet potential demand</button><p class="hint">Choose a source to cover this gap. Exploration only increases when you choose it.</p>':'<p class="hint">Bring supplies from outside exploration to cover this gap.</p>'}</div>`:''}${items[id]?.craftable&&items[id]?.explorable&&!n.primary?'<div class="map-supply-choice"><p>This ingredient can be crafted or collected directly.</p><button id="mapExploreInstead">Explore for this ingredient</button><p class="hint">Choose a location to compare direct drops with crafting its ingredients.</p></div>':''}${externalSupply?`<div class="map-inventory-supply"><label for="mapExternalAmount">Supplied amount</label><input id="mapExternalAmount" type="number" min="0" max="1000000000000" step="1" value="${enteredSupply[id]??Math.ceil(n.automaticAmount||0)}"><button id="mapSetExternal" type="button">Set amount</button><button id="mapAutoExternal" type="button" ${n.autoSupply?'disabled':''}>Use required amount</button><small>${n.autoSupply?'Automatically provided from outside exploration. Set an amount to limit it.':'Your amount is a limit. Set zero to stop supplying this ingredient.'}</small></div>`:''}${!externalSupply&&inventoryNeed?`<div class="map-inventory-supply"><label for="mapInventoryAmount">Bring from inventory</label><input id="mapInventoryAmount" type="number" min="1" max="1000000000000" step="1" value="${inventoryNeed}"><button id="mapFromInventory" type="button">From inventory</button><small>${n.externalSource?'Not found by exploring. ':''}Adds this amount to starting supplies.</small></div>`:''}${n.missing>=10?`<div class="map-gap">⚠ ${mapCount(Math.ceil(n.missing))} ${esc(n.name)} missing</div><p class="hint">${items[id]?.explorable?'Choose an exploration source or bring supplies from inventory.':'Bring supplies from inventory to cover this gap.'}</p>`:''}${!n.free&&consumers.length?`<div class="map-demand-share"><label>Meet potential demand <input id="mapDemandPercent" type="number" min="0" max="100" step="1" value="${consumers.find(g=>g.demand_group===id)?.demand_percent??100}">%</label><button id="mapSetDemand">Share across connected crafts</button><p class="hint">Use + Void crafts share proportionally. Forced quantities and limits keep their own aims.</p></div>`:''}${!n.free&&items[id]?.explorable?'<button id="mapFindSources" class="primary">Find exploration sources</button>':''}${mapHasCrafts(id)?'<button id="mapFindCrafts" class="primary">Choose a craft using this</button>':'<p class="hint">No further crafts use this item.</p>'}${n.explorationSupplied?'<p class="hint">Your route collects this item. Use Void/Sell if you don’t need the surplus.</p>':n.protected?'<p class="hint">Needed for your target. Change the target to remove it.</p>':`<button id="mapDeleteNode">Delete node</button>`}<div class="map-node-modes" aria-label="How to use this item"><button id="mapLeaveUnused" aria-pressed="${!n.useVoid&&!n.voided&&!['force','limit'].includes(state.map_node_usage?.[id]?.mode)}">Leave Unused</button><button id="mapRawUseVoid" ${consumers.length?'':'disabled'} aria-pressed="${n.useVoid&&!n.voided}">Use + Void</button><button id="mapRawForce" aria-pressed="${state.map_node_usage?.[id]?.mode==='force'}" ${consumers.length?'':'disabled'}>Force Use All</button><button id="mapLimitToggle" aria-pressed="${state.map_node_usage?.[id]?.mode==='limit'}" ${consumers.length?'':'disabled'} aria-expanded="false" aria-controls="mapLimitControls">Limit uses</button><div id="mapLimitControls" hidden><label>Maximum ${esc(n.name)} to use<input id="mapRawLimit" type="number" min="0" max="1000000000000" value="${state.map_node_usage?.[id]?.amount??10000}"></label><button id="mapRawSetLimit">Apply limit</button></div><button id="mapVoidNode" aria-pressed="${!!n.voided}">Void/Sell</button>${state.map_node_usage?.[id]?.mode==='force'?'<p class="hint">Prioritizes using this item. Current supplies and craft limits still apply; other crafts may get less.</p>':''}${consumers.length?'':'<p class="hint">Connect a craft to enable Use + Void, Force Use All, and Limit uses.</p>'}<p class="hint">Leave Unused and Void/Sell set connected optional crafts to zero. Primary goals stay protected.</p></div><div id="mapOptions"></div>`;
 function finishUsageChange(){
  mapChanged();mapSelect(id);
  // Applied quantities belong to the old solved plan. Replace them through the solver.
  mapQueuePreview();
 }
 function setSurplusMode(mode){
  mapBeginEdit();state.map_node_usage??={};state.map_node_usage[id]={mode};
  for(const g of mapDrafts)if(g.void_source===id)g.void_source=null;
  state.map_use_void=state.map_use_void.filter(ref=>ref!==id);
  state.map_voided=state.map_voided.filter(ref=>ref!==id);
  if(mode==='use')state.map_use_void.push(id);
  if(mode==='void')state.map_voided.push(id);
  finishUsageChange();
 }
 if($('mapLeaveUnused'))$('mapLeaveUnused').onclick=()=>setSurplusMode('unused');
 if($('mapRawUseVoid'))$('mapRawUseVoid').onclick=()=>setSurplusMode('use');
 function setRawUsage(force){
  const amount=Number($('mapRawLimit').value);if(!force&&(!Number.isFinite(amount)||amount<0||amount>1e12))return;
  if(!consumers.length)return;
  mapBeginEdit();state.map_planning=true;state.map_node_usage??={};state.map_node_usage[id]={mode:force?'force':'limit',amount:force?null:amount};
  // Keep each consumer's own mode and cap. The solver applies the material's
  // objective/limit across all direct consumption edges in the shared pool.
  state.map_use_void=state.map_use_void.filter(ref=>ref!==id);state.map_voided=state.map_voided.filter(ref=>ref!==id);
  finishUsageChange();
 }
 if($('mapRawForce'))$('mapRawForce').onclick=()=>setRawUsage(true);
 if($('mapRawSetLimit'))$('mapRawSetLimit').onclick=()=>setRawUsage(false);
 if($('mapSetDemand'))$('mapSetDemand').onclick=()=>{
  const percent=Number($('mapDemandPercent').value);if(!Number.isFinite(percent)||percent<0||percent>100)return;
  const goals=craftMapDemandAllocation(items,consumers,mapPotential?.goals||[],id,percent);
  if(!goals.length){$('mapOptions').textContent='Add supplies for another ingredient first so potential demand can be estimated.';return;}
  mapBeginEdit();for(const goal of goals){state.secondary=state.secondary.filter(g=>g.item_id!==goal.item_id);mapDrafts=mapDrafts.filter(g=>g.item_id!==goal.item_id);mapDrafts.push(goal);}
  mapChanged();mapSelect(id);mapQueuePreview();if(items[id]?.explorable)mapSources(id);
 };
 if($('mapExploreInstead'))$('mapExploreInstead').onclick=()=>mapSources(id);
 if($('mapMeetPotential'))$('mapMeetPotential').onclick=()=>mapSources(id);
 function setExternalSupply(amount){
  if(amount!==null&&(!Number.isInteger(amount)||amount<0||amount>1e12))return;
  mapBeginEdit();const stock=inventoryData();
  if(amount===null)delete stock[id];else stock[id]=amount;
  setInventory(stock);inventoryRows();mapChanged();mapSelect(id);mapQueuePreview();
 }
 if($('mapSetExternal'))$('mapSetExternal').onclick=()=>setExternalSupply(Number($('mapExternalAmount').value));
 if($('mapAutoExternal'))$('mapAutoExternal').onclick=()=>setExternalSupply(null);
 if($('mapFromInventory'))$('mapFromInventory').onclick=()=>{const q=Number($('mapInventoryAmount').value);if(!Number.isInteger(q)||q<1||q>1e12)return;mapBeginEdit();if(mapInspectDraft&&!mapDrafts.some(g=>g.item_id===mapInspectDraft.item_id)){mapDrafts.push({...mapInspectDraft,automatic_batch:true});mapInspectDraft=null;}const stock=inventoryData();stock[id]=(stock[id]||0)+q;setInventory(stock);inventoryRows();mapChanged();mapSelect(id);mapQueuePreview();};
 if($('mapFindCrafts'))$('mapFindCrafts').onclick=()=>mapConsumers(id);if($('mapFindSources'))$('mapFindSources').onclick=()=>mapSources(id);
 $('mapVoidNode').onclick=()=>setSurplusMode('void');
 if($('mapLimitToggle'))$('mapLimitToggle').onclick=()=>{const panel=$('mapLimitControls');panel.hidden=!panel.hidden;$('mapLimitToggle').setAttribute('aria-expanded',String(!panel.hidden));if(!panel.hidden)$('mapRawLimit').focus();};
 if($('mapDeleteNode')){
  const affected=craftMapDependents(items,[...state.secondary,...mapDrafts],id);
  $('mapDeleteNode').textContent=affected.some(ref=>ref!==id)?'Delete node and dependent crafts':'Delete node';if(affected.some(ref=>ref!==id))$('mapDeleteNode').insertAdjacentHTML('afterend',`<p class="hint">Also removes: ${affected.map(ref=>esc(items[ref].name)).join(', ')}. They cannot be crafted without this ingredient.</p>`);
  $('mapDeleteNode').onclick=()=>{if(n.protected||n.explorationSupplied)return;mapBeginEdit();mapInspectDraft=null;mapExpanded.delete(id);state.map_hidden=[...new Set([...state.map_hidden,id])];mapDrafts=mapDrafts.filter(g=>!affected.includes(g.item_id));state.secondary=state.secondary.filter(g=>!affected.includes(g.item_id));mapSelected=null;mapChanged();mapQueuePreview();};
 }
 if(applied&&!draft&&$('mapAppliedCap')){
  $('mapAppliedCap').onchange=async e=>{const raw=e.target.value,q=raw===''?null:Number(raw);if(q!==null&&(!Number.isInteger(q)||q<0||q>100000000))return;mapBeginEdit();applied.cap=q;applied.consumer_mode='fixed';mapChanged();mapQueuePreview();if(mapSelected)mapSelect(mapSelected);};
 }
 if(draft&&$('mapDraftQuantity'))$('mapDraftQuantity').onchange=e=>{const q=Number(e.target.value);if(!Number.isInteger(q)||q<0||q>100000000)return;draft.cap=q;draft.consumer_mode='fixed';mapChanged();mapQueuePreview();mapSelect(id);};
 if(options){$('mapOptions').replaceWith(options);const anchor=$(view.kind==='crafts'?'mapFindCrafts':'mapFindSources');if(anchor)anchor.after(options);}
}
async function mapConsumers(id){
 mapInspectorView={id,kind:'crafts'};
 const token=++mapCandidateToken,host=$('mapOptions');if($('mapFindCrafts'))$('mapFindCrafts').after(host);host.textContent='Finding crafts…';
 try{const rows=await api('/api/consumers/'+id);if(token!==mapCandidateToken)return;
  const chosen=new Set([...Object.keys(state.targets),...state.secondary.map(g=>g.item_id),...mapDrafts.map(g=>g.item_id)]);
  const level=state.tower_level||0;
  const rank=r=>{const badge=towerOpportunity(r.id,level,globalThis.TOWER_MM);return badge&&badge.level>level?badge.level-level:100000;};
  const options=rows.filter(r=>r.direct&&!chosen.has(r.id)).map(r=>{const addOptions=mapCraftAddOptions(r.id,id);const gaps=visibleCraftMapGaps(mapCraftGaps(r.id,addOptions.all));return {...r,addOptions,gaps,complexity:craftMapRecipeComplexity(items,r.id,id,state),towerRank:rank(r)};}).sort((a,b)=>Number(a.gaps.length>0)-Number(b.gaps.length>0)||a.complexity-b.complexity||a.towerRank-b.towerRank||a.name.localeCompare(b.name));
  host.innerHTML=`<h4>Use ${esc(items[id].name)}</h4><p class="hint">Use-all crafts without shortages first, then fewer other ingredients, then upcoming Tower requirements.</p><input id="mapCraftFilter" placeholder="Filter crafts…" aria-label="Filter map crafts"><div id="mapCraftList"></div>`;
  function listing(){const q=$('mapCraftFilter').value.toLowerCase();$('mapCraftList').innerHTML=options.filter(r=>r.name.toLowerCase().includes(q)).slice(0,40).map(r=>{const badge=towerOpportunity(r.id,level,globalThis.TOWER_MM);const {addOptions,gaps}=r,quantity=addOptions.all;
 const warningRows=gaps.length?gaps.slice(0,2).map(([ref,q])=>`<button class="map-gap" data-map-choice-gap="${r.id}" data-map-quantity="${quantity}" data-map-missing="${ref}">⚠ ${mapCount(Math.ceil(q))} ${esc(items[ref].name)} missing →</button>`).join('')+(gaps.length>2?`<button class="map-gap" data-map-choice-gap="${r.id}" data-map-quantity="${quantity}" data-map-missing="${gaps[2][0]}">⚠ ${gaps.length-2} more ingredient gaps →</button>`:''):'<p class="map-supplied">✓ No significant ingredient gaps</p>';
 const availability=addOptions.rebalances?'Shares ingredients with existing crafts; recalculates when added':addOptions.available>=quantity&&quantity>0?`Up to ${mapCount(quantity)} crafts from current supplies`:addOptions.available?`About ${mapCount(addOptions.available)} crafts with current supplies`:'Needs supplies; stays active when you add them';
 return `<details class="map-choice"><summary class="map-choice-summary"><span class="map-choice-title">${itemName(r.id,r.name)}</span><span class="map-choice-availability ${gaps.length?'partial':'ready'}">${esc(availability)}</span><small>${r.direct?'Direct craft':'Through intermediates'}${badge&&badge.level>level?' · Tower '+badge.level+' ahead':''}</small></summary><div class="map-add-actions"><section class="map-add-option" aria-label="Use all option"><button ${quantity>0?'':'disabled'} data-map-add="${r.id}" data-map-quantity="${quantity}" data-map-focus="${id}">Force Use All · ${mapCount(quantity)} crafts</button><p class="hint">Use this material completely. Supply the gaps below.</p>${warningRows}</section><section class="map-add-option map-custom-option" data-map-custom-item="${r.id}"><label class="map-custom-label">Make up to <span class="map-custom-controls"><input type="number" min="1" max="100000000" step="1" value="10000" aria-label="Maximum crafts for ${esc(r.name)}"><button data-map-add="${r.id}" data-map-custom="true" data-map-quantity="10000">Add</button></span></label><div class="map-quantity-presets">${[1000,5000,10000,100000].map(n=>`<button data-map-preset="${n}">${n/1000}k</button>`).join('')}<span>crafts</span></div><p class="hint">Set a craft limit, then choose sources for any missing ingredients on the map.</p><div class="map-custom-gaps"></div></section><section class="map-add-option" aria-label="Use available option"><button data-map-add="${r.id}" data-map-quantity="${addOptions.available}" data-map-focus="${id}" data-map-available="true" >Use + Void</button><p class="hint">Share supplies from your current route. This does not add exploration.</p></section></div></details>`;}).join('')||'<p>No new direct crafts match.</p>';}
  $('mapCraftFilter').oninput=()=>{listing();mapRefreshCustomOptions();};listing();mapRefreshCustomOptions();
 }catch(e){if(token===mapCandidateToken)host.textContent=e.message;}
}
function mapRefreshCustomOptions(section){
 for(const box of section?[section]:$('mapInspector').querySelectorAll('.map-custom-option')){
  const input=box.querySelector('input'),q=Number(input.value),button=box.querySelector('[data-map-add]');
  const valid=Number.isInteger(q)&&q>=1&&q<=100000000;button.disabled=!valid;button.dataset.mapQuantity=String(q);
  const host=box.querySelector('.map-custom-gaps');
  if(!valid){host.textContent='Enter a whole number from 1 to 100,000,000.';continue;}
  const id=box.dataset.mapCustomItem,gaps=visibleCraftMapGaps(mapCraftGaps(id,q));
  host.innerHTML=gaps.length?gaps.slice(0,2).map(([ref,n])=>`<button class="map-gap" data-map-choice-gap="${id}" data-map-custom="true" data-map-quantity="${q}" data-map-missing="${ref}">⚠ Supply ${mapCount(Math.ceil(n))} ${esc(items[ref].name)} →</button>`).join('')+(gaps.length>2?`<small>and ${gaps.length-2} more ingredients</small>`:''):'<p class="map-supplied">✓ Ingredients already supplied</p>';
 }
}
$('mapInspector').addEventListener('change',e=>{const box=e.target.closest('.map-custom-option');if(box&&e.target.matches('input'))mapRefreshCustomOptions(box);});
$('mapInspector').addEventListener('click',e=>{const preset=e.target.closest('[data-map-preset]');if(!preset)return;const box=preset.closest('.map-custom-option');box.querySelector('input').value=preset.dataset.mapPreset;mapRefreshCustomOptions(box);});
async function mapSources(id){
 mapInspectorView={id,kind:'sources'};
 const token=++mapCandidateToken,host=$('mapOptions');const trigger=$('mapFindSources')||$('mapExploreInstead')||$('mapMeetPotential');if(trigger)trigger.after(host);host.textContent='Checking exploration sources…';
 try{const {sources}=await api('/api/item/'+id);if(token!==mapCandidateToken)return;
 const enabled=s=>s.kind==='explore'&&state.areas.includes(s.location_id)&&!s.conditions?.frozen&&Object.entries({ironDepot:state.iron_depot,runecube:state.runecube,manualFishing:false}).every(([k,v])=>s.conditions?.[k]==null||s.conditions[k]===v);
 const selectedSources=state.map_sources?.[id]||[];const rows=sources.filter(enabled).sort((a,b)=>b.expected_drops_per_explore-a.expected_drops_per_explore);
 const shortages=new Map(mapGraph.nodes.map(n=>[n.id,{...n,missing:Math.max(n.missing||0,n.potentialMissing||0)}]));for(const n of mapPotential?.graph?.nodes||[]){const current=shortages.get(n.id);if((n.missing||0)>(current?.missing||0))shortages.set(n.id,{...n});}const gaps=[...shortages.values()].filter(n=>n.kind==='item'&&n.id!==id&&(n.missing>=10||!n.free&&!n.totalSupply&&(mapGraph.links||[]).some(l=>l.from===n.id)));
 const otherSources=await Promise.all(gaps.map(async n=>{try{return {node:n,sources:(await api('/api/item/'+n.id)).sources.filter(enabled)};}catch{return {node:n,sources:[],unavailable:true};}}));
 if(token!==mapCandidateToken)return;
 const sourceNode=mapGraph.nodes.find(n=>n.id===id);const need=Math.max(sourceNode?.missing||0,sourceNode?.potentialMissing||0);
 host.innerHTML='<h4>Exploration sources</h4>'+selectedSources.map(area=>`<button data-map-remove-source="${esc(area)}" data-map-source-item="${id}">Remove ${esc(catalog.locations.find(a=>a.id===area)?.name||area)} source</button>`).join('')+rows.map(r=>{
  const rate=r.expected_drops_per_explore*explorationYieldMultiplier(id),explores=rate>0?Math.ceil(need/rate):0;
  const coverage=otherSources.flatMap(({node,sources})=>{const match=sources.find(s=>s.location_id===r.location_id);if(!match)return [];const supplied=explores*match.expected_drops_per_explore*explorationYieldMultiplier(node.id);return [{node,supplied}];});
  return `<button class="map-candidate" data-map-area="${esc(r.location_id)}" data-map-source-item="${id}" data-map-rate="${rate}"><strong>${esc(r.location_name||r.location_id)}</strong><small>${fmt(rate)} items per explore · ${mapEstimateInputs().plan.areas.some(a=>a.location_id===r.location_id)?'Explore more here':selectedSources.includes(r.location_id)?'Selected source':'Add this location'}</small>${explores>0?`<small>+${mapCount(explores)} explores &middot; +${(100*explores/Math.max(1,mapEstimateInputs().plan.optimal_total_explores)).toFixed(1)}% of this route</small>`:'<small>Already supplied; no extra explores needed.</small>'}${coverage.map(({node,supplied})=>`<small class="map-source-coverage">${itemName(node.id,node.name)} · ${!node.missing?'Also supplies this connected ingredient':supplied>=node.missing?'Covers this shortage':`Supplies about ${Math.min(100,Math.floor(100*supplied/node.missing))}% of shortage`}</small>`).join('')}${gaps.length&&!coverage.length?'<small>No other missing ingredients supplied'+(otherSources.some(s=>s.unavailable)?' by the sources checked':'')+'.</small>':''}</button>`;
 }).join('')+(gaps.length?'<p class="hint">Coverage estimates use the explores needed for this ingredient.</p>':'');
 if(!rows.length)host.innerHTML+='<p>No enabled exploration source. Bring this material from your farm or enable its area in Settings.</p>';
 }catch(e){if(token===mapCandidateToken)host.textContent=e.message;}
}
function mapUnusedText(n){if(n.autoSupply)return n.automaticAmount?`${mapCount(n.automaticAmount)} supplied automatically`:'Provided as needed';if(n.externalSource&&!n.totalSupply)return n.externalSource==='farming'?'Supply from farming':'Supply from other sources';const total=Math.max(n.stock,n.totalSupply||0);return total>0&&n.stock>=1&&n.stock<total?`${mapCount(n.stock)} out of ${mapCount(total)} unused (${Math.floor(100*n.stock/total)}%)`:`${mapCount(n.stock)} unused`;}
function mapNext(){
 if(!mapGraph)return;
 const warnings=mapGraph.nodes.filter(n=>n.kind==='item'&&!n.free&&(n.missing>=10||n.potentialMissing>=10));
 let n=warnings.find(n=>!mapVisit.has(n.id));
 if(!n&&warnings.length){mapVisit.clear();n=warnings[0];}
 if(!n){$('mapInspector').innerHTML='<h3>No missing supplies</h3><p>You can inspect any item or review your changes.</p>';return;}
 mapVisit.add(n.id);mapSelect(n.id);mapFocus(n.id);
}
function mapFocus(id){const p=mapPositions[id];if(p)$('mapViewport').scrollTo({left:Math.max(0,p.x*mapScale-150),top:Math.max(0,p.y*mapScale-100),behavior:'smooth'});}
function mapZoom(scale){mapScale=Math.max(.2,Math.min(1.8,scale));$('mapCanvas').style.transform=`scale(${mapScale})`;$('mapStage').style.width=$('mapCanvas').offsetWidth*mapScale+'px';$('mapStage').style.height=$('mapCanvas').offsetHeight*mapScale+'px';}
$('mapZoomIn').onclick=()=>mapZoom(mapScale*1.2);$('mapZoomOut').onclick=()=>mapZoom(mapScale/1.2);
$('mapTower').oninput=$('mapTower').onchange=e=>{const n=Number(e.target.value);if(!Number.isInteger(n)||n<0||n>10000)return;state.tower_level=n;save();if(mapSelected){mapSelect(mapSelected);mapConsumers(mapSelected);}};
$('mapNext').onclick=mapNext;
$('mapUnusedMode').onclick=e=>{const b=e.target.closest('[data-unused-mode]');if(!b)return;state.map_unused_mode=b.dataset.unusedMode;save();mapRender();};
$('mapUnusedCount').onchange=e=>{const n=Number(e.target.value);if(!Number.isInteger(n)||n<1||n>1000){e.target.value=state.map_unused_count??6;return;}state.map_unused_count=n;save();mapRender();};
$('mapExpand').onclick=()=>{const expanded=craftMap.classList.toggle('map-fullscreen');$('mapExpand').textContent=expanded?'Back to planner':'Open large map';if(expanded){mapZoom(.85);$('mapViewport').scrollTo(0,0);}};
$('mapReviewTop').onclick=()=>$('mapPreview').click();
$('mapNodes').onclick=e=>{const toggle=e.target.closest('[data-map-toggle-area]');if(toggle){const id=toggle.dataset.mapToggleArea,open=state.map_expanded_areas||[];state.map_expanded_areas=open.includes(id)?open.filter(a=>a!==id):[...open,id];save();mapRender();return;}const port=e.target.closest('[data-map-port]'),node=e.target.closest('[data-map-node]'),gap=e.target.closest('[data-map-gap]');if(!node)return;const id=node.dataset.mapNode;mapSelect(id);if(gap)mapSources(id);else if(port)mapConsumers(id);};
$('mapNodes').onkeydown=e=>{if(e.target.matches('[data-map-node]')&&(e.key==='Enter'||e.key===' ')){e.preventDefault();mapSelect(e.target.dataset.mapNode);}};
$('mapInspector').onclick=async e=>{
 const jump=e.target.closest('[data-map-jump]');if(jump){mapSelect(jump.dataset.mapJump);mapFocus(jump.dataset.mapJump);return;}
 const gap=e.target.closest('[data-map-choice-gap]');if(gap){mapInspectDraft={item_id:gap.dataset.mapChoiceGap,cap:Number(gap.dataset.mapQuantity),allow_exploration:gap.dataset.mapCustom==='true',automatic_supply:gap.dataset.mapCustom==='true'};mapChanged();mapSelect(gap.dataset.mapMissing);mapFocus(gap.dataset.mapMissing);return;}
 const removeSource=e.target.closest('[data-map-remove-source]');if(removeSource){
 const id=removeSource.dataset.mapSourceItem,area=removeSource.dataset.mapRemoveSource;mapBeginEdit();state.map_planning=true;state.map_sources[id]=(state.map_sources[id]||[]).filter(a=>a!==area);if(state.map_source_explores?.[id])delete state.map_source_explores[id][area];
 mapChanged();mapSelect(id);await mapComputePreview(false);mapSelect(id);await mapSources(id);return;
 }
 const add=e.target.closest('[data-map-add]'),reveal=e.target.closest('[data-map-reveal]'),remove=e.target.closest('[data-map-remove]'),area=e.target.closest('[data-map-area]');
 if(add){
  const id=add.dataset.mapAdd;if(state.targets[id]||mapGoals().some(g=>g.item_id===id))return;
  const available=add.dataset.mapAvailable==='true',custom=add.dataset.mapCustom==='true',box=add.closest('.map-custom-option');
  const amount=Number(box?box.querySelector('input').value:add.dataset.mapQuantity);
  if(!available&&(!Number.isInteger(amount)||amount<1||amount>100000000))return;
  mapBeginEdit();state.map_planning=true;mapInspectDraft=null;
  if(available&&add.dataset.mapFocus)state.map_use_void=[...new Set([...state.map_use_void,add.dataset.mapFocus])];
  mapDrafts.push({item_id:id,cap:available?null:amount,user_cap:custom,consumer_mode:available||custom?'available':'fixed',automatic_batch:!available&&!custom,allow_exploration:false,available_only:available,void_source:add.dataset.mapFocus||null});
  mapChanged();mapSelect(id);mapFocus(id);mapQueuePreview();return;
 }
 if(reveal){state.map_hidden=state.map_hidden.filter(id=>id!==reveal.dataset.mapReveal);save();mapExpanded.add(reveal.dataset.mapReveal);mapRender();mapSelect(reveal.dataset.mapReveal);mapFocus(reveal.dataset.mapReveal);}
 if(remove){mapDrafts=mapDrafts.filter(g=>g.item_id!==remove.dataset.mapRemove);mapSelected=null;mapChanged();}
 if(area){
  const sourceId=area.dataset.mapSourceItem,location=area.dataset.mapArea,rate=Number(area.dataset.mapRate);
  const sourceNode=mapGraph.nodes.find(n=>n.id===sourceId),shown=mapEstimateInputs().plan;
  const gap=Math.max(sourceNode?.missing||0,sourceNode?.potentialMissing||0),current=shown.map_extra_explores?.[location]||0;
  if(!(rate>0)){ $('mapOptions').textContent='Could not read this source rate. Reopen the source list.';return; }
  mapBeginEdit();state.map_source_explores??=JSON.parse(JSON.stringify(shown.map_source_explores||{}));
  state.map_source_explores[sourceId]??={};
  state.map_source_explores[sourceId][location]=Math.max(state.map_source_explores[sourceId][location]||0,current+Math.ceil(gap/rate));
  state.map_planning=true;state.map_sources??={};state.map_sources[sourceId]=[...new Set([...(state.map_sources[sourceId]||[]),area.dataset.mapArea])];
  if(mapInspectDraft&&!mapGoals().some(g=>g.item_id===mapInspectDraft.item_id)){mapDrafts.push({...mapInspectDraft,consumer_mode:'fixed',automatic_batch:true});mapInspectDraft=null;}
  mapChanged();mapSelect(sourceId);$('mapOptions').textContent='Calculating this location and all its useful outputs…';await mapComputePreview(false);return;
 }
};
$('mapDiscard').onclick=()=>{if(mapOriginal){Object.assign(state,mapOriginal);mapOriginal=null;inventoryRows();}mapJob++;if(mapPreviewRunning)browserPlanner.cancel();mapDrafts=[];mapInspectDraft=null;mapExtraAreas.clear();mapExcludedAreas.clear();mapProposedLinks=[];mapSelected=null;mapChanged();mapQueuePreview();};
let mapPreviewRunning=false;
$('mapPreview').onclick=()=>mapComputePreview(true);
async function mapComputePreview(showReview=false){
 if(showReview&&mapPreview&&mapRevision===revision){if(!$('mapReviewDialog').open)$('mapReviewDialog').showModal();return;}
 if(!mapChangeCount()||mapBusy()||mapPreviewRunning)return;clearTimeout(mapPreviewTimer);mapInspectDraft=null;mapRender();const token=++mapJob;mapRevision=revision;mapPreview=null;mapPreviewRunning=true;$('mapNodes').inert=true;$('mapPreview').disabled=true;$('mapReviewTop').disabled=true;$('mapSummary').textContent='Checking proposed crafts together…';$('mapPreviewResult').hidden=true;$('mapReviewStatus').textContent='Checking proposed crafts together…';if(showReview&&!$('mapReviewDialog').open)$('mapReviewDialog').showModal();
 const extra=[...new Set(Object.values(state.map_sources||{}).flat())];
 try{const {job_id}=await api('/api/plan',{...guidePayload(),map_planning:true,map_sources:state.map_sources||{},map_source_explores:state.map_source_explores,previous_map_source_explores:mapOriginal?.map_source_explores||state.map_source_explores,previous_map_sources:mapOriginal?.map_sources||state.map_sources||{},previous_map_node_usage:mapOriginal?.map_node_usage||state.map_node_usage||{},secondary:mapOriginal?.secondary||state.secondary,replacement_goals:mapRequestGoals(),automatic_areas:extra});
 while(token===mapJob){if(mapRevision!==revision)throw Error('The plan changed. Preview the updated map again.');const job=await api('/api/jobs/'+job_id);if(job.status==='error')throw Error(job.error);if(job.status==='complete'){const shortfalls=job.result.outputs.filter(o=>{const g=mapRequestGoals().find(g=>g.item_id===o.item_id);return g?.consumer_mode==='fixed'&&g.cap-o.crafts>=10;});mapPreview={...job.result,areas:extra,shortfalls};mapRender();if(mapSelected)mapSelect(mapSelected,{preserveOptions:true});$('mapReviewStatus').textContent='';$('mapPreviewResult').hidden=false;$('mapPreviewResult').innerHTML=`<h3>Proposed route change</h3>${mapOriginal?`<p>Removed crafts: ${mapOriginal.secondary.filter(g=>!state.secondary.some(s=>s.item_id===g.item_id)).map(g=>esc(items[g.item_id].name)).join(', ')||'None'}. ${Object.entries(inventoryData()).filter(([id,q])=>q>(JSON.parse(mapOriginal[state.planner_mode==='passive'?'passive_inventory':'inventory']||'{}')[id]||0)).map(([id,q])=>`From inventory: ${esc(items[id].name)} (${mapCount(q)} total)`).join('; ')} Other node and quantity changes are included.</p>`:''}<p><strong>${fmt(job.result.extra_explores)} extra explores · ${guidedExploreIncrease(job.result)}</strong> · ${fmt(job.result.total_explores)} total</p><p>New locations: ${job.result.new_locations.map(id=>esc(catalog.locations.find(a=>a.id===id)?.name||id)).join(', ')||'None'}</p><div class="map-preview-outputs">${job.result.outputs.map(o=>`<div>${itemName(o.item_id,items[o.item_id].name)}<strong>${mapCount(o.crafts)} crafts</strong><small>${mapCount(o.remaining)} left at the end</small></div>`).join('')}</div>${job.result.reduced.length?`<p class="externalnote">Existing crafts reduced: ${job.result.reduced.map(o=>`${esc(items[o.item_id].name)} ${mapCount(o.before)} → ${mapCount(o.after)}`).join('; ')}</p>`:''}<p class="hint">These are the amounts your updated route can make.</p>${shortfalls.length?`<p class="map-gap">Resolve shortages before applying: ${shortfalls.map(o=>`${esc(items[o.item_id].name)}: ${mapCount(o.crafts)} of ${mapCount(mapRequestGoals().find(g=>g.item_id===o.item_id).cap)} crafts`).join('; ')}. Close this review and choose a source on the map, or lower the craft limit.</p>`:''}<button class="primary" id="mapApply" ${shortfalls.length?'disabled':''}>Apply reviewed plan</button>`;$('mapApply').onclick=mapApply;if(showReview&&$('mapReviewDialog').open)$('mapApply').focus({preventScroll:true});$('mapSummary').textContent='Preview: '+mapCount(job.result.total_explores)+' explores. Review & apply when ready.';return;}$('mapSummary').textContent=job.message||'Checking…';$('mapReviewStatus').textContent=job.message||'Checking…';await new Promise(r=>setTimeout(r,200));}
 }catch(e){if(token===mapJob){const message=e.message.split('\n').filter(Boolean).at(-1);$('mapSummary').textContent=message;$('mapReviewStatus').textContent=message;}}finally{if(token===mapJob){mapPreviewRunning=false;$('mapNodes').inert=false;$('mapPreview').disabled=!mapChangeCount();$('mapReviewTop').disabled=!mapChangeCount();}}
};
async function mapApply(){if(!mapPreview||mapRevision!==revision||mapPreview.shortfalls?.length)return;$('mapReviewDialog').close();state.map_planning=true;state.secondary=mapGoals().map(g=>mapGoalIntent(g,false));mapOriginal=null;state.automatic_areas=mapPreview.areas;mapDrafts=[];mapInspectDraft=null;mapExtraAreas.clear();mapPreview=null;$('mapPreviewResult').hidden=true;changed();clearTimeout(timer);await calculate();$('mapSummary').textContent='Plan updated. Use Save / load to keep a copy.';}
window.addEventListener('planner-result',mapRender);
window.addEventListener('planner-cleared',()=>{mapJob++;mapDrafts=[];mapPositions={};mapSelected=null;mapRender();});
window.addEventListener('planner-settings-saved',()=>{if(!mapGraph&&state){mapPositions=JSON.parse(JSON.stringify(state.map_positions||{}));$('mapTower').value=state.tower_level||0;}});
if(mapCurrent())mapRender();else craftMap.hidden=true;
