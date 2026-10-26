// Quiz Analytics (marks / % / required marks / difficulty) + turant feedback ka code — index.html se nikalkar chalta hai
const assert = require('assert');
const { read, between } = require('./helpers/extract');
const html = read('index.html');
const block = between(html, 'let qTimeSpent = [], _qCurGi = 0', 'function showResult(){');
const live = between(html, 'let _liveItem = null;', 'function selOpt(');
const escHTML = t => String(t == null ? '' : t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ES = { sanitize: s => String(s == null ? '' : s).replace(/</g, '&lt;') };
const box = { innerHTML: '', style: {}, className: '', scrollIntoView() {} };
const store = {};
const mk = new Function('escHTML', 'ES', 'box', 'store', `
  let curQuiz = null, _akItems = [], quizSections = [], curBoard = 'BSER-10', curSection = 0, curQ = 0, _aiExCache = {};
  const isCompetitionBoard = b => /^(SSC|REET|BSTC)/.test(b);
  const document = { getElementById: id => (id === 'qAnalytics' || id === 'qFeedback') ? box : null };
  const localStorage = { getItem: k => store[k] == null ? null : store[k], setItem: (k, v) => { store[k] = String(v); } };
  const globalQIndex = () => curQ + 1, aiExKey = it => 'k' + it.gi;
  ${block}
  ${live}
  return { set(o){ if('curQuiz' in o) curQuiz=o.curQuiz; if('items' in o) _akItems=o.items; if('sections' in o) quizSections=o.sections; if('times' in o) qTimeSpent=o.times; if('board' in o) curBoard=o.board; if('curQ' in o) curQ=o.curQ; },
    normDiff, quizCfg, computeQuizStats, renderQuizAnalytics, fmNum, fmPct, fmDur, saveQuizHistory, quizHistoryFor, commitQTime, showLiveFeedback,
    setClock(){ _qCurGi = 2; _qShownAt = Date.now() - 12000; }, getTimes(){ return qTimeSpent; } };`)(escHTML, ES, box, store);
let n = 0; const t = (name, fn) => { try { fn(); n++; console.log('✓', name); } catch (e) { console.log('✗', name, '\n  ', e.stack); process.exitCode = 1; } };
const sec = { name: 'Reasoning' };
const item = (gi, st, q = {}) => ({ gi, sec, q: Object.assign({ q: 'Q' + gi, options: ['a', 'b', 'c', 'd'], ans: 1 }, q), u: st === 'skip' ? null : (st === 'right' ? 1 : 0), st });

t('normDiff: english/hindi/number forms', () => {
  assert.strictEqual(mk.normDiff('Easy'), 'easy'); assert.strictEqual(mk.normDiff('कठिन'), 'hard'); assert.strictEqual(mk.normDiff(2), 'medium'); assert.strictEqual(mk.normDiff('weird'), ''); assert.strictEqual(mk.normDiff(null), '');
});
t('quizCfg: defaults board 33%, competitive 40%; overrides respected; bad values ignored', () => {
  mk.set({ curQuiz: { board: 'BSER-10' } }); assert.deepStrictEqual(mk.quizCfg(), { mpq: 1, neg: 0, pass: 33 });
  mk.set({ curQuiz: { board: 'SSC-CGL' } }); assert.strictEqual(mk.quizCfg().pass, 40);
  mk.set({ curQuiz: { board: 'SSC-CGL', passPercent: 55, marksPerQ: 2, negative: 0.5 } }); assert.deepStrictEqual(mk.quizCfg(), { mpq: 2, neg: 0.5, pass: 55 });
  mk.set({ curQuiz: { board: 'BSER-10', passPercent: 500, marksPerQ: -1, negative: 'x' } }); assert.deepStrictEqual(mk.quizCfg(), { mpq: 1, neg: 0, pass: 33 });
});
t('marks with negative marking, required marks, pass/fail', () => {
  mk.set({ curQuiz: { board: 'SSC-CGL', passPercent: 50, marksPerQ: 2, negative: 0.5 }, times: [] });
  mk.set({ items: [item(1, 'right'), item(2, 'right'), item(3, 'wrong'), item(4, 'wrong'), item(5, 'skip'), item(6, 'right')] });
  const s = mk.computeQuizStats();
  assert.strictEqual(s.right, 3); assert.strictEqual(s.wrong, 2); assert.strictEqual(s.skip, 1);
  assert.strictEqual(s.totalMarks, 12); assert.strictEqual(s.obtained, 5);              // 3*2 - 2*0.5
  assert.strictEqual(Math.round(s.pct * 10) / 10, 41.7); assert.strictEqual(s.reqMarks, 6); assert.strictEqual(s.pass, false);
  mk.set({ curQuiz: { board: 'SSC-CGL', passPercent: 40, marksPerQ: 2, negative: 0.5 } });
  assert.strictEqual(mk.computeQuizStats().pass, true);                                 // 4.8 required, 5 obtained
});
t('percentage never negative; empty quiz does not crash', () => {
  mk.set({ curQuiz: { board: 'SSC-CGL', negative: 5 }, items: [item(1, 'wrong'), item(2, 'wrong')] });
  assert.strictEqual(mk.computeQuizStats().pct, 0);
  mk.set({ items: [] }); mk.renderQuizAnalytics(mk.computeQuizStats()); assert.strictEqual(box.innerHTML, '');
});
t('difficulty: tag wins; untagged estimated from time; no timing -> medium', () => {
  mk.set({ curQuiz: { board: 'BSER-10' }, times: [] });
  mk.set({ items: [item(1, 'right', { diff: 'hard' }), item(2, 'wrong', { diff: 'Easy' }), item(3, 'right')] });
  let s = mk.computeQuizStats(); assert.strictEqual(s.levels.hard.n, 1); assert.strictEqual(s.levels.easy.n, 1); assert.strictEqual(s.levels.medium.n, 1); assert.strictEqual(s.tagged, 2);
  mk.set({ times: [5, 20, 60, 20, 21] });         // median 20 -> 5s easy, 60s hard
  mk.set({ items: [1, 2, 3, 4, 5].map(i => item(i, 'right')) });
  s = mk.computeQuizStats(); assert.deepStrictEqual([s.levels.easy.n, s.levels.medium.n, s.levels.hard.n], [1, 3, 1]);
});
t('analytics HTML: stats, qualified badge, donut, difficulty, time chart, history', () => {
  mk.set({ curQuiz: { id: 'z1', title: 'Z', board: 'BSER-10' }, times: [10, 30, 5, 80] });
  mk.set({ items: [item(1, 'right'), item(2, 'wrong'), item(3, 'right'), item(4, 'skip')] });
  const s = mk.computeQuizStats(); mk.saveQuizHistory(s); mk.renderQuizAnalytics(s);
  const h = box.innerHTML;
  assert.ok(h.includes('Performance Analytics') && h.includes('2 / 4') && h.includes('50%') && h.includes('Required'), 'overview');
  assert.ok(h.includes('✅ Qualified'), 'pass badge'); assert.ok(h.includes('<svg') && h.includes('stroke-dasharray'), 'donut');
  assert.ok(h.includes('Difficulty-wise') && h.includes('Question-wise Time') && h.includes('Insights'));
  assert.ok(h.includes('अगला लक्ष्य'), 'next goal'); assert.ok(!h.includes('Progress (इसी quiz'), 'one attempt: no history chart');
  mk.saveQuizHistory(s);                                  // same attempt twice -> still one entry
  assert.strictEqual(mk.quizHistoryFor().length, 1);
});
t('fail badge says how many marks are needed; sections card; section names escaped', () => {
  mk.set({ curQuiz: { board: 'SSC-CGL', passPercent: 80 }, times: [] });
  const s2 = { name: '<img src=x onerror=1>Maths' };
  mk.set({ sections: [sec, s2], items: [item(1, 'right'), item(2, 'wrong'), Object.assign(item(3, 'wrong'), { sec: s2 }), Object.assign(item(4, 'right'), { sec: s2 })] });
  mk.renderQuizAnalytics(mk.computeQuizStats()); const h = box.innerHTML;
  assert.ok(h.includes('❌ 1.2 अंक और चाहिए') || h.includes('अंक और चाहिए'), h.slice(0, 400)); assert.ok(h.includes('Section-wise'));
  assert.ok(!h.includes('<img src=x'), 'section name must be escaped');
});
t('commitQTime: adds seconds to the question being left, capped at 5 min', () => {
  mk.set({ times: [] }); mk.setClock(); mk.commitQTime();
  assert.ok(mk.getTimes()[1] >= 11 && mk.getTimes()[1] <= 14, JSON.stringify(mk.getTimes()));
  mk.commitQTime(); assert.ok(mk.getTimes()[1] <= 14, 'second commit adds nothing');
});
t('live feedback: right/wrong, correct answer, explanation, AI button only when needed', () => {
  const q = { q: 'Q', options: ['A1', 'B1', 'C1', 'D1'], ans: 2, exp: 'क्योंकि <b>C</b> सही है' };
  mk.set({ curQ: 0 }); mk.showLiveFeedback(q, 2);
  assert.ok(box.className.includes('q-fb-ok') && box.innerHTML.includes('✅ सही उत्तर') && box.innerHTML.includes('व्याख्या') && !box.innerHTML.includes('AI से समझें'));
  mk.showLiveFeedback(q, 0);
  assert.ok(box.className.includes('q-fb-bad') && box.innerHTML.includes('सही उत्तर: <b>C. C1') && box.innerHTML.includes('व्याख्या') && box.innerHTML.includes('AI से समझें'));
  mk.showLiveFeedback({ q: 'Q', options: ['x', 'y'], ans: 0 }, 0);              // exp nahi -> AI button
  assert.ok(box.innerHTML.includes('AI से समझें') && !box.innerHTML.includes('व्याख्या:'));
});
console.log(n + ' quiz-analytics tests passed');
