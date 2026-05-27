import { useEffect, useState, useCallback } from "react";
import { getIssues, type CitizenIssue } from "../services/api.ts";
import IssueBoardCard from "./IssueBoardCard.tsx";
import IssueBoardComposer from "./IssueBoardComposer.tsx";
import "./IssueBoard.css";

interface Props {
  slug: string;
  isVerified: boolean;
  entityDid: string | null;
}

type FilterType = "" | "issue" | "question" | "poll";
type FilterStatus = "" | "responded" | "awaiting";

export default function IssueBoard({ slug, isVerified, entityDid }: Props) {
  const [issues, setIssues] = useState<CitizenIssue[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("");
  const [filterStatus, setFilterStatus] = useState<FilterStatus>("");

  const load = useCallback(() => {
    const filters: { entry_type?: string; response_status?: string } = {};
    if (filterType) filters.entry_type = filterType;
    if (filterStatus) filters.response_status = filterStatus;
    getIssues(slug, filters)
      .then(setIssues)
      .catch(() => setIssues([]))
      .finally(() => setLoading(false));
  }, [slug, filterType, filterStatus]);

  useEffect(load, [load]);

  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("rs_auth_token")
      : null;
  const isAuthenticated = !!token;
  const canRespond =
    isVerified && !!entityDid && token === entityDid;

  if (loading) {
    return (
      <section className="issue-board">
        <h3 className="section-heading">Citizen Issue Board</h3>
        <p className="section-status">Loading...</p>
      </section>
    );
  }

  return (
    <section className="issue-board">
      <div className="issue-board-header">
        <h3 className="section-heading">Citizen Issue Board</h3>
        {isAuthenticated && !composing && (
          <button
            className="issue-raise-btn"
            onClick={() => setComposing(true)}
          >
            Raise an Issue
          </button>
        )}
      </div>

      <div className="issue-board-filters">
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value as FilterType)}
          className="issue-filter-select"
        >
          <option value="">All Types</option>
          <option value="issue">Issues</option>
          <option value="question">Questions</option>
          <option value="poll">Polls</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => setFilterStatus(e.target.value as FilterStatus)}
          className="issue-filter-select"
        >
          <option value="">All Status</option>
          <option value="responded">Responded</option>
          <option value="awaiting">Awaiting Response</option>
        </select>
      </div>

      {composing && (
        <IssueBoardComposer
          slug={slug}
          onDone={() => {
            setComposing(false);
            load();
          }}
          onCancel={() => setComposing(false)}
        />
      )}

      {issues.length === 0 ? (
        <p className="section-empty">
          No issues yet. Citizens can raise issues, questions, and polls here.
        </p>
      ) : (
        <div className="issue-list">
          {issues.map((issue) => (
            <IssueBoardCard
              key={issue.id}
              issue={issue}
              slug={slug}
              canRespond={canRespond}
              isAuthenticated={isAuthenticated}
              onUpdate={load}
            />
          ))}
        </div>
      )}
    </section>
  );
}
