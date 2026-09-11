# [tech-spec] OS-native trigger scheduling

* 1 [Infrastructure](#Infrastructure)
  * 1.1 [main (Electron)](#main-electron)
  * 1.2 [OS registrations](#os-registrations)
  * 1.3 [renderer (Triggers tab)](#renderer-triggers-tab)
* 2 [Model](#Model)
  * 2.1 [main (Electron)](#main-electron-1)
    * 2.1.1 [AppSettings (delta)](#iappsettings-delta)
    * 2.1.2 [TriggerConfig (new)](#itriggerconfig-new)
    * 2.1.3 [TriggerRunLogEntry (new)](#itriggerrunlogentry-new)
* 3 [Flow](#Flow)
  * 3.1 [Backend](#Backend)
    * 3.1.1 [Create / update / delete trigger](#create-update-delete-trigger)
    * 3.1.2 [OS fires a trigger (headless worker)](#os-fires-a-trigger-headless-worker)
    * 3.1.3 [Live log updates in the GUI](#live-log-updates-in-the-gui)
* 4 [Happy path](#Happy-path)
* 5 [Backwards compatibility](#Backwards-compatibility)

Companion research with full per-OS templates (plist XML, `schtasks` commands, systemd units, cron block): [`OS-SCHEDULING-RESEARCH.md`](../../OS-SCHEDULING-RESEARCH.md). This spec describes **what** changes; templates live there.

**Decision:** use the OS-native scheduler on every platform (launchd on macOS, Task Scheduler on Windows, systemd user timer on Linux with cron fallback) — confirmed.

**Use case:** the user has multiple cloud CLIs installed — `claude` (Anthropic brain) and `claudez` (z.ai brain). A trigger runs one of them with a string prompt, default pre-populated as `claude -p "What is your name?"` (or the `claudez` variant). The user may also write any custom command.

**Key architectural point (answers "how does the app learn a trigger fired"):** the OS scheduler never runs `claude` directly. It always starts **the Usage Pulse binary itself** in a headless worker mode with the trigger's unique id (`--fire-trigger <triggerId>`). The app is therefore present at trigger time by definition — it validates the trigger, spawns the CLI, and writes the log itself. No separate ping/endpoint/hot-server is needed; a running GUI picks up new log lines via a file watch.

---

# Infrastructure

## main (Electron)

New IPC channels:

* `TRIGGER_LIST` — return all trigger configs joined with their last run log entry and OS registration health.
* `TRIGGER_SAVE` — create or update a trigger config; body: full `TriggerConfig`; upserts the OS registration.
* `TRIGGER_DELETE` — remove the OS registration and the trigger config; keeps log history.
* `TRIGGER_RUN_NOW` — execute the trigger pipeline immediately; logged with `trigger: 'manual'`.
* `TRIGGER_LOG_LIST` — paged read of the run log; filter by `triggerId`.
* `TRIGGER_OS_INSPECT` — per-trigger OS registration status (registered / missing / last OS-side run time when the platform exposes it).
* `TRIGGER_LOG_UPDATED` — main→renderer push when the log file changes while the GUI is open.

New headless entry mode:

* App started with `--fire-trigger <triggerId>` runs the worker pipeline and exits; it never creates a window. Exit code 0 = command succeeded, non-zero = failed/skipped-error (gives `schtasks Last Result` / systemd something truthful).

Worker-side guards (safety net on top of OS schedule): trigger must exist and be enabled; today must be one of its days; "now" must be within `staleSkipMs` of a configured slot (default 1_800_000 ms, i.e. 30 minutes — suppresses launchd/systemd wake catch-up firing a 09:00 slot at 11:47). Skipped runs are logged as `skipped` with a reason.

## OS registrations

One registration per trigger (id embedded in every artifact name for collision-free add/remove):

| Platform | Artifact | Schedule mapping |
|---|---|---|
| macOS | LaunchAgent plist, Label `com.usage-pulse.trigger.<triggerId>` | `StartCalendarInterval` array: one entry per time, each with `Hour`, `Minute`, `Weekday` (days baked in) |
| Windows | Task Scheduler tasks named `UsagePulseTrigger.<triggerId>.<HHmm>` — one task per time (CLI is single-trigger) | `/sc weekly /d <days> /st <HH:mm>`; set missed-run catch-up (`StartWhenAvailable`) and clear the default AC-power-only condition |
| Linux | systemd user units `usage-pulse-trigger-<triggerId>.service` + `.timer` | `OnCalendar=<days> <times>` (e.g. `Mon..Fri 09:00,13:00,17:00`), `Persistent=true` |
| Linux fallback | marked block in user crontab | one `m h * * <days>` line per time, between `#usage-pulse:begin/end` markers |

All registrations invoke the same command line: `<resolved app executable> --fire-trigger <triggerId>`.

Executable resolution rule: at save time the first token of the trigger command (e.g. `claude`, `claudez`) is resolved to its **absolute path** and shown in the UI. OS schedulers run with a minimal `PATH` (nvm/npm-global/homebrew locations are invisible to launchd/cron), so storing the bare name would silently fail. The stored `command` keeps what the user wrote; the resolved absolute-path form is what gets executed.

Missed-run behavior relied upon: launchd fires a coalesced catch-up on wake; Windows catch-up is opt-in (set explicitly); systemd `Persistent=true`; plain cron misses — the `skipped/stale` guard is the backstop everywhere.

## renderer (Triggers tab)

New side-menu page **Triggers**:

* Trigger list: name, command (mono, with `claude` / `claudez` icon), day chips, times, enabled toggle, last run outcome (from log), registration health badge, actions: run now, edit, delete.
* Add/edit dialog: name; preset picker `claude` / `claudez` / custom; prompt input defaulting to **"What is your name?"**; advanced raw-command override (free text, executed via shell); day selector (Mon–Sun chips plus "Weekdays" / "Weekend" quick-select); times editor (list of `HH:mm`); timeout; enabled.
* History table below the list: timestamp, trigger, scheduled slot, phase/outcome, duration, exit code, output snippet; filterable per trigger.
* Status line: resolved executable paths + the exact command line each OS registration will run.

---

# Model

## main (Electron)

### AppSettings (delta)

```
@startuml
class AppSettings {
  ..
  +triggers: TriggerConfig[]
}
@enduml
```

Optional field; absent (`undefined`) is treated as "no triggers" — no migration.

### TriggerConfig (new)

```
@startuml
class TriggerConfig {
  +id: string
  +name: string
  +command: string
  +days: TriggerDay[]
  +times: string[]
  +timeoutMs: number
  +isEnabled: boolean
  +createdAt: number
}
note for TriggerConfig
  id: stable unique id "tr_" + 8 random
  alphanumeric chars, generated once at
  creation. Embedded in: OS artifact
  names (plist Label / task name /
  systemd unit / cron block), the
  worker argv (--fire-trigger <id>),
  and every log line.
end note
note for TriggerConfig
  command: full shell command line as
  typed by the user, e.g.
  claude -p "What is your name?"
  or claudez -p "What is your name?"
end note
note for TriggerConfig
  days: subset of Mon..Sun
  times: ["HH:mm", ...] local time
  timeoutMs: kill the CLI after this
end note
@enduml
```

### TriggerRunLogEntry (new)

```
@startuml
class TriggerRunLogEntry {
  +eventId: string
  +triggerId: string
  +triggerName: string
  +timestamp: string
  +slot: string
  +trigger: string
  +phase: string
  +exitCode: number
  +durationMs: number
  +outputSnippet: string
  +skipReason: string
}
note for TriggerRunLogEntry
  Stored as JSONL in
  userData/usage-pulse-trigger-log.jsonl
  (one line per event). eventId:
  "evt_" + random, generated per firing,
  links the "started" and "finished"
  lines of one execution. trigger:
  "os-schedule" | "manual". phase:
  "started" | "finished" | "skipped".
  skipReason set only when phase is
  skipped: "disabled" | "not-scheduled-day"
  | "stale" | "not-found". outputSnippet:
  truncated stdout/stderr (max ~2 KB).
end note
@enduml
```

The two-level identifier scheme answers "we need something unique per trigger": **`triggerId`** is stable for the trigger's lifetime and names everything OS-side; **`eventId`** identifies one firing and stitches its log lines together.

Log retention: rotated — when the file exceeds ~5 MB it is truncated to the most recent ~2000 lines.

---

# Flow

## Backend

### Create / update / delete trigger

```
@startuml
(*) --> "User saves trigger in Triggers tab"
--> "Main validates config (id, ≥1 day, ≥1 time, command non-empty)"
--> "Persist to settings JSON (atomic write)"
if "Trigger enabled?" then
  --> [Yes] "Resolve command executable to absolute path (shell 'which')"
  --> "Upsert OS registration (per-platform artifact, days+times baked in)"
else
  --> [No] "Remove OS registration if present"
fi
--> (*)

"User deletes trigger" --> "Remove OS registration" --> "Remove config (log history kept)" --> (*)
"User toggles enabled" --> same add/remove registration branch
@enduml
```

### OS fires a trigger (headless worker)

```
@startuml
actor "OS scheduler" as os
participant "Usage Pulse\n(--fire-trigger tr_x)" as worker
participant "SettingsRepo" as settings
participant "claude | claudez\n(child process)" as cli
file "trigger-log.jsonl" as log

os -> worker: starts app binary headless at 09:00 Mon
worker -> settings: load settings
alt trigger missing / disabled / wrong day / stale
  worker -> log: append {phase: "skipped", reason}
  worker --> os: exit 0
else trigger valid
  worker -> log: append {phase: "started", eventId}
  worker -> cli: spawn resolved command (shell, timeout)
  cli --> worker: stdout/stderr + exit code
  worker -> log: append {phase: "finished", eventId, exitCode, durationMs, outputSnippet}
  worker --> os: exit with CLI's exit code
end
@enduml
```

No window is created; on macOS the Dock icon is hidden for the worker's lifetime. The worker never depends on the GUI being open — it shares only the settings file and the log file.

### Live log updates in the GUI

```
@startuml
(*) --> "GUI running, Triggers tab open"
--> "Main watches trigger-log.jsonl (fs.watch, debounced)"
--> "New line appended by a worker"
--> "Main pushes TRIGGER_LOG_UPDATED to renderer"
--> "Renderer re-reads via TRIGGER_LOG_LIST"
--> (*)

"Window focused / manual refresh" --> "Renderer re-reads via TRIGGER_LOG_LIST" --> (*)
@enduml
```

This replaces the "ping the app" idea: the worker writes the shared log; the GUI observes it. No sockets, no ports, works whether or not the GUI was running when the trigger fired.

---

# Happy path

* Add a trigger with the default pre-populated values (`claude` preset, prompt "What is your name?", Mon–Fri, 09:00 / 13:00 / 17:00) → the Triggers list shows it registered and healthy; `launchctl print` / `schtasks /query` / `systemctl --user list-timers` shows one artifact named with the trigger id.
* At 09:00 with the GUI closed → CLI runs, two log lines (`started` + `finished`) appear; opening the app shows them in History with duration and output snippet.
* Second trigger using the `claudez` preset at overlapping times → both fire independently; log lines are distinguishable by `triggerId`.
* Disable a trigger in the app → OS registration removed immediately; no further firings; earlier history intact.
* Machine asleep at 13:00, wakes 13:20 → one catch-up firing runs (launchd/systemd/Windows-with-StartWhenAvailable); waking at 15:00 → run is logged `skipped/stale`.
* "Run now" → immediate execution logged with `trigger: "manual"`, no OS involvement.
* Machine off / app folder moved / executable missing → registration inspect reports unhealthy; UI badge warns; deleting the trigger cleans up its OS artifacts.

---

# Backwards compatibility

* Settings JSON: `triggers` is a new optional field; older files load unchanged and behave as "no triggers". No migration.
* Run log: new file, created lazily on first append.
* Nothing about existing usage tracking changes; the worker mode must not acquire any single-instance lock if one is introduced for the GUI later.
* Uninstall/upgrades: OS artifacts reference the app binary's absolute path — the Triggers page surfaces stale registrations (inspect reports missing binary) so the user can re-save triggers after a location change.
