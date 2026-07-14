import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../auth'
import { backend, useQuery } from '../../backend'
import { Badge, Button, Card, EmptyState, SectionTitle, Stat } from '../../components/ui'

function downloadCsv(filename: string, rows: (string | number)[][]) {
  const csv = rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n')
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }))
  a.download = filename
  a.click()
  URL.revokeObjectURL(a.href)
}

// Funder & government dashboard (SPEC §4.8): aggregates only, small cells
// suppressed on every egress path (screen and CSV); the single
// identified-data exception is the self-flagged willing-to-start list
// (§4.8.1).
export function FunderPage() {
  const { t } = useTranslation()
  const { session } = useSession()
  const overviewQ = useQuery(() => backend.funderOverview(), [session?.userId])
  const flaggedQ = useQuery(() => backend.listFlaggedParents(), [session?.userId])
  const broadcastsQ = useQuery(() => backend.listBroadcasts(), [session?.userId])
  const [message, setMessage] = useState('')
  if (!session || !overviewQ.data) return null

  const agg = overviewQ.data
  const flagged = flaggedQ.data ?? []
  const broadcasts = broadcastsQ.data ?? []

  const exportCsv = () =>
    // perDaycare.waitlist is already "<5"-suppressed by the backend, so the
    // CSV carries the same values as the on-screen table (SPEC §4.8).
    downloadCsv('idn-aggregate-report.csv', [
      ['daycare', 'licensed_capacity', 'enrolled', 'waitlist'],
      ...agg.perDaycare.map((p) => [p.name, p.capacity, p.enrolled, p.waitlist]),
    ])

  const sendBroadcast = async () => {
    const body = message.trim()
    if (!body) return
    await backend.sendBroadcast(body)
    setMessage('')
  }

  return (
    <div>
      <SectionTitle>{t('funder.title', 'System-wide overview')}</SectionTitle>
      <div className="mb-4 flex flex-wrap gap-3">
        <Stat label={t('funder.capacity', 'licensed spots across all daycares')} value={agg.totalCapacity} />
        <Stat label={t('funder.enrolled', 'children enrolled')} value={agg.totalEnrolled} />
        <Stat
          label={t('funder.utilization', 'utilization')}
          value={`${Math.round((agg.totalEnrolled / Math.max(1, agg.totalCapacity)) * 100)}%`}
        />
        <Stat
          label={t('funder.indigenousShare', 'enrolled children from Indigenous families (where disclosed)')}
          value={agg.indigenousEnrolledDisclosed}
          hint={t('funder.suppressionHint', 'Counts under 5 are shown as “<5” to protect privacy in a small community.')}
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-semibold text-arctic-800">{t('funder.perDaycare', 'Capacity vs. enrolment by daycare')}</h3>
            <Button variant="secondary" onClick={exportCsv}>
              {t('funder.exportCsv', 'Export CSV')}
            </Button>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5">{t('funder.colDaycare', 'Daycare')}</th>
                <th>{t('funder.colCapacity', 'Capacity')}</th>
                <th>{t('funder.colEnrolled', 'Enrolled')}</th>
                <th>{t('funder.colWaitlist', 'Waitlist')}</th>
              </tr>
            </thead>
            <tbody>
              {agg.perDaycare.map((p) => (
                <tr key={p.daycareId} className="border-b border-slate-100">
                  <td className="py-1.5">{p.name}</td>
                  <td>{p.capacity}</td>
                  <td>{p.enrolled}</td>
                  <td>{p.waitlist}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold text-arctic-800">{t('funder.byAge', 'Waitlisted children by age group')}</h3>
          <table className="w-full text-sm">
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-1.5">{t('ageGroup.infant', 'Infant (0–17 months)')}</td>
                <td className="text-right font-semibold">{agg.waitlistByAgeGroup.infant}</td>
              </tr>
              <tr className="border-b border-slate-100">
                <td className="py-1.5">{t('ageGroup.toddler', 'Toddler (18–35 months)')}</td>
                <td className="text-right font-semibold">{agg.waitlistByAgeGroup.toddler}</td>
              </tr>
              <tr>
                <td className="py-1.5">{t('ageGroup.preschool', 'Preschool (3–5 years)')}</td>
                <td className="text-right font-semibold">{agg.waitlistByAgeGroup.preschool}</td>
              </tr>
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            {t('funder.aggregateNote', 'Each child is counted once even when waitlisted at several daycares. Individual child records are never accessible to funder accounts.')}
          </p>
        </Card>
      </div>

      <SectionTitle>
        <span className="mt-6 inline-block">{t('funder.outreachTitle', 'Unplaced family outreach')}</span>
      </SectionTitle>
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <h3 className="mb-2 font-semibold text-arctic-800">
            {t('funder.flaggedTitle', 'Parents willing to help start a new daycare')}
          </h3>
          {flagged.length === 0 ? (
            <EmptyState>{t('funder.flaggedEmpty', 'No parents are currently flagged.')}</EmptyState>
          ) : (
            <ul className="space-y-2">
              {flagged.map((u) => (
                <li key={u.email} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 p-2 text-sm">
                  <div>
                    <div className="font-medium">{u.name}</div>
                    <div className="text-xs text-slate-500">
                      {u.email}
                      {u.mobile ? ` · ${u.mobile}` : ''}
                    </div>
                  </div>
                  <Badge tone="green">
                    {t('funder.flaggedSince', 'flagged {{date}}', { date: new Date(u.flaggedAt).toLocaleDateString('en-CA') })}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-2 text-xs text-slate-500">
            {t('funder.consentNote', 'These parents explicitly consented to sharing their contact details by flagging themselves. Removing the flag hides them immediately.')}
          </p>
        </Card>

        <Card>
          <h3 className="mb-2 font-semibold text-arctic-800">{t('funder.broadcastTitle', 'Message flagged parents')}</h3>
          <textarea
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            rows={4}
            placeholder={t('funder.broadcastPh', 'e.g. Invitation: community childcare planning meeting, grants available for starting new childcare organizations…')}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <div className="mt-2 flex items-center justify-between gap-2">
            <span className="text-xs text-slate-500">
              {t('funder.broadcastCount', 'Will reach {{count}} parent(s) via their preferred channels.', { count: flagged.length })}
            </span>
            <Button disabled={!message.trim() || flagged.length === 0} onClick={sendBroadcast}>
              {t('funder.broadcastSend', 'Send broadcast')}
            </Button>
          </div>
          {broadcasts.length > 0 && (
            <div className="mt-3 border-t border-slate-100 pt-2">
              <div className="mb-1 text-xs font-medium text-slate-500">{t('funder.broadcastHistory', 'Sent messages')}</div>
              {broadcasts.map((b, i) => (
                <div key={i} className="mb-1 text-xs text-slate-600">
                  <span className="text-slate-400">{new Date(b.at).toLocaleDateString('en-CA')}:</span> {b.body}
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
