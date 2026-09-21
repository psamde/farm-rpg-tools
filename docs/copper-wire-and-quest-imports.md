# Copper Wire node modes and selective quest imports (0.1.86 / 0.1.87)

The old Force Use All and Limit uses handlers converted remaining input stock into independent caps on every selected downstream recipe. This counted overlapping chains repeatedly and overwrote consumer choices. In the saved Engine example, forcing Copper Wire reduced consumption from about 127,734 to 2,436.

Node rules now reach the shared solver separately from recipe goals. Force prioritizes reducing the chosen material's remaining stock after explicit fixed craft requirements; material limits constrain aggregate direct consumption. Exploration counts stay fixed. Implicit intermediates cannot be overproduced merely to improve a consumption score and then disappear during rounding. Recipe modes and caps remain intact when switching modes back and forth.

With the original Engine example, Copper Wire leftovers drop from 6,673 to 6,593 (displayed counts round down), while exploration stays at 52,464,507. Coal limits Spool of Copper to 18,502 crafts. The strict force objective favors Engines (282 to 452) over Corn Oil (15,891 to 0); the UI explains that other crafts can get less.

The obsolete 20-target/recipe limits were removed from map additions, guided additions, suggestions, quest import, save validation, and Python request validation. Quantities and unique eligible item IDs remain validated.

Quest import defaults to selecting eligible pending items, with per-item checkboxes and bulk controls. `quest_imported_items` records item IDs separately for each quest. Unchecked items remain available later, while repeated imports and shared items across steps do not duplicate previously added amounts. Older saves with only `quest_selection` retain their whole-quest import semantics. Items unavailable from crafting or exploration are displayed as Bring separately.

Validation: native catalog acceptance, 17 cases in the shipped Python/SciPy/HiGHS browser runtime, JS handler and save regressions, and desktop/390px UI checks. A 32-recipe plan computed, a 64-item plan survived save/load, and Corn of Interest items were imported separately and retained correctly on reload.
