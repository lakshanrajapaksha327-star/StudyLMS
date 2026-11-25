import { Request, Response } from 'express';
import { getGeminiClient } from '../config/gemini';

export class SpeechController {
  public async generateSpeech(req: Request, res: Response) {
    try {
      const { text, voice = 'Kore' } = req.body;
      if (!text) return res.status(400).json({ error: 'Text required for TTS.' });

      const ai = getGeminiClient();

      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-tts-preview',
        contents: [{ parts: [{ text: text.slice(0, 1000) }] }],
        config: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voice },
            },
          },
        },
      });

      const base64Audio =
        response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!base64Audio) {
        return res.status(500).json({ error: 'No audio generated.' });
      }

      res.json({ audioBase64: base64Audio });
    } catch (error: any) {
      console.error('Speech Generation Error:', error);
      res.status(500).json({ error: 'Failed to synthesize speech audio.' });
    }
  }
}

export const speechController = new SpeechController();
