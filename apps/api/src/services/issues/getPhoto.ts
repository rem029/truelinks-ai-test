import type { Repositories } from '../../db/repositories/index.ts';
import { HttpError } from '../../utils/httpError.ts';
import { issuePhotoPath } from './photoFiles.ts';

export interface GetIssuePhotoResult {
  filePath: string;
  mimeType: string;
}

export async function getIssuePhoto(
  conversationId: string,
  photoId: string,
  context: { repositories: Repositories; uploadDir: string }
): Promise<GetIssuePhotoResult> {
  const issue = await context.repositories.issues.getByConversation(conversationId);
  if (!issue) {
    throw new HttpError(404, `Issue for conversation ${conversationId} not found`);
  }

  const photo = issue.photos.find((p) => p.id === photoId);
  if (!photo) {
    throw new HttpError(404, `Photo ${photoId} not found in issue ${issue.id}`);
  }

  return {
    filePath: issuePhotoPath(context.uploadDir, issue.id, photo),
    mimeType: photo.mimeType,
  };
}
