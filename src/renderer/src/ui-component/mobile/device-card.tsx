import { type ReactElement } from 'react'

import { dateUtil } from '#src/renderer/src/util/date-util'
import { userAgentUtil } from '#src/renderer/src/util/user-agent-util'
import { type MobileConnectedDevice } from '#src/shared/business/model/mobile-api-model'
import { constant } from '#src/shared/util/constant'

export const MobileDeviceCard = (props: { device: MobileConnectedDevice }): ReactElement => {
  const { device } = props
  const hasUserAgent = device.userAgent !== constant.mobileServer.unknownUserAgent

  return (
    <div className="mobile-device-card">
      <div className="mobile-device-card-head">
        <span className="mobile-device-card-dot" />
        <span className="mobile-device-card-name">
          {userAgentUtil.resolveDeviceName({ userAgent: device.userAgent })}
        </span>
      </div>
      {hasUserAgent && (
        <div className="mobile-device-card-agent">
          {userAgentUtil.resolveAgentLabel({ userAgent: device.userAgent })}
        </div>
      )}
      <div className="mobile-device-card-meta">
        <span>{device.address}</span>
        <span>·</span>
        <span>Since {dateUtil.formatDateTime(device.connectedAt)}</span>
      </div>
    </div>
  )
}
