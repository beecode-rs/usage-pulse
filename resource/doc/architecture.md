# Architecture

```
src/
├── shared/                         # cross-process models (main + preload + renderer)
│   ├── ipc-channel.ts              # IPC channel names
│   ├── os-model.ts                 # OS detection + capability flags
│   ├── business/model/provider-catalog-model.ts   # ProviderCatalogEntry type (catalog data lives in util/constant.ts)
│   ├── session-model.ts            # session snapshots, status, focus support
│   ├── settings-model.ts           # AppSettings, TrackerConfig, poll interval bounds
│   ├── trigger-model.ts            # scheduled trigger config + presets
│   ├── trigger-planner-model.ts    # 5-hour window planner math
│   └── usage-model.ts              # usage snapshots, provider types, renderer API contract
├── main/
│   ├── index.ts                    # app boot (+ one-time settings migration write-back)
│   ├── lib/app-window.ts           # BrowserWindow creation
│   ├── lib/dummy-trigger-popup.ts  # dev-only trigger notification popup
│   ├── controller/ipc-controller.ts      # IPC handlers + update push
│   ├── util/                             # error/http/os/sessions/transcript helpers
│   └── business/
│       ├── component/scheduling-strategy/  # OS scheduler strategies (strategy pattern)
│       │   ├── scheduling-strategy.ts      # SchedulingStrategy interface
│       │   ├── factory.ts                  # resolves the strategy for this platform
│       │   ├── mac-launchd.ts              # macOS launchd
│       │   ├── linux.ts                    # Linux systemd
│       │   └── windows.ts                  # Windows (not implemented yet)
│       ├── repo/settings-repo.ts           # settings persistence (userData JSON)
│       ├── repo/trigger-run-log-repo.ts    # trigger run history
│       ├── repo/usage-snapshot-repo.ts     # usage snapshot persistence
│       └── service/
│           ├── claude-system-token-service.ts  # Claude Code token from macOS Keychain
│           ├── scheduling-service.ts           # trigger CRUD, delegates to the strategy
│           ├── session-transcript-service.ts   # parses Claude Code transcripts
│           ├── sessions-service.ts             # local session discovery
│           ├── ssh-sessions-service.ts         # remote session discovery over SSH
│           ├── settings-service.ts             # defaults, sanitizing, legacy migration
│           ├── trigger-command-service.ts      # trigger command validation
│           ├── trigger-runner-service.ts       # runs triggered commands, logs runs
│           ├── usage-poll-service.ts           # interval polling per tracker, snapshot fan-out
│           └── usage-provider/                 # strategy implementations (stateless registry)
│               ├── usage-provider.ts           # UsageProvider interface
│               ├── claude.ts                   # UsageProviderClaude
│               ├── zai.ts                      # UsageProviderZai
│               └── dummy.ts                    # development/test provider
├── preload/index.ts                # contextBridge API (window.usageApi)
└── renderer/
    └── src/
        ├── main.tsx                # React root
        ├── business/service/       # thin IPC clients (usage, sessions, scheduling, os)
        ├── ui-component/
        │   ├── app-shell/          # window layout + page routing
        │   ├── side-menu/          # collapsible navigation
        │   ├── usage-dashboard/    # dashboard, provider cards, bars, footer
        │   ├── tracker/            # add-tracker dialog, per-tracker settings dialog
        │   ├── scheduling/         # scheduling page, trigger dialogs, window planner
        │   ├── schedule/           # shared day/time form fields
        │   ├── sessions/           # sessions page, cards, focus, SSH hosts dialog
        │   ├── about/              # about page
        │   ├── development/        # development page + form field helpers
        │   ├── provider/           # provider icons
        │   └── icon/               # shared icon components
        └── util/                   # severity thresholds, status text, formatting, prefs
```
