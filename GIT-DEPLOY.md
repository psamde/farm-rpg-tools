# Git deployments

This directory is the repository root. Cloudflare Pages builds and publishes
pushes to main through its native GitHub integration. GitHub Actions separately
runs regression checks; no Cloudflare API token is needed.

## Create the Cloudflare project

Select Pages → Import an existing Git repository, and select this repository.

- Production branch: main
- Framework preset: None
- Root directory: repository root (leave blank)
- Build command: python -m pip install -r requirements.txt && python build_static.py
- Build output directory: web
- Environment variable: PYTHON_VERSION = 3.12

Cloudflare build failures prevent publication. GitHub checks are separate and
are not a deployment gate; use branch protection if you want to require them
before merging into main.

## Publish changes

Run in this directory:

```powershell
git add .
git commit -m "Describe the update"
git push
```

Source code, the catalog snapshot, and browser runtimes are versioned. The build
refreshes browser Python modules and catalog metadata. Cache files, virtual
environments, and credentials are excluded.

Keep the same site address so existing browser saves remain available.
Export a plan code when moving from localhost or a different Pages address.

## Automatic catalog refresh

The **Refresh game data** GitHub Action runs Mondays at 05:23 UTC. You can also
open Actions → Refresh game data → Run workflow (main) at any time.
It fetches fresh Buddy Farm items, recipes, sources, and exploration yields into
a temporary directory, validates them, runs regression checks, and builds the site.
Only actual catalog changes produce a commit and patch-version bump; fetch dates
alone do not. The commit triggers Cloudflare's existing Git integration.
Quest groupings, Tower requirements and manually maintained perk rules are not
refreshed by this catalog job.

The workflow uses GitHub's built-in token with contents write permission. No
Cloudflare secret is needed. GitHub does not run other push-triggered Actions for
this token, so the refresh workflow performs its own tests before pushing.
Repository rules that block direct bot pushes will make the run fail; the existing
published data remains in place. A concurrent push to main is rejected rather
than force-pushed: rerun the refresh against the latest main.

Missing existing items/recipes, lost exploration sources, invalid quantities,
or a source-count drop over 5% require manual review. Inspect failed runs in
Actions and enable GitHub Actions failure notifications for your account.
GitHub may pause scheduled workflows after 60 days of repository inactivity;
re-enable the schedule in Actions if that happens. Schedules can run late.

The importer fetches source types separately and reads quest rewards in stable
ID-ordered batches of 100 items. Requests use a 30-second socket timeout and at
most one retry, with progress and timings in the Action log. All groups must
contain the same item IDs before the snapshot is accepted.
