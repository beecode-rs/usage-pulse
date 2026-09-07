# src/preload

Part of the code-structure snapshot. See [README.md](README.md) for the commit this reflects.

The preload layer of the Electron app. Contains exactly one file, `index.ts`, with no subdirectories.

## index.ts

**Exports:** none. The file has zero export statements; its entire effect is one side-effect call to `contextBridge.exposeInMainWorld('usageApi', usageApi)`. The bridged object is a module-local `usageApi` constant typed as `IUsageApiClient` (the contract defined in `src/shared/usage-model.ts`).

**What it is:** the Electron preload script. It builds an implementation of the shared `IUsageApiClient` interface in which every one of the 25 methods is a thin wrapper over `ipcRenderer`, then installs that object into the renderer's `window` context under the key `usageApi`. It contains no business logic: each method forwards its parameters verbatim to an IPC channel name taken from the `IpcChannelMapper` enum and returns the resulting promise. Three call styles are used: `ipcRenderer.invoke` for request/response (20 channels), `ipcRenderer.send` for one fire-and-forget action (`openRelease`), and `ipcRenderer.on` plus `removeListener` for four push-event subscriptions.

**Why it is in this layer:** it is the security boundary between the main process and the renderer. With context isolation enabled, the renderer cannot reach Node or Electron APIs; this script is the only sanctioned bridge. It converts the typed, shared `IUsageApiClient` contract into an explicit whitelist of renderer-callable methods, so the renderer never receives `ipcRenderer` itself, only a plain object whose every method maps to one named channel. Both sides share the channel names and payload types through `src/shared`, which is what makes the bridge type-safe end to end.

## Renderer-side API surface

The renderer gets `window.usageApi` with 25 methods, grouped by role:

- Snapshot and state reads: `getPlatform`, `getSnapshot`, `getSessionsSnapshot`, `listSessions`, `getSettings`, `getUpdateStatus`, `getSchedulingInfo`, `getSessionFocusSupport`
- Actions and mutations: `refreshNow`, `refreshTracker`, `setTrackerPaused`, `saveSettings`, `setSchedulingEnabled`, `setTriggerEnabled`, `clearTriggerRunLogs`, `getTriggerRunLogs`, `inspectTriggerRegistrations`, `focusSession`, `installSessionFocusTool`, `testSshHost`, and `openRelease` (void-returning, send-based; every other method returns a promise via invoke)
- Push subscriptions: `onUsageUpdate`, `onSessionsUpdate`, `onSettingsUpdate`, `onUpdateStatus`. Each accepts a listener, registers it on its push channel, unwraps the Electron event argument so the listener only sees the payload (a usage snapshot, session snapshot, settings object, or update status respectively), and returns an unsubscribe function that removes the listener.

In total it wires 25 distinct channels from `IpcChannelMapper` (the enum in `src/shared/ipc-channel.ts` with `domain:action` style string values such as `usage:get-snapshot`).

## Shared imports and consumers

Imports from `src/shared`:

- Value import: `IpcChannelMapper` from `ipc-channel` (the runtime channel enum)
- Type-only imports: `OsPlatform` from `os-model`; `ISessionFocusSupport`, `ISessionSnapshot`, `SessionsUpdateListener` from `session-model`; `IAppSettings` from `settings-model`; `ISchedulingInfo`, `ITriggerRegistrationHealth`, `ITriggerRunLogEntry` from `trigger-model`; `IUpdateStatus`, `UpdateStatusListener` from `update-model`; `IUsageApiClient`, `IUsageSnapshot`, `SettingsUpdateListener`, `UsageUpdateListener` from `usage-model`

Renderer-side typing and consumption: `src/renderer/src/env.d.ts` declares the global augmentation `Window.usageApi: IUsageApiClient`, so the renderer is fully typed against the same interface the preload implements. Five client services consume it, all under `src/renderer/src/business/service/`: `usage-client-service`, `sessions-client-service`, `os-client-service`, `scheduling-client-service`, and `update-client-service`.
