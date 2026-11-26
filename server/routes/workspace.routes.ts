import { Router } from 'express';
import { workspaceController } from '../controllers/workspace.controller';
import { requireAdmin } from '../middleware/auth.middleware';

const router = Router();

// Session & Workspace Bootstrap
router.get('/v1/auth/session', (req, res, next) => workspaceController.getSession(req, res, next));
router.patch('/v1/auth/session', (req, res, next) =>
  workspaceController.updateSessionProfile(req, res, next)
);
router.get('/workspace/bootstrap', (req, res, next) =>
  workspaceController.bootstrapWorkspace(req, res, next)
);
router.post('/workspace/migrate-local', (req, res, next) =>
  workspaceController.migrateLocalData(req, res, next)
);

// Notebooks
router.get('/notebooks', (req, res, next) => workspaceController.getNotebooks(req, res, next));
router.post('/notebooks', (req, res, next) => workspaceController.saveNotebook(req, res, next));
router.delete('/notebooks/:id', (req, res, next) =>
  workspaceController.deleteNotebook(req, res, next)
);

// Study Notes & Version History
router.get('/notes', (req, res, next) => workspaceController.getNotes(req, res, next));
router.post('/notes', (req, res, next) => workspaceController.saveNote(req, res, next));
router.get('/notes/:id/versions', (req, res, next) =>
  workspaceController.getNoteVersions(req, res, next)
);
router.delete('/notes/:id', (req, res, next) => workspaceController.deleteNote(req, res, next));

// Study Tasks
router.get('/tasks', (req, res, next) => workspaceController.getTasks(req, res, next));
router.post('/tasks', (req, res, next) => workspaceController.saveTask(req, res, next));
router.delete('/tasks/:id', (req, res, next) => workspaceController.deleteTask(req, res, next));

// Notifications
router.get('/notifications', (req, res, next) =>
  workspaceController.getNotifications(req, res, next)
);
router.patch('/notifications/:id/read', (req, res, next) =>
  workspaceController.markNotificationRead(req, res, next)
);
router.delete('/notifications/:id', (req, res, next) =>
  workspaceController.deleteNotification(req, res, next)
);

// Activity History Logs
router.get('/activity-logs', (req, res, next) =>
  workspaceController.getActivityLogs(req, res, next)
);
router.delete('/activity-logs', (req, res, next) =>
  workspaceController.clearActivityLogs(req, res, next)
);

// Global Search & Annotations
router.get('/search', (req, res, next) => workspaceController.globalSearch(req, res, next));
router.get('/annotations', (req, res, next) =>
  workspaceController.getAnnotations(req, res, next)
);
router.post('/annotations', (req, res, next) =>
  workspaceController.saveAnnotation(req, res, next)
);
router.delete('/annotations/:id', (req, res, next) =>
  workspaceController.deleteAnnotation(req, res, next)
);

// Workspace Export, Import & Account Deletion
router.get('/workspace/export', (req, res, next) =>
  workspaceController.exportWorkspaceData(req, res, next)
);
router.post('/workspace/import', (req, res, next) =>
  workspaceController.importWorkspaceItems(req, res, next)
);
router.delete('/workspace/account', (req, res, next) =>
  workspaceController.deleteAccountData(req, res, next)
);

// Admin Analytics & User Management
router.get('/admin/overview', requireAdmin, (req, res, next) =>
  workspaceController.getAdminOverview(req, res, next)
);
router.patch('/admin/users/:uid', requireAdmin, (req, res, next) =>
  workspaceController.adminUpdateUser(req, res, next)
);
router.delete('/admin/users/:uid', requireAdmin, (req, res, next) =>
  workspaceController.adminDeleteUser(req, res, next)
);

export default router;
