import { useState } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { landingFor, logout, switchGrant, useSession } from '../auth'
import { resetDemo } from '../domain/store'
import type { RoleGrant } from '../domain/types'
import { Badge } from './ui'

function roleLabel(t: (k: string, d: string) => string, grant: RoleGrant): string {
  switch (grant.role) {
    case 'parent':
      return t('role.parent', 'Parent')
    case 'staff':
      return t('role.staff', 'Daycare staff')
    case 'daycare_admin':
      return t('role.daycareAdmin', 'Daycare admin')
    case 'funder':
      return t('role.funder', 'Funder / Government')
    case 'it_admin':
      return t('role.itAdmin', 'IT Administrator')
  }
}

export function Layout({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation()
  const { db, user, grant } = useSession()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)

  const unread = user ? db.notifications.filter((n) => n.userId === user.id && !n.read).length : 0
  const grantDaycare = grant?.daycareId ? db.daycares.find((d) => d.id === grant.daycareId) : null

  const navClass = ({ isActive }: { isActive: boolean }) =>
    `rounded-lg px-3 py-1.5 text-sm font-medium ${isActive ? 'bg-arctic-800 text-white' : 'text-arctic-100 hover:bg-arctic-600'}`

  return (
    <div className="min-h-screen">
      <div className="bg-amber-100 px-4 py-1.5 text-center text-xs text-amber-900">
        {t('demo.banner', 'Demo mode — local sample data, no real families. The production build connects to self-hosted Supabase (SPEC §7).')}{' '}
        <button className="font-semibold underline" onClick={() => resetDemo()}>
          {t('demo.reset', 'Reset demo data')}
        </button>
      </div>
      <header className="bg-arctic-700">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-2 px-4 py-3">
          <Link to="/" className="mr-2 flex items-center gap-2 text-white">
            <span className="text-xl">❄️</span>
            <span className="font-semibold">{t('app.name', 'Iqaluit Daycare Network')}</span>
          </Link>
          <nav className="flex flex-1 flex-wrap items-center gap-1">
            <NavLink to="/" end className={navClass}>
              {t('nav.directory', 'Directory')}
            </NavLink>
            {grant?.role === 'parent' && (
              <>
                <NavLink to="/family" className={navClass}>
                  {t('nav.family', 'My family')}
                </NavLink>
                <NavLink to="/apply" className={navClass}>
                  {t('nav.apply', 'Apply')}
                </NavLink>
              </>
            )}
            {(grant?.role === 'staff' || grant?.role === 'daycare_admin') && (
              <NavLink to="/waitlist" className={navClass}>
                {t('nav.waitlist', 'Waitlist')}
              </NavLink>
            )}
            {grant?.role === 'daycare_admin' && (
              <NavLink to="/policies" className={navClass}>
                {t('nav.policies', 'Priority rules')}
              </NavLink>
            )}
            {grant?.role === 'funder' && (
              <NavLink to="/funder" className={navClass}>
                {t('nav.funder', 'Dashboard')}
              </NavLink>
            )}
            {grant?.role === 'it_admin' && (
              <NavLink to="/it" className={navClass}>
                {t('nav.itAdmin', 'Administration')}
              </NavLink>
            )}
          </nav>
          {user ? (
            <div className="relative flex items-center gap-2">
              {grant?.role === 'parent' && (
                <Link to="/notifications" className="relative rounded-lg px-2 py-1 text-arctic-100 hover:bg-arctic-600" aria-label={t('nav.notifications', 'Notifications')}>
                  🔔
                  {unread > 0 && (
                    <span className="absolute -right-0.5 -top-0.5 rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">{unread}</span>
                  )}
                </Link>
              )}
              <button
                className="flex items-center gap-2 rounded-lg bg-arctic-800 px-3 py-1.5 text-sm text-white hover:bg-arctic-900"
                onClick={() => setMenuOpen((v) => !v)}
              >
                <span>{user.name}</span>
                {grant && (
                  <Badge tone="arctic">
                    {roleLabel(t, grant)}
                    {grantDaycare ? ` · ${grantDaycare.name}` : ''}
                  </Badge>
                )}
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-full z-40 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {user.grants.length > 1 && (
                    <div className="mb-1 border-b border-slate-100 pb-1">
                      <div className="px-2 py-1 text-xs font-medium text-slate-400">
                        {t('session.switchRole', 'Switch role context')}
                      </div>
                      {user.grants.map((g, i) => (
                        <button
                          key={i}
                          className={`block w-full rounded-lg px-2 py-1.5 text-left text-sm ${i === db.session.grantIndex ? 'bg-arctic-50 font-semibold text-arctic-800' : 'hover:bg-slate-50'}`}
                          onClick={() => {
                            switchGrant(i)
                            setMenuOpen(false)
                            navigate(landingFor(g))
                          }}
                        >
                          {roleLabel(t, g)}
                          {g.daycareId ? ` — ${db.daycares.find((d) => d.id === g.daycareId)?.name}` : ''}
                        </button>
                      ))}
                    </div>
                  )}
                  <button
                    className="block w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50"
                    onClick={() => {
                      logout()
                      setMenuOpen(false)
                      navigate('/')
                    }}
                  >
                    {t('session.signOut', 'Sign out')}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <Link to="/login" className="rounded-lg bg-white px-3 py-1.5 text-sm font-medium text-arctic-800 hover:bg-arctic-50">
              {t('session.signIn', 'Sign in')}
            </Link>
          )}
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      <footer className="mx-auto max-w-6xl px-4 pb-8 pt-4 text-center text-xs text-slate-400">
        {t('app.footer', 'Iqaluit Daycare Network — community childcare enrollment for Iqaluit, Nunavut.')}
      </footer>
    </div>
  )
}
