const assert=require('assert'),fs=require('fs');
const h=fs.readFileSync(require('path').join(__dirname,'../admin.html'),'utf8');
function grab(n,kw='function '){const i=h.indexOf(kw+n+'(');assert.ok(i>0,n);let d=0,j=h.indexOf('{',i);for(let k=j;k<h.length;k++){if(h[k]==='{')d++;if(h[k]==='}'){d--;if(d===0)return h.slice(i,k+1);}}}
const esc=t=>String(t==null?'':t).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const st=new Function('esc',grab('notifStatusText')+';return notifStatusText;')(esc);
assert.strictEqual(st({status:'sent',sentCount:5}),'✅ 5 को भेजा');
assert.ok(st({status:'sent',sentCount:0}).includes('किसी के पास token नहीं'));
assert.ok(st({status:'dead',attempts:3,lastError:'<b>x'}).includes('3 कोशिश')&&!st({status:'dead',lastError:'<b>x'}).includes('<b>'));
assert.strictEqual(st({status:'sending'}),'📤 भेजा जा रहा है');
assert.ok(st({status:'pending',attempts:1,lastError:'e'}).includes('(1/3)'));
assert.strictEqual(st({status:'pending'}),'⏳ Pending'); assert.ok(st({status:'failed',lastError:'z'}).startsWith('❌'));
// replyDoubt transaction
const calls=[];let state='pending';
const toasts=[];
const mk=(snap)=>({collection:()=>({doc:()=>({__r:1})}),runTransaction:async fn=>fn({get:async()=>snap(),update:(r,o)=>calls.push(o)})});
async function run(snap){calls.length=0;toasts.length=0;
  const f=new Function('document','db','showToast','renderADoubts',grab('replyDoubt')+';return replyDoubt;')({getElementById:()=>({value:' जवाब '})},mk(snap),m=>toasts.push(m),()=>{});
  f(); await new Promise(r=>setTimeout(r,10));}
(async()=>{
  await run(()=>({exists:true,data:()=>({status:'pending'})})); assert.deepStrictEqual(calls,[{answer:'जवाब',status:'answered'}]); assert.ok(toasts[0].includes('Reply दे दिया'));
  await run(()=>({exists:true,data:()=>({status:'answered'})})); assert.strictEqual(calls.length,0); assert.ok(toasts[0].includes('पहले ही'));
  await run(()=>({exists:false})); assert.strictEqual(calls.length,0); assert.ok(toasts[0].includes('delete हो चुका'));
  console.log('admin tests ✓');
})();
