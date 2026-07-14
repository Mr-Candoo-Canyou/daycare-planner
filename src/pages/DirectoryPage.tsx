import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { backend, useQuery } from '../backend'
import type { DaycareCard } from '../backend/types'
import { Badge, Card } from '../components/ui'

export function availabilityBadge(t: (k: string, d: string) => string, d: Pick<DaycareCard, 'availability'>) {
  switch (d.availability) {
    case 'open':
      return <Badge tone="green">{t('availability.open', 'Open')}</Badge>
    case 'waitlist_only':
      return <Badge tone="amber">{t('availability.waitlistOnly', 'Waitlist only')}</Badge>
    case 'closed':
      return <Badge tone="red">{t('availability.closed', 'Closed to applications')}</Badge>
  }
}

// Public directory (SPEC §4.1) — no login required.
export function DirectoryPage() {
  const { t } = useTranslation()
  const daycares = useQuery(() => backend.listDaycares())

  return (
    <div>
      <div className="mb-6 rounded-2xl bg-arctic-700 p-6 text-white">
        <h1 className="text-2xl font-bold">{t('directory.heroTitle', 'One application. Every daycare in Iqaluit.')}</h1>
        <p className="mt-2 max-w-2xl text-arctic-100">
          {t(
            'directory.heroBody',
            'Browse every participating daycare, rank your favourites, and apply once — for free. You will always see exactly where your child stands on each waitlist.'
          )}
        </p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {(daycares.data ?? []).map((d) => {
          const capacity = d.capacity.infant + d.capacity.toddler + d.capacity.preschool
          return (
            <Link key={d.id} to={`/daycare/${d.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">{d.photoEmoji}</span>
                    <div>
                      <div className="font-semibold text-arctic-800">{d.name}</div>
                      <div className="text-xs text-slate-500">{d.address}</div>
                    </div>
                  </div>
                  {availabilityBadge(t, d)}
                </div>
                <p className="mt-3 line-clamp-2 text-sm text-slate-600">{d.description}</p>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
                  <Badge tone="arctic">
                    {t('directory.enrolledOfCapacity', '{{enrolled}} of {{capacity}} spots filled', {
                      enrolled: d.enrolledTotal,
                      capacity,
                    })}
                  </Badge>
                  <Badge>{t('directory.waitlistCount', '{{count}} on waitlist', { count: d.waitlistCount })}</Badge>
                  {d.languages.map((l) => (
                    <Badge key={l} tone="blue">
                      {l}
                    </Badge>
                  ))}
                </div>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
