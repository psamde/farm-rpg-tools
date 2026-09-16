"""Balanced mastery progress over one shared physical inventory.

Continuous concave-utility allocation, followed by conservative whole-output
rounding and dependency repair. Explicit disjoint priorities get first claim;
list order is visual. Extra exploring has a positive cost; only enabled rows justify it.
"""
from collections import Counter
from copy import deepcopy
from functools import lru_cache
import math


def consume(catalog, primary, goals, areas=None, max_areas=15, progress=None):
    import numpy as np
    from scipy.optimize import Bounds, LinearConstraint, milp
    from planner import resolve
    requested_order={g["item_id"]:i for i,g in enumerate(goals)}
    goals=sorted(deepcopy(goals),key=lambda g:g["item_id"])
    items = catalog['items']
    factor = 1/(1+primary['assumptions']['resource_saver']/100)
    free = {r['id'] for r in primary['assumptions']['unlimited_free_items']}
    pool = Counter({b['item_id']:max(0,b['expected_final_inventory']-b['reserved_target_output'])
                    for b in primary['item_balances']})
    order, seen, active = [], set(), set()
    def visit(r):
        if r in active: raise ValueError('Recipe cycle')
        if r in seen or r in free: return
        active.add(r)
        for child in items[r]['direct_ingredients']: visit(child)
        active.remove(r); seen.add(r)
        if items[r]['craftable']: order.append(r)
    for g in goals: visit(g['item_id'])
    locations = {i:r for i,r in catalog['locations'].items() if r['kind']=='explore'}
    allowed = {resolve(locations,a) for a in areas} if areas is not None else set(locations)
    rates = {a:Counter() for a in sorted(allowed)}
    for s in catalog['sources'].values():
        if s['kind']!='explore' or s['location_id'] not in rates: continue
        cond=s['conditions']
        if cond.get('frozen') or any(cond.get(k) is not None and cond[k]!=v for k,v in
            [('ironDepot',primary['assumptions'].get('iron_depot',False)),
             ('runecube',primary['assumptions'].get('runecube',False)),('manualFishing',False)]): continue
        a,r,q=s['location_id'],s['item_id'],s['expected_drops_per_explore']
        if r in rates[a] or not math.isfinite(q) or q<=0: raise ValueError('Invalid exploration table')
        rates[a][r]=q
    if any(not v for v in rates.values()): raise ValueError('Missing exploration table')
    base_e={a['location_id']:a['explores'] for a in primary['areas']}
    # Priority conflicts include every dependency, excluding free perk supplies.
    def dependencies(r):
        out=set()
        for child in items[r]['direct_ingredients']:
            if child in free: continue
            out.add(child); out.update(dependencies(child))
        return out
    preferred=[g for g in goals if g.get('prioritize',False)]
    inputs={g['item_id']:dependencies(g['item_id']) for g in preferred}
    for g in goals:
        conflicts={other['item_id']:sorted(inputs[g['item_id']] & inputs[other['item_id']])
            for other in preferred if g.get('prioritize') and other is not g
            and inputs[g['item_id']] & inputs[other['item_id']]}
        g['priority_conflicts']=conflicts
        g['priority_active']=bool(g.get('prioritize') and not conflicts)
    assisted=[g for g in goals if g['allow_exploration']]
    caps={g['item_id']:g['cap'] for g in goals if g.get('cap') is not None}
    refs=sorted(seen-free)
    C={r:i for i,r in enumerate(order)}
    E={a:len(C)+i for i,a in enumerate(rates)}
    # Utility saturates at a reference share, not a hard physical craft limit.
    # Final fixed-route allocation uses each craft's own achievable maximum.
    breaks=[0,.02,.05,.1,.2,.35,.5,.75,1]
    segments=len(breaks)-1
    Z={g['item_id']:list(range(len(C)+len(E)+j*segments,len(C)+len(E)+(j+1)*segments))
       for j,g in enumerate(goals)}
    n=len(C)+len(E)+len(goals)*segments
    matrix=np.zeros((len(refs),n))
    for j,r in enumerate(refs):
        for c,col in C.items(): matrix[j,col]=(items[c]['output_quantity'] if c==r else 0)-items[c]['direct_ingredients'].get(r,0)*factor
        for a,col in E.items(): matrix[j,col]=rates[a][r]
    low=np.zeros(n); high=np.full(n,np.inf)
    for r,cap in caps.items():
        if r in C: high[C[r]]=cap
    for cols in Z.values():
        for k,col in enumerate(cols): high[col]=breaks[k+1]-breaks[k]
    constraints=[LinearConstraint(matrix,[-pool[r] for r in refs],np.inf)]
    cost_scale=max(1,primary['optimal_total_explores'])
    # Passive mode uses the cost of obtaining its actual stock as a reference.
    if primary['optimal_total_explores']==0:
        raw_stock=Counter()
        def expand_stock(r,q):
            if r in free: return
            if not items[r]['craftable']: raw_stock[r]+=q; return
            for child,amount in items[r]['direct_ingredients'].items():
                expand_stock(child,q*amount*factor/items[r]['output_quantity'])
        for r,q in pool.items():
            if q>0 and r in seen: expand_stock(r,q)
        cost_scale=max(1,sum(q/max((v[r] for v in rates.values()),default=0)
                         for r,q in raw_stock.items() if max((v[r] for v in rates.values()),default=0)>0))
    if not assisted:
        for col in E.values(): high[col]=0
    @lru_cache(None)
    def ingredients(r):
        out=Counter()
        for child,q in items[r]['direct_ingredients'].items():
            if child in free: continue
            out[child]+=q*factor
            for raw,need in ingredients(child).items(): out[raw]+=q*factor*need/items[child]['output_quantity']
        return out
    @lru_cache(None)
    def available(r):
        if r in free: return 0
        if not items[r]['craftable']: return pool[r]
        # Maximize retained intermediate material using the actual stock ledger.
        # Flattening to raw ingredients loses existing bottles/leather/etc;
        # independently expanding branches can also spend shared stock twice.
        stock_high=high.copy()
        for col in E.values(): stock_high[col]=0
        for cols in Z.values():
            for col in cols: stock_high[col]=0
        net=matrix[refs.index(r)].copy()
        for col in E.values(): net[col]=0
        try: x=solve(-net,bounds=Bounds(low,stock_high))
        except ValueError as error:
            if 'unbounded' not in str(error).lower(): raise
            return 0
        return max(0,pool[r]+float(net@x))
    def solve(objective, extra=(), bounds=None):
        if progress: progress()
        r=milp(objective,integrality=np.zeros(n),bounds=bounds or Bounds(low,high),
               constraints=[*constraints,*extra],options={'time_limit':15})
        if not r.success: raise ValueError('Could not balance leftovers: '+r.message)
        return r.x
    def utility(selected,scales,explore_cost):
        objective=np.zeros(n); extra=[]
        for i,g in enumerate(goals):
            r=g['item_id']; scale=scales.get(r,0)
            if r not in C or r not in selected or scale<1e-8: continue
            row=np.zeros(n); row[C[r]]=-1/scale
            for col in Z[r]: row[col]=1
            extra.append(LinearConstraint(row,-np.inf,0))
            weight=3 if g['priority_active'] else 1
            for k,col in enumerate(Z[r]):
                objective[col]=-weight*(math.log1p(9*breaks[k+1])-math.log1p(9*breaks[k]))/(breaks[k+1]-breaks[k])
        for col in E.values(): objective[col]=explore_cost/cost_scale
        x=solve(objective,extra)
        optimum=float(objective@x)
        # Preserve the utility/cost tradeoff, then avoid incidental exploration
        # and unnecessary intermediates in equal-utility solutions.
        extra.append(LinearConstraint(objective,-np.inf,optimum+1e-8))
        tie=np.zeros(n)
        for col in E.values(): tie[col]=1/cost_scale
        for col in C.values(): tie[col]=1e-10
        return solve(tie,extra)
    scales={}
    for g in assisted:
        r=g['item_id']
        if r not in C: continue
        needs=ingredients(r)
        # Existing stocks across the recipe set a finite exploration aim.
        # Direct intermediates are computed from a shared-stock LP, so existing
        # bottles count and overlapping raw ingredients are not spent twice.
        direct=[available(a)/needs[a] for a in items[r]['direct_ingredients'] if a in needs]
        direct=[q for q in direct if q>=1-1e-8]
        references=direct or [pool[a]/q for a,q in needs.items() if q>0 and pool[a]/q>=1-1e-8]
        # Fractions too small for one craft are shortages to fill, not anchors.
        # Fill missing branches around the scarce existing input. An abundant
        # incidental drop must not inflate every recipe into an enormous goal.
        amount=min(references,default=0)
        if amount<1e-8: continue
        scales[r]=amount
        if g['cap'] is not None: scales[r]=min(scales[r],g['cap'])
    x=utility(set(scales),scales,.25) if scales else solve(np.zeros(n))
    extra_e={a:int(math.ceil(max(0,x[col])-1e-7)) for a,col in E.items()}
    for a,col in E.items(): low[col]=high[col]=extra_e[a]
    maxima={}
    for g in goals:
        r=g['item_id']
        if r not in C: maxima[r]=0; continue
        objective=np.zeros(n); objective[C[r]]=-1
        try: solo=solve(objective); maxima[r]=max(0,solo[C[r]])
        except ValueError as err:
            if 'unbounded' not in str(err).lower(): raise
            maxima[r]=0
    # On the chosen route, disjoint priorities get first claim. Their solo
    # maxima are jointly feasible because their complete input sets do not overlap.
    for g in goals:
        r=g['item_id']
        if g['priority_active'] and r in C and maxima[r]>0:
            row=np.zeros(n); row[C[r]]=1
            constraints.append(LinearConstraint(row,max(0,maxima[r]-max(1e-6,maxima[r]*1e-8)),np.inf))
    x=utility(set(maxima),maxima,0)
    explored=Counter()
    for a,q in extra_e.items():
        if not q: continue
        for r,rate in rates[a].items(): explored[r]+=q*rate
    stock=pool+explored
    # Retained selected outputs are distinct from intermediary craft counts.
    consumed=Counter(); produced=Counter()
    for r,col in C.items():
        produced[r]+=x[col]*items[r]['output_quantity']
        for child,q in items[r]['direct_ingredients'].items(): consumed[child]+=x[col]*q*factor
    outputs={g['item_id']:max(0,stock[g['item_id']]+produced[g['item_id']]-consumed[g['item_id']]) for g in goals}
    def round_plan(scale):
        need=Counter({r:math.floor(q*scale+1e-5) for r,q in outputs.items()})
        counts={}
        for r in reversed(order):
            count=max(0,math.ceil((need[r]-stock[r]-1e-7)/items[r]['output_quantity']))
            if count>caps.get(r,math.inf): return None
            counts[r]=count
            for child,q in items[r]['direct_ingredients'].items(): need[child]+=count*q*factor
        if any(q>stock[r]+1e-6 for r,q in need.items() if r not in C and r not in free): return None
        return counts
    counts=round_plan(1)
    retained=1.0
    if counts is None:
        left,right=0.,1.
        for _ in range(30):
            mid=(left+right)/2
            if round_plan(mid) is not None: left=mid
            else: right=mid
        retained=left; counts=round_plan(left)
    if counts is None: raise ValueError('Could not verify whole-craft allocation')
    goals.sort(key=lambda g:requested_order[g["item_id"]])
    return report(catalog,primary,goals,counts,extra_e,rates,pool,factor,free,maxima,scales,retained)


def report(catalog,primary,goals,counts,extra_e,rates,pool,factor,free,maxima,scales,retained):
    items=catalog['items']; result=deepcopy(primary)
    cp,cc,explored=Counter(),Counter(),Counter()
    for r,q in counts.items():
        cp[r]+=q*items[r]['output_quantity']
        for child,need in items[r]['direct_ingredients'].items(): cc[child]+=q*need*factor
    for a,q in extra_e.items():
        if not q: continue
        for r,rate in rates[a].items(): explored[r]+=rate*q
    old={b['item_id']:b for b in primary['item_balances']}
    selected={g['item_id'] for g in goals}
    balances={}
    for r in set(old)|set(cp)|set(cc)|set(explored):
        b=deepcopy(old.get(r,dict(item_id=r,name=items[r]['name'],starting_inventory=0,
            expected_exploration_drops=0,crafted=0,free_perk_supply=0,consumed_by_crafting=0,
            reserved_target_output=0,expected_final_inventory=0)))
        b['expected_exploration_drops']+=explored[r]; b['crafted']+=cp[r]; b['consumed_by_crafting']+=cc[r]
        remaining=b['expected_final_inventory']+explored[r]+cp[r]-cc[r]
        if r in free:
            supply=max(0,b['reserved_target_output']-remaining); b['free_perk_supply']+=supply; remaining+=supply
        if remaining<b['reserved_target_output']-1e-6: raise ValueError('Balanced allocation exceeded its material supply')
        kept=min(max(0,cp[r]-cc[r]),max(0,remaining-b['reserved_target_output'])) if r in selected else 0
        b.update(expected_final_inventory=max(0,remaining),reserved_secondary_output=kept,
            expected_unused=max(0,remaining-b['reserved_target_output']-kept),used_by_leftover_craft=cc[r],original_leftover_pool=pool[r])
        balances[r]=b
    total=primary['optimal_total_explores']+sum(extra_e.values())
    area_counts=Counter({a['location_id']:a['explores'] for a in primary['areas']})+Counter(extra_e)
    area_rows=[]
    for a,count in area_counts.items():
        row=dict(location_id=a,name=catalog['locations'][a]['name'],explores=count,fraction_of_explores=count/total if total else 0,items=[])
        for r,rate in rates[a].items():
            b=balances[r]; amount=count*rate; overall=b['expected_exploration_drops']
            needed=min(overall,max(0,b['consumed_by_crafting']+b['reserved_target_output']-b['starting_inventory']-b['crafted']))
            used=amount*needed/overall if overall else 0
            row['items'].append(dict(item_id=r,name=items[r]['name'],expected_drops=amount,used=used,unused=max(0,amount-used)))
        area_rows.append(row)
    targets=[]
    for g in goals:
        r=g['item_id']; count=counts.get(r,0); alone=max(count,int(math.floor(maxima.get(r,0)+1e-7)))
        row=dict(**g,name=items[r]['name'],crafts=count,if_first=alone,comparison_status='complete',comparison_kind='alone',
            lost_to_priority=alone>count+max(2,alone*.001),crafts_from_final_surplus=0,pool_credit_used=0,pool_credit_if_first=0,missing_for_next_craft=[])
        if not count:
            available=Counter({r:max(0,b['expected_final_inventory']-b['reserved_target_output']) for r,b in balances.items()})
            missing=Counter()
            def need(r,q):
                if r in free: return
                take=min(available[r],q); available[r]-=take; q-=take
                if q<1e-7: return
                if not items[r]['craftable']: missing[r]+=q; return
                n=math.ceil(q/items[r]['output_quantity']); available[r]+=n*items[r]['output_quantity']-q
                for child,amount in items[r]['direct_ingredients'].items(): need(child,n*amount*factor)
            for child,q in items[r]['direct_ingredients'].items(): need(child,q*factor)
            row['missing_for_next_craft']=[dict(item_id=r,name=items[r]['name'],quantity=q) for r,q in missing.items()]
        targets.append(row)
    result.update(areas=area_rows,optimal_total_explores=total,item_balances=sorted(balances.values(),key=lambda b:b['name']),
        unused_items=[b for b in balances.values() if b['expected_unused']>1e-8],continuous_lower_bound_explores=None,
        model='balanced mastery progress with explicit disjoint priorities')
    result['solver']=dict(name='SciPy/HiGHS',optimal=False,scope='balanced continuous utility; verified whole-craft repair',tie_break='fewest extra explores and crafts')
    result['secondary']=dict(schema_version='3.0.0',targets=targets,primary_explores=primary['optimal_total_explores'],
        additional_explores=sum(extra_e.values()),route_reoptimized=bool(sum(extra_e.values())),
        priority_matters=any(t['lost_to_priority'] for t in targets),
        crafts_in_dependency_order=[dict(item_id=r,name=items[r]['name'],crafts=q,expected_paid_crafts=q*factor) for r,q in reversed(list(counts.items())) if q],
        pool=[dict(item_id=r,name=items[r]['name'],quantity=q) for r,q in pool.items() if q>0],
        semantics='Balance achievable crafting shares. Conflict-free priorities get first claim; list order is visual. All route supplies are shared.',
        rounding_retained_fraction=retained,exploration_reference_crafts=scales)
    return result
