import type { Card, Action, Lease, LeaseDocument } from '@truelinks/shared';
import { SummaryCardView } from './SummaryCardView.tsx';
import { UnitMatchCardView } from './UnitMatchCardView.tsx';
import { FlagCardView } from './FlagCardView.tsx';
import { RuleCardView } from './RuleCardView.tsx';
import { FieldCardView } from './FieldCardView.tsx';
import { WorkOrderCardView } from './WorkOrderCardView.tsx';
import { isFieldPath, getFieldFromRecord } from '../../utils/leaseFields.ts';

export interface CardRendererProps {
  card: Card;
  isInteractive: boolean;
  lease: Lease | null;
  documents: LeaseDocument[];
  onAction: (action: Action) => Promise<void>;
}

export function CardRenderer({
  card,
  isInteractive,
  lease,
  documents,
  onAction,
}: CardRendererProps) {
  switch (card.type) {
    case 'summary':
      return (
        <SummaryCardView
          card={card}
          isInteractive={isInteractive}
          onAction={onAction}
        />
      );

    case 'unitMatch':
      return (
        <UnitMatchCardView
          card={card}
          isInteractive={isInteractive}
          currentUnitId={lease?.unitId ?? null}
          onAction={onAction}
        />
      );

    case 'flag': {
      const currentFlag = lease?.flags.find((f) => f.id === card.flag.id);
      return (
        <FlagCardView
          card={card}
          isInteractive={isInteractive}
          currentStatus={currentFlag ? currentFlag.reviewStatus : card.flag.reviewStatus}
          onAction={onAction}
        />
      );
    }

    case 'rule': {
      const currentRule = lease?.ruleResults.find((r) => r.ruleId === card.result.ruleId);
      return <RuleCardView card={card} currentRule={currentRule} />;
    }

    case 'field': {
      const currentField =
        lease && isFieldPath(card.fieldPath)
          ? getFieldFromRecord(lease.record, card.fieldPath)
          : undefined;

      return (
        <FieldCardView
          card={card}
          isInteractive={isInteractive}
          currentField={currentField}
          documents={documents}
          onAction={onAction}
        />
      );
    }

    case 'workOrder':
      return <WorkOrderCardView card={card} />;

    default: {
      const exhaustiveCheck: never = card;
      return null;
    }
  }
}
