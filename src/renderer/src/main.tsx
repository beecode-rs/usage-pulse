import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { AppShell } from '#src/renderer/src/ui-component/app-shell/app-shell'
import { appTitleUtil } from '#src/shared/util/app-title-util'

document.title = appTitleUtil.resolve({ isDev: import.meta.env.DEV })

const rootElement = document.getElementById('root')

if (rootElement === null) {
  throw new Error('root element not found')
}

createRoot(rootElement).render(
  <StrictMode>
    <AppShell />
  </StrictMode>,
)
