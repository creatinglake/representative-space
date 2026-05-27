import { useState } from "react";
import type { CitizenIssue } from "../services/api.ts";
import {
  signalIssue,
  postIssueResponse,
  editIssueResponse,
  closeIssue,
} from "../services/api.ts";
import ResponseComposer from "./ResponseComposer.tsx";
import "./IssueBoardCard.css";

interface Props {
  issue: CitizenIssue;
  slug: string;
  canRespond: boolean;
  isAuthenticated: boolean;
  onUpdate: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function pseudonym(actorId: string): string {
  const hash = actorId.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const adjectives = [
    "Civic",
    "Active",
    "Engaged",
    "Local",
    "Concerned",
    "Informed",
    "Thoughtful",
    "Community",
  ];
  const nouns = [
    "Citizen",
    "Resident",
    "Neighbor",
    "Voter",
    "Member",
    "Advocate",
    "Observer",
    "Participant",
  ];
  return `${adjectives[hash % adjectives.length]} ${nouns[(hash * 7) % nouns.length]}`;
}

const TYPE_LABELS: Record<string, { label: string; className: string }> = {
  issue: { label: "Issue", className: "issue-type-badge--issue" },
  question: { label: "Question", className: "issue-type-badge--question" },
  poll: { label: "Poll", className: "issue-type-badge--poll" },
};

const STATUS_LABELS: Record<string, { label: string; className: string }> = {
  open: { label: "Open", className: "issue-status-badge--open" },
  responded: {
    label: "Responded",
    className: "issue-status-badge--responded",
  },
  closed: { label: "Closed", className: "issue-status-badge--closed" },
};

export default function IssueBoardCard({
  issue,
  slug,
  canRespond,
  isAuthenticated,
  onUpdate,
}: Props) {
  const [responding, setResponding] = useState(false);
  const [editingResponse, setEditingResponse] = useState(false);
  const [signalingError, setSignalingError] = useState("");

  const typeInfo = TYPE_LABELS[issue.entry_type] ?? TYPE_LABELS.issue;
  const statusInfo = STATUS_LABELS[issue.status] ?? STATUS_LABELS.open;
  const isClosed = issue.status === "closed";

  async function handleSignal(signal: string) {
    setSignalingError("");
    try {
      await signalIssue(slug, issue.id, signal);
      onUpdate();
    } catch (err) {
      setSignalingError(
        err instanceof Error ? err.message : "Failed to signal",
      );
    }
  }

  async function handleClose() {
    try {
      await closeIssue(slug, issue.id);
      onUpdate();
    } catch {
      // ignore
    }
  }

  async function handlePostResponse(content: string) {
    await postIssueResponse(slug, issue.id, content);
    setResponding(false);
    onUpdate();
  }

  async function handleEditResponse(content: string) {
    await editIssueResponse(slug, issue.id, content);
    setEditingResponse(false);
    onUpdate();
  }

  const totalSignals =
    issue.entry_type === "poll"
      ? Object.values(issue.poll_tally ?? {}).reduce((a, b) => a + b, 0)
      : (issue.signal_tally?.support ?? 0) + (issue.signal_tally?.oppose ?? 0);

  return (
    <div className={`issue-card ${isClosed ? "issue-card--closed" : ""}`}>
      <div className="issue-card-header">
        <div className="issue-card-badges">
          <span className={`issue-type-badge ${typeInfo.className}`}>
            {typeInfo.label}
          </span>
          <span className={`issue-status-badge ${statusInfo.className}`}>
            {statusInfo.label}
          </span>
        </div>
        <span className="issue-card-date">{formatDate(issue.created_at)}</span>
      </div>

      <h4 className="issue-card-title">{issue.title}</h4>
      <p className="issue-card-body">{issue.body}</p>

      {(issue as any).evidence_links?.length > 0 && (
        <div className="issue-evidence-links">
          {((issue as any).evidence_links as string[]).map((link: string, i: number) => (
            <span key={i} className="issue-evidence-pill">
              {link}
            </span>
          ))}
        </div>
      )}

      <div className="issue-card-meta">
        <span className="issue-jurisdiction-tag">
          {issue.jurisdiction_tag}
        </span>
        <span className="issue-author">
          {pseudonym(issue.author_id)}
        </span>
        {issue.version > 1 && (
          <span className="issue-version">edited v{issue.version}</span>
        )}
      </div>

      {/* Signal section for issues/questions */}
      {issue.entry_type !== "poll" && (
        <div className="issue-signals">
          <div className="issue-signal-counts">
            <span className="issue-signal-support">
              +{issue.signal_tally?.support ?? 0}
            </span>
            <span className="issue-signal-oppose">
              -{issue.signal_tally?.oppose ?? 0}
            </span>
            <span className="issue-signal-total">{totalSignals} signals</span>
          </div>
          {isAuthenticated && !isClosed && (
            <div className="issue-signal-buttons">
              <button
                className="issue-signal-btn issue-signal-btn--support"
                onClick={() => handleSignal("support")}
              >
                Support
              </button>
              <button
                className="issue-signal-btn issue-signal-btn--oppose"
                onClick={() => handleSignal("oppose")}
              >
                Oppose
              </button>
            </div>
          )}
          {signalingError && (
            <span className="issue-signal-error">{signalingError}</span>
          )}
        </div>
      )}

      {/* Poll options */}
      {issue.entry_type === "poll" && issue.poll_options && (
        <div className="issue-poll-options">
          {issue.poll_options.map((opt) => {
            const count = issue.poll_tally?.[opt.id] ?? 0;
            const pct = totalSignals > 0 ? (count / totalSignals) * 100 : 0;
            return (
              <div key={opt.id} className="issue-poll-option">
                <div className="issue-poll-option-header">
                  <span className="issue-poll-option-label">{opt.label}</span>
                  <span className="issue-poll-option-count">
                    {count} vote{count !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="issue-poll-bar-bg">
                  <div
                    className="issue-poll-bar-fill"
                    style={{ width: `${pct}%` }}
                  />
                </div>
                {isAuthenticated && !isClosed && (
                  <button
                    className="issue-poll-vote-btn"
                    onClick={() => handleSignal(opt.id)}
                  >
                    Vote
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Entity response */}
      {issue.latest_response ? (
        <div className="issue-response">
          <div className="issue-response-header">
            <span className="issue-response-label">Entity Response</span>
            {issue.latest_response.version > 1 && (
              <span className="issue-response-version">
                v{issue.latest_response.version}
              </span>
            )}
          </div>
          <p className="issue-response-content">
            {issue.latest_response.content}
          </p>
          {canRespond && !isClosed && !editingResponse && (
            <button
              className="issue-action-btn"
              onClick={() => setEditingResponse(true)}
            >
              Edit Response
            </button>
          )}
          {editingResponse && (
            <ResponseComposer
              initialContent={issue.latest_response.content}
              onSubmit={handleEditResponse}
              onCancel={() => setEditingResponse(false)}
              isEditing
            />
          )}
        </div>
      ) : (
        <div className="issue-response issue-response--empty">
          <span className="issue-response-placeholder">No response yet</span>
          {canRespond && !isClosed && !responding && (
            <button
              className="issue-action-btn"
              onClick={() => setResponding(true)}
            >
              Respond
            </button>
          )}
          {responding && (
            <ResponseComposer
              onSubmit={handlePostResponse}
              onCancel={() => setResponding(false)}
            />
          )}
        </div>
      )}

      {/* Entity close button */}
      {canRespond && !isClosed && (
        <div className="issue-card-entity-actions">
          <button className="issue-close-btn" onClick={handleClose}>
            Close Issue
          </button>
        </div>
      )}
    </div>
  );
}
