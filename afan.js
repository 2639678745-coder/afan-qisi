'use strict';

// 下载并解压后运行：node afan.js（无需 npm install）。
const { spawn } = require('node:child_process');

if (Number(process.versions.node.split('.')[0]) < 22) {
  console.error('请先安装 Node.js 22 或更高版本：https://nodejs.org/');
  process.exit(1);
}

let openBrowser = true;
const args = process.argv.slice(2);
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--help') {
    console.log('阿凡启思启动入口：node afan.js [--port 3211] [--no-open]');
    console.log('默认启动后打开浏览器；按 Ctrl+C 停止服务。');
    process.exit(0);
  } else if (args[i] === '--no-open') {
    openBrowser = false;
  } else if (args[i] === '--port' && /^\d+$/.test(args[i + 1] || '')) {
    process.env.PORT = args[++i];
  } else {
    console.error('参数有误。用法：node afan.js [--port 3211] [--no-open]');
    process.exit(1);
  }
}

function showBrowser(url) {
  if (!openBrowser) return;

  const fallback = () => console.log('请在浏览器中打开：' + url);
  let command, commandArgs;
  if (process.platform === 'darwin') {
    command = 'open';
    commandArgs = [url];
  } else if (process.platform === 'win32') {
    command = 'cmd.exe';
    commandArgs = ['/d', '/c', 'start', '', url];
  } else if (process.platform === 'linux') {
    command = 'xdg-open';
    commandArgs = [url];
  } else {
    fallback();
    return;
  }
  // URL 只含固定的 localhost 和已校验的数字端口。
  const opener = spawn(command, commandArgs, { stdio: 'ignore', windowsHide: true });
  opener.once('error', fallback);
  opener.once('exit', (code) => { if (code !== 0) fallback(); });
}

async function main() {
  const port = Number(process.env.PORT || 3210);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    console.error('启动失败：端口必须是 1～65535 之间的整数。');
    process.exitCode = 1;
    return;
  }
  const url = 'http://localhost:' + port;
  // 已有同一个应用在运行时，重复输入命令只需重新打开网页。
  try {
    const response = await fetch(url + '/api/health', { signal: AbortSignal.timeout(1000) });
    if (response.ok && (await response.json()).app === 'afan-qisi') {
      console.log('阿凡启思已在运行：' + url);
      showBrowser(url);
      return;
    }
  } catch { /* 尚未启动，下面创建服务。 */ }
  const server = require('./server.js');
  server.once('listening', () => {
    console.log('阿凡启思 · afan-qisi｜保持本终端运行，按 Ctrl+C 停止服务。');
    showBrowser(url);
  });
}

main().catch((error) => {
  console.error('启动失败：' + error.message);
  process.exitCode = 1;
});
