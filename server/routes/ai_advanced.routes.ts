import { Router } from 'express';
import { aiAdvancedController } from '../controllers/ai_advanced.controller';

const router = Router();

router.get('/ai/health', (req, res, next) =>
  aiAdvancedController.getHealth(req, res, next)
);
router.post('/ai/summary', (req, res, next) =>
  aiAdvancedController.generateSummaryMode(req, res, next)
);
router.post('/ai/transform-text', (req, res, next) =>
  aiAdvancedController.transformText(req, res, next)
);
router.post('/ai/citations', (req, res, next) =>
  aiAdvancedController.generateCitations(req, res, next)
);
router.post('/ai/solve-formula', (req, res, next) =>
  aiAdvancedController.solveFormula(req, res, next)
);
router.post('/ai/code-explainer', (req, res, next) =>
  aiAdvancedController.analyzeCode(req, res, next)
);
router.post('/ai/predict-exam', (req, res, next) =>
  aiAdvancedController.predictExam(req, res, next)
);
router.post('/ai/multi-doc-synthesis', (req, res, next) =>
  aiAdvancedController.multiDocSynthesis(req, res, next)
);
router.post('/ai/generate-slides', (req, res, next) =>
  aiAdvancedController.generateSlides(req, res, next)
);
router.post('/ai/generate-diagram', (req, res, next) =>
  aiAdvancedController.generateDiagram(req, res, next)
);
router.post('/ai/generate-cheatsheet', (req, res, next) =>
  aiAdvancedController.generateCheatSheet(req, res, next)
);
router.post('/ai/generate-mnemonics', (req, res, next) =>
  aiAdvancedController.generateMnemonics(req, res, next)
);
router.post('/ai/viva-questions', (req, res, next) =>
  aiAdvancedController.generateVivaQuestions(req, res, next)
);
router.post('/ai/evaluate-viva', (req, res, next) =>
  aiAdvancedController.evaluateVivaAnswer(req, res, next)
);

export default router;
