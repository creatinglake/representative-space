import { Router } from "express";
import { requireAuth } from "../middleware/auth.js";
import * as ctrl from "../controllers/deliberationController.js";

const router = Router();

// Participation endpoints — require auth + canActor(participate_deliberation)
router.post("/:slug/processes/:processId/participate/vote", requireAuth, ctrl.vote);
router.post("/:slug/processes/:processId/participate/statement", requireAuth, ctrl.submitStatement);
router.get("/:slug/processes/:processId/participate/next", requireAuth, ctrl.getNextStatement);

// Public — no auth required
router.get("/:slug/processes/:processId/clusters", ctrl.getClusterState);

// Host actions — require auth + canActor(host_deliberation)
router.post("/:slug/processes/:processId/actions/close", requireAuth, ctrl.closeDeliberation);
router.post("/:slug/processes/:processId/actions/regenerate", requireAuth, ctrl.regenerateSummary);

export default router;
