import { Outlet, useLocation, useNavigation } from 'react-router'
import ErrorBoundary from '../ui/ErrorBoundary'
import { TopBar } from '../ui/Loading'
import Sidebar from './Sidebar'

// Page frame, same as HQ's AppLayout: sidebar on the left, page on the right (max 1240px,
// 1440px on big monitors). Phones (≤900px): the sidebar becomes a top bar with a Menu button.
export default function AppLayout() {
  const loading = useNavigation().state === 'loading'
  const location = useLocation()
  return (
    <div className="flex min-h-screen items-stretch bg-vv-cream font-body text-vv-ink phone:flex-col">
      {loading && <TopBar />}
      <Sidebar />
      <main className="box-border min-w-0 flex-1 px-10 pb-20 pt-7 phone:px-4 phone:pb-28 phone:pt-5">
        <div className="mx-auto flex w-full max-w-[1240px] flex-col gap-7 phone:gap-5 wide:max-w-[1440px]">
          {/* One page crashing never takes the sidebar with it; moving to another page clears it. */}
          <ErrorBoundary name="this page" resetKey={location.pathname}>
            <Outlet />
          </ErrorBoundary>
        </div>
      </main>
    </div>
  )
}
