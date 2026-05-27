import { useState } from "react";
import type { Position } from "../services/api.ts";
import { getPositionHistory } from "../services/api.ts";
import PositionComposer from "./PositionComposer.tsx";
import "./PositionCard.css";

interface Props {
  position: Position;
  slug: string;
  canEdit: boolean;
  onUpdate: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PositionCard({
  position,
  slug,
  canEdit,
  onUpdate,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<Position[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  async function toggleHistory() {
    if (showHistory) {
      setShowHistory(false);
      return;
    }
    if (history.length === 0) {
      setLoadingHistory(true);
      try {
        const h = await getPositionHistory(slug, position.id);
        setHistory(h);
      } catch {
        setHistory([]);
      } finally {
        setLoadingHistory(false);
      }
    }
    setShowHistory(true);
  }

  return (
    <div className="position-card">
      <div className="position-card-header">
        <span className="position-topic">{position.topic}</span>
        <div className="position-meta">
          {position.version > 1 && (
            <span className="position-version">v{position.version}</span>
          )}
          <span className="position-date">
            {formatDate(position.timestamp)}
          </span>
        </div>
      </div>

      <p className="position-statement">{position.statement}</p>

      {position.linked_outcomes.length > 0 && (
        <div className="position-linked-outcomes">
          {position.linked_outcomes.map((id) => (
            <span key={id} className="position-outcome-pill">
              {id}
            </span>
          ))}
        </div>
      )}

      <div className="position-actions">
        {canEdit && !editing && (
          <button
            className="position-action-btn"
            onClick={() => setEditing(true)}
          >
            Edit Position
          </button>
        )}
        {position.version > 1 && (
          <button className="position-history-toggle" onClick={toggleHistory}>
            {showHistory ? "Hide History" : "View History"}
          </button>
        )}
      </div>

      {editing && (
        <PositionComposer
          slug={slug}
          initialStatement={position.statement}
          initialLinkedOutcomes={position.linked_outcomes}
          positionId={position.id}
          topic={position.topic}
          onDone={() => {
            setEditing(false);
            onUpdate();
          }}
          onCancel={() => setEditing(false)}
        />
      )}

      {showHistory && (
        <div className="position-history">
          <span className="position-history-label">Version History</span>
          {loadingHistory ? (
            <span className="position-history-item">Loading...</span>
          ) : (
            history.map((h) => (
              <div key={h.id} className="position-history-item">
                <div>{h.statement}</div>
                <div className="position-history-item-meta">
                  v{h.version} — {formatDate(h.timestamp)}
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
