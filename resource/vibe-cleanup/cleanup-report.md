# Cleanup Report — usage-pulse

Date: 2026-10-19 · Branch: `code-cleanup` · Audited against the `writing-clean-ts` conventions (8 parallel review passes over `src/main`, `src/renderer`, `src/shared`).

## Baseline (already clean)

- `pnpm lint` passes clean — loops, ternaries, relative imports, formatting, sorted keys are non-issues
- All 12 `singletonPattern` classes hold real memory (timers, caches, window handles, subscriptions) — zero unjustified singletons
- Zero `let` bindings, zero `for` loops, zero dead code, zero exported instances, zero barrel files
- Repo/DAL vocabulary conformant on both sides (business words in repos, `read`/`write` in DALs); common DAL bases absorb the shared mechanics
- `process.platform` confined to `os-util.ts`; config immutable after startup; enum file discipline (19 files) verified member-by-member
- IPC router has the sanctioned single `register()` shape; 25 of 26 inbound IPC channels validate through `validationUtil.parse` + zod; preload has zero string-literal channels

---

## Critical — fix first

### 1. Behavioral: `settings.save` can silently wipe user config

`src/main/controller/ipc/settings.ts:12`

The only inbound IPC channel without `validationUtil.parse`: it delegates to the repo's lenient `sanitize` (every field in `appSettingsSchema` has a `.catch()` fallback, arrays silently drop invalid entries, non-records return factory defaults) and then **saves** the result. A renderer regression sending `{}` or a partial settings object silently wipes all trackers/triggers/sshHosts and persists it.

Fix: parse `rawSettings` in the handler with a strict zod schema (required fields, no catch-fallbacks) via `validationUtil.parse`; keep the repo's lenient `sanitize` for disk reads only.

### 2. `process.env` outside config.ts

`src/main/util/raw-env-util.ts:1`

Raw env passthrough living outside `config.ts`. Sole importer: `src/main/business/service/sessions/claude-query-service.ts:6,38` (forwards env to the `claude` child process — sanctioned use case, wrong home).

Fix: add `export const processEnv = (): NodeJS.ProcessEnv => process.env` to `src/main/util/config.ts`, switch the importer, delete `raw-env-util.ts`.

### 3. 16 domain-logic `-util` files → `business/service/`

Each imports from `business/model`/`business/enum`, failing the domain-awareness test. Mechanical moves with `-service` renames.

**Renderer (`src/renderer/src/util/` → `src/renderer/src/business/service/`):**

- `menu-status-util.ts` (also fabricates a `UsageSnapshot` at :44)
- `zai-peak-util.ts`
- `usage-staleness-util.ts`
- `usage-severity-util.ts`
- `usage-activity-status-util.ts`
- `session-presentation-util.ts`
- `session-sound-util.ts` (also holds module-level mutable state — utils must be stateless)
- `session-finished-pulse-util.ts`
- `tracker-access-token-source-util.ts`
- `trigger-run-util.ts`
- `trigger-validation-util.ts`

**Main (`src/main/util/` → `src/main/business/service/`):**

- `update-check-error-util.ts`
- `update-asset-util.ts`

**Shared (`src/shared/util/` → `src/shared/business/service/`):**

- `session-status-transition-util.ts`
- `update-check-error-message-util.ts`
- `usage-severity-level-util.ts`

PASS (stay in util/): `date-util`, `day-time-ms-util`, `planner-dial-util`, `user-agent-util`, `usage-pace-util`, `usage-reset-util`, `usage-window-util`, `percent-util`, `object-util`, `id-util`, `http-util`, `version-compare-util`, `validation-util`, prefs utils, `constant`, `config`, `error-util` (see dedupe below).

### 4. Class/singleton structure

- `src/main/controller/mobile-server/http-request-handler.ts:15-148` — 8 module-scope helpers (`isAuthorized`, `buildStateResponse`, `writeJson`, `readJsonBody`, `parseBodyBySchema`, `handleTrackerRefresh`, `handleTrackerSetPaused`, `routeRequest`) next to a plain-object export → convert to `export class HttpRequestHandler` with `protected _` methods; call site `mobile-server-service-singleton.ts:146`
- `src/main/lib/app-event-bus-singleton.ts:22` ↔ `src/main/lib/event-bus.ts:7` — class/accessor split across two files, class imported by nothing else → merge into `app-event-bus-singleton.ts` as `export class _EventBus` with the accessor last, delete `event-bus.ts`

### 5. Enum/type violations

- `src/shared/business/model/mobile-api-model.ts:4` — `UsageWarningReason` enum declared inside a model file, keys≠values without the `Mapper` suffix → own file `src/shared/business/enum/usage-warning-reason-mapper-enum.ts`, export `UsageWarningReasonMapper` (importers: `mobile-api-schema.ts:6,72`, `mobile-derived-events-service-singleton.ts:8,142,185-191`)
- `src/shared/business/model/settings-model.ts:7,15,22` — `TrackerConfigBase` / `ClaudeTrackerConfig` / `ZaiTrackerConfig` are `interface`s with zero implementors (verified across every `implements` clause) → convert to `type` + intersections
- `src/renderer/src/ui-component/app-shell/app-footer.tsx:8` — `type UpdateDownloadState = 'downloaded' | 'downloading' | 'idle'` is a closed lifecycle set compared as literals 4× → `renderer/src/business/enum/update-download-state-mapper-enum.ts` exporting `UpdateDownloadStateMapper`
- `src/shared/business/model/mobile-api-model.ts:21-52` — the 7-member WS message discriminator set (`'state'`, `'usage-snapshot'`, `'sessions-snapshot'`, `'session-finished'`, `'session-waiting'`, `'usage-warning'`, `'heartbeat'`) is scattered as raw literals across the model, `z.literal()`s in `mobile-api-schema.ts:80-106`, and constructions in `mobile-server-service-singleton.ts:99-136` and `ws-broadcaster.ts:136` → introduce `MobileWsMessageTypeMapper` (`AppEventType` already enumerates a parallel set)

### 6. Boolean naming FAILs (all cheap)

**Inverted checks (`=== true` / `=== false` hide a truthy/falsy default):**

- `src/renderer/src/ui-component/app-shell/app-shell.tsx:241` — `settings?.isSchedulingEnabled === true` → guard `settings !== undefined`, read field directly
- `src/renderer/src/ui-component/app-shell/app-shell.tsx:247` — `settings?.isSessionsAutoRefreshPaused === false` → `settings !== undefined && !settings.isSessionsAutoRefreshPaused`
- `src/renderer/src/ui-component/app-shell/app-shell.tsx:253` — `settings?.isMobileServerEnabled === true` → same guard-then-read
- `src/renderer/src/ui-component/side-menu/side-menu.tsx:116` — `item.isLive === true` → `item.isLive ?? false`
- `src/renderer/src/ui-component/usage-dashboard/usage-dashboard.tsx:147` — `providerSnapshot.isRefreshing === true` → `?? false`
- `src/renderer/src/ui-component/usage-dashboard/provider-usage-card.tsx:55` — `peakInfo?.isPeakHour === true` → undefined-guard then read
- `src/renderer/src/util/menu-status-util.ts:103` — same `peakInfo?.isPeakHour === true` fix
- `src/renderer/src/util/menu-status-util.ts:121` — `hasLoadError === true || hasSnapshotError` → `hasLoadError || hasSnapshotError`

**Banned prefix:**

- `src/main/index.ts:42` — `shouldReexecWithoutSandbox` → `isReexecWithoutSandboxRequired` (1 call site at :72)

**Prefix not first on predicates (`resolveIs*` → `is*`):**

- `menu-status-util.ts:80` `resolveIsWindowWarning`; `session-finished-pulse-util.ts:39` `resolveIsPulsing`
- `app-shell.tsx:229,238,244` `resolveIsUsageLive`/`resolveIsSchedulingLive`/`resolveIsSessionsLive` (sibling `isMobileServerLive` at :250 already correct)
- `mac-launchd.ts:275,288` `_resolveIsLabelLoaded`/`_resolveIsPlistPresent`; `linux.ts:321,330,343,354` four `_resolveIs*`; `service-singleton.ts:273,281` `_resolveIsWaylandSession`/`_resolveIsFocusSupported`; `service-singleton.ts:360` `_resolveGhosttyTtySupport` (returns `Promise<boolean>`) → `isGhosttyTtySupported`

---

## Warnings — mechanical waves

### Wave A: 30 file renames (folder-name repetition; 1–4 importers each)

Reserved-name cases (file stem equals folder → `index`):

- `src/main/business/component/scheduling-strategy/scheduling-strategy.ts` → `index.ts` (exports `SchedulingStrategy`)
- `src/main/business/service/usage-provider/usage-provider.ts` → `index.ts` (exports `UsageProvider`)
- `ui-component/app-shell/app-shell.tsx` → `index.tsx`; `ui-component/side-menu/side-menu.tsx` → `index.tsx`; `ui-component/usage-dashboard/usage-dashboard.tsx` → `index.tsx`

Prefix-drop cases (`<folder>-x.tsx` → `x.tsx`, export unchanged):

| Folder (under `src/renderer/src/ui-component/`) | Renames |
|---|---|
| `about/` | `about-page.tsx` → `page.tsx` |
| `development/` | `development-page.tsx` → `page.tsx` |
| `provider/` | `provider-icon.tsx` → `icon.tsx` |
| `scheduling/` | `scheduling-page.tsx` → `page.tsx` |
| `tracker/` | `tracker-config-fields.tsx` → `config-fields.tsx`, `tracker-settings-dialog.tsx` → `settings-dialog.tsx` |
| `dashboard/` | `dashboard-empty-box.tsx` → `empty-box.tsx`, `dashboard-page.tsx` → `page.tsx`, `dashboard-session-box.tsx` → `session-box.tsx`, `dashboard-usage-box.tsx` → `usage-box.tsx` |
| `mobile/` | `mobile-connect-hint.tsx` → `connect-hint.tsx`, `mobile-device-card.tsx` → `device-card.tsx`, `mobile-device-list.tsx` → `device-list.tsx`, `mobile-page.tsx` → `page.tsx`, `mobile-pairing-token-field.tsx` → `pairing-token-field.tsx`, `mobile-server-port-field.tsx` → `server-port-field.tsx`, `mobile-server-toggle.tsx` → `server-toggle.tsx` |
| `sessions/` | `sessions-auto-refresh-button.tsx` → `auto-refresh-button.tsx`, `sessions-auto-refresh-status.tsx` → `auto-refresh-status.tsx`, `sessions-focus-support-footer.tsx` → `focus-support-footer.tsx`, `sessions-page.tsx` → `page.tsx`, `sessions-refresh-button.tsx` → `refresh-button.tsx`, `sessions-refresh-progress-bar.tsx` → `refresh-progress-bar.tsx`, `sessions-settings-button.tsx` → `settings-button.tsx`, `sessions-settings-dialog.tsx` → `settings-dialog.tsx` |

(`src/main/index.ts` and `src/preload/index.ts` are electron-vite entry points — exempt.)

### Wave B: ~35 export renames (subfolder export = folder + file)

- `sessions/session-*.tsx`: `SessionCard` → `SessionsSessionCard`, `SessionExpandButton`, `SessionFinishedPulse`, `SessionFocusButton`, `SessionOriginIcon`, `SessionSoundField`, `SessionTranscriptChips`, `SessionWaitingPulse`, `SshHostsButton`, `SshHostsDialog` — all gain the `Sessions` prefix
- `app-shell/app-footer.tsx` `AppFooter` → `AppShellAppFooter` (or rename file to `footer.tsx` → `AppShellFooter`)
- `usage-dashboard/`: `UsageBar` → `UsageDashboardUsageBar`, `UsageWindowBox`, `ProviderUsageCard`, `DashboardAddButton` → `UsageDashboardAddButton` (file also → `add-button.tsx`)
- `schedule/`: `DayTimeScheduleFields`/`DayTimeSelect` gain `Schedule` prefix
- `development/`: `SelectField`/`SliderField` gain `Development` prefix
- `scheduling/`: all 7 component exports gain `Scheduling` prefix
- `tracker/add-tracker-dialog.tsx` `AddTrackerDialog` → `TrackerAddTrackerDialog`
- `icon/*-icon.tsx` (10 files): formula yields `IconChevron` vs idiomatic `ChevronIcon` — see decision items
- Main-process type exports: `focus/ghostty-service.ts:87` `GhosttyFocusPeer` → `SessionsFocusGhosttyPeer`; in-file-only types (`ProcessEntry`, `AppBundleAncestry`, `SshHostFetchResult`) → unexport or prefix

### Wave C: object params (~27 sites)

**No first-line destructure (7 components + 1 callback):**

- `planner-dial.tsx:89-212` (20+ `props.x` reads), `session-sound-field.tsx:33-66` (9 reads), `trigger-planner-dialog.tsx:130,153`, `session-finished-pulse.tsx:23-24`, `session-origin-icon.tsx:7`, `session-waiting-pulse.tsx:4`, `mobile-server-service-singleton.ts:77` (`params.ws`)

**Positional params in business layers:**

- `sessions/parser-service.ts:46` `sortSessions(sessions: SessionInfo[])` → object param (callers: `service-singleton.ts:314`, `ssh-service-singleton.ts:86`)
- `usage-api-client.ts:38` + preload impl `saveSettings(settings)` → `(params: { settings })` (renderer wrapper already uses the object form); 5 subscription signatures `onX(listener)` → `(params: { onUpdate })`
- `preload/index.ts:139` `refreshTracker` forwards a bare value → forward `{ trackerId }`, use an object schema in `usage.ts`

**Defaults in destructure (→ signature defaults):**

- `const { size = DEFAULT_ICON_SIZE } = props` ×10 (9 icon components + `provider-icon.tsx:32`)
- `add-trigger-dialog.tsx:21` `initialPreset` default

**`params ?? {}` merges (→ signature defaults):**

- `usage-snapshot-dal.ts:13`, `trigger-run-log-dal.ts:34-38`, `settings-dal.ts:15`, `usage-snapshot-repo.ts:56`, `settings-model.ts:56`, `app-window.ts:13`

**Param mutation:**

- `trigger-command-service.ts:106` — `_captureChunk` pushes into the `chunks` array received via params → return the truncated chunk, let `run()` own accumulation

### Wave D: constants migration

**Duplication clusters:**

- `30_000` tick interval declared in 4 files (`app-shell.tsx:34`, `usage-window-box.tsx:10`, `dashboard-session-box.tsx:12`, `dashboard-usage-box.tsx:16`); `1000` variant in `usage-dashboard.tsx:12`, `sessions-page.tsx:23` → `constant.ui.*tickIntervalMs`
- `GHOSTTY_BUNDLE_ID` in `focus/ghostty-service.ts:5` + `ghostty-compat-service.ts:3` → `constant.sessions.focus.ghosttyBundleId`
- `MAX_ANCESTOR_HOPS = 12` in `process-service.ts:8` + `focus/linux-service.ts:13`
- `TRIGGER_DAY_LABELS` in `day-time-schedule-fields.tsx:8` + `scheduling-page.tsx:34`; `MAX_ELAPSED_MINUTES = 300` in `menu-status-util.ts:12` + `development-page.tsx:17`
- `DEFAULT_ICON_SIZE = 15` ×8 icon components (+ `18` in `provider-icon.tsx:7`) → `constant.icon.defaultSizePx`
- `ssh-service-singleton.ts:298` re-inlines `/^\d+$/` — `constant.digitsOnlyRegex` already exists
- Trigger-id regex `/^[A-Za-z0-9_-]+$/` duplicated in `linux.ts:133` + `mac-launchd.ts:100`

**Regexes outside constant.ts (7 literals):** systemd running-state prefix (`linux.ts:325`), model-date suffix + title-hyphen split (`session-presentation-util.ts:15,51`), whitespace collapse (`session-card.tsx:51`) → `Regex`-suffixed keys

**Scattered module constants → constant.ts:** sessions services timeouts/tunables (`claude-query-service.ts:10`, `osascript-service.ts:8`, `process-service.ts:10`, `ssh-service-singleton.ts:12-22`, `focus/linux-service.ts:9-15`, `focus/macos-service.ts:9,11`, `focus/vscode-service.ts:4-26`, `focus/ghostty-service.ts:5-58`, `service-singleton.ts:21`), `trigger-command-service.ts:9`, `mobile-derived-events-service-singleton.ts:14`, `sessions/parser-service.ts:6`, scheduling-strategy class-field data (`linux.ts:28-65`, `mac-launchd.ts:31-41`), renderer utils (`session-sound-util.ts:7-19`, `zai-peak-util.ts:4-8`, `usage-pace-util.ts:3-6`, prefs `STORAGE_KEY`s), renderer components (`development-page.tsx:16-45`, `app-shell.tsx:32-36`, `app-footer.tsx:16`, `about-page.tsx:12-13`, `day-time-select.tsx:8,12`, `planner-dial.tsx:12-18`, `trigger-planner-dialog.tsx:12-16`, `trigger-window-explainer.tsx:18-26`, `session-card.tsx:15`, `session-sound-field.tsx:6`, `mobile-pairing-token-field.tsx:3`, `add-trigger-dialog.tsx:14`), `trigger-planner-service.ts:4` (`FIRST_WINDOW_GAP_MS` → shared `planner` group)

**constant.ts structure:** `main/util/constant.ts:7` flat `sessionTranscriptCacheEntryLimit` → `sessionTranscript.cacheEntryLimit`; ungrouped `update*` (`:9-14`); renderer `plannerDial*` flat keys

**Time units:** `SSH_CONNECT_TIMEOUT_SECONDS`, `GHOSTTY_FRONT_WINDOW_POLL_DELAY_SECONDS`, `TONE_ATTACK_SECONDS`, `*_ELAPSED_MINUTES` family → `Ms` keys when relocated; `ssh-service-singleton.ts:305` inline `port < 1 || port > 65535` → `constant.tcpPort.{min,max}`

### Wave E: controller thinning

- `fetch() → withX() → save()` settings-mutation orchestration copy-pasted 4× (`ipc/scheduling.ts:19-21`, `ipc/trigger.ts:36-38`, `ipc/usage.ts:30-32`, `http-request-handler.ts:108-109`) → one service method per mutation; handlers become single-call
- `controller/ipc/router.ts:13` `export class IpcRouter` → `export const ipcRouter = { register() }`; life cycle calls `ipcRouter.register()`
- `ipc/trigger.ts:21,27` — controller news up `TriggerRunLogRepo` per call → route through a service
- `ipc/update.ts:19-27` — release-URL allowlist is a security decision in the handler → `openRelease()` method on the update service
- `http-request-handler.ts:26-31` vs `mobile-server-service-singleton.ts:94-104` — `{sessions, usage}` state shape assembled twice → one service method both surfaces consume

### Wave F: layer placement misc

- `dal/trigger-run-log-dal.ts:13-25,63-80` — DAL-side zod validation silently drops invalid log lines → DAL returns raw lines, schema + filtering move to `TriggerRunLogRepo`; `:70` hand-rolled `JSON.parse` → common base `_parseJsonContent`
- `lib/app-event-bus-singleton.ts:3-9` — imports `AppEventType` + 6 business models to type the message map → domain-typed wiring belongs in `business/`, generic `event-bus` stays in lib (pairs with critical #4)
- `error-util.ts` byte-identical in main + renderer (~30 importers combined) → one copy in `src/shared/util/error-util.ts`
- `usage-severity-util.ts:8-19` — hardcodes the same `70/85/95` thresholds as `constant.usageSeverityThresholds` → derive from the shared rule (silent drift risk)
- `app-boot/life-cycle/mobile-server-life-cycle.ts:10-88` — ~60 lines of settings-reactive restart/sync logic + state in the life cycle → move into `_MobileServerService`
- `src/main/index.ts:13-84` — entry resolves trigger-worker mode, sandbox reexec, dev entry install → thin mode dispatcher; startup work in life cycles
- **Graceful shutdown unwired:** `sessions-poll-life-cycle.ts:16` and `usage-poll-life-cycle.ts:15` never call `stop()` (timers fire during SIGINT/SIGTERM drain), `app-window-life-cycle.ts:26` never closes the window, `IpcRouter` has no `unregister()` — `RxjsBusLifeCycle` shows the intended pattern
- `controller/rxjs-bus/router.ts:5,20` — justified singleton in a non-`-singleton.ts` file with un-prefixed class → `rxjs-bus-router-singleton.ts` + `_RxjsBusRouter`
- `business/repo/usage-snapshot-repo.ts:55` — file path leaks through repo constructor (tests only) → DAL owns the default; `:19-50` inline zod schemas → `business/schema/usage-snapshot-schema.ts`
- `trigger-command-service.ts:24` — `spawnImpl` constructor injection → import `spawn`, mock the module in tests
- Pass-through wrappers: `session-sound-util.ts:74-80,92-99` → call `sessionStatusTransitionUtil` directly; identical localStorage prefs mechanics in 2 files → one generic util; identical percent-clamp zod helper in `usage-provider/claude.ts:31-35` + `zai.ts:11-17` → one shared schema

### Wave G: switch exhaustiveness (8 sites + 1 rename)

Silent defaults absorbing closed-enum members → explicit case + `typeUtil.exhaustiveError`:

- `session-presentation-util.ts:87` (`UNKNOWN` implicit), `dashboard-usage-box.tsx:33` (`OK` implicit), `tracker-access-token-source-util.ts:57` (`OS.WINDOWS` implicit), `app-window.ts:64` (`OS.MACOS` implicit), `ghostty-service.ts:126` (default aliases `'missing'`, hides script drift)

If-chains on closed enums → switches:

- `sessions-page.tsx:74-86` (4 `SessionStatusMapper` members via if), `app-shell.tsx:40-48` (`MenuStatusDotMapper`), `app-footer.tsx:25-37,48-64` (`UpdateDownloadState`)

Name coverage: `update-service-singleton.ts:51` `downloadUpdate()` also opens the installer (`shell.openPath` at :232) → rename `downloadUpdateAndOpenInstaller` or return the path

### Wave H: schema hygiene

- `mobile-api-schema.ts:118,123` — `mobileHealthResponseSchema`/`mobileStateResponseSchema` unbound duplicates of model types; health pair entirely unused → delete, or bind via `z.ZodType<...>` as `mobileWsMessageSchema` already does
- `settings-schema.ts:207` — `appSettingsSchema` keys hand-duplicated against `SettingsModel` → annotate `z.ZodType<SettingsData>` for full parity enforcement
- `session-model.ts:23` `kind: string` — permissive external CLI value, but `'background'`/`'interactive'` switched as literals in `session-card.tsx:29-38` → add `SessionKindMapper` or centralize labels

---

## Decision items (external constraints — decide before renaming)

1. **`ok: boolean`** in `mobile-api-model.ts:75` + `mobile-api-schema.ts:120` → `isOk` breaks the external mobile-client wire contract (version in lockstep or accept)
2. **`timestamp`** in `schedule-trigger-model.ts:41` → `startedAt`/`occurredAt` changes the persisted on-disk JSONL key (`trigger-run-log-dal.ts:21`) — needs a DAL mapping or acceptance; pipeline spans writer `trigger-runner-service.ts:223` and readers `trigger-run-util.ts:64,80`, `scheduling-page.tsx:475`; `trigger-run-util.ts:14` `startedAtTimestamp` → `startedAt`
3. **`icon/*-icon.tsx`** — the folder+file formula yields `IconChevron`; a documented `icon/` exception keeping `ChevronIcon` is the pragmatic alternative
4. **`sessions: SessionSnapshot | null`** (`mobile-api-model.ts:20,79`) — mirrors the JSON wire format where null vs absent is observable by mobile clients; keep `null` deliberately
5. **Timestamps as `*AtMs`** — `finishedAtMs`, `cycleStartedAtMs`, `hostStartedAtMs` vs the codebase-dominant bare `*At`; consistent either way, but pick one

---

## Recommended order

1. **Package 1 — safety:** criticals #1 + #2, plus `safeParse` variant in `validation-util.ts` (routes `ws-broadcaster.ts:166` through it) and the preload `refreshTracker` object payload
2. **Package 2 — cheap criticals:** boolean FAILs, interfaces→types, enum-in-model
3. **Package 3 — layer moves:** the 16 util→service moves + `error-util` dedupe + `usage-severity` threshold derivation
4. **Package 4 — structure:** http-request-handler class, event-bus merge, controller thinning, life-cycle cleanup, shutdown wiring
5. **Package 5 — mechanical waves:** A→H, each independently verifiable

Run `typecheck` + `lint` + `test:contract` between waves. Renames must propagate to every importer, identifier, and test (search both camelCase and kebab-case forms).

## Not assessed

Test file contents (contract harnesses, `*.test.ts` — only placement was checked), `out/`, `dist/`, `build/`, `scripts/`, and runtime behavior of renderer components. Two test files sit next to source instead of `__tests__/`: `scheduling-strategy/linux.test.ts`, `sessions/service-singleton.test.ts` (repo convention is mixed — `__tests__/` elsewhere).
