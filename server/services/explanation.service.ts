import { ExplanationRequest, ExplanationResponse } from '../models/explanation.model';
import { geminiService } from './gemini.service';

export class ExplanationService {
  public async generateExplanation(request: ExplanationRequest): Promise<ExplanationResponse> {
    const { concept, mode = 'socratic', context } = request;
    return geminiService.generateExplanation(concept, mode, context);
  }
}

export const explanationService = new ExplanationService();
