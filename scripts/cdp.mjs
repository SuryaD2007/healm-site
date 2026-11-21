// A small Chrome DevTools Protocol client: launches headless Chrome with software WebGL (SwiftShader) so the
// 3D scene renders without a GPU, and exposes evaluate/screenshot. No Puppeteer; Node 22+ has WebSocket.
//
//   const chrome = await launch({ width: 600, height: 600, scale: 2 });
//   await chrome.goto(url); await chrome.waitFor('document.title === "poster-ready"');
//   await chrome.screenshot('out.png'); await chrome.close();
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function launch({ width = 1440, height = 900, scale = 1, mobile = false, reducedMotion = false, webgl = true, port = 9333 } = {}) {
  const profile = mkdtempSync(join(tmpdir(), 'healm-chrome-'));
  const gl = webgl
    ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
    : ['--disable-webgl', '--disable-webgl2', '--disable-3d-apis'];
  const proc = spawn(CHROME, [
    '--headless=new',
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${profile}`,
    ...gl,
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    `--window-size=${width},${height}`,
    'about:blank',
  ], { stdio: 'ignore' });

  let targets;
  for (let i = 0; i < 50; i++) {
    try {
      targets = await (await fetch(`http://127.0.0.1:${port}/json`)).json();
      if (targets.some((t) => t.type === 'page')) break;
    } catch {}
    await sleep(100);
  }
  const page = targets.find((t) => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r, { once: true }));
  let id = 0;
  const pending = new Map();
  const listeners = [];
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? reject(new Error(msg.error.message)) : resolve(msg.result);
    } else if (msg.method) listeners.forEach((l) => l(msg));
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const n = ++id;
      pending.set(n, { resolve, reject: (e) => reject(new Error(`${method}: ${e.message} ${JSON.stringify(params).slice(0, 200)}`)) });
      ws.send(JSON.stringify({ id: n, method, params }));
    });

  const logs = [];
  listeners.push((m) => {
    if (m.method === 'Runtime.consoleAPICalled') logs.push(`${m.params.type}: ${m.params.args.map((a) => a.value ?? a.description).join(' ')}`);
    if (m.method === 'Runtime.exceptionThrown') logs.push(`exception: ${m.params.exceptionDetails.exception?.description ?? m.params.exceptionDetails.text}`);
  });
  await send('Runtime.enable');
  await send('Page.enable');
  await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: scale, mobile });
  if (mobile) await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 });
  if (reducedMotion) await send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });

  const evaluate = async (expression) => {
    const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true });
    if (r.exceptionDetails) throw new Error(r.exceptionDetails.exception?.description ?? 'evaluate failed');
    return r.result.value;
  };

  return {
    send,
    evaluate,
    logs,
    /** Listen for a protocol event, such as Fetch.requestPaused. */
    on(method, fn) {
      listeners.push((m) => m.method === method && fn(m.params));
    },
    async goto(url) {
      await send('Page.navigate', { url });
      for (let i = 0; i < 100; i++) {
        if ((await evaluate('document.readyState')) === 'complete') return;
        await sleep(100);
      }
    },
    async waitFor(expression, timeout = 30000) {
      const end = Date.now() + timeout;
      while (Date.now() < end) {
        if (await evaluate(expression)) return true;
        await sleep(150);
      }
      throw new Error(`timed out waiting for: ${expression}`);
    },
    async screenshot(path, clip) {
      const r = await send('Page.captureScreenshot', { format: 'png', ...(clip ? { clip: { ...clip, scale: 1 } } : {}), captureBeyondViewport: false });
      writeFileSync(path, Buffer.from(r.data, 'base64'));
    },
    async close() {
      const exited = new Promise((r) => proc.once('exit', r));
      try { await send('Browser.close'); } catch {}
      ws.close();
      await Promise.race([exited, sleep(3000)]);
      proc.kill();
      // Chrome can still be flushing its profile; retry, and never fail the run over a temp folder.
      try { rmSync(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 200 }); } catch {}
    },
  };
}
