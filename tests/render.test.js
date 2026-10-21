const assert = require('assert'); const fs = require('fs');
require('./helpers/load-es.js');
const html = fs.readFileSync(require('path').join(__dirname, '../index.html'), 'utf8');
function grab(name) {            // function declaration ko source se nikalo (brace matching)
  const i = html.indexOf('function ' + name + '('); assert.ok(i > 0, name);
  let d = 0, j = html.indexOf('{', i);
  for (let k = j; k < html.length; k++) { if (html[k] === '{') d++; if (html[k] === '}') { d--; if (d === 0) return html.slice(i, k + 1); } }
}
const escHTML = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const code = ['cHTML', 'pyqSearchCardHTML'].map(grab).join('\n') + '\nreturn {cHTML, pyqSearchCardHTML};';
const { cHTML, pyqSearchCardHTML } = new Function('ES', 'escHTML', code)(globalThis.ES, escHTML);

const evil = { id: 'abc', type: 'pdf', title: '<img src=x onerror=alert(1)>Ch<sub>2</sub>', desc: '"><script>alert(1)</script>', chapter: 'c', link: "https://x.com/a');alert(1);//\"onmouseover=\"alert(2)" };
let out = cHTML(evil);
assert.ok(!/<img|<script/i.test(out), out);
assert.ok(out.includes('Ch<sub>2</sub>'));
assert.ok(/data-u="https:\/\/x\.com\/a'\);alert\(1\);\/\/%22onmouseover=%22alert\(2\)"/.test(out) || !/onmouseover="/.test(out), out);   // attribute se bahar nahi nikla
assert.ok(!/ onmouseover=/.test(out.replace(/data-u="[^"]*"/, '')), 'attr injection');
assert.ok(out.includes("onclick=\"openContentLink(this,'link')\""));
out = cHTML({ ...evil, link: 'javascript:alert(1)' });
assert.ok(!/javascript:/i.test(out) && !/onclick/.test(out), out);       // unsafe link => clickable hi nahi
out = cHTML({ ...evil, type: 'video', link: 'https://youtu.be/dQw4w9WgXcQ' });
assert.ok(out.includes("openContentLink(this,'video')"));
out = cHTML({ id: 'q1', type: 'quiz', title: 'Quiz', questions: [1, 2], chapter: 'Ch 1' });
assert.ok(out.includes("startChapterQuiz('q1')") && out.includes('2 प्रश्न • Ch 1'));
const p = pyqSearchCardHTML({ year: 2024, title: '<script>x</script>Paper', link: 'javascript:alert(1)', examType: '<b>Tier 1</b>' }, [{ id: 's', name: 'S', icon: 'i' }]);
assert.ok(!/<script/i.test(p) && !/javascript:/i.test(p) && p.includes('navTo(\'pyq\')') && p.includes('<b>Tier 1</b>'), p);
console.log('render tests ✓');
