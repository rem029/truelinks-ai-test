import { describe, it, expect } from 'vitest';
import { photoFileName, issuePhotoPath } from './photoFiles.ts';

describe('photoFiles', () => {
  it('derives file extensions from mime type only', () => {
    expect(photoFileName({ id: 'p1', mimeType: 'image/jpeg' })).toBe('p1.jpg');
    expect(photoFileName({ id: 'p2', mimeType: 'image/png' })).toBe('p2.png');
    expect(photoFileName({ id: 'p3', mimeType: 'image/webp' })).toBe('p3.webp');
  });

  it('builds full issue photo path', () => {
    const path = issuePhotoPath('/tmp/uploads', 'issue-123', { id: 'p1', mimeType: 'image/jpeg' });
    expect(path).toBe('/tmp/uploads/issues/issue-123/p1.jpg');
  });
});
