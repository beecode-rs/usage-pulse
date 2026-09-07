# Code Structure Snapshot

A snapshot of the `src/` folder of the usage-pulse project: every file, its exported classes/objects, a verbal description of what they are, and why they sit in the folder/layer they are in. No code snippets; verbal explanations only.

## Snapshot metadata

- **Git commit:** `6fdfa9db16dd7e37176324736f4e93927fbbf061` (subject: `0.6.1`, branch `code-structure`, clean working tree at snapshot time)
- **App version:** 0.6.1
- **Project:** usage-pulse, a desktop tracker for Claude and z.ai coding-plan usage limits
- **Stack:** Electron + electron-vite + React 19 + TypeScript, pnpm, Vitest contract tests (`*.contract.yaml` via `@beecode/msh-test-contractor`)
- **Date of snapshot:** 2026-09-07

## How to read this snapshot

One file per top-level folder under `src/`:

| File | Folder | Contents |
|---|---|---|
| [main.md](main.md) | `src/main` | Electron main process: composition root, IPC controller, business services/repos/use-cases, OS scheduling strategy component, usage provider strategies, Electron integration libs, utils |
| [preload.md](preload.md) | `src/preload` | The single preload script bridging main and renderer via contextBridge |
| [renderer.md](renderer.md) | `src/renderer` | React UI: app shell, pages, feature components, IPC client services, presentation utils |
| [shared.md](shared.md) | `src/shared` | Cross-process contracts: IPC channel enum, domain models, provider catalog, planner math, contract YAML fixtures |

## Top-level shape

The app is a classic three-process Electron layout plus a shared contract layer:

```plantuml
@startuml
folder "src/main" as main {
  rectangle "composition root (index.ts)" as root
  rectangle "controller/ipc-controller" as ctrl
  rectangle "business/\n(services, repos, use-case,\ncomponents, strategies)" as biz
  rectangle "lib + util" as lib
}
folder "src/shared" as shared {
  rectangle "IPC channels,\ndomain models,\nprovider catalog,\nplanner math" as contracts
}
folder "src/preload" as preload {
  rectangle "contextBridge\nwindow.usageApi" as bridge
}
folder "src/renderer" as renderer {
  rectangle "business/service\n(*-client-service)" as clients
  rectangle "ui-component/*\n(pages, dialogs, widgets)" as ui
  rectangle "util" as rutil
}

main <--> contracts
renderer <--> contracts
preload <--> contracts
renderer <-down-> bridge <-down-> ctrl
root --> ctrl
root --> biz
root --> lib
ctrl --> biz
biz --> lib
ui --> clients
ui --> rutil
clients --> bridge
@enduml
```

Data flows downward through the bridge: React components call renderer client services, which call `window.usageApi` (installed by the preload script), whose methods map to `IpcChannelMapper` channel names handled by `src/main/controller/ipc-controller.ts`, which delegates to the main-process business layer. Push updates flow the opposite direction (poll services emit, the controller forwards via `webContents.send`, the preload unwraps and dispatches to subscribed listeners).

## Layer map (writing-clean-ts conventions)

| Layer | Where | Role in this app |
|---|---|---|
| Composition root | `src/main/index.ts` | Hand-wires every dependency; three boot modes (GUI, headless trigger worker, packaged-Linux relaunch) |
| Controller | `src/main/controller/` | One IPC controller module translating Electron IPC channels into business calls and pushing events back |
| Use case | `src/main/business/use-case/` | One settings use case orchestrating sanitize, persist, poll restart, and OS schedule sync |
| Component | `src/main/business/component/scheduling-strategy/` | OS scheduler strategies (systemd, launchd, Windows stub) behind one interface plus a factory |
| Service | `src/main/business/service/` (+ `usage-provider/` subgroup) | Domain behavior: polling, token resolution, trigger execution, session focus automation, updates |
| Repository | `src/main/business/repo/` | File-backed persistence in Electron `userData` (settings JSON, snapshot cache, JSONL run log) |
| Lib | `src/main/lib/` | Electron/environment wrappers with no domain logic (app window, dev desktop entry, dummy popup) |
| Util | `src/main/util/`, `src/renderer/src/util/` | Pure helpers: parsing, formatting, comparison, presentation math |
| UI component | `src/renderer/src/ui-component/` | React feature folders, component + CSS side by side |
| Client service | `src/renderer/src/business/service/` | Typed wrappers over `window.usageApi`, one per domain |
| Shared models | `src/shared/` | Types, enums, and constants consumed by all processes; the IPC contract |

## Notable structural observations

- **No DAL/database:** persistence is three file-backed repositories over `node:fs/promises`; there is no ORM layer.
- **Strategy groups as folders:** `usage-provider/` (provider adapters keyed by `ProviderId`, selected by `UsagePollService`) and `scheduling-strategy/` (OS schedulers selected by `SchedulingStrategyFactory`) follow the subfolder-per-interface convention.
- **Contract tests repo-wide:** 16 `*.contract.yaml` files across `src/` pin pure-function behavior; the Vitest `*.test.ts` files only supplement them where a contract runner cannot reach (async rejections, child-process choreography, filesystem fixtures).
- **Underscore privacy convention:** `_`-prefixed files are private test harnesses (`_sessions-service-contract-harness.ts`, `_linux-contract-harness.ts`); `_`-prefixed methods are private members of an exported object or class.
- **Two deliberate upward dependencies in main:** `SettingsRepo` imports `SettingsService` (the sanitizer is the single source of settings validity), and `TriggerRunnerService` defaults its dummy action to `lib/dummy-trigger-popup` (an injectable output adapter).
- **One renderer-only resident in shared:** `trigger-planner-model.ts` is pure logic consumed only by the renderer today; its shared placement is potential, not actual.
- **Renderer note:** a few inline SVGs are duplicated inside feature pages rather than promoted into `ui-component/icon/` (scheduling-page, ssh-hosts-dialog, provider-usage-card).
