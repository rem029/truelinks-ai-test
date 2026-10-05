import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createStubProvider } from './stubProvider.ts';

describe('stubProvider', () => {
  const provider = createStubProvider();

  it('handles photo-analysis with known and unknown photos', async () => {
    // Known photo 1
    const res1 = await provider.complete({
      purpose: 'photo-analysis',
      messages: [],
      images: [
        {
          filename: 'issue-04-move-in-ok-1.jpg',
          mimeType: 'image/jpeg',
          data: Buffer.from(''),
        },
      ],
    });

    expect(res1.model).toBe('stub');
    expect(res1.toolCalls).toHaveLength(0);
    const output1 = res1.output as { condition: string; equipment: string[]; damages: string[]; note: string };
    expect(output1).toEqual({
      condition: 'new',
      damages: [],
      equipment: [
        'split AC (wall-mounted)',
        'floor-to-ceiling window',
        'recessed ceiling lights',
        'smoke detector',
        'power sockets',
      ],
      note: '',
    });

    // Known photo 2
    const res2 = await provider.complete({
      purpose: 'photo-analysis',
      messages: [],
      images: [
        {
          filename: 'issue-01-ac-leak-1.jpg',
          mimeType: 'image/jpeg',
          data: Buffer.from(''),
        },
      ],
    });
    const output2 = res2.output as { condition: string; equipment: string[]; damages: string[]; note: string };
    expect(output2.condition).toBe('damaged');
    expect(output2.damages).toContain('brown water stain down wall below AC');

    // Unknown photo
    const res3 = await provider.complete({
      purpose: 'photo-analysis',
      messages: [],
      images: [
        {
          filename: 'unknown-photo.jpg',
          mimeType: 'image/jpeg',
          data: Buffer.from(''),
        },
      ],
    });
    const output3 = res3.output as { condition: string; equipment: string[]; damages: string[]; note: string };
    expect(output3).toEqual({
      condition: 'undeterminable',
      damages: [],
      equipment: [],
      note: 'stub: no fixture for this photo',
    });
  });

  it('validates photo-analysis against responseSchema and throws on mismatch', async () => {
    const strictSchema = z.object({
      condition: z.literal('nonexistent_condition'),
      damages: z.array(z.string()),
      equipment: z.array(z.string()),
      note: z.string(),
    });

    await expect(
      provider.complete({
        purpose: 'photo-analysis',
        messages: [],
        images: [{ filename: 'issue-04-move-in-ok-1.jpg', mimeType: 'image/jpeg', data: Buffer.from('') }],
        responseSchema: strictSchema,
      })
    ).rejects.toThrow('Stub provider output failed responseSchema validation');
  });

  it('handles lease-correction for a parsed user correction with update_field tool', async () => {
    const res = await provider.complete({
      purpose: 'lease-correction',
      messages: [{ role: 'user', content: 'monthly rent should be QAR 8,500' }],
      tools: [
        {
          name: 'update_field',
          description: 'Updates a field',
          parameters: z.object({ fieldPath: z.string(), value: z.string() }),
        },
      ],
    });

    expect(res.text).toBeNull();
    expect(res.toolCalls).toEqual([
      {
        id: 'call_update_field',
        name: 'update_field',
        args: { fieldPath: 'rent.amount', value: '8500' },
      },
    ]);
  });

  it('handles lease-correction for an ambiguous user input with ask_user tool', async () => {
    const res = await provider.complete({
      purpose: 'lease-correction',
      messages: [{ role: 'user', content: 'change it' }],
      tools: [
        {
          name: 'ask_user',
          description: 'Asks user a clarifying question',
          parameters: z.object({ question: z.string() }),
        },
      ],
    });

    expect(res.text).toBeNull();
    expect(res.toolCalls).toEqual([
      {
        id: 'call_ask_user',
        name: 'ask_user',
        args: { question: 'Which field should I change, and to what value?' },
      },
    ]);
  });

  it('returns text when tools are not provided in lease-correction', async () => {
    const resParsed = await provider.complete({
      purpose: 'lease-correction',
      messages: [{ role: 'user', content: 'rent is 8500' }],
    });
    expect(resParsed.toolCalls).toHaveLength(0);
    expect(resParsed.text).toBe('Updated rent.amount to 8500.');

    const resUnparsed = await provider.complete({
      purpose: 'lease-correction',
      messages: [{ role: 'user', content: 'change it' }],
    });
    expect(resUnparsed.toolCalls).toHaveLength(0);
    expect(resUnparsed.text).toBe('Which field should I change, and to what value?');
  });

  it('summarises the result when the last message is a tool result', async () => {
    const res = await provider.complete({
      purpose: 'lease-correction',
      messages: [
        { role: 'user', content: 'rent is 8500' },
        {
          role: 'assistant',
          content: '',
          toolCalls: [
            {
              id: 'call_123',
              name: 'update_field',
              args: { fieldPath: 'rent.amount', value: 8500 },
            },
          ],
        },
        { role: 'tool', toolCallId: 'call_123', content: '{"ok":true}' },
      ],
    });

    expect(res.toolCalls).toHaveLength(0);
    expect(res.text).toBe('Updated rent.amount to 8500.');
  });

  it('throws on unsupported purpose', async () => {
    await expect(
      provider.complete({
        purpose: 'unsupported-purpose',
        messages: [],
      })
    ).rejects.toThrow("Stub provider has no scripted response for purpose 'unsupported-purpose'");
  });
});
