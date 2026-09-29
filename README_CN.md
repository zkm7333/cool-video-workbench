# ShotCraft Studio

ShotCraft Studio 是一款 macOS 本地视频工作台，提供多轨时间线、镜头模板、素材库、配音、字幕、网页采集和 MP4 导出。项目文件和导入素材保存在本机。

这个仓库包含桌面工作台、Video Shotcraft 镜头模板，以及可选的 Recordly 录屏集成源码。文档参考了 [Narrator AI CLI Skill](https://github.com/NarratorAI-Studio/narrator-ai-cli-skill) 的 Skill 发布形式，同时保留可构建的应用代码。

## 功能

- 多轨时间线：拖动、裁剪、分割、复制、撤销和重做
- 镜头库：216 个 Remotion 镜头模板，支持逐镜头改图、改字和调整参数
- 多图模板：一次为多个图片槽位批量选图
- 豆包配音：选择音色、生成配音并使用词时间
- 网页采集：翻译预览并截取网页区域
- 自动字幕、素材回收站和本地作品管理
- Remotion 实时预览与 MP4 导出
- 可选 Recordly 录屏工作流

## 本地运行

需要 macOS、Node.js 20 或更高版本、npm，以及用于视频渲染的 Chromium/Chrome。配音需要有效的豆包语音服务凭据。网页采集、录屏和缩略图可能还需要本机浏览器或媒体组件。

```bash
cd workbench
npm ci
npm run build
STUDIO_DATA="$HOME/Movies/ShotCraft Studio" STUDIO_PORT=5296 node server/server.mjs
```

然后打开 `http://127.0.0.1:5296`。`STUDIO_DATA` 用于指定本地数据目录。请勿把该目录下的工程、导入素材、导出视频或 API 凭据提交到 Git。

macOS 外壳源码位于 [`native/`](native/)。仓库不含已签名应用、打包的 Node 二进制、预编译 Recordly 原生工具或用户数据。通用桌面打包流程仍需另行整理。

## 仓库结构

```text
SKILL.md                         Agent 使用说明
workbench/                       工作台前端与本地 Node 服务
vendor/video-shotcraft/demos/    Remotion 镜头模板源码
vendor/video-shotcraft/assets/   镜头与音频素材
vendor/recordly-source/          Recordly 上游源码及许可证
native/                          macOS 外壳源码
```

## Agent Skill

将仓库放入支持 Agent Skills 的工具后，可按 [`SKILL.md`](SKILL.md) 帮助用户启动和操作本地工作台。使用 Skill 前需先在本机安装并配置 ShotCraft Studio。

## 来源与许可

镜头模板和基础工作台来自 [Video Shotcraft](https://github.com/Vincentwei1021/video-talkcraft)，上游采用 Apache-2.0。可选的 Recordly 录屏集成源码来自 [Recordly](https://github.com/webadderallorg/Recordly)，保留上游 AGPL-3.0 许可、署名和品牌要求。依赖包与随附素材也可能各有许可。请阅读 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 和各组件的许可证。

仓库根目录的 Apache-2.0 仅适用于贡献者有权授权的 ShotCraft Studio 原创部分，不替代第三方许可证；Recordly 仍遵守 AGPL-3.0。

## 安全与隐私

工作台默认只在本机回环地址提供服务。API 凭据保存在本机配置中，不应提交到仓库、发布到 Issue 或复制进日志。公开提交变更前，请检查提交历史、截图、媒体和配置文件，避免包含个人内容或密钥。
