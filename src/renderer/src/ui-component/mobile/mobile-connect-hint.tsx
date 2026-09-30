import { type ReactElement } from 'react'

export const MobileConnectHint = (): ReactElement => {
  return (
    <p className="mobile-hint">
      From your phone, connect to this computer&apos;s VPN IP and the port above, using the pairing token.
    </p>
  )
}
