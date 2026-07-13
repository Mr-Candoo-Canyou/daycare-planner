import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSession } from '../../auth'
import { mutate, nowIso } from '../../domain/store'
import {
  ageGroupFor,
  childById,
  daycareById,
  markIneligible,
  makeOffer,
  moveEntry,
  nextEligible,
  openSpots,
  orderedWaitlist,
  tierIndexFor,
} from '../../domain/waitlist'
import type { WaitlistEntry } from '../../domain/types'
import { Badge, Button, Card, EmptyState, Modal, SectionTitle, Stat } from '../../components/ui'

// Daycare waitlist management (SPEC §4.3). Staff see the list and can add
// notes/flags; admins additionally reorder within tiers, mark ineligible,
// and trigger offers. Cross-daycare data (rankings, other applications) is
// never shown — data minimization (§5).
export function WaitlistPage() {
  const { t } = useTranslation()
  const { db, user, grant } = useSession()
  const [noteFor, setNoteFor] = useState<WaitlistEntry | null>(null)
  const [noteText, setNoteText] = useState('')
  const [ineligibleFor, setIneligibleFor] = useState<WaitlistEntry | null>(null)
  const [ineligibleReason, setIneligibleReason] = useState('')

  if (!grant?.daycareId || !user) return null
  const daycare = daycareById(db, grant.daycareId)
  const isAdmin = grant.role === 'daycare_admin'
  const list = orderedWaitlist(db, daycare.id)
  const spots = openSpots(db, daycare.id)
  const next = nextEligible(db, daycare.id)
  const now = new Date().toISOString()

  const ageLabel: Record<string, string> = {
    infant: t('ageGroup.infantShort', 'Infant'),
    toddler: t('ageGroup.toddlerShort', 'Toddler'),
    preschool: t('ageGroup.preschoolShort', 'Preschool'),
  }

  return (
    <div>
      <SectionTitle>
        {t('waitlist.title', 'Waitlist — {{daycare}}', { daycare: daycare.name })}
      </SectionTitle>
      <div className="mb-4 flex flex-wrap gap-3">
        <Stat label={t('waitlist.statWaiting', 'children waiting')} value={list.length} />
        <Stat
          label={t('waitlist.statSpots', 'open spots (capacity minus enrolled and pending offers)')}
          value={spots}
        />
        <Stat
          label={t('waitlist.statOffers', 'offers awaiting a reply')}
          value={db.offers.filter((o) => o.daycareId === daycare.id && o.status === 'open').length}
        />
      </div>

      {isAdmin && (
        <Card className="mb-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-sm">
              {next ? (
                <>
                  {t('waitlist.nextEligible', 'Next eligible child per your priority rules:')}{' '}
                  <span className="font-semibold">{childById(db, next.childId).name}</span>{' '}
                  <Badge tone="arctic">{daycare.tiers[tierIndexFor(daycare, childById(db, next.childId))]?.label ?? t('waitlist.noTier', 'Unmatched')}</Badge>
                </>
              ) : (
                t('waitlist.noneEligible', 'No eligible children without a pending offer.')
              )}
            </div>
            <Button
              disabled={!next || spots === 0}
              onClick={() => next && mutate((d) => makeOffer(d, next.id, user.id, nowIso()))}
            >
              {t('waitlist.makeOffer', 'Offer the spot')}
            </Button>
          </div>
          {spots === 0 && (
            <p className="mt-1 text-xs text-slate-500">
              {t('waitlist.noSpots', 'No open spots right now — offers unlock when capacity frees up.')}
            </p>
          )}
        </Card>
      )}

      {list.length === 0 ? (
        <EmptyState>{t('waitlist.empty', 'The waitlist is empty.')}</EmptyState>
      ) : (
        <Card>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs text-slate-500">
                <th className="py-1.5">#</th>
                <th>{t('waitlist.colChild', 'Child')}</th>
                <th>{t('waitlist.colAge', 'Age group')}</th>
                <th>{t('waitlist.colTier', 'Priority tier')}</th>
                <th>{t('waitlist.colAdded', 'Added')}</th>
                <th>{t('waitlist.colStatus', 'Status')}</th>
                <th className="text-right">{t('waitlist.colActions', 'Actions')}</th>
              </tr>
            </thead>
            <tbody>
              {list.map((e, i) => {
                const child = childById(db, e.childId)
                const tier = daycare.tiers[tierIndexFor(daycare, child)]
                const hasOpenOffer = db.offers.some((o) => o.waitlistEntryId === e.id && o.status === 'open')
                return (
                  <tr key={e.id} className="border-b border-slate-100 align-top">
                    <td className="py-2 font-semibold text-arctic-800">{i + 1}</td>
                    <td>
                      <div className="font-medium">{child.name}</div>
                      {e.notes.length > 0 && (
                        <div className="mt-0.5 text-xs text-slate-500">
                          {e.notes.map((n, j) => (
                            <div key={j}>💬 {n.text}</div>
                          ))}
                        </div>
                      )}
                    </td>
                    <td>{ageLabel[ageGroupFor(child.dob, now)]}</td>
                    <td>
                      <Badge tone="arctic">{tier?.label ?? t('waitlist.noTier', 'Unmatched')}</Badge>
                    </td>
                    <td className="whitespace-nowrap">{new Date(e.dateAdded).toLocaleDateString('en-CA')}</td>
                    <td>
                      {hasOpenOffer && <Badge tone="green">{t('waitlist.offerPending', 'Offer out')}</Badge>}
                      {e.flagged && <Badge tone="amber">{t('waitlist.flagged', 'Flagged')}</Badge>}
                    </td>
                    <td className="whitespace-nowrap text-right">
                      {isAdmin && (
                        <>
                          <Button variant="secondary" className="mr-1 px-2" onClick={() => mutate((d) => moveEntry(d, daycare.id, e.id, -1, user.id, nowIso()))}>
                            ↑
                          </Button>
                          <Button variant="secondary" className="mr-1 px-2" onClick={() => mutate((d) => moveEntry(d, daycare.id, e.id, 1, user.id, nowIso()))}>
                            ↓
                          </Button>
                        </>
                      )}
                      <Button
                        variant="secondary"
                        className="mr-1"
                        onClick={() => {
                          setNoteFor(e)
                          setNoteText('')
                        }}
                      >
                        {t('waitlist.note', 'Note')}
                      </Button>
                      <Button
                        variant="secondary"
                        className="mr-1"
                        onClick={() =>
                          mutate((d) => {
                            const x = d.entries.find((y) => y.id === e.id)!
                            x.flagged = !x.flagged
                          })
                        }
                      >
                        {e.flagged ? t('waitlist.unflag', 'Unflag') : t('waitlist.flag', 'Flag')}
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="danger"
                          onClick={() => {
                            setIneligibleFor(e)
                            setIneligibleReason('')
                          }}
                        >
                          {t('waitlist.ineligible', 'Ineligible')}
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-slate-500">
            {t(
              'waitlist.privacyNote',
              'You see only applications to your centre. Family rankings and applications to other daycares are never shown; when a family leaves the list, no reason is attached.'
            )}
          </p>
        </Card>
      )}

      {noteFor && (
        <Modal title={t('waitlist.noteTitle', 'Add note for {{child}}', { child: childById(db, noteFor.childId).name })} onClose={() => setNoteFor(null)}>
          <textarea
            className="w-full rounded-lg border border-slate-300 p-2 text-sm"
            rows={3}
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setNoteFor(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              disabled={!noteText.trim()}
              onClick={() => {
                mutate((d) => {
                  const x = d.entries.find((y) => y.id === noteFor.id)!
                  x.notes.push({ by: user.id, text: noteText.trim(), at: nowIso() })
                })
                setNoteFor(null)
              }}
            >
              {t('common.save', 'Save')}
            </Button>
          </div>
        </Modal>
      )}

      {ineligibleFor && (
        <Modal
          title={t('waitlist.ineligibleTitle', 'Mark {{child}} ineligible', { child: childById(db, ineligibleFor.childId).name })}
          onClose={() => setIneligibleFor(null)}
        >
          <p className="text-sm text-slate-600">
            {t('waitlist.ineligibleBody', 'The child is removed from your waitlist. A reason is required and recorded in the audit log; the parent sees the entry as inactive at your centre.')}
          </p>
          <input
            className="mt-3 w-full rounded-lg border border-slate-300 p-2 text-sm"
            placeholder={t('waitlist.ineligibleReasonPh', 'Reason (internal, audited)')}
            value={ineligibleReason}
            onChange={(e) => setIneligibleReason(e.target.value)}
          />
          <div className="mt-3 flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setIneligibleFor(null)}>
              {t('common.cancel', 'Cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={!ineligibleReason.trim()}
              onClick={() => {
                mutate((d) => markIneligible(d, ineligibleFor.id, ineligibleReason.trim(), user.id, nowIso()))
                setIneligibleFor(null)
              }}
            >
              {t('waitlist.ineligibleConfirm', 'Mark ineligible')}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  )
}
