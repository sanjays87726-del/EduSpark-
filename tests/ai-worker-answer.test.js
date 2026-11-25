// Server-side AI answer cleanup regression tests.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const worker = fs.readFileSync(path.join(__dirname, '..', 'worker.js'), 'utf8');
const start = worker.indexOf('function normalizeAIAnswer(value)');
const end = worker.indexOf('const b64uToBytes', start);
assert.ok(start >= 0 && end > start, 'Worker answer normalizer must exist before request handling');
const normalize = new Function(worker.slice(start, end) + '\\nreturn normalizeAIAnswer;')();

const answer = 'आपने जो प्रश्न पूछा है—प्रकाश संश्लेषण—यह विज्ञान विषय से संबंधित है, जबकि अभी आपने गणित विषय चुना है। कोई बात नहीं!\\n\\nसमीकरण: $$6\\\\text{CO}_2 + 6\\\\text{H}_2\\\\text{O} \\\\xrightarrow[\\\\text{क्लोरोफिल}]{\\\\text{सूर्य का प्रकाश}} \\\\text{C}_6\\\\text{H}_{12}\\\\text{O}_6 + 6\\\\text{O}_2$$';
const cleaned = normalize(answer);
assert.ok(!/गणित विषय चुना है|आपने जो प्रश्न पूछा/.test(cleaned), 'subject mismatch disclaimer must be removed');
assert.ok(cleaned.includes('6CO₂ + 6H₂O —(सूर्य का प्रकाश; क्लोरोफिल)→ C₆H₁₂O₆ + 6O₂'), 'photosynthesis equation must become readable Unicode');
assert.ok(!/\\\\text|\\\\xrightarrow|\\$/.test(cleaned), 'raw LaTeX must not reach the client');
console.log('✓ Worker strips subject mismatch warnings and normalizes AI chemistry');
