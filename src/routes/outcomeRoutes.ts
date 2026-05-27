import { Router } from "express";
import {
  handleReceiveOutcome,
  handleListOutcomes,
  handleGetOutcome,
} from "../controllers/outcomeController.js";
import {
  handlePostResponse,
  handleEditResponse,
} from "../controllers/responseController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireHmac } from "../middleware/hmac.js";

const router = Router();

router.post("/:slug/inbox", requireHmac, handleReceiveOutcome);
router.get("/:slug/outcomes", handleListOutcomes);
router.get("/:slug/outcomes/:id", handleGetOutcome);
router.post("/:slug/outcomes/:id/response", requireAuth, handlePostResponse);
router.patch("/:slug/outcomes/:id/response", requireAuth, handleEditResponse);

export default router;
