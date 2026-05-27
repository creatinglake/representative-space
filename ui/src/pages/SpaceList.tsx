import { useEffect, useState, useCallback } from "react";
import { listSpaces, type RepresentativeSpace } from "../services/api.ts";
import SpaceCard from "../components/SpaceCard.tsx";
import "./SpaceList.css";

const API_BASE = import.meta.env.DEV ? "http://localhost:3001" : "/api";

export default function SpaceList() {
  const [spaces, setSpaces] = useState<RepresentativeSpace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [seeding, setSeeding] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    listSpaces()
      .then(setSpaces)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function handleSeed() {
    setSeeding(true);
    try {
      await fetch(`${API_BASE}/debug/seed`);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Seed failed");
    } finally {
      setSeeding(false);
    }
  }

  if (loading) return <p className="space-list-status">Loading...</p>;
  if (error) return <p className="space-list-status space-list-error">{error}</p>;

  return (
    <div className="space-list">
      <div className="space-list-header">
        <h2 className="space-list-heading">Representative Spaces</h2>
        {import.meta.env.DEV && (
          <button
            className="seed-btn"
            onClick={handleSeed}
            disabled={seeding}
          >
            {seeding ? "Seeding..." : "Seed Demo Data"}
          </button>
        )}
      </div>
      <p className="space-list-count">
        {spaces.length} {spaces.length === 1 ? "space" : "spaces"}
      </p>
      {spaces.length === 0 ? (
        <p className="space-list-empty">
          No spaces created yet. An admin can create one, or use "Seed Demo
          Data" to populate sample spaces.
        </p>
      ) : (
        <div className="space-list-grid">
          {spaces.map((s) => (
            <SpaceCard key={s.id} space={s} />
          ))}
        </div>
      )}
    </div>
  );
}
