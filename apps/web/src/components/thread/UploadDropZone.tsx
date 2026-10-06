import { useState, useRef, useEffect } from 'react';
import { formatElapsedSeconds } from '../../utils/formatters.ts';

export interface UploadDropZoneProps {
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  error: string | null;
  onClearError: () => void;
}

export function UploadDropZone({
  onUpload,
  uploading,
  error,
  onClearError,
}: UploadDropZoneProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let timer: number | undefined;
    if (uploading) {
      setElapsed(0);
      timer = window.setInterval(() => {
        setElapsed((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsed(0);
    }
    return () => {
      if (timer !== undefined) clearInterval(timer);
    };
  }, [uploading]);

  function handleFile(file: File) {
    onClearError();
    setSelectedFile(file);
    onUpload(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (uploading) return;
    const file = e.dataTransfer.files[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    if (!uploading) {
      setIsDragging(true);
    }
  }

  function handleDragLeave(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
  }

  function handleClick() {
    if (!uploading && fileInputRef.current) {
      fileInputRef.current.click();
    }
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  const currentStep = elapsed < 3 ? 'Reading document' : 'Extracting fields';

  return (
    <div className="drop-zone-container">
      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,.docx,.png,.jpg,.jpeg,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,image/png,image/jpeg"
        hidden
        onChange={handleFileInputChange}
      />

      <div
        className={`drop-zone ${isDragging ? 'dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={handleClick}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        {uploading ? (
          <div className="upload-progress">
            <div className="upload-progress-icon">⏳</div>
            <div className="upload-progress-step">
              {currentStep}…
            </div>
            <div className="upload-progress-elapsed">
              Elapsed: {formatElapsedSeconds(elapsed)}
            </div>
          </div>
        ) : (
          <>
            <div className="drop-zone-icon">📄</div>
            <div className="drop-zone-title">Upload a lease document to begin review</div>
            <div className="drop-zone-subtitle">
              Drag &amp; drop a PDF, DOCX, PNG, or JPEG file here, or click to browse
            </div>
          </>
        )}
      </div>

      {error && (
        <div className="upload-error-alert">
          <div>
            <strong>Upload failed:</strong> {error}
          </div>
          {selectedFile && (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleFile(selectedFile)}
            >
              Retry
            </button>
          )}
        </div>
      )}
    </div>
  );
}
