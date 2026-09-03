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
  CornerDownRight,
} from 'lucide-react';

function formatDateTime(iso: string) {
  const d = new Date(iso);
  const dateStr = d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
  const timeStr = d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
  return `${dateStr} · ${timeStr}`;
}

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

      {/* Conversation Timeline & Reply Thread */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-border/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <MessageSquare size={15} />
            </div>
            <div>
              <h3 className="text-sm font-bold text-neutral-dark font-display">
                Conversation Thread
              </h3>
              <p className="text-[11px] text-neutral-mid">
                {ticket.messages.length} {ticket.messages.length === 1 ? 'message' : 'messages'} recorded
              </p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-neutral-light/80 px-2.5 py-1 text-[11px] font-medium text-neutral-mid border border-border">
            <Clock size={11} />
            <span>Last updated {formatDateTime(ticket.updatedAt)}</span>
          </span>
        </div>

        {/* Timeline with vertical continuous connector spine */}
        <div className="relative pl-6 sm:pl-8 before:absolute before:left-3.5 sm:before:left-4 before:top-4 before:bottom-6 before:w-0.5 before:bg-border/80">
          <div className="space-y-6">
            {ticket.messages.map((msg, index) => {
              const isAdmin = msg.senderType === 'admin';
              const isInitial = index === 0;

              return (
                <div key={msg.id} className="relative group">
                  {/* Timeline node icon */}
                  <div
                    className={`absolute -left-6 sm:-left-8 top-3 flex h-7 w-7 items-center justify-center rounded-full border-2 shadow-xs transition-transform group-hover:scale-105 ${
                      isAdmin
                        ? 'border-primary bg-emerald-50 text-primary ring-4 ring-primary/10'
                        : isInitial
                        ? 'border-neutral-dark bg-white text-neutral-dark ring-4 ring-neutral-200/60'
                        : 'border-border bg-white text-neutral-mid ring-4 ring-neutral-100'
                    }`}
                  >
                    {isAdmin ? (
                      <Shield size={12} className="fill-primary/20 text-primary" />
                    ) : (
                      <User size={12} />
                    )}
                  </div>

                  {/* Message Card */}
                  <div
                    className={`rounded-2xl border transition-all duration-200 shadow-xs ${
                      isAdmin
                        ? 'border-primary/30 bg-gradient-to-b from-primary-light/15 via-white to-white hover:border-primary/50'
                        : 'border-border/90 bg-white hover:border-neutral-300'
                    }`}
                  >
                    {/* Message Header Bar */}
                    <div
                      className={`flex flex-wrap items-center justify-between gap-2 px-4.5 py-3 border-b rounded-t-2xl ${
                        isAdmin
                          ? 'border-primary/15 bg-primary-light/20'
                          : 'border-border/60 bg-neutral-light/40'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        {/* Avatar */}
                        {isAdmin ? (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-white text-[10px] font-bold shadow-xs">
                            E
                          </div>
                        ) : ticket.user.avatarUrl ? (
                          <img
                            src={ticket.user.avatarUrl}
                            alt={fullName}
                            className="h-6 w-6 rounded-full object-cover border border-border shadow-xs"
                          />
                        ) : (
                          <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neutral-200 text-neutral-dark text-[10px] font-bold shadow-xs">
                            {ticket.user.firstName?.[0]?.toUpperCase() || 'U'}
                          </div>
                        )}

                        {/* Name & Role Badge */}
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-neutral-dark">
                            {isAdmin ? 'Expyrico Support Team' : fullName}
                          </span>
                          {isAdmin ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-primary text-white px-2 py-0.5 text-[10px] font-bold tracking-wide">
                              Staff
                            </span>
                          ) : isInitial ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-neutral-dark text-white px-2 py-0.5 text-[10px] font-semibold">
                              Initial Report
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 rounded-md bg-neutral-light text-neutral-dark px-2 py-0.5 text-[10px] font-medium border border-border">
                              Reporter
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Formatted Datetime */}
                      <div className="flex items-center gap-1.5 text-xs text-neutral-mid font-mono">
                        <Clock size={11} className="text-neutral-mid/70" />
                        <span>{formatDateTime(msg.createdAt)}</span>
                      </div>
                    </div>

                    {/* Message Body */}
                    <div className="p-4.5 text-sm text-neutral-dark whitespace-pre-wrap leading-relaxed select-text">
                      {msg.message}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Active Reply Composer anchored as final timeline node */}
            {!isClosed && (
              <div className="relative pt-2">
                <div className="absolute -left-6 sm:-left-8 top-5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-primary/40 bg-white text-primary shadow-xs ring-4 ring-primary/10">
                  <CornerDownRight size={13} />
                </div>
                <FeedbackReplyBox ticketId={ticket.id} isClosed={isClosed} />
              </div>
            )}
          </div>
        </div>

        {/* If closed, show clean resolution notice */}
        {isClosed && (
          <div className="pt-2">
            <FeedbackReplyBox ticketId={ticket.id} isClosed={isClosed} />
          </div>
        )}
      </div>
    </div>
  );
}
