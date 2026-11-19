import { createBrowserRouter, Navigate, RouterProvider } from 'react-router'
import AppLayout from './components/layout/AppLayout'
import RequireSession from './components/layout/RequireSession'
import { BootLoader } from './components/ui/Loading'

// One route per page in src/pages (same pattern as HQ: each page downloads when first opened).
// Sign in is a full page with no sidebar; every other page needs the team password (RequireSession)
// and sits inside AppLayout (sidebar + main area).
const page = (load: () => Promise<{ default: React.ComponentType }>) => async () => ({ Component: (await load()).default })

const router = createBrowserRouter([
  // Public
  { path: '/login', lazy: page(() => import('./pages/LoginPage')), hydrateFallbackElement: <BootLoader /> },
  // Signed in only
  {
    element: <RequireSession />,
    hydrateFallbackElement: <BootLoader />,
    children: [
      {
        element: <AppLayout />,
        children: [{ path: '/', lazy: page(() => import('./pages/HomePage')) }],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
