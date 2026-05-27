import { Router } from "express";
import {
  handlePostPosition,
  handleEditPosition,
  handleListPositions,
  handleGetPositionHistory,
} from "../controllers/positionController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireActiveSpace } from "../middleware/archiveGuard.js";

const router = Router();

router.get("/:slug/positions", handleListPositions);
router.get("/:slug/positions/:id/history", handleGetPositionHistory);
router.post("/:slug/positions", requireAuth, requireActiveSpace, handlePostPosition);
router.patch("/:slug/positions/:id", requireAuth, requireActiveSpace, handleEditPosition);

export default router;
