# src/shared

Part of the code-structure snapshot. See [README.md](README.md) for the commit this reflects.

The shared layer of the Electron app: the single source of truth for everything that crosses the IPC boundary between the main process and the renderer. The folder is flat (no subfolders, no barrel file), kebab-case filenames, and holds 9 TypeScript modules plus 3 executable contract YAML files. Eight of the nine TS files are pure data contracts (types, enums, constants, no logic); only trigger-planner-model.ts contains runtime code (four pure functions).

Internally, usage-model.ts is the hub: it imports from all four other model files, and both provider-catalog.ts and trigger-planner-model.ts depend on it.

## ipc-channel.ts

**Exports:** enum `IpcChannelMapper` (its only export, with 25 string members).

The canonical registry of IPC channel names, one enum member per request/response channel, with kebab-case string values namespaced by domain: `os:get-platform`; scheduling (get-info, set-enabled); sessions (focus, get-focus-support, get-snapshot, install-focus-tool, list, test-ssh-host, update); settings (get, save, update); trigger (clear-run-logs, get-run-logs, os-inspect, set-enabled); update (get-status, open-release, status); usage (get-snapshot, refresh, refresh-tracker, set-tracker-paused, update). It models the full request surface of the app as a flat dispatch table.

**Why shared:** imported by exactly two files: src/main/controller/ipc-controller.ts, which registers the handlers, and src/preload/index.ts, which invokes them when building the bridge. Main and preload must agree byte-for-byte on the channel strings, so the names live here. The renderer never imports it; it talks through the typed `window.usageApi` bridge instead.

## os-model.ts

**Exports:** type `OsPlatform` (a one-line union of the string literals linux, macos, windows).

The minimal vocabulary for the host operating system. It models the platform as a closed set of three literals rather than Node's process.platform strings, so the rest of the code can switch on it exhaustively.

**Why shared:** the platform value originates in main (src/main/util/os-util.ts) and crosses IPC to the renderer, which uses it in 6 files (os-client-service, scheduling-page, and the three tracker dialogs/util). It is also reused by two sibling shared modules (trigger-model.ts embeds it in `ISchedulingInfo`; usage-model.ts uses it in `IUsageApiClient.getPlatform`), and preload re-exports the type as part of the bridge surface.

## provider-catalog.ts

**Exports:** interface `IProviderCatalogEntry` and const `PROVIDER_CATALOG` (an array of three entries).

Static metadata about the usage providers the app supports. Each entry has an id, a display name, a human-readable description, and a default refresh interval in seconds; the catalog currently contains Claude (900 s), z.ai (900 s), and Dummy, a dev-only test tracker that fires a native popup on schedule (3600 s). It models the "which providers exist and how should a new tracker for one behave by default" domain concept.

**Why shared:** consumed by both sides: main uses it in settings-service and usage-snapshot-repo (validation, defaults, snapshot assembly), while the renderer uses it in 3 files (add-tracker-dialog, tracker-config-fields, provider-catalog-util) to render the provider picker and per-provider form fields. It imports `ProviderId` from usage-model.ts, keeping the id vocabulary defined in exactly one place.

## session-model.ts

**Exports:** types `SessionFocusSupportStatus`, `SessionStatus`, `SessionsUpdateListener`; interfaces `ISessionTranscriptStats`, `ISessionInfo`, `IUnreachableHost`, `ISessionFocusSupport`, `ISessionSnapshot`.

The domain model for Claude Code sessions discovered on the local machine or over SSH. `ISessionInfo` describes one running session (working directory, pid, session id, name, kind, start time, an optional SSH host id/label, and a `SessionStatus` of busy, idle, unknown, or waiting) with an optional `ISessionTranscriptStats` payload carrying parsed transcript data: AI-generated title, model and CLI version, git branch, last prompt, user turn count, last activity timestamp, and six token counters (input, output, thinking, two cache kinds, optional context size). `ISessionSnapshot` wraps a list of sessions plus a fetch timestamp, an optional error message, and a list of `IUnreachableHost` entries (host id, label, error) for SSH hosts that could not be polled. `ISessionFocusSupport` reports whether the OS-level focus tool is ready or missing-tool, and `SessionsUpdateListener` is the push-callback shape for live snapshot updates.

**Why shared:** the heaviest module by importer count (about 20 files): main builds these shapes in 6 files (sessions-service, ssh-sessions-service, session-transcript-service, sessions-poll-service, plus two utils and the IPC controller), preload forwards them, and the renderer consumes them in 12 files (dashboard, sessions page, session cards, sound and pulse utils). It is also re-used by usage-model.ts for the bridge method signatures.

## settings-model.ts

**Exports:** enums `ClaudeTokenSource` (MANUAL, SYSTEM) and `SessionSoundId` (BEEP, CHIME, DING, FANFARE, NONE, PING, SUCCESS); interfaces `ITrackerConfigBase`, `IClaudeTrackerConfig`, `IDummyTrackerConfig`, `IZaiTrackerConfig`, `ISshHostConfig`, `IAppSettings`; type `ITrackerConfig` (a discriminated union of the three tracker configs); consts `LEGACY_CLAUDE_TOKEN_SOURCE_SYSTEM`, `SESSION_SOUND_IDS`, seven `DEFAULT_*` constants (session-finished sound and pulse seconds, waiting sound, scheduling enabled, sessions auto-refresh paused, sessions refresh interval, sound volume), six `MIN_/MAX_` bound pairs for sessions refresh interval, session-finished pulse seconds, sound volume percent, and tracker refresh interval (in both seconds and minutes).

The persisted application settings model. `IAppSettings` is the root: scheduling flag, sessions auto-refresh flag and interval, session-finished pulse duration and sound, waiting sound, volume percent, SSH host list, and three collections: trackers (the discriminated union, where the literal `providerId` tag selects a Claude tracker with a token-source enum, a Dummy tracker with its own day/time schedule, or a z.ai tracker with no extras; all share the base shape of id, name, access token, refresh interval, and pause flag), triggers, and SSH hosts. The bound and default constants are the single source of truth used by both main-side validation and renderer-side form constraints, and the legacy constant supports migrating old persisted token-source values.

**Why shared:** the most widely imported module (about 27 files): main persists and validates it in 9 files (settings-repo, settings-service, settings-use-case, scheduling, poll, trigger-runner and SSH services, IPC controller); preload passes it through; the renderer renders and edits it in 16 files (every settings/tracker/scheduling dialog, the app shell, and sound/token-source utils). usage-model.ts also imports `IAppSettings` for the settings bridge methods.

## trigger-model.ts

**Exports:** type `TriggerDay`; interfaces `ITriggerConfig`, `ITriggerPreset`, `ISchedulingInfo`, `ITriggerRegistrationHealth`, `ITriggerRunLogEntry`; types `TriggerRunPhase`, `TriggerRunSkipReason`, `TriggerRunSource`; consts `TRIGGER_DAYS`, `TRIGGER_TIME_PATTERN` (an HH:MM 24-hour regex), `DEFAULT_/MIN_/MAX_TRIGGER_TIMEOUT_MS` plus their minute conversions, `MAX_WINDOW_TRIGGER_PRESET`, `DEFAULT_TRIGGER_STALE_SKIP_MINUTES`, `TRIGGER_RUN_EXIT_CODE_TIMED_OUT`, and five `TRIGGER_RUN_LOG_*` constants (read limit, rotate keep count, rotate max bytes, snippet max length).

The OS-scheduler domain. `ITriggerConfig` models a user command scheduled on specific weekdays at specific HH:MM times, with an enabled flag, a timeout (bounded between one minute and one hour, default five), and creation metadata. `MAX_WINDOW_TRIGGER_PRESET` is the canonical weekday preset (07:00, 12:02, 17:05) that the planner dialog reproduces. `ISchedulingInfo` reports whether OS scheduling is supported on the current platform, `ITriggerRegistrationHealth` reports per-trigger registration state, and `ITriggerRunLogEntry` is one audit record of a trigger execution: event id, timestamp, trigger identity and source (manual or os-schedule), phase (started, finished, skipped), skip reason (disabled, not-found, not-scheduled-day, stale), slot, exit code (with 124 reserved as the timeout code), duration, and a truncated output snippet. The log constants define rotation and read limits for that audit trail.

**Why shared:** consumed by about 23 files: main implements scheduling in 9 (three platform strategies under scheduling-strategy, trigger-run-log-repo, scheduling/trigger-command/trigger-runner/settings services, IPC controller); preload forwards; the renderer consumes it in 11 files (the whole scheduling UI family, plus run-log and validation utils). Both settings-model.ts and usage-model.ts import from it.

## trigger-planner-model.ts

**Exports:** consts `DEFAULT_FIRST_TRIGGER_MINUTES`, `DEFAULT_LUNCH_START_MINUTES`, `DEFAULT_WORK_DURATION_MINUTES`, `DEFAULT_WORK_START_MINUTES`, `LUNCH_DURATION_MINUTES`, `PLANNER_DAY_MINUTES`, `WINDOW_DURATION_MINUTES`; interface `IPlannerWindow`; functions `formatDayMinutes`, `resolvePlannerWindows`, `resolveTriggerTimes`, `resolveCoverageHint`. (A fifth constant, `FIRST_WINDOW_GAP_MINUTES`, is module-private, not exported.)

The only shared module with runtime logic: pure functions that compute when Claude's rolling five-hour usage windows should be sampled during a workday. `IPlannerWindow` models one window as numeric start/end minutes-of-day plus a formatted HH:MM start time. `resolvePlannerWindows` recursively lays out consecutive 300-minute windows starting at the first trigger minute, where each successive start is offset by 302, then 303, then 304 minutes and so on (a slowly drifting cadence), stopping at the work end; `formatDayMinutes` wraps minutes-of-day modulo 1440 into HH:MM; `resolveTriggerTimes` maps windows to their start-time strings; `resolveCoverageHint` returns a human-readable nudge string (or undefined when coverage is good) if the first window starts at or after work start or the last window ends at or before work end. The workday defaults model a 600 to 1080 work span (10:00 to 18:00) with a lunch break at 13:00.

**Why shared:** positioned in shared but currently consumed only by the renderer (3 files: day-time-select, trigger-planner-dialog, trigger-window-explainer), plus its behavior pinned by the three contract YAMLs in this folder. It imports `FIVE_HOUR_WINDOW_MS` from usage-model.ts so the window math stays tied to the usage domain constant. This is the one file whose "shared" placement is only potential (main does not use it today).

## update-model.ts

**Exports:** interface `IUpdateStatus` and type `UpdateStatusListener` (the entire file is 8 lines).

The app self-update contract. `IUpdateStatus` models the current installed version, whether an update is available, and optional latest version and release URL; the listener type is the push-callback shape for status changes.

**Why shared:** small but genuinely cross-process: main produces it in update-service and dispatches it via ipc-controller, preload forwards it, and the renderer consumes it in update-client-service and app-footer (which shows update status in the footer). usage-model.ts imports it for the `getUpdateStatus` and `onUpdateStatus` bridge members.

## usage-model.ts

**Exports:** type `ProviderId` (claude, dummy, zai); consts `FIVE_HOUR_WINDOW_MS` and `SEVEN_DAY_WINDOW_MS`; enum `UsageStatus` (ERROR, OK, PENDING, UNCONFIGURED); interfaces `IUsageWindow`, `IProviderSnapshot`, `IUsageSnapshot`, `IUsageApiClient`; types `UsageUpdateListener` and `SettingsUpdateListener`.

Two things in one file. First, the usage-domain model: `IUsageWindow` is one metered window (label, used percent, optional used/total amounts, reset time, and window length), `IProviderSnapshot` is one tracker's state (provider id, tracker id and name, status enum, fetched/next-refresh timestamps, optional error, and its usage windows), and `IUsageSnapshot` is the aggregate list; the window constants encode Claude's rolling five-hour and seven-day quota periods. Second, and most importantly, `IUsageApiClient`: the complete typed API surface of the app (25 methods) covering platform, sessions (snapshot, list, focus, focus-support, install focus tool, SSH host test), settings (get, save, scheduling and trigger and tracker toggles), usage (snapshot, refresh, per-tracker refresh, pause), triggers (run logs, clear, OS inspection), and updates (status, open release), plus four push-subscription methods returning unsubscribe functions. The listener types for settings and usage updates are also declared here so the whole bridge can be typed without circular imports.

**Why shared:** this is the linchpin of the whole layer, imported by about 27 files. src/preload/index.ts builds a concrete object of this interface type and exposes it on the window as `usageApi` via contextBridge; src/renderer/src/env.d.ts declares `window.usageApi` as `IUsageApiClient`, which is how every renderer service gets fully typed IPC without importing any Electron API. Main implements each method in the providers (claude, dummy, zai), poll service, snapshot repo, settings service, and IPC controller. The renderer consumes the types in 16 files (dashboard, usage dashboard, provider icon, tracker dialogs, and status/reset/peak utils).

## Contract test fixtures (YAML)

### resolve-coverage-hint.contract.yaml

Not TypeScript; no exports. An executable contract-test fixture for the `resolveCoverageHint` function, written in the term format of the `@beecode/msh-test-contractor` tooling and executed by vitest.config.contract.ts (whose include pattern covers every `src/**/*.contract.yaml` in the repo). It pins input parameter objects to expected results, including explicit undefined results for good posture (first window strictly before work start and last strictly after work end) and for the strictness boundary one minute inside each edge, plus the exact advisory strings expected when the first window is too late, the last is too early, or both miss the workday edges.

**Why in shared:** it is the behavioral specification of a function defined in trigger-planner-model.ts, kept next to its subject; the vitest contract plugin, not application code, consumes it.

### resolve-planner-windows.contract.yaml

Same kind of executable contract fixture, for `resolvePlannerWindows`. Its terms pin the preset equivalence (first trigger 07:00 with work end 18:00 reproduces exactly the times of `MAX_WINDOW_TRIGGER_PRESET`), the gap cadence (consecutive window starts grow by +302, +303, +304, +305 minutes), and the start clamping at the work end and at the 1440-minute day boundary.

**Why in shared:** behavior spec for the planner function in this folder, run by the contract vitest project rather than imported by app code.

### resolve-trigger-times.contract.yaml

Same kind of executable contract fixture, for `resolveTriggerTimes`, with zero/one/many terms: an empty window list maps to an empty time list, a single window maps to its own start time, and the preset windows map in order to the three preset times.

**Why in shared:** same rationale: an executable spec sitting beside the pure functions it verifies.

## Boundary observations

- True IPC contracts: ipc-channel.ts, usage-model.ts (via `IUsageApiClient`), session-model.ts, settings-model.ts, trigger-model.ts, update-model.ts, and os-model.ts are all genuinely consumed by main, preload, and renderer; preload/index.ts and env.d.ts are the hinge points.
- Renderer-only resident: trigger-planner-model.ts is pure logic used only by renderer UI today; its presence in shared (and its three contract YAMLs) suggests it is intended as a cross-process-neutral algorithm module, but nothing in main imports it.
- Contract YAML convention is repo-wide: 16 `.contract.yaml` files exist across src/main, src/renderer, and src/shared, all run by the same vitest contract config; the three here are the only ones paired with shared code.
