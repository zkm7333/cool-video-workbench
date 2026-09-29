# ShotCraft Studio

ShotCraft Studio is a macOS video editing workbench with a multi-track timeline, editable Remotion shots, local asset management, Doubao voice generation, captions, webpage capture, and MP4 export. Projects and imported media stay on the local machine.

This repository packages the desktop workbench, Video Shotcraft templates, and the source for the optional Recordly integration. Its documentation follows the agent-skill style of [Narrator AI CLI Skill](https://github.com/NarratorAI-Studio/narrator-ai-cli-skill) while retaining the buildable application source.

## Features

- Multi-track editing with drag, trim, split, duplicate, undo, and redo
- 216 Remotion shot templates with editable images, text, and parameters
- Batch image assignment for multi-image shots
- Doubao text-to-speech with voice selection and word timing
- Translated webpage preview and region capture
- Automatic captions, a local asset trash, and project management
- Remotion preview and MP4 export
- Optional Recordly recording workflow

## Run locally

Requirements: macOS, Node.js 20+, npm, and Chromium/Chrome for video rendering. Voice generation requires valid Doubao credentials. Web capture, recording, and thumbnails may require additional local browser or media components.

```bash
cd workbench
npm ci
npm run build
STUDIO_DATA="$HOME/Movies/ShotCraft Studio" STUDIO_PORT=5296 node server/server.mjs
```

Open `http://127.0.0.1:5296`. `STUDIO_DATA` selects the local data directory. Never commit projects, imported media, rendered videos, or API credentials from that directory.

The macOS shell sources are in [`native/`](native/). This repository excludes signed app bundles, bundled Node binaries, prebuilt Recordly native tools, and user data. A portable desktop packaging workflow still needs to be prepared.

## Repository layout

```text
SKILL.md                         Agent instructions
workbench/                       Workbench frontend and local Node server
vendor/video-shotcraft/demos/    Remotion shot sources
vendor/video-shotcraft/assets/   Shot and audio assets
vendor/recordly-source/          Recordly upstream source and license
native/                          macOS shell sources
```

## Agent skill

Install this repository in an Agent Skills-compatible tool and follow [`SKILL.md`](SKILL.md) to help users launch and operate their local ShotCraft Studio installation. The skill assumes the desktop workbench is installed and configured on the user's computer.

## Provenance and licensing

Shot sources and core workbench code originate from [Video Shotcraft](https://github.com/Vincentwei1021/video-talkcraft) under Apache-2.0. The optional Recordly integration source originates from [Recordly](https://github.com/webadderallorg/Recordly) and retains its upstream AGPL-3.0 license, attribution, and branding requirements. Other dependencies and bundled assets may have their own terms. See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) and each component's license before reuse or redistribution.

The repository-level Apache-2.0 license applies only to original ShotCraft Studio contributions where the contributor has the rights to grant it; it does not replace third-party licenses. Recordly remains under AGPL-3.0.

## Security and privacy

The workbench binds to the local loopback interface by default. API credentials are stored in local configuration and must not be committed, posted in issues, or copied into logs. Review commit history, screenshots, media, and configuration files before publishing changes.
