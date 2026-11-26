import { Router } from 'express';
import { requireAuth } from '../middleware/auth.middleware';
import advancedLearningRoutes from './advanced_learning.routes';
import aiAdvancedRoutes from './ai_advanced.routes';
import aiPromptRoutes from './ai_prompt.routes';
import chatHistoryRoutes from './chat_history.routes';
import chatRoutes from './chat.routes';
import documentRoutes from './document.routes';
import explanationRoutes from './explanation.routes';
import flashcardRoutes from './flashcard.routes';
import notionAiRoutes from './notion_ai.routes';
import quizRoutes from './quiz.routes';
import recentDocumentsRoutes from './recent_documents.routes';
import searchHistoryRoutes from './search_history.routes';
import speechRoutes from './speech.routes';
import studyPlannerRoutes from './study_planner.routes';
import userPreferencesRoutes from './user_preferences.routes';
import workspaceRoutes from './workspace.routes';

const apiRouter = Router();

// Enforce verified Firebase authentication for all user workspace & AI endpoints
apiRouter.use(requireAuth);

apiRouter.use('/', workspaceRoutes);
apiRouter.use('/', documentRoutes);
apiRouter.use('/', chatRoutes);
apiRouter.use('/', flashcardRoutes);
apiRouter.use('/', quizRoutes);
apiRouter.use('/', explanationRoutes);
apiRouter.use('/', chatHistoryRoutes);
apiRouter.use('/', notionAiRoutes);
apiRouter.use('/', speechRoutes);
apiRouter.use('/', studyPlannerRoutes);
apiRouter.use('/', userPreferencesRoutes);
apiRouter.use('/', aiPromptRoutes);
apiRouter.use('/', searchHistoryRoutes);
apiRouter.use('/', recentDocumentsRoutes);
apiRouter.use('/', aiAdvancedRoutes);
apiRouter.use('/', advancedLearningRoutes);

export default apiRouter;
