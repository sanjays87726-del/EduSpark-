// ══════════════════════════════════════════════════════════════
// EduSpark Cron Trigger — alag chhota Cloudflare Worker (asli AI worker.js ko chhedta nahi)
// Kaam: Cloudflare ke ThIK samay wale cron par GitHub Action "EduSpark Notifications" ko turant chalana
// (workflow_dispatch). GitHub ka apna `schedule` best-effort hai: 10-60 min late ya skip ho sakta hai, public repo me
// 60 din koi activity na ho to band bhi ho jaata hai. Ye worker usse bachata hai; purana 20-min schedule backup rehta hai.
// Duplicate ka darr nahi: send-notifications.js har slot Firestore transaction se roz sirf ek baar claim karta hai.
//
// Setup (ek baar):  cd cron-trigger
//   1) wrangler.toml me GH_REPO = "owner/repo" bharo
//   2) GitHub → Settings → Developer settings → Fine-grained token (sirf is repo, Actions: Read and write)
//   3) npx wrangler secret put GH_TOKEN
//   4) npx wrangler deploy
// ══════════════════════════════════════════════════════════════
const WORKFLOW_FILE = 'notifications.yml';

export async function dispatch(env, fetchImpl = fetch, sleep = ms => new Promise(r => setTimeout(r, ms))) {
  if (!env.GH_REPO || /REPLACE_/.test(env.GH_REPO)) return { ok: false, error: 'GH_REPO set nahi' };
  if (!env.GH_TOKEN) return { ok: false, error: 'GH_TOKEN secret set nahi' };
  const url = `https://api.github.com/repos/${env.GH_REPO}/actions/workflows/${WORKFLOW_FILE}/dispatches`;
  let last = '';
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetchImpl(url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${env.GH_TOKEN}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
          'User-Agent': 'eduspark-cron',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ ref: env.GH_REF || 'main' })
      });
      if (res.status === 204) return { ok: true, attempt };
      last = `HTTP ${res.status}`;
      if (res.status >= 400 && res.status < 500 && res.status !== 429) return { ok: false, error: last };   // token/repo galat — retry bekaar
    } catch (e) { last = String((e && e.message) || e); }
    await sleep(attempt * 5000);
  }
  return { ok: false, error: last };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(dispatch(env).then(r => console.log('cron', event.cron, JSON.stringify(r))));
  },
  async fetch() { return new Response('eduspark-cron OK', { status: 200, headers: { 'Cache-Control': 'no-store' } }); }
};
