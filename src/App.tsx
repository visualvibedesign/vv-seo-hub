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
        children: [
          { path: '/', lazy: page(() => import('./pages/HomePage')) },
          { path: '/clients', lazy: page(() => import('./pages/ClientsPage')) },
          { path: '/clients/new', lazy: page(() => import('./pages/AddClientPage')) },
          { path: '/clients/import', lazy: page(() => import('./pages/AddClientsCsvPage')) },
          { path: '/clients/:siteId/edit', lazy: page(() => import('./pages/ClientFormPage')) },
          // Hub pages not built yet (Templates: phase 1, Automation: phase 5)
          { path: '/templates', lazy: page(() => import('./pages/TemplatesPage')) },
          { path: '/templates/new', lazy: page(() => import('./pages/TemplateEditorPage')) },
          { path: '/templates/:id/edit', lazy: page(() => import('./pages/TemplateEditorPage')) },
          { path: '/automation', lazy: page(() => import('./pages/HubComingSoonPage')) },
          // Client workspace: /clients/{site id} is the address the agency hub + Vibe SEO plugin link to.
          // Its sections are in the sidebar (src/lib/clientSetup.ts CLIENT_TOP + CLIENT_GROUPS).
          {
            path: '/clients/:siteId',
            lazy: page(() => import('./components/layout/ClientLayout')),
            children: [
              { index: true, lazy: page(() => import('./pages/client/OverviewPage')) },
              { path: 'guide', lazy: page(() => import('./pages/client/GuidePage')) },
              { path: 'uploads', lazy: page(() => import('./pages/client/UploadsPage')) },
              { path: 'keywords/import', lazy: page(() => import('./pages/client/ImportPage')) },
              { path: 'keywords/database', lazy: page(() => import('./pages/client/DatabasePage')) },
              { path: 'keywords/clusters', lazy: page(() => import('./pages/client/ClustersPage')) },
              { path: 'keywords/*', lazy: page(() => import('./pages/client/ComingSoonPage')) },
              { path: 'keywords', lazy: page(() => import('./pages/client/MatrixPage')) },
              { path: ':tab', lazy: page(() => import('./pages/client/ComingSoonPage')) },
            ],
          },
        ],
      },
    ],
  },
  { path: '*', element: <Navigate to="/" replace /> },
])

export default function App() {
  return <RouterProvider router={router} />
}
