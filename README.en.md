<p align="center">
  <img src="docs/images/readme-banner.png" alt="RaceMemoir — Connect trail memories with photos, medals, race bibs, and red thread" width="100%" />
</p>

<p align="center">
  <a href="https://app.racememoir.com"><img alt="Try RaceMemoir online" src="https://img.shields.io/badge/Live_Demo-RaceMemoir-F38020?logo=cloudflare&logoColor=white" /></a>
  <img alt="React" src="https://img.shields.io/badge/React-20232A?logo=react&logoColor=61DAFB" />
  <img alt="TypeScript" src="https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white" />
  <img alt="Vite" src="https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white" />
  <img alt="Version 0.0.1" src="https://img.shields.io/badge/version-0.0.7-6B7D53" />
  <a href="LICENSE"><img alt="License: AGPL v3" src="https://img.shields.io/badge/License-AGPL_v3-blue" /></a>
</p>

<p align="center"><a href="README.md">简体中文</a> · English</p>

RaceMemoir is a web-based digital collection board for race memories and outdoor adventures.

Frame your medals, pin up photos, tape down race bibs, and turn GPX tracks into route cards. Arrange them on an infinite canvas and connect your memories with red thread.

---

![RaceMemoir collection board](docs/images/board.png)

<div align="center">Make it yours. Arrange everything your way!</div>

![Sricker appearance settings](docs/images/sticker.png)

<div align="center">Customize each item to suit your style.</div>

![Share page](docs/images/share.png)

## Highlights

- 🖼️ A virtual display wall without physical space constraints.
- 🎖️ A variety of keepsakes to arrange however you like—neat and minimal or delightfully scattered.
- 😊 Runs entirely in the browser, is easy to deploy, and keeps your data locally.

## Features

- ✅ **Collect keepsakes**: Upload and reuse medals, photos, race bibs, notes, and stickers, with batch photo import and automatic background removal.
- ✅ **Create freely**: Arrange keepsakes on an infinite canvas with red threads, custom styles, grouping, alignment, and undo/redo.
- ✅ **Map your memories**: Mark race locations and turn GPX tracks into route cards with real maps and elevation profiles.
- ✅ **Season boards**: Switch between separate yearly canvases with a shared collection library.
- ✅ **Enjoy your collection**: Use viewing mode, touch gestures, and Chinese, English, or Japanese interfaces.
- ✅ **Save and share**: Save locally and automatically, export high-resolution images, and back up or restore your board with ZIP files.

## Getting Started

Core interactions use [Base UI](https://base-ui.com/) for dialog, menu, tooltip, and switch keyboard behavior, focus management, and popup positioning.

Requires Node.js 22.18+ (Node.js 24 recommended).

```bash
npm install
npm run dev
```

Development and production builds prepare and verify background-removal resources automatically. The first setup downloads the model; subsequent runs reuse verified local files. Deploy the entire `dist/` directory to serve the runtime and model from your own site. Images are processed in the browser. See [resource versions, hashes, and offline setup](docs/background-removal-resources.md).

Use a modern browser with Web Locks support. When multiple pages are open in the same browser, only one can edit; the others enter viewing mode automatically. Entering viewing mode saves changes and releases editing access so another page can take over. Exiting requests editing access again and loads the latest data if the saved workspace has changed. If a save conflict is detected, saving and deletion pause while your current contents remain available for backup export.

Open [http://localhost:5173](http://localhost:5173).

```bash
npm run build      # Check TypeScript and create a production build
npm run preview    # Preview the production build
npm test           # Run tests
```

## License

Original code in this project is licensed under [GNU AGPL v3.0](LICENSE) (`AGPL-3.0-only`). Third-party dependencies, map data, and assets remain subject to their respective licenses.
