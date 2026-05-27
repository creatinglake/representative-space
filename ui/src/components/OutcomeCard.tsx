import { useState } from "react";
import type { OutcomeDelivery } from "../services/api.ts";
import {
  postResponse,
  editResponse,
} from "../services/api.ts";
import ResponseComposer from "./ResponseComposer.tsx";
import "./OutcomeCard.css";

interface Props {
  outcome: OutcomeDelivery;
  slug: string;
  canRespond: boolean;
  onUpdate: () => void;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function OutcomeCard({
  outcome,
  slug,
  canRespond,
  onUpdate,
}: Props) {
  const [composing, setComposing] = useState(false);
  const [editing, setEditing] = useState(false);

  const response = outcome.latest_response;

  async function handlePost(content: string) {
    await postResponse(slug, outcome.id, content);
    setComposing(false);
    onUpdate();
  }

  async function handleEdit(content: string) {
    await editResponse(slug, outcome.id, content);
    setEditing(false);
    onUpdate();
  }

  return (
    <div className="outcome-card">
      <div className="outcome-card-header">
        <span className="outcome-hub-badge">{outcome.originating_hub_id}</span>
        <span className="outcome-date">
          {formatDate(outcome.delivery_timestamp)}
        </span>
      </div>

      <p className="outcome-summary">{outcome.outcome_summary}</p>

      <div className="outcome-stats">
        <span>{outcome.participation_stats.total_participants} participants</span>
        {outcome.participation_stats.participation_rate != null && (
          <span>
            {Math.round(outcome.participation_stats.participation_rate * 100)}%
            participation
          </span>
        )}
      </div>

      {Object.keys(outcome.result).length > 0 && (
        <div className="outcome-result">
          {Object.entries(outcome.result).map(([key, value]) => (
            <span key={key} className="outcome-result-item">
              {key}: {String(value)}
            </span>
          ))}
        </div>
      )}

      <div className="outcome-response-section">
        {response ? (
          <div className="outcome-response">
            <div className="outcome-response-header">
              <strong>Entity Response</strong>
              {response.version > 1 && (
                <span className="response-version">v{response.version}</span>
              )}
              <span className="response-date">
                {formatDate(response.timestamp)}
              </span>
            </div>
            <p className="response-content">{response.content}</p>
            {canRespond && !editing && (
              <button
                className="response-action-btn"
                onClick={() => setEditing(true)}
              >
                Edit Response
              </button>
            )}
            {editing && (
              <ResponseComposer
                initialContent={response.content}
                onSubmit={handleEdit}
                onCancel={() => setEditing(false)}
                isEditing
              />
            )}
          </div>
        ) : (
          <div className="outcome-awaiting">
            <p className="awaiting-text">Awaiting response</p>
            {canRespond && !composing && (
              <button
                className="response-action-btn"
                onClick={() => setComposing(true)}
              >
                Respond
              </button>
            )}
            {composing && (
              <ResponseComposer
                onSubmit={handlePost}
                onCancel={() => setComposing(false)}
              />
            )}
          </div>
        )}
      </div>
    </div>
  );
}
