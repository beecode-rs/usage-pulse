# Trackers

The dashboard starts empty. **+ Add** in the header opens a dialog that first asks which provider you want, then configures it. You can add any number of trackers, including several for the same provider (e.g. two Claude accounts with different tokens) — each tracker is a card with its own configuration behind the card's gear button (display name, token, remove).

Each tracker is stored in `settings.trackers` as an `TrackerConfig` (a discriminated union on `providerId`) with a unique `id` that also keys the usage snapshots. Settings saved in the old flat shape (one Claude + one z.ai token) are migrated automatically on first launch.

The app uses the **strategy pattern** (`src/main/business/service/usage-provider/`). Providers are stateless and held in a `Record<ProviderId, UsageProvider>` registry; the poll service resolves the provider per tracker and passes that tracker's token on every `fetchUsage` call:

| Provider | Endpoint | 5-hour window | Long window |
| --- | --- | --- | --- |
| Claude | `GET https://api.anthropic.com/api/oauth/usage` (undocumented, OAuth bearer) | `five_hour.utilization` + `resets_at` | `seven_day.utilization` (weekly) |
| z.ai | `GET https://api.z.ai/api/monitor/usage/quota/limit` | `limits[].type === 'TOKENS_LIMIT'` → `percentage` | `limits[].type === 'TIME_LIMIT'` → `percentage` + `currentValue`/`usage` counts (MCP quota, monthly) |

To add a provider kind: extend `ProviderId` and `constant.providerCatalog` (`src/shared/util/constant.ts`), create a class implementing `UsageProvider` in the `usage-provider/` folder, and register it in `UsagePollService._createDefaultProviders()`.

## Getting tokens

- **Claude** — two options in the tracker's settings:
  - **Enter manually**: paste the OAuth access token your Claude Code installation uses.
  - **Use system token** (macOS only for now): reads `claudeAiOauth.accessToken` from the Keychain entry `Claude Code-credentials` on every poll, so it stays current when Claude Code refreshes the token. On Linux/WSL Claude Code stores it in `~/.claude/.credentials.json` instead — system reading for those platforms is not implemented yet. The Keychain holds a single Claude Code login, so multiple system-source trackers all reflect that one account.

  The endpoint is undocumented and rate-limited per access token — keep the poll interval at 60s or higher, and remember each tracker polls independently.
- **z.ai**: the `ANTHROPIC_AUTH_TOKEN` from your GLM Coding Plan (the same token you pass to `https://api.z.ai/api/anthropic`).

Tokens are stored only in `usage-pulse-settings.json` inside the app's userData folder and are sent exclusively to the provider their tracker belongs to.
