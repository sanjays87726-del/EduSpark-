import assert from 'node:assert/strict';
import fs from 'node:fs'; import os from 'node:os'; import path from 'node:path';
import { pathToFileURL } from 'node:url';
const modulePath = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'es-telegram-')), 'telegram.mjs');
fs.copyFileSync(new URL('../telegram.js', import.meta.url), modulePath);
const { handleTelegramWebhook } = await import(pathToFileURL(modulePath).href);
const env = { TELEGRAM_BOT_TOKEN: 'bot-test', TELEGRAM_WEBHOOK_SECRET: 'hook-secret', GEMINI_KEY: 'gem-test', TELEGRAM_CHAT_ID: 'admin-chat' };
const headers = { 'X-Telegram-Bot-Api-Secret-Token': 'hook-secret', 'Content-Type': 'application/json' };
let sent = [], geminiCalls = 0;
const hostnameOf = value => { try { return new URL(String(value)).hostname; } catch { return ''; } };
globalThis.fetch = async (url, opts = {}) => {
  if (hostnameOf(url) === 'api.telegram.org') {
    sent.push(JSON.parse(opts.body));
    return { ok: true, json: async () => ({ ok: true, result: {} }) };
  }
  if (hostnameOf(url) === 'generativelanguage.googleapis.com') {
    geminiCalls++;
    return { ok: true, json: async () => ({ candidates: [{ content: { parts: [{ text: 'पढ़ाई में मैं आपकी मदद कर सकता हूँ।' }] } }] }) };
  }
  throw new Error('Unexpected URL: ' + url);
};
const request = (body, secret = 'hook-secret') => new Request('https://worker.example/telegram/webhook', {
  method: 'POST', headers: { ...headers, 'X-Telegram-Bot-Api-Secret-Token': secret }, body: JSON.stringify(body)
});
const run = async () => {
  let r = await handleTelegramWebhook(request({ message: { chat: { id: 11, type: 'private' }, text: '/start' } }), env);
  assert.equal(r.status, 200); assert.match(sent.at(-1).text, /EduSpark Student Support/); assert.match(sent.at(-1).text, /https:\/\/eduspark\.live/); assert.match(sent.at(-1).text, /t\.me\/EduSparkAlerts_bot/);
  r = await handleTelegramWebhook(request({ message: { chat: { id: 111, type: 'private' }, text: 'Hello' } }), env);
  assert.equal(r.status, 200); assert.match(sent.at(-1).text, /नमस्ते/); assert.match(sent.at(-1).text, /eduspark\.live/); assert.equal(geminiCalls, 0);
  r = await handleTelegramWebhook(request({ message: { chat: { id: 12, type: 'private' }, text: 'Photosynthesis kya hai?' } }), env);
  assert.equal(r.status, 200); assert.equal(geminiCalls, 1); assert.equal(sent.at(-1).chat_id, 12); assert.match(sent.at(-1).text, /eduspark\.live/);
  r = await handleTelegramWebhook(request({ message: { chat: { id: 13, type: 'private' }, text: '/admin login issue' } }), env);
  assert.equal(r.status, 200); assert.equal(sent.at(-2).chat_id, 'admin-chat'); assert.equal(sent.at(-1).chat_id, 13);
  r = await handleTelegramWebhook(request({ message: { chat: { id: 14, type: 'private' }, text: 'Hi' } }, 'wrong'), env);
  assert.equal(r.status, 403);
  r = await handleTelegramWebhook(request({ message: { chat: { id: 15, type: 'group' }, text: 'Hi' } }), env);
  assert.equal(r.status, 200); assert.equal(geminiCalls, 1);
  const incomplete = { ...env }; delete incomplete.TELEGRAM_WEBHOOK_SECRET;
  r = await handleTelegramWebhook(request({ message: { chat: { id: 16, type: 'private' }, text: 'Hi' } }), incomplete);
  assert.equal(r.status, 503);
};
await run();
console.log('Telegram webhook tests passed');
