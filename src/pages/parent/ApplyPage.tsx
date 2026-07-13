import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../auth'
import { mutate, nowIso } from '../../domain/store'
import { audit, newId, notify } from '../../domain/waitlist'
import type { Child, FormField } from '../../domain/types'
import { Badge, Button, Card, SectionTitle } from '../../components/ui'

// Unified application (SPEC §4.2.1). The form renders dynamically from the
// IT-Administrator-managed schema; system fields map onto the child record,
// custom fields land in formData.
export function ApplyPage() {
  const { t } = useTranslation()
  const { db, user } = useSession()
  const navigate = useNavigate()
  const [values, setValues] = useState<Record<string, string | boolean>>({})
  const [ranked, setRanked] = useState<string[]>([])
  const [error, setError] = useState<string | null>(null)

  if (!user) return null
  const schema = db.formSchema
  const openDaycares = db.daycares.filter((d) => d.availability !== 'closed')
  const available = openDaycares.filter((d) => !ranked.includes(d.id))

  const setValue = (id: string, v: string | boolean) => setValues((x) => ({ ...x, [id]: v }))

  const move = (id: string, dir: -1 | 1) =>
    setRanked((r) => {
      const i = r.indexOf(id)
      const j = i + dir
      if (i === -1 || j < 0 || j >= r.length) return r
      const copy = [...r]
      ;[copy[i], copy[j]] = [copy[j], copy[i]]
      return copy
    })

  const submit = () => {
    for (const f of schema.fields) {
      if (f.required && !values[f.id]) {
        setError(t('apply.missingField', 'Please fill in “{{field}}”.', { field: f.label }))
        return
      }
    }
    if (ranked.length === 0) {
      setError(t('apply.noDaycares', 'Add at least one daycare to your ranked list.'))
      return
    }
    const now = nowIso()
    mutate((d) => {
      const child: Child = {
        id: newId('c'),
        parentUserId: user.id,
        name: String(values.name ?? ''),
        dob: String(values.dob ?? ''),
        desiredStartDate: String(values.desiredStartDate ?? ''),
        criteria: {
          indigenous: !!values.indigenous,
          sibling: !!values.sibling,
          staffChild: !!values.staffChild,
          neighbourhood: !!values.neighbourhood,
        },
        formData: Object.fromEntries(
          Object.entries(values).filter(
            ([k]) => !['name', 'dob', 'desiredStartDate', 'indigenous', 'sibling', 'staffChild', 'neighbourhood'].includes(k)
          )
        ),
        formSchemaVersion: schema.version,
      }
      d.children.push(child)
      const appId = newId('app')
      d.applications.push({
        id: appId,
        childId: child.id,
        submittedAt: now,
        status: 'pending',
        rankedDaycareIds: ranked,
      })
      ranked.forEach((daycareId, i) => {
        d.entries.push({
          id: newId('we'),
          applicationId: appId,
          childId: child.id,
          daycareId,
          rank: i + 1,
          dateAdded: now,
          status: 'active',
          notes: [],
        })
      })
      audit(d, user.id, 'application.submitted', `${child.name}: applied to ${ranked.length} daycare(s)`, now)
      notify(
        d,
        user,
        'application',
        t('apply.confirmNotification', 'Application received for {{child}} — you are on {{count}} waitlist(s). No fee applies.', {
          child: child.name,
          count: ranked.length,
        }),
        now
      )
    })
    navigate('/family')
  }

  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle>{t('apply.title', 'Apply to daycares')}</SectionTitle>
      <p className="mb-4 text-sm text-slate-600">
        {t(
          'apply.intro',
          'One application covers every daycare you rank below — free of charge. Each daycare sees only the information relevant to its own centre; none of them see your ranking or where else you applied.'
        )}
      </p>

      <Card>
        <h3 className="mb-3 font-semibold text-arctic-800">{t('apply.childSection', '1. About your child')}</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          {schema.fields.map((f: FormField) => (
            <div key={f.id} className={f.type === 'checkbox' ? 'sm:col-span-2' : ''}>
              {f.type === 'checkbox' ? (
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={!!values[f.id]} onChange={(e) => setValue(f.id, e.target.checked)} />
                  {f.label}
                </label>
              ) : (
                <label className="block text-sm">
                  <span className="mb-1 block font-medium text-slate-600">
                    {f.label}
                    {f.required && <span className="text-rose-500"> *</span>}
                  </span>
                  {f.type === 'select' ? (
                    <select
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                      value={String(values[f.id] ?? '')}
                      onChange={(e) => setValue(f.id, e.target.value)}
                    >
                      <option value="">—</option>
                      {(f.options ?? []).map((o) => (
                        <option key={o} value={o}>
                          {o}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <input
                      type={f.type}
                      className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                      value={String(values[f.id] ?? '')}
                      onChange={(e) => setValue(f.id, e.target.value)}
                    />
                  )}
                </label>
              )}
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-slate-500">
          {t(
            'apply.criteriaNote',
            'Priority information (community membership, siblings) is self-declared and shared only with the daycares you apply to — never with funders or other daycares. Each daycare applies its own verification offline.'
          )}
        </p>
      </Card>

      <Card className="mt-4">
        <h3 className="mb-3 font-semibold text-arctic-800">{t('apply.rankSection', '2. Rank your daycares')}</h3>
        {ranked.length === 0 && (
          <p className="mb-2 text-sm text-slate-500">{t('apply.rankEmpty', 'Add daycares below — your first pick is choice #1.')}</p>
        )}
        <ol className="space-y-2">
          {ranked.map((id, i) => {
            const d = db.daycares.find((x) => x.id === id)!
            return (
              <li key={id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
                <div className="flex items-center gap-2">
                  <Badge tone="arctic">#{i + 1}</Badge>
                  <span className="text-sm font-medium">
                    {d.photoEmoji} {d.name}
                  </span>
                </div>
                <div className="flex gap-1">
                  <Button variant="secondary" onClick={() => move(id, -1)} disabled={i === 0}>
                    ↑
                  </Button>
                  <Button variant="secondary" onClick={() => move(id, 1)} disabled={i === ranked.length - 1}>
                    ↓
                  </Button>
                  <Button variant="danger" onClick={() => setRanked((r) => r.filter((x) => x !== id))}>
                    ✕
                  </Button>
                </div>
              </li>
            )
          })}
        </ol>
        {available.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-2">
            {available.map((d) => (
              <Button key={d.id} variant="secondary" onClick={() => setRanked((r) => [...r, d.id])}>
                + {d.photoEmoji} {d.name}
              </Button>
            ))}
          </div>
        )}
      </Card>

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}
      <div className="mt-4 flex items-center gap-3">
        <Button onClick={submit}>{t('apply.submit', 'Submit application — free')}</Button>
        <span className="text-xs text-slate-500">
          {t('apply.submitNote', 'You can edit rankings, leave individual waitlists, or withdraw at any time.')}
        </span>
      </div>
    </div>
  )
}
