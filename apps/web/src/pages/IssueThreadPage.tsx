import { useState, useEffect, useRef } from 'react';
import type { ConversationDetails } from '@truelinks/shared';
import {
  getConversation,
  reportIssue,
  getIssuePhotoUrl,
} from '../utils/api.ts';
import { navigate } from '../utils/router.ts';
import { CardRenderer } from '../components/cards/CardRenderer.tsx';
import { IssueReportForm, type IssueReportFormData } from '../components/issue/IssueReportForm.tsx';

export interface IssueThreadPageProps {
  conversationId: string;
  initialData?: ConversationDetails;
}

export function IssueThreadPage({ conversationId, initialData }: IssueThreadPageProps) {
  const [data, setData] = useState<ConversationDetails | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [pageError, setPageError] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (initialData) return;
    let active = true;
    setLoading(true);
    setPageError(null);

    getConversation(conversationId)
      .then((details) => {
        if (active) {
          setData(details);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (active) {
          setPageError(err instanceof Error ? err.message : String(err));
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [conversationId, initialData]);

  async function handleReportSubmit(formData: IssueReportFormData) {
    const response = await reportIssue(conversationId, formData);
    setData((prev) => {
      if (!prev) return prev;
      return {
        ...prev,
        issue: response.issue,
        messages: response.messages,
      };
    });
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="thread-loading">Loading conversation…</div>
      </div>
    );
  }

  if (pageError || !data) {
    return (
      <div className="app-container">
        <div className="thread-error-container">
          <h2>Conversation not found</h2>
          <p className="thread-error-text">{pageError || 'Could not load conversation.'}</p>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => navigate({ name: 'home' })}
          >
            ← Back to Start
          </button>
        </div>
      </div>
    );
  }

  const { conversation, messages, issue } = data;
  const hasIssue = Boolean(issue);

  return (
    <div className="app-container">
      <div className="thread-container">
        {/* Header */}
        <header className="thread-header">
          <div className="thread-header-left">
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onClick={() => navigate({ name: 'home' })}
            >
              ← All reviews
            </button>
            <div className="thread-title">
              <span>Issue report</span>
              {conversation.unitId && (
                <span className="badge badge-accent">Unit {conversation.unitId}</span>
              )}
              <span className="badge badge-subtle">{conversation.status}</span>
            </div>
          </div>
        </header>

        {/* Content area */}
        <div ref={scrollAreaRef} className="thread-scroll-area">
          {!hasIssue ? (
            <IssueReportForm onSubmit={handleReportSubmit} />
          ) : (
            <>
              {messages.map((msg) => (
                <div key={msg.id} className={`message-row ${msg.role}`}>
                  {msg.text && <div className="message-bubble">{msg.text}</div>}

                  {/* User attachments (photo thumbnails) */}
                  {msg.role === 'user' && msg.attachments.length > 0 && (
                    <div className="message-photos-grid">
                      {msg.attachments.map((att) => {
                        const url = getIssuePhotoUrl(conversationId, att.id);
                        return (
                          <a
                            key={att.id}
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            className="message-photo-item"
                            title={att.filename}
                          >
                            <img src={url} alt={att.filename} className="message-photo-img" />
                            <span className="message-photo-name">{att.filename}</span>
                          </a>
                        );
                      })}
                    </div>
                  )}

                  {/* Assistant cards (ConditionCard) */}
                  {msg.role === 'assistant' && msg.cards.length > 0 && (
                    <div className="cards-container">
                      {msg.cards.map((card) => (
                        <CardRenderer
                          key={card.id}
                          card={card}
                          isInteractive={false}
                          lease={null}
                          documents={[]}
                          onAction={async () => {}}
                          conversationId={conversationId}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
