export type ExplanationMode =
  | 'socratic'
  | 'eli5'
  | 'step_by_step'
  | 'deep_dive'
  | 'analogy';

export interface ExplanationRequest {
  concept: string;
  mode: ExplanationMode;
  context?: string;
}

export interface ExplanationResponse {
  concept: string;
  mode: ExplanationMode;
  explanation: string;
  keyTakeaways: string[];
  suggestedFollowUps: string[];
}
