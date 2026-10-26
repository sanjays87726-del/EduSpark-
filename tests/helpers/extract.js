// index.html / sw.js ke andar se code ka tukda (marker se marker tak) nikalta hai — tests asli deploy hone wale code ko hi chalate hain
const fs = require('fs'), path = require('path');
const read = f => fs.readFileSync(path.join(__dirname, '../../', f), 'utf8');
function between(src, start, end) {
  const a = src.indexOf(start); if (a < 0) throw new Error('start marker nahi mila: ' + start.slice(0, 50));
  if (src.indexOf(start, a + 1) > -1) throw new Error('start marker ek se zyada baar: ' + start.slice(0, 50));
  const b = src.indexOf(end, a + start.length); if (b < 0) throw new Error('end marker nahi mila: ' + end.slice(0, 50));
  return src.slice(a, b);
}
module.exports = { read, between };
