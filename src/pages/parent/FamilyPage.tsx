import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../auth'
import { mutate, nowIso } from '../../domain/store'
import {
  acceptOffer,
  activeEnrolment,
  audit,
  daycareById,
  declineOffer,
  globalView,
  lapseHoldingFee,
  positionOf,
  withdraw,
} from '../../domain/waitlist'
import type { Application, Child, Offer } from '../../domain/types'
import { Badge, Button, Card, EmptyState, Modal, SectionTitle, Stat } from '../../components/ui'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

function OfferModal({ offer, application, child, onClose }: { offer: Offer; application: Application; child: Child; onClose: () => void }) {
  const { t } = useTranslation()
  const { db, user } = useSession()
  const offeringDaycare = daycareById(db, offer.daycareId)
  const offeredEntry = db.entries.find((e) => e.id === offer.waitlistEntryId)!
  const higherRanked = db.entries.filter(
    (e) => e.applicationId === application.id && e.status === 'active' && e.rank < offeredEntry.rank
  )
  const [retained, setRetained] = useState<string[]>(higherRanked.map((e) => e.id))

  const accept = () => {
    mutate((d) => acceptOffer(d, offer.id, retained, user!.id, nowIso()))
    onClose()
  }

  return (
    <Modal title={t('offer.modalTitle', 'Accept spot at {{daycare}}', { daycare: offeringDaycare.name })} onClose={onClose}>
      <p className="text-sm text-slate-600">
        {t('offer.acceptIntro', '{{child}} will be enrolled at {{daycare}}. Waitlists you ranked below this daycare are released automatically.', {
          child: child.name,
          daycare: offeringDaycare.name,
        })}
      </p>
      {higherRanked.length > 0 && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3">
          <div className="text-sm font-medium text-amber-900">
            {t('offer.retainTitle', 'Keep your place at higher-ranked daycares?')}
          </div>
          <p className="mt-1 text-xs text-amber-800">
            {t('offer.retainFee', 'Keeping any higher-ranked waitlist costs an annual holding fee of ${{fee}} per child (covers all lists you keep). If you stop paying, the kept places are released.', {
              fee: db.settings.holdingFeeAnnual,
            })}
          </p>
          <div className="mt-2 space-y-1">
            {higherRanked.map((e) => (
              <label key={e.id} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={retained.includes(e.id)}
                  onChange={(ev) =>
                    setRetained((r) => (ev.target.checked ? [...r, e.id] : r.filter((x) => x !== e.id)))
                  }
                />
                <span>
                  {t('offer.retainChoice', 'Choice #{{rank}}: {{daycare}} (currently position {{pos}})', {
                    rank: e.rank,
                    daycare: daycareById(db, e.daycareId).name,
                    pos: positionOf(db, e.daycareId, child.id) ?? '—',
                  })}
                </span>
              </label>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 flex justify-end gap-2">
        <Button variant="secondary" onClick={onClose}>
          {t('common.cancel', 'Cancel')}
        </Button>
        <Button onClick={accept}>
          {retained.length > 0
            ? t('offer.acceptWithFee', 'Accept & pay ${{fee}} holding fee', { fee: db.settings.holdingFeeAnnual })
            : t('offer.acceptPlain', 'Accept spot')}
        </Button>
      </div>
    </Modal>
  )
}

function ChildCard({ child }: { child: Child }) {
  const { t } = useTranslation()
  const { db, user } = useSession()
  const [offerModal, setOfferModal] = useState<Offer | null>(null)
  const application = db.applications.find((a) => a.childId === child.id)
  const enrolment = activeEnrolment(db, child.id)
  const openOffers = db.offers
    .filter((o) => o.childId === child.id && o.status === 'open')
    .sort((a, b) => {
      const ea = db.entries.find((e) => e.id === a.waitlistEntryId)!
      const eb = db.entries.find((e) => e.id === b.waitlistEntryId)!
      return ea.rank - eb.rank
    })
  const holdingFee = db.holdingFees.find((h) => h.childId === child.id && h.status === 'paid')

  const view = application ? globalView(db, application.id) : null

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-lg font-semibold text-arctic-800">{child.name}</div>
          <div className="text-xs text-slate-500">
            {t('family.dobLine', 'Born {{dob}} · desired start {{start}}', { dob: child.dob, start: child.desiredStartDate })}
          </div>
        </div>
        {enrolment ? (
          <Badge tone="green">{t('family.enrolledAt', 'Enrolled at {{daycare}}', { daycare: daycareById(db, enrolment.daycareId).name })}</Badge>
        ) : application?.status === 'withdrawn' ? (
          <Badge tone="red">{t('family.withdrawn', 'Application withdrawn')}</Badge>
        ) : application ? (
          <Badge tone="amber">{t('family.waitlisted', 'On waitlists')}</Badge>
        ) : (
          <Badge>{t('family.noApplication', 'No application yet')}</Badge>
        )}
      </div>

      {openOffers.map((offer) => {
        const entry = db.entries.find((e) => e.id === offer.waitlistEntryId)!
        return (
          <div key={offer.id} className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-medium text-emerald-900">
                  {t('offer.bannerTitle', 'Spot offered at {{daycare}} (your choice #{{rank}})', {
                    daycare: daycareById(db, offer.daycareId).name,
                    rank: entry.rank,
                  })}
                </div>
                <div className="text-xs text-emerald-800">
                  {t('offer.bannerExpiry', 'Respond by {{date}} — after that the spot goes to the next family.', {
                    date: fmtDate(offer.expiresAt),
                  })}
                </div>
              </div>
              <div className="flex gap-2">
                <Button onClick={() => setOfferModal(offer)}>{t('offer.accept', 'Accept…')}</Button>
                <Button
                  variant="secondary"
                  onClick={() => mutate((d) => declineOffer(d, offer.id, user!.id, nowIso()))}
                >
                  {t('offer.decline', 'Decline')}
                </Button>
              </div>
            </div>
          </div>
        )
      })}

      {application && view && view.perDaycare.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap gap-3">
            <Stat label={t('family.childrenAhead', 'children ahead of {{name}} across your ranked daycares', { name: child.name })} value={view.totalAhead} />
            <Stat label={t('family.openSpots', 'open spots across those daycares right now')} value={view.totalOpenSpots} />
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5">{t('family.colRank', 'Your rank')}</th>
                <th>{t('family.colDaycare', 'Daycare')}</th>
                <th>{t('family.colPosition', 'Waitlist position')}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {view.perDaycare.map((p) => (
                <tr key={p.daycareId} className="border-b border-slate-100">
                  <td className="py-2">#{p.rank}</td>
                  <td>
                    <Link className="text-arctic-600 hover:underline" to={`/daycare/${p.daycareId}`}>
                      {daycareById(db, p.daycareId).name}
                    </Link>
                    {holdingFee?.retainedEntryIds.includes(p.entryId) && (
                      <Badge tone="amber">{t('family.heldBadge', 'held (fee paid)')}</Badge>
                    )}
                  </td>
                  <td>
                    {p.position !== null
                      ? t('family.positionOf', '#{{pos}} of {{total}}', {
                          pos: p.position,
                          total: db.entries.filter((e) => e.daycareId === p.daycareId && e.status === 'active').length,
                        })
                      : '—'}
                  </td>
                  <td className="text-right">
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (confirm(t('family.confirmLeave', 'Leave this waitlist? Your place cannot be restored — rejoining starts a new application date.')))
                          mutate((d) => withdraw(d, application.id, [p.daycareId], user!.id, nowIso()))
                      }}
                    >
                      {t('family.leaveList', 'Leave list')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            {t(
              'family.volatilityNote',
              'Positions are a live snapshot, not a guarantee — they can move down as well as up when daycares apply priority rules (siblings, community priority) or new families join.'
            )}
          </p>
          {application.status === 'pending' && (
            <div className="mt-2">
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm(t('family.confirmWithdraw', 'Withdraw this application from all daycares?')))
                    mutate((d) => withdraw(d, application.id, null, user!.id, nowIso()))
                }}
              >
                {t('family.withdrawAll', 'Withdraw application everywhere')}
              </Button>
            </div>
          )}
        </div>
      )}

      {holdingFee && holdingFee.retainedEntryIds.length > 0 && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t('family.holdingFeeStatus', 'Holding fee paid — term ends {{date}}. Covers {{count}} higher-ranked waitlist(s).', {
                date: fmtDate(holdingFee.termEnd),
                count: holdingFee.retainedEntryIds.length,
              })}
            </span>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm(t('family.confirmStopFee', 'Stop paying the holding fee? Your held places are released immediately and cannot be restored.')))
                  mutate((d) => lapseHoldingFee(d, holdingFee.id, user!.id, nowIso()))
              }}
            >
              {t('family.stopFee', 'Stop paying / release held places')}
            </Button>
          </div>
        </div>
      )}

      {!application && (
        <div className="mt-3">
          <Link to="/apply">
            <Button>{t('family.startApplication', 'Start an application')}</Button>
          </Link>
        </div>
      )}

      {offerModal && application && (
        <OfferModal offer={offerModal} application={application} child={child} onClose={() => setOfferModal(null)} />
      )}
    </Card>
  )
}

export function FamilyPage() {
  const { t } = useTranslation()
  const { db, user } = useSession()
  if (!user) return null
  const children = db.children.filter((c) => c.parentUserId === user.id)

  const toggleFlag = () => {
    mutate((d) => {
      const u = d.users.find((x) => x.id === user.id)!
      const turningOn = !u.willingToStartDaycare
      u.willingToStartDaycare = turningOn ? nowIso() : null
      audit(
        d,
        user.id,
        turningOn ? 'outreach.flagged' : 'outreach.unflagged',
        turningOn ? 'Parent flagged as willing to start a daycare' : 'Parent removed willing-to-start flag',
        nowIso()
      )
    })
  }

  const flagged = db.users.find((u) => u.id === user.id)?.willingToStartDaycare

  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle>{t('family.title', 'My family')}</SectionTitle>
      {children.length === 0 && (
        <EmptyState>
          {t('family.empty', 'No children on file yet.')}{' '}
          <Link to="/apply" className="text-arctic-600 underline">
            {t('family.emptyCta', 'Start your first application')}
          </Link>
        </EmptyState>
      )}
      {children.map((c) => (
        <ChildCard key={c.id} child={c} />
      ))}

      <Card className="mt-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-xl">
            <div className="font-semibold text-arctic-800">{t('outreach.title', 'Help start a new daycare in Iqaluit')}</div>
            <p className="mt-1 text-sm text-slate-600">
              {t(
                'outreach.body',
                'Iqaluit needs more childcare capacity. If you flag yourself here, you consent to funders and government bodies seeing your name and contact information so they can invite you to planning meetings and share grants for starting new childcare organizations. You can remove the flag at any time; removal immediately hides your details.'
              )}
            </p>
          </div>
          <Button variant={flagged ? 'danger' : 'primary'} onClick={toggleFlag}>
            {flagged ? t('outreach.remove', 'Remove my flag') : t('outreach.set', 'I’m willing to help — share my contact info')}
          </Button>
        </div>
        {flagged && (
          <p className="mt-2 text-xs text-emerald-700">
            {t('outreach.activeSince', 'Flag active since {{date}}. Funders can see your name and contact details.', { date: fmtDate(flagged) })}
          </p>
        )}
      </Card>
    </div>
  )
}
