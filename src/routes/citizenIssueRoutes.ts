import { Router } from "express";
import {
  handleRaiseIssue,
  handleListIssues,
  handleGetIssue,
  handleEditIssue,
  handleSignalIssue,
  handleCloseIssue,
  handleRespondToIssue,
  handleEditIssueResponse,
  handleHideIssue,
  handleRestoreIssue,
} from "../controllers/citizenIssueController.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";
import { requireActiveSpace } from "../middleware/archiveGuard.js";

const router = Router();

// Public reads
router.get("/:slug/issues", handleListIssues);
router.get("/:slug/issues/:id", handleGetIssue);

// Citizen writes (require active space)
router.post("/:slug/issues", requireAuth, requireActiveSpace, handleRaiseIssue);
router.patch("/:slug/issues/:id", requireAuth, requireActiveSpace, handleEditIssue);
router.post("/:slug/issues/:id/signal", requireAuth, requireActiveSpace, handleSignalIssue);

// Entity writes
router.patch("/:slug/issues/:id/close", requireAuth, handleCloseIssue);
router.post("/:slug/issues/:id/response", requireAuth, requireActiveSpace, handleRespondToIssue);
router.patch("/:slug/issues/:id/response", requireAuth, requireActiveSpace, handleEditIssueResponse);

// Admin moderation
router.patch("/:slug/issues/:id/hide", requireAdmin, handleHideIssue);
router.patch("/:slug/issues/:id/restore", requireAdmin, handleRestoreIssue);

export default router;
