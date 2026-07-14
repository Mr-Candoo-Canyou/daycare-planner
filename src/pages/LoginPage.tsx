import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { landingFor } from '../auth'
import { backend, useQuery } from '../backend'
import { Badge, Button, Card, SectionTitle } from '../components/ui'

const roleTone: Record<string, string> = {
  parent: 'green',
  staff: 'blue',
  daycare_admin: 'arctic',
  funder: 'amber',
  it_admin: 'red',
}

// Demo mode: one-click seeded accounts. Production: Supabase Auth with
// email/password + magic link (SPEC §7.5). Role grants work identically.
export function LoginPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()

  if (backend.mode === 'supabase') return <SupabaseLogin />

  return <DemoLogin navigate={navigate} t={t} />
}

function DemoLogin({ navigate, t }: { navigate: (to: string) => void; t: (k: string, d: string) => string }) {
  const users = useQuery(() => backend.listDemoUsers())
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
        {(users.data ?? []).map((u) => (
          <Card key={u.id} className="cursor-pointer transition-shadow hover:shadow-md">
            <button
              className="flex w-full flex-wrap items-center justify-between gap-2 text-left"
              onClick={async () => {
                await backend.signInDemo(u.id)
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
                    {g.daycareName ? ` · ${g.daycareName}` : ''}
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

function SupabaseLogin() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const [mode, setMode] = useState<'signin' | 'signup' | 'magic'>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setStatus(null)
    try {
      if (mode === 'signin') {
        await backend.signInPassword(email, password)
        const session = await backend.getSession()
        navigate(landingFor(session ? (session.grants[session.grantIndex] ?? null) : null))
      } else if (mode === 'signup') {
        await backend.signUp(email, password, name)
        setStatus(t('login.signupOk', 'Account created — check your email to confirm, then sign in.'))
      } else {
        await backend.signInMagicLink(email)
        setStatus(t('login.magicOk', 'Magic link sent — check your email.'))
      }
    } catch (e) {
      setError((e as Error).message)
    }
  }

  return (
    <div className="mx-auto max-w-sm">
      <SectionTitle>{t('login.title', 'Sign in')}</SectionTitle>
      <Card>
        <div className="mb-3 flex gap-1">
          {(['signin', 'signup', 'magic'] as const).map((m) => (
            <button
              key={m}
              className={`rounded-lg px-3 py-1.5 text-sm font-medium ${mode === m ? 'bg-arctic-700 text-white' : 'bg-slate-100 text-slate-600'}`}
              onClick={() => setMode(m)}
            >
              {m === 'signin' && t('login.tabSignin', 'Sign in')}
              {m === 'signup' && t('login.tabSignup', 'Create account')}
              {m === 'magic' && t('login.tabMagic', 'Email me a link')}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {mode === 'signup' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{t('login.name', 'Your name')}</span>
              <input className="w-full rounded-lg border border-slate-300 px-2 py-1.5" value={name} onChange={(e) => setName(e.target.value)} />
            </label>
          )}
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-slate-600">{t('login.email', 'Email')}</span>
            <input type="email" className="w-full rounded-lg border border-slate-300 px-2 py-1.5" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          {mode !== 'magic' && (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-slate-600">{t('login.password', 'Password')}</span>
              <input type="password" className="w-full rounded-lg border border-slate-300 px-2 py-1.5" value={password} onChange={(e) => setPassword(e.target.value)} />
            </label>
          )}
          {error && <p className="text-sm text-rose-600">{error}</p>}
          {status && <p className="text-sm text-emerald-700">{status}</p>}
          <Button className="w-full" onClick={submit} disabled={!email || (mode !== 'magic' && !password)}>
            {mode === 'signin' && t('login.submitSignin', 'Sign in')}
            {mode === 'signup' && t('login.submitSignup', 'Create account')}
            {mode === 'magic' && t('login.submitMagic', 'Send magic link')}
          </Button>
          <p className="text-xs text-slate-500">
            {t('login.parentNote', 'New accounts are parent accounts. Daycare, funder, and administrator access is granted by the platform administrator.')}
          </p>
        </div>
      </Card>
    </div>
  )
}
