import { useState } from "react";
import "./ResponseComposer.css";

interface Props {
  initialContent?: string;
  onSubmit: (content: string) => Promise<void>;
  onCancel: () => void;
  isEditing?: boolean;
}

export default function ResponseComposer({
  initialContent = "",
  onSubmit,
  onCancel,
  isEditing = false,
}: Props) {
  const [content, setContent] = useState(initialContent);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!content.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit(content.trim());
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="response-composer" onSubmit={handleSubmit}>
      <textarea
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your response..."
        rows={4}
        required
      />
      <div className="response-composer-actions">
        <button type="submit" disabled={submitting || !content.trim()}>
          {submitting
            ? "Saving..."
            : isEditing
              ? "Update Response"
              : "Post Response"}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
