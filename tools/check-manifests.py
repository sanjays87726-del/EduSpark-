#!/usr/bin/env python3
"""Kubernetes manifest sanity checks (CI: helm template ke output aur deploy/k8s par).

  check-manifests.py FILE...                       saari files ek hi set maani jaati hain (cross-reference ke liye)
  check-manifests.py --each FILE...                har file alag set
  --service-matches N     Service ka selector theek N Deployments ke pods se match kare
  --hpa-target NAME       HPA isi Deployment ko target kare
"""
import sys
import yaml


def labels_match(selector, labels):
    return bool(selector) and all(labels.get(k) == v for k, v in selector.items())


def check(files, service_matches=None, hpa_target=None):
    errors, docs = [], []
    for f in files:
        with open(f, encoding="utf-8") as fh:
            for d in yaml.safe_load_all(fh):
                if d:
                    docs.append((f, d))
    for f, d in docs:
        for k in ("apiVersion", "kind"):
            if not d.get(k):
                errors.append(f"{f}: {k} missing")
        if not (d.get("metadata") or {}).get("name"):
            errors.append(f"{f}: {d.get('kind')} metadata.name missing")
    deps = [d for _, d in docs if d.get("kind") == "Deployment"]
    names = {}
    for d in deps:
        n = d["metadata"]["name"]
        if n in names:
            errors.append(f"duplicate Deployment name {n}")
        names[n] = d

    ports = set()
    for d in deps:
        n = d["metadata"]["name"]
        spec = d["spec"]
        tl = spec["template"]["metadata"].get("labels", {})
        sel = spec["selector"].get("matchLabels", {})
        if not labels_match(sel, tl):
            errors.append(f"{n}: selector.matchLabels pod labels ka subset nahi")
        pod = spec["template"]["spec"]
        for c in pod["containers"]:
            img = c.get("image", "")
            if ":" not in img.rsplit("/", 1)[-1] or img.endswith(":"):
                errors.append(f"{n}: image '{img}' me tag nahi")
            for p in ("readinessProbe", "livenessProbe"):
                if p not in c:
                    errors.append(f"{n}: {p} nahi")
            if not (c.get("resources") or {}).get("limits"):
                errors.append(f"{n}: resources.limits nahi")
            for pt in c.get("ports", []):
                ports.add(pt["containerPort"])
        if not (pod.get("securityContext") or {}).get("runAsNonRoot"):
            errors.append(f"{n}: runAsNonRoot nahi")

    for _, d in docs:
        kind, name = d.get("kind"), d.get("metadata", {}).get("name")
        if kind == "Service":
            sel = d["spec"]["selector"]
            matched = [x for x in deps if labels_match(sel, x["spec"]["template"]["metadata"].get("labels", {}))]
            if not matched:
                errors.append(f"Service {name}: koi Deployment match nahi hota")
            if service_matches is not None and len(matched) != service_matches:
                errors.append(f"Service {name}: {len(matched)} Deployments match, {service_matches} chahiye")
            tp = d["spec"]["ports"][0]["targetPort"]
            if tp not in ports:
                errors.append(f"Service {name}: targetPort {tp} kisi containerPort se match nahi")
        elif kind == "HorizontalPodAutoscaler":
            t = d["spec"]["scaleTargetRef"]["name"]
            if t not in names:
                errors.append(f"HPA {name}: target Deployment {t} nahi mila")
            if hpa_target and t != hpa_target:
                errors.append(f"HPA {name}: target {t}, chahiye {hpa_target}")
            elif t in names and "replicas" in names[t]["spec"]:
                errors.append(f"HPA ke target Deployment {t} me replicas set hai (HPA aur replicas takrayenge)")
        elif kind == "PodDisruptionBudget":
            sel = d["spec"]["selector"]["matchLabels"]
            if not any(labels_match(sel, x["spec"]["template"]["metadata"].get("labels", {})) for x in deps):
                errors.append(f"PDB {name}: koi Deployment match nahi hota")
        elif kind == "Ingress":
            for r in d["spec"].get("rules", []):
                for p in r["http"]["paths"]:
                    svc = p["backend"]["service"]["name"]
                    if not any(x.get("kind") == "Service" and x["metadata"]["name"] == svc for _, x in docs):
                        errors.append(f"Ingress {name}: Service {svc} nahi mila")
    if not deps:
        errors.append("koi Deployment nahi mila")
    return errors


def main(argv):
    each = "--each" in argv
    sm = hpa = None
    files = []
    i = 0
    while i < len(argv):
        a = argv[i]
        if a == "--each":
            pass
        elif a == "--service-matches":
            i += 1
            sm = int(argv[i])
        elif a == "--hpa-target":
            i += 1
            hpa = argv[i]
        else:
            files.append(a)
        i += 1
    if not files:
        print(__doc__)
        return 2
    groups = [[f] for f in files] if each else [files]
    bad = 0
    for g in groups:
        errs = check(g, sm, hpa)
        if errs:
            bad += len(errs)
            for e in errs:
                print("❌", e)
        else:
            print("✅", ", ".join(g))
    return 1 if bad else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
