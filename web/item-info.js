(()=>{
 const popup=document.createElement('div');popup.id='itemInfo';popup.setAttribute('popover','auto');popup.setAttribute('role','dialog');popup.setAttribute('aria-label','Item materials and sources');document.body.append(popup);
 let itemCatalog;
 async function details(id){if(!itemCatalog)itemCatalog=fetch(new URL('catalog.json',document.baseURI),{cache:'no-cache'}).then(r=>{if(!r.ok)throw Error('Catalog request failed');return r.json();}).then(b=>b.catalog).catch(e=>{itemCatalog=null;throw e;});const c=await itemCatalog,item=c.items[id];if(!item)throw Error('Item not found');return {item,sources:(item.source_ids||[]).map(id=>c.sources[id]).filter(Boolean).map(s=>({...s,location_name:c.locations[s.location_id]?.name}))};}
 let timer,closeTimer,anchor,start,openedByHold=false,request=0;
 function cancel(){clearTimeout(timer);anchor?.classList.remove('item-dwell');timer=null;}
 function dismiss(){cancel();request++;if(popup.matches(':popover-open'))popup.hidePopover();}
 function position(el,touch){const r=el.getBoundingClientRect(),w=Math.min(360,innerWidth-24);popup.style.width=w+'px';popup.style.maxHeight=Math.min(560,innerHeight-32)+'px';popup.style.left=(touch?Math.max(12,(innerWidth-w)/2):Math.min(Math.max(12,r.left),innerWidth-w-12))+'px';const h=popup.getBoundingClientRect().height;popup.style.top=(touch?Math.max(16,(innerHeight-h)/2):Math.max(16,Math.min(r.bottom+8,innerHeight-h-16)))+'px';}
 async function open(el,touch=false){cancel();anchor=el;const rect=el.getBoundingClientRect(),positionAnchor={getBoundingClientRect:()=>rect};const token=++request;popup.innerHTML='<p>Loading item details…</p>';if(!popup.matches(':popover-open'))popup.showPopover();position(positionAnchor,touch);
 try{const {item,sources}=await details(el.dataset.itemInfo);if(token!==request)return;
 const ingredients=Object.entries(item.direct_ingredients||{}),raw=Object.entries(item.raw_materials||{});
 const list=rows=>'<ul class="item-recipe">'+rows.map(([id,n])=>`<li>${itemName(id,items[id]?.name||id)}<strong>× ${fmt(n)}</strong></li>`).join('')+'</ul>';
 const groups=new Map();for(const s of sources){let name=s.location_name;const d=s.details||{};if(!name)name=d.quest?.cleanTitle||d.npc?.name||d.pet?.name||d.name||'';const kind=s.kind.replaceAll('_',' ');if(!groups.has(kind))groups.set(kind,new Set());if(name)groups.get(kind).add(name);}
 popup.innerHTML=`<div class="item-info-head"><h3>${itemIcon(item.id)} ${esc(item.name)} ${mmBadge(item.id)}</h3><button type="button" data-info-close aria-label="Close item details">×</button></div>${ingredients.length?`<h4>Crafting materials</h4><p class="hint">Base recipe for ${fmt(item.output_quantity)} item(s), before crafting perks.</p>${list(ingredients)}<details><summary>Raw materials, including ingredients crafted along the way</summary>${list(raw)}</details>`:'<p class="hint">No workshop recipe in the catalog.</p>'}<h4>Sources</h4>${groups.size?[...groups].map(([kind,names])=>`<div class="item-source"><strong>${esc(kind[0].toUpperCase()+kind.slice(1))}</strong>${names.size?`<p>${[...names].map(esc).join(' · ')}</p>`:''}</div>`).join(''):'<p class="hint">No sources recorded.</p>'}<p class="hint">Sources may require unlocks or perks. Hover or hold an ingredient to inspect it.</p>`;
 position(positionAnchor,touch);
 }catch(e){if(token===request){console.warn('Item details failed',el.dataset.itemInfo,e);popup.innerHTML='<p>Could not load item details.</p><button type="button" data-info-close>Close</button>';position(positionAnchor,touch);}}
 }
 function begin(el,touch){cancel();clearTimeout(closeTimer);anchor=el;el.style.setProperty('--dwell-time',(touch?600:450)+'ms');el.classList.add('item-dwell');timer=setTimeout(()=>{if(touch)openedByHold=true;open(el,touch);},touch?600:450);}
 function target(e){return e.target.closest?.('.mmbadge,.mailablebadge')?null:e.target.closest?.('[data-item-info]');}
 document.addEventListener('pointerover',e=>{if(e.pointerType==='touch')return;const el=target(e);if(el&&!el.contains(e.relatedTarget))begin(el,false);});
 document.addEventListener('pointerout',e=>{if(e.pointerType==='touch')return;const el=target(e);if(el&&!el.contains(e.relatedTarget)){cancel();closeTimer=setTimeout(()=>{if(!popup.matches(':hover'))dismiss();},220);}});
 popup.addEventListener('pointerenter',()=>clearTimeout(closeTimer));popup.addEventListener('pointerleave',e=>{if(e.pointerType!=='touch')closeTimer=setTimeout(dismiss,220);});
 document.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'&&e.pointerType!=='pen')return;openedByHold=false;const el=target(e);if(!el)return;start={x:e.clientX,y:e.clientY};begin(el,true);});
 document.addEventListener('pointermove',e=>{if(start&&Math.hypot(e.clientX-start.x,e.clientY-start.y)>10){cancel();start=null;}});
 document.addEventListener('pointerup',()=>{cancel();start=null;});document.addEventListener('pointercancel',()=>{cancel();start=null;});
 document.addEventListener('click',e=>{if(openedByHold&&anchor?.contains(e.target)){openedByHold=false;e.preventDefault();e.stopImmediatePropagation();return;}openedByHold=false;if(e.target.closest('[data-info-close]'))dismiss();},true);
 document.addEventListener('contextmenu',e=>{if(target(e)&&(timer||openedByHold||popup.matches(':popover-open')))e.preventDefault();});
 document.addEventListener('keydown',e=>{if(e.key==='Escape')dismiss();else if((e.key==='Enter'||e.key===' ')&&e.target.matches('[data-item-info]')){e.preventDefault();e.stopPropagation();open(e.target,matchMedia('(pointer:coarse)').matches);}},true);
 document.addEventListener('scroll',e=>{if(!popup.contains(e.target))dismiss();},true);
 window.addEventListener('resize',dismiss);
})();
