'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const client = require('../public/ai-client.js');
const problem = { subject_code: 'MATH', title: '求数列通项', full_score: 15 };
const input = { apiKey: 'unit-test-key', problem, subjectCode: 'MATH' };
const response = content => new Response(JSON.stringify({ choices: [{ message: { content } }] }));

test('browser export works without Node or a local server', async () => {
  const context = vm.createContext({ window: {}, URL, AbortController, DOMException, setTimeout, clearTimeout,
    fetch: async () => response('{"confidence":"低"}') });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/ai-client.js'), 'utf8'), context);
  assert.equal(await context.window.AfanAI.diagnose(input), '{"confidence":"低"}');
});

test('diagnosis calls the HTTPS provider directly and returns valid JSON', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://api.deepseek.com/chat/completions');
    assert.equal(options.headers.Authorization, 'Bearer unit-test-key');
    assert.equal(options.credentials, 'omit');
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'deepseek-flash');
    assert.equal(body.thinking.type, 'disabled');
    assert.match(body.messages[1].content, /求数列通项/);
    return response('```json\n{"confidence":"低"}\n```');
  });
  assert.deepEqual(JSON.parse(await client.diagnose(input)), { confidence: '低' });
});

test('tutoring preserves conversation and parses progress markers', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://provider.example/v1/chat/completions');
    const body = JSON.parse(options.body);
    assert.equal(body.thinking, undefined);
    assert.equal(body.messages.at(-1).content, '我卡住了');
    assert.equal(body.messages[1].content[1].image_url.url, 'https://example.com/answer.png');
    return response('从哪一步开始？\n[LEVEL:L1]\n[STAGE:有思路]\n[HIT:2]\n[VISUAL:3]');
  });
  const result = await client.tutor({ ...input, baseUrl: 'https://provider.example/v1/',
    studentAnswerImage: 'https://example.com/answer.png', history: [{ role: 'user', content: '我卡住了' }] });
  assert.deepEqual(result, { reply: '从哪一步开始？', hint_level: 'L1', stage: '有思路', hit: 2, visual: 3 });
});

test('handwriting sends the image to the selected model', async t => {
  t.mock.method(globalThis, 'fetch', async (url, options) => {
    const body = JSON.parse(options.body);
    assert.equal(body.model, 'deepseek-v4-pro');
    assert.equal(body.messages[0].content[1].image_url.url, 'data:image/png;base64,dGVzdA==');
    return response(' x^2 ');
  });
  assert.equal(await client.ocrHandwriting({ ...input, imageBase64: 'dGVzdA==', model: 'deepseek-v4-pro' }), 'x^2');
});

test('invalid settings fail before sending a key', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', () => { throw new Error('must not send'); });
  await assert.rejects(client.diagnose({ ...input, apiKey: '' }), /缺少 API Key/);
  for (const baseUrl of ['bad-url', 'http://example.com', 'https://user:password@example.com', 'https://example.com/?key=x']) {
    await assert.rejects(client.diagnose({ ...input, baseUrl }), /地址/);
  }
  assert.equal(fetch.mock.callCount(), 0);
});

test('authentication and network failures have actionable messages', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => new Response('{"error":{"message":"bad key"}}', { status: 401 }));
  await assert.rejects(client.diagnose(input), /API Key 无效/);
  fetch.mock.mockImplementation(async () => { throw new TypeError('Failed to fetch'); });
  await assert.rejects(client.diagnose(input), /跨域请求/);
});

test('invalid or empty AI output is rejected so the user can retry', async t => {
  const fetch = t.mock.method(globalThis, 'fetch', async () => response('not JSON'));
  await assert.rejects(client.diagnose(input), /诊断结果格式异常/);
  fetch.mock.mockImplementation(async () => response(''));
  await assert.rejects(client.tutor(input), /没有返回正文/);
});

test('changing questions can abort an in-flight request', async t => {
  t.mock.method(globalThis, 'fetch', (_, { signal }) => new Promise((_, reject) => {
    signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')), { once: true });
  }));
  const controller = new AbortController();
  const pending = client.diagnose({ ...input, signal: controller.signal });
  controller.abort();
  await assert.rejects(pending, { name: 'AbortError' });
});

test('timeout also covers reading the response body', async t => {
  t.mock.timers.enable({ apis: ['setTimeout'] });
  t.mock.method(globalThis, 'fetch', async (_, { signal }) => ({
    text: () => new Promise((_, reject) => signal.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))),
  }));
  const pending = client.diagnose(input);
  await Promise.resolve();
  t.mock.timers.tick(90001);
  await assert.rejects(pending, /请求超时/);
});
