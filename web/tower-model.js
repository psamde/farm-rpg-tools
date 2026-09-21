/* Pure Tower prototype model. Units and limitations are explicit; no account calls. */
(function(root){
 'use strict';
 const TIERS={M:10000,GM:100000,MM:1000000};
 const DEFAULT_WEIGHTS={explore:1,fishing:5,farming:50,mining:10,passive:25000,market:1000};
 const norm=s=>String(s).normalize('NFKC').replace(/[’‘]/g,"'").replace(/\s+/g,' ').trim().toLowerCase();
 const esc=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 function plainText(raw){
  return String(raw).replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi,'')
   .replace(/<(?:br|\/?(?:div|p|li|tr|td|h[1-6]|section))\b[^>]*>/gi,'\n').replace(/<[^>]*>/g,' ')
   .replace(/&#(x[\da-f]+|\d+);/gi,(_,n)=>{const cp=n[0].toLowerCase()==='x'?parseInt(n.slice(1),16):Number(n);return cp<=0x10ffff?String.fromCodePoint(cp):' ';})
   .replace(/&(nbsp|amp|quot|apos|lt|gt);/gi,(_,n)=>({nbsp:' ',amp:'&',quot:'"',apos:"'",lt:'<',gt:'>'}[n.toLowerCase()]));
 }
 function parseMasteries(raw,items){
  const names=Object.values(items).filter(i=>i.masterable).sort((a,b)=>b.name.length-a.name.length)
   .map(i=>({i,re:new RegExp('^'+esc(norm(i.name))+'(?=$|[\\s:|,;(/–—-])','i')}));
  const lines=plainText(raw).split(/\r?\n/).map(s=>s.trim()).filter(Boolean), rows=new Map(),issues=[],ignored=[];
  function match(s){s=norm(s).replace(/^(?:[•*✓★]+|\d+[.)])\s*/,'');const x=names.find(n=>n.re.test(s));return x?{...x,tail:s.slice(norm(x.i.name).length)}:null;}
  for(let index=0;index<lines.length;index++){
   const line=lines[index],m=match(line);
   if(!m){ignored.push(line);continue;}
   let tail=m.tail;
   // Only consume adjacent numeric/tier lines; never harvest unrelated page counters.
   for(let k=1;k<=3&&!tail.match(/\d/)&&index+k<lines.length;k++){
    const next=lines[index+k];if(match(next)||!/^(?:(?:count|mastery|progress|total|gm|mm|mega|grand|mastered)\b|[\d\s,./:%()–—-])/i.test(next))break;
    tail+=' '+next;
   }
   const clean=tail.replace(/\b[\d,.]+\s*%/g,'').replace(/\b(?:tier|level)\s*\d+/gi,'');
   const numeric=clean.match(/(?:^|[\s:|=(])((?:\d{1,3}(?:[,\s]\d{3})+|\d+)(?:\.\d+)?\s*[km]?)(?=$|[\s/|);:])/i);
   let count=null,lowerBound=false;
   if(numeric){const token=numeric[1].replace(/[\s,]/g,'');count=Number(token.replace(/[km]$/i,''))* (/m$/i.test(token)?1e6:/k$/i.test(token)?1e3:1);}
   else if(/\b(?:mega[- ]?master(?:ed|y)?|mm)\b/i.test(tail)){count=TIERS.MM;lowerBound=true;}
   else if(/\b(?:grand[- ]?master(?:ed|y)?|gm)\b/i.test(tail)){count=TIERS.GM;lowerBound=true;}
   else if(/\b(?:mastered|mastery)\b/i.test(tail)){count=TIERS.M;lowerBound=true;}
   if(count===null||!Number.isSafeInteger(count)||count<0||count>1e12){issues.push({item_id:m.i.id,line,reason:'No unambiguous whole mastery count. Enter it in review.'});continue;}
   const row={item_id:m.i.id,name:m.i.name,count,lowerBound,line};
   if(rows.has(m.i.id)&&rows.get(m.i.id).count!==count){const previous=rows.get(m.i.id);previous.conflict=true;issues.push({item_id:m.i.id,line,reason:`Conflicting counts: ${previous.count.toLocaleString()} and ${count.toLocaleString()}. Review required.`});}
   else if(!rows.has(m.i.id))rows.set(m.i.id,row);
  }
  return {rows:[...rows.values()].sort((a,b)=>a.name.localeCompare(b.name)),issues,ignored,lines:lines.length};
 }
 function progress(profile,id){return Object.hasOwn(profile.masteries||{},id)?profile.masteries[id]:profile.assumeZero?0:null;}
 function projectedProgress(profile,id){const count=progress(profile,id);return count===null?null:count+Math.floor((profile.forecastGains?.[id]||0)+1e-7);}
 function validSource(source,profile){
  const c=source.conditions||{};
  if(c.frozen)return false;
  if(c.runecube!=null&&c.runecube!==!!profile.runecube)return false;
  if(c.ironDepot!=null&&c.ironDepot!==!!profile.ironDepot)return false;
  // Manual-fishing-only and net-fishing tables are kept distinct. First prototype uses manual-equivalent actions.
  if(source.kind==='fishing'&&c.manualFishing===false)return false;
  return !source.location_id||(profile.locations||[]).includes(source.location_id);
 }
 const empty=()=>({resources:{},crafts:{},steps:[],missing:[],days:0,points:0});
 function merge(parts){const r=empty();for(const p of parts){for(const [k,v]of Object.entries(p.resources))r.resources[k]=(r.resources[k]||0)+v;for(const[k,v]of Object.entries(p.crafts))r.crafts[k]=(r.crafts[k]||0)+v;r.steps.push(...p.steps);r.missing.push(...p.missing);}return r;}
 function measure(plan,profile){
  const weights={...DEFAULT_WEIGHTS,...profile.weights};let points=0,days=0;
  for(const [key,qty]of Object.entries(plan.resources)){
   const [kind,id]=key.split(':');
   if(kind==='passive'){const rate=Number(profile.production?.[id]||0);days=Math.max(days,rate>0?qty/rate:Infinity);}
   else points+=qty*weights[kind];
  }
  plan.days=days;plan.points=plan.missing.length?Infinity:points+days*weights.passive;
  return plan;
 }
 function estimate(data,profile,id,quantity,mode='mixed'){
  if(quantity<=0)return measure(empty(),profile);
  const memo=new Map();
  function visit(ref,qty,isRoot=false,depth=0){
   const key=[ref,qty,isRoot,mode].join('|');if(memo.has(key))return memo.get(key);
   const item=data.items[ref],options=[];
   if(!item||depth>30){const r=empty();r.missing=[ref];return measure(r,profile);}
   function direct(kind,amount,description){const p=empty();p.resources[kind+':'+ref]=amount;p.steps.push({item_id:ref,kind,quantity:qty,effort:amount,description});options.push(measure(p,profile));}
   if(!isRoot&&profile.ironDepot&&['Iron','Nails'].includes(item.name)){const r=empty();r.steps.push({item_id:ref,kind:'depot',quantity:qty,description:'Iron Depot · ingredient supply only'});return r;}
   if(['passive','mixed'].includes(mode)&&Number(profile.production?.[ref])>0)direct('passive',qty,'Your available daily production');
   const kinds=mode==='active'?['explore','fishing','farming','mining']:mode==='explore'?['explore']:mode==='fishing'?['fishing']:mode==='mixed'?['explore','fishing','farming','mining']:[];
   for(const kind of kinds){
    const sources=item.sources.filter(s=>s.kind===kind&&validSource(s,profile)&&s.actions_per_drop>0);
    const best=sources.sort((a,b)=>a.actions_per_drop-b.actions_per_drop)[0];
    if(best)direct(kind,qty*best.actions_per_drop,data.locations[best.location_id]?.name||(kind==='farming'?'Harvests (crop timing not yet modeled)':kind));
   }
   if(!isRoot&&['market','mixed'].includes(mode)&&item.mailable&&Number(profile.marketLevel)>=item.min_mailable_level&&Number(profile.prices?.[ref])>0)
    direct('market',qty*Number(profile.prices[ref])/1000,'AP per 1,000 × needed quantity');
   if(item.craftable&&Object.keys(item.direct_ingredients).length){
    const crafts=qty/(1+Math.max(0,Math.min(45,Number(profile.resourceSaver)||0))/100);
    const p=merge(Object.entries(item.direct_ingredients).map(([ingredient,n])=>visit(ingredient,crafts*n,false,depth+1)));
    p.crafts[ref]=(p.crafts[ref]||0)+qty;options.push(measure(p,profile));
   }
   let result=options.filter(x=>Number.isFinite(x.points)).sort((a,b)=>a.points-b.points)[0];
   if(!result){result=options.sort((a,b)=>a.missing.length-b.missing.length)[0]||empty();if(!result.missing.length)result.missing=[ref];result=measure(result,profile);}
   memo.set(key,result);return result;
  }
  return visit(id,quantity,true);
 }
 function relatedItems(data,current,target,lookahead=25){
  const direct=new Map(),support=new Map();
  function ancestors(id,floor,seen=new Set()){
   if(seen.has(id))return;seen.add(id);
   for(const child of Object.keys(data.items[id]?.direct_ingredients||{})){
    support.set(child,Math.min(support.get(child)||Infinity,floor));ancestors(child,floor,seen);
   }
  }
  for(const f of data.floors.filter(f=>f.level>current&&f.level<=Math.min(data.max_floor,target+lookahead))){
   for(const r of f.requirements){direct.set(r.item_id,Math.min(direct.get(r.item_id)||Infinity,f.level));ancestors(r.item_id,f.level);}
  }
  return {direct,support};
 }
 function recommendations(data,profile){
  const links=relatedItems(data,profile.current,profile.target),results=[];let unknown=0;
  for(const item of Object.values(data.items)){
   if(!item.masterable)continue;
   const count=projectedProgress(profile,item.id);if(count===null){unknown++;continue;}if(count>=TIERS.GM)continue;
   const remaining=TIERS.GM-count,cost=estimate(data,profile,item.id,remaining),direct=links.direct.get(item.id),support=links.support.get(item.id);
   const tier=direct?0:support?1:2;
   if(!Number.isFinite(cost.points))continue;
   results.push({item_id:item.id,name:item.name,remaining,progress:count,cost,tier,floor:direct||support||null,ak:100,score:cost.points/100,
    reason:direct?`Required for floor ${direct}${direct>profile.target?' · beyond your target':''}`:support?`Ingredient for floor ${support}`:count>=80000?'Already close to GM':'Additional AK candidate'});
  }
  results.sort((a,b)=>a.tier-b.tier||a.score-b.score||a.name.localeCompare(b.name));
  return {results,unknown};
 }
 function akSummary(data,profile){
  const required=data.floors.filter(f=>f.level>profile.current&&f.level<=profile.target).reduce((n,f)=>n+f.ak,0);
  const other=data.ak_sources.reduce((n,s)=>n+(profile.akSources?.[s.id]==='planned'?Number(s.ak??profile.skillAk?.[s.id]??0):0),0);
  const questGms=Object.keys(profile.forecastGains||{}).filter(id=>data.items[id]?.masterable&&progress(profile,id)!==null&&progress(profile,id)<TIERS.GM&&projectedProgress(profile,id)>=TIERS.GM);
  const gm=[...new Set(profile.selectedGms||[])].reduce((n,id)=>{const p=progress(profile,id);return n+(p!==null&&p<TIERS.GM&&data.items[id]?.masterable&&!questGms.includes(id)?100:0);},0);
  const quest=questGms.length*100;
  return {required,available:profile.ak,other,gm,quest,gap:Math.max(0,required-Number(profile.ak||0)-other-gm-quest)};
 }
 const api={TIERS,DEFAULT_WEIGHTS,plainText,parseMasteries,progress,projectedProgress,validSource,estimate,relatedItems,recommendations,akSummary};
 if(typeof module!=='undefined'&&module.exports)module.exports=api;else root.TowerModel=api;
})(typeof globalThis!=='undefined'?globalThis:this);
