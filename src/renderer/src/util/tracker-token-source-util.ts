import { ClaudeTokenSource } from '#src/shared/business/enum/claude-token-source-enum'
import { OS } from '#src/shared/business/enum/os-enum'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { type TrackerConfig } from '#src/shared/business/model/settings-model'

export type TrackerSystemTokenOption = {
  hint: string
  label: string
}

export type TrackerTokenSelection = {
  selectedTokenSource: ClaudeTokenSource
  systemTokenOption?: TrackerSystemTokenOption
}

export const trackerTokenSourceUtil = {
  normalizeConfig: (params: { config: TrackerConfig; osPlatform: OS }): TrackerConfig => {
    if (params.config.providerId !== ProviderIdMapper.CLAUDE || params.osPlatform !== OS.WINDOWS) {
      return params.config
    }

    if (params.config.tokenSource !== ClaudeTokenSource.SYSTEM) {
      return params.config
    }

    return { ...params.config, tokenSource: ClaudeTokenSource.MANUAL }
  },

  resolveSelection: (params: { config: TrackerConfig; osPlatform: OS }): TrackerTokenSelection => {
    if (params.config.providerId !== ProviderIdMapper.CLAUDE) {
      return { selectedTokenSource: ClaudeTokenSource.MANUAL }
    }

    switch (params.osPlatform) {
      case OS.LINUX: {
        return {
          selectedTokenSource: params.config.tokenSource,
          systemTokenOption: {
            hint: 'Reads the OAuth token from ~/.claude/.credentials.json on every poll, so it tracks the one Claude Code account logged in on this machine.',
            label: 'Use system token (logged-in Claude Code)',
          },
        }
      }

      case OS.MACOS: {
        return {
          selectedTokenSource: params.config.tokenSource,
          systemTokenOption: {
            hint: 'Reads the OAuth token from the macOS Keychain entry "Claude Code-credentials" on every poll, so it tracks the one Claude Code account logged in on this machine. Not available on Windows yet.',
            label: 'Use system token (macOS Keychain)',
          },
        }
      }

      default: {
        return { selectedTokenSource: ClaudeTokenSource.MANUAL }
      }
    }
  },
}
