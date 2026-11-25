// Regression tests for raw LaTeX emitted by AI models.
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const app = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const start = app.indexOf('function cleanAI(t)');
const end = app.indexOf('function formatAIAnswer(value)', start);
assert.ok(start >= 0 && end > start, 'AI math normalizer must exist before answer formatter');
const helpers = app.slice(start, end);
const normalize = new Function(helpers + '\nreturn normalizeAIMath;')();

assert.strictEqual(normalize('$\\text{CO}_2$ और $\\text{O}_2$'), 'CO₂ और O₂');
assert.strictEqual(normalize('\\(6\\text{CO}_2 + 6\\text{H}_2\\text{O} \\rightarrow \\text{C}_6\\text{H}_{12}\\text{O}_6 + 6\\text{O}_2\\)'), '6CO₂ + 6H₂O → C₆H₁₂O₆ + 6O₂');
assert.strictEqual(normalize('H_2O, x^2, a_{10}'), 'H₂O, x², a₁₀');
assert.strictEqual(normalize('\\frac{1}{2} + 3 \\times 4'), '1/2 + 3 × 4');
assert.ok(!normalize('$\\text{CO}_2$').includes('\\text'), 'raw LaTeX commands must not leak to students');
console.log('✓ AI LaTeX formulas render as readable Unicode');
