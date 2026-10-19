// index.html me inline pada "EduSpark Ops toolkit" script nikalkar chalata hai — tests asli deploy hone wale code ko hi test karte hain
const fs = require('fs'), path = require('path'), vm = require('vm');
const html = fs.readFileSync(path.join(__dirname, '../../index.html'), 'utf8');
const blocks = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).filter(b => b.includes('EduSpark Ops toolkit'));
if (blocks.length !== 1) throw new Error('Ops toolkit script index.html me ' + blocks.length + ' baar mila (1 hona chahiye)');
vm.runInThisContext(blocks[0], { filename: 'index.html#ops-toolkit' });
module.exports = globalThis.ES;
