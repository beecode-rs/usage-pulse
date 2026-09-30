import { constant } from '#src/shared/util/constant'

export const userAgentUtil = {
  resolveAgentLabel: (params: { userAgent: string }): string => {
    const { userAgent } = params
    const nameByToken: Record<string, string> = {
      cfnetwork: 'CFNetwork',
      darwin: 'Darwin',
      expo: 'Expo',
      okhttp: 'OkHttp',
    }

    return userAgent
      .split(' ')
      .map((token) => {
        const [tokenName, ...tokenRest] = token.split('/')

        if (tokenName === undefined) {
          return token
        }

        const displayName = nameByToken[tokenName.toLowerCase()] ?? tokenName

        if (tokenRest.length === 0) {
          return displayName
        }

        return [displayName, ...tokenRest].join(' ')
      })
      .join(' ')
  },

  resolveDeviceName: (params: { userAgent: string }): string => {
    const { userAgent } = params

    if (userAgent === constant.mobileServer.unknownUserAgent) {
      return 'Unknown device'
    }

    const normalizedUserAgent = userAgent.toLowerCase()

    if (normalizedUserAgent.includes('expo')) {
      return 'Expo client'
    }

    if (normalizedUserAgent.includes('okhttp')) {
      return 'Android device'
    }

    if (normalizedUserAgent.includes('darwin')) {
      return 'Apple device'
    }

    if (normalizedUserAgent.includes('iphone')) {
      return 'iPhone'
    }

    if (normalizedUserAgent.includes('ipad')) {
      return 'iPad'
    }

    if (normalizedUserAgent.includes('android')) {
      return 'Android device'
    }

    if (normalizedUserAgent.includes('firefox')) {
      return 'Firefox'
    }

    if (normalizedUserAgent.includes('chrome')) {
      return 'Chrome'
    }

    if (normalizedUserAgent.includes('safari')) {
      return 'Safari'
    }

    return userAgent
  },
}
