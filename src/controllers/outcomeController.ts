import type { Request, Response } from "express";
import * as outcomeService from "../services/outcomeService.js";

export function handleReceiveOutcome(req: Request, res: Response): void {
  try {
    const outcome = outcomeService.receiveOutcomeDelivery(
      (req.params.slug as string),
      req.body,
    );
    res.status(201).json(outcome);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export function handleListOutcomes(req: Request, res: Response): void {
  try {
    const outcomes = outcomeService.getOutcomes((req.params.slug as string));
    res.json(outcomes);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export function handleGetOutcome(req: Request, res: Response): void {
  try {
    const result = outcomeService.getOutcomeWithResponse(
      (req.params.slug as string),
      (req.params.id as string),
    );
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}
