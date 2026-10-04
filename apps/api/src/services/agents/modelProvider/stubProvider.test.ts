import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import { createStubProvider } from './stubProvider.js';

describe('stubProvider', () => {
  const provider = createStubProvider();

  it('handles photo-analysis with known and unknown photos', async () => {
    const res = await provider.complete({
      purpose: 'photo-analysis',
      messages: [],
      images: [
        {
          filename: 'issue-04-move-in-ok-1.jpg',
          mimeType: 'image/jpeg',
          data: Buffer.from(''),
        },
        {
          filename: 'issue-01-ac-leak-1.jpg',
          mimeType: 'image/jpeg',
          data: Buffer.from(''),
        },
        {
          filename: 'unknown-photo.jpg',
          mimeType: 'image/jpeg',
          data: Buffer.from(''),
        },
      ],
    });

    expect(res.model).toBe('stub');
    expect(res.toolCalls).toHaveLength(0);

    const output = res.output as {
      photos: Array<{ filename: string; condition: string; equipment: string[]; damages: string[] }>;
    };
    expect(output.photos).toHaveLength(3);

    // Known photo 1
    expect(output.photos[0]).toEqual({
      filename: 'issue-04-move-in-ok-1.jpg',
      condition: 'new',
      damages: [],
      equipment: [
        'split AC (wall-mounted)',
        'floor-to-ceiling window',
        'recessed ceiling lights',
        'smoke detector',
        'power sockets',
      ],
    });

    // Known photo 2
    expect(output.photos[1]?.condition).toBe('damaged');
    expect(output.photos[1]?.damages).toContain('brown water stain down wall below AC');

    // Unknown photo
    expect(output.photos[2]).toEqual({
      filename: 'unknown-photo.jpg',
      condition: 'undeterminable',
      equipment: [],
      damages: [],
    });
  });

  it('validates photo-analysis against responseSchema and throws on mismatch', async () => {
    const strictSchema = z.object({
      photos: z.array(
        z.object({
          filename: z.string(),
          condition: z.literal('nonexistent_condition'),
        })
      ),
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
          parameters: z.object({ fieldPath: z.string(), value: z.union([z.string(), z.number()]) }),
        },
      ],
    });

    expect(res.text).toBeNull();
    expect(res.toolCalls).toEqual([
      {
        id: 'call_update_field',
        name: 'update_field',
        args: { fieldPath: 'rent.amount', value: 8500 },
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
