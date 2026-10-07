<p align="center">
  <img src="resource/icon/app-icon.png" width="140" alt="Usage Pulse icon" />
</p>

<h1 align="center">Usage Pulse</h1>

<p align="center">
  <img src="https://img.shields.io/github/package-json/v/beecode-rs/usage-pulse?label=version" alt="Version badge" />
  <img src="https://img.shields.io/badge/status-proof%20of%20concept-orange" alt="Proof of concept badge" />
  <img src="https://img.shields.io/badge/platform-macOS%20%7C%20Linux-blue" alt="Platform badge" />
  <img src="https://img.shields.io/badge/license-MIT-green" alt="License badge" />
</p>

<p align="center">
  Made by
  <a href="https://beecode.rs"><img src="resource/brand/beecode-logo.png" width="20" alt="Beecode logo" /></a>
  <a href="https://beecode.rs"><strong>Beecode</strong></a>
</p>

A small Electron + TypeScript desktop app for people who run several Claude Code sessions at once. It does four things:

- **Usage limits** — continuously pings your coding-plan providers and shows how much of your limits you have consumed: the 5-hour window as a ring, the longer window (weekly for Claude, monthly for z.ai) as a bar.
- **Active sessions** — lists your running Claude Code sessions, local and on remote SSH hosts, with their project folder and transcript stats, so you can see what every window is up to at a glance.
- **Scheduling** — registers a Claude command trigger with your OS scheduler (launchd/systemd) timed to the start of each 5-hour usage window.
- **Mobile API** — an opt-in server inside the app that streams the same live usage and session data to the Usage Pulse companion app on your phone, secured by a pairing token and reached over your VPN.

## Status: Proof of Concept

Usage Pulse is at **v0.7.0** and still a proof of concept. It was built through rapid AI-assisted iteration ("vibe coding") rather than carefully reviewed engineering, so expect rough edges, missing pieces, and breaking changes without notice. While it remains a POC the version stays on `0.x`; the move out of the POC phase coincides with the major version moving to `1`.

## Screenshots

| [Dashboard](resource/docs/features.md#overview-dashboard) | [Sessions](resource/docs/features.md#active-sessions) | [Usage](resource/docs/features.md#usage-limits-trackers) |
| :---: | :---: | :---: |
| <a href="resource/screenshots/dashboard.png"><img src="resource/screenshots/dashboard.png" width="240" alt="Dashboard screen" /></a> | <a href="resource/screenshots/sessions.png"><img src="resource/screenshots/sessions.png" width="240" alt="Sessions screen" /></a> | <a href="resource/screenshots/usage.png"><img src="resource/screenshots/usage.png" width="240" alt="Usage dashboard" /></a> |

| [Add tracker](resource/docs/features.md#usage-limits-trackers) | [Scheduling](resource/docs/features.md#scheduling) | [Add trigger](resource/docs/features.md#scheduling) |
| :---: | :---: | :---: |
| <a href="resource/screenshots/usage-add-tracker.png"><img src="resource/screenshots/usage-add-tracker.png" width="240" alt="Add a tracker dialog" /></a> | <a href="resource/screenshots/scheduling.png"><img src="resource/screenshots/scheduling.png" width="240" alt="Scheduling screen" /></a> | <a href="resource/screenshots/scheduling-add-trigger.png"><img src="resource/screenshots/scheduling-add-trigger.png" width="240" alt="Add a trigger dialog" /></a> |

| [Plan windows](resource/docs/features.md#window-planner) | [Mobile](resource/docs/features.md#mobile-api) |
| :---: | :---: |
| <a href="resource/screenshots/scheduling-planner.png"><img src="resource/screenshots/scheduling-planner.png" width="240" alt="Plan 5-hour windows dialog" /></a> | <a href="resource/screenshots/mobile.png"><img src="resource/screenshots/mobile.png" width="240" alt="Mobile screen" /></a> |

The titles link to each feature's section in [resource/docs/features.md](resource/docs/features.md).

## Features

- **Usage limits** — continuously pings your coding-plan providers and shows how much of your limits you have consumed: the 5-hour window as a ring, the longer window (weekly for Claude, monthly for z.ai) as a bar.
- **Active sessions** — lists your running Claude Code sessions, local and on remote SSH hosts, with their project folder and transcript stats, so you can see what every window is up to at a glance.
- **Session focus** — clicking a session's card focuses that session's terminal window (macOS, Linux X11).
- **Overview dashboard** — a combined light view of usage and sessions as the landing screen, with click-to-focus session rows.
- **Scheduling** — registers commands with your OS scheduler (launchd on macOS, systemd on Linux), each with its own toggle, weekdays, and trigger times.
- **Window planner** — stacks 5-hour usage windows over your workday and writes the computed start times back as a new scheduled task.
- **Menu status dots** — red marks an error on any screen, purple a session waiting for an answer, orange usage pace outpacing the window, stale data, or a provider in z.ai peak hours.
- **Session sounds** — a configurable sound, with volume, for when a session starts waiting and when one finishes.
- **Mobile API** — an opt-in server inside the app streams the same live usage and session data to the Usage Pulse companion app on your phone, secured by a pairing token and reached over your VPN.
- **Update check** — the footer links the latest release when a newer version is out.

For a deeper look at each feature — settings, edge cases, and how things work under the hood — see [resource/docs/features.md](resource/docs/features.md).

## Why this exists

I usually have three or four Claude Code sessions running at the same time, each in its own window. I rotate between them: write a prompt in one, move to the next, read what landed there, repeat — by the time I circle back, the first one is done. That loop only works while two questions stay answerable at a glance: _which session is waiting for me?_ and _how much of my usage window is left?_ Usage Pulse answers both in one place, instead of a terminal here and a provider dashboard there.

## Feature status

Done:

- [x] Usage tracking (Claude, z.ai)
- [x] Session tracking (local + SSH remote hosts)
- [x] Session focus (macOS, Linux X11)
- [x] Scheduler (macOS launchd, Linux systemd)
- [x] Claude system token (macOS, Linux)
- [x] Installable release builds (macOS dmg, Linux AppImage/deb via GitHub Releases)
- [x] Update check (the footer links the latest release when a newer version is out)
- [x] Overview dashboard (light combined view of usage and sessions, as the landing screen with click-to-focus session rows)
- [x] Menu status dots (red = error on any screen, purple = session waiting for an answer, orange = usage pace outpacing the window, stale data, or a provider in z.ai peak hours)
- [x] Session sounds (a configurable sound, with volume, for when a session starts waiting and when one finishes)
- [x] Mobile API (local server streaming live usage and session data to the [usage-pulse-mobile](https://github.com/beecode-rs/usage-pulse-mobile) companion app)

Planned:

- [ ] Windows support (scheduler, focus, system token)
- [ ] Header semaphores (per-provider usage indicators and a count of sessions waiting for a response)

## Requirements

**To use the app:** a Mac (Apple Silicon or Intel) or a Linux machine (Ubuntu AppImage or deb package).

**To build from source:** [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io).

## Download & install

Downloads live on the [GitHub Releases](https://github.com/beecode-rs/usage-pulse/releases) page.

**macOS** (Apple Silicon & Intel, one universal build): download `Usage-Pulse-<version>-universal.dmg` and drag **Usage Pulse** to Applications.

> The release builds are not signed or notarized with an Apple developer certificate, so macOS blocks the first launch. That is standard macOS behavior for any unsigned app — it needs a one-time confirmation that you trust it:
>
> 1. Open **Usage Pulse** once — it will be blocked with a "cannot be checked for malicious software" dialog. Dismiss the dialog.
> 2. Go to **System Settings → Privacy & Security** and scroll down to the Security section.
> 3. Under "'Usage Pulse' was blocked from use because it is not notarized", click **Open Anyway** and confirm.

Alternatively, clear the quarantine flag from a Terminal:

```bash
xattr -cr '/Applications/Usage Pulse.app'
```

**Ubuntu — AppImage**: make it executable and run it (no install needed):

```bash
chmod +x Usage-Pulse-<version>.AppImage
./Usage-Pulse-<version>.AppImage
```

**Ubuntu — deb package**:

```bash
sudo apt install ./usage-pulse_<version>_amd64.deb
```

### From source

Requires [Node.js](https://nodejs.org) and [pnpm](https://pnpm.io).

```bash
git clone https://github.com/beecode-rs/usage-pulse.git
cd usage-pulse
pnpm run init
pnpm dev
```

The full development setup lives in [resource/docs/development.md](resource/docs/development.md).

## Getting started

1. Launch **Usage Pulse** — the dashboard starts empty.
2. Open the **Usage** screen and click **+ Add** in the header, then pick your provider (Claude or z.ai).
3. On the new tracker card, open the gear menu and enter the provider's token and a display name.
4. Live usage appears on the card — see [resource/docs/trackers.md](resource/docs/trackers.md) for how to get a token for each provider.

## Privacy & security

**Provider tokens** stay on your device, stored in `usage-pulse-settings.json` inside the app's userData folder, and are sent only to the provider their tracker belongs to. The app contains no analytics and no telemetry.

Usage Pulse relies on an undocumented Claude usage endpoint, and its scheduler deliberately fires small prompts to open fresh 5-hour usage windows — both are use-at-your-own-risk under each provider's terms of service.

## Support & contributing

Found a bug or have an idea? Open an issue on [GitHub](https://github.com/beecode-rs/usage-pulse/issues) — include the app version, your OS, and the steps to reproduce. Pull requests are welcome too; keep the [feature status](#feature-status) in mind, and open an issue before starting something large.

## For developers

The README covers using the app. To work on it:

- [Development setup](resource/docs/development.md) — prerequisites, daily commands, quality gates
- [Architecture](resource/docs/architecture.md) — how the source is layered
- [Releasing](resource/docs/releasing.md) — tag-driven releases
- [Trackers reference](resource/docs/trackers.md) — provider endpoints, token storage, getting tokens
- [Provider catalog decision](resource/docs/provider-catalog.md) — where the provider catalog data belongs
- [LifeCycle audit](resource/docs/life-cycle-audit.md) — app-boot lifecycle closure audit

## License

[MIT](LICENSE)
