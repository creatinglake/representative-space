import { useState, useEffect, useCallback } from "react";
import type { ProcessSummary, ProcessReadModel } from "../../services/api.ts";
import { getProcesses, getProcess } from "../../services/api.ts";
import DeliberationPanel from "./DeliberationPanel.tsx";
import CompletedDeliberation from "./CompletedDeliberation.tsx";
import HostDeliberationForm from "./HostDeliberationForm.tsx";
import "./Deliberations.css";

interface Props {
  slug: string;
  isOwner: boolean;
}

export default function Deliberations({ slug, isOwner }: Props) {
  const [processes, setProcesses] = useState<ProcessSummary[]>([]);
  const [completedDetails, setCompletedDetails] = useState<Map<string, ProcessReadModel>>(new Map());
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const { processes: procs } = await getProcesses(slug);
      setProcesses(procs);

      const completed = procs.filter(
        (p) => p.lifecycle === "closed" || p.lifecycle === "finalized",
      );
      const details = new Map<string, ProcessReadModel>();
      for (const p of completed) {
        try {
          const detail = await getProcess(slug, p.process_id);
          details.set(p.process_id, detail);
        } catch {
          // skip
        }
      }
      setCompletedDetails(details);
    } catch {
      // no processes yet
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const active = processes.filter((p) => p.lifecycle === "active");
  const completed = processes.filter(
    (p) => p.lifecycle === "closed" || p.lifecycle === "finalized",
  );
  const draft = processes.filter((p) => p.lifecycle === "draft");

  function handleCreated() {
    setShowForm(false);
    load();
  }

  if (loading) {
    return (
      <section className="deliberations-section">
        <h2 className="section-title">Deliberations</h2>
        <p className="deliberations-loading">Loading...</p>
      </section>
    );
  }

  return (
    <section className="deliberations-section">
      <div className="deliberations-header">
        <h2 className="section-title">Deliberations</h2>
        {isOwner && !showForm && (
          <button
            className="host-deliberation-btn"
            onClick={() => setShowForm(true)}
          >
            Host a Deliberation
          </button>
        )}
      </div>

      {showForm && (
        <HostDeliberationForm
          slug={slug}
          onCreated={handleCreated}
          onCancel={() => setShowForm(false)}
        />
      )}

      {draft.length > 0 && isOwner && (
        <div className="deliberations-group">
          <h3 className="deliberations-group-title">Draft</h3>
          {draft.map((p) => (
            <div key={p.process_id} className="deliberation-draft-card">
              <span className="draft-topic">{p.topic}</span>
              <span className="draft-badge">Draft — needs start action</span>
            </div>
          ))}
        </div>
      )}

      {active.length > 0 && (
        <div className="deliberations-group">
          <h3 className="deliberations-group-title">Active</h3>
          {active.map((p) => (
            <DeliberationPanel
              key={p.process_id}
              slug={slug}
              processId={p.process_id}
            />
          ))}
        </div>
      )}

      {completed.length > 0 && (
        <div className="deliberations-group">
          <h3 className="deliberations-group-title">Completed</h3>
          {completed.map((p) => {
            const detail = completedDetails.get(p.process_id);
            return detail ? (
              <CompletedDeliberation key={p.process_id} process={detail} />
            ) : null;
          })}
        </div>
      )}

      {processes.length === 0 && !showForm && (
        <p className="deliberations-empty">
          No deliberations yet.
          {isOwner
            ? " Host one to gather constituent perspectives."
            : ""}
        </p>
      )}
    </section>
  );
}
