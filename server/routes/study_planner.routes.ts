import { Router } from 'express';
import { studyPlannerController } from '../controllers/study_planner.controller';

const router = Router();

router.post('/study-planner/generate', (req, res, next) =>
  studyPlannerController.generatePlan(req, res, next)
);
router.post('/study-planner/recalibrate', (req, res, next) =>
  studyPlannerController.recalibratePlan(req, res, next)
);
router.post('/study-planner/toggle-topic', (req, res, next) =>
  studyPlannerController.toggleTopic(req, res, next)
);
router.get('/study-planner/all', (req, res, next) =>
  studyPlannerController.getAllPlans(req, res, next)
);
router.get('/study-planner/latest', (req, res, next) =>
  studyPlannerController.getLatestPlan(req, res, next)
);
router.get('/study-planner/:id', (req, res, next) =>
  studyPlannerController.getPlanById(req, res, next)
);

export default router;
