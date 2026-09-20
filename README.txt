阿凡启思 · GitHub 网页版
=======================

直接打开：https://2639678745-coder.github.io/afan-qisi/
无需终端、Node.js、Docker，也不需要启动本地服务。
点「演示完整流程」即可体验；真实 AI 讲题需填写自己的 DeepSeek API Key。
默认不保存密钥，主动勾选后才会记住；笔记保存在当前浏览器。
网页版的最新说明请看 README.md。

以下是 v1.0.2 本地安装包的历史说明，不适用于网页版：

旧版本地程序启动说明（仅供保留的安装包参考）
================================

终端任意目录启动（macOS / Linux，推荐）
复制一条命令，自动下载、安装并启动：

  curl --http1.1 -fsSL https://raw.githubusercontent.com/serphen591/afan-qisi/v1.0.2/install.sh | bash

以后新开终端，在任意目录输入：

  afan-qisi

首次安装会把命令写到 ~/.local/bin，并追加用户终端的 PATH 设置。
保持服务终端运行，按 Ctrl+C 停止。Windows 请使用后面的 start.cmd 入口。
下面介绍的是已手动下载程序包后的传统启动方式。

一、下载后怎么启动（本地文件方式）
请先解压整个压缩包，在解压后的 afan-qisi 文件夹内打开终端。
不要只下载 server.js，public 目录中的网页和图片也必须保留。

推荐方式：无需预先安装 Docker / Node.js
- macOS：双击 start.command，或者在程序目录的终端输入：

  bash start.command

- Windows：双击 start.cmd，或者在程序目录的 PowerShell 输入：

  .\start.cmd

- Linux（x64 / ARM64）：在程序目录运行 bash start.command。
- 启动入口会自动查找可用的 Node.js；没有时从 https://nodejs.org/
  下载 Node.js v24.21.0 到本程序专用目录，校验 SHA-256 后启动。
  不需要管理员密码，不修改系统 PATH 或 shell 配置。
- 首次下载运行环境需要联网，下载完成后自动启动并打开网页；以后复用缓存。
- 保持终端窗口运行，按 Ctrl+C 停止服务。
- macOS / Linux 换端口：bash start.command --port 3211
- Windows 换端口：.\start.cmd -Port 3211
- 若系统 Node.js 异常，可使用独立环境：bash start.command --portable
  Windows：.\start.cmd -Portable
- macOS / Linux 缓存：~/.afan-qisi/runtime；
  Windows 缓存：%LOCALAPPDATA%\afan-qisi\runtime。
- Linux 需具有 curl、tar、shasum 或 sha256sum，并兼容 Node.js 官方二进制。
  Windows 下载入口使用系统自带的 Windows PowerShell 5.1+。

出现 zsh: command not found: node / docker 时，请使用上述自动入口。
下面保留手动方式，适合已经安装相应环境的用户。

方式 A：Node.js 启动，自动打开浏览器（推荐给已有 Node.js 的用户）
- 安装 Node.js 22 或更高版本：https://nodejs.org/
- 无 npm 依赖，不用运行 npm install。
- 在终端输入这条专属启动命令：

  node afan.js

- 服务启动成功后，自动打开 http://localhost:3210。
- 保持终端运行；按 Ctrl+C 停止；下次再输入同一条命令即可。
- 如果浏览器未自动打开，请手动访问上面的地址。
- 换一个端口：node afan.js --port 3211
- 只启动服务、不打开浏览器：node afan.js --no-open
- 原有命令 node server.js 仍可使用，但不会自动打开浏览器。

方式 B：Docker 启动，不用单独安装 Node.js
- 安装并启动 Docker Desktop：https://www.docker.com/products/docker-desktop/
  Linux 也可使用 Docker Engine + Docker Compose 插件。
- 在程序文件夹内输入（macOS / Windows PowerShell / Linux 通用）：

  docker compose -p afan-qisi up -d --build

- 首次运行会从 Docker Hub 下载 Node.js 基础镜像，需要联网。
- 启动后手动打开 http://localhost:3210；Docker 命令不会自动打开浏览器。
- 容器在后台运行，可以关闭终端；Docker 本身需要保持运行。
- 下次启动：docker compose -p afan-qisi up -d
- 停止服务：docker compose -p afan-qisi stop
- 查看日志：docker compose -p afan-qisi logs -f
- 查看运行状态：docker compose -p afan-qisi ps
- 移除容器：docker compose -p afan-qisi down
- 若 3210 已被占用，可在 compose.yaml 同目录新建 .env，写入
  AFAN_PORT=3211，再执行启动命令，改访问 http://localhost:3211。

二、与示例相同风格的 docker run 命令
先在程序文件夹内构建本地镜像（首次或程序更新后执行）：

  docker build -t afan-qisi:local .

然后启动（以下多行格式用于 macOS / Linux）：

  docker run -d --name afan-qisi \
    --init \
    --restart unless-stopped \
    -p 127.0.0.1:3210:3210 \
    afan-qisi:local

Windows PowerShell 请使用同一命令的单行版本：
  docker run -d --name afan-qisi --init --restart unless-stopped -p 127.0.0.1:3210:3210 afan-qisi:local

访问：http://localhost:3210
停止：docker stop afan-qisi
再次启动已有容器：docker start afan-qisi
查看日志：docker logs -f afan-qisi
Compose 和 docker run 是二选一的 Docker 启动方式，不要同时创建同名容器。
Node.js 和 Docker 方式也不要同时占用同一个端口。

分发说明：
- 把完整的 afan-qisi.zip 发给别人，解压后使用推荐的自动启动入口。
- afan-qisi:local 是在使用者电脑上构建的镜像标签，不是已发布的镜像地址。
- 若希望别人不用下载源文件、只粘贴一条 docker run 就能使用，需要先将
  镜像发布到可访问的镜像仓库，再用真实镜像地址替换 afan-qisi:local。
  当前包没有发布到 GHCR 或 Docker Hub。
- 本程序默认仅供本机访问；Docker 只映射到 127.0.0.1。
- 当前后端不写入业务数据文件，无需添加示例中的 -v 数据卷。
  API Key 和手写笔记保存在各自浏览器的 localStorage 中，不在 Docker 卷里。
  请固定使用同一个地址和端口；更换地址、端口或浏览器会使用独立的本地存储。
- 本地运行不等于完全离线：网页公式、几何等组件仍使用在线 CDN；
  真实 AI 讲题需要网络及使用者自己的 DeepSeek API Key。

三、两种使用方式
1. 一键演示（推荐给团队/领导看）：
   点右下角「▶ 演示完整流程」，自动播放完整讲题过程，无需 API Key。
2. 真实使用：
   顶部填 DeepSeek API Key → 选题目 → 点「开始讲题」→ 诊断 → 引导对话。

四、已实现的能力
1. 诊断 + 引导式讲题（L0-L4 分级，不直接给答案）
2. 文理分型讲题：理科「收敛式」（错误定位→步骤引导→唯一答案）；文科「对标式」（按评分表 score_rule 补漏得分点 + 范文片段对照 + 思路拆解，不判对错、不念答案）
3. 得分点思维导图（文科）：放射状导图（中心+分支），右侧面板展示，补对一个得分点点亮一个（事件驱动，非模型报数）
4. 知识迷雾寻宝进度（游戏化）：探险家闯关图，有思路→跟做→会做 三个关卡逐个点亮，会做=通关宝箱（替代原成长条）
5. 独立验证：学生独立完整重做 → 批题/评分表判对错 → 点亮「会做」
6. 费曼检验：学生当老师，用语音讲解法（数字人占位，正式版为 3D 数字人）
7. 图形可视化：立体几何 3D（翻步骤）+ 解析几何 2D（拖滑块），右侧面板，学生自控探索，不泄答案
8. 四种学生回应：文字 / 公式（MathLive 拼式子）/ 手写（识图，结果可编辑）/ 语音（浏览器识别，需 Chrome）
9. 演示模式：数学/历史/语文各有一条演示脚本，点「演示」按当前题自动播放

五、文件说明
  server.js               后端（DeepSeek 代理 + 诊断 + 手写识别，端口 3210）
  afan.js                 本地专属启动入口（检查版本、启动服务、打开浏览器）
  start.command           macOS / Linux 自动查找或下载 Node.js 并启动
  start.cmd / start.ps1   Windows 自动查找或下载 Node.js 并启动
  Dockerfile              Docker 镜像构建配置（包含 Node.js）
  compose.yaml            Docker 单命令启动配置
  .dockerignore           限定镜像构建所需文件
  public/index.html       前端
  public/questions.js     6 道真实题（数学×4、历史、语文）
  public/afan*.png        IP 表情图
  public/edulab-cube.html 立体几何交互式 3D 页面
  public/edulab-ellipse.html 解析几何 2D 动态页面
  public/treasure.html    知识迷雾寻宝进度组件

六、说明
- 这是「引导式讲题」验证 Demo：不直接给答案，分步提示 + 追问。
- 诊断结果、引导级别等内部信息默认对学生隐藏，勾顶部「调试」才显示。
