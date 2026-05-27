import { Router } from "express";
import { requireAdmin } from "../middleware/auth.js";
import { getAllEvents } from "../stores/eventStore.js";

const router = Router();

router.get("/moderation/log", requireAdmin, async (_req, res) => {
  const allEvents = await getAllEvents();
  const restricted = allEvents.filter(
    (e) => e.meta.visibility === "restricted",
  );
  res.json({
    entries: restricted,
    count: restricted.length,
  });
});

export default router;
