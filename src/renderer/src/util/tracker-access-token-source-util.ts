import { ClaudeAccessTokenSource } from '#src/shared/business/enum/claude-access-token-source-enum'
import { OS } from '#src/shared/business/enum/os-enum'
import { ProviderIdMapper } from '#src/shared/business/enum/provider-id-mapper-enum'
import { type TrackerConfig } from '#src/shared/business/model/settings-model'

export type TrackerSystemAccessTokenOption = {
  hint: string
  label: string
}

export type TrackerAccessTokenSelection = {
  selectedAccessTokenSource: ClaudeAccessTokenSource
  systemAccessTokenOption?: TrackerSystemAccessTokenOption
}

export const trackerAccessTokenSourceUtil = {
  normalizeConfig: (params: { config: TrackerConfig; osPlatform: OS }): TrackerConfig => {
    const { config, osPlatform } = params
    if (config.providerId !== ProviderIdMapper.CLAUDE || osPlatform !== OS.WINDOWS) {
      return config
    }

    if (config.accessTokenSource !== ClaudeAccessTokenSource.SYSTEM) {
      return config
    }

    return { ...config, accessTokenSource: ClaudeAccessTokenSource.MANUAL }
  },

  resolveSelection: (params: { config: TrackerConfig; osPlatform: OS }): TrackerAccessTokenSelection => {
    const { config, osPlatform } = params
    if (config.providerId !== ProviderIdMapper.CLAUDE) {
      return { selectedAccessTokenSource: ClaudeAccessTokenSource.MANUAL }
    }

    switch (osPlatform) {
      case OS.LINUX: {
        return {
          selectedAccessTokenSource: config.accessTokenSource,
          systemAccessTokenOption: {
            hint: 'Reads the OAuth token from ~/.claude/.credentials.json on every poll, so it tracks the one Claude Code account logged in on this machine.',
            label: 'Use system access token (logged-in Claude Code)',
          },
        }
      }

      case OS.MACOS: {
        return {
          selectedAccessTokenSource: config.accessTokenSource,
          systemAccessTokenOption: {
            hint: 'Reads the OAuth token from the macOS Keychain entry "Claude Code-credentials" on every poll, so it tracks the one Claude Code account logged in on this machine. Not available on Windows yet.',
            label: 'Use system access token (macOS Keychain)',
          },
        }
      }

      default: {
        return { selectedAccessTokenSource: ClaudeAccessTokenSource.MANUAL }
      }
    }
  },
}
