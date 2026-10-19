// tools/check-manifests.py ka test. PyYAML na ho to skip (CI ke infra job me python+pyyaml hota hi hai).
const assert = require('assert'), cp = require('child_process'), fs = require('fs'), os = require('os'), path = require('path');
const py = (...a) => cp.spawnSync('python3', a, { encoding: 'utf8', cwd: path.join(__dirname, '..') });
if (py('-c', 'import yaml').status !== 0) { console.log('manifest tests skipped (python3/PyYAML nahi)'); process.exit(0); }
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'es-man-'));
const deploy = (name, labels, extra = '') => `apiVersion: apps/v1
kind: Deployment
metadata: {name: ${name}}
spec:
  ${extra}selector: {matchLabels: ${labels}}
  template:
    metadata: {labels: ${labels}}
    spec:
      securityContext: {runAsNonRoot: true}
      containers:
        - name: web
          image: ghcr.io/o/eduspark:1.4.0
          ports: [{containerPort: 8080}]
          readinessProbe: {httpGet: {path: /healthz, port: 8080}}
          livenessProbe: {httpGet: {path: /healthz, port: 8080}}
          resources: {limits: {cpu: 200m}}
`;
const svc = sel => `apiVersion: v1\nkind: Service\nmetadata: {name: eduspark}\nspec:\n  selector: ${sel}\n  ports: [{port: 80, targetPort: 8080}]\n`;
const hpa = t => `apiVersion: autoscaling/v2\nkind: HorizontalPodAutoscaler\nmetadata: {name: eduspark}\nspec:\n  scaleTargetRef: {apiVersion: apps/v1, kind: Deployment, name: ${t}}\n  minReplicas: 2\n  maxReplicas: 5\n`;
const write = (n, parts) => { const f = path.join(dir, n); fs.writeFileSync(f, parts.join('---\n')); return f; };
const run = (f, ...flags) => py('tools/check-manifests.py', ...flags, f);
const L = (c, t) => `{app: es, color: ${c}, track: ${t}}`;

// Helm jaisa canary render: stable (blue) + canary, Service color=blue dono ko pakadta hai
let f = write('canary.yaml', [deploy('es-blue', L('blue', 'stable')), deploy('es-canary', L('blue', 'canary')), svc('{app: es, color: blue}'), hpa('es-blue')]);
assert.strictEqual(run(f, '--service-matches', '2', '--hpa-target', 'es-blue').status, 0);
assert.notStrictEqual(run(f, '--service-matches', '1').status, 0);
// Blue-green: green active => Service sirf green; HPA green par; inactive blue me fixed replicas theek hain
f = write('bg.yaml', [deploy('es-blue', L('blue', 'stable'), 'replicas: 2\n  '), deploy('es-green', L('green', 'stable')), svc('{app: es, color: green}'), hpa('es-green')]);
assert.strictEqual(run(f, '--service-matches', '1', '--hpa-target', 'es-green').status, 0);
// galtiyan pakdi jaayein
f = write('b1.yaml', [deploy('es-blue', L('blue', 'stable')), svc('{app: es, color: green}')]); assert.ok(/koi Deployment match nahi/.test(run(f).stdout));
f = write('b2.yaml', [deploy('es-blue', L('blue', 'stable')), hpa('nope')]); assert.ok(/HPA .*nahi mila/.test(run(f).stdout));
f = write('b3.yaml', [deploy('es-blue', L('blue', 'stable'), 'replicas: 2\n  '), hpa('es-blue')]); assert.ok(/replicas set hai/.test(run(f).stdout));
f = write('b4.yaml', [deploy('es-blue', L('blue', 'stable')).replace('eduspark:1.4.0', 'eduspark'), svc('{app: es}')]); assert.ok(/tag nahi/.test(run(f).stdout));
f = write('b5.yaml', [deploy('es-blue', L('blue', 'stable')).replace('runAsNonRoot: true', 'runAsNonRoot: false')]); assert.ok(/runAsNonRoot/.test(run(f).stdout));
// asli k8s manifests
assert.strictEqual(py('tools/check-manifests.py', ...fs.readdirSync(path.join(__dirname, '../deploy/k8s')).map(x => 'deploy/k8s/' + x), '--service-matches', '1').status, 0);
console.log('manifest checker tests ✓');
