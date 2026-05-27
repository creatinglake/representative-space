import { Router } from "express";
import { handleGetLedger } from "../controllers/ledgerController.js";

const router = Router();

// Public — no auth required
router.get("/:slug/ledger", handleGetLedger);

export default router;
