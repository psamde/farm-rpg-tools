import copy
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import farmdata


def item(item_id, name, ingredients=None, **extra):
    return {"id": item_id, "name": name, "canCraft": ingredients is not None,
            "canCook": False, "recipeItems": [
                {"quantity": q, "ingredientItem": {"id": i}}
                for i, q in (ingredients or {}).items()], **extra}


def fixture():
    return {"snapshot_version": 1, "items": [
        item(35, "Wood"), item(38, "Nails"), item(22, "Iron"),
        item(21, "Board", {35: 5}), item(36, "Wooden Plank", {21: 4, 38: 4}),
        item(167, "Sturdy Shield", {36: 1, 38: 6, 22: 6})]}


class ProcessorTests(unittest.TestCase):
    def test_real_recipe_examples(self):
        data = farmdata.process(fixture())
        self.assertEqual(data["items"]["21"]["raw_materials"], {"35": 5})
        self.assertEqual(data["items"]["36"]["raw_materials"], {"35": 20, "38": 4})
        shield = data["items"]["167"]
        self.assertEqual(shield["direct_ingredients"], {"36": 1, "38": 6, "22": 6})
        self.assertEqual(shield["raw_materials"], {"35": 20, "38": 10, "22": 6})
        self.assertEqual(shield["craft_counts"], {"167": 1, "36": 1, "21": 4})
        self.assertEqual(data["items"]["35"]["raw_material_for"]["167"], 20)
        self.assertEqual(data["items"]["38"]["used_in"]["167"], 6)

    def test_intermediate_drops_and_conditional_rates_preserved(self):
        snapshot = fixture()
        board = snapshot["items"][3]
        board["dropRatesItems"] = []
        for enabled, rate in [(False, 25.48), (True, 20.0)]:
            board["dropRatesItems"].append({"rate": rate, "dropRates": {
                "location": {"gameId": 10, "name": "Santa's Workshop", "type": "explore", "baseDropRate": 0.4},
                "seed": None, "ironDepot": enabled, "runecube": False,
                "manualFishing": None, "frozen": False}})
        data = farmdata.process(snapshot)
        sources = [s for s in data["sources"].values() if s["kind"] == "explore"]
        self.assertEqual(len(sources), 2)
        self.assertEqual({s["conditions"]["ironDepot"] for s in sources}, {False, True})
        for s in sources:
            self.assertAlmostEqual(s["expected_drops_per_explore"] * s["explores_per_drop"], 1)
        self.assertEqual(data["items"]["21"]["raw_materials"], {"35": 5})

    def test_missing_ingredient_rejected(self):
        snapshot = fixture()
        snapshot["items"] = snapshot["items"][1:]
        with self.assertRaisesRegex(ValueError, "Missing ingredient"):
            farmdata.process(snapshot)

    def test_cycle_rejected(self):
        snapshot = {"snapshot_version": 1, "items": [item(1, "A", {2: 1}), item(2, "B", {1: 1})]}
        with self.assertRaisesRegex(ValueError, "Recipe cycle"):
            farmdata.process(snapshot)

    def test_empty_craft_recipe_rejected(self):
        with self.assertRaisesRegex(ValueError, "no recipe"):
            farmdata.process({"snapshot_version": 1, "items": [item(1, "Broken", {})]})

    def test_invalid_quantity_rejected(self):
        for value in [0, -1, float("nan"), True, "5"]:
            snapshot = fixture()
            snapshot["items"][3]["recipeItems"][0]["quantity"] = value
            with self.assertRaises(ValueError):
                farmdata.process(snapshot)

    def test_noncrafting_sources_do_not_change_expansion(self):
        snapshot = fixture()
        snapshot["items"][0]["manualProductions"] = [{"lineOne": "Sawmill", "lineTwo": "Building", "value": "Hourly", "sort": 0}]
        data = farmdata.process(snapshot)
        self.assertTrue(any(s["kind"] == "manual_production" for s in data["sources"].values()))
        self.assertEqual(data["items"]["35"]["raw_materials"], {"35": 1})
        source = next(s for s in data["sources"].values() if s["kind"] == "manual_production")
        self.assertNotIn("explores_per_drop", source)

    def test_cooking_not_silently_expanded_as_workshop(self):
        snapshot = {"snapshot_version": 1, "items": [item(1, "Meal", canCook=True)]}
        data = farmdata.process(snapshot)
        self.assertEqual(data["items"]["1"]["raw_materials"], {"1": 1})

    def test_deterministic_and_does_not_mutate_input(self):
        snapshot = fixture()
        original = copy.deepcopy(snapshot)
        first = farmdata.process(snapshot)
        self.assertEqual(first, farmdata.process(snapshot))
        self.assertEqual(original, snapshot)

    def test_cache_reuse_and_refresh(self):
        with tempfile.TemporaryDirectory() as directory:
            with patch.object(farmdata, "graphql", return_value=[item(1, "Wood")]) as request:
                farmdata.fetch(directory)
                self.assertEqual(request.call_count, 3)
                farmdata.fetch(directory)
                self.assertEqual(request.call_count, 3)
                farmdata.fetch(directory, refresh=True)
                self.assertEqual(request.call_count, 6)

    def test_live_snapshot_regression_if_present(self):
        path = Path(__file__).parent / "cache" / "snapshot.json"
        if not path.exists():
            self.skipTest("No downloaded snapshot; other tests are fully offline")
        data = farmdata.process(json.loads(path.read_text(encoding="utf-8")))
        by_name = {v["name"]: v for v in data["items"].values()}
        shield = by_name["Sturdy Shield"]
        self.assertEqual({data["items"][i]["name"]: q for i, q in shield["raw_materials"].items()},
                         {"Wood": 20, "Nails": 10, "Iron": 6})
        self.assertGreater(data["coverage"]["craftable_count"], 100)
        wood_sources = [data["sources"][s] for s in by_name["Wood"]["source_ids"]]
        baseline = [s for s in wood_sources if s["kind"] == "explore" and not any(s["conditions"].values())]
        self.assertEqual(len(baseline), 6)
        for i in data["items"].values():
            self.assertTrue(all(not data["items"][r]["craftable"] for r in i["raw_materials"]))
            self.assertTrue(all(s in data["sources"] for s in i["source_ids"]))


if __name__ == "__main__":
    unittest.main()
