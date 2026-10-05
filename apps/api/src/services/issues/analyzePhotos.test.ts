import { describe, it, expect, vi } from 'vitest';
import { analyzePhoto, type PhotoInput, type PhotoAnalysis } from './analyzePhotos.ts';
import type { ModelProvider, CompletionRequest, CompletionResult } from '../agents/modelProvider/types.ts';

describe('analyzePhoto', () => {
  const samplePhoto: PhotoInput = {
    buffer: Buffer.from('fake-image-bytes'),
    originalName: 'leak-photo.jpg',
    mimeType: 'image/jpeg',
  };

  const fastAnalysis: PhotoAnalysis = {
    condition: 'damaged',
    damages: ['water stain', 'leakage'],
    equipment: ['pipe'],
    note: 'Fast tier analysis result',
  };

  const defaultAnalysis: PhotoAnalysis = {
    condition: 'good',
    damages: [],
    equipment: ['wall'],
    note: 'Default tier analysis result',
  };

  it('(a) default throws once -> fast succeeds -> returns fast output and fast call had modelTier fast', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const completeMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('Default model returned empty content'))
      .mockResolvedValueOnce({
        text: JSON.stringify(fastAnalysis),
        toolCalls: [],
        output: fastAnalysis,
        model: 'google/gemini-2.5-flash-lite',
        usage: { inputTokens: 40, outputTokens: 20 },
      });

    const fakeProvider: ModelProvider = {
      name: 'openrouter',
      async complete<T>(req: CompletionRequest<T>): Promise<CompletionResult<T>> {
        return completeMock(req);
      },
    };

    const result = await analyzePhoto(samplePhoto, 'water dripping', fakeProvider);

    expect(result).toEqual(fastAnalysis);
    expect(completeMock).toHaveBeenCalledTimes(2);
    expect(completeMock).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        modelTier: 'default',
      })
    );
    expect(completeMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        modelTier: 'fast',
      })
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      'photo-analysis fallback file=leak-photo.jpg reason=Default model returned empty content'
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^photo-analysis file=leak-photo\.jpg model=google\/gemini-2\.5-flash-lite condition=damaged tokens=40\/20 ms=\d+$/)
    );

    consoleSpy.mockRestore();
  });

  it('(b) both throw -> rejects with a message containing both reasons', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const completeMock = vi
      .fn()
      .mockRejectedValueOnce(new Error('default model empty content'))
      .mockRejectedValueOnce(new Error('fast model rate limit exceeded'));

    const fakeProvider: ModelProvider = {
      name: 'openrouter',
      async complete<T>(req: CompletionRequest<T>): Promise<CompletionResult<T>> {
        return completeMock(req);
      },
    };

    await expect(
      analyzePhoto(samplePhoto, undefined, fakeProvider)
    ).rejects.toThrowError(/default model empty content.*fast model rate limit exceeded/s);

    expect(completeMock).toHaveBeenCalledTimes(2);

    consoleSpy.mockRestore();
  });

  it('(c) default succeeds -> fast never called', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    const completeMock = vi.fn().mockResolvedValue({
      text: JSON.stringify(defaultAnalysis),
      toolCalls: [],
      output: defaultAnalysis,
      model: 'xiaomi/mimo',
      usage: { inputTokens: 100, outputTokens: 50 },
    });

    const fakeProvider: ModelProvider = {
      name: 'openrouter',
      async complete<T>(req: CompletionRequest<T>): Promise<CompletionResult<T>> {
        return completeMock(req);
      },
    };

    const result = await analyzePhoto(samplePhoto, 'inspection', fakeProvider);

    expect(result).toEqual(defaultAnalysis);
    expect(completeMock).toHaveBeenCalledTimes(1);
    expect(completeMock).toHaveBeenCalledWith(
      expect.objectContaining({
        modelTier: 'default',
      })
    );

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringMatching(/^photo-analysis file=leak-photo\.jpg model=xiaomi\/mimo condition=good tokens=100\/50 ms=\d+$/)
    );

    consoleSpy.mockRestore();
  });
});
