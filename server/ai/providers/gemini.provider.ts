import { GoogleGenAI } from '@google/genai';
import {
  AiGenerateRequest,
  AiProviderAdapter,
  AiProviderExecutionResult,
  AiEmbeddingResult,
  AiSpeechResult,
  AiTaskType,
} from '../ai-provider.interface';
import { AiServiceError, classifyProviderError } from '../ai-errors';
import { modelRegistry } from '../model-registry';

export function pcmBase64ToWavBase64(pcmBase64: string, sampleRate = 24000): string {
  const pcmBuffer = Buffer.from(pcmBase64, 'base64');
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]).toString('base64');
}

function withAbortRace<T>(promise: Promise<T>, signal?: AbortSignal): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(new DOMException('Aborted', 'AbortError'));
  }
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(new DOMException('Aborted', 'AbortError'));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (val) => {
        signal.removeEventListener('abort', onAbort);
        resolve(val);
      },
      (err) => {
        signal.removeEventListener('abort', onAbort);
        reject(err);
      }
    );
  });
}

export class GeminiProvider implements AiProviderAdapter {
  public readonly id = 'gemini' as const;
  public readonly displayName = 'Google Gemini (@google/genai)';

  public isConfigured(): boolean {
    return Boolean(process.env.GEMINI_API_KEY?.trim());
  }

  public supportsTask(_taskType: AiTaskType): boolean {
    return true;
  }

  public getConfiguredModel(taskType: AiTaskType, preferredModel?: string): string {
    return modelRegistry.resolveModelForProvider('gemini', taskType, preferredModel);
  }

  private getClient(): GoogleGenAI {
    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new AiServiceError({
        message: 'GEMINI_API_KEY environment variable is not configured.',
        statusCode: 503,
        category: 'provider_unavailable',
        retryable: false,
        switchProviderAllowed: true,
        provider: 'gemini',
      });
    }
    return new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });
  }

  public async generateText(
    req: AiGenerateRequest,
    model: string,
    signal?: AbortSignal
  ): Promise<AiProviderExecutionResult> {
    const ai = this.getClient();
    const startTime = Date.now();

    const config: Record<string, any> = {};
    if (req.systemInstruction) {
      config.systemInstruction = req.systemInstruction;
    }
    if (req.responseMimeType) {
      config.responseMimeType = req.responseMimeType;
    }
    if (req.geminiResponseSchema) {
      config.responseSchema = req.geminiResponseSchema;
    }
    if (signal) {
      config.abortSignal = signal;
    }

    // Strict Gemini-4 parameter rule
    if (model.startsWith('gemini-4')) {
      delete config.temperature;
      delete config.topP;
      delete config.topK;
      delete config.candidateCount;
    }

    try {
      const response = await withAbortRace(
        ai.models.generateContent({
          model,
          contents: req.contents as any,
          config: Object.keys(config).length > 0 ? config : undefined,
        }),
        signal
      );

      const latencyMs = Date.now() - startTime;
      const meta = response.usageMetadata;
      const inputTokens = typeof meta?.promptTokenCount === 'number' ? meta.promptTokenCount : null;
      const outputTokens =
        typeof meta?.candidatesTokenCount === 'number' ? meta.candidatesTokenCount : null;
      const totalTokens =
        typeof meta?.totalTokenCount === 'number'
          ? meta.totalTokenCount
          : inputTokens !== null || outputTokens !== null
          ? (inputTokens || 0) + (outputTokens || 0)
          : null;

      return {
        text: response.text || '',
        provider: 'gemini',
        model,
        latencyMs,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          actualCostUsd: null,
        },
        finishReason: response.candidates?.[0]?.finishReason,
      };
    } catch (err) {
      throw classifyProviderError(err, 'gemini');
    }
  }

  public async embedTexts(
    texts: string[],
    taskType: 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY' = 'RETRIEVAL_DOCUMENT'
  ): Promise<AiEmbeddingResult> {
    const model = this.getConfiguredModel('embeddings');
    if (texts.length === 0) {
      return {
        vectors: [],
        model,
        dimension: 768,
        provider: 'gemini',
        latencyMs: 0,
        usage: { inputTokens: 0, outputTokens: 0, totalTokens: 0, actualCostUsd: null },
      };
    }

    const ai = this.getClient();
    const startTime = Date.now();
    const vectors: number[][] = [];
    let dimension = 768;

    try {
      for (const text of texts) {
        const res = await ai.models.embedContent({
          model,
          contents: text.slice(0, 8000),
          config: {
            taskType,
            outputDimensionality: 768,
          },
        });
        const values = res.embeddings?.[0]?.values;
        if (!values || values.length === 0) {
          throw new Error('Empty embedding vector returned.');
        }
        dimension = values.length;
        vectors.push(values);
      }

      return {
        vectors,
        model,
        dimension,
        provider: 'gemini',
        latencyMs: Date.now() - startTime,
        usage: {
          inputTokens: null,
          outputTokens: null,
          totalTokens: null,
          actualCostUsd: null,
        },
      };
    } catch (err) {
      throw classifyProviderError(err, 'gemini');
    }
  }

  public async generateSpeech(text: string, voice = 'Kore'): Promise<AiSpeechResult> {
    const ai = this.getClient();
    const model = this.getConfiguredModel('tts');
    const startTime = Date.now();

    try {
      const response = await ai.models.generateContent({
        model,
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const rawPcmBase64 = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
      if (!rawPcmBase64) {
        throw new AiServiceError({
          message: 'TTS model returned no audio data.',
          statusCode: 502,
          category: 'malformed_output',
          retryable: false,
          switchProviderAllowed: true,
          provider: 'gemini',
        });
      }

      // Gemini 3.8 unary TTS already returns a WAV file with RIFF header ('UklGR' in base64)
      const wavBase64 = rawPcmBase64.startsWith('UklGR')
        ? rawPcmBase64
        : pcmBase64ToWavBase64(rawPcmBase64, 24000);

      return {
        audioBase64: wavBase64,
        mimeType: 'audio/wav',
        model,
        provider: 'gemini',
        latencyMs: Date.now() - startTime,
      };
    } catch (err) {
      throw classifyProviderError(err, 'gemini');
    }
  }

  public async transcribeAudio(
    audioBase64: string,
    mimeType: string,
    prompt = 'Transcribe this audio accurately with timestamps where clear and indicate speaker changes if distinct speakers are detectable.',
    signal?: AbortSignal
  ): Promise<AiProviderExecutionResult> {
    const ai = this.getClient();
    const model = this.getConfiguredModel('audio_transcription');
    const startTime = Date.now();

    try {
      const response = await withAbortRace(
        ai.models.generateContent({
          model,
          contents: {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: audioBase64,
                },
              },
              { text: prompt },
            ],
          } as any,
          ...(signal ? { config: { abortSignal: signal } } : {}),
        }),
        signal
      );

      const latencyMs = Date.now() - startTime;
      const meta = response.usageMetadata;
      const inputTokens = typeof meta?.promptTokenCount === 'number' ? meta.promptTokenCount : null;
      const outputTokens =
        typeof meta?.candidatesTokenCount === 'number' ? meta.candidatesTokenCount : null;
      const totalTokens =
        typeof meta?.totalTokenCount === 'number'
          ? meta.totalTokenCount
          : inputTokens !== null || outputTokens !== null
          ? (inputTokens || 0) + (outputTokens || 0)
          : null;

      return {
        text: response.text || '',
        provider: 'gemini',
        model,
        latencyMs,
        usage: {
          inputTokens,
          outputTokens,
          totalTokens,
          actualCostUsd: null,
        },
        finishReason: response.candidates?.[0]?.finishReason,
      };
    } catch (err) {
      throw classifyProviderError(err, 'gemini');
    }
  }
}

export const geminiProvider = new GeminiProvider();
