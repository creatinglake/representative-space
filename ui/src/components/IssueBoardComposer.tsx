import { useState } from "react";
import { raiseIssue, type EntryType } from "../services/api.ts";
import "./IssueBoardComposer.css";

interface Props {
  slug: string;
  onDone: () => void;
  onCancel: () => void;
}

export default function IssueBoardComposer({ slug, onDone, onCancel }: Props) {
  const [entryType, setEntryType] = useState<EntryType>("issue");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [jurisdictionTag, setJurisdictionTag] = useState("");
  const [evidenceLinks, setEvidenceLinks] = useState<string[]>([]);
  const [linkInput, setLinkInput] = useState("");
  const [pollOptions, setPollOptions] = useState<string[]>(["", ""]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  function addEvidenceLink() {
    const trimmed = linkInput.trim();
    if (trimmed && !evidenceLinks.includes(trimmed)) {
      setEvidenceLinks([...evidenceLinks, trimmed]);
      setLinkInput("");
    }
  }

  function removeEvidenceLink(index: number) {
    setEvidenceLinks(evidenceLinks.filter((_, i) => i !== index));
  }

  function updatePollOption(index: number, value: string) {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  }

  function addPollOption() {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, ""]);
    }
  }

  function removePollOption(index: number) {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");

    if (!title.trim() || !body.trim() || !jurisdictionTag.trim()) {
      setError("Title, body, and jurisdiction tag are required.");
      return;
    }

    if (entryType === "poll") {
      const validOptions = pollOptions.filter((o) => o.trim().length > 0);
      if (validOptions.length < 2) {
        setError("Polls require at least 2 options.");
        return;
      }
    }

    setSubmitting(true);
    try {
      await raiseIssue(slug, {
        entry_type: entryType,
        title: title.trim(),
        body: body.trim(),
        jurisdiction_tag: jurisdictionTag.trim(),
        poll_options:
          entryType === "poll"
            ? pollOptions.filter((o) => o.trim().length > 0)
            : undefined,
      });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="issue-composer" onSubmit={handleSubmit}>
      <div className="issue-composer-type-selector">
        {(["issue", "question", "poll"] as EntryType[]).map((t) => (
          <button
            key={t}
            type="button"
            className={`issue-composer-type-btn ${entryType === t ? "issue-composer-type-btn--active" : ""}`}
            onClick={() => setEntryType(t)}
          >
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>

      <input
        type="text"
        className="issue-composer-input"
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        required
      />

      <textarea
        className="issue-composer-textarea"
        placeholder="Describe your issue, question, or poll..."
        value={body}
        onChange={(e) => setBody(e.target.value)}
        rows={4}
        required
      />

      <input
        type="text"
        className="issue-composer-input"
        placeholder="Jurisdiction tag (e.g. us-ca-12)"
        value={jurisdictionTag}
        onChange={(e) => setJurisdictionTag(e.target.value)}
        required
      />

      {/* Evidence links */}
      <div className="issue-composer-evidence">
        <div className="issue-composer-link-input">
          <input
            type="text"
            className="issue-composer-input"
            placeholder="Add evidence link (optional)"
            value={linkInput}
            onChange={(e) => setLinkInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                addEvidenceLink();
              }
            }}
          />
          <button
            type="button"
            className="issue-composer-add-btn"
            onClick={addEvidenceLink}
          >
            Add
          </button>
        </div>
        {evidenceLinks.length > 0 && (
          <div className="issue-composer-links-list">
            {evidenceLinks.map((link, i) => (
              <span key={i} className="issue-composer-link-pill">
                {link}
                <button
                  type="button"
                  className="issue-composer-link-remove"
                  onClick={() => removeEvidenceLink(i)}
                >
                  x
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Poll options */}
      {entryType === "poll" && (
        <div className="issue-composer-poll-options">
          <span className="issue-composer-label">Poll Options (2-6)</span>
          {pollOptions.map((opt, i) => (
            <div key={i} className="issue-composer-poll-option-row">
              <input
                type="text"
                className="issue-composer-input"
                placeholder={`Option ${i + 1}`}
                value={opt}
                onChange={(e) => updatePollOption(i, e.target.value)}
              />
              {pollOptions.length > 2 && (
                <button
                  type="button"
                  className="issue-composer-remove-btn"
                  onClick={() => removePollOption(i)}
                >
                  x
                </button>
              )}
            </div>
          ))}
          {pollOptions.length < 6 && (
            <button
              type="button"
              className="issue-composer-add-option-btn"
              onClick={addPollOption}
            >
              + Add Option
            </button>
          )}
        </div>
      )}

      {error && <p className="issue-composer-error">{error}</p>}

      <div className="issue-composer-actions">
        <button type="submit" disabled={submitting}>
          {submitting ? "Submitting..." : "Submit"}
        </button>
        <button type="button" className="cancel-btn" onClick={onCancel}>
          Cancel
        </button>
      </div>
    </form>
  );
}
