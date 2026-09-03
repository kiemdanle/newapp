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
    <div className="space-y-3 rounded-2xl border border-border bg-card p-5 shadow-xs">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-neutral-dark font-display">Reply to User</h3>
        {success && (
          <span className="text-xs font-semibold text-emerald-600 animate-fade-in">
            Reply sent & user notified via push
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
              className="text-[11px] text-left rounded-lg border border-neutral-200 bg-neutral-light/40 px-2.5 py-1 text-neutral-dark hover:border-primary hover:bg-primary-light/20 transition-colors"
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
          placeholder="Compose a response to the user. They will receive a mobile push notification and can view this in their ticket thread."
          className="w-full rounded-xl border border-neutral-300 bg-white p-3 text-sm text-neutral-dark placeholder:text-neutral-mid/60 outline-none focus:border-primary focus:ring-4 focus:ring-primary/15 transition-all resize-none shadow-xs"
        />
        <div className="flex justify-between items-center mt-1 text-[11px] text-neutral-mid">
          <span>Markdown formatting supported.</span>
          <span>{message.length} / 3000</span>
        </div>
      </div>

      {error && <p className="text-xs text-destructive font-medium">{error}</p>}

      <div className="flex justify-end">
        <Button
          size="sm"
          disabled={!message.trim() || pending}
          onClick={handleSend}
          className="gap-1.5 rounded-xl h-9 px-4"
        >
          <Send size={13} />
          <span>{pending ? 'Sending…' : 'Send Reply'}</span>
        </Button>
      </div>
    </div>
  );
}
