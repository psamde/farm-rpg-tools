from copy import deepcopy
import json
import time
from collections import OrderedDict
_PRIMARY_CACHE = OrderedDict()
_CACHE_CATALOG = None

from planner import ranked_plans, passive_plans
from secondary import consume_leftovers

def compute(catalog, payload, progress=lambda done,total: None, deferred=None):
    global _CACHE_CATALOG
    started = time.perf_counter()
    # Old saved area limits no longer restrict either phase.
    payload = dict(payload, max_areas=len(catalog['locations']))
    for name, default in dict(planner_mode='goals', inventory={}, iron_depot=False, runecube=False, resource_saver=0, combinations_mode=False).items():
        payload.setdefault(name, default)
    if _CACHE_CATALOG is not catalog:
        _PRIMARY_CACHE.clear()
        _CACHE_CATALOG = catalog
    key = json.dumps({k: payload.get(k) for k in ('planner_mode','targets','areas','inventory','iron_depot','runecube','resource_saver','max_areas','combinations_mode')}, sort_keys=True)
    hit = key in _PRIMARY_CACHE
    common = dict(areas=payload['areas'], inventory=payload.get('inventory', {}),
                  iron_depot=payload.get('iron_depot', False), runecube=payload.get('runecube', False),
                  resource_saver=payload.get('resource_saver', 0))
    if hit:
        result = deepcopy(_PRIMARY_CACHE[key])
    else:
        if payload.get('planner_mode') == 'passive':
            result = passive_plans(catalog, max_areas=payload.get('max_areas',3), **common)
            result['production_interval'] = payload.get('production_interval',60)
        else:
            result = ranked_plans(catalog, payload['targets'], max_areas=payload.get('max_areas', 3),
                                  combinations_mode=payload.get('combinations_mode', False), progress=progress, **common)
        _PRIMARY_CACHE[key] = deepcopy(result)
        while len(_PRIMARY_CACHE) > 4:
            _PRIMARY_CACHE.popitem(last=False)
    if payload.get('planner_mode') == 'passive':
        result['production_interval'] = payload.get('production_interval',60)
    progress(0, None)
    if payload.get('secondary'):
        for i, primary in enumerate(result['plans']):
            progress(0, None)
            result['plans'][i] = consume_leftovers(catalog, primary, payload['secondary'], areas=sorted((set(payload['automatic_areas']) & set(payload['areas']) if payload.get('automatic_areas') is not None else set(payload['areas'])) | {a['location_id'] for a in primary['areas']}), max_areas=payload.get('max_areas', 3), progress=lambda: progress(0, None), defer_comparison=deferred.append if deferred is not None else None)
    result['plans'].sort(key=lambda p: (p['optimal_total_explores'], len(p['areas'])))
    unique = {}
    for p in result['plans']:
        signature = (tuple(sorted((a['location_id'], a['explores']) for a in p['areas'])),
                     tuple((t['item_id'], t['crafts']) for t in p.get('secondary', {}).get('targets', [])))
        unique.setdefault(signature, p)
    result['plans'] = list(unique.values())
    result['enumeration']['feasible_options'] = len(result['plans'])
    result['performance'] = dict(primary_cache_hit=hit, compute_seconds=time.perf_counter()-started)
    return result


def automatic_compute(catalog, payload, progress=lambda message: None):
    from automatic import maximize
    baseline = compute(catalog, dict(payload, secondary=[]), lambda done,total: progress(f'Preparing primary route: {done} of {total}…' if total else 'Preparing primary route…'))
    primary = next((p for p in baseline['plans'] if p['area_set_id']==payload.get('selected_plan_key')), baseline['plans'][0])
    return maximize(catalog, primary, payload['areas'], payload.get('max_extra_locations',1), progress)


def guided_compute(catalog, payload, progress=lambda message: None):
    """Evaluate alternatives independently against the same primary/shared pool."""
    progress('Preparing the primary route (reusing it when cached)…')
    baseline = compute(catalog, dict(payload, secondary=[]), lambda done,total: progress(f'Checking primary routes: {done}…') if done else None)
    primary = next((p for p in baseline['plans'] if p['area_set_id']==payload.get('selected_plan_key')), baseline['plans'][0])
    goals = payload.get('secondary', [])
    areas = sorted((set(payload.get('automatic_areas') or payload['areas']) & set(payload['areas'])) | {a['location_id'] for a in primary['areas']})
    def allocate(gs):
        return consume_leftovers(catalog, primary, gs, areas=areas, defer_comparison=lambda _:None) if gs else deepcopy(primary)
    current = allocate(goals)
    before = {b['item_id']:b for b in current['item_balances']}
    old_outputs = {g['item_id']:g['crafts'] for g in current.get('secondary',{}).get('targets',[])}
    if payload.get('chosen_goals'):
        chosen = payload['chosen_goals']
        refs = [g['item_id'] for g in chosen]
        if len(set(refs)) != len(refs) or set(refs) & (set(old_outputs) | set(payload.get('targets',{}))):
            raise ValueError('Choose each new leftover craft only once.')
        progress('Checking your selected crafts together…')
        plan = allocate([*goals, *chosen])
        outputs = {g['item_id']:g['crafts'] for g in plan.get('secondary',{}).get('targets',[])}
        balances={b['item_id']:b for b in plan['item_balances']}
        return dict(goals=chosen, outputs=[dict(item_id=r,crafts=outputs.get(r,0),remaining=balances.get(r,{}).get('expected_final_inventory',0)) for r in refs],
            total_explores=plan['optimal_total_explores'],
            extra_explores=plan['optimal_total_explores']-current['optimal_total_explores'],
            new_locations=sorted({a['location_id'] for a in plan['areas']}-{a['location_id'] for a in current['areas']}),
            reduced=[dict(item_id=r,before=q,after=outputs.get(r,0)) for r,q in old_outputs.items() if outputs.get(r,0)<q-1e-6])
    options, failures = [], []
    for i, candidate in enumerate(payload.get('candidates', [])[:30]):
        progress(f'Checking crafting option {i+1} of {min(30,len(payload["candidates"]))}…')
        ref = str(candidate['item_id'])
        if ref in payload.get('targets',{}) or any(g['item_id']==ref for g in goals):continue
        goal = dict(item_id=ref,cap=int(candidate['cap']),allow_exploration=bool(candidate.get('allow_exploration')),automatic_batch=True)
        if goal['cap']<1:continue
        try:
            plan = allocate([*goals,goal])
            outputs={g['item_id']:g['crafts'] for g in plan.get('secondary',{}).get('targets',[])}
            if outputs.get(ref,0)<1:continue
            used={}
            for b in plan['item_balances']:
                old=before.get(b['item_id'],{})
                # Credit only net consumption of supplies already available, not
                # additional drops or newly made intermediary ingredients.
                net=(b['consumed_by_crafting']-old.get('consumed_by_crafting',0))-(b['crafted']-old.get('crafted',0))
                used[b['item_id']]=min(max(0,old.get('expected_unused',old.get('expected_final_inventory',0)-old.get('reserved_target_output',0))),max(0,net))
            focus=used.get(str(payload['material']),0)
            if focus<1e-6:continue
            options.append(dict(goal=goal,crafts=outputs[ref],material_used=focus,materials_used=sum(used.values()),
                extra_explores=plan['optimal_total_explores']-current['optimal_total_explores'],
                total_explores=plan['optimal_total_explores'],
                new_locations=sorted({a['location_id'] for a in plan['areas']}-{a['location_id'] for a in current['areas']}),
                reduced=[dict(item_id=r,before=q,after=outputs.get(r,0)) for r,q in old_outputs.items() if outputs.get(r,0)<q-1e-6],
                remaining_material=next((b.get('expected_unused',0) for b in plan['item_balances'] if b['item_id']==str(payload['material'])),0)))
        except ValueError as error:
            failures.append(dict(item_id=ref,message=str(error)))
    options.sort(key=lambda o:(-o['material_used'],-o['materials_used'],o['extra_explores'],len(o['new_locations'])))
    return dict(options=options,failures=failures,baseline_explores=current['optimal_total_explores'])
