import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../auth'
import { backend, useQuery } from '../../backend'
import type { FamilyChild, OfferView } from '../../backend/types'
import { Badge, Button, Card, EmptyState, Modal, SectionTitle, Stat } from '../../components/ui'

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA')
}

function OfferModal({ offer, child, onClose }: { offer: OfferView; child: FamilyChild; onClose: () => void }) {
  const { t } = useTranslation()
  const settings = useQuery(() => backend.getSettings())
  const [retained, setRetained] = useState<string[]>(offer.higherRanked.map((e) => e.entryId))
  const fee = settings.data?.holdingFeeAnnual ?? 0

  const accept = async () => {
    await backend.acceptOffer(offer.id, retained)
    onClose()
  }

  return (
    <Modal title={t('offer.modalTitle', 'Accept spot at {{daycare}}', { daycare: offer.daycareName })} onClose={onClose}>
      <p className="text-sm text-slate-600">
        {t('offer.acceptIntro', '{{child}} will be enrolled at {{daycare}}. Waitlists you ranked below this daycare are released automatically.', {
          child: child.name,
          daycare: offer.daycareName,
        })}
      </p>
      {offer.higherRanked.length > 0 && (
        <div className="mt-4 rounded-lg bg-amber-50 p-3">
          <div className="text-sm font-medium text-amber-900">
            {t('offer.retainTitle', 'Keep your place at higher-ranked daycares?')}
          </div>
          <p className="mt-1 text-xs text-amber-800">
            {t('offer.retainFee', 'Keeping any higher-ranked waitlist costs an annual holding fee of ${{fee}} per child (covers all lists you keep). If you stop paying, the kept places are released.', {
              fee,
            })}
          </p>
          <div className="mt-2 space-y-1">
            {offer.higherRanked.map((e) => (
              <label key={e.entryId} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={retained.includes(e.entryId)}
                  onChange={(ev) =>
                    setRetained((r) => (ev.target.checked ? [...r, e.entryId] : r.filter((x) => x !== e.entryId)))
                  }
                />
                <span>
                  {t('offer.retainChoice', 'Choice #{{rank}}: {{daycare}} (currently position {{pos}})', {
                    rank: e.rank,
                    daycare: e.daycareName,
                    pos: e.position ?? '—',
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
            ? t('offer.acceptWithFee', 'Accept & pay ${{fee}} holding fee', { fee })
            : t('offer.acceptPlain', 'Accept spot')}
        </Button>
      </div>
    </Modal>
  )
}

function ChildCard({ child }: { child: FamilyChild }) {
  const { t } = useTranslation()
  const [offerModal, setOfferModal] = useState<OfferView | null>(null)

  const totalAhead = child.positions.reduce((s, p) => s + Math.max(0, (p.position ?? 1) - 1), 0)
  const totalOpenSpots = child.positions.reduce((s, p) => s + p.openSpots, 0)

  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <div className="text-lg font-semibold text-arctic-800">{child.name}</div>
          <div className="text-xs text-slate-500">
            {t('family.dobLine', 'Born {{dob}} · desired start {{start}}', { dob: child.dob, start: child.desiredStartDate })}
          </div>
        </div>
        {child.enrolledDaycareName ? (
          <Badge tone="green">{t('family.enrolledAt', 'Enrolled at {{daycare}}', { daycare: child.enrolledDaycareName })}</Badge>
        ) : child.applicationStatus === 'withdrawn' ? (
          <Badge tone="red">{t('family.withdrawn', 'Application withdrawn')}</Badge>
        ) : child.applicationStatus ? (
          <Badge tone="amber">{t('family.waitlisted', 'On waitlists')}</Badge>
        ) : (
          <Badge>{t('family.noApplication', 'No application yet')}</Badge>
        )}
      </div>

      {child.offers.map((offer) => (
        <div key={offer.id} className="mt-3 rounded-lg border border-emerald-300 bg-emerald-50 p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <div className="font-medium text-emerald-900">
                {t('offer.bannerTitle', 'Spot offered at {{daycare}} (your choice #{{rank}})', {
                  daycare: offer.daycareName,
                  rank: offer.rank,
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
              <Button variant="secondary" onClick={() => backend.declineOffer(offer.id)}>
                {t('offer.decline', 'Decline')}
              </Button>
            </div>
          </div>
        </div>
      ))}

      {child.applicationId && child.positions.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 flex flex-wrap gap-3">
            <Stat label={t('family.childrenAhead', 'children ahead of {{name}} across your ranked daycares', { name: child.name })} value={totalAhead} />
            <Stat label={t('family.openSpots', 'open spots across those daycares right now')} value={totalOpenSpots} />
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
              {child.positions.map((p) => (
                <tr key={p.daycareId} className="border-b border-slate-100">
                  <td className="py-2">#{p.rank}</td>
                  <td>
                    <Link className="text-arctic-600 hover:underline" to={`/daycare/${p.daycareId}`}>
                      {p.daycareName}
                    </Link>
                    {p.heldByFee && <Badge tone="amber">{t('family.heldBadge', 'held (fee paid)')}</Badge>}
                  </td>
                  <td>
                    {p.position !== null
                      ? t('family.positionOf', '#{{pos}} of {{total}}', { pos: p.position, total: p.totalActive })
                      : '—'}
                  </td>
                  <td className="text-right">
                    <Button
                      variant="danger"
                      onClick={() => {
                        if (confirm(t('family.confirmLeave', 'Leave this waitlist? Your place cannot be restored — rejoining starts a new application date.')))
                          backend.withdraw(child.applicationId!, [p.daycareId])
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
          {child.applicationStatus === 'pending' && (
            <div className="mt-2">
              <Button
                variant="danger"
                onClick={() => {
                  if (confirm(t('family.confirmWithdraw', 'Withdraw this application from all daycares?')))
                    backend.withdraw(child.applicationId!, null)
                }}
              >
                {t('family.withdrawAll', 'Withdraw application everywhere')}
              </Button>
            </div>
          )}
        </div>
      )}

      {child.holdingFee && (
        <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              {t('family.holdingFeeStatus', 'Holding fee paid — term ends {{date}}. Covers {{count}} higher-ranked waitlist(s).', {
                date: fmtDate(child.holdingFee.termEnd),
                count: child.holdingFee.retainedCount,
              })}
            </span>
            <Button
              variant="danger"
              onClick={() => {
                if (confirm(t('family.confirmStopFee', 'Stop paying the holding fee? Your held places are released immediately and cannot be restored.')))
                  backend.lapseHoldingFee(child.holdingFee!.id)
              }}
            >
              {t('family.stopFee', 'Stop paying / release held places')}
            </Button>
          </div>
        </div>
      )}

      {!child.applicationId && (
        <div className="mt-3">
          <Link to="/apply">
            <Button>{t('family.startApplication', 'Start an application')}</Button>
          </Link>
        </div>
      )}

      {offerModal && <OfferModal offer={offerModal} child={child} onClose={() => setOfferModal(null)} />}
    </Card>
  )
}

export function FamilyPage() {
  const { t } = useTranslation()
  const { session } = useSession()
  const family = useQuery(() => backend.getFamily(), [session?.userId])

  if (!session) return null
  const children = family.data ?? []

  return (
    <div className="mx-auto max-w-3xl">
      <SectionTitle>{t('family.title', 'My family')}</SectionTitle>
      {!family.loading && children.length === 0 && (
        <EmptyState>
          {t('family.empty', 'No children on file yet.')}{' '}
          <Link to="/apply" className="text-arctic-600 underline">
            {t('family.emptyCta', 'Start your first application')}
          </Link>
        </EmptyState>
      )}
      {children.map((c) => (
        <ChildCard key={c.childId} child={c} />
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
          <Button
            variant={session.willingFlagAt ? 'danger' : 'primary'}
            onClick={() => backend.setWillingFlag(!session.willingFlagAt)}
          >
            {session.willingFlagAt ? t('outreach.remove', 'Remove my flag') : t('outreach.set', 'I’m willing to help — share my contact info')}
          </Button>
        </div>
        {session.willingFlagAt && (
          <p className="mt-2 text-xs text-emerald-700">
            {t('outreach.activeSince', 'Flag active since {{date}}. Funders can see your name and contact details.', {
              date: fmtDate(session.willingFlagAt),
            })}
          </p>
        )}
      </Card>
    </div>
  )
}
