import { type ReactElement } from 'react'

import { MobileDeviceCard } from '#src/renderer/src/ui-component/mobile/mobile-device-card'
import { type MobileConnectedDevice } from '#src/shared/business/model/mobile-api-model'

export const MobileDeviceList = (props: { devices: MobileConnectedDevice[] }): ReactElement => {
  const { devices } = props

  if (devices.length === 0) {
    return <p className="mobile-devices-empty">No devices connected yet.</p>
  }

  return (
    <div className="mobile-device-list">
      {devices.map((device) => {
        return <MobileDeviceCard device={device} key={device.id} />
      })}
    </div>
  )
}
