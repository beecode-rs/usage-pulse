import { OS } from '#src/shared/business/enum/os-enum'
import { ScheduleTriggerDayMapper } from '#src/shared/business/enum/schedule-trigger-day-mapper-enum'
import { UsageSeverityLevel } from '#src/shared/business/enum/usage-severity-level-enum'

const ghosttyBundleId = 'com.mitchellh.ghostty'

const ghosttyFrontWindowPoll = { count: 20, delayMs: 100 }

const ghosttyFrontWindowWaitSnippet = `    activate
    repeat ${String(ghosttyFrontWindowPoll.count)} times
      delay ${String(ghosttyFrontWindowPoll.delayMs / 1000)}
      if ((id of front window) as text) is targetWindowId then
        return "focused"
      end if
    end repeat
    return "hidden"`

const ghosttyTabFocusScript = `on run argv
  set sessionCwd to item 1 of argv
  set matchRank to item 2 of argv as integer
  set matchIndex to 0
  set targetWindowId to ""
  tell application id "${ghosttyBundleId}"
    repeat with ghosttyWindow in windows
      repeat with ghosttyTab in tabs of ghosttyWindow
        repeat with ghosttyTerminal in terminals of ghosttyTab
          set terminalCwd to working directory of ghosttyTerminal
          if terminalCwd is sessionCwd or terminalCwd is sessionCwd & "/" then
            if matchIndex is matchRank then
              set targetWindowId to (id of ghosttyWindow) as text
              select tab ghosttyTab
              focus ghosttyTerminal
              exit repeat
            end if
            set matchIndex to matchIndex + 1
          end if
        end repeat
        if targetWindowId is not "" then
          exit repeat
        end if
      end repeat
      if targetWindowId is not "" then
        exit repeat
      end if
    end repeat
    if targetWindowId is "" then
      return "missing"
    end if
${ghosttyFrontWindowWaitSnippet}
  end tell
end run`

const ghosttyTtyFocusScript = `on run argv
  set sessionTty to item 1 of argv
  set targetWindowId to ""
  tell application id "${ghosttyBundleId}"
    repeat with ghosttyWindow in windows
      repeat with ghosttyTab in tabs of ghosttyWindow
        repeat with ghosttyTerminal in terminals of ghosttyTab
          if (tty of ghosttyTerminal) is sessionTty then
            set targetWindowId to (id of ghosttyWindow) as text
            select tab ghosttyTab
            focus ghosttyTerminal
            exit repeat
          end if
        end repeat
        if targetWindowId is not "" then
          exit repeat
        end if
      end repeat
      if targetWindowId is not "" then
        exit repeat
      end if
    end repeat
    if targetWindowId is "" then
      return "missing"
    end if
${ghosttyFrontWindowWaitSnippet}
  end tell
end run`

const launchdWeekdayByTriggerDay: Record<ScheduleTriggerDayMapper, number> = {
  [ScheduleTriggerDayMapper.FRIDAY]: 5,
  [ScheduleTriggerDayMapper.MONDAY]: 1,
  [ScheduleTriggerDayMapper.SATURDAY]: 6,
  [ScheduleTriggerDayMapper.SUNDAY]: 0,
  [ScheduleTriggerDayMapper.THURSDAY]: 4,
  [ScheduleTriggerDayMapper.TUESDAY]: 2,
  [ScheduleTriggerDayMapper.WEDNESDAY]: 3,
}

const systemdDayByTriggerDay: Record<ScheduleTriggerDayMapper, string> = {
  [ScheduleTriggerDayMapper.FRIDAY]: 'Fri',
  [ScheduleTriggerDayMapper.MONDAY]: 'Mon',
  [ScheduleTriggerDayMapper.SATURDAY]: 'Sat',
  [ScheduleTriggerDayMapper.SUNDAY]: 'Sun',
  [ScheduleTriggerDayMapper.THURSDAY]: 'Thu',
  [ScheduleTriggerDayMapper.TUESDAY]: 'Tue',
  [ScheduleTriggerDayMapper.WEDNESDAY]: 'Wed',
}

const vscodeWindowRaiseScript = `on run argv
  set appBundlePath to item 1 of argv
  set windowIndex to item 2 of argv as integer
  set appId to id of application appBundlePath
  tell application "System Events"
    tell (first application process whose bundle identifier is appId)
      set frontmost to true
      perform action "AXRaise" of window windowIndex
    end tell
  end tell
end run`

const vscodeWindowTitlesScript = `on run argv
  set appBundlePath to item 1 of argv
  set appId to id of application appBundlePath
  tell application "System Events"
    tell (first application process whose bundle identifier is appId)
      set originalDelimiters to AppleScript's text item delimiters
      set AppleScript's text item delimiters to linefeed
      set windowNames to (name of every window) as text
      set AppleScript's text item delimiters to originalDelimiters
      return windowNames
    end tell
  end tell
end run`

export const constant = {
  appBundleRegex: /^(?:-)?(.*?\/[^/]+\.app)\//,
  digitsOnlyRegex: /^\d+$/,
  processLineRegex: /^\s*(\d+)\s+(.+)$/,
  scheduleTrigger: {
    gracePeriodMs: 5_000,
    idRegex: /^[A-Za-z0-9_-]+$/,
  },
  scheduling: {
    launchd: {
      labelPrefix: 'com.usage-pulse.trigger.',
      weekdayByTriggerDay: launchdWeekdayByTriggerDay,
    },
    systemd: {
      dayByTriggerDay: systemdDayByTriggerDay,
      execQuoteTriggerCharacters: new Set([
        ' ',
        '\t',
        '"',
        "'",
        '\\',
        ';',
        ',',
        '?',
        '*',
        '[',
        ']',
        '{',
        '}',
        '$',
        '&',
        '<',
        '>',
        '|',
        '(',
        ')',
        '`',
        '!',
        '#',
        '~',
      ]),
      runningStateRegex: /^(running|degraded|starting|initializing|stopping|maintenance)/,
      unitNamePrefix: 'usage-pulse-trigger-',
    },
  },
  sessions: {
    claudeQuery: {
      timeoutMs: 10_000,
    },
    focus: {
      ghostty: {
        automationDeniedMessage:
          'to focus the exact Ghostty tab, allow this app to control Ghostty in System Settings > Privacy & Security > Automation',
        bundleId: ghosttyBundleId,
        frontWindowPoll: ghosttyFrontWindowPoll,
        otherDesktopMessage:
          'the terminal is on another desktop or minimized; to let focus jump to it, enable "When switching to an application, switch to a Space with open windows for the application" in System Settings > Desktop & Dock',
        tabFocusScript: ghosttyTabFocusScript,
        ttyFocusScript: ghosttyTtyFocusScript,
        ttySupportProbeScript: `tell application id "${ghosttyBundleId}"
  count of (tty of every terminal)
end tell`,
      },
      linux: {
        focusTool: {
          checkTimeoutMs: 5_000,
          installTimeoutMs: 300_000,
        },
        xdotoolTimeoutMs: 5_000,
      },
      macOs: {
        openAppTimeoutMs: 5_000,
      },
      vscode: {
        accessibilityDeniedMessage:
          'to focus the exact VS Code window, allow this app to control your computer in System Settings > Privacy & Security > Accessibility',
        bundleBasename: 'Visual Studio Code.app',
        systemEventsDeniedMessage:
          'to focus the exact VS Code window, allow this app to control System Events in System Settings > Privacy & Security > Automation',
        titleSeparator: ' — ',
        windowRaiseScript: vscodeWindowRaiseScript,
        windowTitlesScript: vscodeWindowTitlesScript,
        workspaceNameCandidateLimit: 3,
      },
    },
    originOrder: {
      local: 0,
      ssh: 1,
    },
    osascript: {
      timeoutMs: 5_000,
    },
    processAncestry: {
      maxHops: 12,
    },
    psQuery: {
      timeoutMs: 5_000,
    },
    ssh: {
      connectTimeoutMs: 5_000,
      hostCacheTtlMs: 15_000,
      queryTimeoutMs: 10_000,
      remoteAgentsCommand: String.raw`bash -lc 'PATH="$HOME/.local/bin:$PATH" claude agents --json'`,
      remoteProbeCommand: 'true',
      testTimeoutMs: 8_000,
    },
  },
  sessionTranscript: {
    cacheEntryLimit: 500,
  },
  tcpPort: {
    max: 65_535,
    min: 1,
  },
  twoDigitTimeRegex: /^([0-9]{2}):([0-9]{2})$/,
  update: {
    assetSuffixesByOs: {
      [OS.LINUX]: ['.AppImage', '.deb'],
      [OS.MACOS]: ['.dmg'],
      [OS.WINDOWS]: ['.exe'],
    },
    downloadPartialFileSuffix: '.part',
  },
  usageSeverityLevelRank: {
    [UsageSeverityLevel.FILLING_UP]: 1,
    [UsageSeverityLevel.HIGH_USAGE]: 2,
    [UsageSeverityLevel.LIMIT_REACHED]: 3,
    [UsageSeverityLevel.NONE]: 0,
  },
}
