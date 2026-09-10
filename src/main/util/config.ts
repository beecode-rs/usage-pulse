import { mshEnv, mshEnvResolver } from '@beecode/msh-env'

const env = mshEnv()

export const config = mshEnvResolver({
  appImage: env('APPIMAGE').string.optional,
  httpTimeoutMs: env('USAGE_PULSE_HTTP_TIMEOUT_MS').number.default(15000),
  noSandboxReexec: env('USAGE_PULSE_NO_SANDBOX_REEXEC').boolean.optional,
  rendererUrl: env('ELECTRON_RENDERER_URL').string.optional,
  waylandDisplay: env('WAYLAND_DISPLAY').string.optional,
  xdgConfigHome: env('XDG_CONFIG_HOME').string.optional,
  xdgSessionType: env('XDG_SESSION_TYPE').string.optional,
})
