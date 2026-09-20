# 阿凡启思 · 在线讲题

**直接打开：[https://serphen591.github.io/afan-qisi/](https://serphen591.github.io/afan-qisi/)**

把这个网址发给别人即可使用。无需下载程序、打开终端，也无需安装 Node.js 或 Docker。

## 怎么使用

1. 打开网页，选择题目。
2. 点「演示完整流程」体验预设讲题过程，无需 API Key。
3. 需要真实 AI 讲题时，在顶部填写自己的 DeepSeek API Key，再点「开始引导式讲题」。

支持引导对话、作答诊断、文科得分点思维导图、几何互动、公式输入和手写笔记。语音输入依赖浏览器支持和麦克风权限。演示中的对话与学习进度为预设内容，不代表真实 AI 评估。

## 密钥与数据

- GitHub Pages 只托管网页，AI 请求由浏览器直接发送到顶部填写的 HTTPS 服务地址，默认 DeepSeek。真实调用使用访问者自己的 API 额度。
- 仓库和网页没有内置 API Key。默认仅在当前页面持有密钥；勾选「在此浏览器记住密钥」才写入浏览器存储，可点「清除密钥」删除。
- 手写笔记保存在当前浏览器，不会跨设备同步。笔记与原来的 localhost 页面存储分开；清理网站数据会清除笔记。
- 使用真实 AI 时，题目、填写的作答、批题信息、对话及主动提交的手写图片会发送到选定服务。自由笔记画板不会自动发送。
- 自定义服务地址需兼容 Chat Completions 接口，并允许本网站的跨域请求。公式、几何和 AI 功能需要网络连接。

## 更新网站

网站源码在 `public/`。推送到 `main` 后，[Publish website 工作流](https://github.com/serphen591/afan-qisi/actions/workflows/pages.yml)先运行测试，再把该目录发布到 GitHub Pages。设置中的 Pages 发布来源为 GitHub Actions。

网站不依赖 `server.js`。`public/ai-client.js` 包含可在浏览器直接运行的 AI 调用逻辑，并兼容旧本地入口。维护者可用 Node.js 24 运行 `node --test tests/*.test.cjs`；访问者不需要 Node.js。

接口依据：[DeepSeek Chat Completions](https://api-docs.deepseek.com/api/create-chat-completion/)、[思考模式参数](https://api-docs.deepseek.com/guides/thinking_mode/)。

## 旧版下载

之前的本地安装包仍保留在 [Releases](https://github.com/serphen591/afan-qisi/releases)，旧版说明见 [README.txt](README.txt)。日常使用和分享推荐直接打开上方网页版。
