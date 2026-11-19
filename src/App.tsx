import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import AppLayout from './components/layout/AppLayout'
import { BootLoader } from './components/ui/Loading'

// One route per page in src/pages (same pattern as HQ: each page downloads when first opened).
// Setup only: one placeholder page. Sign-in (RequireSession, team password) comes in phase 1.
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default })

const router = createBrowserRouter([
  {
    element: <AppLayout />,
    hydrateFallbackElement: <BootLoader />,
    children: [{ path: '/', lazy: page(() => import('./pages/HomePage')) }],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
