import type { ConditionCard } from '@truelinks/shared';
import { getIssuePhotoUrl } from '../../utils/api.ts';

export interface ConditionCardViewProps {
  card: ConditionCard;
  conversationId: string;
}

export function ConditionCardView({ card, conversationId }: ConditionCardViewProps) {
  return (
    <div className="card-item condition-card">
      <div className="card-header">
        <span className="card-title">Photo condition & equipment</span>
        <span className="badge badge-subtle">
          {card.photos.length} {card.photos.length === 1 ? 'photo' : 'photos'}
        </span>
      </div>

      <div className="condition-photos-list">
        {card.photos.map((photo) => {
          const photoUrl = getIssuePhotoUrl(conversationId, photo.id);

          let conditionBadgeClass = 'badge-subtle';
          if (photo.condition === 'new' || photo.condition === 'good') {
            conditionBadgeClass = 'badge-pass';
          } else if (photo.condition === 'worn') {
            conditionBadgeClass = 'badge-warn';
          } else if (photo.condition === 'damaged') {
            conditionBadgeClass = 'badge-fail';
          }

          return (
            <div key={photo.id} className="condition-photo-item">
              <div className="condition-photo-thumb-col">
                <a href={photoUrl} target="_blank" rel="noreferrer" title="Click to view full photo">
                  <img
                    src={photoUrl}
                    alt={photo.filename}
                    className="condition-photo-thumbnail"
                  />
                </a>
              </div>

              <div className="condition-photo-details">
                <div className="condition-photo-header">
                  <span className="condition-photo-name">{photo.filename}</span>
                  <span className={`badge ${conditionBadgeClass}`}>
                    {photo.condition}
                  </span>
                </div>

                {photo.damages.length > 0 && (
                  <div className="condition-damages-section">
                    <span className="condition-section-label">Damages:</span>
                    <ul className="condition-damages-list">
                      {photo.damages.map((dmg, idx) => (
                        <li key={idx}>{dmg}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {photo.equipment.length > 0 && (
                  <div className="condition-equipment-section">
                    <span className="condition-section-label">Equipment:</span>
                    <div className="chips-row">
                      {photo.equipment.map((eq, idx) => (
                        <span key={idx} className="chip">
                          {eq}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {photo.note && (
                  <p className="photo-note-muted">{photo.note}</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
