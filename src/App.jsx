import { readableTextOn } from './lib/color'
import { OnboardingScreen } from './onboarding/OnboardingScreen'
import { useOnboardingState } from './onboarding/useOnboardingState'
import { DashboardScreen } from './dashboard/DashboardScreen'
import { BakeryDecorations } from './components/BakeryBackdrop'
import { TenantSession } from './dashboard/TenantSession'

function App() {
  const [state, actions] = useOnboardingState({ dashboard: new URLSearchParams(window.location.search).has('dashboard') })

  const brandVars = {
    '--brand': state.brandColor,
    '--brand-light': `color-mix(in oklab, ${state.brandColor} 10%, white)`,
    '--on-brand': readableTextOn(state.brandColor),
  }

  if (state.launched) {
    return (
      <div className="brand-scope h-full w-full" style={brandVars}>
        <TenantSession><DashboardScreen
          state={state}
          actions={actions}
          onEdit={actions.unlaunch}
          onStartOver={actions.reset}
        /></TenantSession>
      </div>
    )
  }

  return (
    <div className="setup-page-shell brand-scope relative min-h-full overflow-hidden bg-primary-light" style={brandVars}>
      <BakeryDecorations setup />
      <main className="relative z-10 h-full min-w-0 overflow-y-auto">
        <OnboardingScreen state={state} actions={actions} />
      </main>
    </div>
  )
}

export default App
