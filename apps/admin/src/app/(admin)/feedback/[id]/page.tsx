import Link from 'next/link';
import { notFound } from 'next/navigation';
import { serverAdminApi } from '@/lib/admin-api';
import { StatusBadge } from '@/components/status-badge';
import { FeedbackReplyBox } from './feedback-reply-box';
import { FeedbackCaseActions } from './feedback-case-actions';
import { FeedbackAttachments } from './feedback-attachments';
import {
  ArrowLeft,
  Smartphone,
  User,
  Shield,
  Clock,
  Bug,
  Lightbulb,
  MessageSquare,
  CheckCircle,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function TypePill({ type }: { type: 'bug' | 'suggestion' | 'feedback' }) {
  if (type === 'bug') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 text-red-800 border border-red-200 px-3 py-1 text-xs font-semibold">
        <Bug size={12} className="text-red-600" />
        <span>Bug Report</span>
      </span>
    );
  }
  if (type === 'suggestion') {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200 px-3 py-1 text-xs font-semibold">
        <Lightbulb size={12} className="text-amber-600" />
        <span>Suggestion</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 px-3 py-1 text-xs font-semibold">
      <MessageSquare size={12} className="text-emerald-600" />
      <span>General Feedback</span>
    </span>
  );
}

export default async function AdminFeedbackDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let ticket: Awaited<ReturnType<typeof serverAdminApi.feedback.get>>;

  try {
    ticket = await serverAdminApi.feedback.get(id);
  } catch {
    notFound();
  }

  const fullName = `${ticket.user.firstName} ${ticket.user.lastName}`.trim();
  const dev = ticket.deviceInfo;
  const isClosed = ticket.status === 'closed' || ticket.status === 'resolved';

  return (
    <div className="space-y-8 max-w-5xl">
      {/* Back link */}
      <div>
        <Link
          href="/feedback"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-mid hover:text-primary transition-colors"
        >
          <ArrowLeft size={14} />
          <span>Back to Feedback Queue</span>
        </Link>
      </div>

      {/* Main Header & Actions */}
      <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border pb-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <TypePill type={ticket.type} />
            <StatusBadge status={ticket.status} />
            <span className="text-xs text-neutral-mid font-mono">
              Created {new Date(ticket.createdAt).toLocaleString()}
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-neutral-dark font-display tracking-tight">
            {ticket.title}
          </h1>
        </div>

        <FeedbackCaseActions ticketId={ticket.id} currentStatus={ticket.status} />
      </div>

      {/* Grid: Context & Reporter Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {/* User Card */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-mid">
            <User size={13} className="text-primary" />
            <span>Reporter</span>
          </div>
          <div className="text-sm font-semibold text-neutral-dark">
            <Link href={`/users/${ticket.user.id}`} className="hover:underline hover:text-primary">
              {fullName || 'Anonymous User'}
            </Link>
          </div>
          <div className="text-xs text-neutral-mid truncate">{ticket.user.email}</div>
          <div className="pt-2 text-[11px] text-neutral-mid/80 border-t border-border">
            User ID: <span className="font-mono text-[10px]">{ticket.user.id}</span>
          </div>
        </div>

        {/* Device Info Card */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-mid">
            <Smartphone size={13} className="text-primary" />
            <span>Device Diagnostics</span>
          </div>
          {dev ? (
            <div className="space-y-1 text-xs">
              <div className="flex justify-between">
                <span className="text-neutral-mid">Platform:</span>
                <span className="font-semibold uppercase text-neutral-dark">{dev.platform}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-mid">OS Version:</span>
                <span className="font-mono text-neutral-dark">{dev.osVersion}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-neutral-mid">App Build:</span>
                <span className="font-mono text-neutral-dark">{dev.appVersion}</span>
              </div>
              {dev.deviceModel && (
                <div className="flex justify-between">
                  <span className="text-neutral-mid">Device Model:</span>
                  <span className="font-semibold text-neutral-dark truncate max-w-[120px]">
                    {dev.deviceModel}
                  </span>
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-neutral-mid italic">No device diagnostics attached.</p>
          )}
        </div>

        {/* Resolution Card if closed */}
        <div className="rounded-2xl border border-border bg-card p-5 space-y-2 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-neutral-mid">
            <CheckCircle size={13} className="text-primary" />
            <span>Resolution Details</span>
          </div>
          {ticket.resolvedAt ? (
            <div className="space-y-1.5 text-xs">
              <div className="text-neutral-mid">
                Resolved on{' '}
                <span className="font-semibold text-neutral-dark">
                  {new Date(ticket.resolvedAt).toLocaleDateString()}
                </span>
              </div>
              {ticket.resolver && (
                <div className="text-neutral-mid">
                  By:{' '}
                  <span className="font-semibold text-neutral-dark">
                    {ticket.resolver.firstName} {ticket.resolver.lastName}
                  </span>
                </div>
              )}
              {ticket.resolutionNotes && (
                <p className="rounded-xl bg-neutral-light/60 p-2 text-[11px] text-neutral-dark border border-neutral-200/80">
                  {ticket.resolutionNotes}
                </p>
              )}
            </div>
          ) : (
            <p className="text-xs text-neutral-mid italic">Case is currently open and unresolved.</p>
          )}
        </div>
      </div>

      {/* Attachments Section */}
      {ticket.attachments && ticket.attachments.length > 0 && (
        <FeedbackAttachments attachments={ticket.attachments} />
      )}

      {/* Conversation Timeline */}
      <div className="space-y-4">
        <h3 className="text-xs font-bold uppercase tracking-wider text-neutral-mid font-display">
          Conversation Thread ({ticket.messages.length})
        </h3>

        <div className="space-y-3">
          {ticket.messages.map((msg, index) => {
            const isAdmin = msg.senderType === 'admin';
            return (
              <div
                key={msg.id}
                className={`rounded-2xl border p-4.5 transition-all ${
                  isAdmin
                    ? 'border-primary/25 bg-primary-light/15 ml-6 sm:ml-12 shadow-xs'
                    : 'border-border bg-card mr-6 sm:mr-12 shadow-xs'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {isAdmin ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-primary text-white px-2 py-0.5 text-[10px] font-bold">
                        <Shield size={10} />
                        <span>Support Team</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-neutral-light text-neutral-dark px-2 py-0.5 text-[10px] font-semibold border border-border">
                        <User size={10} />
                        <span>{index === 0 ? 'Reporter (Initial Report)' : fullName}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-[11px] text-neutral-mid font-mono">
                    <Clock size={11} />
                    <span>{new Date(msg.createdAt).toLocaleString()}</span>
                  </div>
                </div>

                <div className="text-sm text-neutral-dark whitespace-pre-wrap leading-relaxed">
                  {msg.message}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Reply Box */}
      <div className="pt-2">
        <FeedbackReplyBox ticketId={ticket.id} isClosed={isClosed} />
      </div>
    </div>
  );
}
