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
