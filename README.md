# ShotCraft Studio

> **给知识视频创作者的本地剪辑工作台**<br>
> 从配音、字幕、网页证据到可编辑镜头和 MP4 导出，在一条多轨时间线上完成。

**macOS · 本地项目与素材 · 216 个可编辑镜头 · Remotion · 豆包配音 · MP4 导出**

[English](README_EN.md) · [Agent Skill 使用说明](SKILL.md) · [第三方许可](THIRD_PARTY_NOTICES.md)

---

## 开始使用

当前仓库提供可构建的桌面工作台源码，尚未提供签名安装包。你可以在 macOS 上本地启动开发版：

```bash
cd workbench
npm ci
npm run build
STUDIO_DATA="$HOME/Movies/ShotCraft Studio" STUDIO_PORT=5296 node server/server.mjs
```

然后打开 <http://127.0.0.1:5296>。

需要 macOS、Node.js 20 或更高版本、npm，以及用于视频渲染的 Chromium/Chrome。豆包配音需要你自己的服务凭据；网页采集、录屏和缩略图功能可能还需要额外的本机浏览器或媒体组件。`STUDIO_DATA` 可以指定数据目录，请勿将其中的工程、媒体、导出文件或凭据提交到 Git。

## 工作台能做什么

| 阶段 | 能力 |
| --- | --- |
| 组织内容 | 多轨时间线，拖动、裁剪、分割、复制、撤销与重做 |
| 选择镜头 | 浏览 216 个 Remotion 镜头；逐镜头替换图片、文字并调整参数 |
| 填入素材 | 本地素材库、多图片槽位批量选图、网页翻译预览与区域截取 |
| 配音与字幕 | 豆包音色配音、词时间、自动字幕，可将配音直接加入轨道 |
| 预览与导出 | Remotion 实时预览，导出 MP4 到本机 |
| 管理作品 | 本地保存工程、管理素材与回收站；可选 Recordly 录屏集成 |

## 从文案到成片

1. 新建工程，把口播音频或素材放到时间线上。
2. 选择镜头模板，替换画面和文字；需要网页证据时，在采集面板中翻译预览并截取指定区域。
3. 添加配音与字幕，按时间线调整镜头顺序和时长。
4. 预览后导出 MP4。工程与导入素材默认保存在本机。

## 项目结构

```text
SKILL.md                         Agent 使用说明
workbench/                       工作台前端与本地 Node 服务
vendor/video-shotcraft/demos/    Remotion 镜头模板源码
vendor/video-shotcraft/assets/   镜头与音频素材
vendor/recordly-source/          Recordly 上游源码及许可证
native/                          macOS 外壳源码
```

将本仓库放入支持 Agent Skills 的工具后，可按 [`SKILL.md`](SKILL.md) 帮助用户启动和操作本地工作台。Skill 假设 ShotCraft Studio 已在用户的 Mac 上安装并配置。

## 平台与发布状态

| 项目 | 状态 |
| --- | --- |
| macOS 工作台源码 | 已发布，可按上方步骤本地构建和运行 |
| 签名桌面安装包 | 当前未提供 |
| Recordly 录屏集成 | 提供可选上游源码；不是独立录屏服务 |

仓库不含已签名应用、打包的 Node 二进制、预编译 Recordly 原生工具或用户数据。通用桌面打包流程仍需另行整理。

## 来源、许可与隐私

镜头模板和基础工作台来自 [Video Shotcraft](https://github.com/Vincentwei1021/video-talkcraft)，上游采用 Apache-2.0。可选的 Recordly 录屏集成源码来自 [Recordly](https://github.com/webadderallorg/Recordly)，保留上游 AGPL-3.0 许可、署名和品牌要求。依赖包和随附素材也可能有各自许可；再分发前请阅读 [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) 与对应组件的许可证。

仓库根目录的 Apache-2.0 仅适用于贡献者有权授权的 ShotCraft Studio 原创部分，不替代任何第三方许可证；Recordly 仍遵守 AGPL-3.0。

工作台默认只在本机回环地址提供服务。API 凭据保存在本机配置中，不应提交到仓库、发布到 Issue 或复制进日志。公开变更前，请检查提交历史、截图、媒体和配置文件，避免包含个人内容或密钥。
