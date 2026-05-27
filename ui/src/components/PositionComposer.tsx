import { useState } from "react";
import { postPosition, editPosition } from "../services/api.ts";
import "./PositionComposer.css";

interface Props {
  slug: string;
  topic?: string;
  initialStatement?: string;
  initialLinkedOutcomes?: string[];
  positionId?: string;
  onDone: () => void;
  onCancel: () => void;
}

export default function PositionComposer({
  slug,
  topic: existingTopic,
  initialStatement = "",
  initialLinkedOutcomes = [],
  positionId,
  onDone,
  onCancel,
}: Props) {
  const isEditing = !!positionId;
  const [topic, setTopic] = useState(existingTopic ?? "");
  const [statement, setStatement] = useState(initialStatement);
  const [linkedOutcomes, setLinkedOutcomes] = useState(
    initialLinkedOutcomes.join(", "),
  );
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || !statement.trim()) return;
    setSubmitting(true);
    try {
      const outcomes = linkedOutcomes
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      if (isEditing) {
        await editPosition(
          slug,
          positionId!,
          statement.trim(),
          outcomes.length > 0 ? outcomes : undefined,
        );
      } else {
        await postPosition(
          slug,
          topic.trim(),
          statement.trim(),
          outcomes.length > 0 ? outcomes : undefined,
        );
      }
      onDone();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="position-composer" onSubmit={handleSubmit}>
      <label>
        Topic
        <input
          type="text"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="e.g. Infrastructure Spending"
          readOnly={isEditing}
          required
        />
      </label>
      <label>
        Statement
        <textarea
          value={statement}
          onChange={(e) => setStatement(e.target.value)}
          placeholder="Write your position statement..."
          rows={4}
          required
        />
      </label>
      <label>
        Linked Outcomes (optional, comma-separated IDs)
        <input
          type="text"
          value={linkedOutcomes}
          onChange={(e) => setLinkedOutcomes(e.target.value)}
          placeholder="out_abc123, out_def456"
        />
      </label>
      <div className="position-composer-actions">
        <button
          type="submit"
          disabled={submitting || !topic.trim() || !statement.trim()}
        >
          {submitting
            ? "Saving..."
            : isEditing
              ? "Update Position"
              : "Post Position"}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
