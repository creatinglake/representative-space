import { useState, useEffect } from "react";
import {
  createProcess,
  getOutcomes,
  type OutcomeDelivery,
} from "../../services/api.ts";
import "./HostDeliberationForm.css";

interface Props {
  slug: string;
  onCreated: () => void;
  onCancel: () => void;
}

export default function HostDeliberationForm({ slug, onCreated, onCancel }: Props) {
  const [topic, setTopic] = useState("");
  const [framing, setFraming] = useState("");
  const [deadline, setDeadline] = useState("");
  const [threshold, setThreshold] = useState("");
  const [seedStatements, setSeedStatements] = useState("");
  const [continueFrom, setContinueFrom] = useState("");
  const [outcomes, setOutcomes] = useState<OutcomeDelivery[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    getOutcomes(slug)
      .then(setOutcomes)
      .catch(() => {});
  }, [slug]);

  const respondedOutcomes = outcomes.filter((o) => o.latest_response);

  function handleContinueFromChange(responseId: string) {
    setContinueFrom(responseId);
    if (responseId) {
      const outcome = outcomes.find((o) => o.latest_response?.id === responseId);
      if (outcome?.latest_response) {
        setFraming(outcome.latest_response.content);
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || !framing.trim()) return;

    setSubmitting(true);
    setError(null);

    try {
      const seeds = seedStatements
        .split("\n")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      await createProcess(slug, {
        definition: { type: "civic.polis_deliberation" },
        title: topic.trim(),
        description: framing.trim(),
        state: {
          topic: topic.trim(),
          framing: framing.trim(),
          ...(deadline ? { deadline: new Date(deadline).toISOString() } : {}),
          ...(threshold ? { participation_threshold: parseInt(threshold, 10) } : {}),
          ...(seeds.length > 0 ? { seed_statements: seeds } : {}),
          ...(continueFrom ? { continued_from_response_id: continueFrom } : {}),
        },
      });
      onCreated();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form className="host-deliberation-form" onSubmit={handleSubmit}>
      <h3 className="host-deliberation-title">Host a Deliberation</h3>

      <label className="form-field">
        <span className="form-label">Topic</span>
        <input
          type="text"
          className="form-input"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder="What should constituents weigh in on?"
          required
        />
      </label>

      {respondedOutcomes.length > 0 && (
        <label className="form-field">
          <span className="form-label">Continue from prior response (optional)</span>
          <select
            className="form-input"
            value={continueFrom}
            onChange={(e) => handleContinueFromChange(e.target.value)}
          >
            <option value="">Start fresh</option>
            {respondedOutcomes.map((o) => (
              <option key={o.latest_response!.id} value={o.latest_response!.id}>
                {o.outcome_summary.slice(0, 80)}...
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="form-field">
        <span className="form-label">Framing</span>
        <textarea
          className="form-input form-textarea"
          value={framing}
          onChange={(e) => setFraming(e.target.value)}
          placeholder="Provide context for participants..."
          rows={4}
          required
        />
      </label>

      <div className="form-row">
        <label className="form-field">
          <span className="form-label">Deadline (optional)</span>
          <input
            type="datetime-local"
            className="form-input"
            value={deadline}
            onChange={(e) => setDeadline(e.target.value)}
          />
        </label>

        <label className="form-field">
          <span className="form-label">Participant goal (optional)</span>
          <input
            type="number"
            className="form-input"
            value={threshold}
            onChange={(e) => setThreshold(e.target.value)}
            placeholder="e.g. 50"
            min="1"
          />
        </label>
      </div>

      <label className="form-field">
        <span className="form-label">Seed statements (one per line, optional)</span>
        <textarea
          className="form-input form-textarea"
          value={seedStatements}
          onChange={(e) => setSeedStatements(e.target.value)}
          placeholder="Statements to start the conversation..."
          rows={3}
        />
      </label>

      {error && <p className="form-error">{error}</p>}

      <div className="form-actions">
        <button type="button" className="form-cancel-btn" onClick={onCancel}>
          Cancel
        </button>
        <button
          type="submit"
          className="form-submit-btn"
          disabled={!topic.trim() || !framing.trim() || submitting}
        >
          {submitting ? "Creating..." : "Create Deliberation"}
        </button>
      </div>
    </form>
  );
}
