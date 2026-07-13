import { Link, useParams } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useDB } from '../domain/store'
import { enrolledCount, orderedWaitlist } from '../domain/waitlist'
import { Badge, Button, Card, SectionTitle } from '../components/ui'
import { availabilityBadge } from './DirectoryPage'
import { useSession } from '../auth'
import type { AgeGroup } from '../domain/types'

export function DaycareDetailPage() {
  const { t } = useTranslation()
  const db = useDB()
  const { grant } = useSession()
  const { id } = useParams()
  const daycare = db.daycares.find((d) => d.id === id)
  if (!daycare) return <div>{t('daycare.notFound', 'Daycare not found.')}</div>

  const groups: { key: AgeGroup; label: string }[] = [
    { key: 'infant', label: t('ageGroup.infant', 'Infant (0–17 months)') },
    { key: 'toddler', label: t('ageGroup.toddler', 'Toddler (18–35 months)') },
    { key: 'preschool', label: t('ageGroup.preschool', 'Preschool (3–5 years)') },
  ]

  return (
    <div className="mx-auto max-w-3xl">
      <Link to="/" className="text-sm text-arctic-600 hover:underline">
        ← {t('daycare.backToDirectory', 'Back to directory')}
      </Link>
      <Card className="mt-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-4">
            <span className="text-5xl">{daycare.photoEmoji}</span>
            <div>
              <h1 className="text-xl font-bold text-arctic-800">{daycare.name}</h1>
              <div className="text-sm text-slate-500">{daycare.address}</div>
            </div>
          </div>
          {availabilityBadge(t, daycare)}
        </div>
        <p className="mt-4 text-sm text-slate-700">{daycare.description}</p>
        <dl className="mt-4 grid gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="font-medium text-slate-500">{t('daycare.hours', 'Hours')}</dt>
            <dd>{daycare.hours}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">{t('daycare.fees', 'Fees & subsidies')}</dt>
            <dd>{daycare.fees}</dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">{t('daycare.contact', 'Contact')}</dt>
            <dd>
              {daycare.phone} · {daycare.email}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-slate-500">{t('daycare.languages', 'Languages & cultural programming')}</dt>
            <dd className="flex flex-wrap gap-1 pt-1">
              {daycare.languages.map((l) => (
                <Badge key={l} tone="blue">
                  {l}
                </Badge>
              ))}
            </dd>
          </div>
        </dl>
      </Card>

      <div className="mt-4">
        <SectionTitle>{t('daycare.capacityTitle', 'Licensed capacity')}</SectionTitle>
        <div className="grid gap-3 sm:grid-cols-3">
          {groups.map((g) => (
            <Card key={g.key}>
              <div className="text-sm font-medium text-slate-600">{g.label}</div>
              <div className="mt-1 text-2xl font-bold text-arctic-800">
                {enrolledCount(db, daycare.id, g.key)} / {daycare.capacity[g.key]}
              </div>
              <div className="text-xs text-slate-400">{t('daycare.spotsFilled', 'spots filled')}</div>
            </Card>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-500">
          {t('daycare.waitlistLength', 'Current waitlist: {{count}} children.', { count: orderedWaitlist(db, daycare.id).length })}
        </p>
      </div>

      <div className="mt-6 flex items-center gap-3">
        {daycare.availability !== 'closed' ? (
          <Link to={grant?.role === 'parent' ? '/apply' : '/login'}>
            <Button>{t('daycare.applyCta', 'Apply through the unified application')}</Button>
          </Link>
        ) : (
          <span className="text-sm text-slate-500">{t('daycare.closedNote', 'This daycare is not accepting applications right now.')}</span>
        )}
      </div>
    </div>
  )
}
