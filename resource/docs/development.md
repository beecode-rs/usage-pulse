# Development

Usage Pulse is an Electron + TypeScript app with a React renderer; RxJS for the cross-process event bus, zod for schemas, and ws for the mobile server. Dev and builds run through electron-vite, installers through electron-builder, and tests are Vitest contract suites.

For how the source is layered, see [architecture.md](architecture.md). For shipping a release, see [releasing.md](releasing.md).

## Prerequisites

- [Node.js](https://nodejs.org)
- [pnpm](https://pnpm.io)

## Bootstrap

```bash
git clone https://github.com/beecode-rs/usage-pulse.git
cd usage-pulse
pnpm run init
pnpm dev
```

`pnpm run init` installs dependencies and verifies the Electron binary is in place — pnpm occasionally skips Electron's download (a stale side-effects cache), which `pnpm dev` then fails on with `Error: Electron uninstall`. The check runs automatically after every `pnpm install`, so this only needs to be run once after cloning.

## Daily commands

- `pnpm dev` — run the app in development
- `pnpm build` — build main/preload/renderer into `out/`
- `pnpm start` — run the built app
- `pnpm typecheck` — typecheck the node and web projects
- `pnpm lint` / `pnpm lint-fix` — ESLint + Prettier + json-sort-cli
- `pnpm test:contract` — run the contract tests (part of the release quality gate)
- `pnpm dist:mac` / `pnpm dist:linux` — build installers into `dist/` (universal dmg; AppImage + deb)
- `pnpm pack:dir` — unpacked build into `dist/` for a quick local smoke test

## Quality gates

`pnpm typecheck`, `pnpm lint`, and `pnpm test:contract` — the same gate GitHub Actions runs on every release tag before publishing (see [releasing.md](releasing.md)).
