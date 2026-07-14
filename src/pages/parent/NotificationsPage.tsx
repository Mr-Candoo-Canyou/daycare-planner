import { useTranslation } from 'react-i18next'
import { useSession } from '../../auth'
import { backend, useQuery } from '../../backend'
import { Badge, Card, EmptyState, SectionTitle } from '../../components/ui'

// Notification history with per-channel delivery (SPEC §4.2.3): priority
// SMS → push → email, all channels attempted for critical events.
export function NotificationsPage() {
  const { t } = useTranslation()
  const { session } = useSession()
  const q = useQuery(() => backend.listMyNotifications(), [session?.userId])
  if (!session) return null
  const mine = q.data ?? []

  const channelBadge = (channel: string, ok: boolean) => {
    if (channel === 'sms') return ok ? t('channel.smsOk', 'SMS ✓') : t('channel.smsNo', 'SMS —')
    if (channel === 'push') return ok ? t('channel.pushOk', 'Push ✓') : t('channel.pushNo', 'Push —')
    return ok ? t('channel.emailOk', 'Email ✓') : t('channel.emailNo', 'Email —')
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="flex items-center justify-between">
        <SectionTitle>{t('notifications.title', 'Notifications')}</SectionTitle>
        {mine.some((n) => !n.read) && (
          <button className="text-sm text-arctic-600 underline" onClick={() => backend.markNotificationsRead()}>
            {t('notifications.markRead', 'Mark all read')}
          </button>
        )}
      </div>
      {!q.loading && mine.length === 0 && (
        <EmptyState>{t('notifications.empty', 'Nothing yet — offers and reminders will appear here.')}</EmptyState>
      )}
      <div className="space-y-2">
        {mine.map((n) => (
          <Card key={n.id} className={n.read ? 'opacity-70' : ''}>
            <div className="text-sm">{n.body}</div>
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
              <span>{new Date(n.at).toLocaleString('en-CA')}</span>
              {n.channels.map((c) => (
                <Badge key={c.channel} tone={c.delivered ? 'green' : 'slate'}>
                  {channelBadge(c.channel, c.delivered)}
                </Badge>
              ))}
            </div>
          </Card>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        {t(
          'notifications.channelNote',
          'Critical events (offers, expiring windows) are sent by SMS first, then app push, then email. In production these are dispatched via Twilio and Firebase Cloud Messaging (SPEC §7.2); this demo records the attempt per channel.'
        )}
      </p>
    </div>
  )
}
