import { mshEnv, mshEnvResolver } from '@beecode/msh-env'
import { homedir } from 'node:os'
import { join } from 'node:path'

const env = mshEnv()

export const config = mshEnvResolver({
  appImage: env('APPIMAGE').string.optional,
  httpTimeoutMs: env('USAGE_PULSE_HTTP_TIMEOUT_MS').number.default(15000),
  launchctlTimeoutMs: env('USAGE_PULSE_LAUNCHCTL_TIMEOUT_MS').number.default(10000),
  noSandboxReexec: env('USAGE_PULSE_NO_SANDBOX_REEXEC').boolean.optional,
  rendererUrl: env('ELECTRON_RENDERER_URL').string.optional,
  systemctl: {
    probeTimeoutMs: env('USAGE_PULSE_SYSTEMCTL_PROBE_TIMEOUT_MS').number.default(5000),
    timeoutMs: env('USAGE_PULSE_SYSTEMCTL_TIMEOUT_MS').number.default(10000),
  },
  waylandDisplay: env('WAYLAND_DISPLAY').string.optional,
  xdg: {
    configHome: env('XDG_CONFIG_HOME').string.optional,
    sessionType: env('XDG_SESSION_TYPE').string.optional,
  },
})

export const processEnvWithUserLocalBinPath = (): NodeJS.ProcessEnv => {
  const childEnv: NodeJS.ProcessEnv = { ...process.env }

  childEnv.PATH = [join(homedir(), '.local', 'bin'), childEnv.PATH].filter(Boolean).join(':')

  return childEnv
}
