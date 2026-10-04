import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { getDocumentProxy, extractText } from 'unpdf';
import mammoth from 'mammoth';
import type { TextSource } from '@truelinks/shared';
import { HttpError } from '../../../utils/httpError.ts';
import type { ModelProvider } from '../../agents/modelProvider/types.ts';

const PROMPT_PATH = resolve(import.meta.dirname, '../../agents/prompts/leaseTranscription.md');
const LEASE_TRANSCRIPTION_PROMPT = readFileSync(PROMPT_PATH, 'utf-8');

export const SUPPORTED_MIME_TYPES = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'image/png': '.png',
  'image/jpeg': '.jpg',
} as const;

export type SupportedMimeType = keyof typeof SUPPORTED_MIME_TYPES;

export function isSupportedMimeType(m: string): m is SupportedMimeType {
  return m in SUPPORTED_MIME_TYPES;
}

export interface ReadDocumentOptions {
  filename?: string;
  modelProvider?: ModelProvider;
}

export interface ReadDocumentResult {
  pages: Array<{ page: number | null; text: string }>;
  textSource: TextSource;
}

export async function readPdfPages(buffer: Buffer): Promise<Array<{ page: number; text: string }>> {
  // Copying into a new Uint8Array avoids sharing Node's pooled ArrayBuffer,
  // which pdf.js might transfer or detach during text extraction.
  const data = new Uint8Array(buffer);
  const pdf = await getDocumentProxy(data);
  const { text } = await extractText(pdf, { mergePages: false });
  const textArray = Array.isArray(text) ? text : [text];
  return textArray.map((pageText, idx) => ({
    page: idx + 1,
    text: pageText,
  }));
}

export async function readDocxText(buffer: Buffer): Promise<Array<{ page: null; text: string }>> {
  const result = await mammoth.extractRawText({ buffer });
  return [{ page: null, text: result.value }];
}

export async function readImageText(
  buffer: Buffer,
  mimeType: string,
  options?: ReadDocumentOptions
): Promise<Array<{ page: number; text: string }>> {
  if (!options?.modelProvider) {
    throw new HttpError(500, 'Model provider is required to transcribe image documents');
  }

  const result = await options.modelProvider.complete({
    purpose: 'lease-transcription',
    messages: [
      { role: 'system', content: LEASE_TRANSCRIPTION_PROMPT },
      { role: 'user', content: 'Transcribe this lease document.' },
    ],
    images: [
      {
        filename: options.filename ?? 'lease-image.png',
        mimeType,
        data: buffer,
      },
    ],
    responseSchema: z.object({ text: z.string() }),
  });

  const text = result.output?.text ?? result.text ?? '';
  return [{ page: 1, text }];
}

export async function readLeaseDocument(
  buffer: Buffer,
  mimeType: string,
  options?: ReadDocumentOptions
): Promise<ReadDocumentResult> {
  if (!isSupportedMimeType(mimeType)) {
    throw new HttpError(400, `Unsupported document type '${mimeType}'. Only PDF, DOCX, PNG, and JPEG files are supported.`);
  }

  if (mimeType === 'application/pdf') {
    const pages = await readPdfPages(buffer);
    return { pages, textSource: 'text' };
  }

  if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    const pages = await readDocxText(buffer);
    return { pages, textSource: 'text' };
  }

  const pages = await readImageText(buffer, mimeType, options);
  return { pages, textSource: 'image' };
}
