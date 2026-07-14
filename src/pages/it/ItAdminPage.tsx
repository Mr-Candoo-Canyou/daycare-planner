import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../auth'
import { backend, useQuery } from '../../backend'
import type { FormFieldType } from '../../domain/types'
import { Badge, Button, Card, SectionTitle } from '../../components/ui'

type Tab = 'settings' | 'form' | 'templates' | 'users' | 'audit'

// IT Administration (SPEC §4.9): system settings, the no-code application
// form editor, the policy template library, accounts, and the audit log.
export function ItAdminPage() {
  const { t } = useTranslation()
  const { session } = useSession()
  const [tab, setTab] = useState<Tab>('settings')
  if (!session) return null

  const tabs: { id: Tab; label: string }[] = [
    { id: 'settings', label: t('it.tabSettings', 'System settings') },
    { id: 'form', label: t('it.tabForm', 'Application form') },
    { id: 'templates', label: t('it.tabTemplates', 'Policy templates') },
    { id: 'users', label: t('it.tabUsers', 'Users & roles') },
    { id: 'audit', label: t('it.tabAudit', 'Audit log') },
  ]

  return (
    <div>
      <SectionTitle>{t('it.title', 'Platform administration')}</SectionTitle>
      <div className="mb-4 flex flex-wrap gap-1">
        {tabs.map((x) => (
          <button
            key={x.id}
            className={`rounded-lg px-3 py-1.5 text-sm font-medium ${tab === x.id ? 'bg-arctic-700 text-white' : 'bg-white text-slate-600 hover:bg-slate-100'}`}
            onClick={() => setTab(x.id)}
          >
            {x.label}
          </button>
        ))}
      </div>
      {tab === 'settings' && <SettingsTab />}
      {tab === 'form' && <FormTab />}
      {tab === 'templates' && <TemplatesTab />}
      {tab === 'users' && <UsersTab />}
      {tab === 'audit' && <AuditTab />}
    </div>
  )
}

function SettingsTab() {
  const { t } = useTranslation()
  const q = useQuery(() => backend.getSettings())
  if (!q.data) return null
  const s = q.data
  return (
    <Card className="max-w-xl">
      <div className="space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t('it.offerWindow', 'Offer acceptance window (days)')}</span>
          <input
            type="number"
            min={1}
            className="w-32 rounded-lg border border-slate-300 px-2 py-1.5"
            value={s.offerWindowDays}
            onChange={(e) => backend.updateSettings({ offerWindowDays: Math.max(1, Number(e.target.value) || 1) })}
          />
          <span className="ml-2 text-xs text-slate-500">
            {t('it.offerWindowNote', 'Applies to new offers; expiry is computed server-side at offer creation (SPEC §4.2.3).')}
          </span>
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t('it.holdingFee', 'Annual holding fee, per child ($)')}</span>
          <input
            type="number"
            min={0}
            className="w-32 rounded-lg border border-slate-300 px-2 py-1.5"
            value={s.holdingFeeAnnual}
            onChange={(e) => backend.updateSettings({ holdingFeeAnnual: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium text-slate-600">{t('it.graceDays', 'Holding fee renewal grace period (days)')}</span>
          <input
            type="number"
            min={0}
            className="w-32 rounded-lg border border-slate-300 px-2 py-1.5"
            value={s.graceDays}
            onChange={(e) => backend.updateSettings({ graceDays: Math.max(0, Number(e.target.value) || 0) })}
          />
        </label>
        <p className="text-xs text-slate-500">
          {t('it.credsNote', 'In production this tab also holds Twilio (SMS) and Firebase Cloud Messaging (push) credentials — omitted from the demo build.')}
        </p>
      </div>
    </Card>
  )
}

function FormTab() {
  const { t } = useTranslation()
  const q = useQuery(() => backend.getFormSchema())
  const [newFieldLabel, setNewFieldLabel] = useState('')
  const [newFieldType, setNewFieldType] = useState<FormFieldType>('text')
  if (!q.data) return null
  const schema = q.data
  const fields = schema.fields

  return (
    <Card className="max-w-2xl">
      <p className="mb-3 text-sm text-slate-600">
        {t('it.formIntro', 'These fields make up the unified application every parent completes. Changes apply to new applications immediately — no code deployment (SPEC §4.2.1). System fields can be relabelled but not removed.')}
      </p>
      <ol className="space-y-2">
        {fields.map((f, i) => (
          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
            <div className="flex items-center gap-2">
              <input
                className="w-72 rounded border border-transparent px-1 text-sm font-medium hover:border-slate-300"
                defaultValue={f.label}
                onBlur={(e) => {
                  if (e.target.value.trim() && e.target.value !== f.label) {
                    const next = fields.map((x, j) => (j === i ? { ...x, label: e.target.value.trim() } : x))
                    backend.saveFormSchema(next)
                  }
                }}
              />
              <Badge>{f.type}</Badge>
              {f.system && <Badge tone="blue">{t('it.systemField', 'system')}</Badge>}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-slate-500">
                <input
                  type="checkbox"
                  checked={f.required}
                  onChange={(e) =>
                    backend.saveFormSchema(fields.map((x, j) => (j === i ? { ...x, required: e.target.checked } : x)))
                  }
                />
                {t('it.required', 'required')}
              </label>
              <Button
                variant="secondary"
                className="px-2"
                disabled={i === 0}
                onClick={() => {
                  const next = [...fields]
                  ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                  backend.saveFormSchema(next)
                }}
              >
                ↑
              </Button>
              <Button
                variant="secondary"
                className="px-2"
                disabled={i === fields.length - 1}
                onClick={() => {
                  const next = [...fields]
                  ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
                  backend.saveFormSchema(next)
                }}
              >
                ↓
              </Button>
              <Button
                variant="danger"
                disabled={f.system}
                onClick={() => backend.saveFormSchema(fields.filter((x) => x.id !== f.id))}
              >
                ✕
              </Button>
            </div>
          </li>
        ))}
      </ol>
      <div className="mt-4 flex flex-wrap items-end gap-2 border-t border-slate-100 pt-3">
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">{t('it.newFieldLabel', 'New field label')}</span>
          <input
            className="w-64 rounded-lg border border-slate-300 px-2 py-1.5"
            value={newFieldLabel}
            onChange={(e) => setNewFieldLabel(e.target.value)}
          />
        </label>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-medium text-slate-500">{t('it.newFieldType', 'Type')}</span>
          <select
            className="rounded-lg border border-slate-300 px-2 py-1.5"
            value={newFieldType}
            onChange={(e) => setNewFieldType(e.target.value as FormFieldType)}
          >
            <option value="text">text</option>
            <option value="date">date</option>
            <option value="checkbox">checkbox</option>
          </select>
        </label>
        <Button
          disabled={!newFieldLabel.trim()}
          onClick={() => {
            backend.saveFormSchema([
              ...fields,
              { id: `fld_${Date.now().toString(36)}`, label: newFieldLabel.trim(), type: newFieldType, required: false },
            ])
            setNewFieldLabel('')
          }}
        >
          {t('it.addField', 'Add field')}
        </Button>
      </div>
      <p className="mt-2 text-xs text-slate-400">
        {t('it.schemaVersion', 'Schema version {{v}} — applications record the version they were submitted under.', { v: schema.version })}
      </p>
    </Card>
  )
}

function TemplatesTab() {
  const { t } = useTranslation()
  const q = useQuery(() => backend.listTemplates())
  return (
    <div className="grid max-w-3xl gap-3 sm:grid-cols-2">
      {(q.data ?? []).map((tpl) => (
        <Card key={tpl.id}>
          <div className="font-medium text-arctic-800">{tpl.name}</div>
          <div className="mt-1 text-xs text-slate-500">{tpl.description}</div>
          <div className="mt-2 flex flex-wrap gap-1">
            {tpl.tiers.map((tier, i) => (
              <Badge key={i} tone="arctic">
                {tier.label}
              </Badge>
            ))}
          </div>
        </Card>
      ))}
      <p className="text-xs text-slate-500 sm:col-span-2">
        {t('it.templatesNote', 'Daycare admins combine, reorder, and relabel these templates on their own waitlists; the library defines the starting points available to them (SPEC §4.3).')}
      </p>
    </div>
  )
}

function UsersTab() {
  const { t } = useTranslation()
  const q = useQuery(() => backend.listUsers())
  return (
    <Card className="max-w-3xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-1.5">{t('it.colUser', 'User')}</th>
            <th>{t('it.colContact', 'Contact')}</th>
            <th>{t('it.colGrants', 'Role grants')}</th>
          </tr>
        </thead>
        <tbody>
          {(q.data ?? []).map((u) => (
            <tr key={u.id} className="border-b border-slate-100 align-top">
              <td className="py-2 font-medium">{u.name}</td>
              <td className="text-xs text-slate-500">
                {u.email}
                {u.mobile && <div>{u.mobile}</div>}
              </td>
              <td>
                <div className="flex flex-wrap gap-1">
                  {u.grants.map((g, i) => (
                    <Badge key={i} tone={g.role === 'it_admin' ? 'red' : g.role === 'funder' ? 'amber' : 'arctic'}>
                      {g.role}
                      {g.daycareName ? ` · ${g.daycareName}` : ''}
                    </Badge>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">
        {t('it.usersNote', 'Funder access is granted and revoked here (SPEC §4.9). IT Administrators never see child-level data; two IT admin accounts are required to avoid a single point of failure (§7.5).')}
      </p>
    </Card>
  )
}

function AuditTab() {
  const { t } = useTranslation()
  const q = useQuery(() => backend.auditLog())
  return (
    <Card className="max-w-3xl">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
            <th className="py-1.5">{t('it.colWhen', 'When')}</th>
            <th>{t('it.colActor', 'Actor')}</th>
            <th>{t('it.colAction', 'Action')}</th>
            <th>{t('it.colDetail', 'Detail')}</th>
          </tr>
        </thead>
        <tbody>
          {(q.data ?? []).map((a) => (
            <tr key={a.id} className="border-b border-slate-100 align-top">
              <td className="whitespace-nowrap py-1.5 text-xs text-slate-500">{new Date(a.at).toLocaleString('en-CA')}</td>
              <td className="text-xs">{a.actorName}</td>
              <td>
                <Badge>{a.action}</Badge>
              </td>
              <td className="text-xs text-slate-600">{a.detail}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-slate-500">{t('it.auditNote', 'Append-only; production retention is 7 years (SPEC §7.8).')}</p>
    </Card>
  )
}
