import { Router } from 'express';
import { aiAdvancedController } from '../controllers/ai_advanced.controller';

const router = Router();

router.post('/ai/transform-text', (req, res) =>
  aiAdvancedController.transformText(req, res)
);
router.post('/ai/citations', (req, res) =>
  aiAdvancedController.generateCitations(req, res)
);
router.post('/ai/solve-formula', (req, res) =>
  aiAdvancedController.solveFormula(req, res)
);
router.post('/ai/code-explainer', (req, res) =>
  aiAdvancedController.analyzeCode(req, res)
);
router.post('/api/ai/predict-exam', (req, res) =>
  aiAdvancedController.predictExam(req, res)
);
router.post('/ai/predict-exam', (req, res) =>
  aiAdvancedController.predictExam(req, res)
);
router.post('/ai/multi-doc-synthesis', (req, res) =>
  aiAdvancedController.multiDocSynthesis(req, res)
);
router.post('/ai/generate-slides', (req, res) =>
  aiAdvancedController.generateSlides(req, res)
);
router.post('/ai/generate-diagram', (req, res) =>
  aiAdvancedController.generateDiagram(req, res)
);
router.post('/ai/generate-cheatsheet', (req, res) =>
  aiAdvancedController.generateCheatSheet(req, res)
);
router.post('/ai/generate-mnemonics', (req, res) =>
  aiAdvancedController.generateMnemonics(req, res)
);
router.post('/ai/viva-questions', (req, res) =>
  aiAdvancedController.generateVivaQuestions(req, res)
);
router.post('/ai/evaluate-viva', (req, res) =>
  aiAdvancedController.evaluateVivaAnswer(req, res)
);

export default router;
