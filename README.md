# 阿凡启思 · afan-qisi

本地运行的 AI 引导讲题 Demo。支持诊断、分步讲题、文科得分点、手写笔记和几何演示。

## macOS / Linux：终端任意目录，一条命令启动

```bash
curl -fsSL https://raw.githubusercontent.com/serphen591/afan-qisi/main/install.sh | bash
```

无需事先下载源文件、切换目录或安装 Node.js / Docker。安装器会下载并校验程序包，安装到 `~/.afan-qisi/app`，缺少 Node.js 时自动从 Node.js 官网下载专用运行环境。启动成功后打开浏览器；未能自动打开时，手动访问 http://localhost:3210。

首次安装需要访问 GitHub 和 Node.js 官网。终端会显示下载进度，请等待完成。

安装完成后，新开终端，在任意目录输入：

```bash
afan-qisi
```

保持提供服务的终端窗口运行；按 `Ctrl+C` 停止服务。已运行时，再次输入命令会打开现有服务。换端口使用 `afan-qisi --port 3211`，只启动服务使用 `afan-qisi --no-open`。

命令安装在 `~/.local/bin/afan-qisi`，安装器在 zsh / bash 的用户配置中追加 PATH 设置。安装前已经打开的终端可先重新打开；也可直接运行 `~/.local/bin/afan-qisi`。

macOS 支持 Apple Silicon 和 Intel。Linux 支持 x64 / ARM64，需有 curl、tar、SHA-256 校验工具，且系统兼容 Node.js 官方运行时。Linux 图形环境通过 xdg-open 打开浏览器。当前发布在 Apple Silicon Mac 上验证；其他平台尚未实机验证。

## Windows

从 [Releases](https://github.com/serphen591/afan-qisi/releases/latest) 下载 `afan-qisi.zip`，完整解压后双击 `start.cmd`。它会查找 Node.js，缺少时下载专用运行环境，再启动网页。此版本 Windows 使用下载包入口，不使用上面的 bash 命令。

## 使用

演示流程无需 API Key。真实 AI 功能需在网页中填写自己的 DeepSeek API Key，并保持联网；公式、几何等前端组件也使用在线 CDN。

本地服务默认只监听本机。API Key 和手写笔记保存在各自浏览器的 localStorage 中，固定使用 `http://localhost:3210` 可继续读取原来的本地数据。

## 开发与 Docker

已有 Node.js 22+ 时，可运行 `node afan.js`。Docker 用户可运行 `docker compose -p afan-qisi up -d --build`。详细功能和传统启动方式见 [README.txt](README.txt)。

维护者可用 `python3 tools/build-release.py --repo serphen591/afan-qisi --tag v1.0.0` 生成 `release/` 下的程序包、安装脚本及校验文件，并更新仓库的 `install.sh` 与 `distribution/`。提交这些文件后创建对应标签，再发布 Release；安装脚本绑定版本和包的 SHA-256。
