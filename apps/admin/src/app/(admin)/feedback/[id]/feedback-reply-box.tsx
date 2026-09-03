'use client';

import { useState, useTransition } from 'react';
import { Button } from '@/components/ui/button';
import { replyFeedbackAction } from '@/lib/actions';
import { Send, Sparkles } from 'lucide-react';

const CANNED_RESPONSES = [
  'Thank you for reporting this. We are investigating the issue and will follow up shortly.',
  'Thanks for the suggestion! We have passed this feedback to our product team.',
  'A fix for this problem has been released in the latest app update. Please update and let us know if you still see it.',
  'Could you please share more details or exact steps to reproduce what you experienced?',
];

export function FeedbackReplyBox({
  ticketId,
  isClosed,
}: {
  ticketId: string;
  isClosed: boolean;
}) {
  const [message, setMessage] = useState('');
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function handleSend() {
    if (!message.trim() || pending) return;
    setError(null);
    setSuccess(false);

    startTransition(async () => {
      try {
        await replyFeedbackAction(ticketId, message.trim());
        setMessage('');
        setSuccess(true);
        setTimeout(() => setSuccess(false), 4000);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to send reply');
      }
    });
  }

  if (isClosed) {
    return (
      <div className="rounded-2xl border border-border bg-neutral-light/50 p-4 text-center text-xs text-neutral-mid">
        This case is resolved or closed. Reopen the ticket to send additional messages.
      </div>
    );
  }

  return (
    <div className="space-y-4 rounded-2xl border border-primary/25 bg-gradient-to-b from-white to-primary-light/10 p-5 shadow-xs transition-all">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-bold text-neutral-dark font-display flex items-center gap-2">
            <span>Compose Support Response</span>
            <span className="inline-flex items-center rounded-full bg-primary/15 text-primary-dark px-2 py-0.5 text-[10px] font-bold">
              Official Staff Reply
            </span>
          </h3>
          <p className="text-[11px] text-neutral-mid mt-0.5">
            Sends an in-app reply and pushes a real-time notification to the user&apos;s device.
          </p>
        </div>
        {success && (
          <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200/80 rounded-full px-3 py-1 animate-fade-in shadow-xs">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            <span>Reply dispatched via push</span>
          </span>
        )}
      </div>

      {/* Canned Quick Responses */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-neutral-mid">
          <Sparkles size={12} className="text-primary" />
          <span>Quick response templates:</span>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {CANNED_RESPONSES.map((tmpl, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setMessage(tmpl)}
              className="text-[11px] text-left rounded-lg border border-border bg-white px-2.5 py-1 text-neutral-dark hover:border-primary hover:text-primary-dark hover:bg-primary-light/25 active:scale-[0.98] transition-all shadow-xs"
            >
              {tmpl.slice(0, 48)}…
            </button>
          ))}
        </div>
      </div>

      {/* Message Textarea */}
      <div>
        <textarea
          rows={4}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSend();
            }
          }}
          placeholder="Compose a clear, helpful response to the user. Markdown formatting is supported..."
          className="w-full rounded-xl border border-neutral-300 bg-white p-3.5 text-sm text-neutral-dark placeholder:text-neutral-mid/60 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all resize-none shadow-xs leading-relaxed"
        />
        <div className="flex justify-between items-center mt-1 text-[11px] text-neutral-mid font-mono">
          <span>Press ⌘+Enter (Ctrl+Enter) to send</span>
          <span className="tabular-nums font-semibold">{message.length} / 3000</span>
        </div>
      </div>

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200/80 p-2.5 text-xs text-red-700 font-medium">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-1">
        <Button
          size="sm"
          disabled={!message.trim() || pending}
          onClick={handleSend}
          className="gap-2 rounded-xl h-9 px-4 font-semibold shadow-xs hover:shadow-sm transition-all"
        >
          <Send size={13} className={pending ? 'animate-spin' : ''} />
          <span>{pending ? 'Sending Response…' : 'Send to User'}</span>
        </Button>
      </div>
    </div>
  );
}
