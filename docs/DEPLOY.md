# Deploy, Rollout & Rollback

EduSpark ke 4 hisse hain; har ek ka apna deploy/rollback tareeka:

| Hissa | Kahan chalta hai | Deploy | Rollout strategy | Rollback |
|---|---|---|---|---|
| App (HTML/JS) | GitHub Pages / CDN (ya `Dockerfile` → nginx) | `git push` (Pages) · Docker: `release.yml` (tag) | **Rolling**: students ko naya version service-worker se milta hai ("नया version" toast). **Canary**: `ES.rollout('feature')` — `_config/flags` me `{feature: 10}` = 10% students | `git revert <sha>` + `sw.js` ka `CACHE_NAME` +1 · Docker: purana tag |
| AI Worker | Cloudflare Workers | `deploy-worker.yml` (`upload` / `deploy`) | **Gradual**: `upload` → `npx wrangler versions deploy <naya>@10% <purana>@90%` → theek lage to 100% | `deploy-worker.yml` → `rollback` |
| Firestore rules | Firebase | `deploy-rules.yml` | — (atomic) | purana `firestore.rules` git se, dobara deploy |
| Data | Firestore | `scripts/migrate.js` (dry-run → `APPLY=1`) | batch me, idempotent | `scripts/restore.js` (backup se) |
| Container (optional) | Kubernetes | `helm upgrade --install` | Rolling (default) · **Canary** `--set canary.enabled=true --set canary.tag=X` · **Blue-green** `--set colors.green.enabled=true --set colors.green.tag=X` phir `--set service.activeColor=green` | `helm rollback eduspark` / `kubectl rollout undo deploy/eduspark-web` |

## Release (semver)
1. `package.json` version + `index.html` ka `ES.version` + `CHANGELOG.md` me `## [x.y.z]` — teeno same (CI check karta hai).
2. `sw.js` ka `CACHE_NAME` badlo (nahi badla to CI warning deta hai; release me zaroori).
3. `git tag vX.Y.Z && git push --tags` → `release.yml`: tests → Docker image `ghcr.io/<owner>/<repo>:X.Y.Z` → GitHub Release.

## Blue-green (Kubernetes) — step by step
```bash
helm upgrade --install eduspark deploy/helm/eduspark                       # blue chal raha hai
helm upgrade eduspark deploy/helm/eduspark --set colors.green.enabled=true --set colors.green.tag=1.6.0
kubectl rollout status deploy/eduspark-green                              # green ready? (smoke test karo)
helm upgrade eduspark deploy/helm/eduspark --set colors.green.enabled=true --set colors.green.tag=1.6.0 --set service.activeColor=green   # switch
helm upgrade eduspark deploy/helm/eduspark --set service.activeColor=green --set colors.blue.enabled=false --set colors.green.enabled=true --set colors.green.tag=1.6.0   # purana hatao
```
Switch ke baad gadbad ho to `service.activeColor=blue` wapas (blue abhi bhi chal raha ho tab) — turant rollback.

## Local (Docker)
```bash
docker compose up --build --scale web=3     # http://localhost:8080 — nginx LB, 3 replicas, DNS service discovery
```
