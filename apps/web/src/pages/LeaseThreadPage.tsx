import { useState, useEffect, useRef, useCallback } from 'react';
import type {
  ConversationDetails,
  Action,
} from '@truelinks/shared';
import {
  getConversation,
  uploadLeaseDocument,
  postCardAction,
  postMessage,
  ApiError,
} from '../utils/api.ts';
import { navigate, threadParent, toHash } from '../utils/router.ts';
import { MessageItem } from '../components/thread/MessageItem.tsx';
import { UploadDropZone } from '../components/thread/UploadDropZone.tsx';
import { ConfirmBar } from '../components/thread/ConfirmBar.tsx';
import { Composer } from '../components/thread/Composer.tsx';
import { formatElapsedSeconds } from '../utils/formatters.ts';

export interface LeaseThreadPageProps {
  conversationId: string;
  initialData?: ConversationDetails;
}

interface ActionErrorInfo {
  message: string;
  pending?: string[];
  failures?: string[];
}

export function LeaseThreadPage({ conversationId, initialData }: LeaseThreadPageProps) {
  const [data, setData] = useState<ConversationDetails | null>(initialData ?? null);
  const [loading, setLoading] = useState(!initialData);
  const [pageError, setPageError] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isExecutingAction, setIsExecutingAction] = useState(false);
  const [pendingUserText, setPendingUserText] = useState<string | null>(null);
  const [workingSeconds, setWorkingSeconds] = useState(0);

  const [actionError, setActionError] = useState<ActionErrorInfo | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);

  const refetch = useCallback(async () => {
    try {
      const details = await getConversation(conversationId);
      setData(details);
      setPageError(null);
    } catch (err: unknown) {
      setPageError(err instanceof Error ? err.message : String(err));
    }
  }, [conversationId]);

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

  // Poll every 3 seconds while analysisStatus === 'pending'
  useEffect(() => {
    let timer: number | undefined;
    if (data?.lease && data.lease.analysisStatus === 'pending') {
      timer = window.setInterval(() => {
        refetch();
      }, 3000);
    }
    return () => {
      if (timer !== undefined) clearInterval(timer);
    };
  }, [data?.lease?.analysisStatus, refetch]);

  // Timer for in-flight message sending
  useEffect(() => {
    let timer: number | undefined;
    if (isSendingMessage) {
      setWorkingSeconds(0);
      timer = window.setInterval(() => {
        setWorkingSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setWorkingSeconds(0);
    }
    return () => {
      if (timer !== undefined) clearInterval(timer);
    };
  }, [isSendingMessage]);

  const latestAssistantRef = useRef<HTMLDivElement>(null);
  const prevLatestAssistantIdRef = useRef<string | null>(null);

  const assistantMessages = data?.messages.filter((m) => m.role === 'assistant') ?? [];
  const latestAssistantId = assistantMessages.at(-1)?.id ?? null;

  // Scroll to bottom when sending message, or scroll to START of newest assistant message when reply arrives
  useEffect(() => {
    if (latestAssistantId && latestAssistantId !== prevLatestAssistantIdRef.current) {
      prevLatestAssistantIdRef.current = latestAssistantId;
      latestAssistantRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (pendingUserText) {
      if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTop = scrollAreaRef.current.scrollHeight;
      }
    }
  }, [latestAssistantId, pendingUserText]);

  async function handleUpload(file: File) {
    setActionError(null);
    setUploading(true);
    setUploadError(null);
    try {
      await uploadLeaseDocument(conversationId, file);
      await refetch();
    } catch (err: unknown) {
      setUploadError(err instanceof Error ? err.message : String(err));
    } finally {
      setUploading(false);
    }
  }

  async function handleAction(action: Action) {
    setActionError(null);
    setIsExecutingAction(true);
    try {
      await postCardAction(conversationId, action);
      await refetch();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const details = err.details as { pending?: unknown; failures?: unknown } | undefined;
        setActionError({
          message: err.message,
          pending: Array.isArray(details?.pending) ? (details?.pending as string[]) : undefined,
          failures: Array.isArray(details?.failures) ? (details?.failures as string[]) : undefined,
        });
      } else {
        setActionError({
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setIsExecutingAction(false);
    }
  }

  async function handleSendMessage(text: string) {
    setActionError(null);
    setPendingUserText(text);
    setIsSendingMessage(true);
    try {
      await postMessage(conversationId, text);
      await refetch();
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        const details = err.details as { pending?: unknown; failures?: unknown } | undefined;
        setActionError({
          message: err.message,
          pending: Array.isArray(details?.pending) ? (details?.pending as string[]) : undefined,
          failures: Array.isArray(details?.failures) ? (details?.failures as string[]) : undefined,
        });
      } else {
        setActionError({
          message: err instanceof Error ? err.message : String(err),
        });
      }
    } finally {
      setPendingUserText(null);
      setIsSendingMessage(false);
    }
  }

  async function handleConfirm(overrideReason?: string) {
    await handleAction({
      type: 'confirm',
      conversationId,
      overrideReason,
    });
  }

  if (loading) {
    return (
      <div className="app-container">
        <div className="thread-loading">
          Loading conversation…
        </div>
      </div>
    );
  }

  if (pageError || !data) {
    return (
      <div className="app-container">
        <div className="thread-error-container">
          <h2>Conversation not found</h2>
          <p className="thread-error-text">
            {pageError || 'Could not load conversation.'}
          </p>
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

  const { conversation, messages, documents, lease, review } = data;
  const isConfirmed = conversation.status === 'confirmed' || lease?.status === 'confirmed';
  const isBusy = isSendingMessage || isExecutingAction || uploading;

  return (
    <div className="app-container">
      <div className="thread-container">
        {/* Header */}
        <header className="thread-header">
          <div className="thread-header-left">
            <a className="btn btn-subtle btn-sm" href={toHash(threadParent('lease', lease?.unitId ?? conversation.unitId))}>
              ← {lease?.unitId ?? conversation.unitId ?? 'Unassigned'}
            </a>
            <div className="thread-title">
              <h1 className="thread-heading">Lease review</h1>
              {isConfirmed ? (
                <span className="badge badge-pass">Confirmed</span>
              ) : (
                <span className="badge badge-subtle">{conversation.status}</span>
              )}
            </div>
          </div>

          <div>
            {lease && lease.analysisStatus === 'pending' && (
              <span className="badge badge-warn analysis-pending-badge">
                <span>⏳</span>
                <span>Full review running…</span>
              </span>
            )}
          </div>
        </header>

        {/* Scrollable messages area */}
        <div ref={scrollAreaRef} className="thread-scroll-area">
          {!lease ? (
            <UploadDropZone
              onUpload={handleUpload}
              uploading={uploading}
              error={uploadError}
              onClearError={() => setUploadError(null)}
            />
          ) : (
            <>
              {messages.map((msg) => (
                <MessageItem
                  key={msg.id}
                  message={msg}
                  isLatestAssistantMessage={msg.id === latestAssistantId && !isConfirmed}
                  lease={lease}
                  documents={documents}
                  onAction={handleAction}
                  containerRef={msg.id === latestAssistantId ? latestAssistantRef : undefined}
                />
              ))}

              {pendingUserText && (
                <div className="message-row user pending">
                  <div className="message-bubble message-bubble-pending">
                    {pendingUserText}
                  </div>
                </div>
              )}

              {isSendingMessage && (
                <div className="agent-working-status">
                  <span className="agent-working-dot">⚡</span>
                  <span>Agent is working… {formatElapsedSeconds(workingSeconds)}</span>
                </div>
              )}
            </>
          )}
        </div>

        {/* Dismissible action error alert above confirm bar */}
        {actionError && (
          <div className="action-error-alert" role="alert">
            <div className="action-error-content">
              <span className="action-error-title">{actionError.message}</span>
              {actionError.pending && actionError.pending.length > 0 && (
                <ul className="action-error-list">
                  {actionError.pending.map((item, idx) => (
                    <li key={idx}>{item}</li>
                  ))}
                </ul>
              )}
              {actionError.failures && actionError.failures.length > 0 && (
                <ul className="action-error-list">
                  {actionError.failures.map((fail, idx) => (
                    <li key={idx}>Rule failure: {fail}</li>
                  ))}
                </ul>
              )}
            </div>
            <button
              type="button"
              className="btn btn-subtle btn-sm action-error-dismiss"
              onClick={() => setActionError(null)}
              aria-label="Dismiss error"
            >
              ✕
            </button>
          </div>
        )}

        {/* Sticky confirm bar once a lease exists */}
        {lease && (
          <ConfirmBar
            lease={lease}
            review={review}
            onConfirm={handleConfirm}
            disabled={isBusy}
          />
        )}

        {/* Composer */}
        <Composer
          onSendMessage={handleSendMessage}
          disabled={isConfirmed || !lease}
          isRunning={isSendingMessage || isExecutingAction}
          hasLease={!!lease}
          isConfirmed={isConfirmed}
        />
      </div>
    </div>
  );
}
