import { mshEnv, mshEnvResolver } from '@beecode/msh-env'

const env = mshEnv()

export const config = mshEnvResolver({
  httpTimeoutMs: env('USAGE_PULSE_HTTP_TIMEOUT_MS').number.default(15000),
})
