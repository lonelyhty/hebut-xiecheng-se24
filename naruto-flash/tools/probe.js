// 用 CDP 驱动无头 Edge：加载页面 -> 等待 -> 截图 / 取状态 / 可选按键
// 用法: node probe.js <url> <waitMs> <outPng> [evalJsFile] [port]
const fs = require('fs');

const url = process.argv[2] || 'http://127.0.0.1:8765/play.html';
const waitMs = Number(process.argv[3] || 40000);
const outPng = process.argv[4] || 'probe.png';
const evalFile = process.argv[5] || null;
const port = Number(process.argv[6] || 9222);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const list = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json();
  const page = list.find((t) => t.type === 'page');
  if (!page) throw new Error('no page target');

  const ws = new WebSocket(page.webSocketDebuggerUrl);
  let id = 0;
  const pending = new Map();
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const msgId = ++id;
      pending.set(msgId, { resolve, reject });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });

  ws.addEventListener('message', (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p.reject(new Error(JSON.stringify(msg.error)));
      else p.resolve(msg.result);
      return;
    }
    if (msg.method === 'Runtime.consoleAPICalled') {
      const text = (msg.params.args || []).map((a) => a.value ?? a.description ?? a.type).join(' ');
      if (!/AudioContext|favicon|CORS|Failed to load resource/.test(text)) {
        console.log(`[console.${msg.params.type}] ${text}`);
      }
    } else if (msg.method === 'Runtime.exceptionThrown') {
      const d = msg.params.exceptionDetails;
      console.log('[exception]', d.text, d.exception && (d.exception.description || d.exception.value));
    } else if (msg.method === 'Log.entryAdded') {
      const e = msg.params.entry;
      if (!/AudioContext|favicon|CORS|Failed to load resource/.test(e.text || '')) {
        console.log(`[log.${e.level}] ${e.text}`);
      }
    }
  });

  await new Promise((r) => ws.addEventListener('open', r, { once: true }));

  await send('Page.enable');
  await send('Runtime.enable');
  await send('Log.enable');
  await send('Emulation.setDeviceMetricsOverride', {
    width: 1280, height: 720, deviceScaleFactor: 1, mobile: false,
  });

  await send('Page.navigate', { url });
  await sleep(waitMs);

  if (evalFile) {
    const expr = fs.readFileSync(evalFile, 'utf8');
    const r = await send('Runtime.evaluate', {
      expression: expr, returnByValue: true, awaitPromise: true,
    });
    console.log('EVAL:', JSON.stringify(r.result && r.result.value, null, 2));
  }

  const shot = await send('Page.captureScreenshot', { format: 'png' });
  fs.writeFileSync(outPng, Buffer.from(shot.data, 'base64'));
  console.log('screenshot:', outPng, fs.statSync(outPng).size, 'bytes');

  ws.close();
  process.exit(0);
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
