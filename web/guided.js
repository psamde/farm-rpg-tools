/* Guided decisions use full solver previews; no unaccepted craft changes the plan. */
const guideUI=document.createElement('dialog');
guideUI.id='guidedDialog';guideUI.setAttribute('aria-labelledby','guidedTitle');
guideUI.innerHTML=`<div class="sectiontitle"><h2 id="guidedTitle">Put your leftovers to work</h2><button id="finishGuide" type="button">Finish for now</button></div><p class="hint">Review one material at a time. Each choice is checked against your whole plan. Select several crafts, review them together, then add them. You can stop whenever you like.</p><label for="guidedMaterial">Material to review</label><select id="guidedMaterial"></select><p id="guidedAmount" class="hint"></p><div class="guide-actions"><button id="skipGuided" type="button">I’m OK leaving this unused</button><button id="restoreGuided" type="button">Review skipped materials</button></div><p id="guidedStatus" role="status" aria-live="polite"></p><div id="guidedBasket" class="guide-basket"><span id="guidedPickedCount">0 crafts selected</span><button id="reviewGuidedSelection" type="button" disabled>Review selection together</button><div id="guidedCombined"></div><button id="applyGuidedSelection" class="primary" type="button" hidden>Add selected crafts</button></div><div id="guidedOptions"></div><button id="moreGuided" type="button" hidden>See other crafting options</button><div id="guidedOther" hidden><label for="guidedCraft">Choose another craft to compare</label><select id="guidedCraft"></select><button id="checkGuidedCraft" type="button">Compare this craft</button></div>`;
document.body.append(guideUI);
let guideApplying=false,guideBusy=false,guidePicks=new Map(),guideCombined=null;
let guideToken=0,guideRevision=0,guideChoices=[],guideShown=5,guideStock={},guideEstimates=[];
function guidePayload(){return {action:'guided',map_planning:state.map_planning===true,map_sources:state.map_sources||{},map_node_usage:state.map_node_usage||{},combinations_mode:state.mode==='combinations',planner_mode:state.planner_mode,targets:state.planner_mode==='passive'?{}:activeTargets(),provided_targets:state.provided_targets,secondary:state.secondary.map(g=>({...g})),areas:[...state.areas],automatic_areas:state.automatic_areas,inventory:inventoryData(),resource_saver:state.resource_saver,iron_depot:state.iron_depot,runecube:state.runecube,cockatrice_ether_source:state.cockatrice_ether_source,selected_plan_key:result.plans[selected].area_set_id};}
function stopGuide(){guideToken++;if(guideBusy&&!guideApplying)browserPlanner.cancel();guideUI.close();}
$('finishGuide').onclick=stopGuide;
guideUI.addEventListener('cancel',()=>{guideToken++;if(guideBusy&&!guideApplying)browserPlanner.cancel();});
$('planDetail').addEventListener('click',e=>{if(!e.target.closest('#startGuided'))return;if($('status').classList.contains('loading'))return;revision++;clearTimeout(timer);guideUI.showModal();nextGuided();});
function nextGuided(){
 $('guidedOptions').inert=false;
 guidePicks.clear();updateGuideBasket();
 const p=result?.plans?.[selected];if(!p)return;
 const ingredients=craftingIngredientIds();
 // Finished outputs are kept; only unreserved stock is offered again.
 guideStock=Object.fromEntries(p.item_balances.map(b=>[b.item_id,Math.max(0,b.expected_unused??(b.expected_final_inventory-b.reserved_target_output))]));
 const rows=Object.keys(guideStock).filter(id=>ingredients.has(id)&&guideStock[id]>=1&&!state.guided_skipped.includes(id)).sort((a,b)=>guideStock[b]-guideStock[a]);
 $('guidedMaterial').innerHTML=rows.map(id=>`<option value="${esc(id)}">${esc(items[id].name)} · ${fmt(Math.floor(guideStock[id]))}</option>`).join('');
 $('guidedMaterial').disabled=!rows.length;$('skipGuided').disabled=!rows.length;
 if(!rows.length){$('guidedOptions').innerHTML='';$('guidedAmount').textContent='';$('guidedStatus').textContent='All current crafting materials have been used or reviewed. Your accepted crafts are ready in the planner.';$('moreGuided').hidden=true;$('guidedOther').hidden=true;return;}
 compareGuided();
}
$('guidedMaterial').onchange=()=>{guidePicks.clear();updateGuideBasket();compareGuided();};
$('skipGuided').onclick=()=>{guideToken++;if(guideBusy)browserPlanner.cancel();state.guided_skipped=[...new Set([...state.guided_skipped,$('guidedMaterial').value])];save();nextGuided();};
$('restoreGuided').onclick=()=>{state.guided_skipped=[];save();nextGuided();};
async function compareGuided(only=null){
 $('guidedOptions').inert=false;
 const material=$('guidedMaterial').value,token=++guideToken;guideRevision=revision;guideShown=5;guideChoices=[];
 $('guidedOptions').innerHTML='';$('guidedOther').hidden=true;$('moreGuided').hidden=true;
 $('guidedAmount').innerHTML=`${itemName(material,items[material].name)} · ${fmt(Math.floor(guideStock[material]))} available. Options rank by use of this material, then other existing supplies. Compare the exploration cost before choosing.`;
 const estimates=suggestCrafts(items,guideStock,state,material,1000,true);
 guideEstimates=[...estimates.ready.map(r=>({...r,assist:false})),...estimates.explore.map(r=>({...r,assist:true}))];
 const shortlist=only?guideEstimates.filter(r=>r.id===only):[...estimates.ready.slice(0,5).map(r=>({...r,assist:false})),...estimates.explore.slice(0,5).map(r=>({...r,assist:true}))];
 const candidates=shortlist.flatMap(r=>(r.assist?[1,.5,.25]:[1]).map(scale=>({item_id:r.id,cap:Math.max(1,Math.floor(r.count*scale)),allow_exploration:r.assist})));
 $('guidedCraft').innerHTML=[...new Set(guideEstimates.map(r=>r.id))].sort((a,b)=>items[a].name.localeCompare(items[b].name)).map(id=>`<option value="${id}">${esc(items[id].name)}</option>`).join('');
 if(!candidates.length){$('guidedStatus').textContent='No useful craft found with your current supplies and available ingredients. You can leave this material unused or add supplies in Starting inventory.';return;}
 $('guidedStatus').textContent='Checking routes and shared ingredients… This can take a moment.';
 try{
  guideBusy=true;const {job_id}=await api('/api/plan',{...guidePayload(),material,candidates});
  while(token===guideToken&&guideUI.open){
   if(revision!==guideRevision)throw Error('The plan changed. Reopen the guide to compare the updated supplies.');
   const job=await api('/api/jobs/'+job_id);
   if(job.status==='error')throw Error(job.error);
   if(job.status==='complete'){
    guideBusy=false;guideChoices=[...new Map(job.result.options.map(o=>[JSON.stringify([o.goal.item_id,o.goal.cap,o.goal.allow_exploration]),o])).values()];
    $('guidedStatus').textContent=`${guideChoices.length} useful batch options checked. Smaller batches can save exploring. ${job.result.failures.length?job.result.failures.length+' options could not be solved.':''}`;
    showGuidedChoices();$('moreGuided').hidden=false;return;
   }
   $('guidedStatus').textContent=job.message||'Checking options…';await new Promise(r=>setTimeout(r,200));
  }
 }catch(e){if(token===guideToken){guideBusy=false;$('guidedStatus').textContent=e.message.split('\n').filter(Boolean).at(-1);}}
}
function guidedExploreIncrease(option){
 const baseline=option.total_explores-option.extra_explores,extra=option.extra_explores;
 if(!extra)return '0%';
 if(baseline<=0)return 'new exploration · no previous explores';
 const percent=extra/baseline*100;
 if(percent>0&&percent<.1)return '+<0.1%';
 return (percent>0?'+':'')+fmt(percent)+'%';
}
function guidedPickState(option){
 const chosen=guidePicks.get(option.goal.item_id);
 const checked=Boolean(chosen&&chosen.goal.cap===option.goal.cap&&chosen.goal.allow_exploration===option.goal.allow_exploration);
 const existing=Boolean(state.targets[option.goal.item_id]||state.secondary.some(g=>g.item_id===option.goal.item_id));
 return {checked:checked&&!existing,disabled:existing||Boolean(chosen&&!checked),label:existing?'Already in your plan':chosen&&!checked?'Another batch of this item is selected':checked?'Selected — uncheck to choose another batch':'Select this batch'};
}
function showGuidedChoices(){
 $('guidedOptions').innerHTML=guideChoices.slice(0,guideShown).map((o,index)=>`<article class="guide-choice"><h3>${itemName(o.goal.item_id,items[o.goal.item_id].name)} <small>${fmt(Math.floor(o.crafts))} crafts</small></h3><dl><div><dt>This material used*</dt><dd>${fmt(Math.floor(o.material_used))} / ${fmt(Math.floor(guideStock[$('guidedMaterial').value]))}</dd></div><div><dt>All existing supplies used*</dt><dd>${fmt(Math.floor(o.materials_used))}</dd></div><div><dt>Extra explores</dt><dd>${fmt(o.extra_explores)} <strong class="explore-increase">${guidedExploreIncrease(o)}</strong> <small>(${fmt(o.total_explores)} total)</small></dd></div><div><dt>New locations</dt><dd>${o.new_locations.map(id=>esc(catalog.locations.find(a=>a.id===id)?.name||id)).join(', ')||'None'}</dd></div></dl>${o.reduced.length?`<p class="externalnote">Shared ingredients reduce: ${o.reduced.map(r=>`${esc(items[r.item_id].name)} ${fmt(Math.floor(r.before))} → ${fmt(Math.floor(r.after))}`).join('; ')}.</p>`:''}<p class="hint">${o.goal.allow_exploration?'Explore for missing ingredients':'Use existing supplies'} · batch cap ${fmt(o.goal.cap)}. ${fmt(Math.floor(o.remaining_material))} of this material remains after the new route.</p><label class="guide-select"><input type="checkbox" data-guided-pick="${index}" ${guidedPickState(o).checked?'checked':''} ${guidedPickState(o).disabled?'disabled':''}> ${guidedPickState(o).label}</label></article>`).join('')+'<p class="hint">*Rounded down. Percentages compare with your current plan before these choices. Each card is an independent preview. Review selected crafts together to see how they share supplies. New exploring can bring more of this material back. Skipping leaves it available to other recipes; it does not discard inventory. These are useful candidates, not a guaranteed global optimum.</p>';
}
$('moreGuided').onclick=()=>{guideShown+=5;showGuidedChoices();$('guidedOther').hidden=false;};
$('checkGuidedCraft').onclick=()=>compareGuided($('guidedCraft').value);
function updateGuideBasket(){
 guideCombined=null;$('guidedCombined').innerHTML='';$('applyGuidedSelection').hidden=true;
 $('guidedPickedCount').textContent=guidePicks.size+' crafts selected';$('reviewGuidedSelection').disabled=!guidePicks.size;
}
$('guidedOptions').onchange=e=>{
 const b=e.target.closest('[data-guided-pick]');if(!b)return;
 const choice=guideChoices[Number(b.dataset.guidedPick)];if(!choice)return;
 if(b.checked){if(guidedPickState(choice).disabled){showGuidedChoices();return;}guidePicks.set(choice.goal.item_id,choice);}else guidePicks.delete(choice.goal.item_id);
 updateGuideBasket();showGuidedChoices();
};
$('reviewGuidedSelection').onclick=async()=>{
 if(revision!==guideRevision){$('guidedStatus').textContent='Your plan changed. Reopen the guide.';return;}
 const token=++guideToken;guideBusy=true;const chosen=[...guidePicks.values()].map(o=>({...o.goal}));
 $('guidedOptions').inert=true;$('reviewGuidedSelection').disabled=true;
 $('guidedStatus').textContent='Checking selected crafts together…';
 try{
  const {job_id}=await api('/api/plan',{...guidePayload(),chosen_goals:chosen});
  while(token===guideToken&&guideUI.open){
   if(revision!==guideRevision)throw Error('Your plan changed. Reopen the guide.');
   const job=await api('/api/jobs/'+job_id);if(job.status==='error')throw Error(job.error);
   if(job.status==='complete'){
    guideCombined=job.result;
    $('guidedCombined').innerHTML=`<h3>Combined plan</h3><p>${fmt(guideCombined.extra_explores)} extra explores <strong class="explore-increase">${guidedExploreIncrease(guideCombined)}</strong> · ${fmt(guideCombined.total_explores)} total</p><p>New locations: ${guideCombined.new_locations.map(id=>esc(catalog.locations.find(a=>a.id===id)?.name||id)).join(', ')||'None'}</p>${guideCombined.outputs.map(o=>`<div class="quest-requirement">${itemName(o.item_id,items[o.item_id].name)}<strong>${fmt(Math.floor(o.crafts))} crafts</strong><small>${fmt(Math.floor(o.remaining))} left at the end</small></div>`).join('')}${guideCombined.reduced.length?`<p class="externalnote">Existing crafts reduced: ${guideCombined.reduced.map(o=>`${esc(items[o.item_id].name)} ${fmt(Math.floor(o.before))} → ${fmt(Math.floor(o.after))}`).join('; ')}</p>`:''}<p class="hint">These amounts share the same ingredients. Individual card estimates do not add together.</p>`;
    $('applyGuidedSelection').hidden=false;$('guidedStatus').textContent='Review the shared quantities, then add your selection.';return;
   }
   await new Promise(r=>setTimeout(r,200));
  }
 }catch(e){if(token===guideToken)$('guidedStatus').textContent=e.message;}
 finally{if(token===guideToken){guideBusy=false;$('guidedOptions').inert=false;$('reviewGuidedSelection').disabled=!guidePicks.size;}}
};
$('applyGuidedSelection').onclick=async()=>{
 if(!guideCombined||revision!==guideRevision)return;
 const ids=guideCombined.goals.map(g=>g.item_id);
 if(new Set(ids).size!==ids.length||ids.some(id=>state.targets[id]||state.secondary.some(g=>g.item_id===id))){$('guidedStatus').textContent='An item is already in your plan. Refresh the guide before adding these crafts.';return;}
 guideApplying=true;guideToken++;state.secondary.push(...guideCombined.goals.map(g=>({...g})));
 $('guidedOptions').innerHTML='';$('guidedStatus').textContent='Applying your choices and refreshing the shared pool…';
 $('guidedMaterial').disabled=true;$('skipGuided').disabled=true;$('moreGuided').hidden=true;
 guidePicks.clear();updateGuideBasket();
 changed();clearTimeout(timer);await calculate();guideApplying=false;
 if(guideUI.open&&!$('status').classList.contains('loading'))nextGuided();
};

/* Quests share Buddy Farm's native questline/step grouping. */
const questPanel=document.createElement('section');questPanel.className='quest-picker';
questPanel.innerHTML=`<div class="modebuttons" role="group" aria-label="Target source"><button type="button" id="itemGoalMode" aria-pressed="true">Items</button><button type="button" id="questGoalMode" aria-pressed="false">Quests</button></div><div id="questInputs" hidden><p class="hint">Choose your quest steps, then tick the items you want to plan for. Rewards are not counted as supplies.</p><label for="questSearch">Find a questline</label><input id="questSearch" placeholder="Search questlines or quest names…"><label for="questLine">Questline</label><select id="questLine"></select><div class="quest-bulk"><button id="selectAllQuests" type="button">Select all</button><button id="deselectAllQuests" type="button">Deselect all</button><small>Current questline</small></div><div id="questSteps"></div><div id="questRequirements"></div><p id="questStatus" role="status"></p><button type="button" id="addQuestTargets" class="primary" disabled>Add selected quest requirements</button></div>`;
$('primaryInputs').insertBefore(questPanel,$('primaryInputs').querySelector('.targetbarcontent'));
let questData=null,questChosen=new Set(),questItemExcluded=new Set();
$('itemGoalMode').onclick=()=>{$('questInputs').hidden=true;$('addForm').hidden=false;$('itemGoalMode').setAttribute('aria-pressed','true');$('questGoalMode').setAttribute('aria-pressed','false');};
$('questGoalMode').onclick=async()=>{
 $('questInputs').hidden=false;$('addForm').hidden=true;$('itemGoalMode').setAttribute('aria-pressed','false');$('questGoalMode').setAttribute('aria-pressed','true');
 try{if(!questData){$('questStatus').textContent='Loading questlines…';const response=await fetch('quests.json?v='+encodeURIComponent(document.querySelector('.appversion').textContent));if(!response.ok)throw Error('Could not load quests.');questData=await response.json();questChosen=new Set(state.quest_selection||[]);renderQuestLines();}$('questStatus').textContent='Quest requirements only; check levels, prerequisites and availability in game.';}catch(e){$('questStatus').textContent=e.message;}
};
function renderQuestLines(){const q=$('questSearch').value.toLowerCase();const rows=questData.questlines.filter(l=>l.name.toLowerCase().includes(q)||l.quests.some(s=>s.name.toLowerCase().includes(q)));$('questLine').innerHTML=rows.map(l=>`<option value="${esc(l.id)}">${esc(l.name.replace(/<[^>]*>/g,' '))}</option>`).join('');renderQuestSteps();}
function questPartNumber(n){let out='';for(const [value,label] of [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']])while(n>=value){out+=label;n-=value;}return out;}
function renderQuestSteps(){const line=questData.questlines.find(l=>l.id===$('questLine').value);$('questSteps').innerHTML=line?.quests.map((q,index)=>`<label class="quest-step" title="${esc(q.name)}"><input type="checkbox" data-quest="${esc(q.id)}" ${questChosen.has(q.id)?'checked':''}><span>Part ${esc(q.name.match(/(?:^|\s)([IVXLCDM]+|\d+)$/)?.[1]||questPartNumber(index+1))}</span></label>`).join('')||'<p>No questlines match.</p>';renderQuestRequirements();}
function chosenQuests(){
 const seen=new Set();return questData.questlines.flatMap(l=>l.quests).filter(q=>{if(!questChosen.has(q.id)||seen.has(q.id))return false;seen.add(q.id);return true;});
}
function questItemImported(questId,itemId){
 const tracked=state.quest_imported_items||{};
 // Older saves recorded whole quests. Keep those imports counted in full.
 return Object.hasOwn(tracked,questId)?tracked[questId].includes(itemId):(state.quest_selection||[]).includes(questId);
}
function selectedQuestRequirements(newOnly=false){
 const required={};let silver=0;
 for(const q of chosenQuests()){
  silver+=Number(q.silver);
  for(const r of q.items)if(!newOnly||!questItemImported(q.id,r.id))required[r.id]=(required[r.id]||0)+Number(r.quantity);
 }
 return {required,silver};
}
function selectedQuestItemIds(){return Object.keys(selectedQuestRequirements(true).required).filter(id=>eligibleTarget(items[id])&&!questItemExcluded.has(id));}
function updateQuestImportButton(){
 const count=selectedQuestItemIds().length;
 $('addQuestTargets').disabled=!count;$('addQuestTargets').textContent=count?`Add ${count} ${count===1?'item':'items'} to targets`:'Select items to add';
 if($('questItemCount'))$('questItemCount').textContent=`${count} selected`;
}
function renderQuestRequirements(){
 const {required,silver}=selectedQuestRequirements(),pending=selectedQuestRequirements(true).required;
 const rows=Object.entries(required).sort(([a],[b])=>(items[a]?.name||a).localeCompare(items[b]?.name||b));
 $('questRequirements').innerHTML=rows.length?`<div class="quest-import-heading"><h3>Items to import</h3><div class="quest-bulk" role="group" aria-label="Items to import"><button type="button" data-quest-items="all">Select all items</button><button type="button" data-quest-items="none">Deselect all items</button><small id="questItemCount"></small></div></div><p class="hint">Unchecked items stay available to add later. Already imported amounts won’t be added twice.</p><div class="quest-requirements-list">${rows.map(([id,n])=>{
  const eligible=eligibleTarget(items[id]),ready=eligible&&(pending[id]||0)>0;
  const note=!eligible?'Bring separately':!ready?'Already added':pending[id]<n?`${fmt(n-pending[id])} already added`:'';
  return `<label class="quest-requirement${ready?'':' is-unavailable'}"><input type="checkbox" data-quest-item="${esc(id)}" ${ready&&!questItemExcluded.has(id)?'checked':''} ${ready?'':'disabled'}><span class="quest-item-name">${itemName(id,items[id]?.name||id)}${note?`<small>${note}</small>`:''}</span><strong>${fmt(ready?pending[id]:n)}</strong></label>`;
 }).join('')}</div>${rows.some(([id])=>!eligibleTarget(items[id]))?'<p class="hint">Bring separately: these items cannot be crafted or collected by exploring.</p>':''}${silver?`<p class="hint">Also required: ${fmt(silver)} silver.</p>`:''}`:'<p class="hint">Select quest steps to see their items.</p>';
 updateQuestImportButton();
}
$('questRequirements').onchange=e=>{
 const id=e.target.dataset.questItem;if(!id)return;
 e.target.checked?questItemExcluded.delete(id):questItemExcluded.add(id);updateQuestImportButton();
};
$('questRequirements').onclick=e=>{
 const button=e.target.closest('[data-quest-items]');if(!button)return;
 for(const id of Object.keys(selectedQuestRequirements(true).required))if(eligibleTarget(items[id]))button.dataset.questItems==='all'?questItemExcluded.delete(id):questItemExcluded.add(id);
 renderQuestRequirements();
};
$('questSearch').oninput=renderQuestLines;$('questLine').onchange=renderQuestSteps;
$('questSteps').onchange=e=>{const id=e.target.dataset.quest;if(!id)return;e.target.checked?questChosen.add(id):questChosen.delete(id);renderQuestRequirements();};
$('addQuestTargets').onclick=()=>{
 const chosen=new Set(selectedQuestItemIds());if(!chosen.size)return;
 const {required}=selectedQuestRequirements(true),next={...state.targets};
 for(const id of chosen)next[id]=(next[id]||0)+required[id];
 if(Object.values(next).some(n=>n>100000000)){$('questStatus').textContent='One item would exceed 100 million. Select fewer quest steps for that item.';return;}
 state.quest_imported_items??={};
 for(const q of chosenQuests()){
  const added=q.items.filter(r=>chosen.has(r.id)&&!questItemImported(q.id,r.id)).map(r=>r.id);
  if(!added.length)continue;
  state.quest_imported_items[q.id]=[...new Set([...(state.quest_imported_items[q.id]||[]),...added])];
  if(!state.quest_selection.includes(q.id))state.quest_selection.push(q.id);
 }
 state.targets=next;targets();changed();renderQuestRequirements();
 $('questStatus').textContent=`Added ${chosen.size} ${chosen.size===1?'item':'items'} to your targets. You can import the remaining items whenever you need them.`;
};

window.addEventListener('planner-cleared',()=>{questChosen.clear();questItemExcluded.clear();if(questData)renderQuestSteps();});

for(const [id,select] of [['selectAllQuests',true],['deselectAllQuests',false]])$(id).onclick=()=>{const line=questData?.questlines.find(l=>l.id===$('questLine').value);for(const q of line?.quests||[])select?questChosen.add(q.id):questChosen.delete(q.id);renderQuestSteps();};
