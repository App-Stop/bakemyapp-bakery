import { SetupView } from './setup/SetupView'
import { PlanView } from './setup/PlanView'
import { SupportView } from './support/SupportView'
import { LoyaltyView } from './loyalty/LoyaltyView'
import { useEffect, useState } from 'react'
import { useRemote } from '../lib/useRemote'
import { HugeiconsIcon } from '@hugeicons/react'
import {
  DashboardCircleIcon,
  MenuRestaurantIcon,
  Store03Icon,
  ShoppingBasket03Icon,
  CreditCardIcon,
  UserGroup02Icon,
  AnalyticsUpIcon,
  Setting07Icon,
  DiscountIcon,
  CroissantIcon,
  Menu01Icon,
  Cancel01Icon,
} from '@hugeicons/core-free-icons'

import userAvatarImg from '../assets/dashboard/user-avatar.webp'
import { BranchesView } from './branches/BranchesView'
import { MenuView } from './menu/MenuView'
import { CustomersView } from './customers/CustomersView'
import { TeamView } from './team/TeamView'
import { PaymentsView } from './payments/PaymentsView'
import { canManagePayments } from './payments/paymentHelpers'
import { PricingView } from './pricing/PricingView'
import { OverviewView } from './overview/OverviewView'
import { AnalyticsView } from './analytics/AnalyticsView'
import { SettingsView } from './settings/SettingsView'
import { OrdersView } from './orders/OrdersView'
import { useTenant } from '../lib/TenantContext'
import { can, tenant } from '../lib/tenant'
import { readableTextOn } from '../lib/color'
import { DesignIcon } from './shared/CatalogUI'

const DESIGN_NAV_ICONS = { overview: 'bc1b9', menu: '4b588', branches: 'b33e1', orders: '5fa5c', customers: '29069', team: '29069', payments: '4dac1', pricing: '7cd30', analytics: 'fc6bd', settings: '4dac1' }

const NAV_ITEMS = [
  { id: 'overview', label: 'Overview', icon: DashboardCircleIcon },
  { id: 'setup', label: 'Bakery setup', icon: Store03Icon },
  { id: 'menu', label: 'Menu', icon: MenuRestaurantIcon },
  { id: 'branches', label: 'Branches', icon: Store03Icon },
  { id: 'orders', label: 'Orders', icon: ShoppingBasket03Icon },
  { id: 'customers', label: 'Customers', icon: UserGroup02Icon },
  { id: 'team', label: 'Team', icon: UserGroup02Icon },
  { id: 'payments', label: 'Payments', icon: CreditCardIcon },
  { id: 'pricing', label: 'Pricing', icon: DiscountIcon },
  { id: 'analytics', label: 'Analytics', icon: AnalyticsUpIcon },
  { id: 'support', label: 'Support', icon: UserGroup02Icon },
  { id: 'loyalty', label: 'Loyalty', icon: DiscountIcon },
  { id: 'plan', label: 'Your plan', icon: CreditCardIcon },
  { id: 'settings', label: 'Settings', icon: Setting07Icon },
]

function ProfileAvatar({ src, name }) {
  const [failedSrc, setFailedSrc] = useState(null)
  return <div className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#f0ece9] text-xs font-semibold" aria-label={name}>
    {failedSrc === src ? name?.trim().split(/\s+/).slice(0, 2).map((part) => part[0]).join('') : <img src={src} alt="" onError={() => setFailedSrc(src)} className="size-full object-cover" />}
  </div>
}

/** `className` sizes the screen: the full viewport by default, `h-full` inside a demo frame. */
export function DashboardScreen({ state, className = 'h-screen', sidebarLogo }) {
  const { user, branding, logout } = useTenant()
  const [activeNav, setActiveNav] = useState(user.role === 'branch_staff' ? 'orders' : can(user, 'menu:view') ? 'menu' : can(user, 'branches:view') ? 'branches' : can(user, 'team:view') ? 'team' : canManagePayments(user) ? 'payments' : 'orders')
  const [orderBranchId, setOrderBranchId] = useState('')
  const [supportTab, setSupportTab] = useState('tickets')
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [navOpen, setNavOpen] = useState(false)
  const setupAllowed = ['tenant_owner', 'tenant_manager'].includes(user.role) && can(user, 'setup:view')
  const setupArea = activeNav === 'setup' || activeNav === 'overview'
  const setup = useRemote(() => setupAllowed ? tenant.get('setup') : Promise.resolve(null), [setupAllowed, user.id, setupArea])
  const refreshSetup = setup.refresh
  useEffect(() => {
    if (!setupAllowed) return
    let timer
    const changed = () => { clearTimeout(timer); timer = setTimeout(refreshSetup, 100) }
    window.addEventListener('tenant-setup-changed', changed)
    return () => { clearTimeout(timer); window.removeEventListener('tenant-setup-changed', changed) }
  }, [setupAllowed, refreshSetup])
  const catalogDesign = ['orders', 'menu', 'branches'].includes(activeNav)

  const shopName = user.tenant?.name || state.shop?.name?.trim() || 'Your bakery'
  const shopTagline = state.shop?.tagline?.trim() || 'Freshly baked goods'
  const ownerName = user.name
  const visibleNav = NAV_ITEMS.filter((item) => {
    if (item.id === 'setup') return ['tenant_owner', 'tenant_manager'].includes(user.role) && can(user, 'setup:view')
    if (item.id === 'plan') return user.role === 'tenant_owner' && can(user, 'plan:view')
    if (item.id === 'loyalty') return canManagePayments(user)
    if (item.id === 'payments') return canManagePayments(user)
    if (item.id === 'pricing') return canManagePayments(user) || (['tenant_owner', 'tenant_manager'].includes(user.role) && can(user, 'menu:view'))
    const permission = { menu: 'menu:view', branches: 'branches:view', orders: 'orders:view', team: 'team:view' }[item.id]
    return permission ? can(user, permission) : user.role === 'tenant_owner' || user.role === 'tenant_manager'
  })

  const activeLabel = NAV_ITEMS.find((item) => item.id === activeNav)?.label
  const goTo = (id, options = {}) => {
    if (id === 'support') setSupportTab(options.tab || 'tickets')
    setActiveNav(id)
    setNavOpen(false)
  }

  return (
    <div style={/^#[0-9a-f]{6}$/i.test(branding?.primary || '') ? { '--brand': branding.primary, '--brand-light': `color-mix(in oklab, ${branding.primary} 10%, white)`, '--on-brand': readableTextOn(branding.primary) } : undefined} className={`brand-scope relative flex w-full overflow-hidden bg-[#f5f5f5] font-sans text-ink max-lg:flex-col ${className}`}>
      {/* Phones and tablets: a top bar whose menu button slides the sidebar in as a drawer. */}
      <header className="flex shrink-0 items-center gap-3 border-b border-[#f0ece9] bg-white px-4 py-3 lg:hidden max-sm:justify-between max-sm:border-0 max-sm:bg-transparent max-sm:pt-1 max-sm:pb-0">
        <button
          type="button"
          onClick={() => setNavOpen(true)}
          aria-label="Open navigation"
          aria-expanded={navOpen}
          aria-controls="dashboard-sidebar"
          className="flex size-10 shrink-0 items-center justify-center rounded-xl border border-[#e8e8e8] text-ink transition-colors hover:bg-[#f5f5f5] max-sm:border-0 max-sm:bg-white"
        >
          <HugeiconsIcon icon={Menu01Icon} size={20} color="currentColor" />
        </button>
        <p className={`min-w-0 flex-1 truncate text-base font-semibold text-ink ${sidebarLogo ? 'max-sm:hidden' : ''}`}>{activeLabel}</p>
        {sidebarLogo && <div className="h-[37.944px] w-[52.08px] shrink-0 sm:hidden [&>*]:!size-full">{sidebarLogo}</div>}
        <ProfileAvatar src={state.shop?.logo || (catalogDesign ? '/figma/catalog/80d35.png' : userAvatarImg)} name={ownerName} />
      </header>

      {navOpen && (
        <button
          type="button"
          aria-label="Close navigation"
          onClick={() => setNavOpen(false)}
          className="absolute inset-0 z-30 bg-black/30 lg:hidden"
        />
      )}

      {/* Sidebar */}
      <aside
        id="dashboard-sidebar"
        className={`flex w-[260px] min-w-[260px] flex-col ${catalogDesign ? 'justify-start gap-10' : 'justify-between'} overflow-y-auto border-r border-[#f0ece9] bg-white px-5 py-5 shrink-0 transition-transform duration-300 max-lg:absolute max-lg:inset-y-0 max-lg:left-0 max-lg:z-40 max-lg:max-w-[85%] max-lg:min-w-0 max-lg:shadow-2xl lg:py-8 ${
          navOpen ? '' : 'max-lg:invisible max-lg:-translate-x-full'
        }`}
      >
        <button
          type="button"
          onClick={() => setNavOpen(false)}
          aria-label="Close navigation"
          className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-full text-muted hover:bg-[#f5f5f5] lg:hidden"
        >
          <HugeiconsIcon icon={Cancel01Icon} size={18} color="currentColor" />
        </button>
        <div className="flex flex-col gap-6 lg:gap-10">
          {/* Shop branding */}
          {sidebarLogo ? (
            typeof sidebarLogo === 'string' ? (
              <img src={sidebarLogo} alt="Bake My App" className="w-20 object-contain" />
            ) : (
              sidebarLogo
            )
          ) : (
            <div className="flex w-full items-center gap-2.5">
              <div className="flex size-10 lg:size-[46px] shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand text-on-brand shadow-sm">
                {state.shop?.logo ? (
                  <img src={state.shop.logo} alt="" className="size-full object-contain p-1.5" />
                ) : (
                  catalogDesign ? <DesignIcon file="98c00" /> : <HugeiconsIcon icon={CroissantIcon} size={28} color="currentColor" />
                )}
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-base font-semibold leading-tight text-ink" title={shopName}>
                  {shopName}
                </p>
                <p className="truncate text-xs text-muted" title={shopTagline}>
                  {shopTagline}
                </p>
              </div>
            </div>
          )}

          {/* Navigation */}
          <nav className="flex flex-col gap-2">
            {visibleNav.map((item) => {
              const isActive = activeNav === item.id
              const Icon = item.icon
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => goTo(item.id)}
                  className={`flex w-full items-center gap-3 rounded-xl p-3 text-left transition-colors ${
                    isActive
                      ? 'bg-brand-light text-brand font-medium'
                      : 'text-body hover:bg-[#f5f5f5] font-normal'
                  }`}
                >
                  {catalogDesign && DESIGN_NAV_ICONS[item.id] && item.id !== 'payments' ? <DesignIcon folder={isActive && item.id === 'branches' ? 'branches' : 'catalog'} file={isActive ? { menu: 'b16db', orders: '7b7cb', branches: '0eeb5' }[item.id] : DESIGN_NAV_ICONS[item.id]} /> : <HugeiconsIcon
                    icon={Icon}
                    size={20}
                    color={isActive ? 'var(--brand)' : 'currentColor'}
                    className="shrink-0"
                  />}
                  <span className="text-sm">{item.label}</span>
                </button>
              )
            })}
          </nav>
        </div>

        {/* User Capsule */}
        <div className={`relative flex flex-col ${catalogDesign ? 'gap-5' : 'gap-4 border-t border-[#f0ece9] pt-5'}`}>
          {catalogDesign && <DesignIcon file="f5ba5" className="self-start" />}
          <button
            type="button"
            onClick={() => setShowUserMenu(!showUserMenu)}
            className={`flex w-full items-center gap-3 rounded-xl ${catalogDesign ? '' : 'p-1.5'} text-left transition-colors hover:bg-[#f5f5f5]`}
          >
            <ProfileAvatar src={state.shop?.logo || (catalogDesign ? '/figma/catalog/80d35.png' : userAvatarImg)} name={ownerName} />
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
              <p className="truncate text-sm font-semibold text-ink">{ownerName}</p>
              <p className="text-xs text-brand font-normal">{user.roleName}{user.branch?.name ? ` · ${user.branch.name}` : ''}</p>
            </div>
          </button>

          {/* User Popover / Store controls */}
          {showUserMenu && (
            <div className="absolute bottom-[65px] left-0 w-full rounded-xl border border-[#e8e8e8] bg-white p-2 shadow-xl z-20">
              <button type="button" onClick={logout} className="w-full rounded-lg px-3 py-2 text-left text-sm font-medium hover:bg-[#f5f5f5]">Sign out</button>
              {user.role !== 'branch_staff' && <>
              <button
                type="button"
                onClick={() => {
                  setShowUserMenu(false)
                  goTo('settings')
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-xs font-medium text-ink hover:bg-[#f5f5f5] cursor-pointer"
              >
                <HugeiconsIcon icon={Setting07Icon} size={16} />
                <span>Store Settings</span>
              </button>
              </>}
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="min-h-0 min-w-0 flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 xl:p-10 max-sm:pt-4 max-sm:pb-10">
        {user.tenant?.status === 'onboarding' && setupAllowed && <div className="workspace-warning mb-5 flex flex-wrap items-center justify-between gap-3"><p>{setup.data?.data?.complete ? 'Your setup is complete. Contact Bake My App to activate your bakery.' : 'Finish setting up your bakery to get ready for customers.'}</p><button className="rounded-full border border-[#e6d2aa] bg-white px-4 py-2 text-xs font-semibold" onClick={() => goTo('setup')}>Review bakery setup</button></div>}
        {activeNav === 'setup' ? <SetupView onNavigate={goTo} remote={setup} /> : activeNav === 'plan' ? <PlanView /> : activeNav === 'support' ? <SupportView key={supportTab} initialTab={supportTab} /> : activeNav === 'loyalty' ? <LoyaltyView /> : activeNav === 'orders' ? (
          <OrdersView key={orderBranchId} initialBranchId={orderBranchId} />
        ) : activeNav === 'settings' ? (
          <SettingsView />
        ) : activeNav === 'menu' ? (
          <MenuView />
        ) : activeNav === 'branches' ? (
          <BranchesView onNavigateToOrders={(branchId) => { setOrderBranchId(branchId); setActiveNav('orders') }} />
        ) : activeNav === 'customers' ? (
          <CustomersView onNavigate={goTo} />
        ) : activeNav === 'team' ? (
          <TeamView />
        ) : activeNav === 'payments' ? (
          <PaymentsView />
        ) : activeNav === 'pricing' ? (
          <PricingView />
        ) : activeNav === 'analytics' ? (
          <AnalyticsView />
        ) : activeNav === 'overview' ? (
          <OverviewView onNavigate={goTo} setupRemote={setup} />
      ) : (
        <div className="mx-auto flex max-w-[1360px] flex-col items-center justify-center gap-4 rounded-[20px] bg-white p-16 text-center shadow-[0px_4px_10px_rgba(0,0,0,0.02)]">
          <h2 className="text-xl font-semibold capitalize text-ink">{activeNav}</h2>
          <p className="text-sm text-muted">This section is coming soon. You can explore Overview or Branches.</p>
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={() => setActiveNav('overview')}
              className="rounded-full bg-brand-light px-5 py-2.5 text-sm font-semibold text-brand cursor-pointer hover:opacity-90"
            >
              Go to Overview
            </button>
            <button
              type="button"
              onClick={() => setActiveNav('branches')}
              className="rounded-full bg-brand px-5 py-2.5 text-sm font-semibold text-white cursor-pointer hover:opacity-90"
            >
              Go to Branches
            </button>
          </div>
        </div>
      )}
      </main>
    </div>
  )
}
