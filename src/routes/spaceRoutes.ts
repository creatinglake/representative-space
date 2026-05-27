import { Router } from "express";
import {
  handleCreateSpace,
  handleListSpaces,
  handleGetSpace,
  handleUpdateSpace,
  handleVerifyEntity,
  handleArchiveSpace,
  handleUnarchiveSpace,
} from "../controllers/spaceController.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const router = Router();

router.get("/", handleListSpaces);
router.get("/:slug", handleGetSpace);
router.post("/", requireAdmin, handleCreateSpace);
router.patch("/:slug", requireAuth, handleUpdateSpace);
router.post("/:slug/verify", requireAdmin, handleVerifyEntity);
router.post("/:slug/archive", requireAdmin, handleArchiveSpace);
router.post("/:slug/unarchive", requireAdmin, handleUnarchiveSpace);

export default router;
