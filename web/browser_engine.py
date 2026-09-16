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
