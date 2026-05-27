import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as ctrl from "../controllers/processController.js";

const router = Router();

router.get("/:slug/processes", ctrl.listProcesses);
router.get("/:slug/processes/:processId", ctrl.getProcess);
router.post("/:slug/processes", requireAuth, ctrl.createProcess);
router.post(
  "/:slug/processes/:processId/actions",
  requireAuth,
  ctrl.executeAction,
);

export default router;
