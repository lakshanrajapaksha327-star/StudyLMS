import { Request, Response, NextFunction } from 'express';
import { aiManagerService } from '../ai/ai-manager.service';
import { ApiError } from '../middleware/validate.middleware';
import { getAuthContext } from '../repositories/base.repository';

export class SpeechController {
  public async generateSpeech(req: Request, res: Response, next: NextFunction) {
    try {
      const auth = getAuthContext(req);
      const { text, voice = 'Kore' } = req.body;
      if (!text || !String(text).trim()) {
        throw new ApiError(400, 'Text required for TTS.');
      }

      const cleanedText = String(text).replace(/[#*_`~]/g, '').slice(0, 1500);
      const speech = await aiManagerService.generateSpeech(cleanedText, String(voice), auth);

      res.json({
        success: true,
        audioBase64: speech.audioBase64,
        mimeType: speech.mimeType,
        provider: speech.provider,
        model: speech.model,
      });
    } catch (err) {
      next(err);
    }
  }
}

export const speechController = new SpeechController();
