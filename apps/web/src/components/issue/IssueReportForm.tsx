import { useState, useEffect, useRef } from 'react';
import type { ReporterRole } from '@truelinks/shared';

export interface IssueReportFormData {
  reporterRole: ReporterRole;
  note?: string;
  photos: File[];
}

export interface IssueReportFormProps {
  onSubmit: (data: IssueReportFormData) => Promise<void>;
  // Set when adding photos to an existing report, e.g. after the agent asked for a clearer one
  title?: string;
}

interface PhotoItem {
  id: string;
  file: File;
  previewUrl: string;
}

export function IssueReportForm({ onSubmit, title = 'Report an issue' }: IssueReportFormProps) {
  const [reporterRole, setReporterRole] = useState<ReporterRole>('tenant');
  const [note, setNote] = useState('');
  const [photos, setPhotos] = useState<PhotoItem[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [workingSeconds, setWorkingSeconds] = useState(0);
  const [formError, setFormError] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Working seconds timer
  useEffect(() => {
    let timer: number | undefined;
    if (submitting) {
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
  }, [submitting]);

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      for (const p of photos) {
        URL.revokeObjectURL(p.previewUrl);
      }
    };
  }, [photos]);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    setFormError(null);
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;

    const availableSlots = 6 - photos.length;
    if (availableSlots <= 0) {
      setFormError('Maximum 6 photos allowed.');
      return;
    }

    const toAdd = files.slice(0, availableSlots);
    if (files.length > availableSlots) {
      setFormError(`Only ${availableSlots} more photo(s) could be added (max 6 total).`);
    }

    const newItems: PhotoItem[] = toAdd.map((file) => ({
      id: `${file.name}-${file.size}-${Math.random()}`,
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setPhotos((prev) => [...prev, ...newItems]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }

  function handleRemovePhoto(id: string) {
    setFormError(null);
    setPhotos((prev) => {
      const target = prev.find((p) => p.id === id);
      if (target) {
        URL.revokeObjectURL(target.previewUrl);
      }
      return prev.filter((p) => p.id !== id);
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (photos.length === 0) {
      setFormError('Please select at least 1 photo.');
      return;
    }
    if (photos.length > 6) {
      setFormError('Maximum 6 photos allowed.');
      return;
    }

    setSubmitting(true);
    setFormError(null);

    try {
      await onSubmit({
        reporterRole,
        note: note.trim() || undefined,
        photos: photos.map((p) => p.file),
      });
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="issue-report-form-container">
      <h2>{title}</h2>
      <p className="issue-report-subtitle">
        Upload 1 to 6 photos of the issue. The AI model analyzes each photo to identify condition,
        visible equipment, and damages.
      </p>

      <form onSubmit={handleSubmit} className="issue-report-form">
        {/* Reporter role */}
        <div className="form-group">
          <label className="form-label">Reporter role</label>
          <div className="segmented-control" role="radiogroup" aria-label="Reporter role">
            <label className={`segmented-option ${reporterRole === 'tenant' ? 'active' : ''}`}>
              <input
                type="radio"
                name="reporterRole"
                value="tenant"
                checked={reporterRole === 'tenant'}
                onChange={() => setReporterRole('tenant')}
                disabled={submitting}
              />
              Tenant
            </label>
            <label className={`segmented-option ${reporterRole === 'inspector' ? 'active' : ''}`}>
              <input
                type="radio"
                name="reporterRole"
                value="inspector"
                checked={reporterRole === 'inspector'}
                onChange={() => setReporterRole('inspector')}
                disabled={submitting}
              />
              Inspector
            </label>
          </div>
        </div>

        {/* Note */}
        <div className="form-group">
          <label htmlFor="issue-note" className="form-label">
            Note <span className="label-muted">(optional, max 1000 chars)</span>
          </label>
          <textarea
            id="issue-note"
            rows={3}
            maxLength={1000}
            placeholder="Describe what's wrong or what the photos show..."
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            className="issue-note-input"
          />
        </div>

        {/* Photos picker */}
        <div className="form-group">
          <label className="form-label">
            Photos <span className="label-muted">(1–6 photos: JPEG, PNG, or WebP)</span>
          </label>

          <div className="photos-picker-container">
            <input
              ref={fileInputRef}
              type="file"
              id="photos-file-input"
              multiple
              accept="image/jpeg,image/png,image/webp"
              onChange={handlePhotoSelect}
              disabled={submitting || photos.length >= 6}
              style={{ display: 'none' }}
            />
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={submitting || photos.length >= 6}
            >
              + Add photos {photos.length > 0 ? `(${photos.length}/6)` : ''}
            </button>
          </div>

          {/* Photo thumbnails */}
          {photos.length > 0 && (
            <div className="photo-previews-grid">
              {photos.map((p) => (
                <div key={p.id} className="photo-preview-item">
                  <img src={p.previewUrl} alt={p.file.name} className="photo-preview-img" />
                  <div className="photo-preview-info">
                    <span className="photo-preview-name">{p.file.name}</span>
                    <button
                      type="button"
                      className="btn btn-subtle btn-sm photo-preview-remove"
                      onClick={() => handleRemovePhoto(p.id)}
                      disabled={submitting}
                      title="Remove photo"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Form errors */}
        {formError && (
          <div className="form-error-alert" role="alert">
            <span>{formError}</span>
          </div>
        )}

        {/* Submit button & Working state */}
        <div className="form-submit-row">
          <button
            type="submit"
            className="btn btn-primary"
            disabled={submitting || photos.length === 0}
          >
            {submitting
              ? `Looking at ${photos.length === 1 ? 'the photo' : 'the photos'} and drafting a work order… ${workingSeconds}s`
              : `Submit report (${photos.length} ${photos.length === 1 ? 'photo' : 'photos'})`}
          </button>
        </div>
      </form>
    </div>
  );
}
