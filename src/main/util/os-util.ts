import { OS } from '#src/shared/os-model'

export { OS }

export const osUtil = {
  resolvePlatform: (): OS => {
    switch (process.platform) {
      case 'darwin': {
        return OS.MACOS
      }

      case 'linux': {
        return OS.LINUX
      }

      case 'win32': {
        return OS.WINDOWS
      }

      default: {
        throw new Error(`Unsupported process.platform value: '${process.platform}'`)
      }
    }
  },
}
