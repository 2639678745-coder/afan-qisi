import { createHash } from 'node:crypto';
import { chmod, mkdtemp, readdir, realpath, rm, stat, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Official ossutil 2.4.0, Linux x64. SHA-256 published by Alibaba Cloud:
// https://www.alibabacloud.com/help/en/oss/developer-reference/ossutil-overview/
const DOWNLOAD = 'https://gosspublic.alicdn.com/ossutil/v2/2.4.0/ossutil-2.4.0-linux-amd64.zip';
const SHA256 = '85edf66b2fb7238f5c7e25cab820cf29312319fe4935b7c86a6b8485eb434f3c';
const PROJECT_ROOT = fileURLToPath(new URL('../', import.meta.url));

function required(env, name) {
  const value = String(env[name] || '').trim();
  if (!value) throw new Error(`缺少 ${name}，请检查 GitHub Secrets / workflow 配置。`);
  return value;
}

async function countFiles(directory) {
  let total = 0;
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (entry.isSymbolicLink()) throw new Error('同步目录不能包含符号链接。');
    if (entry.isDirectory()) total += await countFiles(path.join(directory, entry.name));
    else if (entry.isFile()) total++;
    else throw new Error('同步目录只能包含普通文件和文件夹。');
  }
  return total;
}

export async function prepareSync(env, projectRoot = PROJECT_ROOT) {
  required(env, 'OSS_AK');
  required(env, 'OSS_SK');
  const bucket = required(env, 'OSS_BUCKET');
  const region = required(env, 'OSS_REGION');
  const rawPrefix = required(env, 'OSS_PREFIX');
  if (!/^[a-z0-9][a-z0-9-]{1,61}[a-z0-9]$/.test(bucket)) throw new Error('OSS_BUCKET 必须只填写 Bucket 名称。');
  if (!/^[a-z]+(?:-[a-z0-9]+)+$/.test(region)) throw new Error('OSS_REGION 无效，例如应填写 cn-shanghai。');
  const prefix = rawPrefix.replace(/\/+$/, '');
  if (!prefix || prefix.startsWith('/') || prefix.includes('\\') || prefix.split('/').some(part => !part || part === '.' || part === '..')) {
    throw new Error('OSS_PREFIX 必须是独立的非空目录，不能是 Bucket 根目录。');
  }
  const root = await realpath(projectRoot);
  const source = await realpath(path.resolve(root, env.OSS_SOURCE || 'public'));
  if (!source.startsWith(root + path.sep) || !(await stat(source)).isDirectory()) {
    throw new Error('OSS_SOURCE 必须是仓库内的网站目录。');
  }
  const files = await countFiles(source);
  if (!files) throw new Error('网站目录为空，已停止同步。');
  const deleteValue = String(env.OSS_SYNC_DELETE || 'false').toLowerCase();
  if (!['true', 'false'].includes(deleteValue)) throw new Error('OSS_SYNC_DELETE 只能为 true 或 false。');
  const removeOrphans = deleteValue === 'true';
  if (removeOrphans && env.GITHUB_EVENT_NAME !== 'workflow_dispatch') {
    throw new Error('删除旧文件仅允许在手动运行 workflow 时启用。');
  }
  const destination = `oss://${bucket}/${prefix}/`;
  const args = ['sync', source + path.sep, destination, '--force'];
  if (removeOrphans) args.push('--delete');
  return { source, destination, region, files, removeOrphans, args };
}

function run(command, args, env = process.env) {
  const result = spawnSync(command, args, { stdio: 'inherit', env });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`同步工具执行失败，退出码 ${result.status ?? result.signal}。`);
}

async function main() {
  const plan = await prepareSync(process.env);
  console.log(`上传 ${plan.files} 个文件到 ${plan.destination}；删除旧文件：${plan.removeOrphans ? '是' : '否'}`);
  if (process.env.OSS_DRY_RUN === 'true') {
    console.log('预检查通过：未连接 OSS，也未上传或删除文件。');
    return;
  }
  if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('请使用 workflow 指定的 ubuntu-latest x64 运行器。');
  const temporary = await mkdtemp(path.join(tmpdir(), 'afan-oss-sync-'));
  try {
    const response = await fetch(DOWNLOAD, { signal: AbortSignal.timeout(120_000) });
    if (!response.ok) throw new Error(`下载 ossutil 失败：HTTP ${response.status}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    if (createHash('sha256').update(bytes).digest('hex') !== SHA256) throw new Error('ossutil 校验失败，已停止。');
    const archive = path.join(temporary, 'ossutil.zip');
    await writeFile(archive, bytes);
    run('unzip', ['-q', archive, '-d', temporary]);
    const binary = path.join(temporary, 'ossutil-2.4.0-linux-amd64', 'ossutil');
    await chmod(binary, 0o755);
    run(binary, plan.args, {
      ...process.env,
      OSS_ACCESS_KEY_ID: required(process.env, 'OSS_AK'),
      OSS_ACCESS_KEY_SECRET: required(process.env, 'OSS_SK'),
      OSS_REGION: plan.region,
      OSS_ENDPOINT: `https://oss-${plan.region}.aliyuncs.com`,
    });
    console.log('OSS 同步完成。');
  } finally {
    await rm(temporary, { recursive: true, force: true });
  }
}

const entryFile = process.argv[1] ? await realpath(process.argv[1]).catch(() => null) : null;
if (entryFile === fileURLToPath(import.meta.url)) {
  await main().catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
