import type { Request, Response } from "express";
import * as issueService from "../services/issueService.js";
import { resolveActor, getAuthUser } from "../middleware/auth.js";
import { ModerationBlockedError } from "../modules/civic.moderation/errors.js";
import { requireModeration } from "../modules/civic.moderation/service.js";

export async function handleRaiseIssue(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const actor = resolveActor(res, slug);

    // Moderation check before creating
    const content = `${req.body.title ?? ""}\n\n${req.body.body ?? ""}`;
    await requireModeration(content);

    const issue = issueService.raiseIssue(slug, req.body, actor);
    res.status(201).json(issue);
  } catch (err) {
    if (err instanceof ModerationBlockedError) {
      res.status(400).json({
        error: "Content blocked",
        reason: err.violation_reason,
      });
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else if (message.includes("Not authorized")) {
      res.status(403).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export function handleListIssues(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const filters: { entry_type?: string; status?: string } = {};
    if (req.query.entry_type) filters.entry_type = req.query.entry_type as string;
    if (req.query.status) filters.status = req.query.status as string;
    const issues = issueService.listIssues(slug, filters);
    res.json(issues);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export function handleGetIssue(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const issueId = req.params.id as string;
    const issue = issueService.getIssue(slug, issueId);
    res.json(issue);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export async function handleEditIssue(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const issueId = req.params.id as string;
    const actor = resolveActor(res, slug);

    // Moderation check
    const content = `${req.body.title ?? ""}\n\n${req.body.body ?? ""}`;
    await requireModeration(content);

    const issue = issueService.editIssue(slug, issueId, req.body, actor);
    res.json(issue);
  } catch (err) {
    if (err instanceof ModerationBlockedError) {
      res.status(400).json({
        error: "Content blocked",
        reason: err.violation_reason,
      });
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else if (message.includes("Not authorized")) {
      res.status(403).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export function handleSignalIssue(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const issueId = req.params.id as string;
    const actor = resolveActor(res, slug);
    const result = issueService.signalIssue(slug, issueId, req.body.signal, actor);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else if (message.includes("Not authorized")) {
      res.status(403).json({ error: message });
    } else if (message.includes("closed")) {
      res.status(400).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export function handleCloseIssue(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const issueId = req.params.id as string;
    const actor = resolveActor(res, slug);
    const issue = issueService.closeIssue(slug, issueId, actor);
    res.json(issue);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else if (message.includes("Not authorized")) {
      res.status(403).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export async function handleRespondToIssue(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const issueId = req.params.id as string;
    const actor = resolveActor(res, slug);

    // Moderation check
    await requireModeration(req.body.content ?? "");

    const response = issueService.respondToIssue(slug, issueId, req.body.content, actor);
    res.status(201).json(response);
  } catch (err) {
    if (err instanceof ModerationBlockedError) {
      res.status(400).json({
        error: "Content blocked",
        reason: err.violation_reason,
      });
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else if (message.includes("Not authorized")) {
      res.status(403).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export async function handleEditIssueResponse(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const issueId = req.params.id as string;
    const actor = resolveActor(res, slug);

    // Moderation check
    await requireModeration(req.body.content ?? "");

    const response = issueService.editIssueResponse(slug, issueId, req.body.content, actor);
    res.json(response);
  } catch (err) {
    if (err instanceof ModerationBlockedError) {
      res.status(400).json({
        error: "Content blocked",
        reason: err.violation_reason,
      });
      return;
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else if (message.includes("Not authorized")) {
      res.status(403).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export function handleHideIssue(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const issueId = req.params.id as string;
    const user = getAuthUser(res);
    const issue = issueService.hideIssue(slug, issueId, req.body.reason, user.id);
    res.json(issue);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else if (message.includes("required")) {
      res.status(400).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export function handleRestoreIssue(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const issueId = req.params.id as string;
    const user = getAuthUser(res);
    const issue = issueService.restoreIssue(slug, issueId, user.id);
    res.json(issue);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}
