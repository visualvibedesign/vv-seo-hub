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
          { path: '/templates', lazy: page(() => import('./pages/TemplatesPage')) },
          { path: '/templates/new', lazy: page(() => import('./pages/TemplateEditorPage')) },
          { path: '/templates/:id/edit', lazy: page(() => import('./pages/TemplateEditorPage')) },
          // Settings: Industries, Claude usage, Automation (built next). /automation is now a Settings card.
          { path: '/settings', lazy: page(() => import('./pages/HubComingSoonPage')) },
          { path: '/automation', element: <Navigate to="/settings" replace /> },
          // Client setup (Strategy Builder › Day 1) is the client form: its own page frame (title, breadcrumb, save bar).
          { path: '/clients/:siteId/strategy/setup', lazy: page(() => import('./pages/ClientFormPage')) },
          // A client: /clients/{site id} = the client Overview (results + quick access; the address the agency hub and
          // Vibe SEO plugin link to). /clients/{site id}/strategy/… = the Strategy Builder. See src/lib/clientSetup.ts.
          {
            path: '/clients/:siteId',
            lazy: page(() => import('./components/layout/ClientLayout')),
            children: [
              // Overview area
              { index: true, lazy: page(() => import('./pages/client/OverviewPage')) },
              { path: 'baseline', lazy: page(() => import('./pages/client/BaselinePage')) },
              { path: 'results', lazy: page(() => import('./pages/client/ResultsPage')) },
              { path: 'site-check', lazy: page(() => import('./pages/client/SiteCheckPage')) },
              { path: 'notes', lazy: page(() => import('./pages/client/NotesPage')) },
              { path: 'site', lazy: page(() => import('./pages/client/ConnectionPage')) },
              { path: 'conversions', lazy: page(() => import('./pages/client/ComingSoonPage')) },
              // Strategy Builder
              { path: 'strategy', lazy: page(() => import('./pages/client/StrategyHomePage')) },
              { path: 'strategy/guide', lazy: page(() => import('./pages/client/GuidePage')) },
              { path: 'strategy/uploads', lazy: page(() => import('./pages/client/UploadsPage')) },
              { path: 'strategy/keywords', lazy: page(() => import('./pages/client/MatrixPage')) },
              { path: 'strategy/keywords/import', lazy: page(() => import('./pages/client/ImportPage')) },
              { path: 'strategy/keywords/database', lazy: page(() => import('./pages/client/DatabasePage')) },
              { path: 'strategy/keywords/clusters', lazy: page(() => import('./pages/client/ClustersPage')) },
              { path: 'strategy/*', lazy: page(() => import('./pages/client/ComingSoonPage')) },
              // Old addresses (edit, guide, uploads, keywords…, reports, review…) → their new place, query kept.
              { path: '*', lazy: page(() => import('./pages/client/LegacyRedirect')) },
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
