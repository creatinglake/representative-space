import type {
  CitizenIssue,
  IssueResponse,
  RaiseIssueInput,
  EditIssueInput,
  PollOption,
} from "../models/issue.js";
import type { Actor } from "../auth/types.js";
import { canActor } from "../auth/canActor.js";
import * as issueStore from "../stores/issueStore.js";
import { getSpaceBySlug } from "../stores/spaceStore.js";
import { emitEvent } from "../events/eventEmitter.js";
import { generateId } from "../utils/id.js";

export async function raiseIssue(
  slug: string,
  input: RaiseIssueInput,
  actor: Actor,
): Promise<CitizenIssue> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  if (!canActor(actor, "raise_issue", { type: "space", slug })) {
    throw new Error("Not authorized to raise issues");
  }

  if (!input.title || input.title.trim().length === 0) {
    throw new Error("Issue title is required");
  }
  if (!input.body || input.body.trim().length === 0) {
    throw new Error("Issue body is required");
  }

  const entryType = input.entry_type ?? "issue";
  if (!["issue", "question", "poll"].includes(entryType)) {
    throw new Error("Invalid entry_type");
  }

  let pollOptions: PollOption[] = [];
  let pollTally: Record<string, number> = {};
  if (entryType === "poll" && input.poll_options) {
    pollOptions = input.poll_options.map((label, i) => ({
      id: `opt_${i + 1}`,
      label,
    }));
    for (const opt of pollOptions) {
      pollTally[opt.id] = 0;
    }
  }

  const now = new Date().toISOString();
  const issue: CitizenIssue = {
    id: generateId("iss"),
    space_slug: slug,
    author_id: actor.userId,
    entry_type: entryType,
    title: input.title.trim(),
    body: input.body.trim(),
    jurisdiction_tag: input.jurisdiction_tag ?? space.jurisdiction,
    status: "open",
    version: 1,
    prior_version_id: null,
    poll_options: pollOptions,
    poll_tally: pollTally,
    signal_tally: { support: 0, oppose: 0 },
    latest_response: null,
    moderation: { hidden: false },
    created_at: now,
    updated_at: now,
  };

  await issueStore.addIssue(issue);

  await emitEvent({
    event_type: "civic.issue_raised",
    actor: actor.userId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      issue_id: issue.id,
      entry_type: issue.entry_type,
      title: issue.title,
    },
  });

  return issue;
}

export async function listIssues(
  slug: string,
  filters?: { entry_type?: string; status?: string },
): Promise<CitizenIssue[]> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  let issues = await issueStore.getIssuesBySlug(slug);

  // Exclude hidden issues from public list
  issues = issues.filter((i) => !i.moderation.hidden);

  if (filters?.entry_type) {
    issues = issues.filter((i) => i.entry_type === filters.entry_type);
  }
  if (filters?.status) {
    issues = issues.filter((i) => i.status === filters.status);
  }

  // Sort by net support (support - oppose), descending
  issues.sort((a, b) => {
    const netA = a.signal_tally.support - a.signal_tally.oppose;
    const netB = b.signal_tally.support - b.signal_tally.oppose;
    if (netB !== netA) return netB - netA;
    // Tiebreak by created_at descending
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return issues;
}

export async function getIssue(
  slug: string,
  issueId: string,
): Promise<CitizenIssue> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const issue = await issueStore.getIssueById(issueId);
  if (!issue || issue.space_slug !== slug) {
    throw new Error(`Issue "${issueId}" not found on space "${slug}"`);
  }

  // If hidden, redact body
  if (issue.moderation.hidden) {
    return {
      ...issue,
      body: "[Content hidden by moderator]",
    };
  }

  return issue;
}

export async function editIssue(
  slug: string,
  issueId: string,
  input: EditIssueInput,
  actor: Actor,
): Promise<CitizenIssue> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const issue = await issueStore.getIssueById(issueId);
  if (!issue || issue.space_slug !== slug) {
    throw new Error(`Issue "${issueId}" not found on space "${slug}"`);
  }

  // Only the author can edit their issue
  if (issue.author_id !== actor.userId) {
    throw new Error("Not authorized to edit this issue");
  }

  const now = new Date().toISOString();

  // Create new version (immutable versioning)
  const updated: CitizenIssue = {
    ...issue,
    title: input.title?.trim() ?? issue.title,
    body: input.body?.trim() ?? issue.body,
    version: issue.version + 1,
    prior_version_id: issue.id,
    updated_at: now,
  };

  await issueStore.updateIssue(issue.id, updated);

  await emitEvent({
    event_type: "civic.issue_edited",
    actor: actor.userId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      issue_id: issue.id,
      version: updated.version,
    },
    visibility: "public",
  });

  return updated;
}

export async function signalIssue(
  slug: string,
  issueId: string,
  signal: string,
  actor: Actor,
): Promise<{ signal: string; issue_id: string }> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  if (!canActor(actor, "signal_issue", { type: "space", slug })) {
    throw new Error("Not authorized to signal on issues");
  }

  const issue = await issueStore.getIssueById(issueId);
  if (!issue || issue.space_slug !== slug) {
    throw new Error(`Issue "${issueId}" not found on space "${slug}"`);
  }

  if (issue.status === "closed") {
    throw new Error("Cannot signal on a closed issue");
  }

  // Validate signal value
  const validSignals = ["support", "oppose"];
  const validPollSignals = issue.poll_options.map((o) => o.id);
  const allValid = [...validSignals, ...validPollSignals];

  if (!allValid.includes(signal)) {
    throw new Error(`Invalid signal value: "${signal}"`);
  }

  // Get previous signal and remove its count
  const prevSignal = await issueStore.getSignal(issueId, actor.userId);
  const tally = { ...issue.signal_tally };
  const pollTally = { ...issue.poll_tally };

  if (prevSignal) {
    if (prevSignal === "support" || prevSignal === "oppose") {
      tally[prevSignal] = Math.max(0, (tally[prevSignal] ?? 0) - 1);
    } else if (pollTally[prevSignal] !== undefined) {
      pollTally[prevSignal] = Math.max(0, pollTally[prevSignal] - 1);
    }
  }

  // Add new signal count
  if (signal === "support" || signal === "oppose") {
    tally[signal] = (tally[signal] ?? 0) + 1;
  } else if (pollTally[signal] !== undefined) {
    pollTally[signal] = (pollTally[signal] ?? 0) + 1;
  }

  await issueStore.setSignal(issueId, actor.userId, signal);
  await issueStore.updateIssue(issueId, {
    signal_tally: tally,
    poll_tally: pollTally,
  });

  await emitEvent({
    event_type: "civic.issue_signaled",
    actor: actor.userId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      issue_id: issueId,
      signal,
    },
  });

  return { signal, issue_id: issueId };
}

export async function closeIssue(
  slug: string,
  issueId: string,
  actor: Actor,
): Promise<CitizenIssue> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  if (!canActor(actor, "close_issue", { type: "space", slug })) {
    throw new Error("Not authorized to close issues on this space");
  }

  const issue = await issueStore.getIssueById(issueId);
  if (!issue || issue.space_slug !== slug) {
    throw new Error(`Issue "${issueId}" not found on space "${slug}"`);
  }

  const updated = await issueStore.updateIssue(issueId, {
    status: "closed",
    updated_at: new Date().toISOString(),
  });

  if (!updated) {
    throw new Error(`Failed to close issue "${issueId}"`);
  }

  await emitEvent({
    event_type: "civic.issue_closed",
    actor: actor.userId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      issue_id: issueId,
    },
  });

  return updated;
}

export async function respondToIssue(
  slug: string,
  issueId: string,
  content: string,
  actor: Actor,
): Promise<IssueResponse> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  if (!canActor(actor, "respond_to_issue", { type: "space", slug })) {
    throw new Error("Not authorized to respond on this space");
  }

  const issue = await issueStore.getIssueById(issueId);
  if (!issue || issue.space_slug !== slug) {
    throw new Error(`Issue "${issueId}" not found on space "${slug}"`);
  }

  if (!content || content.trim().length === 0) {
    throw new Error("Response content is required");
  }

  const response: IssueResponse = {
    id: generateId("rsp"),
    issue_id: issueId,
    author_did: actor.userId,
    in_response_to_type: "issue_board_entry",
    content: content.trim(),
    timestamp: new Date().toISOString(),
    version: 1,
    prior_version_id: null,
  };

  await issueStore.addIssueResponse(response);
  await issueStore.updateIssue(issueId, {
    status: "responded",
    latest_response: response,
    updated_at: new Date().toISOString(),
  });

  await emitEvent({
    event_type: "civic.issue_responded",
    actor: actor.userId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      issue_id: issueId,
      response_id: response.id,
    },
  });

  return response;
}

export async function editIssueResponse(
  slug: string,
  issueId: string,
  content: string,
  actor: Actor,
): Promise<IssueResponse> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  if (!canActor(actor, "respond_to_issue", { type: "space", slug })) {
    throw new Error("Not authorized to respond on this space");
  }

  const issue = await issueStore.getIssueById(issueId);
  if (!issue || issue.space_slug !== slug) {
    throw new Error(`Issue "${issueId}" not found on space "${slug}"`);
  }

  const prev = await issueStore.getLatestIssueResponse(issueId);
  if (!prev) {
    throw new Error("No existing response to edit");
  }

  if (!content || content.trim().length === 0) {
    throw new Error("Response content is required");
  }

  const response: IssueResponse = {
    id: generateId("rsp"),
    issue_id: issueId,
    author_did: actor.userId,
    in_response_to_type: "issue_board_entry",
    content: content.trim(),
    timestamp: new Date().toISOString(),
    version: prev.version + 1,
    prior_version_id: prev.id,
  };

  await issueStore.addIssueResponse(response);
  await issueStore.updateIssue(issueId, {
    latest_response: response,
    updated_at: new Date().toISOString(),
  });

  return response;
}

export async function hideIssue(
  slug: string,
  issueId: string,
  reason: string,
  adminUserId: string,
): Promise<CitizenIssue> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const issue = await issueStore.getIssueById(issueId);
  if (!issue || issue.space_slug !== slug) {
    throw new Error(`Issue "${issueId}" not found on space "${slug}"`);
  }

  if (!reason || reason.trim().length === 0) {
    throw new Error("Moderation reason is required");
  }

  const updated = await issueStore.updateIssue(issueId, {
    moderation: {
      hidden: true,
      reason: reason.trim(),
      hidden_by: adminUserId,
      hidden_at: new Date().toISOString(),
    },
  });

  if (!updated) {
    throw new Error(`Failed to hide issue "${issueId}"`);
  }

  await emitEvent({
    event_type: "civic.content.hidden",
    actor: adminUserId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      content_type: "issue",
      content_id: issueId,
      reason: reason.trim(),
    },
    visibility: "restricted",
  });

  return updated;
}

export async function restoreIssue(
  slug: string,
  issueId: string,
  adminUserId: string,
): Promise<CitizenIssue> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const issue = await issueStore.getIssueById(issueId);
  if (!issue || issue.space_slug !== slug) {
    throw new Error(`Issue "${issueId}" not found on space "${slug}"`);
  }

  const updated = await issueStore.updateIssue(issueId, {
    moderation: {
      ...issue.moderation,
      hidden: false,
      restored_at: new Date().toISOString(),
    },
  });

  if (!updated) {
    throw new Error(`Failed to restore issue "${issueId}"`);
  }

  await emitEvent({
    event_type: "civic.content.restored",
    actor: adminUserId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      content_type: "issue",
      content_id: issueId,
    },
    visibility: "restricted",
  });

  return updated;
}
