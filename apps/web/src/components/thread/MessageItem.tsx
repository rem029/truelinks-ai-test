import { useState } from 'react';
import type { Message, Lease, LeaseDocument, Action } from '@truelinks/shared';
import { AgentRunDisclosure } from './AgentRunDisclosure.tsx';
import { CardRenderer } from '../cards/CardRenderer.tsx';
import { getDocumentFileUrl } from '../../utils/api.ts';

export interface MessageItemProps {
  message: Message;
  isLatestAssistantMessage: boolean;
  lease: Lease | null;
  documents: LeaseDocument[];
  onAction: (action: Action) => Promise<void>;
  containerRef?: React.Ref<HTMLDivElement>;
}

export function MessageItem({
  message,
  isLatestAssistantMessage,
  lease,
  documents,
  onAction,
  containerRef,
}: MessageItemProps) {
  const [showOlderCards, setShowOlderCards] = useState(false);

  const isUser = message.role === 'user';
  const isAssistant = message.role === 'assistant';

  // If lease is confirmed, actions are disabled on cards as well
  const isInteractive = isLatestAssistantMessage && lease?.status !== 'confirmed';

  return (
    <div ref={containerRef} className={`message-row ${message.role}`}>
      {isAssistant && message.agentRun && (
        <AgentRunDisclosure agentRun={message.agentRun} />
      )}

      {message.text && (
        <div className="message-bubble">
          {message.text}
        </div>
      )}

      {message.attachments.length > 0 && (
        <div className="attachments-list">
          {message.attachments.map((att) => (
            <a
              key={att.id}
              href={getDocumentFileUrl(att.id)}
              target="_blank"
              rel="noreferrer"
              className="attachment-chip"
            >
              📄 <span>{att.filename}</span> ↗
            </a>
          ))}
        </div>
      )}

      {isAssistant && message.cards.length > 0 && (
        isLatestAssistantMessage ? (
          <div className="cards-container">
            {message.cards.map((card) => (
              <CardRenderer
                key={card.id}
                card={card}
                isInteractive={isInteractive}
                lease={lease}
                documents={documents}
                onAction={onAction}
              />
            ))}
          </div>
        ) : (
          <div className="older-cards-container">
            <button
              type="button"
              className="btn btn-subtle btn-sm older-cards-toggle"
              onClick={() => setShowOlderCards((prev) => !prev)}
            >
              {showOlderCards
                ? `Hide ${message.cards.length} ${message.cards.length === 1 ? 'card' : 'cards'} ▴`
                : `Show ${message.cards.length} ${message.cards.length === 1 ? 'card' : 'cards'} ▾`}
            </button>
            {showOlderCards && (
              <div className="cards-container" style={{ marginTop: '0.5rem' }}>
                {message.cards.map((card) => (
                  <CardRenderer
                    key={card.id}
                    card={card}
                    isInteractive={false}
                    lease={lease}
                    documents={documents}
                    onAction={onAction}
                  />
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
}
