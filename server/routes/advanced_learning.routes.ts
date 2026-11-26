import { Router } from 'express';
import multer from 'multer';
import { advancedLearningController } from '../controllers/advanced_learning.controller';

const audioUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB cap
  },
});

const router = Router();

// Personalized Insights
router.get('/learning/insights', (req, res, next) =>
  advancedLearningController.getPersonalizedInsights(req, res, next)
);

// Adaptive Tutor & Topic Mastery
router.get('/learning/topic-mastery', (req, res, next) =>
  advancedLearningController.listTopicMasteries(req, res, next)
);
router.post('/learning/adaptive-step', (req, res, next) =>
  advancedLearningController.runAdaptiveStep(req, res, next)
);
router.delete('/learning/topic-mastery/:id', (req, res, next) =>
  advancedLearningController.deleteTopicMastery(req, res, next)
);

// Unified Revision Schedule
router.get('/learning/revision-schedule', (req, res, next) =>
  advancedLearningController.getRevisionSchedule(req, res, next)
);
router.patch('/learning/revision-schedule/reschedule', (req, res, next) =>
  advancedLearningController.rescheduleRevision(req, res, next)
);

// Smart Exam Preparation Workspace
router.get('/exam-prep', (req, res, next) =>
  advancedLearningController.listExamPrep(req, res, next)
);
router.post('/exam-prep/generate', (req, res, next) =>
  advancedLearningController.generateExamPrep(req, res, next)
);
router.patch('/exam-prep/:id/checklist', (req, res, next) =>
  advancedLearningController.updateExamPrepChecklist(req, res, next)
);
router.delete('/exam-prep/:id', (req, res, next) =>
  advancedLearningController.deleteExamPrep(req, res, next)
);

// Concept Maps & Visual Learning Studio
router.get('/diagrams', (req, res, next) =>
  advancedLearningController.listDiagrams(req, res, next)
);
router.post('/diagrams/generate', (req, res, next) =>
  advancedLearningController.generateDiagram(req, res, next)
);
router.post('/diagrams', (req, res, next) =>
  advancedLearningController.saveDiagram(req, res, next)
);
router.delete('/diagrams/:id', (req, res, next) =>
  advancedLearningController.deleteDiagram(req, res, next)
);

// Audio Lecture Assistant
router.get('/audio-lectures', (req, res, next) =>
  advancedLearningController.listAudioLectures(req, res, next)
);
router.post('/audio-lectures/upload', audioUpload.single('audio'), (req, res, next) =>
  advancedLearningController.uploadAudioLecture(req, res, next)
);
router.delete('/audio-lectures/:id', (req, res, next) =>
  advancedLearningController.deleteAudioLecture(req, res, next)
);

// Study Session Tracker
router.get('/study-sessions', (req, res, next) =>
  advancedLearningController.listStudySessions(req, res, next)
);
router.post('/study-sessions', (req, res, next) =>
  advancedLearningController.createStudySession(req, res, next)
);
router.delete('/study-sessions/:id', (req, res, next) =>
  advancedLearningController.deleteStudySession(req, res, next)
);

// Learning Analytics
router.get('/analytics', (req, res, next) =>
  advancedLearningController.getAnalytics(req, res, next)
);

export default router;
