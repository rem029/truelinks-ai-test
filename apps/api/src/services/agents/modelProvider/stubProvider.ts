import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { z } from 'zod';
import { IssueCondition } from '@truelinks/shared';
import { REPO_ROOT } from '../../../env.ts';
import type { CompletionRequest, CompletionResult, ModelProvider, ToolCall } from './types.ts';
import { parseCorrection } from './parseCorrection.ts';
import { stubWorkOrder, type ExpectedWorkOrder } from './stubWorkOrder.ts';
import { blankLeaseRecord, sampleLeaseAnalyses, sampleLeaseRecords } from '../../leases/sampleLeaseRecords.ts';
import { toExtraction } from '../../leases/extract/fromRecord.ts';

const ExpectedPhotoEntrySchema = z.object({
  condition: IssueCondition,
  equipment: z.array(z.string()),
  damages: z.array(z.string()),
});

type ExpectedPhotoEntry = z.infer<typeof ExpectedPhotoEntrySchema>;

const ExpectedIssueGroupSchema = z.object({
  unitId: z.string().optional(),
  lease: z.string().optional(),
  photos: z.record(z.string(), ExpectedPhotoEntrySchema).optional(),
  workOrder: z.record(z.string(), z.unknown()).optional(),
  notes: z.string().optional(),
  safety: z.string().optional(),
});

const ExpectedPhotosFileSchema = z.object({
  _note: z.string().optional(),
}).catchall(ExpectedIssueGroupSchema);

function stubResult<T>(params: {
  text?: string | null;
  toolCalls?: ToolCall[];
  output?: T | null;
}): CompletionResult<T> {
  return {
    text: params.text ?? null,
    toolCalls: params.toolCalls ?? [],
    output: params.output ?? null,
    model: 'stub',
    usage: { inputTokens: 0, outputTokens: 0 },
  };
}

function photoAnalysis<T>(
  req: CompletionRequest<T>,
  photoMap: Map<string, ExpectedPhotoEntry>
): CompletionResult<T> {
  const img = req.images?.[0];
  const filename = img?.filename ?? '';
  const known = photoMap.get(filename);

  let output: unknown;
  if (known) {
    output = {
      condition: known.condition,
      damages: [...known.damages],
      equipment: [...known.equipment],
      note: '',
    };
  } else {
    output = {
      condition: 'undeterminable',
      damages: [],
      equipment: [],
      note: 'stub: no fixture for this photo',
    };
  }

  if (req.responseSchema) {
    const validation = req.responseSchema.safeParse(output);
    if (!validation.success) {
      const issues = validation.error.issues
        .map((i) => `${i.path.join('.') || 'root'}: ${i.message}`)
        .join(', ');
      throw new Error(`Stub provider output failed responseSchema validation for '${req.purpose}': ${issues}`);
    }
    output = validation.data;
  }

  return stubResult({
    text: JSON.stringify(output),
    output: output as T,
  });
}

function leaseCorrection<T>(req: CompletionRequest<T>): CompletionResult<T> {
  const lastMsg = req.messages[req.messages.length - 1];

  if (lastMsg?.role === 'tool') {
    let summary = 'Update completed.';
    for (let i = req.messages.length - 2; i >= 0; i--) {
      const msg = req.messages[i];
      if (msg && msg.role === 'assistant' && 'toolCalls' in msg && msg.toolCalls) {
        const matchingCall = msg.toolCalls.find((tc) => tc.id === lastMsg.toolCallId);
        if (
          matchingCall &&
          matchingCall.name === 'update_field' &&
          typeof matchingCall.args === 'object' &&
          matchingCall.args !== null
        ) {
          const args = matchingCall.args as { fieldPath?: string; value?: unknown };
          if (args.fieldPath && args.value !== undefined) {
            summary = `Updated ${args.fieldPath} to ${args.value}.`;
            break;
          }
        }
      }
    }
    return stubResult({ text: summary });
  }

  let lastUserText = '';
  for (let i = req.messages.length - 1; i >= 0; i--) {
    const msg = req.messages[i];
    if (msg && msg.role === 'user') {
      lastUserText = msg.content;
      break;
    }
  }

  const correction = parseCorrection(lastUserText);
  const availableToolNames = new Set((req.tools ?? []).map((t) => t.name));

  if (correction) {
    if (availableToolNames.has('update_field')) {
      return stubResult({
        toolCalls: [
          {
            id: 'call_update_field',
            name: 'update_field',
            args: { fieldPath: correction.fieldPath, value: String(correction.value) },
          },
        ],
      });
    }
    return stubResult({ text: `Updated ${correction.fieldPath} to ${correction.value}.` });
  }

  const question = 'Which field should I change, and to what value?';
  if (availableToolNames.has('ask_user')) {
    return stubResult({
      toolCalls: [
        {
          id: 'call_ask_user',
          name: 'ask_user',
          args: { question },
        },
      ],
    });
  }

  return stubResult({ text: question });
}

// Lease extraction and analysis inputs start with "Document: <filename>", which picks the sample fixture
function leaseFixture<T>(req: CompletionRequest<T>): CompletionResult<T> {
  const userText = req.messages.find((m) => m.role === 'user')?.content ?? '';
  const filename = userText.match(/^Document: (.+)$/m)?.[1]?.trim() ?? '';

  let output: unknown =
    req.purpose === 'lease-extraction'
      ? toExtraction(sampleLeaseRecords[filename] ?? blankLeaseRecord)
      : (sampleLeaseAnalyses[filename] ?? { conflicts: [], concerns: [] });
  if (req.responseSchema) {
    output = req.responseSchema.parse(output);
  }
  return stubResult({ text: JSON.stringify(output), output: output as T });
}

export function createStubProvider(): ModelProvider {
  const expectedPhotosPath = resolve(REPO_ROOT, 'data/sample-photos/expected.json');
  const rawData = readFileSync(expectedPhotosPath, 'utf-8');
  const parsedJson = ExpectedPhotosFileSchema.parse(JSON.parse(rawData));

  const photoMap = new Map<string, ExpectedPhotoEntry>();
  const workOrderFixtures: ExpectedWorkOrder[] = [];
  for (const [key, value] of Object.entries(parsedJson)) {
    if (key === '_note' || typeof value !== 'object' || value === null) continue;
    if ('photos' in value && value.photos) {
      workOrderFixtures.push({ photoFilenames: Object.keys(value.photos), workOrder: value.workOrder });
      for (const [filename, photo] of Object.entries(value.photos)) {
        photoMap.set(filename, photo);
      }
    }
  }

  return {
    name: 'stub',
    async complete<T = unknown>(req: CompletionRequest<T>): Promise<CompletionResult<T>> {
      if (req.purpose === 'photo-analysis') {
        return photoAnalysis(req, photoMap);
      }
      if (req.purpose === 'work-order') {
        return stubWorkOrder(req, workOrderFixtures);
      }
      if (req.purpose === 'lease-correction') {
        return leaseCorrection(req);
      }
      if (req.purpose === 'lease-transcription') {
        const filename = req.images?.[0]?.filename ?? '';
        const baseName = filename.replace(/\.[^/.]+$/, '');
        const txtPath = resolve(REPO_ROOT, 'data/sample-leases', `${baseName}.txt`);
        let text = '';
        try {
          text = readFileSync(txtPath, 'utf-8');
        } catch {
          text = '';
        }
        let output: unknown = { text };
        if (req.responseSchema) {
          output = req.responseSchema.parse(output);
        }
        return stubResult({ text: JSON.stringify(output), output: output as T });
      }

      if (req.purpose === 'lease-clause-headings') {
        let output: unknown = { headings: [] };
        if (req.responseSchema) {
          output = req.responseSchema.parse(output);
        }
        return stubResult({ text: JSON.stringify(output), output: output as T });
      }

      if (req.purpose === 'lease-extraction' || req.purpose === 'lease-analysis') {
        return leaseFixture(req);
      }

      throw new Error(`Stub provider has no scripted response for purpose '${req.purpose}'`);
    },
  };
}
