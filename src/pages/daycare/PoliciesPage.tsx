import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../auth'
import { backend, useQuery } from '../../backend'
import type { Tier, TierKind } from '../../domain/types'
import { Badge, Button, Card, SectionTitle } from '../../components/ui'

// Priority rule configuration from platform templates (SPEC §4.3):
// combine, reorder, relabel tiers, or add custom tiers from scratch.
// Every change is saved as a whole-list replace (atomic on the backend).
export function PoliciesPage() {
  const { t } = useTranslation()
  const { grant, session } = useSession()
  const daycareId = grant?.daycareId
  const tiersQ = useQuery(() => (daycareId ? backend.getTiers(daycareId) : Promise.resolve([])), [daycareId])
  const templatesQ = useQuery(() => backend.listTemplates())
  const [customLabel, setCustomLabel] = useState('')
  const [customKind, setCustomKind] = useState<TierKind>('general')

  if (!daycareId || !session) return null
  const tiers = tiersQ.data ?? []
  const templates = templatesQ.data ?? []

  const kindLabel: Record<TierKind, string> = {
    sibling: t('tierKind.sibling', 'Matches: sibling enrolled'),
    indigenous: t('tierKind.indigenous', 'Matches: Indigenous community member'),
    staff_child: t('tierKind.staff', 'Matches: child of staff'),
    neighbourhood: t('tierKind.neighbourhood', 'Matches: neighbourhood resident'),
    general: t('tierKind.general', 'Matches: everyone (catch-all)'),
  }

  const save = (next: Omit<Tier, 'id'>[]) =>
    backend.saveTiers(daycareId, next.map(({ kind, label, description }) => ({ kind, label, description })))

  const asPlain = (list: Tier[]): Omit<Tier, 'id'>[] =>
    list.map(({ kind, label, description }) => ({ kind, label, description }))

  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle>{t('policies.title', 'Priority rules — {{daycare}}', { daycare: grant.daycareName ?? '' })}</SectionTitle>
      <p className="mb-4 text-sm text-slate-600">
        {t(
          'policies.intro',
          'Children are grouped into the first tier they match, top to bottom; within a tier, order defaults to application date. Your rules apply only to your own waitlist — the platform never overrides them.'
        )}
      </p>

      <Card>
        <h3 className="mb-2 font-semibold text-arctic-800">{t('policies.currentTiers', 'Your tiers (highest priority first)')}</h3>
        <ol className="space-y-2">
          {tiers.map((tier, i) => (
            <li key={tier.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
              <div className="flex items-center gap-2">
                <Badge tone="arctic">#{i + 1}</Badge>
                <div>
                  <input
                    className="rounded border border-transparent px-1 text-sm font-medium hover:border-slate-300"
                    defaultValue={tier.label}
                    onBlur={(e) => {
                      if (e.target.value.trim() && e.target.value !== tier.label) {
                        const next = asPlain(tiers)
                        next[i] = { ...next[i], label: e.target.value.trim() }
                        save(next)
                      }
                    }}
                  />
                  <div className="px-1 text-xs text-slate-400">{kindLabel[tier.kind]}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  disabled={i === 0}
                  onClick={() => {
                    const next = asPlain(tiers)
                    ;[next[i - 1], next[i]] = [next[i], next[i - 1]]
                    save(next)
                  }}
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  disabled={i === tiers.length - 1}
                  onClick={() => {
                    const next = asPlain(tiers)
                    ;[next[i], next[i + 1]] = [next[i + 1], next[i]]
                    save(next)
                  }}
                >
                  ↓
                </Button>
                <Button
                  variant="danger"
                  disabled={tiers.length === 1}
                  onClick={() => save(asPlain(tiers).filter((_, j) => j !== i))}
                >
                  ✕
                </Button>
              </div>
            </li>
          ))}
        </ol>
        <p className="mt-2 text-xs text-slate-500">
          {t('policies.tierNote', 'Tip: keep a “General waitlist” catch-all tier last so every applicant lands in a tier.')}
        </p>
      </Card>

      <Card className="mt-4">
        <h3 className="mb-2 font-semibold text-arctic-800">{t('policies.templates', 'Add from platform templates')}</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {templates.map((tpl) => (
            <div key={tpl.id} className="rounded-lg border border-slate-200 p-3">
              <div className="text-sm font-medium">{tpl.name}</div>
              <div className="mb-2 text-xs text-slate-500">{tpl.description}</div>
              <Button
                variant="secondary"
                onClick={() => {
                  // Insert template tiers just above a trailing catch-all.
                  const next = asPlain(tiers)
                  const at = next.at(-1)?.kind === 'general' ? next.length - 1 : next.length
                  next.splice(at, 0, ...tpl.tiers)
                  save(next)
                }}
              >
                {t('policies.addTemplate', 'Add tiers')}
              </Button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-4">
        <h3 className="mb-2 font-semibold text-arctic-800">{t('policies.custom', 'Create a custom tier')}</h3>
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">{t('policies.customLabel', 'Tier label')}</span>
            <input
              className="rounded-lg border border-slate-300 px-2 py-1.5"
              value={customLabel}
              onChange={(e) => setCustomLabel(e.target.value)}
            />
          </label>
          <label className="text-sm">
            <span className="mb-1 block text-xs font-medium text-slate-500">{t('policies.customMatch', 'Who it matches')}</span>
            <select
              className="rounded-lg border border-slate-300 px-2 py-1.5"
              value={customKind}
              onChange={(e) => setCustomKind(e.target.value as TierKind)}
            >
              {(Object.keys(kindLabel) as TierKind[]).map((k) => (
                <option key={k} value={k}>
                  {kindLabel[k]}
                </option>
              ))}
            </select>
          </label>
          <Button
            disabled={!customLabel.trim()}
            onClick={() => {
              save([{ kind: customKind, label: customLabel.trim() }, ...asPlain(tiers)])
              setCustomLabel('')
            }}
          >
            {t('policies.addCustom', 'Add tier')}
          </Button>
        </div>
      </Card>
    </div>
  )
}
