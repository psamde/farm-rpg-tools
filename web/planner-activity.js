// One quiet indicator for catalog loading, route solves, and crafting previews.
(function(root){
 'use strict';
 function create(render,clock={now:()=>Date.now(),setTimeout:(fn,ms)=>root.setTimeout(fn,ms),clearTimeout:id=>root.clearTimeout(id),setInterval:(fn,ms)=>root.setInterval(fn,ms),clearInterval:id=>root.clearInterval(id)}){
  let current=null,visible=false,started=0,showTimer=null,hideTimer=null,tick=null;
  const clear=()=>{clock.clearTimeout(showTimer);clock.clearTimeout(hideTimer);clock.clearInterval(tick);};
  function view(){
   const status=current?.status,action=current?.action;
   let title='Updating your plan…',detail='Balancing ingredients and exploration';
   if(action==='catalog'){title='Loading planner…';detail='Getting items and recipes';}
   else if(/Loading Python|SciPy/i.test(current?.message||'')){title='Starting calculator…';detail='The first load can take a moment';}
   else if(action==='guided'){title='Checking your crafts…';detail='Updating the crafting map';}
   else if(action==='automatic'){title='Finding useful crafts…';detail='Comparing ways to use your leftovers';}
   if(status==='comparisons'){title='Your plan is ready';detail='Finishing savings estimates';}
   if(status==='complete'){title=action==='catalog'?'Planner loaded':action==='guided'?'Crafts updated':'Plan updated';detail='';}
   if(status==='error'){title=current.wasReady?'Couldn’t finish estimates':'Couldn’t finish calculating';detail='See the details in the planner';}
   return {visible,title,detail,state:status==='complete'?'done':status==='error'?'error':'busy',seconds:Math.floor((clock.now()-started)/1000)};
  }
  function update(event){
   if(event.status==='queued'){
    // A replacement job keeps the indicator in place instead of flashing.
    clear();current={...event};started=clock.now();
    if(visible){render(view());tick=clock.setInterval(()=>render(view()),1000);}
    else showTimer=clock.setTimeout(()=>{visible=true;render(view());tick=clock.setInterval(()=>render(view()),1000);},400);
    return;
   }
   if(!current||current.id!==event.id)return;
   const wasReady=current.wasReady||current.status==='comparisons';
   current={...current,...event,wasReady};
   if(event.status==='cancelled'){clear();visible=false;current=null;render({visible:false});return;}
   if(event.status==='complete'||event.status==='error'){
    clear();
    // Fast successes remain invisible; failures must still be noticed.
    if(event.status==='error')visible=true;
    if(visible){render(view());hideTimer=clock.setTimeout(()=>{visible=false;render({visible:false});},event.status==='error'?4500:1200);}
    return;
   }
   if(visible)render(view());
  }
  return {update,destroy(){clear();visible=false;current=null;render({visible:false});}};
 }
 if(typeof module!=='undefined'&&module.exports){module.exports={create};return;}
 const box=document.createElement('div');box.id='plannerActivity';box.className='planner-activity';box.hidden=true;
 box.setAttribute('role','status');box.setAttribute('aria-live','polite');box.setAttribute('aria-atomic','true');
 box.innerHTML='<span class="activity-mark" aria-hidden="true">↻</span><span class="activity-copy"><strong></strong><small></small></span><span class="activity-time" aria-hidden="true"></span><span class="activity-track" aria-hidden="true"></span>';
 document.body.append(box);
 const title=box.querySelector('strong'),detail=box.querySelector('small'),elapsed=box.querySelector('.activity-time'),mark=box.querySelector('.activity-mark');
 const controller=create(value=>{
  box.hidden=!value.visible;if(!value.visible)return;
  box.dataset.state=value.state;
  // Avoid re-announcing unchanged text on every elapsed-time tick.
  if(title.textContent!==value.title)title.textContent=value.title;
  if(detail.textContent!==value.detail)detail.textContent=value.detail;
  detail.hidden=!value.detail;
  elapsed.textContent=value.state==='busy'&&value.seconds>=2?value.seconds+'s':'';
  mark.textContent=value.state==='done'?'✓':value.state==='error'?'!':'↻';
 });
 root.addEventListener('planner-activity',event=>controller.update(event.detail));
})(globalThis);
