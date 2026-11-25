import { Router } from 'express';
import { studyPlannerController } from '../controllers/study_planner.controller';

const router = Router();

router.post('/study-planner/generate', (req, res) =>
  studyPlannerController.generatePlan(req, res)
);
router.post('/study-planner/recalibrate', (req, res) =>
  studyPlannerController.recalibratePlan(req, res)
);
router.post('/study-planner/toggle-topic', (req, res) =>
  studyPlannerController.toggleTopic(req, res)
);
router.get('/study-planner/latest', (req, res) =>
  studyPlannerController.getLatestPlan(req, res)
);
router.get('/study-planner/:id', (req, res) =>
  studyPlannerController.getPlanById(req, res)
);

export default router;
