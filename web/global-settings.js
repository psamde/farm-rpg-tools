/* Account settings are independent of any tool's saved plan. */
(function(root){
 'use strict';
 const key='farm-rpg-settings-v1',profilesKey='farm-rpg-settings-profiles-v1',setupKey='farm-rpg-settings-setup-complete';
 const setupComplete=()=>root.localStorage.getItem(setupKey)==='1';
 const completeSetup=()=>root.localStorage.setItem(setupKey,'1');
 const defaults={theme:'dark',tower_level:0,craftworks_slots:10,inventory_size:10000,resource_saver:0,wanderer:0,lemon_squeezer:false,cinnamon:false,cider_rolls:{},effectiveness_upgrades:{},sprint_shoes:0,iron_depot:true,runecube:false,cockatrice_ether_source:false,areas:null};
 const clone=value=>JSON.parse(JSON.stringify(value));
 const object=value=>value!==null&&typeof value==='object'&&!Array.isArray(value);
 const pick=value=>Object.fromEntries(Object.keys(defaults).filter(k=>Object.hasOwn(value||{},k)).map(k=>[k,clone(value[k])]));
 const planOnly=value=>Object.fromEntries(Object.entries(value||{}).filter(([k])=>!Object.hasOwn(defaults,k)));
 function validate(value,locations){
  if(!object(value))throw Error('Settings must be an object.');
  const out={...clone(defaults),...pick(value)},fail=k=>{throw Error('Invalid setting: '+k.replaceAll('_',' ')+'.');};
  for(const [k,[lo,hi]] of Object.entries({tower_level:[0,10000],craftworks_slots:[1,100],inventory_size:[1,1e9],resource_saver:[0,45],wanderer:[0,33],sprint_shoes:[0,3]})){
   if(!Number.isFinite(out[k])||out[k]<lo||out[k]>hi||(['tower_level','craftworks_slots','inventory_size','sprint_shoes'].includes(k)&&!Number.isInteger(out[k])))fail(k);
  }
  for(const k of ['iron_depot','runecube','cockatrice_ether_source','lemon_squeezer','cinnamon'])if(typeof out[k]!=='boolean')fail(k);
  if(!['dark','light'].includes(out.theme))fail('theme');
  if(out.areas!==null&&(!Array.isArray(out.areas)||out.areas.some(id=>typeof id!=='string')))fail('areas');
  for(const k of ['cider_rolls','effectiveness_upgrades'])if(!object(out[k])||Object.values(out[k]).some(n=>!Number.isFinite(n)||n<0||n>1e8))fail(k);
  if(locations){
   const ids=new Set(locations.map(a=>a.id));
   out.areas=out.areas===null?locations.filter(a=>!['explore:11','explore:14'].includes(a.id)).map(a=>a.id):[...new Set(out.areas.filter(id=>ids.has(id)))];
   for(const k of ['cider_rolls','effectiveness_upgrades'])out[k]=Object.fromEntries(Object.entries(out[k]).filter(([id])=>ids.has(id)));
  }
  return out;
 }
 function read(locations){
  const raw=root.localStorage.getItem(key);
  if(!raw)return validate({},locations);
  const data=JSON.parse(raw);
  if(data.version!==1)throw Error('This settings save needs a newer version of the app.');
  return validate(data.settings,locations);
 }
 function write(value,locations){const settings=validate(value,locations);root.localStorage.setItem(key,JSON.stringify({version:1,settings}));return settings;}
 function initialize(legacy,locations){
  // Import the old combined autosave once. An old plan left open in another tab
  // must never overwrite a newer account profile on startup.
  const existing=root.localStorage.getItem(key),inherited=pick(legacy);
  const settings=existing?read(locations):write(inherited,locations);
  // Existing account settings predate this hint's completion flag. Fresh installs
  // retain an explicit false flag until Save, even after refreshing the page.
  if(root.localStorage.getItem(setupKey)===null)root.localStorage.setItem(setupKey,existing||Object.keys(inherited).length?'1':'0');
  return settings;
 }
 function encode(value){return 'FWS1.'+btoa(Array.from(new TextEncoder().encode(JSON.stringify({version:1,settings:validate(value)})),b=>String.fromCharCode(b)).join(''));}
 function decode(code,locations){
  try{
   if(typeof code!=='string'||code.length>2000000||!code.trim().startsWith('FWS1.'))throw Error();
   const data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(Uint8Array.from(atob(code.trim().slice(5)),c=>c.charCodeAt(0))));
   if(data.version!==1||!object(data.settings))throw Error();
   return validate(data.settings,locations);
  }catch{throw Error('Invalid settings code. Use a code starting with FWS1.');}
 }
 function readProfiles(){
  const raw=root.localStorage.getItem(profilesKey);if(!raw)return [];
  const data=JSON.parse(raw);
  if(data.version!==1||!Array.isArray(data.profiles)||data.profiles.some(p=>!object(p)||typeof p.id!=='string'||typeof p.name!=='string'||typeof p.code!=='string'||!Number.isFinite(p.updated)))throw Error('Could not read settings profiles. Existing saves were left untouched.');
  return data.profiles;
 }
 function writeProfiles(profiles){root.localStorage.setItem(profilesKey,JSON.stringify({version:1,profiles}));}
 root.GlobalSettings={key,profilesKey,setupKey,setupComplete,completeSetup,defaults,keys:Object.keys(defaults),pick,planOnly,validate,read,write,initialize,encode,decode,readProfiles,writeProfiles};
})(globalThis);
