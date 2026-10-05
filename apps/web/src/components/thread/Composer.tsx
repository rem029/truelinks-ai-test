import { useState, useRef } from 'react';

export interface ComposerProps {
  onSendMessage: (text: string) => Promise<void>;
  disabled: boolean;
  isRunning: boolean;
  hasLease: boolean;
  isConfirmed: boolean;
  placeholder?: string;
}

export function Composer({
  onSendMessage,
  disabled,
  isRunning,
  hasLease,
  isConfirmed,
  placeholder: placeholderOverride,
}: ComposerProps) {
  const [text, setText] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  async function handleSend() {
    const trimmed = text.trim();
    if (!trimmed || isRunning || disabled) return;
    setText('');
    await onSendMessage(trimmed);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const placeholder = placeholderOverride ?? (!hasLease
    ? 'Upload a lease to start'
    : isConfirmed
    ? 'Lease is confirmed. Actions disabled.'
    : isRunning
    ? 'Please wait for response…'
    : 'Type a message or correction… (Enter sends, Shift+Enter for newline)');

  return (
    <div className="composer-area">
      <form
        className="composer-form"
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
      >
        <textarea
          ref={textareaRef}
          className="composer-textarea"
          rows={1}
          placeholder={placeholder}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled || isRunning}
        />
        <button
          type="submit"
          className="btn btn-primary"
          disabled={disabled || isRunning || !text.trim()}
          style={{ height: '44px' }}
        >
          Send
        </button>
      </form>
    </div>
  );
}
