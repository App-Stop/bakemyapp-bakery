import { readableTextOn } from './lib/color'
import { useOnboardingState } from './onboarding/useOnboardingState'
import { DashboardScreen } from './dashboard/DashboardScreen'
import { TenantSession } from './dashboard/TenantSession'

function App() {
  const [state, actions] = useOnboardingState({ dashboard: true })

  const brandVars = {
    '--brand': state.brandColor,
    '--brand-light': `color-mix(in oklab, ${state.brandColor} 10%, white)`,
    '--on-brand': readableTextOn(state.brandColor),
  }

  return (
    <div className="brand-scope h-full w-full" style={brandVars}>
      <TenantSession>
        <DashboardScreen state={state} actions={actions} />
      </TenantSession>
    </div>
  )
}

export default App
