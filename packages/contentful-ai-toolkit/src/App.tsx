import { locations } from '@contentful/app-sdk'
import { useSDK } from '@contentful/react-apps-toolkit'
import { useMemo } from 'react'
import Sidebar from './locations/Sidebar'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const ComponentLocationSettings = {
  [locations.LOCATION_ENTRY_SIDEBAR]: Sidebar,
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnMount: false, refetchOnWindowFocus: false },
  },
})

const App = () => {
  const sdk = useSDK()

  const Component = useMemo(() => {
    for (const [location, component] of Object.entries(
      ComponentLocationSettings,
    )) {
      if (sdk.location.is(location)) {
        return component
      }
    }
  }, [sdk.location])

  return Component ? (
    <QueryClientProvider client={queryClient}>
      <Component />
    </QueryClientProvider>
  ) : null
}

export default App
