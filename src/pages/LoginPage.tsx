import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { landingFor, login, useSession } from '../auth'
import { Badge, Card, SectionTitle } from '../components/ui'

// Demo sign-in: pick a seeded account. Production uses Supabase Auth with
// email/password + magic links (SPEC §7.5); role grants work identically.
export function LoginPage() {
  const { t } = useTranslation()
  const { db } = useSession()
  const navigate = useNavigate()

  const roleTone: Record<string, string> = {
    parent: 'green',
    staff: 'blue',
    daycare_admin: 'arctic',
    funder: 'amber',
    it_admin: 'red',
  }

  return (
    <div className="mx-auto max-w-2xl">
      <SectionTitle>{t('login.title', 'Sign in')}</SectionTitle>
      <p className="mb-4 text-sm text-slate-600">
        {t(
          'login.demoNote',
          'This demo replaces email/password sign-in with one-click demo accounts so you can explore every role. Accounts with two badges hold multiple role grants — switch context from the header menu after signing in.'
        )}
      </p>
      <div className="grid gap-3">
        {db.users.map((u) => (
          <Card key={u.id} className="cursor-pointer transition-shadow hover:shadow-md">
            <button
              className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
              onClick={() => {
                login(u.id)
                navigate(landingFor(u.grants[0]))
              }}
            >
              <div>
                <div className="font-medium text-arctic-800">{u.name}</div>
                <div className="text-xs text-slate-500">{u.email}</div>
              </div>
              <div className="flex flex-wrap gap-1">
                {u.grants.map((g, i) => (
                  <Badge key={i} tone={roleTone[g.role]}>
                    {g.role === 'parent' && t('role.parent', 'Parent')}
                    {g.role === 'staff' && t('role.staff', 'Daycare staff')}
                    {g.role === 'daycare_admin' && t('role.daycareAdmin', 'Daycare admin')}
                    {g.role === 'funder' && t('role.funder', 'Funder / Government')}
                    {g.role === 'it_admin' && t('role.itAdmin', 'IT Administrator')}
                    {g.daycareId ? ` · ${db.daycares.find((d) => d.id === g.daycareId)?.name}` : ''}
                  </Badge>
                ))}
              </div>
            </button>
          </Card>
        ))}
      </div>
    </div>
  )
}
