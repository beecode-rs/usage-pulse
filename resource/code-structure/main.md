# src/main

Part of the code-structure snapshot. See [README.md](README.md) for the commit this reflects.

The Electron main process of "Usage Pulse": tracks AI provider usage quotas (Claude, z.ai), lists local and SSH Claude Code agent sessions, and registers OS-level scheduled triggers. Layers present: `index.ts` (composition root), `controller/` (IPC adapter), `lib/` (Electron and environment integration), `business/use-case/` (application orchestration), `business/service/` (domain behavior), `business/service/usage-provider/` (provider strategy group), `business/component/scheduling-strategy/` (OS scheduling strategy group), `business/repo/` (file persistence), `util/` (pure helpers). 42 TypeScript files, all covered below; paths are relative to `src/main`.

## Root

### index.ts

**Exports:** none. Pure entry point.

The composition root and boot file. It has three boot modes chosen at startup: on packaged Linux it relaunches itself with `--no-sandbox`; if invoked with `--fire-trigger <id>` it becomes a headless trigger worker that constructs only `TriggerRunnerService` plus its two repos, runs the trigger, and exits with its exit code; otherwise it boots the full GUI app. The GUI path hand-wires every dependency with constructors (no DI container): repos for settings, usage snapshots and trigger run logs pointing at files in Electron's `userData` folder, then poll services, scheduling, session/transcript/SSH services, update service, settings use case, the browser window, and finally `ipcController.register`, followed by an initial update check and starting both poll services. It also owns app-level concerns: executable path and prefix args for scheduled registrations, and an error dialog on bootstrap failure.

**Why here:** it is the entry point, the only place allowed to know about every layer and to touch `electron.app` lifecycle.

## controller/

### controller/ipc-controller.ts

**Export:** `ipcController` (a single object with a `register` method).

The inbound transport adapter between renderer and main. `register` receives already-constructed services as an object parameter and wires about twenty `ipcMain.handle` / `ipcMain.on` channel handlers (from `IpcChannelMapper` in `src/shared`) onto them: platform, scheduling info and toggles, session list/focus/SSH test, settings get/save, trigger run logs and enable toggles, update status and release open, usage snapshot/refresh/pause. It does thin argument validation with `objectUtil.asRecord` and typeof guards, and on invalid input either no-ops, throws, or returns current settings. It also subscribes to the push streams (`pollService.onUpdate`, `sessionsPollService.onUpdate`, `settingsUseCase.onSave`, `updateService.onUpdate`) and forwards each event to the renderer window via `webContents.send`.

**Why in controller:** it contains zero domain logic; it exists to translate one delivery mechanism (Electron IPC) into calls on business objects and to push events back out. That is exactly the controller role.

## lib/

Electron and OS integration helpers: not domain logic, not pure utilities, they wrap `electron` APIs or the host environment.

### lib/app-window.ts

**Exports:** type `WindowVisibilityChangeListener`, const `appWindow` (object with public `create` and underscore-prefixed internal methods).

Factory for the application `BrowserWindow`: sets platform-specific window icons and a development dock icon, loads either the dev server URL or the packaged renderer `index.html`, forces external links into the system browser, and watches show/hide/restore/minimize to report visibility changes through the injected listener (which `index.ts` uses to pause and resume polling). Underscore methods (`_resolveWindowIconPath`, `_setDevelopmentDockIcon`, `_watchVisibility`) are private helpers of the same object.

**Why in lib:** it is a thin, stateless wrapper over Electron window infrastructure, reused by the entry point; it holds no business rules.

### lib/dev-desktop-entry.ts

**Export:** const `devDesktopEntry` (object with `install()`).

On unpackaged Linux only, writes a `usage-pulse-dev.desktop` file into `~/.local/share/applications` so the dev build appears in the desktop launcher; silently does nothing when packaged or on other platforms or when the write fails.

**Why in lib:** a desktop-environment integration hack for the development environment, pure infrastructure side effect with no domain meaning.

### lib/dummy-trigger-popup.ts

**Export:** const `dummyTriggerPopup` (object with `show`).

Shows a macOS dialog announcing that a dummy tracker was triggered; on any platform other than macOS it returns immediately. It is injected as the default `DummyTrackerAction` into `TriggerRunnerService`, so it is the concrete "action" executed when a dummy tracker's OS schedule fires.

**Why in lib despite being consumed by a service:** it is an Electron UI side effect (dialog, dock), i.e. an output adapter the business layer receives as an injectable function, not business logic itself.

## util/

Dependency-light helpers. None import Electron; the only impure ones are `http-util` (wraps `fetch`) and `os-util` (wraps `process.platform`). Everything else is pure parsing, formatting or comparison.

### util/error-util.ts

**Export:** const `errorUtil`.

One method, `resolveMessage`, that turns any thrown value into a readable string (`Error.message` or `String(value)`). Exists so error normalization is written once; used by nearly every service.

**Why in util:** generic, domain-free helper.

### util/http-util.ts

**Export:** const `httpUtil`.

`fetchJson` performs a GET with optional headers and a default 15 second `AbortController` timeout, throws a uniform "request to X failed" error on non-OK status or transport failure, and parses the body as JSON. Shared by both usage providers so timeout and error wrapping are consistent.

**Why in util:** a generic HTTP wrapper, provider-agnostic infrastructure helper.

### util/object-util.ts

**Export:** const `objectUtil`.

`asRecord` narrows an `unknown` value to a plain object record or undefined, rejecting null and arrays. It is the foundation of the defensive parsing style used across IPC handlers, repos, providers and utils.

**Why in util:** tiny type-guard helper with no domain knowledge.

### util/os-util.ts

**Exports:** const `osUtil`, and re-export of type `OsPlatform` (the type itself lives in `src/shared/os-model`).

`resolvePlatform` maps `process.platform` to the app's `OsPlatform` union (`macos`, `linux`, `windows`) and throws on anything else. Used everywhere platform behavior branches (scheduling strategy factory, session focus, token service, popup).

**Why in util:** one-line environment normalization used across all layers.

### util/percent-util.ts

**Export:** const `percentUtil`.

`clampPercent` bounds a number to 0..100 and `roundPercentToOneDecimal` rounds to one decimal. Used by both HTTP-backed usage providers to normalize quota percentages before display.

**Why in util:** pure numeric formatting shared by two providers.

### util/sessions-util.ts

**Export:** const `sessionsUtil` (public `parseSessionEntries` and `sortSessions`; everything underscore-prefixed is internal).

Parses the JSON stdout of the `claude agents --json` command into typed `ISessionInfo` entries: tolerant JSON extraction (falls back to slicing between the first `[` and last `]` when the output has noise), per-field sanitizing with defaults, and status normalization to busy/idle/waiting/unknown. `sortSessions` orders local sessions before SSH ones and then by name. All underscore methods are private parsing/sanitizing steps of the same object.

**Why in util:** stateless parsing of an external command's output format into shared model types; no I/O, no policy, reused by both the local and SSH session services.

### util/session-transcript-util.ts

**Export:** const `sessionTranscriptUtil` (public `parseTranscriptStats` and `hasTranscriptSignal`; internal underscore methods).

Reduces a Claude Code session transcript (JSONL) into `ISessionTranscriptStats`: accumulates input/output/cache/thinking token usage per assistant message (deduplicating by message id), counts user turns, and captures the AI title, last prompt, model, git branch, app version and last activity timestamp via a reduce over lines. `hasTranscriptSignal` decides whether the stats contain anything worth showing.

**Why in util:** pure text-to-data transformation of a file format, no filesystem access (the service does that), testable in isolation.

### util/version-compare-util.ts

**Export:** const `versionCompareUtil` (public `resolveIsNewerVersion`; internal underscore methods).

Compares semantic-ish version strings by stripping a leading `v`/`V`, cutting any pre-release suffix, splitting into numeric segments, and comparing segment by segment; malformed versions never count as newer. Used by `UpdateService` to decide if a GitHub release tag beats the running version.

**Why in util:** pure comparison logic, generic beyond this app's domain.

## business/repo/

File-backed persistence in Electron's `userData` directory. Each class owns one file, handles ENOENT and malformed content gracefully, and sanitizes what it reads. They are repositories in the sense of "persistence for a model", implemented directly over `node:fs/promises` (no ORM, no database).

### business/repo/settings-repo.ts

**Exports:** class `SettingsRepo`, type `SettingsSaveListener`.

Loads and saves the app settings JSON file. On load it returns defaults or sanitizes raw file content through `SettingsService`; on save it creates parent directories, pretty-prints, and notifies registered save listeners (this is the push channel that eventually becomes the renderer's settings update). Internal underscore methods handle read errors, ENOENT detection and JSON parse fallback.

**Why in repo:** it is persistence plus change notification only; the meaning of settings is defined by the service it delegates to. Worth noting: it depends on `SettingsService` (service layer) for defaults and sanitizing, so the repo layer leans on the domain sanitizer rather than duplicating it.

### business/repo/trigger-run-log-repo.ts

**Export:** class `TriggerRunLogRepo`.

Append-only JSONL log of trigger run events. `append` writes one entry per line and rotates the file when it exceeds a byte cap (keeping a configured tail of lines); `listByTriggerId` reads, filters and returns the most recent N entries for one trigger; `removeByTriggerId` rewrites the file without that trigger's lines. Tolerates missing files and unparsable lines. Rotation and read limits default to constants from `src/shared/trigger-model` and are overridable via constructor params.

**Why in repo:** pure file storage with retention policy; no decisions about when triggers run.

### business/repo/usage-snapshot-repo.ts

**Export:** class `UsageSnapshotRepo`.

Persists the last successful usage snapshot per tracker as a JSON map keyed by tracker id, so the GUI shows data immediately on restart. On load it deeply sanitizes every snapshot: tracker id, provider id validated against `PROVIDER_CATALOG`, finite `fetchedAt`, and per usage window label plus finite percent, with optional amounts, reset time and window length; invalid entries are dropped and status is always reset to OK. Underscore methods are the sanitizing pipeline.

**Why in repo:** it is a cache of provider responses on disk. It does validate shape (defensive deserialization) but contains no fetch or scheduling logic, which is what separates it from the service layer.

## business/service/

Domain behavior: polling loops, provider and OS dispatch, trigger execution, session focus automation, update checks. Classes here hold state (timers, caches, listeners) and make decisions; they depend on repos, utils and each other, and are the units the controller talks to.

### business/service/settings-service.ts

**Export:** class `SettingsService`.

The settings domain model as code: `createDefaultSettings` builds the default `IAppSettings`; `sanitizeSettings` coerces any raw object into a valid settings object, clamping numbers to configured min/max, validating sound ids, trigger days/times/timeouts, SSH hosts, and per-provider tracker configs, deduplicating ids, and migrating a legacy flat settings layout (single claude/zai token, old sound field names) into the current trackers array. It also exposes pure state transitions (`setSchedulingEnabled`, `setTrackerPaused`, `setTriggerEnabled`) that return new settings objects. Underscore methods are the per-field resolvers and migrations.

**Why in service:** this is the largest concentration of domain rules (what a valid setting is, how old settings migrate), deliberately separated from where settings are stored (repo) and from what happens after they change (use case).

### business/service/scheduling-service.ts

**Export:** class `SchedulingService` (its `ISchedulableRegistration` helper interface is file-local, not exported).

Platform-independent trigger scheduling logic on top of an injected `ISchedulingStrategy`. `getSchedulingInfo` reports support and platform; `inspectRegistrations` asks the strategy per trigger whether it is registered; `syncRegistrations` is the core: it reconciles what the OS actually has registered against what the current settings want (enabled triggers plus active dummy trackers), removing orphans, and upserting the rest only when a JSON fingerprint of days/times/executable/args changed since the last sync (fingerprints are kept in memory per registration id). Builds the `--fire-trigger <id>` executable args from the injected executable path and prefix args.

**Why in service:** it owns the domain policy of "which schedules should exist and when do they need rewriting"; the actual `systemctl`/`launchctl` mechanics live behind the strategy component it receives via constructor.

### business/service/usage-poll-service.ts

**Export:** class `UsagePollService`.

The usage data engine. Keeps one timer, generation counter and last snapshot per tracker; `start` hydrates persisted snapshots from the optional `UsageSnapshotRepo` and resumes unpaused trackers at their next due time (respecting window visibility, which pauses everything); `refreshTracker` polls one tracker with cancellation-by-generation so an in-flight stale poll cannot overwrite a newer one; `refreshNow` polls all unpaused trackers. `_pollTracker` resolves the access token (system keychain via `ClaudeSystemTokenService` when a Claude tracker uses the SYSTEM token source, otherwise the stored token), maps empty tokens to an UNCONFIGURED status, delegates fetching to the provider map, and converts provider errors into ERROR snapshots. Persists non-dummy OK snapshots, emits snapshots to listeners, and exposes `applyTrackerAutoRefresh` and `restart` for settings changes. Its `_createDefaultProviders` builds the `Record<ProviderId, IUsageProvider>` (claude, dummy, zai); a full set can be injected instead.

**Why in service:** this is core domain behavior: polling cadence, race control, token source resolution, status modeling and persistence orchestration. It is also the public selector of the usage-provider group (see below).

### business/service/sessions-poll-service.ts

**Export:** class `SessionsPollService`.

The session-list counterpart of the poll service, on a single global timer instead of per-tracker timers. On each refresh it fetches local sessions, remote SSH sessions and merges them via `SshSessionsService`, then enriches local sessions with transcript stats via `SessionTranscriptService`; errors become an error snapshot that retains the previous session list. Honors the pause flag and window visibility, avoids overlapping refreshes with an in-flight promise, reschedules after each refresh, and pushes snapshots to listeners. Constructor dependencies are optional and default to real service instances, so it is self-wiring in production and overridable in tests.

**Why in service:** owns the refresh lifecycle and the merge/enrich pipeline for the sessions feature, i.e. orchestration policy above the individual session services.

### business/service/sessions-service.ts

**Exports:** class `SessionsService`, interfaces `IAppBundleAncestry`, `IGhosttyFocusPeer`, type `IGhosttyFocusOutcome` (module-local constants and `IProcessEntry` are not exported).

Two responsibilities. Session listing: runs `claude agents --json` (with a PATH prefixed by `~/.local/bin`), deduplicates concurrent calls into one in-flight snapshot, and parses/sorts via `sessionsUtil`. Terminal focusing, which is the bulk of the file: on Linux it walks the process ancestry (bounded at 12 hops, via `ps`) to find an X11 window with `xdotool` and activates it, with distinct errors for Wayland, missing xdotool and dead pids, plus a `pkexec apt install xdotool` path behind `installFocusTool` and a once-per-run support check; on macOS it resolves the ancestor app bundle, then activates the app, and additionally targets the exact tab for Ghostty (AppleScript matching by terminal tty when supported, otherwise ranking same-cwd sessions by surface-host start time) or the exact window for VS Code (window titles matched against workspace name candidates from the cwd), translating automation permission denials into actionable messages; Windows is rejected.

**Why in service:** the listing half is domain behavior; the focusing half is OS automation policy (which terminal, which window, which permission hint), not a generic process wrapper, so the whole thing lives as one feature service.

### business/service/ssh-sessions-service.ts

**Exports:** class `SshSessionsService`, interface `ISshHostFetchResult` (`ISshTarget` and the cache entry interface are file-local).

Lists Claude agent sessions on remote hosts by shelling out over `ssh` with `BatchMode` and a short connect timeout, running `bash -lc 'claude agents --json'` remotely and parsing stdout with the shared `sessionsUtil`. Per host it keeps a 15 second result cache keyed by a host fingerprint, deduplicates concurrent fetches per host, prunes stale cache entries, and always resolves each host to a result object with either sessions or an error message (never throws per host). `mergeSessionSnapshots` tags remote sessions with host id/label, sorts local-before-remote, and builds the unreachable-hosts list; `testHost` validates an `ssh://user@host:port` style URL and probes connectivity with a `true` command. Underscore methods include the URL parser (scheme stripping, user, port validation) and ssh arg builder.

**Why in service:** it implements the remote half of the sessions domain (host config interpretation, caching, merge policy) while delegating output parsing to a util and transport to `ssh` itself.

### business/service/session-transcript-service.ts

**Export:** class `SessionTranscriptService` (its cache entry interface is file-local).

Enriches local sessions with transcript statistics read from `~/.claude/projects/<cwd-with-slashes-replaced>/<sessionId>.jsonl`. Skips SSH-hosted sessions, stats the file and serves a per-path cache when the mtime is unchanged (cache capped at 500 entries, cleared wholesale when full), otherwise reads and parses via `sessionTranscriptUtil` and drops results with no displayable signal. All failures degrade silently to "no transcript".

**Why in service:** it combines file location policy, caching and feature decision ("is this transcript worth showing") around a domain concept; the parsing itself is in util.

### business/service/claude-system-token-service.ts

**Export:** class `ClaudeSystemTokenService`.

Resolves the Claude access token from the local machine: on Linux reads `~/.claude/.credentials.json`; on macOS runs `security find-generic-password` for the "Claude Code-credentials" keychain entry; Windows is unsupported. Extracts and trims `claudeAiOauth.accessToken` from the parsed JSON, with distinct errors for unreadable source, invalid JSON, non-object, and missing or empty token. Home dir and platform are injectable for tests.

**Why in service:** it is domain behavior in the sense that "getting the Claude token" is a product capability (the SYSTEM token source of Claude trackers), with provider-specific credential knowledge; the OS access mechanics are details hidden behind `resolveAccessToken`.

### business/service/trigger-command-service.ts

**Exports:** class `TriggerCommandService`, interface `ITriggerCommandResult`.

Runs one user-configured trigger command as a detached process group in the login shell (`/bin/zsh -l -c` on macOS, `/bin/sh` elsewhere, cwd home). Enforces the trigger timeout by SIGTERM to the whole process group, escalating to SIGKILL after a grace period; captures stdout and stderr up to a max output length, and always resolves (never rejects) with duration, exit code (a dedicated timed-out exit code from shared constants), timed-out flag and combined output. `spawn` itself is injectable.

**Why in service:** process lifecycle policy (timeouts, kill escalation, output capture limits) is the execution semantics of the trigger feature, not a generic exec helper.

### business/service/trigger-runner-service.ts

**Exports:** class `TriggerRunnerService`, type `DummyTrackerAction`.

The worker that executes a fired trigger end to end. Given a trigger id it loads settings and dispatches: a command trigger runs through `TriggerCommandService`; a dummy tracker runs the injected `DummyTrackerAction` (defaulting to `dummyTriggerPopup.show` from lib); unknown ids produce a skipped entry. Before executing it applies guard skips: scheduling disabled, item disabled/paused, today not among the configured days (weekday to `TriggerDay` mapping), or the fire time more than a stale-skip threshold away from the nearest configured slot. It writes a "started" then "finished" (or "skipped") `ITriggerRunLogEntry` with a shared event id to the run log repo, tolerating log failures, and returns the process exit code so `index.ts` can exit with it. Clock and stale threshold are injectable.

**Why in service:** this is the heart of the trigger domain (skip rules, phases, logging semantics); repos store, lib pops the dialog, this decides what a run means.

### business/service/update-service.ts

**Export:** class `UpdateService` (its `ILatestRelease` interface is file-local).

Checks GitHub's latest release API for the app's repository (10 second timeout), compares the release tag against the injected current version with `versionCompareUtil`, and holds the resulting status: current version plus optionally latest version and release URL when an update exists. Failures keep the previous status silently. `getStatus` is polled by IPC; `onUpdate` pushes status changes to listeners. Raw response validation is done with `objectUtil`.

**Why in service:** it owns the update-check domain (release source, comparison decision, status model), wrapping generic HTTP and comparison utils into one product capability.

## business/service/usage-provider/ (strategy group)

A strategy group for usage data sources, one folder because all members implement one contract.

- **Shared contract:** `usage-provider.ts` declares `export interface IUsageProvider` with two members: `fetchUsage({ accessToken })` returning usage windows, and `getProviderId()` returning the provider id. That is the whole coupling point; the poll service never sees provider specifics.
- **Implementations:** `claude.ts` (`export class UsageProviderClaude implements IUsageProvider`), `zai.ts` (`export class UsageProviderZai implements IUsageProvider`), `dummy.ts` (`export class UsageProviderDummy implements IUsageProvider`). Each maps one vendor's API response into the shared `IUsageWindow` shape using `httpUtil`, `objectUtil` and `percentUtil`: Claude hits the Anthropic OAuth usage endpoint and requires the `five_hour` section with an optional weekly window; z.ai hits its quota-limit endpoint, matches limits by type/unit/number, builds the 5-hour and MCP quota windows (stamping amounts and a calendar-month window length); dummy returns nothing and never fails, standing in for demo/test trackers.
- **Private files:** none; there are no underscore-prefixed files in this group.
- **Public selector:** there is no factory file in this group. The selection API is `UsagePollService` in the parent folder: its `_createDefaultProviders` builds `Record<ProviderId, IUsageProvider>` keyed by provider id and `_pollTracker` looks a provider up by the tracker's `providerId`. So the interface plus the parent service's record dispatch together form the extension point for adding a provider.
- **Why a subfolder:** it groups interchangeable implementations of one interface under the contract file, exactly mirroring the writing-clean-ts subfolder-per-interface convention, and keeps vendor adapters out of the poll service.

## business/use-case/

### business/use-case/settings-use-case.ts

**Export:** class `SettingsUseCase`.

The application-level operations around settings, composing five collaborators injected as constructor params (two repos/services it only stores, plus the poll, sessions-poll and scheduling services). `initializeSettings` loads, normalizes, rewrites and syncs OS registrations at boot; `saveSettings` sanitizes raw renderer input then persists and fans out: restart both poll services and sync OS schedules; `setSchedulingEnabled`, `setTriggerEnabled` and `setTrackerPaused` each load, apply the pure `SettingsService` transition, persist, and trigger exactly the side effects that setting implies (schedule sync, or per-tracker auto-refresh apply, best-effort where failure should not block). `onSave` forwards the repo's save listener registration.

**Why in use-case rather than service:** it contains no domain rules of its own (sanitizing lives in `SettingsService`, persistence in the repo, scheduling policy in `SchedulingService`); its job is transaction-like orchestration across them for a user intent, which is the use-case role. The controller calls only this class for all settings mutations.

## business/component/scheduling-strategy/ (strategy group)

A strategy group for OS-specific schedule registration, one folder because all members implement one contract and are chosen by one factory.

- **Shared contract:** `scheduling-strategy.ts` declares `export interface ISchedulingStrategy` (platform name, `isSupported` flag, `listRegistrationIds`, `inspectRegistration`, `upsertRegistration`, `removeRegistration`) plus the parameter shape `export interface ISchedulingRegistrationParams` and result shape `export interface ISchedulingInspection`. Consumers depend only on this.
- **Implementations:** `linux.ts` (`export class SchedulingStrategyLinux implements ISchedulingStrategy`) manages systemd user timers: probes whether a systemd user session exists (exit status or "running/degraded/..." stdout; binary absence means unsupported), writes `.service` and `.timer` unit files into the user unit dir (quoting ExecStart args for systemd, translating trigger days/times into `OnCalendar` values, `Persistent=true`), and enables/restarts via `systemctl --user`, with a disable/reset-failed/remove/reload removal sequence. `mac-launchd.ts` (`export class SchedulingStrategyMacLaunchd implements ISchedulingStrategy`) does the same for launchd agents: writes a plist with `StartCalendarInterval` entries into `~/Library/LaunchAgents` under the `com.usage-pulse.trigger.` label prefix, and bootstraps/bootouts via `launchctl` in the `gui/<uid>` domain. `windows.ts` (`export class SchedulingStrategyWindows implements ISchedulingStrategy`) is an explicit stub: `isSupported = false` and every operation rejects with "OS scheduling is not implemented on Windows yet", which lets the rest of the app treat Windows uniformly.
- **Private files:** `_linux-contract-harness.ts`, exporting `export class SchedulingStrategyLinuxContractHarness` (extends `SchedulingStrategyLinux`). Underscore-prefixed test support: it neutralizes the macOS/Linux platform assertion so the Linux strategy can be exercised from any dev machine, and exposes the constructor-resolved internals (home dir, unit dir, supported flag) for assertions.
- **Public selector:** `factory.ts`, exporting `export class SchedulingStrategyFactory`. Its `resolve({ platform? })` maps `OsPlatform` to the matching strategy instance (throwing on an unknown platform) and is the only way production code obtains one; `index.ts` calls it once and hands the result to `SchedulingService`.
- **Test file:** `linux.test.ts` (exports: none), supplementing `linux.contract.yaml` with the same fake-`systemctl`-on-PATH technique as the sessions tests. It verifies: registered detection when both the timer unit file exists and `systemctl is-active` succeeds; the availability probe matrix (exit zero, degraded-but-alive, not-booted junk output rejected, binary missing means unsupported); and the exact upsert choreography (write both unit files with the expected `OnCalendar` and `ExecStart` content, then daemon-reload, enable, restart) and removal choreography (disable-now, reset-failed, delete both unit files, reload; and the variant that skips disabling when the timer file is absent).
- **Why in `business/component` rather than service:** the OS schedulers are self-contained pluggable components behind one interface, selected by a factory and consumed by `SchedulingService` (the service keeps the "when to rewrite what" policy while the component owns "how to talk to this OS"). The folder groups contract, implementations, factory and test harness for that one abstraction.

## Test and harness files in business/service/

Tests here are "contract supplements" to sibling `*.contract.yaml` files: the YAML contracts cover synchronous behavior, and these Vitest files cover what a contract runner cannot express (async rejections, real child-process choreography, filesystem fixtures). Both follow the project's convention of living next to the code they verify.

### business/service/claude-system-token-service.test.ts

**Exports:** none.

Supplements `claude-system-token-service.contract.yaml`. Verifies, using a temp-home fixture with a real `.claude/.credentials.json` file: the Linux happy path returning the trimmed `claudeAiOauth.accessToken` while ignoring `mcpOAuth`; and the async rejections for missing credentials file, missing/empty access token, malformed JSON, JSON null, unsupported Windows platform, and (skipped on macOS) the wrapped keychain failure when the `security` binary is unavailable.

### business/service/sessions-service.test.ts

**Exports:** none.

Supplements `sessions-service.contract.yaml` for the focus feature. Uses shell-script stub binaries for `xdotool`, `ps` and `osascript` prepended to `PATH` (driven by environment variables, logging exact argv) plus the harness below to verify: the Linux ancestor walk and exact `windowactivate` invocation including the visible-first and unfiltered fallback searches; the 12-hop walk limit; window-not-found, Wayland and missing-xdotool rejections; Windows rejection; macOS routing for Ghostty (tab focus by cwd rank, tty-exact focus when supported, fallback rank after tty miss, bundle activation only when nothing matched, other-desktop rejection on the hidden outcome, VS Code-hosted peer exclusion) and VS Code (raise by workspace-name match, skip when no match); and the focus-support flow (single xdotool check per run, missing-tool status, install then refresh, wrapped install failure).

### business/service/_sessions-service-contract-harness.ts

**Export:** class `SessionsServiceContractHarness` (extends `SessionsService`).

The underscore prefix marks it as private test support, not production API. It is a test double that subclasses the real service and overrides the process-touching seams (`_resolveFocusPlatform`, `_activateAppBundle`, `_runAgentsQuery`, Ghostty tty/peer/tab/tty-support overrides, `_focusVsCodeWindow`, `_installLinuxFocusTool`, `_isLinuxFocusToolInstalled`, `_resolveAppBundlePath`) with recording fields and configurable outcomes, while still delegating to the real implementation when a "stubbed" flag is turned off, so tests exercise the real decision logic with the OS calls shimmed.

## Cross-layer observations

- **Hand-wired composition:** `index.ts` is the only composition root; `UsagePollService` and `SessionsPollService` additionally default their own dependencies in their constructors, so they work both self-wired and injected.
- **Two deliberate upward dependencies:** `SettingsRepo` (repo) imports `SettingsService` (service) for defaults and sanitizing, and `TriggerRunnerService` (service) defaults its dummy action to `lib/dummy-trigger-popup`. Both are explicit couplings rather than accidents: the sanitizer is the single source of settings validity, and the popup is an injectable output adapter.
- **Naming conventions:** underscore prefixes mark private members inside exported objects/classes (`appWindow._watchVisibility`, `sessionsUtil._sanitizeSessions`) and private test-support files (`_sessions-service-contract-harness.ts`, `_linux-contract-harness.ts`).
- **Test coverage:** no tests exist for the repos, `SchedulingService`, `TriggerRunnerService`, `UsagePollService`, `SessionsPollService`, `SettingsService`, `SettingsUseCase`, or any util; the three test files plus two harnesses cover only the OS-touching seams (Claude token, session focus, Linux systemd strategy).
