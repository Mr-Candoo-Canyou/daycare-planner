import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../auth'
import { mutate, nowIso } from '../../domain/store'
import { audit, daycareById, newId } from '../../domain/waitlist'
import type { TierKind } from '../../domain/types'
import { Badge, Button, Card, SectionTitle } from '../../components/ui'

// Priority rule configuration from platform templates (SPEC §4.3):
// combine, reorder, relabel tiers, or add custom tiers from scratch.
export function PoliciesPage() {
  const { t } = useTranslation()
  const { db, user, grant } = useSession()
  const [customLabel, setCustomLabel] = useState('')
  const [customKind, setCustomKind] = useState<TierKind>('general')

  if (!grant?.daycareId || !user) return null
  const daycare = daycareById(db, grant.daycareId)

  const kindLabel: Record<TierKind, string> = {
    sibling: t('tierKind.sibling', 'Matches: sibling enrolled'),
    indigenous: t('tierKind.indigenous', 'Matches: Indigenous community member'),
    staff_child: t('tierKind.staff', 'Matches: child of staff'),
    neighbourhood: t('tierKind.neighbourhood', 'Matches: neighbourhood resident'),
    general: t('tierKind.general', 'Matches: everyone (catch-all)'),
  }

  const act = (action: string, detail: string, fn: (d: typeof db) => void) =>
    mutate((d) => {
      fn(d)
      audit(d, user.id, action, detail, nowIso())
    })

  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle>{t('policies.title', 'Priority rules — {{daycare}}', { daycare: daycare.name })}</SectionTitle>
      <p className="mb-4 text-sm text-slate-600">
        {t(
          'policies.intro',
          'Children are grouped into the first tier they match, top to bottom; within a tier, order defaults to application date. Your rules apply only to your own waitlist — the platform never overrides them.'
        )}
      </p>

      <Card>
        <h3 className="mb-2 font-semibold text-arctic-800">{t('policies.currentTiers', 'Your tiers (highest priority first)')}</h3>
        <ol className="space-y-2">
          {daycare.tiers.map((tier, i) => (
            <li key={tier.id} className="flex items-center justify-between gap-2 rounded-lg border border-slate-200 p-2">
              <div className="flex items-center gap-2">
                <Badge tone="arctic">#{i + 1}</Badge>
                <div>
                  <input
                    className="rounded border border-transparent px-1 text-sm font-medium hover:border-slate-300"
                    value={tier.label}
                    onChange={(e) =>
                      mutate((d) => {
                        const dc = daycareById(d, daycare.id)
                        dc.tiers[i].label = e.target.value
                      })
                    }
                  />
                  <div className="px-1 text-xs text-slate-400">{kindLabel[tier.kind]}</div>
                </div>
              </div>
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  disabled={i === 0}
                  onClick={() =>
                    act('policy.reordered', `Tier moved at ${daycare.name}`, (d) => {
                      const ts = daycareById(d, daycare.id).tiers
                      ;[ts[i - 1], ts[i]] = [ts[i], ts[i - 1]]
                    })
                  }
                >
                  ↑
                </Button>
                <Button
                  variant="secondary"
                  disabled={i === daycare.tiers.length - 1}
                  onClick={() =>
                    act('policy.reordered', `Tier moved at ${daycare.name}`, (d) => {
                      const ts = daycareById(d, daycare.id).tiers
                      ;[ts[i], ts[i + 1]] = [ts[i + 1], ts[i]]
                    })
                  }
                >
                  ↓
                </Button>
                <Button
                  variant="danger"
                  disabled={daycare.tiers.length === 1}
                  onClick={() =>
                    act('policy.tierRemoved', `Tier "${tier.label}" removed at ${daycare.name}`, (d) => {
                      const dc = daycareById(d, daycare.id)
                      dc.tiers = dc.tiers.filter((x) => x.id !== tier.id)
                    })
                  }
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
          {db.templates.map((tpl) => (
            <div key={tpl.id} className="rounded-lg border border-slate-200 p-3">
              <div className="text-sm font-medium">{tpl.name}</div>
              <div className="mb-2 text-xs text-slate-500">{tpl.description}</div>
              <Button
                variant="secondary"
                onClick={() =>
                  act('policy.templateAdded', `Template "${tpl.name}" added at ${daycare.name}`, (d) => {
                    const dc = daycareById(d, daycare.id)
                    for (const tier of tpl.tiers) {
                      dc.tiers.splice(dc.tiers.length - (dc.tiers.at(-1)?.kind === 'general' ? 1 : 0), 0, {
                        ...tier,
                        id: newId('t'),
                      })
                    }
                  })
                }
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
              act('policy.tierAdded', `Custom tier "${customLabel}" at ${daycare.name}`, (d) => {
                daycareById(d, daycare.id).tiers.unshift({ id: newId('t'), kind: customKind, label: customLabel.trim() })
              })
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
