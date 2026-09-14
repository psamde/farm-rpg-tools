"""Buddy's Almanac data importer and recursive crafting processor (Python 3.10+)."""
from __future__ import annotations

import argparse
from collections import Counter
from datetime import datetime, timezone
from functools import lru_cache
import hashlib
import json
import math
from pathlib import Path
import re
import sys
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen

ENDPOINT = "https://api.buddy.farm/graphql"
REPOSITORY = "https://github.com/coderanger/buddy.farm"
QUERIES = {
    "recipes": """{ items { id name image type canCraft canCook craftingLevel
        canBuy buyPrice canMail canFleaMarket fleaMarketPrice fleaMarketRotate
        recipeItems { quantity ingredientItem { id name } }
    } }""",
    "drops": """{ items { id manualFishingOnly dropRatesItems {
        rate dropRates { ironDepot manualFishing runecube frozen
            location { gameId name type baseDropRate }
            seed { id name }
        }
    } } }""",
    "sources": """{ items { id
        petItems { level pet { id name } }
        manualProductions { lineOne lineTwo value sort }
        locksmithOutputItems { quantityMin quantityMax item { id name locksmithGrabBag locksmithKey { id name } } }
        wishingWellOutputItems { chance inputItem { id name } }
        exchangeCenterOutputs { lastSeen oneshot inputQuantity outputQuantity inputItem { id name } }
        quizRewards { quantity score quiz { id name } }
        npcRewards { level quantity npc { id name } }
        passwordItems { quantity password { id } }
        towerRewards { level itemQuantity }
        skillLevelRewards { skill level itemQuantity }
        rewardForQuests { quantity quest { id cleanTitle startDate endDate isHidden } }
        cardsTrades { id isDisabled spadesQuantity heartsQuantity diamondsQuantity clubsQuantity jokerQuantity outputQuantity }
        communityCenterOutputs { date inputQuantity outputQuantity progress inputItem { id name } }
        templeRewardItems { id quantity templeReward { inputQuantity inputItem { id name } } }
    } }""",
}
SOURCE_FIELDS = {
    "petItems": "pet", "manualProductions": "manual_production",
    "locksmithOutputItems": "locksmith", "wishingWellOutputItems": "wishing_well",
    "exchangeCenterOutputs": "exchange_center", "quizRewards": "quiz",
    "npcRewards": "friendship", "passwordItems": "mailbox_password",
    "towerRewards": "tower", "skillLevelRewards": "skill_level",
    "rewardForQuests": "quest", "cardsTrades": "house_of_cards",
    "communityCenterOutputs": "community_center", "templeRewardItems": "temple",
}


def write_json(path, data):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_suffix(path.suffix + ".tmp")
    temp.write_text(json.dumps(data, indent=2, ensure_ascii=False, allow_nan=False) + "\n", encoding="utf-8")
    temp.replace(path)


def read_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def digest(data):
    return hashlib.sha256(json.dumps(data, sort_keys=True, separators=(",", ":")).encode()).hexdigest()


def graphql(query, endpoint):
    # GET works with Buddy's public endpoint; some networks reject GraphQL POST.
    query = " ".join(query.split())
    request = Request(endpoint + "?" + urlencode({"query": query}), headers={
        "User-Agent": "FarmData/1.0 (local FarmRPG reference-data processor)",
        "Accept": "application/json",
    })
    for attempt in range(3):
        try:
            with urlopen(request, timeout=120) as response:
                result = json.load(response)
            if result.get("errors"):
                raise ValueError("GraphQL errors: " + json.dumps(result["errors"]))
            rows = result["data"]["items"]
            if not isinstance(rows, list) or not rows:
                raise ValueError("API returned no items")
            return rows
        except HTTPError as error:
            if error.code not in (429, 500, 502, 503, 504) or attempt == 2:
                raise
        except (URLError, TimeoutError):
            if attempt == 2:
                raise
        time.sleep(2 ** attempt)


def fetch(cache, endpoint=ENDPOINT, refresh=False):
    cache = Path(cache)
    groups, manifest = {}, []
    for name, query in QUERIES.items():
        path = cache / (name + ".json")
        key = digest({"query": query, "endpoint": endpoint})
        part = read_json(path) if path.exists() and not refresh else None
        if part is None or part.get("query_hash") != key:
            print("Fetching " + name + "...", file=sys.stderr, flush=True)
            rows = graphql(query, endpoint)
            part = {"query_hash": key, "endpoint": endpoint,
                    "fetched_at": datetime.now(timezone.utc).isoformat(), "items": rows}
            write_json(path, part)
        groups[name] = part["items"]
        manifest.append({"group": name, "fetched_at": part["fetched_at"],
                         "query_hash": key, "data_sha256": digest(part["items"])})
    combined = {}
    expected = None
    for name, rows in groups.items():
        ids = {str(row["id"]) for row in rows}
        if len(ids) != len(rows):
            raise ValueError("Duplicate IDs in " + name)
        if expected is not None and ids != expected:
            raise ValueError("Item IDs changed between queries; rerun fetch --refresh")
        expected = ids
        for row in rows:
            combined.setdefault(str(row["id"]), {}).update(row)
    snapshot = {"snapshot_version": 1, "upstream": {"repository": REPOSITORY,
        "endpoint": endpoint, "parts": manifest}, "items": list(combined.values())}
    write_json(cache / "snapshot.json", snapshot)
    return snapshot


def positive(value, description):
    if isinstance(value, bool) or not isinstance(value, (int, float)) or not math.isfinite(value) or value <= 0:
        raise ValueError("Expected positive finite number: " + description)
    return value


def slug(name):
    return re.sub(r"[^a-z0-9_]+", "-", name.strip().lower())


def process(snapshot):
    if snapshot.get("snapshot_version") != 1:
        raise ValueError("Unsupported snapshot_version")
    raw = {str(row["id"]): row for row in snapshot["items"]}
    if not raw or len(raw) != len(snapshot["items"]):
        raise ValueError("Empty snapshot or duplicate item IDs")
    recipes = {}
    for item_id, row in raw.items():
        ingredients = Counter()
        if row["canCraft"]:
            if not row["recipeItems"]:
                raise ValueError("Craftable item has no recipe: " + row["name"])
            for ingredient in row["recipeItems"]:
                ref = str(ingredient["ingredientItem"]["id"])
                if ref not in raw:
                    raise ValueError("Missing ingredient " + ref + " for " + row["name"])
                ingredients[ref] += positive(ingredient["quantity"], row["name"])
        recipes[item_id] = dict(ingredients)

    visiting = []

    @lru_cache(None)
    def expand(item_id):
        if item_id in visiting:
            raise ValueError("Recipe cycle: " + " -> ".join(raw[i]["name"] for i in visiting + [item_id]))
        if not recipes[item_id]:
            return {item_id: 1}, {}
        visiting.append(item_id)
        materials, crafts = Counter(), Counter({item_id: 1})
        for ref, quantity in recipes[item_id].items():
            leaves, steps = expand(ref)
            for leaf, count in leaves.items():
                materials[leaf] += quantity * count
            for craft, count in steps.items():
                crafts[craft] += quantity * count
        visiting.pop()
        return dict(sorted(materials.items())), dict(sorted(crafts.items()))

    items, locations, sources, warnings = {}, {}, {}, []
    direct_users, raw_users = {i: {} for i in raw}, {i: {} for i in raw}
    for item_id in sorted(raw, key=int):
        row = raw[item_id]
        materials, crafts = expand(item_id)
        source_ids = []

        def add_source(kind, **details):
            body = {"item_id": item_id, "kind": kind, **details}
            source_id = "s_" + digest(body)[:24]
            sources[source_id] = body
            if source_id not in source_ids:
                source_ids.append(source_id)

        for drop in row.get("dropRatesItems", []):
            table = drop["dropRates"]
            location, seed = table.get("location"), table.get("seed")
            conditions = {k: table.get(k) for k in ("ironDepot", "manualFishing", "runecube", "frozen")}
            rate = positive(drop["rate"], "drop rate for " + row["name"])
            if location:
                loc_id = str(location["type"]) + ":" + str(location["gameId"])
                loc = {"id": loc_id, "game_id": location["gameId"], "name": location["name"],
                       "kind": location["type"], "base_drop_rate": location["baseDropRate"]}
                if loc_id in locations and locations[loc_id] != loc:
                    raise ValueError("Inconsistent location " + loc_id)
                locations[loc_id] = loc
                unit = {"explore": "explore", "fishing": "fish", "mining": "pickaxe"}.get(location["type"])
                add_source(location["type"], location_id=loc_id, conditions=conditions,
                           upstream_rate=rate, actions_per_drop=rate if unit else None,
                           drops_per_action=1 / rate if unit else None, action_unit=unit,
                           explores_per_drop=rate if unit == "explore" else None,
                           expected_drops_per_explore=1 / rate if unit == "explore" else None)
                if not unit:
                    warnings.append({"item_id": item_id, "issue": "unknown_location_type", "type": location["type"]})
            elif seed:
                add_source("farming", seed_item_id=str(seed["id"]), conditions=conditions,
                           actions_per_drop=rate, drops_per_action=1 / rate, action_unit="seed")
            else:
                add_source("unknown_drop", upstream=drop)
                warnings.append({"item_id": item_id, "issue": "unresolved_drop_source"})
        for field, kind in SOURCE_FIELDS.items():
            for value in row.get(field, []):
                add_source(kind, details=value)
        if row.get("canBuy") and row.get("buyPrice") is not None:
            add_source("shop", shop="country_store", currency="silver", price=row["buyPrice"])
        if (row.get("canFleaMarket") or row.get("fleaMarketRotate")) and row.get("fleaMarketPrice") is not None:
            add_source("shop", shop="flea_market", currency="gold", price=row["fleaMarketPrice"], rotates=row.get("fleaMarketRotate"))
        if row.get("canMail"):
            add_source("trading", details={"mailable": True})
        if row["canCraft"]:
            add_source("crafting", recipe_item_id=item_id)
        elif row.get("canCook"):
            add_source("cooking", details={"recipeItems": row["recipeItems"]})
        items[item_id] = {
            "id": item_id, "name": row["name"], "slug": slug(row["name"]),
            "buddy_url": "https://buddy.farm/i/" + slug(row["name"]) + "/",
            "image": row.get("image"), "type": row.get("type"),
            "craftable": row["canCraft"], "cookable": row.get("canCook", False),
            "crafting_level": row.get("craftingLevel"),
            "output_quantity": 1, "direct_ingredients": recipes[item_id],
            "raw_materials": materials, "craft_counts": crafts,
            "source_ids": sorted(source_ids), "manual_fishing_only": row.get("manualFishingOnly"),
        }
        for ref, count in recipes[item_id].items():
            direct_users[ref][item_id] = count
        if row["canCraft"]:
            for ref, count in materials.items():
                raw_users[ref][item_id] = count
    for item_id, item in items.items():
        item["used_in"] = direct_users[item_id]
        item["raw_material_for"] = raw_users[item_id]
    no_sources = [i for i, x in items.items() if not x["source_ids"]]
    return {
        "schema_version": "1.0.0",
        "upstream": snapshot.get("upstream", {}),
        "snapshot_sha256": digest(snapshot),
        "semantics": {
            "recipe_basis": "One workshop output, without account perks or Resource Saver",
            "raw_material": "Terminal of workshop recipe expansion; cooking and non-crafting acquisition are not expanded",
            "terminal_self_requirement": True,
            "craft_counts": "Craft operations for one target, including target and all intermediates",
            "rates": "Upstream expected actions per drop, reciprocal retained; conditional tables must not be summed",
            "non_exploration_sources": "Typed source details preserve upstream fields; availability is not inferred",
        },
        "items": items, "locations": locations, "sources": dict(sorted(sources.items())),
        "coverage": {"item_count": len(items), "craftable_count": sum(x["craftable"] for x in items.values()),
                     "location_count": len(locations), "source_count": len(sources),
                     "items_without_sources": no_sources, "warnings": warnings},
    }


def explain(data, name):
    matches = [x for x in data["items"].values() if name in (x["id"], x["slug"]) or name.casefold() == x["name"].casefold()]
    if len(matches) != 1:
        raise ValueError("Expected one item matching " + repr(name))
    item = matches[0]
    def named(counts):
        return [{"item_id": i, "name": data["items"][i]["name"], "quantity": q} for i, q in counts.items()]
    return {"item_id": item["id"], "name": item["name"],
            "direct_ingredients": named(item["direct_ingredients"]),
            "raw_materials": [{**x, "sources": [data["sources"][s] for s in data["items"][x["item_id"]]["source_ids"]]} for x in named(item["raw_materials"])],
            "craft_counts": named(item["craft_counts"])}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="command", required=True)
    p = sub.add_parser('serve', help='Open the local web app')
    p.add_argument('--port', type=int, default=8765)
    p.add_argument('--host', default='127.0.0.1', help='Listen address; use your Wi-Fi IPv4 address for phone access')
    for command in ("fetch", "build"):
        p = sub.add_parser(command)
        p.add_argument("--cache", default="cache")
        p.add_argument("--endpoint", default=ENDPOINT)
        p.add_argument("--refresh", action="store_true")
        if command == "build":
            p.add_argument("--output", default="data/catalog.json")
    p = sub.add_parser("process", help="Offline: process an already fetched snapshot")
    p.add_argument("--input", default="cache/snapshot.json")
    p.add_argument("--output", default="data/catalog.json")
    p = sub.add_parser("explain")
    p.add_argument("item")
    p.add_argument("--input", default="data/catalog.json")
    p.add_argument("--output")
    p = sub.add_parser("plan", help="Minimize exploration for workshop crafts using expected drops")
    p.add_argument("item", nargs='?', help='Single target; alternatively use --targets')
    p.add_argument('--targets', help='JSON file mapping target names or IDs to craft counts')
    p.add_argument('--combinations', action='store_true', help='Require using every area in each combination')
    p.add_argument("--quantity", type=int, default=1)
    p.add_argument("--input", default="data/catalog.json")
    p.add_argument("--output", default="data/plan.json")
    p.add_argument("--markdown", help="Optional readable report path")
    p.add_argument("--area", action="append", help="Allowed area name/ID; repeat to select several")
    p.add_argument("--exclude-area", action="append")
    p.add_argument("--inventory", help="JSON object of item names/IDs to available quantities")
    p.add_argument("--iron-depot", action="store_true")
    p.add_argument("--resource-saver", type=float, default=0, help="Total Resource Saver bonus percentage (0 to 45)")
    p.add_argument("--best-only", action="store_true", help="Return only the global minimum instead of ranked area combinations")
    p.add_argument("--max-areas", type=int, help="Limit the number of areas per ranked option")
    p.add_argument("--runecube", action="store_true")
    p.add_argument("--continuous", action="store_true", help="Allow fractional explores/crafts for a theoretical rate plan")
    args = parser.parse_args()
    try:
        if args.command == 'serve':
            from static_server import serve
            serve(args.port, args.host)
            return
        if args.command == "plan":
            from planner import plan, ranked_plans, markdown, text_report
            if bool(args.item) == bool(args.targets):
                raise ValueError('Supply one item or --targets, but not both.')
            target = read_json(args.targets) if args.targets else args.item
            if args.targets and not isinstance(target, dict):
                raise ValueError('--targets must contain an object of item names/IDs and craft counts.')
            common = (read_json(args.input), target, args.quantity, args.area,
                      args.exclude_area, read_json(args.inventory) if args.inventory else None,
                      args.iron_depot, args.runecube)
            if args.best_only:
                if args.max_areas is not None:
                    raise ValueError('--max-areas applies to ranked options, not --best-only')
                result = plan(*common, continuous=args.continuous, resource_saver=args.resource_saver)
            else:
                if args.continuous:
                    raise ValueError('Use --best-only with --continuous; ranked combinations use whole explores')
                result = ranked_plans(*common, max_areas=args.max_areas, combinations_mode=args.combinations, resource_saver=args.resource_saver,
                    progress=lambda done, total: print(f'Checked {done}/{total} area combinations', file=sys.stderr, flush=True))
            write_json(args.output, result)
            if args.markdown:
                path = Path(args.markdown)
                path.parent.mkdir(parents=True, exist_ok=True)
                path.write_text(markdown(result), encoding="utf-8")
            print(text_report(result))
            print(f"Full plans and unused items: {args.output}")
            return
        if args.command in ("fetch", "build"):
            snapshot = fetch(args.cache, args.endpoint, args.refresh)
            if args.command == "fetch":
                print("Saved", len(snapshot["items"]), "items to", str(Path(args.cache) / "snapshot.json"))
                return
        elif args.command == "process":
            snapshot = read_json(args.input)
        else:
            result = explain(read_json(args.input), args.item)
            if args.output:
                write_json(args.output, result)
            else:
                print(json.dumps(result, indent=2, ensure_ascii=False))
            return
        result = process(snapshot)
        write_json(args.output, result)
        print(json.dumps(result["coverage"], indent=2))
    except (ValueError, KeyError, TypeError, OSError) as error:
        parser.exit(1, "Error: " + str(error) + "\n")


if __name__ == "__main__":
    main()
