import { useState } from 'react';
import type { AgentRun } from '@truelinks/shared';
import { formatTokens } from '../../utils/formatters.ts';

export interface AgentRunDisclosureProps {
  agentRun: AgentRun;
}

export function AgentRunDisclosure({ agentRun }: AgentRunDisclosureProps) {
  const [open, setOpen] = useState(false);

  const stepCount = agentRun.toolCalls.length;
  const stepLabel = stepCount === 1 ? '1 step' : `${stepCount} steps`;
  const totalTokens = agentRun.inputTokens + agentRun.outputTokens;
  const seconds = (agentRun.ms / 1000).toFixed(1);

  const summary = `${stepLabel} · ${agentRun.model} · ${formatTokens(totalTokens)} · ${seconds}s`;

  function formatShortArgs(args: unknown): string {
    if (args === null || args === undefined) return '';
    try {
      const str = typeof args === 'string' ? args : JSON.stringify(args);
      if (str.length > 60) {
        return str.slice(0, 57) + '...';
      }
      return str;
    } catch {
      return '';
    }
  }

  return (
    <div className="agent-run-box">
      <div
        className="agent-run-summary"
        onClick={() => setOpen((prev) => !prev)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            setOpen((prev) => !prev);
          }
        }}
      >
        <span>{open ? '▾' : '▸'}</span> <span>{summary}</span>
      </div>

      {open && (
        <div className="agent-tool-calls">
          {agentRun.toolCalls.map((call, idx) => (
            <div key={idx} className="agent-tool-item">
              <div>
                <span className="agent-tool-name">{call.name}</span>
                {call.args !== undefined && (
                  <span className="agent-tool-args">
                    {formatShortArgs(call.args)}
                  </span>
                )}
              </div>
              <div className="agent-tool-meta">
                <span className="agent-tool-duration">{call.ms}ms</span>
                <span className={`badge ${call.ok ? 'badge-pass' : 'badge-fail'}`}>
                  {call.ok ? 'ok' : 'error'}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
