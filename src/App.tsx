import { Navigate, Route, Routes } from 'react-router-dom'
import { Layout } from './components/Layout'
import { landingFor, useSession } from './auth'
import type { Role } from './domain/types'
import { DirectoryPage } from './pages/DirectoryPage'
import { DaycareDetailPage } from './pages/DaycareDetailPage'
import { LoginPage } from './pages/LoginPage'
import { FamilyPage } from './pages/parent/FamilyPage'
import { ApplyPage } from './pages/parent/ApplyPage'
import { NotificationsPage } from './pages/parent/NotificationsPage'
import { WaitlistPage } from './pages/daycare/WaitlistPage'
import { PoliciesPage } from './pages/daycare/PoliciesPage'
import { FunderPage } from './pages/funder/FunderPage'
import { ItAdminPage } from './pages/it/ItAdminPage'

function RequireRole({ roles, children }: { roles: Role[]; children: React.ReactNode }) {
  const { grant, loading } = useSession()
  // Session resolution is async now — don't redirect while it loads.
  if (loading) return null
  // Signed-in users on a page their active grant can't see are sent to that
  // grant's home, not /login — this also settles the race when a dual-role
  // account switches context while viewing a role-restricted page.
  if (!grant || !roles.includes(grant.role)) return <Navigate to={landingFor(grant)} replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<DirectoryPage />} />
        <Route path="/daycare/:id" element={<DaycareDetailPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/family"
          element={
            <RequireRole roles={['parent']}>
              <FamilyPage />
            </RequireRole>
          }
        />
        <Route
          path="/apply"
          element={
            <RequireRole roles={['parent']}>
              <ApplyPage />
            </RequireRole>
          }
        />
        <Route
          path="/notifications"
          element={
            <RequireRole roles={['parent']}>
              <NotificationsPage />
            </RequireRole>
          }
        />
        <Route
          path="/waitlist"
          element={
            <RequireRole roles={['staff', 'daycare_admin']}>
              <WaitlistPage />
            </RequireRole>
          }
        />
        <Route
          path="/policies"
          element={
            <RequireRole roles={['daycare_admin']}>
              <PoliciesPage />
            </RequireRole>
          }
        />
        <Route
          path="/funder"
          element={
            <RequireRole roles={['funder']}>
              <FunderPage />
            </RequireRole>
          }
        />
        <Route
          path="/it"
          element={
            <RequireRole roles={['it_admin']}>
              <ItAdminPage />
            </RequireRole>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
