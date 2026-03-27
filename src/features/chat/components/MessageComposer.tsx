'use client';

import { FormEvent, useState } from 'react';

type MessageComposerProps = {
  onSubmit: (content: string) => Promise<void>;
  sending: boolean;
  disabled?: boolean;
};

export default function MessageComposer({ onSubmit, sending, disabled }: MessageComposerProps) {
  const [draft, setDraft] = useState('');

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft.trim() || disabled || sending) {
      return;
    }
    await onSubmit(draft);
    setDraft('');
  }

  return (
    <form onSubmit={handleSubmit} className="border-t border-gray-800 p-4">
      <div className="flex gap-3">
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          placeholder="اكتب رسالتك هنا..."
          className="flex-1 rounded-xl border border-gray-700 bg-gray-900 px-4 py-2 text-sm text-white outline-none ring-indigo-500 transition focus:ring"
          disabled={disabled || sending}
        />
        <button
          type="submit"
          disabled={disabled || sending || !draft.trim()}
          className="rounded-xl bg-indigo-600 px-5 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? 'إرسال...' : 'إرسال'}
        </button>
      </div>
    </form>
  );
}
