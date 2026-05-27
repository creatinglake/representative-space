import type { CitizenIssue, IssueResponse } from "../models/issue.js";

const issues = new Map<string, CitizenIssue>();

// Signals: composite key "issueId:userId" → signal value
const signals = new Map<string, string>();

// Issue responses
const issueResponses = new Map<string, IssueResponse>();

export function addIssue(issue: CitizenIssue): void {
  issues.set(issue.id, issue);
}

export function getIssueById(id: string): CitizenIssue | undefined {
  return issues.get(id);
}

export function getIssuesBySlug(slug: string): CitizenIssue[] {
  return Array.from(issues.values()).filter((i) => i.space_slug === slug);
}

export function updateIssue(
  id: string,
  patch: Partial<CitizenIssue>,
): CitizenIssue | undefined {
  const existing = issues.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  issues.set(id, updated);
  return updated;
}

export function getSignal(issueId: string, userId: string): string | undefined {
  return signals.get(`${issueId}:${userId}`);
}

export function setSignal(issueId: string, userId: string, signal: string): void {
  signals.set(`${issueId}:${userId}`, signal);
}

export function addIssueResponse(response: IssueResponse): void {
  issueResponses.set(response.id, response);
}

export function getIssueResponseById(id: string): IssueResponse | undefined {
  return issueResponses.get(id);
}

export function getLatestIssueResponse(issueId: string): IssueResponse | undefined {
  const matching = Array.from(issueResponses.values())
    .filter((r) => r.issue_id === issueId)
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  return matching[0];
}

export function clearIssues(): void {
  issues.clear();
  issueResponses.clear();
}

export function clearSignals(): void {
  signals.clear();
}
