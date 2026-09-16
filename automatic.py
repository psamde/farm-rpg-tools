"""Bounded greedy search for useful leftover crafts; never claims optimality."""
from collections import Counter
from functools import lru_cache
import math
from secondary import consume_leftovers

SEARCH_LIMIT = 4000


def maximize(catalog, primary, areas, max_extra=1, progress=lambda message: None):
    if type(max_extra) is not int or not 0 <= max_extra <= 15:
        raise ValueError('Extra locations must be a whole number from 0 to 15.')
    items=catalog['items']; factor=1/(1+primary['assumptions']['resource_saver']/100)
    free={r['id'] for r in primary['assumptions']['unlimited_free_items']}
    base={a['location_id'] for a in primary['areas']}
    allowed=set(areas) | base
    rates={a:Counter() for a in allowed}
    for s in catalog['sources'].values():
        if s['kind']!='explore' or s['location_id'] not in rates: continue
        cond=s['conditions']
        if cond.get('frozen'): continue
        if any(cond.get(k) is not None and cond[k]!=v for k,v in [('ironDepot',primary['assumptions']['iron_depot']),('runecube',primary['assumptions']['runecube']),('manualFishing',False)]): continue
        rates[s['location_id']][s['item_id']]=s['expected_drops_per_explore']
    craft_inputs={r for i in items.values() for r in i['direct_ingredients']}
    original={b['item_id']:max(0,b['expected_final_inventory']-b['reserved_target_output']) for b in primary['item_balances'] if b['item_id'] in craft_inputs and b['item_id'] not in free}
    original={r:q for r,q in original.items() if q>=1}
    total=sum(original.values()) or 1
    initial_crafted={b['item_id']:b['crafted'] for b in primary['item_balances']}
    excluded={t['item_id'] for t in primary['targets']} | free
    replacement=sum(q/max((v[r] for v in rates.values()),default=0) for r,q in original.items() if max((v[r] for v in rates.values()),default=0)>0)
    explore_scale=max(1,primary['optimal_total_explores'] or replacement)
    @lru_cache(None)
    def ingredients(r):
        out=Counter()
        for child,q in items[r]['direct_ingredients'].items():
            if child in free: continue
            out[child]+=q*factor
            for raw,need in ingredients(child).items(): out[raw]+=q*factor*need/items[child]['output_quantity']
        return out
    def metrics(p,weight=.15):
        used={b['item_id']:min(original.get(b['item_id'],0),max(0,b.get('used_by_leftover_craft',0)-(b['crafted']-initial_crafted.get(b['item_id'],0)))) for b in p['item_balances']}
        extra=p['optimal_total_explores']-primary['optimal_total_explores']
        new=set(a['location_id'] for a in p['areas'])-base
        quantity=sum(used.values()); shares=sum(used.get(r,0)/q for r,q in original.items())/max(1,len(original))
        breadth=sum(t['crafts']>=1 for t in p.get('secondary',{}).get('targets',[]))
        score=4*quantity/total+2*shares-weight*extra/explore_scale-.06*len(new)
        return dict(score=score,materials_total=sum(original.values()),materials_used_fraction=quantity/total,average_material_share=shares,materials_used=quantity,material_types_used=sum(q>=1 for q in used.values()),extra_explores=extra,new_locations=sorted(new),crafted_types=breadth,original_materials=[dict(item_id=r,name=items[r]['name'],quantity=q,used=used.get(r,0),remaining=max(0,q-used.get(r,0))) for r,q in sorted(original.items(),key=lambda pair:-pair[1])])
    def proposals(p,goals,locations,assist,weight):
        stock={b['item_id']:max(0,b.get('expected_unused',b['expected_final_inventory']-b['reserved_target_output'])) for b in p['item_balances']}
        best_rates={r:max((rates[a][r] for a in locations),default=0) for r in items}
        chosen=excluded | {g['item_id'] for g in goals}
        def simulate(r,count):
            left=Counter(stock); missing=Counter()
            def need(ref,q):
                if ref in free:return
                take=min(left[ref],q);left[ref]-=take;q-=take
                if q<1e-7:return
                if not items[ref]['craftable']:missing[ref]+=q;return
                n=math.ceil(q/items[ref]['output_quantity']-1e-9)
                for child,amount in items[ref]['direct_ingredients'].items():need(child,n*amount*factor)
                left[ref]+=n*items[ref]['output_quantity']-q
            for child,q in items[r]['direct_ingredients'].items():need(child,q*count*factor)
            used={r:max(0,q-left[r]) for r,q in stock.items()}
            return used,missing
        candidates=[]
        for r,i in items.items():
            if not i['craftable'] or r in chosen:continue
            needs=ingredients(r)
            anchors=[stock.get(a,0)/q for a,q in needs.items() if q>0 and stock.get(a,0)/q>=1]
            if not anchors:continue
            bound=min(100000000,math.floor(max(anchors)))
            low,high=0,bound
            while low<high:
                mid=(low+high+1)//2
                if simulate(r,mid)[1]:high=mid-1
                else:low=mid
            counts={low} if not assist else {low,*[math.floor(bound*f) for f in (.02,.1,.5,1)]}
            for count in counts:
                if not count:continue
                used,missing=simulate(r,count)
                if any(best_rates[a]<=0 for a in missing):continue
                estimate=sum(q/best_rates[a] for a,q in missing.items())
                if missing and not assist:continue
                gain=4*sum(min(original.get(a,0),q) for a,q in used.items())/total
                gain+=2*sum(min(original.get(a,0),q)/original[a] for a,q in used.items() if a in original)/max(1,len(original))
                gain-=weight*estimate/explore_scale
                if gain>1e-8:candidates.append((gain,r,count,bool(missing)))
        candidates.sort(key=lambda t:(-t[0],t[1],t[2]))
        # Evaluate a diverse shortlist, not four batch sizes of the same craft.
        out=[];seen=set()
        for _,r,count,missing in candidates:
            if r in seen:continue
            seen.add(r);out.append(dict(item_id=r,cap=count,allow_exploration=assist and missing,prioritize=False,automatic_batch=True))
            if len(out)==4:break
        return out
    cache={};evaluated={};tested=0;evaluation_ceiling=SEARCH_LIMIT
    def search(locations,assist,seed=None,weight=.15):
        nonlocal tested
        key=(tuple(sorted(locations)),assist,weight)
        if key in cache:return cache[key]
        goals=[];current=primary;best=metrics(current,weight)
        for step in range(len(goals),12):
            if tested>=evaluation_ceiling:break
            winner=None
            for candidate in proposals(current,goals,locations,assist,weight):
                trial=goals+[candidate]
                signature=(tuple((g['item_id'],g['cap'],g['allow_exploration']) for g in trial),tuple(sorted(locations)) if any(g['allow_exploration'] for g in trial) else ())
                if signature not in evaluated:
                    if tested>=evaluation_ceiling:break
                    tested+=1;progress(f'Trying leftover crafts: {tested} of up to {SEARCH_LIMIT} plans…')
                    try:evaluated[signature]=consume_leftovers(catalog,primary,trial,areas=sorted(locations))
                    except ValueError:evaluated[signature]=None
                p=evaluated[signature]
                if p is None:continue
                m=metrics(p,weight)
                if len(m['new_locations'])>max_extra+1:continue
                if m['score']>best['score']+1e-6:
                    best=m;winner=(p,candidate)
            if winner is None:break
            current,candidate=winner;goals.append(candidate)
        if seed and metrics(seed['plan'],weight)['score']>best['score']:
            current=seed['plan'];goals=list(seed['goals'])
        entry=dict(plan=current,goals=goals,areas=sorted(locations),metrics=metrics(current,weight))
        cache[key]=entry;return entry
    ready=search(base,False)
    found=[ready]
    # Three cost weights reveal the tradeoff instead of burying it in one score.
    # Compare every final candidate at the same balanced weight afterwards.
    for profile,weight in enumerate((.5,.15,.06)):
        evaluation_ceiling=min(SEARCH_LIMIT,max(tested,(profile+1)*SEARCH_LIMIT//3))
        current=search(base,True,ready,weight);found.append(current)
        beam=[(set(base),current)]
        for level in range(1,min(max_extra+1,len(allowed-base))+1):
            choices={}
            for locations,seed in beam:
                for area in sorted(allowed-locations):
                    scope=locations|{area};key=tuple(sorted(scope))
                    if key not in choices:
                        entry=search(scope,True,seed,weight);choices[key]=(scope,entry);found.append(entry)
            if not choices or tested>=SEARCH_LIMIT:break
            ranked=sorted(choices.values(),key=lambda pair:(-pair[1]['metrics']['score'],tuple(sorted(pair[0]))))
            beam=ranked[:4]
    def choose(limit,weight):
        eligible=[e for e in found if len(e['metrics']['new_locations'])<=limit]
        return max(eligible,key=lambda e:metrics(e['plan'],weight)['score'])
    def option(label,limit,entry):
        return dict(label=label,max_extra_locations=limit,**entry,)
    options=[option('No extra exploring',0,ready)]
    for label,limit in [('Your location limit',max_extra),('One more location',max_extra+1)]:
        balanced=choose(limit,.15);higher=choose(limit,.06);cheaper=choose(limit,.5)
        options.append(option(label,limit,balanced))
        if cheaper['metrics']['extra_explores']<balanced['metrics']['extra_explores']*.75 and cheaper['metrics']['materials_used']<balanced['metrics']['materials_used']-.05*total:
            options.append(option(label+' · less exploring',limit,cheaper))
        if higher['metrics']['materials_used']>balanced['metrics']['materials_used']+max(1,.05*total):
            options.append(option(label+' · use more leftovers',limit,higher))
    return dict(options=options,baseline_explores=primary['optimal_total_explores'],search_limit=SEARCH_LIMIT,search_limit_reached=tested>=SEARCH_LIMIT,plans_checked=tested,heuristic=True)
