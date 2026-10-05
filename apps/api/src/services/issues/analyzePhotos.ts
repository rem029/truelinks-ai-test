import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { IssueCondition } from '@truelinks/shared';
import type { ModelProvider, CompletionRequest, CompletionResult } from '../agents/modelProvider/types.ts';

const PROMPT_PATH = resolve(import.meta.dirname, '../agents/prompts/photoAnalysis.md');
const PHOTO_ANALYSIS_PROMPT = readFileSync(PROMPT_PATH, 'utf-8');

export const PhotoAnalysisSchema = z.object({
  condition: IssueCondition,
  damages: z.array(z.string()),
  equipment: z.array(z.string()),
  note: z.string(),
});

export type PhotoAnalysis = z.infer<typeof PhotoAnalysisSchema>;

export interface PhotoInput {
  buffer: Buffer;
  originalName: string;
  mimeType: string;
}

export async function analyzePhoto(
  photo: PhotoInput,
  note: string | undefined,
  modelProvider: ModelProvider
): Promise<PhotoAnalysis> {
  const start = performance.now();
  const userContent = note
    ? `Context from reporter: ${note}\n\nPlease inspect this photo: ${photo.originalName}`
    : `Please inspect this photo: ${photo.originalName}`;

  const request: CompletionRequest<PhotoAnalysis> = {
    purpose: 'photo-analysis',
    messages: [
      { role: 'system', content: PHOTO_ANALYSIS_PROMPT },
      { role: 'user', content: userContent },
    ],
    images: [
      {
        filename: photo.originalName,
        mimeType: photo.mimeType,
        data: photo.buffer,
      },
    ],
    responseSchema: PhotoAnalysisSchema,
    reasoningEffort: 'low',
    modelTier: 'default',
  };

  // Default model sometimes returns empty content for images;
  // fast model is reliable but less careful, so it's used as a fallback.
  let result: CompletionResult<PhotoAnalysis>;
  try {
    result = await modelProvider.complete(request);
  } catch (defaultErr) {
    const defaultReason = defaultErr instanceof Error ? defaultErr.message : String(defaultErr);
    console.log(
      `photo-analysis fallback file=${photo.originalName} reason=${defaultReason.slice(0, 200)}`
    );

    try {
      result = await modelProvider.complete({
        ...request,
        modelTier: 'fast',
      });
    } catch (fastErr) {
      const fastReason = fastErr instanceof Error ? fastErr.message : String(fastErr);
      throw new Error(
        `Photo analysis failed for ${photo.originalName}: default tier failed (${defaultReason}), fast tier fallback failed (${fastReason})`
      );
    }
  }

  const ms = Math.round(performance.now() - start);
  const inTok = result.usage?.inputTokens ?? 0;
  const outTok = result.usage?.outputTokens ?? 0;
  const condition = result.output?.condition ?? 'unknown';

  console.log(`photo-analysis file=${photo.originalName} model=${result.model} condition=${condition} tokens=${inTok}/${outTok} ms=${ms}`);

  if (!result.output) {
    throw new Error(`Photo analysis failed for ${photo.originalName}: empty model output`);
  }

  return result.output;
}

export async function analyzePhotos(
  photos: PhotoInput[],
  note: string | undefined,
  modelProvider: ModelProvider
): Promise<PhotoAnalysis[]> {
  return Promise.all(photos.map((p) => analyzePhoto(p, note, modelProvider)));
}
