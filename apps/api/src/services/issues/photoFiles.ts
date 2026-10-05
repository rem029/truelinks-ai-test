import { resolve } from 'node:path';

export function photoFileName(photo: { id: string; mimeType: string }): string {
  let ext = 'jpg';
  if (photo.mimeType === 'image/png') {
    ext = 'png';
  } else if (photo.mimeType === 'image/webp') {
    ext = 'webp';
  } else if (photo.mimeType === 'image/jpeg' || photo.mimeType === 'image/jpg') {
    ext = 'jpg';
  }
  return `${photo.id}.${ext}`;
}

export function issuePhotoPath(
  uploadDir: string,
  issueId: string,
  photo: { id: string; mimeType: string }
): string {
  return resolve(uploadDir, 'issues', issueId, photoFileName(photo));
}
