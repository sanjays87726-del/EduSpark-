import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { pathToFileURL } from 'node:url';
const modulePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'es-telegram-')), 'telegram.mjs');
fs.copyFileSync(new URL('../telegram.js', import.meta.url), modulePath);
const { handleTelegramWebhook } = await import(pathToFileURL(modulePath).href);
const env = { TELEGRAM_BOT_TOKEN: 'bot-test', TELEGRAM_WEBHOOK_SECRET: 'hook-secret', GEMINI_KEY: 'gem-test', TELEGRAM_CHAT_ID: 'admin-chat' };
const headers = { 'X-Telegram-Bot-Api-Secret-Token': 'hook-secret', 'Content-Type': 'application/json' };
let sent = [], geminiCalls = 0, geminiUrl = '', primaryCalls = 0, fallbackCalls = 0, geminiDelay = 0, geminiText = 'प्रकाश संश्लेषण में पौधे सूर्य के प्रकाश से भोजन बनाते हैं।';
const hostnameOf = value => { try { return new URL(String(value)).hostname; } catch { return ''; } };
globalThis.fetch = async (url, opts = {}) => {
  if (hostnameOf(url) === 'api.telegram.org') {
    sent.push({ method: String(url).split('/').at(-1), ...JSON.parse(opts.body) });
    return { ok: true, json: async () => ({ ok: true, result: {} }) };
  }
  if (hostnameOf(url) === 'generativelanguage.googleapis.com') {
    if (geminiDelay) await new Promise(resolve => setTimeout(resolve, geminiDelay));
    geminiCalls++; geminiUrl = String(url);
    assert.equal(JSON.parse(opts.body).generationConfig.temperature, undefined);
    if (String(url).includes('/models/gemini-3.5-flash-lite:generateContent')) {
      primaryCalls++;
      return { ok: false, status: 503, text: async () => '{"error":{"status":"UNAVAILABLE"}}' };
    }
    if (String(url).includes('/models/gemini-3.8-flash:generateContent')) fallbackCalls++;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: geminiText }] } }] }) };
  }
  throw new Error('Unexpected URL: ' + url);
};
const request = (body, secret = 'hook-secret') => new Request('https://worker.example/telegram/webhook', {
  method: 'POST', headers: { ...headers, 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify(body)
});
const message = (id, text, type = 'private') => ({ message: { chat: { id, type }, text } });
const lastMessage = () => sent.filter(x => x.method === 'sendMessage').at(-1);
const run = async () => {
  let r = await handleTelegramWebhook(request(message(11, '/start')), env);
  assert.equal(r.status, 200); assert.match(lastMessage().text, /EduSpark Student Support/);
  assert.match(lastMessage().text, /https:\/\/eduspark\.live/); assert.match(lastMessage().text, /t\.me\/EduSparkAlerts_bot/);

  r = await handleTelegramWebhook(request(message(111, '/help')), env);
  assert.equal(r.status, 200); assert.match(lastMessage().text, /Commands|App खोलने/);
  assert.doesNotMatch(lastMessage().text, /नमस्ते! 👋 EduSpark Student Support में आपका स्वागत है/);

  r = await handleTelegramWebhook(request(message(112, 'App link bhejo')), env);
  assert.equal(r.status, 200); assert.match(lastMessage().text, /https:\/\/eduspark\.live/); assert.equal(geminiCalls, 0);

  r = await handleTelegramWebhook(request(message(113, 'PYQ mil jayega kya App me')), env);
  assert.equal(r.status, 200); assert.match(lastMessage().text, /PYQ section/); assert.match(lastMessage().text, /eduspark\.live/);
  assert.equal(geminiCalls, 0);

  r = await handleTelegramWebhook(request(message(111, 'Hello')), env);
  assert.equal(r.status, 200); assert.match(lastMessage().text, /नमस्ते/); assert.match(lastMessage().text, /eduspark\.live/); assert.equal(geminiCalls, 0);

  const beforeAi = sent.length;
  r = await handleTelegramWebhook(request(message(12, 'Photosynthesis kya hai?')), env);
  assert.equal(r.status, 200); assert.equal(geminiCalls, 3); assert.equal(primaryCalls, 2); assert.equal(fallbackCalls, 1); assert.equal(lastMessage().chat_id, 12);
  assert.match(lastMessage().text, /eduspark\.live/); assert.match(geminiUrl, /gemini-3\.8-flash/);
  assert.ok(sent.slice(beforeAi).some(x => x.method === 'sendChatAction' && x.action === 'typing' && x.chat_id === 12));

  // LaTeX chemical equations must be converted to Telegram-readable Unicode.
  geminiText = 'प्रकाश संश्लेषण की अभिक्रिया: $\\text{6CO}_2 + \\text{6H}_2\\text{O} \\xrightarrow[\\text{क्लोरोफिल}]{\\text{सूर्य का प्रकाश}} \\text{C}_6\\text{H}_{12}\\text{O}_6 + \\text{6O}_2$';
  r = await handleTelegramWebhook(request(message(18, 'Photosynthesis equation')), env);
  assert.equal(r.status, 200);
  assert.match(lastMessage().text, /6CO₂ \+ 6H₂O/);
  assert.match(lastMessage().text, /सूर्य का प्रकाश; क्लोरोफिल/);
  assert.match(lastMessage().text, /C₆H₁₂O₆ \+ 6O₂/);
  assert.doesNotMatch(lastMessage().text, /\\text|\\xrightarrow|\$\$/);
  geminiText = 'प्रकाश संश्लेषण में पौधे सूर्य के प्रकाश से भोजन बनाते हैं।';

  // A long model response must refresh Telegram's short-lived typing action.
  geminiDelay = 4200;
  const beforeTypingRefresh = sent.filter(x => x.method === 'sendChatAction' && x.chat_id === 19).length;
  r = await handleTelegramWebhook(request(message(19, 'Explain photosynthesis in detail')), env);
  geminiDelay = 0;
  assert.equal(r.status, 200);
  const afterTypingRefresh = sent.filter(x => x.method === 'sendChatAction' && x.chat_id === 19).length;
  assert.ok(afterTypingRefresh - beforeTypingRefresh >= 2, 'typing action should refresh while AI is generating');

  r = await handleTelegramWebhook(request(message(13, '/admin login issue')), env);
  assert.equal(r.status, 200);
  const adminMessages = sent.filter(x => x.method === 'sendMessage' && x.chat_id === 'admin-chat');
  assert.match(adminMessages.at(-1).text, /login issue/); assert.equal(lastMessage().chat_id, 13);

  r = await handleTelegramWebhook(request(message(14, 'Hi'), 'wrong'), env);
  assert.equal(r.status, 403);
  const callsBeforeGroup = geminiCalls;
  r = await handleTelegramWebhook(request(message(15, 'Hi', 'group')), env);
  assert.equal(r.status, 200); assert.equal(geminiCalls, callsBeforeGroup);
  const incomplete = { ...env }; delete incomplete.TELEGRAM_WEBHOOK_SECRET;
  r = await handleTelegramWebhook(request(message(16, 'Hi')), incomplete);
  assert.equal(r.status, 503);
};
await run();
console.log('Telegram webhook tests passed');
