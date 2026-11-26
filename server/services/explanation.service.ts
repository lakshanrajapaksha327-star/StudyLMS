import { ExplanationRequest, ExplanationResponse } from '../models/explanation.model';
import { AuthContext } from '../repositories/base.repository';
import { geminiService } from './gemini.service';

export class ExplanationService {
  public async generateExplanation(
    request: ExplanationRequest,
    auth?: AuthContext
  ): Promise<ExplanationResponse> {
    const { concept, mode = 'socratic', context } = request;
    return geminiService.generateExplanation(concept, mode, context, auth);
  }
}

export const explanationService = new ExplanationService();
