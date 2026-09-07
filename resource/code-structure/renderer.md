# src/renderer

Part of the code-structure snapshot. See [README.md](README.md) for the commit this reflects.

The renderer is the React side of the Electron app "Usage Pulse", a desktop tracker for Claude and z.ai coding-plan usage. Layout follows the writing-clean-ts conventions: `main.tsx` entry, `business/service/` for main-process bridge wrappers, `util/` for pure helpers, `ui-component/<feature>/` for React components co-located with their CSS.

## Entry files

### src/main.tsx

**Exports:** none (entry point).

Mounts the React root: finds the `#root` DOM element (throws if missing) and renders the `AppShell` component inside `StrictMode` via `createRoot`. It contains no logic beyond bootstrapping, which is why it sits alone at the top of `src/` rather than in any feature folder.

### src/env.d.ts

**Exports:** none (ambient type declarations).

Two jobs: pulls in the Vite client types, and augments the global `Window` interface with a `usageApi: IUsageApiClient` property. This is the typing for the preload bridge the client services call; it is what makes `window.usageApi` type-safe across the renderer.

## business/service/ (IPC client services)

**Why this layer exists:** every file here is a thin, typed wrapper object over `window.usageApi`, the preload-exposed bridge to the Electron main process. Components never touch `window.usageApi` directly; they call these services. Grouping is by domain, not by component.

### os-client-service.ts

**Export:** `osClientService`.

Wraps `getPlatform`, returning the OS platform (used by tracker dialogs to adapt Claude token-source options).

### scheduling-client-service.ts

**Export:** `schedulingClientService`.

Wraps `clearTriggerRunLogs`, `getSchedulingInfo`, `getTriggerRunLogs`, `inspectTriggerRegistrations`, `setSchedulingEnabled`, `setTriggerEnabled`.

### sessions-client-service.ts

**Export:** `sessionsClientService`.

Wraps `focusSession`, `getSessionFocusSupport`, `getSessionsSnapshot` (cache read), `installSessionFocusTool`, `listSessions` (fresh poll), `resolveSessionsSnapshot` (the only composed method: returns the cached snapshot if present, otherwise forces a poll), `subscribeToSessionsUpdates` (push subscription), `testSshHost`.

### update-client-service.ts

**Export:** `updateClientService`.

Wraps `getStatus` (current + latest version, update-available flag), `openRelease` (opens the release page), `subscribeToUpdateStatus` (push subscription).

### usage-client-service.ts

**Export:** `usageClientService`.

Wraps `getSettings`, `getSnapshot`, `refreshNow`, `refreshTracker` (per-tracker refresh), `saveSettings`, `setTrackerPaused`, `subscribeToSettingsUpdates`, `subscribeToUsageUpdates`.

**Layer note:** all methods delegate one-to-one to bridge calls except `sessionsClientService.resolveSessionsSnapshot`, which composes two bridge calls. Settings writes go through `usageClientService.saveSettings` even for scheduling and SSH host changes; the scheduling service is reserved for scheduler registration state and run logs.

## util/ (generic, non-component helpers)

**Why this layer:** pure TypeScript object namespaces with no React and no rendering. They hold presentation math, formatting, persistence of small UI preferences, validation, and one browser-audio concern. None of them know about main-process IPC except through shared models.

### date-util.ts

**Export:** `dateUtil`.

Locale clock time, `YYYY-MM-DD HH:mm:ss` timestamps, coarse durations (`2h 15m`, `under 1m`), hour:minute formatting, and precise durations with seconds.

### development-prefs-util.ts

**Export:** `developmentPrefsUtil`.

Loads and saves the hidden Development-tab unlock flag in `localStorage` under the key `development.is-unlocked`.

### error-util.ts

**Export:** `errorUtil`.

`resolveMessage` turns an unknown thrown value into a display string (Error message or String coercion).

### menu-status-util.ts

**Exports:** `menuStatusUtil`, type `MenuStatusDot`, const `MONTH_WINDOW_MS`.

Derives the sidebar status dots (`error`, `peak`, `waiting`, `warning`) from usage and session snapshots, combines dots by severity priority, resolves pace-based window warnings (delegating to `usagePaceUtil`), and synthesizes a fake z.ai snapshot for the Development tab dot. `MONTH_WINDOW_MS` is a 30-day constant also used by the Development preview.

### minutes-time-util.ts

**Export:** `minutesTimeUtil`.

Parses an `HH:mm` string into minutes-of-day; used by the schedule selects and the window explainer diagram.

### planner-dial-util.ts

**Exports:** `plannerDialUtil`, `DIAL_ANGLE_RANGE_DEGREES` (270), `DIAL_START_ANGLE_DEGREES` (135).

All geometry and math for the rotary planner dial: pointer-angle to stepped value, keyboard arrow/Home/End handling, clamping, and value-to-angle mapping.

### provider-catalog-util.ts

**Export:** `providerCatalogUtil`.

Filters the shared provider catalog, hiding the dev-only `dummy` provider unless the Development tab is unlocked.

### session-finished-pulse-util.ts

**Export:** `sessionFinishedPulseUtil`.

Tracks when each session transitioned busy-to-idle (so cards can pulse), prunes stale entries, and decides whether a pulse is still within its configured duration.

### session-presentation-util.ts

**Export:** `sessionPresentationUtil`.

Session display strings: relative "active X ago" label, model name suffix stripping, project name from cwd, session title fallback chain (name, AI title, project, "Unnamed session"), title suffix splitting, status badge/dot class names, and token-count abbreviation (k/M).

### session-sound-util.ts

**Export:** `sessionSoundUtil`.

Synthesizes notification sounds with the Web Audio API (no audio files): tone tables for beep, chime, ding, fanfare, ping, success; volume-to-gain mapping; cached AudioContext; plus diffing of session lists to find newly-waiting and busy-to-idle transition session ids.

### side-menu-prefs-util.ts

**Export:** `sideMenuPrefsUtil`.

Loads and saves the sidebar collapsed flag in `localStorage` under `side-menu.is-collapsed`.

### tracker-token-source-util.ts

**Exports:** `trackerTokenSourceUtil`, interfaces `ITrackerSystemTokenOption`, `ITrackerTokenSelection`.

Platform rules for Claude token sources: forces manual tokens on Windows (no system-token support), and supplies the Linux (`~/.claude/.credentials.json`) and macOS (Keychain) option labels and hint texts.

### trigger-run-util.ts

**Exports:** `triggerRunUtil`, interface `ITriggerRunSummary`.

Collapses raw trigger run log entries (a run produces a `started` and a terminal entry) into one summary per event id, newest first.

### trigger-validation-util.ts

**Export:** `triggerValidationUtil`.

Returns a user-facing validation error for a trigger config: empty command, no days picked, no times, or times not matching the shared `HH:mm` pattern.

### usage-pace-util.ts

**Export:** `usagePaceUtil`.

Compares used percent against elapsed window percent: detects usage outpacing the window at 10 or more points of drift, and maps drift to a stepped red/green CSS color variable for meter fills.

### usage-reset-util.ts

**Export:** `usageResetUtil`.

Window-reset math: remaining milliseconds until reset, elapsed and remaining percentages of a window, human "time left" text; re-exports the shared five-hour window length.

### usage-severity-util.ts

**Export:** `usageSeverityUtil`.

Maps a usage percent to a severity color CSS variable and label (normal under 70, "Filling up" under 85, "High usage" under 95, "Limit reached" above).

### usage-status-util.ts

**Export:** `usageStatusUtil`.

Maps the `UsageStatus` enum to display text: Live, Error, Loading, No token.

### usage-window-util.ts

**Export:** `usageWindowUtil`.

Formats a usage window value line like percent followed by used/total amounts, returning undefined when amounts are unknown.

### zai-peak-util.ts

**Export:** `zaiPeakUtil`.

z.ai peak-hour logic: weekday 14:00 to 18:00 in UTC+8, computed via a shifted-UTC wall clock; yields peak-active flag, the local-time window text, and remaining time/percent in the current peak window.

## ui-component/ (React components, grouped by feature)

**Why this layer:** each subfolder owns one page or one visual domain, with the component and its CSS file side by side. Components freely import sibling features' shared pieces (the dashboard reuses sessions and usage-dashboard parts, scheduling reuses the usage add button, tracker dialogs reuse the schedule fields), so the folder that owns a reusable widget hosts it and others import across.

Feature-area map:

| Subfolder | Feature area |
|---|---|
| about | About page: app identity, version, provider list, and the hidden 7-click Development unlock |
| app-shell | Application frame: sidebar + active view routing + update footer, and all app-wide data subscriptions |
| dashboard | Landing overview combining usage boxes and session boxes in one grid |
| development | Hidden dev-only page for previewing the provider card at arbitrary usage/time values |
| icon | Nine tiny inline-SVG icon components shared by every feature |
| provider | Provider brand icons (Claude, z.ai, dummy) |
| schedule | Reusable day-of-week and time-of-day picker fields shared by trigger and tracker forms |
| scheduling | Scheduling page: OS-scheduler triggers, their CRUD dialogs, the 5-hour window planner, and run logs |
| sessions | Sessions page: live Claude session cards, auto-refresh controls, sounds, SSH hosts |
| side-menu | The collapsible left navigation with brand and per-item status dots |
| tracker | Usage tracker CRUD: provider choice, token configuration, settings dialog |
| usage-dashboard | Usage page: provider usage cards, usage bars, tracker add/settings wiring |

### ui-component/about/

- `about-page.tsx`: **`AboutPage`**. Renders the static About page: app icon and tagline, current version fetched through `updateClientService`, sections on what the app does, supported providers (from `providerCatalogUtil`), and privacy. It also carries a hidden convention: clicking the title 7 times invokes `onToggleDevelopmentUnlock` to reveal the Development tab, with a countdown hint after the first click. It is here because it is the "about" page's single component, and the unlock gesture is conceptually part of app metadata.

### ui-component/app-shell/

- `app-shell.tsx`: **`AppShell`**. The root component and de facto controller: holds the active view id (about, dashboard, development, scheduling, sessions, usage), loads settings, usage snapshot and session snapshot once, subscribes to push updates for all three, diffs sessions to trigger waiting/finished sounds, tracks finished-session pulse timestamps, runs a 30-second clock tick, computes all sidebar status dots via `menuStatusUtil`, builds the menu items (including the Development item only when unlocked), and renders `SideMenu`, the active page, and `AppFooter`. It is the shell, so it lives in app-shell.
- `app-footer.tsx`: **`AppFooter`**. Slim footer that fetches update status once, subscribes to status pushes, shows the current version, and renders an "Update available" button that opens the release page. Grouped with the shell because it is part of the permanent frame, not any one page.

### ui-component/dashboard/

- `dashboard-page.tsx`: **`DashboardPage`**. The landing overview. Loads usage and session snapshots, subscribes to updates, and fills a grid with a `DashboardUsageBox` per provider tracker and a `DashboardSessionBox` per active session, falling back to `DashboardEmptyBox` prompts that navigate to the Usage or Sessions page; surfaces session and focus errors.
- `dashboard-usage-box.tsx`: **`DashboardUsageBox`**. Compact per-tracker usage card: tracker name, five-hour-window usage and reset bars (reusing `UsageBar` from usage-dashboard), pace-colored fills, a z.ai peak pill with remaining-time meter when peak hours are active, and status messages for error/pending/unconfigured states. It re-renders on a 30-second tick.
- `dashboard-session-box.tsx`: **`DashboardSessionBox`**. Compact per-session card mirroring the full session card: origin icon, host label, status badge, focus button for local sessions, title with suffix, transcript chips, plus the finished and waiting pulse overlays.
- `dashboard-empty-box.tsx`: **`DashboardEmptyBox`**. A button-shaped empty-state tile with a plus icon, title, and call-to-action label that navigates somewhere when clicked. Generic dashboard furniture.

### ui-component/development/

- `development-page.tsx`: **`DevelopmentPage`**. A designer playground, reachable only when unlocked: sliders for used percent, window elapsed, data age, and time of day plus a weekday select feed a live `ProviderUsageCard` preview of a synthetic z.ai snapshot, so any severity band, pace color, stale state, and peak-hour tint can be inspected; also renders the severity color-band legend. State (used percent, elapsed) is owned by AppShell so the Development sidebar dot mirrors it.
- `slider-field.tsx`: **`SliderField`**. Labeled range input showing a formatted value text; generic dev-page form control.
- `select-field.tsx`: **`SelectField`**. Labeled select input with option list; exported type `ISelectFieldOption` alongside.

### ui-component/icon/

Nine tiny components, all the same shape: a stateless component taking an optional `size` (default 15) and rendering an inline SVG stroked with currentColor: `ChevronIcon` (chevron-icon.tsx), `GearIcon` (gear-icon.tsx), `LocalIcon` (local-icon.tsx, desktop monitor), `PauseIcon` (pause-icon.tsx), `PeakIcon` (peak-icon.tsx, lightning bolt, default size 13), `PlayIcon` (play-icon.tsx), `RefreshIcon` (refresh-icon.tsx), `ServerIcon` (server-icon.tsx), `TerminalIcon` (terminal-icon.tsx). They are grouped so features can share one icon set without a barrel file; none carry behavior.

### ui-component/provider/

- `provider-icon.tsx`: **`ProviderIcon`**. Renders the filled brand mark for a provider id: a hand-drawn Claude path, the z.ai "Z" mark, or a bolt fallback for the dev-only dummy provider, with its own CSS class per provider. Grouped separately from icon/ because these are domain brand assets rather than generic UI glyphs.

### ui-component/schedule/

- `day-time-schedule-fields.tsx`: **`DayTimeScheduleFields`**. A controlled pair of editors for a schedule: day-of-week chip toggles with Weekdays/Weekend/Every day quick actions, and a list of time rows (each a `DayTimeSelect` plus remove) with add-time. Reports the whole `{ days, times }` selection upward. Shared by the trigger dialogs and the dev-only dummy tracker form, hence its own cross-cutting folder.
- `day-time-select.tsx`: **`DayTimeSelect`**. Hour and minute dropdown pair that converts through `minutesTimeUtil` and reports a normalized `HH:mm` value.

### ui-component/scheduling/

- `scheduling-page.tsx`: **`SchedulingPage`**. The Scheduling page: loads settings, scheduling support info, and per-trigger registration health; renders a master OS-scheduling switch, per-trigger cards with day chips, enable toggles, a "Registered/Missing/Paused/Off" badge, expandable run-log lists (grouped via `triggerRunUtil`, with outcome badges for OK/failed/timed-out/skipped reasons and clear-logs), plus banners for unsupported platforms and disabled scheduling, and opens the add, planner, settings, and clear-runs dialogs. All writes go through `schedulingClientService` (toggles) and `usageClientService.saveSettings` implicitly via the dialogs.
- `add-trigger-dialog.tsx`: **`AddTriggerDialog`**. Creates a new trigger: seeds an `ITriggerConfig` (optionally from a planner preset, else the max-window preset) with a default demo Claude command, validates via `triggerValidationUtil`, and appends it to settings through `usageClientService.saveSettings`.
- `trigger-config-fields.tsx`: **`TriggerConfigFields`**. The shared trigger form body: name, command, day/time schedule fields, timeout minutes with clamping, and the enabled (register with OS scheduler) checkbox. Reused by both add and edit dialogs.
- `trigger-settings-dialog.tsx`: **`TriggerSettingsDialog`**. Edits or removes an existing trigger: loads settings, finds the trigger by id (showing a "no longer exists" panel otherwise), validates and saves the edited config, and has a two-step confirm remove that filters the trigger out of settings.
- `trigger-planner-dialog.tsx`: **`TriggerPlannerDialog`**. The "Plan windows" tool: three `PlannerDial` controls (work start hour, work hours, lunch start) plus a first-trigger slider drive a shared planner model that computes chains of 5-hour windows; renders a two-lane timeline (windows vs work/lunch) with hour ticks and a coverage hint, and hands a trigger preset (day set plus computed times) back to be turned into a real trigger.
- `planner-dial.tsx`: **`PlannerDial`**. The rotary knob control itself: an SVG circle arc with needle and knob, draggable via pointer capture, keyboard accessible (arrows, Home, End) with ARIA slider semantics; all angle math delegated to `plannerDialUtil`. Supports work and lunch color tones.
- `trigger-window-explainer.tsx`: **`TriggerWindowExplainer`**. An info button with a popup explaining how the max-5h-windows preset works, including a small static timeline diagram derived from the shared preset times and a workday overlay. Purely presentational teaching UI.
- `clear-runs-dialog.tsx`: **`ClearRunsDialog`**. A minimal confirm/cancel modal for deleting a trigger's run logs; the actual clearing is done by the page through `schedulingClientService.clearTriggerRunLogs`.

### ui-component/sessions/

- `sessions-page.tsx`: **`SessionsPage`**. The Sessions page: loads settings and the session snapshot, subscribes to push updates, runs a 1-second clock, and renders a header (title with a busy/waiting/idle/remote count summary), legend, auto-refresh status and toggle, manual refresh, SSH hosts and settings buttons, an error/warning area (including unreachable SSH hosts), a grid of `SessionCard`s with per-session expand state, the focus-support footer, and a refresh progress bar driven by the snapshot fetch time and configured interval.
- `session-card.tsx`: **`SessionCard`**. The full session card: origin icon, title with suffix, status badge, focus button for local sessions, expand toggle, project path label, transcript chips, an expandable detail section (token stat table, last prompt preview truncated to 200 chars, version and session id), and a footer with host chip, kind, pid, and uptime.
- `session-transcript-chips.tsx`: **`SessionTranscriptChips`**. The compact chip row shared by session and dashboard cards: context tokens, model name, git branch, and relative last-activity time.
- `session-expand-button.tsx`: **`SessionExpandButton`**. Chevron icon button with `aria-expanded` state styling.
- `session-focus-button.tsx`: **`SessionFocusButton`**. Crosshair icon button that requests the main process to focus the session's terminal (button only; the call is made by the parent via `sessionsClientService.focusSession`).
- `session-origin-icon.tsx`: **`SessionOriginIcon`**. Chooses `ServerIcon` for remote (SSH) sessions or `LocalIcon` for local ones.
- `session-finished-pulse.tsx`: **`SessionFinishedPulse`**. Renders a timed border-pulse overlay while a session is within its "finished" window; duration comes from settings, active state from `sessionFinishedPulseUtil`. Returns undefined when inactive.
- `session-waiting-pulse.tsx`: **`SessionWaitingPulse`**. Persistent attention pulse overlay rendered only while the session status is waiting.
- `sessions-auto-refresh-button.tsx`: **`SessionsAutoRefreshButton`**. Play/pause icon toggle for sessions auto-refresh.
- `sessions-auto-refresh-status.tsx`: **`SessionsAutoRefreshStatus`**. Small Live/Paused text pill.
- `sessions-refresh-button.tsx`: **`SessionsRefreshButton`**. Refresh icon button.
- `sessions-refresh-progress-bar.tsx`: **`SessionsRefreshProgressBar`**. ARIA meter bar showing progress toward the next automatic refresh.
- `sessions-settings-button.tsx`: **`SessionsSettingsButton`**. Gear icon button that opens the sessions settings dialog.
- `sessions-settings-dialog.tsx`: **`SessionsSettingsDialog`**. Settings modal for the sessions feature: auto-refresh interval, finished-pulse seconds (both clamped to shared min/max), and a Sounds group using two `SessionSoundField`s plus a volume slider; saves everything via `usageClientService.saveSettings`.
- `session-sound-field.tsx`: **`SessionSoundField`**. One sound picker row: a select of the seven sound ids (None through Success), a play-preview button that plays through `sessionSoundUtil`, and a hint line. Reused for both the waiting and finished sounds.
- `sessions-focus-support-footer.tsx`: **`SessionsFocusSupportFooter`**. Renders only when the main process reports focus support status `missing-tool` (Linux without xdotool): explains the dependency and offers an Install xdotool button that calls `sessionsClientService.installSessionFocusTool`; returns null otherwise.
- `ssh-hosts-button.tsx`: **`SshHostsButton`**. Server icon button that opens the SSH hosts dialog.
- `ssh-hosts-dialog.tsx`: **`SshHostsDialog`**. SSH host manager: lists configured hosts with enable toggles and two-step remove, a url field with format hints, a Test button calling `sessionsClientService.testSshHost`, and Add persisting the list through `usageClientService.saveSettings`.

### ui-component/side-menu/

- `side-menu.tsx`: **`SideMenu`**, plus exported generic type `ISideMenuItem<ItemId>`. The left navigation: brand row with an aggregate status dot, main items and footer items rendered from data (icon, label, optional live indicator, optional status dot with tooltip), active highlighting, a collapse toggle, and tooltips shown on items only while collapsed. It is view-agnostic (generic over item id), which is why it is its own folder rather than part of app-shell.

### ui-component/tracker/

- `add-tracker-dialog.tsx`: **`AddTrackerDialog`**. Two-step tracker creation: first a provider choice list from the visible catalog (with `ProviderIcon`s), then a blank per-provider tracker config (Claude manual/system token, z.ai token, or the dev-only dummy schedule tracker) edited via `TrackerConfigFields`, validated per provider, and appended to settings via `usageClientService.saveSettings`. It also loads the OS platform through `osClientService` so Claude token options are correct.
- `tracker-config-fields.tsx`: **`TrackerConfigFields`**. The shared tracker form body: display name; a Claude token section with manual-vs-system radio selection and hints from `trackerTokenSourceUtil`; a z.ai token field; the dummy tracker's day/time schedule; and a refresh-interval minutes input with clamping.
- `tracker-settings-dialog.tsx`: **`TrackerSettingsDialog`**. Edits or removes an existing tracker: loads settings plus platform, normalizes the token source for the platform (forcing manual on Windows), reuses `TrackerConfigFields`, validates dummy-tracker schedules, saves or two-step-removes the tracker, and shows a token-storage privacy note.

### ui-component/usage-dashboard/

- `usage-dashboard.tsx`: **`UsageDashboard`**. The Usage page: loads settings and the usage snapshot, subscribes to usage pushes, ticks every second for progress bars, renders a `ProviderUsageCard` per tracker (joining snapshot data with the tracker's settings for pause state and interval), handles per-tracker manual refresh with spinner tracking and pause toggles, and hosts the add-tracker and tracker-settings dialogs; shows empty state when no trackers exist.
- `provider-usage-card.tsx`: **`ProviderUsageCard`**. The rich per-tracker card: header with provider icon, name, status pill (Live/Paused/Error/...), pause toggle, refresh button with spinner, and settings gear; a z.ai peak banner (active countdown with progress meter, or upcoming window text); a primary `UsageWindowBox` for the first window plus secondary window boxes or plain bars; status-specific body messages; and a footer with last-fetched time (with a Stale warning when past the interval), interval text, and an auto-refresh progress meter. Also reused by the Development page as its preview surface.
- `usage-window-box.tsx`: **`UsageWindowBox`**. One usage window: title, usage bar with pace-colored fill and value text, and a right-anchored reset bar counting down to the reset time; tints the box when usage is outpacing the window. Re-renders on a 30-second tick.
- `usage-bar.tsx`: **`UsageBar`**. The generic labeled meter used everywhere: clamped percent fill, severity color by default with optional override and left/right fill anchoring, optional value text and tooltip, ARIA meter semantics.
- `dashboard-add-button.tsx`: **`DashboardAddButton`**. Round plus icon button shared by the Usage page and the Scheduling page header.

## Consistency observations

- A few inline SVGs are duplicated inside feature pages (scheduling-page's gear/plus/trash, ssh-hosts-dialog's close/test/add/remove, provider-usage-card's pause/gear) rather than promoted into `ui-component/icon/`.
