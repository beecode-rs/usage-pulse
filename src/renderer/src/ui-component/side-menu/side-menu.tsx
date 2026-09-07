import { type ReactElement } from 'react'

import '#src/renderer/src/ui-component/side-menu/side-menu.css'
import { type MenuStatusDotMapper } from '#src/renderer/src/business/enum/menu-status-dot-mapper-enum'

export type SideMenuItem<ItemId extends string> = {
  icon: ReactElement
  id: ItemId
  isLive?: boolean
  label: string
  statusDot?: MenuStatusDotMapper
  statusDotTitle?: string
}

const resolveCollapseToggleTitle = (params: { isCollapsed: boolean }): string | undefined => {
  const { isCollapsed } = params
  if (isCollapsed) {
    return 'Expand'
  }

  return undefined
}

export const SideMenu = <ItemId extends string>(props: {
  activeItemId: ItemId
  footerItems?: SideMenuItem<ItemId>[]
  isCollapsed: boolean
  items: SideMenuItem<ItemId>[]
  onSelectItem: (itemId: ItemId) => void
  onToggleCollapse: () => void
  statusDot?: MenuStatusDotMapper
  statusDotTitle?: string
  title: string
}): ReactElement => {
  const {
    activeItemId,
    footerItems,
    isCollapsed,
    items,
    onSelectItem,
    onToggleCollapse,
    statusDot,
    statusDotTitle,
    title,
  } = props
  const collapseToggleTitle = resolveCollapseToggleTitle({ isCollapsed })

  const resolveMenuClassName = (): string => {
    if (isCollapsed) {
      return 'side-menu side-menu-collapsed'
    }

    return 'side-menu'
  }

  const resolveBrandDotClassName = (params: { statusDot: MenuStatusDotMapper | undefined }): string => {
    const { statusDot } = params
    if (statusDot === undefined) {
      return 'side-menu-brand-dot'
    }

    return `side-menu-brand-dot is-${statusDot}`
  }

  const resolveItemClassName = (params: { itemId: ItemId }): string => {
    const { itemId } = params
    if (itemId === activeItemId) {
      return 'side-menu-item side-menu-item-active'
    }

    return 'side-menu-item'
  }

  const resolveItemTitle = (params: { label: string }): string | undefined => {
    const { label } = params
    if (isCollapsed) {
      return label
    }

    return undefined
  }

  const resolveItemIconClassName = (params: { isLive: boolean }): string => {
    const { isLive } = params
    if (isLive) {
      return 'side-menu-item-icon side-menu-item-icon-live'
    }

    return 'side-menu-item-icon'
  }

  const renderStatusDot = (params: { item: SideMenuItem<ItemId> }): ReactElement | undefined => {
    const { item } = params
    const { statusDot: itemStatusDot, statusDotTitle: itemStatusDotTitle } = item

    if (itemStatusDot === undefined) {
      return undefined
    }

    return <span className={`side-menu-item-status-dot is-${itemStatusDot}`} title={itemStatusDotTitle} />
  }

  const renderItem = (params: { item: SideMenuItem<ItemId> }): ReactElement => {
    const { item } = params

    return (
      <button
        className={resolveItemClassName({ itemId: item.id })}
        key={item.id}
        onClick={() => {
          onSelectItem(item.id)
        }}
        title={resolveItemTitle({ label: item.label })}
        type="button"
      >
        <span className={resolveItemIconClassName({ isLive: item.isLive === true })}>
          {item.icon}
          {renderStatusDot({ item })}
        </span>
        {!isCollapsed && <span className="side-menu-item-label">{item.label}</span>}
      </button>
    )
  }

  const renderFooterItems = (): ReactElement | undefined => {
    if (footerItems === undefined || footerItems.length === 0) {
      return undefined
    }

    return (
      <div className="side-menu-footer">
        {footerItems.map((item) => {
          return renderItem({ item })
        })}
      </div>
    )
  }

  const renderCollapseIcon = (): ReactElement => {
    if (isCollapsed) {
      return (
        <svg
          fill="none"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          viewBox="0 0 24 24"
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )
    }

    return (
      <svg
        fill="none"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        viewBox="0 0 24 24"
      >
        <polyline points="15 18 9 12 15 6" />
      </svg>
    )
  }

  return (
    <nav aria-label="Main navigation" className={resolveMenuClassName()}>
      <div className="side-menu-brand">
        <span className={resolveBrandDotClassName({ statusDot })} title={statusDotTitle} />
        {!isCollapsed && <span className="side-menu-brand-label">{title}</span>}
      </div>
      <div className="side-menu-items">
        {items.map((item) => {
          return renderItem({ item })
        })}
      </div>
      {renderFooterItems()}
      <button
        aria-label={collapseToggleTitle}
        className="side-menu-collapse-toggle"
        onClick={onToggleCollapse}
        title={collapseToggleTitle}
        type="button"
      >
        {renderCollapseIcon()}
        {!isCollapsed && <span className="side-menu-item-label">Collapse</span>}
      </button>
    </nav>
  )
}
