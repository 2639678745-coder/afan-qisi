#!/bin/bash
set -euo pipefail
export PATH="${PATH:-}:/usr/bin:/bin:/usr/sbin:/sbin"
AFAN_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$AFAN_DIR"

fail() { printf '\n启动失败：%s\n' "$1" >&2; exit 1; }
usable_node() {
  [ -x "$1" ] && "$1" -e 'process.exit(Number(process.versions.node.split(".")[0]) >= 22 ? 0 : 1)' >/dev/null 2>&1
}

AFAN_NODE=""
AFAN_PORTABLE=0
if [ "${1:-}" = "--portable" ]; then AFAN_PORTABLE=1; shift; fi
if [ "$AFAN_PORTABLE" = 0 ]; then
  # 兼容没有加载 nvm / Homebrew 的终端与 Finder。
  for candidate in "$(command -v node || true)" /opt/homebrew/bin/node /usr/local/bin/node \
    "${NVM_DIR:-$HOME/.nvm}"/versions/node/v*/bin/node; do
    if usable_node "$candidate"; then AFAN_NODE="$candidate"; break; fi
  done
fi

if [ -z "$AFAN_NODE" ]; then
  case "$(uname -s)" in
    Darwin) AFAN_OS=darwin ;; Linux) AFAN_OS=linux ;;
    *) fail '此入口支持 macOS / Linux；Windows 请运行 start.cmd。' ;;
  esac
  case "$(uname -m)" in
    arm64|aarch64) AFAN_ARCH=arm64 ;; x86_64|amd64) AFAN_ARCH=x64 ;;
    *) fail '暂不支持这台电脑的处理器架构。' ;;
  esac
  AFAN_VERSION=v24.21.0
  AFAN_STEM="node-$AFAN_VERSION-$AFAN_OS-$AFAN_ARCH"
  AFAN_CACHE="${AFAN_RUNTIME_DIR:-$HOME/.afan-qisi/runtime}"
  AFAN_TARGET="$AFAN_CACHE/$AFAN_STEM"
  AFAN_NODE="$AFAN_TARGET/bin/node"
  if ! usable_node "$AFAN_NODE"; then
    command -v curl >/dev/null || fail '系统缺少 curl，请先安装 curl。'
    command -v tar >/dev/null || fail '系统缺少 tar，请先安装 tar。'
    if command -v shasum >/dev/null; then AFAN_HASH_TOOL=shasum
    elif command -v sha256sum >/dev/null; then AFAN_HASH_TOOL=sha256sum
    else fail '系统缺少 SHA-256 校验工具（shasum 或 sha256sum）。'; fi
    mkdir -p "$AFAN_CACHE"
    AFAN_TEMP="$(mktemp -d "$AFAN_CACHE/.download.XXXXXX")"
    trap 'rm -rf "$AFAN_TEMP"' EXIT
    AFAN_ARCHIVE="$AFAN_STEM.tar.gz"
    AFAN_BASE="https://nodejs.org/dist/$AFAN_VERSION"
    printf '首次启动：正在从 Node.js 官网准备运行环境，无需管理员密码。\n下载完成后自动启动，请稍候……\n'
    curl --fail --location --retry 2 --connect-timeout 20 --max-time 600 \
      --output "$AFAN_TEMP/$AFAN_ARCHIVE" "$AFAN_BASE/$AFAN_ARCHIVE" \
      || fail '下载失败，请检查网络后重新运行同一条命令。'
    curl --fail --silent --show-error --location --retry 2 --connect-timeout 20 --max-time 60 \
      --output "$AFAN_TEMP/SHASUMS256.txt" "$AFAN_BASE/SHASUMS256.txt" \
      || fail '校验文件下载失败，请检查网络后重试。'
    AFAN_EXPECTED="$(awk -v archive="$AFAN_ARCHIVE" '$2 == archive {print $1}' "$AFAN_TEMP/SHASUMS256.txt")"
    if [ "$AFAN_HASH_TOOL" = shasum ]; then
      AFAN_ACTUAL="$(shasum -a 256 "$AFAN_TEMP/$AFAN_ARCHIVE" | awk '{print $1}')"
    else
      AFAN_ACTUAL="$(sha256sum "$AFAN_TEMP/$AFAN_ARCHIVE" | awk '{print $1}')"
    fi
    [ -n "$AFAN_EXPECTED" ] && [ "$AFAN_EXPECTED" = "$AFAN_ACTUAL" ] \
      || fail '下载文件校验未通过，请重新运行。'
    tar -xzf "$AFAN_TEMP/$AFAN_ARCHIVE" -C "$AFAN_TEMP"
    usable_node "$AFAN_TEMP/$AFAN_STEM/bin/node" || fail '此 Node.js 版本无法在当前操作系统运行。'
    if ! usable_node "$AFAN_NODE"; then
      if [ -e "$AFAN_TARGET" ]; then mv "$AFAN_TARGET" "$AFAN_TEMP/previous-runtime"; fi
      mv "$AFAN_TEMP/$AFAN_STEM" "$AFAN_TARGET"
    fi
    rm -rf "$AFAN_TEMP"
    trap - EXIT
  fi
fi
printf '阿凡启思｜运行环境：%s\n' "$AFAN_NODE"
exec "$AFAN_NODE" "$AFAN_DIR/afan.js" "$@"
