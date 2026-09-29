---
name: shotcraft-studio
description: Help the user operate their local ShotCraft Studio video workbench, prepare editable Remotion shots, manage media, generate Doubao narration, add captions, and export finished videos. Use when the user asks to edit a video in ShotCraft Studio or work with its local projects.
---

# ShotCraft Studio

Use the user's installed ShotCraft Studio desktop application for hands-on editing. The app is local-first: projects and imported assets remain on the user's Mac unless the user explicitly exports or shares them.

## Workflow

1. Confirm the requested project or open the current project in ShotCraft Studio.
2. For manual edits, use the timeline and inspector. Keep shots editable; preserve their duration and motion while replacing media or copy.
3. For narration, use the Doubao voice page, listen to the generated audio, then add it to the voice track. Treat word timing as precise only when the UI marks it verified.
4. For webpage evidence, capture the requested page and region, then review the saved image before placing it in a shot.
5. Add automatic captions when requested and review line breaks, timing, and readability in the preview.
6. Export only when the user asks. Confirm the output path and inspect the rendered result when possible.

## Safety

- Never read, print, or share API keys. Configure credentials only through the app's local settings.
- Do not upload projects, recordings, or media to GitHub or another service without explicit user authorization for that destination.
- Before publishing source, exclude local project data, uploads, exports, caches, logs, generated credentials, and signed application bundles.
- Respect licenses and attribution for bundled Video Shotcraft and Recordly components.
- Do not claim exact word-level sync unless the audio has verified word timestamps.

## Local source layout

- `workbench/`: app interface and local server.
- `vendor/video-shotcraft/demos/`: Remotion shot components.
- `vendor/recordly-source/`: Recordly source under its own license.
- `native/`: macOS desktop shell sources.
