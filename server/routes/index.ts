import { Router } from 'express';
import documentRoutes from './document.routes';
import chatRoutes from './chat.routes';
import flashcardRoutes from './flashcard.routes';
import quizRoutes from './quiz.routes';
import explanationRoutes from './explanation.routes';
import chatHistoryRoutes from './chat_history.routes';
import notionAiRoutes from './notion_ai.routes';
import speechRoutes from './speech.routes';
import studyPlannerRoutes from './study_planner.routes';
import userPreferencesRoutes from './user_preferences.routes';
import aiPromptRoutes from './ai_prompt.routes';
import searchHistoryRoutes from './search_history.routes';
import recentDocumentsRoutes from './recent_documents.routes';
import aiAdvancedRoutes from './ai_advanced.routes';

const apiRouter = Router();

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

export default apiRouter;
