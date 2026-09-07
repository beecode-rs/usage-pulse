import { mshEnv, mshEnvResolver } from '@beecode/msh-env'

const env = mshEnv()

export const config = mshEnvResolver({
  appImage: env('APPIMAGE').string.optional,
  httpTimeoutMs: env('USAGE_PULSE_HTTP_TIMEOUT_MS').number.default(15000),
  launchctlTimeoutMs: env('USAGE_PULSE_LAUNCHCTL_TIMEOUT_MS').number.default(10000),
  noSandboxReexec: env('USAGE_PULSE_NO_SANDBOX_REEXEC').boolean.optional,
  rendererUrl: env('ELECTRON_RENDERER_URL').string.optional,
  systemctlProbeTimeoutMs: env('USAGE_PULSE_SYSTEMCTL_PROBE_TIMEOUT_MS').number.default(5000),
  systemctlTimeoutMs: env('USAGE_PULSE_SYSTEMCTL_TIMEOUT_MS').number.default(10000),
  waylandDisplay: env('WAYLAND_DISPLAY').string.optional,
  xdgConfigHome: env('XDG_CONFIG_HOME').string.optional,
  xdgSessionType: env('XDG_SESSION_TYPE').string.optional,
})
