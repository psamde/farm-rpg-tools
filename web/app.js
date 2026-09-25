globalThis.TOWER_MM = {"source":"https://farmrpg.com/index.php#!/wiki.php?page=Tower%20Masteries","verified_at":"2026-09-14","items":{"21":[201],"163":[202],"95":[203],"139":[204],"570":[205],"193":[206],"574":[207],"43":[208],"97":[209],"101":[210],"194":[211],"387":[212],"688":[213],"689":[214],"231":[215],"198":[216],"575":[217],"690":[218],"17":[219],"75":[220],"98":[221],"138":[221],"306":[222],"392":[222],"87":[223],"88":[223],"232":[224],"133":[224],"307":[225],"99":[225],"205":[226],"134":[226],"77":[227],"130":[227],"56":[228],"100":[228],"57":[229],"308":[229],"309":[230],"131":[230],"110":[231],"119":[231],"200":[232],"310":[232],"217":[233],"311":[233],"39":[234],"312":[234],"90":[235],"81":[235],"233":[236],"427":[236],"115":[237],"206":[237],"143":[238],"201":[238],"167":[239],"84":[239],"114":[240],"174":[240],"842":[241],"301":[241],"86":[242],"94":[242],"104":[243],"23":[243],"199":[244],"129":[244],"89":[245],"132":[245],"248":[246],"234":[246],"264":[247],"317":[247],"37":[248],"127":[248],"844":[249],"481":[249],"260":[250],"845":[250],"500":[250],"145":[251],"693":[252],"141":[253],"25":[254],"691":[255],"58":[256],"316":[257],"692":[258],"76":[259],"55":[260],"24":[261],"694":[262],"696":[263],"577":[264],"78":[265],"579":[266],"36":[267],"578":[268],"117":[269],"45":[270],"252":[271],"136":[272],"72":[273],"63":[274],"738":[275],"11":[275],"107":[276],"27":[276],"659":[277],"585":[277],"576":[278],"79":[278],"135":[279],"105":[279],"203":[280],"368":[280],"173":[281],"535":[281],"328":[282],"299":[282],"19":[283],"146":[283],"124":[284],"196":[284],"126":[285],"216":[285],"894":[286],"125":[286],"96":[287],"1094":[287],"140":[288],"176":[288],"236":[289],"237":[289],"238":[289],"326":[290],"48":[290],"900":[290],"207":[291],"204":[291],"455":[291],"106":[292],"118":[292],"976":[292],"122":[293],"540":[293],"414":[293],"249":[294],"305":[294],"820":[294],"393":[295],"737":[295],"474":[295],"536":[296],"450":[296],"166":[296],"165":[297],"195":[297],"74":[297],"388":[298],"492":[298],"594":[298],"265":[299],"300":[299],"760":[299],"240":[300],"1129":[300],"378":[300],"1367":[302],"1369":[302],"1373":[302],"1372":[303],"1376":[303],"1371":[303],"1368":[308],"675":[319],"1385":[320],"1375":[320],"82":[321],"456":[321],"788":[324],"1409":[325],"1380":[325],"1432":[325],"899":[327],"373":[328],"837":[332],"1440":[334],"185":[335],"841":[335],"390":[336],"977":[337],"1406":[338],"1364":[340],"83":[340]},"gm_items":{"629":[301],"254":[301],"1420":[301],"841":[304],"1365":[304],"1440":[304],"1364":[305],"615":[305],"1426":[305],"1442":[306],"1409":[306],"1414":[306],"1406":[307],"475":[307],"1387":[307],"1437":[308],"1433":[308],"1432":[309],"1422":[309],"1135":[309],"1418":[310],"1441":[310],"1430":[310],"1423":[311],"1211":[311],"1405":[312],"1089":[312],"743":[313],"1413":[313],"680":[314],"1366":[314],"1330":[315],"1427":[315],"759":[315],"1398":[316],"1329":[316],"1428":[317],"1066":[317],"1397":[318],"787":[318],"1425":[319],"846":[320],"684":[322],"1421":[322],"473":[323],"1407":[323],"679":[324],"1411":[326],"1417":[326],"1419":[327],"121":[328],"713":[329],"1390":[329],"898":[330],"1389":[330],"1260":[330],"150":[331],"1388":[331],"682":[332],"1403":[333],"1424":[333],"1130":[334],"1131":[335],"1391":[336],"1400":[336],"1408":[337],"1363":[337],"717":[338],"1095":[338],"1395":[339],"817":[339],"1399":[339],"1394":[340]}};
const $=id=>document.getElementById(id), fmt=n=>Number(n).toLocaleString(undefined,{maximumFractionDigits:n>0&&n<.01?6:2});

const esc=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

const fallbackIcon='<svg class="gameicon fallbackicon" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3 21 8v8l-9 5-9-5V8Zm0 0v18M3 8l9 5 9-5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/></svg>';

function itemIcon(idOrName){const i=items[idOrName]||Object.values(items).find(i=>i.name===idOrName);const path=i?.image;return typeof path==='string'&&path.startsWith('/img/')?`<img class="gameicon" data-item-info="${esc(i.id)}" src="https://farmrpg.com${esc(path)}" width="24" height="24" alt="" loading="lazy" referrerpolicy="no-referrer">`:fallbackIcon;}

function mmBadge(id){return [['MM',globalThis.TOWER_MM?.items?.[id]],['GM',globalThis.TOWER_MM?.gm_items?.[id]]].map(([label,levels])=>levels?.length?`<span class="mmbadge ${label==='GM'?'gmbadge':''}" title="Required for Tower Level ${esc(levels.join(', '))}" aria-label="${label}: Required for Tower Level ${esc(levels.join(', '))}">${label}<small class="tower-level">${esc(levels.join('/'))}</small></span>`:'').join('')+(items[id]?.mailable?`<span class="mailablebadge" title="Can be mailed and traded with other players${items[id].min_mailable_level?' · Mailing level '+items[id].min_mailable_level:''}">Mailable</span>`:'');}
function itemName(id,name){return `<span class="itemname" data-item-info="${esc(id)}" tabindex="0">${itemIcon(id)}<span>${esc(name)}</span>${mmBadge(id)}</span>`;}

document.addEventListener('error',e=>{if(e.target.matches?.('img.gameicon'))e.target.outerHTML=fallbackIcon;},true);

function settingIcons(){document.querySelectorAll('[data-setting-icon]').forEach(el=>{el.insertAdjacentHTML('afterbegin',itemIcon(el.dataset.settingIcon));});}

let catalog, items={}, state, result=null, selected=0, consumers=[], revision=0, timer, lastSuccess=null;

const defaults={map_planning:false,map_unused_mode:"top",map_unused_count:6,map_expanded_areas:[],map_sources:{},map_source_explores:null,map_node_usage:{},map_use_void:[],map_hidden:[],map_voided:[],tower_level:0,map_positions:{},guided_skipped:[],quest_selection:[],quest_imported_items:{},selected_plan:0,selected_plan_key:"",planner_mode:'goals',production_interval:60,passive_inventory:'{}',craftworks_slots:10,inventory_size:10000,route_method:'AP',route_foods:{},secondary:[],automatic_areas:null,theme:'dark',resource_saver:0,wanderer:0,lemon_squeezer:false,cinnamon:false,cider_rolls:{},effectiveness_upgrades:{},sprint_shoes:0,provided_targets:{},targets:{'167':1000},iron_depot:true,runecube:false,cockatrice_ether_source:false,mode:'best',max_areas:15,areas:null,inventory:'{}'};

async function api(url,body){return browserPlanner.api(url,body);}

function theme(){document.documentElement.dataset.theme=state.theme;$('themeToggle').textContent=state.theme==='dark'?'Light mode':'Dark mode';}

function ciderSettings(settings=state){

 const ordered=[...catalog.locations].sort((a,b)=>(explorationMenuOrder.indexOf(a.id)<0?999:explorationMenuOrder.indexOf(a.id))-(explorationMenuOrder.indexOf(b.id)<0?999:explorationMenuOrder.indexOf(b.id)));
 const seasonal=a=>['explore:11','explore:14'].includes(a.id);
 const card=a=>{const x=ciderEffectiveness(settings,a.id);const rate=x.rolls*.4/a.base_drop_rate;return `<div class="effectivenessrow ${settings.areas.includes(a.id)?'enabled':'disabled-area'}"><label class="location-choice"><input type="checkbox" data-location-enabled="${a.id}" ${settings.areas.includes(a.id)?'checked':''}>${a.image?`<img class="gameicon" src="${esc(a.image.startsWith('/')?'https://farmrpg.com'+a.image:a.image)}" alt="">`:''}<span>${esc(a.name)}</span></label><span class="location-upgrades-label">Upgrades</span><div class="effectivenesscontrols"><div class="stepper"><button type="button" data-step="-1" data-location="${a.id}" aria-label="Decrease ${esc(a.name)} upgrades" ${x.upgrades===0?'disabled':''}>−</button><input id="effect-${a.id}" data-effect="${a.id}" type="number" min="0" max="10000" step="1" value="${x.upgrades}" aria-label="${esc(a.name)} effectiveness upgrades"><button type="button" data-step="1" data-location="${a.id}" aria-label="Increase ${esc(a.name)} upgrades" ${x.upgrades>=10000?'disabled':''}>+</button></div><output for="effect-${a.id}" title="Estimated normal-explore equivalent per Cider in this area">${fmt(rate)}<small>explores / Cider</small>${x.custom?'<small>Saved custom rate*</small>':''}</output></div>${x.custom?'<small class="hint">*Previous rate preserved. Set upgrades to replace it.</small>':''}</div>`;};
 $('ciderSettings').innerHTML=ordered.filter(a=>!seasonal(a)).map(card).join('')+'<div class="seasonal-zones-heading"><h3>Seasonal zones</h3><p class="hint">Enable these when their holiday events are active.</p></div>'+ordered.filter(seasonal).map(card).join('');

}

function save(){try{localStorage.setItem('farm-workshop-v1',JSON.stringify(GlobalSettings.planOnly(state)));}catch{}window.dispatchEvent(new Event('planner-settings-saved'));}

function error(message,shortfalls=[]){
 const box=$('error'),token=revision;box.textContent=message;box.hidden=!message;
 if(!message)return;
 const available=shortfalls.filter(row=>items[row.item_id]&&Number.isSafeInteger(row.quantity)&&row.quantity>0);
 if(!available.length)return;
 const note=document.createElement('p');note.className='inventory-recovery-note';note.textContent='This adds the missing amount to Starting inventory. You can adjust it there.';box.append(note);
 for(const row of available){
  const entry=document.createElement('div');entry.className='inventory-recovery';
  entry.innerHTML=`<span>${itemName(row.item_id,items[row.item_id].name)} <strong>${fmt(row.quantity)} needed</strong></span><button type="button" class="primary" aria-label="Provide ${esc(items[row.item_id].name)} from inventory">Provide from inventory</button>`;
  entry.querySelector('button').onclick=()=>provideMissingInventory(row,token);box.append(entry);
 }
}

function provideMissingInventory(row,token){
 if(token!==revision)return;
 const stock=inventoryData(),quantity=Number(stock[row.item_id]||0)+row.quantity;
 if(!items[row.item_id]||!Number.isSafeInteger(row.quantity)||row.quantity<=0||!Number.isFinite(quantity)||quantity>1e12){error('That amount exceeds the inventory limit. Adjust Starting inventory under Primary targets.');return;}
 stock[row.item_id]=quantity;setInventory(stock);inventoryRows();error('');changed();
}

let settingsRecalculationPending=false;
function route(){
 const settings=['#settings','#tools'].includes(location.hash);
 $('settingsPage').hidden=!settings;$('plannerPage').hidden=settings;
 const version=document.querySelector('.appversion')?.textContent||'';document.title=`${settings?'Settings':'Exploration Planner'} ${version} · psam's FarmRPG Tools`;
 document.querySelectorAll('nav a').forEach(a=>a.classList.toggle('active',a.hash===(settings?'#settings':'#explore')));
 window.dispatchEvent(new Event('app-page-changed'));
 if(!settings&&state&&settingsRecalculationPending){settingsRecalculationPending=false;clearTimeout(timer);calculate();}
}

window.addEventListener('hashchange',route);route();

function externalIngredientNote(id){
 const missing=Object.keys(items[id]?.raw_materials||{}).filter(ref=>!items[ref]?.explorable&&!(state.iron_depot&&['Iron','Nails'].includes(items[ref]?.name)));
 if(!missing.length)return '';
 return `<span class="target-supplies" tabindex="0" title="Bring these from your farm or another source outside exploration. The required quantities are included in Starting ingredients consumed below.">Bring: ${missing.map(ref=>esc(items[ref]?.name||ref)).join(', ')}</span>`;
}
function activeTargets(){return TargetCosts.remaining(state);}
let targetSavings=null;
let targetRanking=[];
function targetSupply(id){return TargetCosts.split(state,id,result?.plans[selected]);}
const externalSupplyHelp='What you need to bring or buy after unused output from the route has been deducted. Only items left after other crafts count. Updated when the calculation finishes.';
function targetEffortRows(refresh=false){
 if(refresh){let personal={};try{personal=JSON.parse(localStorage.getItem('farm-tower-planner-v1')||'{}')||{};}catch{}targetRanking=TargetCosts.rank(catalog,state,personal);}
 const rows=new Map(targetRanking.filter(r=>state.targets[r.id]).map(r=>[r.id,r]));
 for(const id of Object.keys(state.targets))if(!rows.has(id))rows.set(id,{id,cost:{},pending:true});
 return [...rows.values()];
}
function targets(refreshCosts=false){
 $('targetCount').textContent=Object.keys(state.targets).length;
 $('targets').innerHTML=targetEffortRows(refreshCosts).map(({id,cost,pending},index)=>{
  const q=state.targets[id],remaining=activeTargets()[id]||0;
  const supply=targetSupply(id),supplied=supply.external;
  const effort=pending?'Calculating effort…':Number.isFinite(cost.points)?fmt(Math.floor(cost.points))+' effort points':'Effort unknown · missing source data';
  return `<div class="targetrow ${remaining?'':'target-provided'}"><div class="name"><span class="target-rank" title="Highest effort first">${index+1}</span><div>${itemName(id,items[id].name)}${remaining?externalIngredientNote(id):''}<small class="target-effort" title="Tower Planner effort score from the last completed calculation. Shared drops and starting stock are handled separately in the explore-savings estimate.">${effort}</small><label class="target-total" for="goal-${id}">Total goal <input id="goal-${id}" data-total-quantity="${id}" aria-label="Total goal for ${esc(items[id].name)}" type="number" min="1" max="100000000" step="1" value="${q}"></label></div></div><label class="targetquantity" for="target-${id}"><span>${items[id].craftable?'Craft quantity':'Collect quantity'}</span><span class="target-split-control"><input id="target-${id}" data-quantity="${id}" aria-label="${items[id].craftable?'Craft':'Collect'} quantity for ${esc(items[id].name)}" type="number" min="0" max="${q}" step="1" value="${remaining}"><button type="button" data-target-max="craft" data-target-id="${id}" aria-label="${items[id].craftable?'Craft':'Collect'} all ${esc(items[id].name)}">Max</button></span></label><div class="target-inventory"><label class="targetquantity" for="provided-${id}"><span class="external-supply-label" tabindex="0" title="${externalSupplyHelp}">Sourced externally</span><span class="target-split-control"><input id="provided-${id}" data-inventory-quantity="${id}" aria-label="Sourced externally for ${esc(items[id].name)}" title="${externalSupplyHelp}" type="number" min="0" max="${q-supply.routeCapacity}" step="1" value="${supplied}"><button type="button" data-target-max="inventory" data-target-id="${id}" aria-label="Source remaining ${esc(items[id].name)} externally">Max</button></span></label><small id="target-route-${id}" title="Unused route output put toward this goal, after other crafts." ${supply.fromRoute?'':'hidden'}>${fmt(supply.fromRoute)} from route</small>${remaining?`<small data-target-savings="${id}"></small>`:''}</div><button class="iconbutton" type="button" data-remove="${id}" aria-label="Remove ${esc(items[id].name)}">×</button></div>`;
 }).join('');
 updateTargetSavings();
}
function updateTargetSavings(){
 document.querySelectorAll('[data-target-savings]').forEach(el=>{
  const row=targetSavings?.items?.[el.dataset.targetSavings],q=row?.explores_saved,base=targetSavings?.baseline_explores;
  el.textContent=Number.isFinite(q)?(q>=0?`Max saves ≈ ${fmt(Math.floor(q))} explores${base>0?' · '+(100*q/base).toFixed(1)+'%':''}`:`Max adds ≈ ${fmt(Math.ceil(-q))} explores`):row?.unavailable||targetSavings?.unavailable?'Estimate unavailable':'Estimating explore savings…';
  el.title='Estimated savings if you source the remaining goal externally, after unused route output. Uses the last completed comparison, including shared drops and inventory. Leftover crafts may change the final route; estimates are not additive.';
 });
}
function syncTargetInputs(id){
 const supply=targetSupply(id);
 $('goal-'+id).value=supply.total;$('target-'+id).max=supply.total;$('provided-'+id).max=supply.total-supply.routeCapacity;
 $('target-'+id).value=supply.craft;$('provided-'+id).value=supply.external;
 const note=$('target-route-'+id);if(note){note.textContent=fmt(supply.fromRoute)+' from route';note.hidden=!supply.fromRoute;}
}
function provideTarget(id){TargetCosts.provide(state,id);inventoryRows();changed();}
function undoProvidedTarget(id){TargetCosts.undo(state,id);inventoryRows();changed();}

function changed(refreshTargets=true){if(refreshTargets)targets();state.secondary=state.secondary.filter(r=>!state.targets[r.item_id]);save();revision++;if(state.planner_mode!=='passive'&&!Object.keys(state.targets).length){clearTimeout(timer);resetEmptyPlan();return;}$('resultContent').classList.add('stale');$('status').textContent='Recalculating… Showing the last completed plan.';window.dispatchEvent(new Event('planner-calculating'));clearTimeout(timer);timer=setTimeout(calculate,350);}

function eligibleTarget(item){return !!(item?.craftable||item?.explorable);}
function addTarget(id,quantity){if(!eligibleTarget(items[id])||!Number.isInteger(quantity)||quantity<1||quantity>100000000)throw Error('Choose a crafting or exploration item and a positive whole quantity.');const total=(state.targets[id]||0)+quantity;if(total>100000000)throw Error('Target quantity is too large.');state.targets[id]=total;targets();changed();}

$('addForm').addEventListener('submit',e=>{e.preventDefault();try{const name=$('itemInput').value.trim();const item=Object.values(items).find(i=>eligibleTarget(i)&&(i.name.toLowerCase()===name.toLowerCase()||i.id===name));if(!item)throw Error('Select a craftable item or a raw exploration drop.');addTarget(item.id,Number($('quantityInput').value));$('itemInput').value='';error('');}catch(e){error(e.message);}});

$('targets').addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.targetMax){const id=b.dataset.targetId;TargetCosts.setProvided(state,id,b.dataset.targetMax==='inventory'?state.targets[id]:0);syncTargetInputs(id);inventoryRows();changed(false);return;}if(b.dataset.remove){TargetCosts.undo(state,b.dataset.remove);delete state.targets[b.dataset.remove];inventoryRows();changed();}});

function clampTargetInput(field){
 const inventory=field.dataset.inventoryQuantity,id=inventory||field.dataset.quantity;
 if(!id||field.value===''||!Number.isFinite(Number(field.value)))return;
 const {total,routeCapacity}=targetSupply(id),value=Math.max(0,Math.min(total-(inventory?routeCapacity:0),Math.trunc(Number(field.value))));
 if(Number(field.value)!==value)field.value=String(value);
 $(inventory?'target-'+id:'provided-'+id).value=inventory?total-routeCapacity-value:Math.max(0,total-value-routeCapacity);
 return value;
}
$('targets').addEventListener('input',e=>clampTargetInput(e.target));

$('targets').addEventListener('change',e=>{
 const totalId=e.target.dataset.totalQuantity,inventoryId=e.target.dataset.inventoryQuantity,id=totalId||inventoryId||e.target.dataset.quantity;if(!id)return;
 try{const n=Number(e.target.value);if(e.target.value===''||!Number.isSafeInteger(n))throw Error('Enter a whole quantity.');
  if(totalId)TargetCosts.setTotal(state,id,n);
  else {const bounded=clampTargetInput(e.target);TargetCosts.setProvided(state,id,inventoryId?bounded+targetSupply(id).routeCapacity:state.targets[id]-bounded);}
  error('');syncTargetInputs(id);inventoryRows();changed(false);
 }catch(e){syncTargetInputs(id);error(e.message);}
});

function modeHelp(){$('modeHelp').textContent=state.mode==='best'?'Areas with zero explores are removed; duplicate results are merged.':'Every selected area must receive at least one explore. Slower pairs are kept.';}


$('mode').addEventListener('change',()=>{state.mode=$('mode').value;modeHelp();changed();});



function inventoryData(){return JSON.parse((state.planner_mode==='passive'?state.passive_inventory:state.inventory)||'{}');}
function setInventory(stock){state[state.planner_mode==='passive'?'passive_inventory':'inventory']=JSON.stringify(stock);}

function startingSupplyReport(plan){
 const rows=(plan?.item_balances||[]).filter(b=>b.starting_inventory>0&&b.consumed_by_crafting>0);
 $('startingConsumed').hidden=!rows.length;
 $('startingConsumed').innerHTML=rows.length?`<h3>Starting ingredients consumed</h3><p class="hint">For this plan. Automatically added supplies must come from your farm or another source outside exploration.</p><div class="starting-supplies">${rows.map(b=>`<div>${itemName(b.item_id,b.name)}<strong>${fmt(Math.ceil(Math.min(b.starting_inventory,b.consumed_by_crafting)-1e-8))}</strong>${b.auto_starting_inventory?`<small>${fmt(b.auto_starting_inventory)} automatically added</small>`:'<small>From your inventory</small>'}</div>`).join('')}</div><p class="hint">Supply amounts round up to whole items.</p>`:'';
 const auto=(plan?.item_balances||[]).filter(b=>b.auto_starting_inventory>0);
 $('autoInventory').hidden=!auto.length;
 $('autoInventory').innerHTML=auto.length?`<h3>Automatically supplied</h3><p class="hint">Bring these from outside exploration. Amounts follow the plan; select an ingredient on the map to set your own limit.</p><div class="starting-supplies">${auto.map(b=>`<div>${itemName(b.item_id,b.name)}<strong>${fmt(b.auto_starting_inventory)}</strong></div>`).join('')}</div>`:'';
}

function inventoryBadge(){const n=Object.values(inventoryData()).filter(q=>q>0).length;$('inventoryCount').textContent=n?`(${n} items)`:'';}

function inventoryRows(){const stock=inventoryData(),presets=catalog.passive_inputs||[],presetIds=new Set(presets.map(p=>p.item_id));const groups=new Map();for(const p of presets){const group=p.sources.join(' / ');if(!groups.has(group))groups.set(group,[]);groups.get(group).push(p.item_id);}const extra=Object.keys(stock).filter(id=>!presetIds.has(id));if(extra.length)groups.set('Other items',extra);

 $('inventoryRows').innerHTML=[...groups].map(([group,ids])=>`<div class="inventorygroup"><h3>${esc(group)}</h3>${ids.map(id=>`<div class="inventoryrow"><label for="stock-${id}">${itemName(id,items[id].name)}</label><input id="stock-${id}" data-stock="${id}" aria-label="Available ${esc(items[id].name)}" type="number" min="0" max="1000000000000" step="1" value="${stock[id]||0}">${presetIds.has(id)?'<span></span>':`<button type="button" class="iconbutton" data-remove-stock="${id}" aria-label="Remove ${esc(items[id].name)} from inventory">×</button>`}</div>`).join('')}</div>`).join('');inventoryBadge();}

function initializeInventory(){const old=inventoryData(),stock={};if(!old||Array.isArray(old)||typeof old!=='object')throw Error('Saved inventory is not an item-to-quantity object.');for(const [key,q] of Object.entries(old)){const item=items[key]||Object.values(items).find(i=>i.name.toLowerCase()===key.toLowerCase());if(!item||typeof q!=='number'||!Number.isFinite(q)||q<0)throw Error('Saved inventory contains an invalid item or quantity: '+key);stock[item.id]=(stock[item.id]||0)+q;}setInventory(stock);$('inventoryItems').innerHTML=Object.values(items).sort((a,b)=>a.name.localeCompare(b.name)).map(i=>`<option value="${esc(i.name)}" label="${esc(i.name)}${globalThis.TOWER_MM.items[i.id]?' · MM · Tower '+globalThis.TOWER_MM.items[i.id].join(', '):''}${globalThis.TOWER_MM.gm_items[i.id]?' · GM · Tower '+globalThis.TOWER_MM.gm_items[i.id].join(', '):''}${i.mailable?' · Mailable':''}"></option>`).join('');inventoryRows();}

$('inventoryRows').onchange=e=>{const id=e.target.dataset.stock;if(!id||!e.target.reportValidity())return;const stock=inventoryData();stock[id]=Number(e.target.value);setInventory(stock);inventoryBadge();changed();};

$('inventoryRows').onclick=e=>{const b=e.target.closest('[data-remove-stock]');if(!b)return;const stock=inventoryData();delete stock[b.dataset.removeStock];setInventory(stock);inventoryRows();changed();};

$('inventoryForm').onsubmit=e=>{e.preventDefault();try{const name=$('inventoryItem').value.trim(),item=items[name]||Object.values(items).find(i=>i.name.toLowerCase()===name.toLowerCase());if(!item)throw Error('Choose an item from the list.');const quantity=Number($('inventoryQuantity').value),stock=inventoryData();if(!Number.isSafeInteger(quantity)||quantity<0||(stock[item.id]||0)+quantity>1e12)throw Error('Enter a whole quantity from 0 to 1,000,000,000,000.');stock[item.id]=(stock[item.id]||0)+quantity;setInventory(stock);inventoryRows();$('inventoryItem').value='';$('inventoryError').hidden=true;changed();$('stock-'+item.id).focus();}catch(e){$('inventoryError').hidden=false;$('inventoryError').textContent=e.message;}};

function areas(){$('areaChoices').innerHTML=catalog.locations.map(a=>`<label class="check"><input type="checkbox" data-area="${a.id}" ${state.areas.includes(a.id)?'checked':''}> <span class="areaicon" aria-hidden="true">⌖</span>${esc(a.name)}</label>`).join('');$('areaCount').textContent=`${state.areas.length} enabled`;ciderSettings();}

$('areaChoices').addEventListener('change',()=>{state.areas=[...$('areaChoices').querySelectorAll('input:checked')].map(i=>i.dataset.area);$('areaCount').textContent=`(${state.areas.length})`;changed();});


$('compute').onclick=()=>{revision++;clearTimeout(timer);calculate();};

async function calculate(){state.secondary=state.secondary.filter(r=>!state.targets[r.item_id]);const token=++revision;error('');if(state.planner_mode!=='passive'&&!Object.keys(state.targets).length){resetEmptyPlan();return;}let payload;try{payload={map_planning:state.map_planning===true,map_sources:state.map_sources||{},map_node_usage:state.map_node_usage||{},map_source_explores:state.map_source_explores,planner_mode:state.planner_mode,production_interval:state.production_interval,targets:state.planner_mode==='passive'?{}:activeTargets(),provided_targets:state.provided_targets,estimate_inventory_savings:true,secondary:state.secondary.map(r=>state.map_planning?craftMapGoalIntent(items,state,r):r).map(r=>({item_id:r.item_id,allow_exploration:r.allow_exploration,cap:r.cap,prioritize:r.prioritize===true,automatic_batch:r.automatic_batch===true,user_cap:r.user_cap===true,consumer_mode:r.consumer_mode,demand_group:r.demand_group,demand_basis:r.demand_basis,demand_percent:r.demand_percent})),areas:[...state.areas],automatic_areas:state.automatic_areas?.filter(id=>state.areas.includes(id))||null,iron_depot:state.iron_depot,runecube:state.runecube,cockatrice_ether_source:state.cockatrice_ether_source,cockatrice_ether_source:state.cockatrice_ether_source,resource_saver:state.resource_saver,combinations_mode:state.mode==='combinations',inventory:inventoryData()};}catch{error('Starting inventory must be valid JSON, for example {"Wood": 100}.');$('status').textContent='Check starting inventory.';$('compute').disabled=false;$('status').classList.remove('loading');return;}

const settingsKey=JSON.stringify({...payload,targets:null,secondary:null});$('compute').disabled=true;$('status').textContent=result?'Recalculating… Showing the last completed plan.':'Finding exploration plans…';window.dispatchEvent(new Event('planner-calculating'));$('status').classList.add('loading');$('resultContent').classList.add('stale');try{let published=false;const {job_id}=await api('/api/plan',payload);while(token===revision){const job=await api('/api/jobs/'+job_id);if(token!==revision)return;if(job.status==='error')throw Object.assign(Error(job.error),{inventory_shortfalls:job.inventory_shortfalls});if(job.status==='complete'||job.status==='comparisons'){if(published){result=job.result;if(result.inventory_savings?.complete||result.inventory_savings?.unavailable){targetSavings=result.inventory_savings;updateTargetSavings();}for(const row of result.plans[selected].secondary?.targets||[]){const label=document.querySelector(`[data-leftover-id="${row.item_id}"] .leftover-amount small`);if(label)label.textContent=comparisonLabel(row);}if(job.status==='complete')return;await new Promise(r=>setTimeout(r,500));continue;}published=true;result=job.result;selected=restorePlanChoice(result.plans,state);targets(true);if(result.inventory_savings?.complete||result.inventory_savings?.unavailable){targetSavings=result.inventory_savings;updateTargetSavings();}if(state.map_planning&&state.map_source_explores==null&&result.plans[selected]?.map_source_explores)state.map_source_explores=result.plans[selected].map_source_explores;rememberPlanChoice();const best=result.plans[0].optimal_total_explores;const delta=lastSuccess&&lastSuccess.settingsKey===settingsKey?best-lastSuccess.best:null;render(delta);lastSuccess={best,settingsKey};$('status').textContent='Plan ready';$('compute').disabled=false;$('status').classList.remove('loading');if(job.status==='complete')return;await new Promise(r=>setTimeout(r,500));continue;}$('status').textContent=(job.total?'Calculating your route…':(job.message||'Optimizing shared ingredients…'))+(result?' Showing the last completed plan.':'');await new Promise(r=>setTimeout(r,500));}}catch(e){if(token===revision){targetSavings={unavailable:true};updateTargetSavings();error(e.message.split(/\n/).filter(Boolean).at(-1).replace(/^(?:planner\.)?(?:InfeasiblePlan|ValueError): /,''),e.inventory_shortfalls);$('status').textContent='Could not calculate this plan. Adjust targets, inventory, or areas.';}}finally{if(token===revision){$('compute').disabled=false;$('status').classList.remove('loading');}}}

function render(delta){const gap=result.plans[0]?.solver?.maximum_gap_explores||0;$('solverPrecision').hidden=!gap;$('solverPrecision').textContent=gap?'Each large-route optimization allows up to 5 extra explores for its fixed crafting goals to avoid long waits.':'';$('empty').hidden=true;$('resultContent').hidden=false;$('resultContent').classList.remove('stale');$('totalExplores').textContent=fmt(result.plans[0].optimal_total_explores);$('optionCount').textContent=result.plans.length;$('scope').textContent='All selected areas available';$('delta').textContent=delta===null?'—':`${delta>0?'+':''}${fmt(delta)}`;$('deltaCaption').textContent=delta===null?'Same settings required to compare':'explores vs previous target list';$('rawMaterials').innerHTML=result.raw_materials_needed.map(r=>`<span class="material">${itemName(r.item_id,r.name)} <strong>${fmt(r.quantity)}</strong>${r.free_with_perk?' · free':''}</span>`).join('');planChoices();detail();costPreview();}

function planIdentity(plan){return plan.area_set_id||plan.areas.map(a=>a.location_id).sort().join('|')||'no-exploration';}
function restorePlanChoice(plans,settings){const match=settings.selected_plan_key?plans.findIndex(p=>planIdentity(p)===settings.selected_plan_key):-1;return match>=0?match:Math.min(Math.max(0,settings.selected_plan||0),Math.max(0,plans.length-1));}
function rememberPlanChoice(){state.selected_plan=selected;state.selected_plan_key=result?.plans[selected]?planIdentity(result.plans[selected]):'';save();}
function rankedPlanMetrics(plans,ingredients){return plans.map(p=>({explores:p.optimal_total_explores,areas:p.areas.filter(a=>a.explores>0).length,types:p.item_balances.filter(b=>ingredients.has(b.item_id)&&availableUnused(b)>1e-8).length,unused:p.item_balances.filter(b=>ingredients.has(b.item_id)).reduce((n,b)=>n+Math.max(0,availableUnused(b)),0)}));}
function planChoices(){const metrics=rankedPlanMetrics(result.plans,craftingIngredientIds());const minimum=Object.fromEntries(['explores','areas','unused','types'].map(k=>[k,Math.min(...metrics.map(m=>m[k]))]));
$('planChoices').innerHTML=result.plans.map((p,i)=>`<button type="button" class="planchoice ${i===selected?'selected':''}" data-plan="${i}" aria-pressed="${i===selected}"><span class="rank">${String(i+1).padStart(2,'0')}</span><strong>${fmt(p.optimal_total_explores)}</strong><span class="planbadges">${[['explores','MINIMUM EXPLORES','Lowest explore count among these plans'],['areas','MINIMUM AREAS','Fewest exploration areas among these plans'],['unused','MIN TOTAL UNUSED MATERIALS','Lowest total quantity of unused crafting materials among these plans; not the number of item types'],['types','MIN UNUSED MATERIAL TYPES','Fewest distinct unused crafting materials among these plans, regardless of their quantities']].filter(([key])=>Math.abs(metrics[i][key]-minimum[key])<=1e-6).map(([key,label,description])=>`<span class="planbadge planbadge-${key}" title="${description}">${label}</span>`).join('')}</span><span class="route">${p.areas.map(a=>esc(a.name)).join(' + ')||'No exploration'}</span><small>${metrics[i].areas} areas · ${fmt(Math.floor(metrics[i].unused))} unused items · ${metrics[i].types} material types</small></button>`).join('');}

$('planChoices').addEventListener('click',e=>{const b=e.target.closest('[data-plan]');if(b){selected=Number(b.dataset.plan);rememberPlanChoice();planChoices();detail();}});

function detail(){const p=result.plans[selected];$('planDetail').innerHTML=`<p class="hint">Pick a material to find crafts that use it. These are totals for the whole plan: what’s left and what your leftover crafts use. Finished leftover crafts are included; your primary targets are kept aside. You can still pick materials showing 0.</p><button type="button" id="startGuided" class="primary">Guide me through leftovers</button> <button type="button" id="suggestAll" class="primary">Suggest item</button> <button type="button" id="automaticMaximize" class="primary">Automatic Maximize</button><p class="hint">Try a leftover plan automatically, then compare before applying.</p>${state.automatic_areas?`<p class="hint">Automatic plan: checked crafts aim for their chosen batch caps. Extra exploring is limited to ${state.automatic_areas.map(id=>esc(catalog.locations.find(a=>a.id===id)?.name||id)).join(', ')}. <button type="button" id="clearAutomaticAreas">Allow all available areas</button></p>`:''}<label class="sr" for="unusedSearch">Filter unused items</label><input id="unusedSearch" placeholder="Search materials…"><table class="unusedtable"><thead><tr><th>Material</th><th>Expected unused*</th><th>Used by leftover craft*</th></tr></thead><tbody id="unusedRows"></tbody></table><p class="hint">*Rounded down to whole items. Calculations use the full values.</p>`;unused();$('unusedSearch').oninput=unused;summaryCosts();secondaryRows(true);implicitRows(p);renderRoute();startingSupplyReport(p);window.dispatchEvent(new Event('planner-result'));}

function implicitRows(p){

 const explicit=new Set([...p.targets.map(t=>t.item_id),...(p.secondary?.targets||[]).map(t=>t.item_id)]),counts=new Map();

 for(const c of [...p.crafts_in_dependency_order,...(p.secondary?.crafts_in_dependency_order||[])])if(c.crafts>0&&!explicit.has(c.item_id)){const row=counts.get(c.item_id)||{...c,crafts:0};row.crafts+=c.crafts;counts.set(c.item_id,row);}

 $('secondarySection').hidden=false;$('implicitCrafts').innerHTML=`<details><summary>Ingredients crafted along the way <span class="badge">${counts.size}</span></summary><p class="hint">These crafts make the ingredients your chosen items need. </p>${[...counts.values()].map(c=>`<div class="implicitrow">${itemName(c.item_id,c.name)}<strong>${fmt(c.crafts)} <small>crafts</small></strong></div>`).join('')||'<p class="hint">No other ingredients need crafting.</p>'}</details>${p.item_balances.some(b=>b.free_perk_supply)?`<details><summary>Free perk supplies</summary><p class="hint">${p.item_balances.filter(b=>b.free_perk_supply).map(b=>`${itemName(b.item_id,b.name)} ${fmt(b.free_perk_supply)}`).join(' · ')}</p></details>`:''}`;

 $('implicitCrafts').classList.remove('stale');$('leftoverMaterials').classList.remove('stale');

}

function availableUnused(row){return (row.expected_unused||0)+(row.reserved_secondary_output||0);}
function craftingIngredientIds(){return new Set(Object.values(items).flatMap(i=>Object.keys(i.direct_ingredients||{})));}
function unused(){const q=$('unusedSearch').value.toLowerCase(),ingredients=craftingIngredientIds();$('unusedRows').innerHTML=result.plans[selected].item_balances.filter(r=>ingredients.has(r.item_id)).filter(r=>r.expected_unused>1e-8||r.used_by_leftover_craft>0||r.expected_exploration_drops>0||r.starting_inventory>0||r.reserved_secondary_output>0||r.original_leftover_pool>0).filter(r=>r.name.toLowerCase().includes(q)).sort((a,b)=>availableUnused(b)-availableUnused(a)).map(r=>`<tr><td><button class="materialbutton" type="button" data-consumer="${r.item_id}">${itemName(r.item_id,r.name)}</button></td><td>${fmt(Math.floor(availableUnused(r)))}</td><td>${fmt(Math.floor(r.used_by_leftover_craft||0))}</td></tr>`).join('')||'<tr><td colspan="3">No materials match.</td></tr>';}

$('planDetail').addEventListener('click',e=>{const b=e.target.closest('[data-consumer]');if(b)showConsumers(b.dataset.consumer,b);});

let consumerRevision=0;

let suggestionMaterial=null;
// Keep the picker near its material, using viewport coordinates even on long pages.
let consumerTrigger;
function positionConsumerDialog(){
 const dialog=$('consumerDialog');if(!dialog.open)return;
 dialog.style.removeProperty('left');dialog.style.removeProperty('top');
 if(innerWidth<=800||!consumerTrigger?.isConnected)return;
 const anchor=consumerTrigger.getBoundingClientRect(),box=dialog.getBoundingClientRect(),gap=12;
 const left=Math.max(gap,Math.min(anchor.left,innerWidth-box.width-gap));
 const top=Math.max(gap,Math.min(anchor.bottom+gap,innerHeight-box.height-gap));
 dialog.style.left=left+'px';dialog.style.top=top+'px';
}
window.addEventListener('resize',positionConsumerDialog);
new ResizeObserver(positionConsumerDialog).observe($('consumerList'));
async function showConsumers(id,trigger){suggestionMaterial=id;const token=++consumerRevision;$('consumerTitle').innerHTML='Craft with '+itemName(id,items[id].name);$('consumerSearch').value='';$('consumerList').textContent='Finding recipes…';consumerTrigger=trigger;$('consumerDialog').showModal();positionConsumerDialog();try{const rows=await api('/api/consumers/'+id);if(token!==consumerRevision)return;consumers=rows;consumerList();}catch(e){$('consumerList').textContent=e.message;}}

function consumerList(){const q=$('consumerSearch').value.toLowerCase(),matches=consumers.filter(c=>c.name.toLowerCase().includes(q));$('consumerList').innerHTML=[true,false].map(direct=>{const rows=matches.filter(c=>Boolean(c.direct)===direct);return rows.length?`<section class="consumergroup"><h3>${direct?'Direct crafts':'Indirect crafts'} <span class="badge">${rows.length}</span></h3><p class="hint">${direct?'Recipes that use this item.':'Make an ingredient first, then use it in these recipes.'}</p>${rows.map(c=>`<div class="consumer"><div><strong>${itemName(c.id,c.name)}</strong><small>${state.secondary.some(r=>r.item_id===c.id)?'Already in leftover list':state.targets[c.id]?'Already a primary target':''}</small></div><button type="button" data-add-consumer="${c.id}" ${state.targets[c.id]||state.secondary.some(r=>r.item_id===c.id)?'disabled':''}>+ Use leftovers</button></div>`).join('')}</section>`:'';}).join('')||'<p class="hint">No craftable items match this material.</p>';}
$('consumerSearch').oninput=consumerList;$('closeDialog').onclick=()=>{$('consumerDialog').close();consumerRevision++;};

$('consumerList').addEventListener('click',e=>{const b=e.target.closest('[data-add-consumer]');if(!b)return;try{addSecondary(b.dataset.addConsumer,suggestionMaterial);$('consumerDialog').close();}catch(e){error(e.message);}});

(async()=>{try{catalog=await api('/api/catalog');if(catalog.planner_api_version!==2)throw Error('The catalog and app versions don’t match. Rebuild the static files and refresh.');items=Object.fromEntries(catalog.items.map(i=>[i.id,i]));let saved;try{saved=JSON.parse(localStorage.getItem('farm-workshop-v1'));}catch{}state={...(saved?withSettingDefaults(saved):starterPlan()),...GlobalSettings.initialize(saved,catalog.locations)};state.secondary=Array.isArray(state.secondary)?state.secondary.filter((r,i,a)=>items[r.item_id]?.craftable&&a.findIndex(x=>x.item_id===r.item_id)===i).map(r=>({item_id:r.item_id,allow_exploration:r.allow_exploration===true,prioritize:r.prioritize===true,automatic_batch:r.automatic_batch===true,user_cap:r.user_cap===true,consumer_mode:r.consumer_mode,demand_group:r.demand_group,demand_basis:r.demand_basis,demand_percent:r.demand_percent,cap:Number.isInteger(r.cap)&&r.cap>=0?r.cap:null,exploration_item_id:explorationIngredients(r.item_id).includes(r.exploration_item_id)?r.exploration_item_id:null})):[];state.targets=Object.fromEntries(Object.entries(state.targets||{}).filter(([id,q])=>eligibleTarget(items[id])&&Number.isInteger(q)&&q>0));state.areas=state.areas===null?catalog.locations.filter(a=>!['explore:11','explore:14'].includes(a.id)).map(a=>a.id):state.areas.filter(id=>catalog.locations.some(a=>a.id===id));$('catalogMeta').textContent=`${catalog.items.filter(eligibleTarget).length} available targets`;$('craftableItems').innerHTML=catalog.items.filter(eligibleTarget).sort((a,b)=>a.name.localeCompare(b.name)).map(i=>`<option value="${esc(i.name)}" label="${esc(i.name)}${globalThis.TOWER_MM.items[i.id]?' · MM · Tower '+globalThis.TOWER_MM.items[i.id].join(', '):''}${globalThis.TOWER_MM.gm_items[i.id]?' · GM · Tower '+globalThis.TOWER_MM.gm_items[i.id].join(', '):''}${i.mailable?' · Mailable':''}"></option>`).join('');settingIcons();theme();$('sprintShoes').value=state.sprint_shoes;ciderSettings();for(const [id,key] of [['resourceSaver','resource_saver'],['wanderer','wanderer']])$(id).value=state[key];for(const [id,key] of [['lemonSqueezer','lemon_squeezer'],['cinnamon','cinnamon']])$(id).checked=state[key];targets();window.dispatchEvent(new Event('planner-settings-saved'));secondaryRows();areas();$('ironDepot').checked=state.iron_depot;$('runecube').checked=state.runecube;$('cockatriceEtherSource').checked=state.cockatrice_ether_source;$('cockatriceEtherSource').checked=state.cockatrice_ether_source;$('mode').value=state.mode;initializeInventory();plannerModeUI();modeHelp();window.dispatchEvent(new Event('global-settings-ready'));if($('plannerPage').hidden)settingsRecalculationPending=true;else await calculate();if(document.modelContext?.registerTool){Promise.resolve(document.modelContext.registerTool({name:'add_crafting_target',description:'Add a crafting target to the visible list and recalculate the exploration plans.',inputSchema:{type:'object',properties:{item:{type:'string'},quantity:{type:'integer',minimum:1}},required:['item','quantity'],additionalProperties:false},execute:async({item,quantity})=>{const found=Object.values(items).find(i=>i.id===item||i.name===item);if(!found)throw Error('Unknown item');addTarget(found.id,quantity);clearTimeout(timer);await calculate();if(!$('error').hidden)throw Error($('error').textContent);return {targets:state.targets,cheapest_explores:result?.plans[0]?.optimal_total_explores};}})).catch(()=>{});}}catch(e){error(e.message);$('status').textContent='Could not load the catalog.';$('globalSettingsStatus').textContent='Could not load settings: '+e.message;}})();



function costPreview(){try{const c=explorationCosts(result.plans[0],catalog.locations,state);const a=c.rows[0],d=c.rows.find(r=>r.method==='Cider');$('costPreview').textContent=`≈ ${fmt(a.drinks)} APs or ${fmt(d.drinks)} Ciders + ${fmt(d.stamina)} stamina · no food`;}catch(e){$('costPreview').textContent=e.message;}}

function costReport(p){try{

 const c=explorationCosts(p,catalog.locations,state),range=(a,b)=>a===b?fmt(a):`${fmt(a)}–${fmt(b)}`;

 return `<details class="costreport"><summary>AP, Cider &amp; food comparison <span class="comparisoncaption">· ${fmt(p.optimal_total_explores)} explores</span></summary><p class="hint">Compare drinks and foods for this route. Drink counts round up in each area; the materials table doesn’t include any extra drops from that rounding.</p><div class="tablewrap"><table><thead><tr><th>Method / food</th><th>Drinks</th><th>Stamina</th><th>Clicks¹</th></tr></thead><tbody>${c.rows.map(r=>`<tr><td><strong>${itemName(r.method==='AP'?'Arnold Palmer':'Apple Cider',r.method)}</strong> · ${r.foods==='None'?'None':r.foods.split(' + ').map(n=>itemName(n,n)).join(' + ')}${r.uncertain?' †':''}${r.seltzers?`<small>${range(r.seltzers,r.seltzers_high)} Seltzers (50 drink uses each)</small>`:''}</td><td>${range(r.drinks,r.drinks_high)}</td><td>${fmt(r.stamina)}</td><td>${range(r.clicks,r.clicks_high)}</td></tr>`).join('')}</tbody></table></div><p class="hint">Manual exploration: ≈ ${fmt(c.manual_stamina)} stamina. Costs exclude crafting drinks, food ingredients, and stamina recovered from drops. Cabbage Stew enables up to 5 Ciders per click for 2 min. Timed buffs must remain active throughout use; meal counts depend on your pace. ¹ Single-use controls, with up to 5 APs per click under Lemon Cream Pie; hold-to-use can change interactions.</p><p class="hint"><strong>Acorn Pie:</strong> adds Hide to exploration drops. Its area-specific rate is missing from the catalog, so Acorn Pie combinations cannot yet be calculated. The displayed plans assume no Acorn Pie.</p><details><summary>Food effects & assumptions</summary><p class="hint">Quandary Chowder: +10% AP yield for 5 min. Lemon Seltzer: +50% yield for 50 drink uses. † Combined yield is shown as a range (+60% to +65%): additive versus multiplicative stacking is not yet verified. Lemon Cream Pie: up to 5 APs per click for 2 min. Neigh: 20% less Cider stamina for 5 min.</p><p class="hint">Onion Soup (+10% exploring XP, 5 min) can accompany these rows without changing costs. Neigh and Cabbage Stew have no effect on APs; Chowder, Seltzer and Lemon Cream Pie have no effect on Cider. Protein Bars are permanent area upgrades: include them in the Exploration Effectiveness upgrade count. Apple Pie, Cranberry Juice, apples and Orange Juice affect your stamina supply, not the stamina required.</p><p class="hint">Mushroom Stew gives +10% mastery for 5 min, without changing item output or material costs. These targets remain crafted item counts. Expected target mastery with Stew: ${p.targets.filter(t=>items[t.item_id]?.craftable).map(t=>`${esc(t.name)} ${fmt(t.craft_quantity*1.1)}`).join(' · ')||'No crafting targets'}. Batch rounding and buff timing are not modeled.</p><p class="hint">The upgrade model uses effectiveness = (1 + upgrades) × 2^Sprint Shoes tier, and Cider capacity = (1,000 + 10 × effectiveness) × 1.25 with Cinnamon Sticks. The upgrade conversion is inferred from reported examples and still needs an in-game formula check. Cider estimates use Buddy’s 40% base drop probability and your Exploration Effectiveness upgrades and Sprint Shoes. The rate shown beside each area is its normal-explore equivalent per Cider. The remaining meals affect farming, fishing, pets, production, selling, friendship, cooking, chat or the Wheel, rather than these exploration costs.</p><p class="hint">Sources: <a href="https://github.com/coderanger/buddy.farm/blob/main/src/utils/format.tsx" target="_blank" rel="noreferrer">Buddy conversion formulas</a> · <a href="https://farmrpg.com/supply.php" target="_blank" rel="noreferrer">perks</a> · <a href="https://buddy.farm/i/neigh/" target="_blank" rel="noreferrer">Neigh</a> · <a href="https://buddy.farm/i/quandary-chowder/" target="_blank" rel="noreferrer">Chowder</a> · <a href="https://www.reddit.com/r/FarmRPG/comments/1josyvt/" target="_blank" rel="noreferrer">Seltzer release notes (reposted)</a></p></details></details>`;

 }catch(e){return `<p class="hint">${esc(e.message)}</p>`;}}



function summaryCosts(){const open=$('summaryCosts').querySelector('.costreport')?.open||false;$('summaryCosts').innerHTML=costReport(result.plans[selected]);const report=$('summaryCosts').querySelector('.costreport');if(report)report.open=open;}



function explorationIngredients(id){const seen=new Set();function visit(ref){for(const child of Object.keys(items[ref]?.direct_ingredients||{})){if(seen.has(child))continue;seen.add(child);visit(child);}}visit(id);return [...seen];}
function addSecondary(id,ingredient=null){if(state.targets[id])throw Error('This item is already a primary target.');if(!items[id]?.craftable)throw Error('Choose a craftable item.');if(state.secondary.some(r=>r.item_id===id))return;state.secondary.push({item_id:id,allow_exploration:false,cap:null,exploration_item_id:ingredient});changed();}

function leftoverBottleneck(goal,row,plan){
 if(!row||!plan?.item_balances||(goal.cap!=null&&row.crafts>=goal.cap))return null;
 const stock=Object.fromEntries(plan.item_balances.map(b=>[b.item_id,Math.max(0,(b.expected_final_inventory||0)-(b.reserved_target_output||0))]));
 return leftoverNeeds(items,stock,state,{...goal,exploration_item_id:null},row.crafts);
}
function bottleneckLabel(goal,row,plan,bodyOnly=false){
 const b=leftoverBottleneck(goal,row,plan);if(!b)return '';
 if(!bodyOnly)return `<button type="button" class="ingredienttoggle" data-ingredient-toggle="${goal.item_id}" aria-expanded="false" aria-controls="ingredient-details-${goal.item_id}" aria-label="Ingredient needs for ${esc(items[goal.item_id].name)}" title="Show ingredient needs"><span aria-hidden="true">▸</span></button>`;
 const rows=amounts=>Object.entries(amounts).map(([id,q])=>`<button type="button" class="needs-item" data-needs-item="${id}" data-needs-parent="${goal.item_id}" data-needs-quantity="${Math.ceil(q-1e-8)}" data-needs-focus="${b.focus||''}" aria-label="Add ${Math.ceil(q-1e-8)} ${esc(items[id].name)} for ${esc(items[goal.item_id].name)}">${itemName(id,items[id].name)}<strong>${fmt(Math.ceil(q-1e-8))}</strong><span aria-hidden="true">+</span></button>`).join('');
 return `<div class="bottleneckbody" id="ingredient-details-${goal.item_id}" hidden><strong>${row.crafts?'Make more':'Needs ingredients'}</strong><p>${b.focus?`Aim for ${fmt(b.batch)} ${row.crafts?'more ':''}crafts using the remaining ${itemName(b.focus,items[b.focus].name)}.`:'Supplies for one craft. No unused ingredient is available to set a larger goal yet; other crafts may already be using it.'}</p><h4>Make or supply these ingredients</h4><div class="needs-list">${rows(b.direct)}</div><h4>Missing raw materials to make them</h4><div class="needs-list">${rows(b.raw)}</div><p class="hint">Existing supplies and Resource Saver are included. Supply amounts round up so you have enough. This estimate is for this item alone; other crafts may share these materials.</p></div>`;
}
function comparisonLabel(row){return row.comparison_status==='pending'?'Checking if first…':row.comparison_status==='unavailable'?'Comparison unavailable':row.lost_to_priority?`${fmt(row.if_first)} alone on this route`:'';}
function secondaryRows(showResults=false){

 $('secondarySection').hidden=!state.secondary.length&&!result;$('secondaryCount').textContent=state.secondary.length;

 const s=showResults&&!$('resultContent').classList.contains('stale')?result?.plans[selected]?.secondary:null;

 const conflicts=priorityConflicts(items,state.secondary,state);
 $('secondaryRows').innerHTML=state.secondary.map((r,i)=>{

 const row=s?.targets.find(t=>t.item_id===r.item_id);

 return `<div class="secondaryrow leftover-card" data-leftover-id="${r.item_id}"><div class="leftover-priority"><button type="button" class="draghandle" data-drag-leftover="${r.item_id}" aria-label="Drag to reorder ${esc(items[r.item_id].name)}" title="Drag to reorder">⠿</button><button type="button" data-secondary-up="${i}" aria-label="Move ${esc(items[r.item_id].name)} up" ${i===0?'disabled':''}>↑</button><button type="button" data-secondary-down="${i}" aria-label="Move ${esc(items[r.item_id].name)} down" ${i===state.secondary.length-1?'disabled':''}>↓</button></div><div class="leftover-name"><span class="rank">${i+1}</span>${itemName(r.item_id,items[r.item_id].name)}${bottleneckLabel(r,row,result?.plans[selected])}</div><label class="leftover-cap" title="${r.automatic_batch?'Automatically chosen batch size. Extra exploring may aim for this cap; clear it to use the normal leftover limit.':'Maximum crafts, including crafts used in other recipes.'}">${r.automatic_batch?'Batch cap':'Cap'}<input type="number" data-secondary-cap="${i}" aria-label="Cap for ${esc(items[r.item_id].name)}" min="0" max="100000000" step="1" placeholder="Max" value="${r.cap??''}"></label><div class="leftover-explore"><label class="check"><input type="checkbox" data-secondary-explore="${i}" ${r.allow_exploration?'checked':''}> Explore for missing ingredients</label><label class="check"><input type="checkbox" data-secondary-prioritize="${i}" ${r.prioritize?'checked':''}> Prioritize${r.prioritize?conflicts[r.item_id]?.length?' · conflict':' · active':''}</label></div><div class="leftover-amount"><span>Planned crafts</span><strong>${row?fmt(row.crafts):'—'}</strong><small>${row?comparisonLabel(row):result?'calculating':'not planned'}</small></div><button class="iconbutton" type="button" data-secondary-remove="${i}" aria-label="Remove leftover target ${esc(items[r.item_id].name)}">×</button>

 ${conflicts[r.item_id]?.length?`<div class="leftover-note priority-warning" role="status">${conflicts[r.item_id].map(c=>`Priority conflict with ${itemName(c.item_id,items[c.item_id].name)}: both use ${(c.ingredients.filter(id=>!Object.keys(items[id].direct_ingredients||{}).length).length?c.ingredients.filter(id=>!Object.keys(items[id].direct_ingredients||{}).length):c.ingredients).map(id=>itemName(id,items[id].name)).join(', ')}.`).join(' ')} Neither gets priority until you choose one.</div>`:''}${bottleneckLabel(r,row,result?.plans[selected],true)}${externalIngredientNote(r.item_id)}
 ${row?.crafts===0&&!leftoverBottleneck(r,row,result?.plans[selected])?`<div class="leftover-note">${row.no_pool_inputs?`<p class="hint">${state.planner_mode==='passive'?'Add one of this recipe’s ingredients to your production amounts to get started.':'None of your leftovers can go into this recipe yet. Add it as a primary target to plan for it directly.'}</p>`:row.missing_for_next_craft?.length?`<p class="missinginputs">Cannot craft yet. Missing: ${row.missing_for_next_craft.map(m=>itemName(m.item_id,m.name)).join(' · ')}</p>`:''}</div>`:''}</div>`;

 }).join('');

 $('priorityStatus').textContent=!s?(result?'Allocating shared leftovers…':'Add inputs to start planning.'):s.priority_matters?`These crafts share ingredients. Use Prioritize or caps to adjust the mix; arrows only change display order.`:`These crafts can use the available ingredients without a significant tradeoff.`;

}

$('secondaryRows').onclick=e=>{const b=e.target.closest('button');if(!b)return;let i,j;if(b.dataset.secondaryRemove!==undefined){state.secondary.splice(Number(b.dataset.secondaryRemove),1);}else{if(b.dataset.secondaryUp!==undefined){i=Number(b.dataset.secondaryUp);j=i-1;}else if(b.dataset.secondaryDown!==undefined){i=Number(b.dataset.secondaryDown);j=i+1;}else return;if(j<0||j>=state.secondary.length)return;[state.secondary[i],state.secondary[j]]=[state.secondary[j],state.secondary[i]];save();secondaryRows(true);return;}changed();};

let pendingNeed=null;
$('secondaryRows').addEventListener('click',e=>{
 const button=e.target.closest('[data-needs-item]');if(!button)return;
 pendingNeed={id:button.dataset.needsItem,parent:button.dataset.needsParent,quantity:Number(button.dataset.needsQuantity),focus:button.dataset.needsFocus};
 const n=pendingNeed,item=items[n.id];
 $('needsTitle').innerHTML=itemName(n.id,item.name);
 $('needsDescription').textContent=`${fmt(n.quantity)} more ${item.name} for ${items[n.parent].name}.`;
 $('planNeeds').disabled=Object.keys(item.raw_materials||{[n.id]:1}).some(id=>!items[id]?.explorable&&!(state.iron_depot&&['22','38'].includes(id)));
 $('needsActionHint').textContent=$('planNeeds').disabled?'Add supplies you obtain outside exploration.':`Planning enables extra exploring for ${items[n.parent].name}. The solver balances the added explores with your other crafts; it may choose less than this estimate.`;
 $('bringNeeds').textContent=state.planner_mode==='passive'?'Add to production amounts':'I’ll bring these supplies';
 $('needsDialog').showModal();
});
$('closeNeeds').onclick=()=>{$('needsDialog').close();pendingNeed=null;};
$('planNeeds').onclick=()=>{
 if(!pendingNeed||$('planNeeds').disabled)return;
 const n=pendingNeed,goal=state.secondary.find(g=>g.item_id===n.parent);if(!goal)return;
 goal.allow_exploration=true;
 // The parent's recipe already includes this ingredient in the shared solver.
 // Listing it also makes its crafting output visible without reserving it.
 if(items[n.id].craftable&&!state.targets[n.id]&&!state.secondary.some(g=>g.item_id===n.id))
  state.secondary.push({item_id:n.id,allow_exploration:false,cap:null,exploration_item_id:null});
 $('needsDialog').close();pendingNeed=null;changed();
};
$('bringNeeds').onclick=()=>{
 if(!pendingNeed)return;const n=pendingNeed,stock=inventoryData();stock[n.id]=(stock[n.id]||0)+n.quantity;
 setInventory(stock);inventoryRows();$('needsDialog').close();pendingNeed=null;changed();
};

$('secondaryRows').onchange=e=>{const priority=e.target.dataset.secondaryPrioritize;if(priority!==undefined){state.secondary[Number(priority)].prioritize=e.target.checked;changed();return;}const cap=e.target.dataset.secondaryCap;if(cap!==undefined){if(!e.target.reportValidity())return;state.secondary[Number(cap)].cap=e.target.value===''?null:Number(e.target.value);changed();return;}const i=e.target.dataset.secondaryExplore;if(i===undefined)return;state.secondary[Number(i)].allow_exploration=e.target.checked;changed();};


$('routeMethod').onchange=()=>{state.route_method=$('routeMethod').value;save();renderRoute();};

function renderRoute(){if(!result||$('resultContent').classList.contains('stale'))return;$('routePanel').hidden=false;$('routeTotal').textContent=fmt(result.plans[selected].optimal_total_explores)+' expected explores';$('routePanel').classList.remove('stale');$('routeOption').hidden=state.planner_mode!=='passive';$('routeMethod').value=state.route_method||'AP';$('routeOption').textContent=state.planner_mode==='passive'?`Per ${state.production_interval===10?'10 minutes':'hour'} of production`:'';renderRouteFoods();

 try{const p=result.plans[selected],r=inventoryRoute(p,items,catalog.locations,state),drink=r.method==='AP'?'APs':'Ciders';

 $('routeCards').innerHTML=r.parts.map((a,i)=>{const groupIndex=r.activeGroups.findIndex(g=>g.start<=i&&g.end>=i),group=r.activeGroups[groupIndex];const loc=catalog.locations.find(l=>l.id===a.id);return `${i===group.start?`<section class="routegroup"><button class="routegroupbadge" type="button" data-craft-stop="group-${groupIndex}" title="${group.recipes.length?'Keep this Craftworks setup across the outlined locations':'Needed ingredients can wait until later; surplus may overflow'}" aria-label="${group.recipes.length?'Open active Craftworks setup':'Open crafting instructions after collecting'}">${group.recipes.length?'⚒ <span>Active setup</span>':'<span>Collect first · craft later</span>'}</button><div class="routegroupcards">`:""}<article class="routecard">${loc.image?`<img class="gameicon" src="${esc(loc.image)}" width="48" height="48" alt="" loading="lazy">`:'<span class="areaicon" aria-hidden="true">⌖</span>'}<small>STOP ${i+1}</small><strong>${esc(a.name)}</strong><b>${fmt(a.batch*a.perDrink)}</b><small>expected explores per loop</small><p><strong>${fmt(a.batch)} ${drink}</strong> each visit</p><small>${fmt(a.batch/r.drinksPerClick)} clicks${r.method==='Cider'?` · ${fmt(Math.ceil(a.batch*a.staminaPerDrink))} stamina`:''}</small><small>${fmt(a.explores)} explores in the original plan</small></article>${i===group.end?"</div></section>":""}${routeTransition(r,a,i)}`;}).join('')||'<p>No exploration needed.</p>';

 $('routeStatus').textContent=r.problem?`Loop estimate — inventory verification incomplete: ${r.problem}`:r.parts.length?`Repeat this circuit ${fmt(r.rounds)} ${r.rounds===1?'time':'times'}. ${fmt(r.uses)} ${drink} total${r.method==='Cider'?` + ${fmt(Math.ceil(r.stamina))} stamina`:''} · ≈ ${fmt(r.extraExplores)} extra explores from repeatable whole-drink batches. All planned crafts and targets checked against your ${fmt(r.capacity)} inventory limit. Unused exploration drops may overflow. Sell crafted surplus at the marked stops.`:state.planner_mode==='passive'?'No exploration needed. Craft from this production batch.':(!Object.keys(activeTargets()).length&&!p.crafts_in_dependency_order.length&&!p.secondary?.crafts_in_dependency_order?.length?'All primary targets are provided. No exploration or crafting needed.':'No exploration needed. Craft from starting inventory.');


 renderSurplusOverflow(r);
 renderNonCraftingDrops(result.plans[selected]);
 $('craftworksSetup').innerHTML=craftworksSetup(result.plans[selected],r);
 $('craftworksSetup').onchange=e=>{
  const input=e.target;if(!input.matches('[data-sale-loop],[data-craft-loop]')||!input.reportValidity())return;
  if(input.dataset.saleLoop!==undefined)input.closest('details').querySelector('.route-sale-rows').innerHTML=routeSaleRows(r,input.dataset.saleLoop,Number(input.value));
  else{const stop=r.craftStops.find(s=>s.id===input.dataset.craftLoop);input.closest('details').querySelector('.route-craft-rows').innerHTML=routeCraftStopRows(stop,r,Number(input.value));}
 };



 }catch(e){$('routeCards').innerHTML='';$('craftworksSetup').innerHTML='';if($('routeSurplus'))$('routeSurplus').hidden=true;$('routeStatus').textContent=e.message;}

}



function surplusOverflowReport(loop){
 const rows=loop.surplusOverflow||[];
 return `<summary>Surplus that will overflow · ${rows.length} ${rows.length===1?'item':'items'}</summary><p class="hint">These drops exceed inventory space during the route. Every planned craft and primary target still finishes. Amounts cover the whole route, including whole-drink rounding.</p><div class="craftworkstable"><table><thead><tr><th>Item</th><th>Expected overflow</th><th>Of its drops</th></tr></thead><tbody>${rows.map(row=>`<tr><td>${itemName(row.id,items[row.id]?.name||row.id)}</td><td>${fmt(row.quantity)}</td><td>${row.percent.toFixed(1)}%</td></tr>`).join('')}</tbody></table></div>`;
}
function renderSurplusOverflow(loop){
 let box=$('routeSurplus');if(!box){box=document.createElement('details');box.id='routeSurplus';$('craftworksDisclosure').after(box);}
 box.hidden=!loop.complete||!loop.surplusOverflow?.length;
 box.innerHTML=box.hidden?'':surplusOverflowReport(loop);
}

function routeBatchTiming(schedule,loop){
 if(schedule.every>=loop.rounds&&loop.rounds>1)return 'Final loop only';
 if(schedule.every>1)return `Every ${fmt(schedule.every)} loops${loop.rounds%schedule.every?' + final loop':''}`;
 return 'Each loop';
}
// Filter the current loop first, then pack dependency-ordered recipes into
// slots. Grouping recipes by frequency would put some consumers before inputs.
function routeStopBatches(stop,loop,round){
 const batches=[];
 for(const kind of ['required','optional']){
  const refs=stop.recipes.filter(id=>(stop.runs[kind+':'+id]?.[round]||0)>0);
  for(let i=0;i<refs.length;i+=loop.slots)batches.push({kind,ids:refs.slice(i,i+loop.slots)});
 }
 return batches;
}
function routeCraftStopRows(stop,loop,round){
 return routeStopBatches(stop,loop,round).map((batch,i)=>`<h4>Setup ${i+1} &middot; ${batch.kind==='required'?'Required crafts':'Optional leftovers'} &middot; ${batch.ids.length} / ${loop.slots} slots</h4><div class="craftworkstable"><table><thead><tr><th>Recipe</th><th>Crafts this loop &asymp;</th></tr></thead><tbody>${[...batch.ids].reverse().map(id=>`<tr><td>${itemName(id,items[id]?.name||id)}</td><td>${fmt(stop.runs[batch.kind+':'+id][round])}</td></tr>`).join('')}</tbody></table></div>`).join('')||'<p class="hint">No additional crafting at this stop on this loop.</p>';
}
function routeOccasionalCrafts(stop,loop){
 const refs=stop.recipes.filter(id=>loop.craftCadence?.[id]>1);if(!refs.length)return '';
 return `<details class="route-occasional"><summary>Occasional crafts &middot; ${refs.length} recipes</summary><p class="hint">These replace their tiny batches each loop. Select the loop number below to see the complete setup in the right order.</p>${[...new Set(refs.map(id=>loop.craftCadence[id]))].sort((a,b)=>a-b).map(every=>`<p class="craftworks-cadence">${routeBatchTiming({every},loop)}</p><div class="route-occasional-items">${refs.filter(id=>loop.craftCadence[id]===every).map(id=>itemName(id,items[id]?.name||id)).join('')}</div>`).join('')}</details>`;
}
function routeSaleRows(loop,place,round){
 const events=(loop.sales||[]).filter(s=>s.place===place&&s.round===round);
 return events.map((event,i)=>`${events.length>1?`<p class="hint">Sale ${i+1} &middot; before continuing this crafting batch</p>`:''}<div class="craftworkstable"><table><thead><tr><th>Item</th><th>Sell &asymp;</th><th>Keep for crafts</th></tr></thead><tbody>${event.items.map(row=>`<tr><td>${itemName(row.id,items[row.id]?.name||row.id)}</td><td>${fmt(row.quantity)}</td><td>${fmt(Math.ceil(row.keep))}</td></tr>`).join('')}</tbody></table></div>`).join('')||'<p class="hint">No selling needed this loop.</p>';
}
function routeSellSection(loop,place){
 const events=(loop.sales||[]).filter(s=>s.place===place);if(!events.length)return '';
 const when=place==='finish'?'After final crafting':place==='start'?'Before exploring':`After ${loop.parts.find(p=>p.id===place)?.name||'crafting'}`;
 const first=events[0].round;
 return `<details id="craft-stop-sell-${esc(place)}" class="craftworksset route-sell"><summary>Sell these items &middot; ${esc(when)}</summary><p class="hint">After crafting, set aside or hand in your goal items. Sell only the listed surplus; keep the remaining ingredients. If a final batch fills a stack, sell its surplus before continuing.</p><label class="route-sale-loop">Show loop <input type="number" min="1" max="${loop.rounds}" step="1" value="${first}" data-sale-loop="${esc(place)}"> of ${fmt(loop.rounds)}</label><div class="route-sale-rows">${routeSaleRows(loop,place,first)}</div></details>`;
}

function craftworksSetup(plan,loop){
 const checkpoint=stop=>{
  const round=stop.once?(stop.id==='finish'?loop.rounds:stop.firstRound):1;
  return `<details id="craft-stop-${stop.id}" class="craftworksset"><summary>${esc(stop.name)} &middot; Craftworks</summary><p class="hint">Run these setups in order. Required crafts come first; finished recipes stay above their ingredients within each setup.</p>${routeOccasionalCrafts(stop,loop)}${!stop.once&&loop.rounds>1?`<label class="route-sale-loop">Show loop <input type="number" min="1" max="${loop.rounds}" step="1" value="${round}" data-craft-loop="${esc(stop.id)}"> of ${fmt(loop.rounds)}</label>`:''}<div class="route-craft-rows">${routeCraftStopRows(stop,loop,round)}</div></details>`;
 };
 const start=loop.craftStops.find(s=>s.id==='start'),finish=loop.craftStops.find(s=>s.id==='finish');
 const sections=(start?checkpoint(start):'')+routeSellSection(loop,'start')+(loop.activeGroups||[]).map((group,i)=>{
 const after=loop.craftStops.find(s=>s.id===loop.parts[group.end].id);
 return `<details id="craft-stop-group-${i}" class="craftworksset"><summary>${group.recipes.length?'Keep active':'Collect'}: ${esc(group.from)}${group.from===group.to?'':' → '+esc(group.to)}${group.recipes.length?' · '+group.recipes.length+' / '+loop.slots+' slots':' · craft later'}</summary><p class="hint">${group.recipes.length?'These recipes preserve ingredients needed by later crafts. Required recipes come first; finished items stay above their ingredients.':'No active Craftworks needed here. Keep the collected ingredients for the later setups.'}</p>${group.recipes.length?`<div class="craftworkstable"><table><thead><tr><th>Recipe</th><th>Crafts per loop ≈</th></tr></thead><tbody>${craftworksDisplayOrder(group.recipes,loop.requiredRecipes).map(id=>`<tr><td>${itemName(id,items[id]?.name||id)}</td><td>${(group.amounts?.[id]||0)<1?'&lt;1':fmt(group.amounts[id])}</td></tr>`).join('')}</tbody></table></div>`:''}</details>`+(after?checkpoint(after):'')+routeSellSection(loop,loop.parts[group.end].id);
 }).join('')+(finish?checkpoint(finish):'')+routeSellSection(loop,'finish');
 return `<div class="sectiontitle"><h3>Craftworks &amp; selling by location</h3></div><p class="hint">Small batches wait until the final loop where inventory allows. Other batches show how often to run them. Exploration surplus may overflow; crafted surplus has a selling stop.</p>${sections||'<p class="hint">No crafting needed.</p>'}<p class="hint">Batch counts are estimates; the final batch may be smaller. Keep the listed quantities for your goals. These are planned quantities, not automatic Craftworks limits—stop completed recipes. Tick and swap times are not modeled.</p>`;
}


function routeTransition(loop,area,index){const sell=(loop.sales||[]).some(s=>s.place===area.id);const stop=loop.craftStops.find(s=>s.id===area.id),last=index===loop.parts.length-1;
 const nextIndex=(loop.activeGroups||[]).findIndex(g=>g.start===index+1);
 const current=loop.activeGroups?.find(g=>g.start<=index&&g.end>=index);
 const candidate=nextIndex>=0?loop.activeGroups[nextIndex]:null;
 const next=candidate&&(candidate.recipes.length||current?.recipes.length)?candidate:null;
 const label=stop?`After ${area.name}: finish this stretch’s crafting${next?`, then ${next.recipes.length?'load the next setup':'pause Craftworks'}`:''}. Open setup.`:next?next.recipes.length?`Change Craftworks for ${next.from} through ${next.to}. Open setup.`:'Pause Craftworks for this collecting stretch. Open instructions.':'Keep the current setup active';
 return `<div class="routetransition${last?' looptransition':''}" title="${esc(label)}${last?' Sell listed surplus and repeat loop.':''}"><span aria-hidden="true">${last?'↻':'→'}</span>${stop||next?`<button type="button" data-craft-stop="${stop?esc(area.id):'group-'+nextIndex}" aria-label="${esc(label)}"><span aria-hidden="true">⚒</span><small>${stop?routeStopBatches(stop,loop,1).length+(Object.values(loop.craftCadence||{}).some(n=>n>1)?'+':''):next?.recipes.length?1:'Pause'}</small></button>`:''}${sell?`<button class="route-sell-button" type="button" data-craft-stop="sell-${esc(area.id)}">Sell these items</button>`:''}${last?'<span class="sr">Repeat loop.</span>':''}</div>`;}

$('routeCards').onclick=e=>{const b=e.target.closest('[data-craft-stop]');if(!b)return;const panel=document.getElementById('craft-stop-'+b.dataset.craftStop);if(panel){$('craftworksDisclosure').open=true;panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'center'});}};


const routeFoodChoices={AP:[['chowder','Quandary Chowder','+10% drops · 5 min'],['seltzer','Lemon Seltzer','+50% drops · 50 APs'],['pie','Lemon Cream Pie','5 APs / click · 2 min']],Cider:[['neigh','Neigh','−20% stamina · 5 min'],['cabbage','Cabbage Stew','5 Ciders / click · 2 min']]};
function renderRouteFoods(){const method=state.route_method||'AP',foods=state.route_foods||{};$('routeFoods').innerHTML=routeFoodChoices[method].map(([key,name,note])=>{const id=Object.values(items).find(i=>i.name===name)?.id;return `<label class="routefood"><input type="checkbox" data-route-food="${key}" ${foods[key]?'checked':''}><span>${itemName(id,name)}<small>${note}</small></span></label>`;}).join('');$('routeFoodNote').textContent='Keep the selected foods active while following the route. Eat again when they run out.'+(method==='AP'&&foods.chowder&&foods.seltzer?' Chowder + Seltzer uses the conservative +60% drop estimate; the comparison retains the stacking range.':'')+((method==='AP'&&foods.pie)||(method==='Cider'&&foods.cabbage)?' Visits round up to multiples of 5 drinks. This often uses extra drinks and adds explores (and stamina when using Cider). Inventory is checked before each click.':'');}
$('routeFoods').onchange=e=>{const key=e.target.dataset.routeFood;if(!key)return;state.route_foods={...state.route_foods,[key]:e.target.checked};save();renderRoute();};
function renderNonCraftingDrops(plan){const ingredients=craftingIngredientIds(),rows=plan.item_balances.filter(b=>!ingredients.has(b.item_id)&&b.expected_exploration_drops>1e-8).sort((a,b)=>b.expected_exploration_drops-a.expected_exploration_drops);$('nonCraftingDrops').innerHTML=`<p class="hint">Expected exploration drops before whole-drink rounding and inventory overflow. These items are not ingredients in any catalog recipe.</p><table><thead><tr><th>Item</th><th>Expected drops</th></tr></thead><tbody>${rows.map(b=>`<tr><td>${itemName(b.item_id,b.name)}</td><td>${fmt(b.expected_exploration_drops)}</td></tr>`).join('')||'<tr><td colspan="2">None</td></tr>'}</tbody></table>`;}
function encodePlanCode(value){return 'FW2.'+btoa(Array.from(new TextEncoder().encode(JSON.stringify({version:2,settings:GlobalSettings.planOnly(value)})),b=>String.fromCharCode(b)).join(''));}
function parsePlanCode(code){
 if(typeof code!=='string'||code.length>2000000||!/^FW[12]\./.test(code.trim()))throw Error('Invalid or unsupported plan code.');
 const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code.trim().slice(4)),c=>c.charCodeAt(0))));
 if(![1,2].includes(data.version)||code.trim().slice(0,4)!==`FW${data.version}.`||!data.settings||typeof data.settings!=='object'||Array.isArray(data.settings))throw Error('Invalid or unsupported plan code.');
 return data;
}
function decodePlanCode(code){
 try{
  const data=parsePlanCode(code),current=GlobalSettings.read(catalog.locations);
  const account=GlobalSettings.validate({...current,...(data.version===1?GlobalSettings.pick(data.settings):{})},catalog.locations);
  return validatePlanSettings({...GlobalSettings.planOnly(data.settings),...account});
 }catch(e){throw Error('Invalid or unsupported plan code. '+(/^(Plan:|Invalid setting:)/.test(e.message)?e.message:''));}
}
function restorePlanCode(code){
 const restored=decodePlanCode(code),legacy=parsePlanCode(code).version===1;
 // Validate both halves before changing either saved value. Roll back if storage
 // fails so a failed import does not silently switch the account settings.
 const previous=localStorage.getItem(GlobalSettings.key);
 try{
  if(legacy)GlobalSettings.write(restored,catalog.locations);
  localStorage.setItem('farm-workshop-v1',JSON.stringify(GlobalSettings.planOnly(restored)));
 }catch(e){if(legacy){if(previous===null)localStorage.removeItem(GlobalSettings.key);else localStorage.setItem(GlobalSettings.key,previous);}throw e;}
 if(legacy&&Object.keys(GlobalSettings.pick(parsePlanCode(code).settings)).length)GlobalSettings.completeSetup();
 return restored;
}
function applyAccountSettings(value){
 const next=GlobalSettings.write(value,catalog.locations);
 Object.assign(state,next);theme();save();areas();
 // Keep the last completed plan visible until it can be recalculated. Settings
 // editing itself never starts a solver job.
 revision++;clearTimeout(timer);browserPlanner.cancel();
 $('resultContent').classList.add('stale');$('status').classList.remove('loading');$('compute').disabled=false;
 $('status').textContent='Settings saved. Your plan will update when you return.';
 settingsRecalculationPending=true;
 window.dispatchEvent(new Event('global-settings-applied'));
 if(!$('plannerPage').hidden){settingsRecalculationPending=false;calculate();}
}
// Fill new settings without merging user data (targets, lists, inventory maps).
function starterPlan(){
 return {...withSettingDefaults(),targets:{'126':1000},
  secondary:[{item_id:'83',allow_exploration:true,cap:null,exploration_item_id:'42'},{item_id:'81',allow_exploration:false,cap:null}],
  areas:null};
}
function withSettingDefaults(input){
 const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
 const clone=v=>JSON.parse(JSON.stringify(v));
 function merge(base,saved){
  if(!object(base)||!object(saved))return clone(saved);
  return Object.fromEntries([...new Set([...Object.keys(base),...Object.keys(saved)])].map(key=>[key,
   Object.hasOwn(saved,key)?Object.hasOwn(base,key)?merge(base[key],saved[key]):clone(saved[key]):clone(base[key])]));
 }
 const maps=new Set(['targets','provided_targets','cider_rolls','effectiveness_upgrades']);
 return Object.fromEntries(Object.entries(defaults).map(([key,value])=>[key,
  object(input)&&Object.hasOwn(input,key)?maps.has(key)?clone(input[key]):merge(value,input[key]):clone(value)]));
}
function validatePlanSettings(input){
 const fail=m=>{throw Error('Plan: '+m);},object=v=>v&&typeof v==='object'&&!Array.isArray(v),out=withSettingDefaults(input);
 Object.assign(out,GlobalSettings.validate(GlobalSettings.pick(input),catalog.locations));
 if(!['all','top','none'].includes(out.map_unused_mode))fail('Invalid unused materials display');
 if(!Number.isInteger(out.map_unused_count)||out.map_unused_count<1||out.map_unused_count>1000)fail('Invalid unused materials count');
 if(!Array.isArray(out.map_expanded_areas)||out.map_expanded_areas.some(id=>typeof id!=='string'))fail('Invalid expanded locations');
 if(!Array.isArray(out.map_hidden)||out.map_hidden.some(id=>typeof id!=='string'))fail('Invalid hidden materials');
 if(out.map_source_explores!=null&&(!object(out.map_source_explores)||Object.entries(out.map_source_explores).some(([id,areas])=>!items[id]||!object(areas)||Object.entries(areas).some(([area,q])=>!catalog.locations.some(l=>l.id===area)||!Number.isSafeInteger(q)||q<0||q>1e12))))fail('Invalid source exploration amounts');
 if(!object(out.map_sources)||Object.entries(out.map_sources).some(([id,areas])=>!items[id]||!Array.isArray(areas)||areas.some(a=>!catalog.locations.some(l=>l.id===a))))fail('Invalid material sources');
 if(!object(out.map_node_usage)||Object.values(out.map_node_usage).some(v=>!object(v)||!['unused','use','void','force','limit'].includes(v.mode)||v.mode==='limit'&&(!Number.isFinite(v.amount)||v.amount<0)))fail('Invalid node usage');
 if(!Array.isArray(out.map_use_void)||out.map_use_void.some(id=>typeof id!=='string'))fail('Invalid use and void materials');
 if(!Array.isArray(out.map_voided)||out.map_voided.some(id=>typeof id!=='string'))fail('Invalid voided materials');
 if(!Array.isArray(out.guided_skipped)||out.guided_skipped.some(id=>typeof id!=='string'))fail('Invalid skipped materials');
 if(!Array.isArray(out.quest_selection)||out.quest_selection.some(id=>typeof id!=='string'))fail('Invalid quest selection');
 if(!object(out.quest_imported_items)||Object.values(out.quest_imported_items).some(ids=>!Array.isArray(ids)||ids.some(id=>typeof id!=='string')))fail('Invalid quest imports');
 if(!Number.isInteger(out.selected_plan)||out.selected_plan<0||out.selected_plan>100000||typeof out.selected_plan_key!=='string'||out.selected_plan_key.length>2000)fail('Invalid selected plan');
 if(!out.map_positions||typeof out.map_positions!=='object'||Array.isArray(out.map_positions)||Object.values(out.map_positions).some(p=>!p||!Number.isFinite(p.x)||!Number.isFinite(p.y)||p.x<0||p.y<0||p.x>1000000||p.y>1000000))fail('Invalid map positions');
 const ranges={tower_level:[0,10000],craftworks_slots:[1,100],inventory_size:[1,1000000000],resource_saver:[0,45],wanderer:[0,33],sprint_shoes:[0,3]};
 for(const [k,[lo,hi]] of Object.entries(ranges))if(typeof out[k]!=='number'||!Number.isFinite(out[k])||out[k]<lo||out[k]>hi||(['craftworks_slots','inventory_size','sprint_shoes'].includes(k)&&!Number.isInteger(out[k])))fail('Invalid '+k);
 for(const k of ['iron_depot','runecube','cockatrice_ether_source','lemon_squeezer','cinnamon'])if(typeof out[k]!=='boolean')fail('Invalid '+k);
 for(const [k,values] of Object.entries({planner_mode:['goals','passive'],theme:['dark','light'],route_method:['AP','Cider'],mode:['best','combinations']}))if(!values.includes(out[k]))fail('Invalid '+k);
 if(out.automatic_areas!==null&&(!Array.isArray(out.automatic_areas)||out.automatic_areas.some(id=>typeof id!=='string'||!catalog.locations.some(a=>a.id===id))))fail('Invalid automatic exploration locations');
 if(out.max_areas!==null&&(!Number.isInteger(out.max_areas)||out.max_areas<1||out.max_areas>15))fail('Invalid area limit');
 if(!object(out.targets))fail('Invalid targets');
 for(const [id,n] of Object.entries(out.targets))if(!eligibleTarget(items[id])||!Number.isInteger(n)||n<1||n>100000000)fail('Invalid target '+id);
 if(!object(out.provided_targets)||Object.entries(out.provided_targets).some(([id,r])=>!out.targets[id]||!object(r)||!Number.isSafeInteger(r.quantity)||r.quantity<1||r.quantity>out.targets[id]||!Number.isFinite(r.taken)||r.taken<0||r.taken>r.quantity))fail('Invalid provided targets');
 if(!Array.isArray(out.secondary))fail('Invalid leftover targets');const seen=new Set();
 for(const r of out.secondary){if(!object(r)||!items[r.item_id]?.craftable||seen.has(r.item_id)||typeof r.allow_exploration!=='boolean'||r.cap!=null&&(!Number.isInteger(r.cap)||r.cap<0||r.cap>100000000))fail('Invalid leftover target');if(r.consumer_mode!=null&&!['available','fixed'].includes(r.consumer_mode))fail('Invalid craft mode');if(r.user_cap!=null&&typeof r.user_cap!=='boolean')fail('Invalid craft limit');if(r.automatic_batch!=null&&typeof r.automatic_batch!=='boolean')fail('Invalid automatic batch');if(r.prioritize!=null&&typeof r.prioritize!=='boolean')fail('Invalid priority option');if(r.exploration_item_id!=null&&!explorationIngredients(r.item_id).includes(r.exploration_item_id))fail('Invalid exploration ingredient');seen.add(r.item_id);}
 if(out.areas!==null&&(!Array.isArray(out.areas)||out.areas.some(id=>!catalog.locations.some(a=>a.id===id))))fail('Invalid areas');
 for(const k of ['effectiveness_upgrades','cider_rolls']){if(!object(out[k]))fail('Invalid '+k);for(const [id,n] of Object.entries(out[k]))if(!catalog.locations.some(a=>a.id===id)||!Number.isFinite(n)||n<0||n>100000000)fail('Invalid '+k);}
 if(!object(out.route_foods)||Object.entries(out.route_foods).some(([k,v])=>!['chowder','seltzer','pie','neigh','cabbage'].includes(k)||typeof v!=='boolean'))fail('Invalid foods');
 if(![10,60].includes(out.production_interval))fail('Invalid production period');
 for(const field of ['inventory','passive_inventory']){let stock;try{stock=JSON.parse(out[field]);}catch{fail('Invalid inventory');}if(!object(stock))fail('Invalid inventory');for(const [id,n] of Object.entries(stock))if(!items[id]||typeof n!=='number'||!Number.isFinite(n)||n<0)fail('Invalid inventory item');}
 return out;
}
$('generatePlanCode').onclick=()=>{try{$('planCode').value=encodePlanCode(validatePlanSettings(state));$('planCodeStatus').textContent='Code generated. Copy it somewhere to keep this plan.';}catch(e){$('planCodeStatus').textContent=e.message;}};
$('copyPlanCode').onclick=async()=>{try{if(!$('planCode').value)$('generatePlanCode').click();if(!$('planCode').value)return;await navigator.clipboard.writeText($('planCode').value);$('planCodeStatus').textContent='Plan code copied.';}catch{$('planCode').select();$('planCodeStatus').textContent='Select and copy the code with Ctrl+C.';}};
$('loadPlanCode').onclick=()=>{try{restorePlanCode($('planCode').value);location.reload();}catch(e){$('planCodeStatus').textContent=e.message;}};

function resetEmptyPlan(){targetRanking=[];targetSavings=null;startingSupplyReport(null);browserPlanner.cancel();result=null;selected=0;state.selected_plan=0;state.selected_plan_key="";save();lastSuccess=null;$('empty').hidden=false;$('resultContent').hidden=true;$('resultContent').classList.remove('stale');$('routePanel').hidden=true;$('status').textContent='Add a crafting or collection target to start.';$('compute').disabled=false;$('status').classList.remove('loading');$('implicitCrafts').innerHTML='';$('rawMaterials').innerHTML='';secondaryRows(false);}
$('clearPlan').onclick=()=>{if(state)$('clearPlanDialog').showModal();};
$('cancelClearPlan').onclick=()=>$('clearPlanDialog').close();
$('confirmClearPlan').onclick=()=>{
 clearTimeout(timer);revision++;
 state.targets={};state.provided_targets={};state.secondary=[];state.map_planning=false;state.automatic_areas=null;state.guided_skipped=[];state.map_voided=[];state.map_use_void=[];state.map_sources={};state.map_source_explores={};state.map_node_usage={};state.map_hidden=[];state.map_expanded_areas=[];state.map_unused_mode='top';state.quest_selection=[];state.quest_imported_items={};state.inventory='{}';state.passive_inventory='{}';
 $('clearPlanDialog').close();error('');$('inventoryError').hidden=true;
 for(const id of ['itemInput','inventoryItem','planCode'])$(id).value='';
 $('planCodeStatus').textContent='';targets();inventoryRows();resetEmptyPlan();
 if(state.planner_mode==='passive'){$('status').textContent='Add production amounts to start.';$('empty').querySelector('h2').textContent='Add production amounts to start.';}
 window.dispatchEvent(new Event('planner-cleared'));
};
function plannerModeUI(){const passive=state.planner_mode==='passive';document.querySelectorAll('[data-planner-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.plannerMode===state.planner_mode)));$('productionInterval').value=state.production_interval;$('primaryInputs').hidden=passive;$('passiveInputs').hidden=!passive;$(passive?'passiveInventoryHome':'startingInventoryHome').appendChild($('inventorySection'));$('inventorySection').open=passive;$('secondarySection').querySelector('h2').textContent=passive?'Use production for':'Explicitly use leftovers for';$('inventoryLabel').textContent=passive?'Production amounts per period':'Starting inventory';inventoryRows();}
function blankModeSettings(current,mode){return {...JSON.parse(JSON.stringify(defaults)),...GlobalSettings.pick(current),planner_mode:mode,targets:{}};}
function hasPlanContent(current){
 const blank=blankModeSettings(current,current.planner_mode);
 return Object.keys(blank).some(key=>{
  if(key==='planner_mode'||GlobalSettings.keys.includes(key))return false;
  if(['inventory','passive_inventory'].includes(key)){try{return Object.values(JSON.parse(current[key]||'{}')).some(q=>Number(q)>0);}catch{return true;}}
  if(key==='areas'&&current.areas?.length===catalog.locations.length&&catalog.locations.every(a=>current.areas.includes(a.id)))return false;
  return JSON.stringify(current[key]??blank[key])!==JSON.stringify(blank[key]);
 });
}
let pendingPlannerMode=null;
function commitPlannerMode(){
 if(!pendingPlannerMode)return;
 localStorage.setItem('farm-workshop-v1',JSON.stringify(GlobalSettings.planOnly(blankModeSettings(state,pendingPlannerMode))));
 location.reload();
}
function requestPlannerMode(mode){
 if(mode===state.planner_mode)return;
 pendingPlannerMode=mode;
 if(!hasPlanContent(state)){commitPlannerMode();return;}
 $('modeSaveCode').hidden=true;$('modeSaveStatus').textContent='';
 $('saveBeforeMode').hidden=false;$('discardBeforeMode').textContent='Discard and switch';
 $('modeSwitchDialog').showModal();
}
document.querySelectorAll('[data-planner-mode]').forEach(button=>button.onclick=()=>requestPlannerMode(button.dataset.plannerMode));
$('saveBeforeMode').onclick=()=>{try{
 $('modePlanCode').value=encodePlanCode(validatePlanSettings(state));
 $('modeSaveCode').hidden=false;$('saveBeforeMode').hidden=true;
 $('discardBeforeMode').textContent='I’ve saved the code — switch';
 $('modePlanCode').focus();$('modePlanCode').select();
}catch(e){$('modeSaveStatus').textContent=e.message;$('modeSaveCode').hidden=false;}};
$('copyModeCode').onclick=async()=>{try{await navigator.clipboard.writeText($('modePlanCode').value);$('modeSaveStatus').textContent='Copied. Keep the code somewhere safe before switching.';}catch{$('modePlanCode').select();$('modeSaveStatus').textContent='Press Ctrl+C to copy the selected code.';}};
$('discardBeforeMode').onclick=commitPlannerMode;
$('cancelModeSwitch').onclick=()=>{$('modeSwitchDialog').close();pendingPlannerMode=null;};
$('modeSwitchDialog').addEventListener('cancel',()=>{pendingPlannerMode=null;});
$('productionInterval').onchange=()=>{state.production_interval=Number($('productionInterval').value);save();if(result)renderRoute();};

$('secondaryRows').addEventListener('click',event=>{
 const button=event.target.closest('[data-ingredient-toggle]');if(!button)return;
 const body=$(button.getAttribute('aria-controls'));if(!body)return;
 const expanded=button.getAttribute('aria-expanded')!=='true';
 button.setAttribute('aria-expanded',String(expanded));body.hidden=!expanded;
});

function renderSuggestions(material,container){
 if(!result?.plans?.[selected]){container.textContent='Calculate a plan first.';return;}
 const stock=Object.fromEntries(result.plans[selected].item_balances.map(b=>[b.item_id,availableUnused(b)]));
 const suggestions=suggestCrafts(items,stock,state,material);
 container.innerHTML='<p class="hint">Ranked by how many leftover items each craft uses, with each item counting equally. These are estimates for one suggestion at a time; adding one recalculates your plan.</p>'+[['Use what you have',suggestions.ready,false],['Needs extra exploring',suggestions.explore,true]].map(([label,rows,assist])=>`<section class="consumergroup"><h3>${label}</h3>${assist?'<p class="hint">Uses your leftovers and gathers missing ingredients. Rankings don’t include exploration cost or area limits; the planner checks those when you add the craft.</p>':''}${rows.map(r=>`<div class="consumer"><div><strong>${itemName(r.id,items[r.id].name)}</strong><small>About ${fmt(Math.floor(r.count))} crafts · uses ${fmt(Math.floor(r.score))} leftover items</small><small>${Object.entries(r.used).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id,q])=>`${fmt(Math.floor(q))} ${esc(items[id].name)}`).join(' · ')}</small>${assist?`<small>Gather: ${Object.keys(r.missing).map(id=>esc(items[id].name)).join(', ')}</small>`:''}</div><button type="button" data-suggestion="${r.id}" data-assist="${assist}" data-anchor="${material||Object.keys(r.used).sort((a,b)=>r.used[b]-r.used[a])[0]||''}">+ Add</button></div>`).join('')||'<p class="hint">No suggestions for these leftovers.</p>'}</section>`).join('');
}
$('planDetail').addEventListener('click',e=>{if(e.target.closest('#suggestAll'))openSuggestions(null);});
$('suggestMaterial').onclick=()=>openSuggestions(suggestionMaterial);
function openSuggestions(material){$('suggestionsTitle').textContent=material?'Suggestions for '+items[material].name:'Suggestions for your leftovers';renderSuggestions(material,$('suggestionResults'));$('suggestionsDialog').showModal();}
$('closeSuggestions').onclick=()=>$('suggestionsDialog').close();
for(const host of [$('suggestionResults')])host.addEventListener('click',e=>{
 const button=e.target.closest('[data-suggestion]');if(!button)return;
 try{
 if(state.targets[button.dataset.suggestion])throw Error('This item is already a primary target.');
 if(!state.secondary.some(g=>g.item_id===button.dataset.suggestion))state.secondary.push({item_id:button.dataset.suggestion,allow_exploration:button.dataset.assist==='true',cap:null,exploration_item_id:button.dataset.anchor||null});
 $('suggestionsDialog').close();$('consumerDialog').close();changed();}catch(err){error(err.message);}
});

// Keep the solver idle while dragging; save the new display order only on drop.
function reorderLeftover(rows,id,beforeId){
 const from=rows.findIndex(r=>r.item_id===id);if(from<0||id===beforeId)return rows;
 const reordered=rows.filter(r=>r.item_id!==id),to=beforeId===null?reordered.length:reordered.findIndex(r=>r.item_id===beforeId);
 if(to<0)return rows;reordered.splice(to,0,rows[from]);return reordered;
}
let leftoverDrag=null;
function updateLeftoverDrop(){
 const d=leftoverDrag;if(!d)return;
 document.querySelectorAll('.dropbefore,.dropafter').forEach(e=>e.classList.remove('dropbefore','dropafter'));
 const rows=[...$('secondaryRows').querySelectorAll('[data-leftover-id]')].filter(e=>e.dataset.leftoverId!==d.id);
 const next=rows.find(row=>{const rect=row.getBoundingClientRect();return d.y<rect.top+rect.height/2;});
 d.before=next?.dataset.leftoverId??null;
 if(next)next.classList.add('dropbefore');else rows.at(-1)?.classList.add('dropafter');
}
function finishLeftoverDrag(commit){
 const d=leftoverDrag;if(!d)return;leftoverDrag=null;cancelAnimationFrame(d.frame);
 document.querySelectorAll('.dragging,.dropbefore,.dropafter').forEach(e=>e.classList.remove('dragging','dropbefore','dropafter'));
 document.body.classList.remove('reordering');
 if(d.handle.hasPointerCapture(d.pointer))d.handle.releasePointerCapture(d.pointer);
 if(commit&&d.moved){const reordered=reorderLeftover(state.secondary,d.id,d.before);
 if(reordered.some((r,i)=>r!==state.secondary[i])){state.secondary=reordered;save();secondaryRows(true);}}
}
$('secondaryRows').addEventListener('pointerdown',e=>{
 if(e.pointerType==='touch'||matchMedia('(max-width:800px)').matches)return;
 const handle=e.target.closest('[data-drag-leftover]');if(!handle||e.button!==0||state.secondary.length<2)return;
 e.preventDefault();handle.setPointerCapture(e.pointerId);
 leftoverDrag={id:handle.dataset.dragLeftover,handle,pointer:e.pointerId,startY:e.clientY,y:e.clientY,moved:false,before:handle.dataset.dragLeftover};
 function scrollDrag(){const d=leftoverDrag;if(!d)return;if(d.moved){const speed=d.y<80?-14:d.y>innerHeight-80?14:0;if(speed){window.scrollBy(0,speed);updateLeftoverDrop();}}d.frame=requestAnimationFrame(scrollDrag);}
 leftoverDrag.frame=requestAnimationFrame(scrollDrag);
});
$('secondaryRows').addEventListener('pointermove',e=>{
 const d=leftoverDrag;if(!d||e.pointerId!==d.pointer)return;d.y=e.clientY;
 if(!d.moved&&Math.abs(d.y-d.startY)<5)return;d.moved=true;
 d.handle.closest('.secondaryrow').classList.add('dragging');document.body.classList.add('reordering');updateLeftoverDrop();
});
$('secondaryRows').addEventListener('pointerup',()=>finishLeftoverDrag(true));
$('secondaryRows').addEventListener('pointercancel',()=>finishLeftoverDrag(false));
$('secondaryRows').addEventListener('lostpointercapture',()=>finishLeftoverDrag(false));
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&leftoverDrag){e.preventDefault();finishLeftoverDrag(false);}});

let automaticResults=null, automaticToken=0, automaticRevision=0;
$('planDetail').addEventListener('click',e=>{
 if(e.target.closest('#automaticMaximize')){
  if(!result||$('compute').disabled)return;
  $('automaticReport').innerHTML='';$('automaticStatus').textContent='';automaticResults=null;
  $('automaticDialog').showModal();
 }
 if(e.target.closest('#clearAutomaticAreas')){state.automatic_areas=null;changed();}
});
function stopAutomatic(){automaticToken++;browserPlanner.cancel();$('runAutomatic').disabled=false;$('automaticDialog').close();}
$('closeAutomatic').onclick=stopAutomatic;
$('automaticDialog').addEventListener('cancel',()=>{automaticToken++;browserPlanner.cancel();$('runAutomatic').disabled=false;});
$('runAutomatic').onclick=async()=>{
 const limit=Number($('automaticLocations').value);
 if(!Number.isInteger(limit)||limit<0||limit>15){$('automaticStatus').textContent='Choose a whole number from 0 to 15.';return;}
 const token=++automaticToken;automaticRevision=revision;automaticResults=null;
 $('automaticReport').innerHTML='';$('runAutomatic').disabled=true;
 const payload={action:'automatic',planner_mode:state.planner_mode,production_interval:state.production_interval,targets:activeTargets(),provided_targets:state.provided_targets,secondary:[],areas:[...state.areas],inventory:inventoryData(),iron_depot:state.iron_depot,runecube:state.runecube,cockatrice_ether_source:state.cockatrice_ether_source,cockatrice_ether_source:state.cockatrice_ether_source,resource_saver:state.resource_saver,combinations_mode:state.mode==='combinations',selected_plan_key:result.plans[selected].area_set_id,max_extra_locations:limit};
 try{
  const {job_id}=await api('/api/plan',payload);
  while(token===automaticToken){
   if(revision!==automaticRevision)throw Error('Your plan changed. Run Automatic Maximize again.');
   const job=await api('/api/jobs/'+job_id);
   if(job.status==='error')throw Error(job.error);
   if(job.status==='complete'){
    automaticResults=job.result;
    $('automaticStatus').textContent=`Compared ${fmt(job.result.plans_checked)} of up to ${fmt(job.result.search_limit)} candidate plans.${job.result.search_limit_reached?' Search limit reached; showing the best found.':''} Extra explores affect the ranking, but have no percentage cap. Balanced suggestions favor substantial material use; higher-use alternatives are shown when they consume meaningfully more. These are estimates, not a guaranteed optimum.`;
    $('automaticReport').innerHTML=job.result.options.map((o,i)=>`<section class="automatic-option"><h3>${esc(o.label)}</h3><p class="hint">${i?`Up to ${o.max_extra_locations} extra locations`:'Keep the original exploration amounts'}</p><dl><div><dt>Total explores</dt><dd>${fmt(o.plan.optimal_total_explores)}</dd></div><div><dt>Extra explores</dt><dd>${fmt(o.metrics.extra_explores)}${job.result.baseline_explores?` · +${fmt(o.metrics.extra_explores/job.result.baseline_explores*100)}%`:``}</dd></div><div><dt>Original leftovers used*</dt><dd>${fmt(Math.floor(o.metrics.materials_used))} / ${fmt(Math.floor(o.metrics.materials_total))} · ${fmt(o.metrics.materials_used_fraction*100)}%</dd></div><div><dt>Material types used</dt><dd>${o.metrics.material_types_used}</dd></div></dl><p class="hint">New locations: ${o.metrics.new_locations.map(id=>esc(catalog.locations.find(a=>a.id===id)?.name||id)).join(', ')||'None'}</p><details><summary>Original material usage</summary>${o.metrics.original_materials.map(r=>`<div class="automatic-output">${itemName(r.item_id,r.name)}<span>${fmt(Math.floor(r.used))} / ${fmt(Math.floor(r.quantity))}</span></div>`).join('')}</details><details><summary>Crafted outputs (${o.metrics.crafted_types})</summary>${(o.plan.secondary?.targets||[]).filter(g=>g.crafts>0).map(g=>`<div class="automatic-output">${itemName(g.item_id,g.name)}<strong>${fmt(Math.floor(g.crafts))}</strong></div>`).join('')||'<p class="hint">No useful crafts found with these supplies.</p>'}</details><button type="button" class="primary" data-apply-automatic="${i}">Use this plan</button></section>`).join('')+'<p class="hint">*Whole items, rounded down. Finished crafts and ingredients crafted along the way are shown in the planner after applying. Equal options mean the search found no worthwhile improvement from another location.</p>';
    break;
   }
   $('automaticStatus').textContent=job.message||'Trying leftover plans…';
   await new Promise(r=>setTimeout(r,300));
  }
 }catch(e){if(token===automaticToken)$('automaticStatus').textContent=e.message.split('\n').filter(Boolean).at(-1);}
 finally{if(token===automaticToken)$('runAutomatic').disabled=false;}
};
$('automaticReport').addEventListener('click',e=>{
 const b=e.target.closest('[data-apply-automatic]');if(!b||!automaticResults)return;
 if(revision!==automaticRevision){$('automaticStatus').textContent='Your plan changed. Run the comparison again.';return;}
 const o=automaticResults.options[Number(b.dataset.applyAutomatic)];
 state.secondary=o.goals.map(g=>({...g}));state.automatic_areas=[...o.areas];
 $('automaticDialog').close();changed();
});

function explorationYieldMultiplier(id){return state.cockatrice_ether_source&&['Fire Ant','Caterpillar','Spider','Horned Beetle','Shiny Beetle','Snail','Giant Centipede','Ruby Scorpion','Onyx Scorpion'].includes(items[id]?.name)?2:1;}

function explorationYieldMultiplier(id){return state.cockatrice_ether_source&&['Fire Ant','Caterpillar','Spider','Horned Beetle','Shiny Beetle','Snail','Giant Centipede','Ruby Scorpion','Onyx Scorpion'].includes(items[id]?.name)?2:1;}
