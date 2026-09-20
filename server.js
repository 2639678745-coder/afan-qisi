'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT || 3210);
const HOST = process.env.HOST || '127.0.0.1';
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) {
  console.error('启动失败：PORT 必须是 1～65535 之间的整数。');
  process.exit(1);
}
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
};

const SUBJECT_NAMES = {
  CHINESE: '语文', MATH: '数学', ENGLISH: '英语', PHYSICS: '物理',
  CHEMISTRY: '化学', BIOLOGY: '生物', HISTORY: '历史', GEOGRAPHY: '地理',
  POLITICS: '政治',
};

// 文科主观题：无唯一标准答案，按「评分维度/得分点」给分，讲题走「对标式」
const HUMANITIES = new Set(['CHINESE', 'HISTORY', 'POLITICS', 'GEOGRAPHY']);
function isHumanities(code) { return HUMANITIES.has(code); }

function clean(s) {
  return String(s || '')
    .replace(/<[^>]*>/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function truncate(s, max) {
  s = clean(s);
  if (s.length <= max) return s;
  return s.slice(0, max) + '\n…（内容过长，已截断）';
}

function fetchWithTimeout(url, options, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms || 90000);
  return fetch(url, { ...options, signal: controller.signal })
    .catch((e) => {
      if (e.name === 'AbortError') throw new Error('请求超时（DeepSeek 响应过慢或网络不通，请检查 API Key / Base URL / 网络）');
      throw e;
    })
    .finally(() => clearTimeout(timer));
}

function buildSciencePrompt(subjectName) {
  return `你是「${subjectName}」学科的讲题老师，你的目标不是给出答案，而是通过一步一步提问，引导学生自己把题想出来。

【核心原则】
1. 你是教练，不是答案机器。学生要的是"会做"，不是"看懂答案"。
2. 永远不直接给出最终答案，也绝不一次讲完所有步骤。
3. 把题目拆成一个个小步，每次只问一个小问题。
4. 每个问题要小到学生能用「一个式子 / 一个数 / 一个选项 / 一句是或否」来回答，不要问需要长篇解释的问题。
5. 针对学生的错误"对症下药"，不要照念标准解析。

【引导节奏（小步快走）】
- 每次回复：先回应学生上一步（对 / 错 / 偏），再问下一个最小的问题。
- 学生答对 → 简短肯定 + 问下一步。
- 学生答错 / 卡住 → 缩小问题（拆得更细）或给一个方向提示，不要直接给答案。
- 一轮只推进一小步，绝不跳步。

【提示分级（由弱到强，逐级使用）】
L0 问思路：先了解学生想到哪、卡在哪（"你是怎么想的？"）。
L1 方向提示：只给方向，不给步骤（"试试从定义入手"）。
L2 拆步骤：把题拆成小步，引导第一步，不往下讲。
L3 关键点拨：只给一步，让学生补完其余步骤。
L4 完整讲解：仅当学生明确表示放弃时使用，且仍不直接报最终答案。

【硬规则】
- 不输出最终答案、选项字母或结果数值。
- 除非学生连续 ≥3 次表示"不会/直接给我答案"，否则禁止进入 L3/L4。
- 每轮最多给一个提示，必须等学生回应后再继续。
- 提问优先用「可简短回答」的形式：数学题让学生输一个式子，文科题让学生用一句话概括。
- 学生思路错时，指出"错在哪"，但不说"对的是什么"。
- 语气简短、鼓励、不说教；用学生能懂的话，不用术语堆砌。
- 每次回复的最后一整行，单独输出 [LEVEL:Lx]（x 为 0~4 的数字），标注你这次实际使用的引导级别（此行只给系统统计用）。
- 每次回复还单独输出 [STAGE:x]，x 表示学生当前的学习阶段：困惑（还不知道从哪下手）/ 有思路（知道了方向）/ 跟做（正跟着引导做题）/ 会做（能独立做出这道题）。
- 当学生跟着引导做完（跟做）后，让他「关掉提示，自己独立完整做一遍」；只有他独立做对了，才输出 [STAGE:会做]。`;
}

function buildHumanitiesPrompt(subjectName) {
  return `你是「${subjectName}」学科的讲题老师。这是一道主观题，没有唯一的标准答案，只有「评分表」（按哪几个得分点给分、每个点几分）。

【核心认知】
1. 主观题的"对错"是分层的：先看"踩没踩到得分点"（有没有答到该答的角度），再看"写得好不好"（表达/结构/逻辑）。
2. 你的目标不是把学生领到一个标准答案，而是帮学生看清：自己的答案能得几分、缺了哪个得分点、缺的那个点怎么补。
3. 先肯定学生已经踩到的点（对的地方），再针对漏掉的点引导。

【引导方式（按"漏掉的得分点"引导，不是按步骤）】
- 学生漏了某个得分点 → 问一个"点醒这个角度"的问题，让他自己补上。例：历史评析题漏了"局限性"一层，问"参战之后，中国的诉求都实现了吗？巴黎和会上发生了什么？"
- 学生答偏 → 指出"这个角度偏了"，拉回到评分维度上。
- 学生补对 → 简短肯定，再看还有没有漏的维度。
- 一轮只针对一个漏掉的得分点，补完一个再下一个，绝不一次全讲。

【范例对照】
- 学生补完漏掉的点后，可给"对应这个维度"的一两句示范写法，帮他体会"好答案长什么样"。
- 范例要片段化：只示范当前补的这个维度，不展开全文、不念标准答案。

【提示分级（针对"漏掉的维度"，由弱到强）】
L0 问角度：先问学生"你觉得还应该从哪个角度考虑？"（了解他是否意识到漏了）。
L1 点方向：只提示漏掉的方向，不给内容（"从'结果/影响'的角度再想想"）。
L2 给抓手：给出一个具体的小问题引导（"巴黎和会上山东发生了什么？"）。
L3 给范例：给出该维度的一两句示范写法，让他对照补全。
L4 完整讲解：仅当学生明确放弃时，才把该维度完整讲清（仍不整段念标准答案）。

【硬规则】
- 不输出标准答案全文，也不一次讲完所有漏掉的得分点。
- 除非学生连续 ≥3 次表示"不会/直接给答案"，否则不进入 L3/L4。
- 每轮最多补一个得分点，等学生回应后再继续。
- 语气简短、鼓励、不说教；用学生能懂的话，不堆术语。
- 每次回复的最后一整行，单独输出 [LEVEL:Lx]（x 为 0~4 的数字），标注你这次实际的提示级别（此行只给系统统计用）。
- 每次回复还单独输出 [STAGE:x]，x 表示学生当前的学习阶段：困惑（还不知道题目要答什么、该从哪些角度）/ 有思路（知道了该从哪些角度答，但还漏得分点）/ 跟做（在提示下逐个补漏掉的得分点）/ 会做（能脱离提示，独立写全所有得分点）。
- 「会做」的判定不是"对/错"，而是"得分点是否踩全"：当学生把漏掉的得分点都补全后，让他「关掉提示，自己独立完整重写一遍」；只有他独立重写踩全了所有得分点（对照评分表逐点确认），才输出 [STAGE:会做]。
- 「熟练」不在本次讲题内判定，靠后续同类题（换一篇材料、同样的评分维度）是否还能踩全得分点。
- 当学生补对了某个得分点时，单独输出 [HIT:n]（n = 评分表里第几个得分点，从 1 开始数），用于前端点亮对应的思维导图节点；没补对、或补的不是新得分点时不要输出。`;
}

function buildSystemPrompt(subjectName, subjectCode) {
  if (isHumanities(subjectCode)) return buildHumanitiesPrompt(subjectName);
  return buildSciencePrompt(subjectName);
}

function buildContext(problem, contentRecognition, reasoning, score, diagnosis) {
  const humanities = isHumanities(problem.subject_code);
  const parts = [];
  parts.push('<题目>\n' + clean(problem.title));
  if (contentRecognition) parts.push('<学生作答（手写识别文本）>\n' + clean(contentRecognition));
  if (reasoning) parts.push('<批题评分理由>\n' + clean(reasoning));
  if (score !== undefined && score !== null && score !== '') parts.push('<得分>\n' + score + ' / ' + (problem.full_score || '满分'));
  if (diagnosis) parts.push('<诊断结论（据此对症引导）>\n' + clean(diagnosis));
  if (humanities && problem.score_rule) parts.push('<评分表（本题按这些得分点给分，必须据此对标引导）>\n' + clean(problem.score_rule));
  if (problem.knowledge_points) parts.push('<考点>\n' + problem.knowledge_points);
  if (problem.thought_guidance) parts.push('<思路引导（供备课参考，不得原样输出）>\n' + truncate(problem.thought_guidance, 1600));
  if (problem.solution) parts.push('<标准答案（备课用，禁止原样输出）>\n' + truncate(problem.solution, 1600));
  if (!humanities && problem.score_rule) parts.push('<得分点>\n' + truncate(problem.score_rule, 800));
  return parts.join('\n\n');
}

function buildScienceDiagnosePrompt() {
  return `你是一名教育诊断专家。根据题目、学生作答、批题结果，诊断学生的问题，为后续引导讲题提供依据。
严格只输出 JSON（不要任何多余文字、不要 markdown 代码块）：
{"error_location":"...","knowledge_gap":["..."],"error_nature":"...","root_cause":"...","guidance_entry":"...","confidence":"高|中|低"}

要求：
- 只基于给定信息推断、不臆造；信息不足时 confidence 标「低」。
- knowledge_gap 要具体可操作。
- guidance_entry 只写「引导切入点」——一句话，指出从哪个概念/哪一步开始引导即可，禁止写出后续解题步骤、最终答案或结论。例：写「从裂项恒等式 1/[n(n+1)] = 1/n - 1/(n+1) 切入」，不要写「然后求和得 2(1-1/(n+1)) < 2」。`;
}

function buildHumanitiesDiagnosePrompt() {
  return `你是一名教育诊断专家。这是一道主观题，请严格依据给定的「评分表（得分点+分值）」诊断学生作答：哪些得分点踩到了、哪些漏了、最该先补哪个。

严格只输出 JSON（不要任何多余文字、不要 markdown 代码块）：
{"dimensions":[{"name":"得分点名称","score":"分值","status":"已踩到|部分踩到|未踩到","evidence":"学生作答中的依据（没有则写无）"}],"dimension_gap":"最弱/最该先补的得分点","missed_points":["漏掉的得分点"],"guidance_entry":"从哪个得分点切入引导（一句话，只说切哪个角度，禁止写出该得分点的内容/范文/标准答案）","confidence":"高|中|低"}

要求：
- 严格依据给定的「评分表」拆分维度，不要自创维度、不要漏维度。
- status 只能取「已踩到 / 部分踩到 / 未踩到」。
- dimension_gap 是"最该先补的那一个"（漏得最狠或最影响得分），不是罗列所有。
- guidance_entry 只写切入哪个角度，禁止写出该得分点的具体内容、示范或标准答案。例：写「从'参战的历史局限（巴黎和会）'切入」，不要写「巴黎和会把山东权益转交日本」。`;
}

function buildDiagnoseSystemPrompt(subjectCode) {
  if (isHumanities(subjectCode)) return buildHumanitiesDiagnosePrompt();
  return buildScienceDiagnosePrompt();
}

function buildDiagnoseContext(problem, contentRecognition, reasoning, score) {
  const humanities = isHumanities(problem.subject_code);
  const parts = [];
  parts.push('<题目>\n' + clean(problem.title));
  if (humanities && problem.score_rule) parts.push('<评分表（必须据此拆分维度）>\n' + clean(problem.score_rule));
  if (problem.standard_answer) parts.push('<标准答案（评分参考）>\n' + clean(problem.standard_answer));
  if (problem.solution) parts.push('<解析>\n' + truncate(problem.solution, 1600));
  if (problem.knowledge_points) parts.push('<考点>\n' + problem.knowledge_points);
  if (contentRecognition) parts.push('<学生作答（识别文本）>\n' + clean(contentRecognition));
  if (reasoning) parts.push('<批题结果>\n' + clean(reasoning));
  if (score !== undefined && score !== null && score !== '') parts.push('<得分>\n' + score + ' / ' + (problem.full_score || '满分'));
  return parts.join('\n\n');
}

function stripCodeFence(s) {
  return String(s || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
}

async function diagnose(data) {
  const { apiKey, baseUrl = 'https://api.deepseek.com', model = 'deepseek-chat', problem, contentRecognition, reasoning, score } = data;
  if (!apiKey) throw new Error('缺少 API Key');
  const messages = [
    { role: 'system', content: buildDiagnoseSystemPrompt(problem.subject_code) },
    { role: 'user', content: buildDiagnoseContext(problem, contentRecognition, reasoning, score) },
  ];
  const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const resp = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model, messages, temperature: 0.2, max_tokens: 800, stream: false }),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('DeepSeek 返回非 JSON：' + text.slice(0, 200)); }
  if (!resp.ok) throw new Error('DeepSeek HTTP ' + resp.status + '：' + ((json.error && json.error.message) || text.slice(0, 300)));
  const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  if (!content) throw new Error('DeepSeek 未返回内容：' + text.slice(0, 300));
  return stripCodeFence(content);
}

async function ocrHandwriting(data) {
  const { apiKey, baseUrl = 'https://api.deepseek.com', model = 'deepseek-flash', imageBase64 } = data;
  if (!apiKey) throw new Error('缺少 API Key');
  if (!imageBase64) throw new Error('缺少图片数据');
  const messages = [
    {
      role: 'user',
      content: [
        { type: 'text', text: '识别这张手写图片里的数学式子，只输出 LaTeX 表达式本身（不要 $ 符号、不要任何解释、不要 markdown）。若空白或识别不出，输出「无法识别」。' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,' + imageBase64 } },
      ],
    },
  ];
  const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const resp = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model, messages, temperature: 0, max_tokens: 200, stream: false }),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('DeepSeek 返回非 JSON：' + text.slice(0, 200)); }
  if (!resp.ok) throw new Error('DeepSeek HTTP ' + resp.status + '：' + ((json.error && json.error.message) || text.slice(0, 300)));
  const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  if (!content) throw new Error('DeepSeek 未返回内容：' + text.slice(0, 300));
  return content.trim();
}

async function tutor(data) {
  const {
    apiKey, baseUrl = 'https://api.deepseek.com', model = 'deepseek-chat',
    subjectCode, problem, contentRecognition, reasoning, score, diagnosis,
    studentAnswerImage, history = [],
  } = data;
  if (!apiKey) throw new Error('缺少 API Key');
  const subjectName = SUBJECT_NAMES[subjectCode] || '各学科';
  const contextText = buildContext(problem, contentRecognition, reasoning, score, diagnosis);
  let firstUser;
  if (studentAnswerImage) {
    firstUser = {
      role: 'user',
      content: [
        { type: 'text', text: contextText + '\n\n<学生手写作答图片>（兜底：无识别文本时看图）' },
        { type: 'image_url', image_url: { url: studentAnswerImage } },
      ],
    };
  } else {
    firstUser = { role: 'user', content: contextText };
  }
  const messages = [
    { role: 'system', content: buildSystemPrompt(subjectName, subjectCode) },
    firstUser,
    ...(Array.isArray(history) ? history : []),
  ];
  const endpoint = baseUrl.replace(/\/+$/, '') + '/chat/completions';
  const resp = await fetchWithTimeout(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + apiKey },
    body: JSON.stringify({ model, messages, temperature: 0.7, max_tokens: 1024, stream: false }),
  });
  const text = await resp.text();
  let json;
  try { json = JSON.parse(text); } catch { throw new Error('DeepSeek 返回非 JSON：' + text.slice(0, 200)); }
  if (!resp.ok) throw new Error('DeepSeek HTTP ' + resp.status + '：' + ((json.error && json.error.message) || text.slice(0, 300)));
  const content = json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content;
  if (!content) throw new Error('DeepSeek 未返回内容：' + text.slice(0, 300));
  return parseReply(content);
}

function parseReply(reply) {
  let r = String(reply || '');
  let hint_level = null, stage = null, visual = null, hit = null;
  const lm = r.match(/\[LEVEL:(L[0-4])\]/i);
  if (lm) hint_level = lm[1].toUpperCase();
  const sm = r.match(/\[STAGE:([^\[\]]+)\]/i);
  if (sm) stage = sm[1].trim();
  const vm = r.match(/\[VISUAL:(\d+)\]/i);
  if (vm) visual = parseInt(vm[1], 10);
  const hm = r.match(/\[HIT:(\d+)\]/i);
  if (hm) hit = parseInt(hm[1], 10);
  r = r.replace(/\[LEVEL:L[0-4]\]/gi, '').replace(/\[STAGE:[^\[\]]+\]/gi, '').replace(/\[VISUAL:\d+\]/gi, '').replace(/\[HIT:\d+\]/gi, '').replace(/\n{3,}/g, '\n\n').trim();
  return { reply: r, hint_level, stage, visual, hit };
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  const url = new URL(req.url, 'http://localhost');

  if (req.method === 'GET' && url.pathname === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ app: 'afan-qisi', version: '1.0.2' }));
    return;
  }

  if (req.method === 'GET') {
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    const full = path.join(PUBLIC_DIR, path.normalize(p));
    if (full.startsWith(PUBLIC_DIR) && fs.existsSync(full) && fs.statSync(full).isFile()) {
      res.writeHead(200, { 'Content-Type': MIME[path.extname(full)] || 'application/octet-stream' });
      fs.createReadStream(full).pipe(res);
      return;
    }
    res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('404'); return;
  }

  if (req.method === 'POST' && url.pathname === '/api/ocr') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const latex = await ocrHandwriting(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ latex }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: (e && e.message) || String(e) }));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/diagnose') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const diag = await diagnose(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ diagnosis: diag }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: (e && e.message) || String(e) }));
    }
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/tutor') {
    try {
      let body = '';
      for await (const chunk of req) body += chunk;
      const result = await tutor(JSON.parse(body));
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(result));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: (e && e.message) || String(e) }));
    }
    return;
  }

  res.writeHead(404); res.end('404');
});

server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error('启动失败：端口 ' + PORT + ' 已被占用。请先停止已有服务，或用 node afan.js --port 3211 换一个端口。');
  } else {
    console.error('启动失败：' + error.message);
  }
  process.exitCode = 1;
});

server.listen(PORT, HOST, () => {
  console.log('AI 讲题 Demo 已启动：http://localhost:' + PORT);
});

module.exports = server;
