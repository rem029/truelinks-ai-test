import { useState, useEffect, useRef } from 'react';
import type { Action, ConversationDetails } from '@truelinks/shared';
import {
  getConversation,
  reportIssue,
  getIssuePhotoUrl,
  postWorkOrderAction,
  postIssueMessage,
} from '../utils/api.ts';
import { navigate, threadParent } from '../utils/router.ts';
import { CardRenderer } from '../components/cards/CardRenderer.tsx';
import { IssueReportForm, type IssueReportFormData } from '../components/issue/IssueReportForm.tsx';
import { Composer } from '../components/thread/Composer.tsx';

export interface IssueThreadPageProps {
  conversationId: string;
  initialData?: ConversationDetails;
}

export function IssueThreadPage({ conversationId, initialData }: IssueThreadPageProps) {
  const [data, setData] = useState<ConversationDetails | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [pageError, setPageError] = useState<string | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const [pendingText, setPendingText] = useState<string | null>(null);

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

  const [actionError, setActionError] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);

  async function refetch() {
    setData(await getConversation(conversationId));
  }

  // A failed draft still leaves the saved report and its messages, so always reload afterwards
  async function handleReportSubmit(formData: IssueReportFormData) {
    try {
      await reportIssue(conversationId, formData);
    } finally {
      await refetch();
    }
  }

  async function runTurn(send: () => Promise<unknown>, text: string | null = null) {
    setIsRunning(true);
    setPendingText(text);
    setActionError(null);
    try {
      await send();
    } catch (err: unknown) {
      setActionError(err instanceof Error ? err.message : String(err));
    } finally {
      await refetch();
      setIsRunning(false);
      setPendingText(null);
    }
  }

  async function handleAction(action: Action) {
    await runTurn(() => postWorkOrderAction(conversationId, action));
  }

  async function handleSendMessage(text: string) {
    await runTurn(() => postIssueMessage(conversationId, text), text);
  }

  const messageCount = data?.messages.length ?? 0;
  // Show the start of the newest message when one arrives; follow the pending message while waiting
  useEffect(() => {
    if (pendingText) {
      scrollAreaRef.current?.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    } else if (messageCount > 0) {
      latestMessageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [messageCount, pendingText]);

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

  const { conversation, messages, issue, workOrder } = data;
  const hasIssue = Boolean(issue);
  const isOpen = conversation.status === 'open';
  // Only the newest work order card takes actions; older ones show the draft as it was
  const latestWorkOrderMessageId = [...messages]
    .reverse()
    .find((m) => m.cards.some((c) => c.type === 'workOrder'))?.id;
  // Photos can be added (e.g. a clearer one) until a work order is drafted
  const canAddPhotos = hasIssue && isOpen && !workOrder;

  return (
    <div className="app-container">
      <div className="thread-container">
        {/* Header */}
        <header className="thread-header">
          <div className="thread-header-left">
            <button
              type="button"
              className="btn btn-subtle btn-sm"
              onClick={() => navigate(threadParent('issue', conversation.unitId))}
            >
              ← {conversation.unitId ?? 'Home'}
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
              {messages.map((msg, index) => (
                <div
                  key={msg.id}
                  ref={index === messages.length - 1 ? latestMessageRef : undefined}
                  className={`message-row ${msg.role}`}
                >
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

                  {/* Assistant cards (condition, work order) */}
                  {msg.role === 'assistant' && msg.cards.length > 0 && (
                    <div className="cards-container">
                      {msg.cards.map((card) => (
                        <CardRenderer
                          key={card.id}
                          card={card}
                          isInteractive={isOpen && msg.id === latestWorkOrderMessageId}
                          lease={null}
                          documents={[]}
                          onAction={handleAction}
                          conversationId={conversationId}
                          workOrder={workOrder}
                          issuePhotos={issue?.photos ?? []}
                        />
                      ))}
                    </div>
                  )}
                </div>
              ))}
              {pendingText && (
                <>
                  <div className="message-row user pending">
                    <div className="message-bubble message-bubble-pending">{pendingText}</div>
                  </div>
                  <div className="agent-working-status">
                    <span className="agent-working-dot">⚡</span>
                    <span>Redrafting the work order…</span>
                  </div>
                </>
              )}
              {canAddPhotos && <IssueReportForm title="Add more photos" onSubmit={handleReportSubmit} />}
            </>
          )}
        </div>

        {actionError && (
          <div className="form-error-alert" role="alert">
            {actionError}
          </div>
        )}

        {hasIssue && (
          <Composer
            onSendMessage={handleSendMessage}
            disabled={!isOpen}
            isRunning={isRunning}
            hasLease
            isConfirmed={!isOpen}
            placeholder={
              !isOpen
                ? 'Work order accepted.'
                : isRunning
                  ? 'Please wait for the response…'
                  : 'Describe a correction, e.g. “the drain is the landlord’s” (Enter sends)'
            }
          />
        )}
      </div>
    </div>
  );
}
