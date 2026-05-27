import { useEffect, useState, useCallback } from "react";
import { getPositions, type Position } from "../services/api.ts";
import PositionCard from "./PositionCard.tsx";
import PositionComposer from "./PositionComposer.tsx";
import "./PositionStatements.css";

interface Props {
  slug: string;
  isVerified: boolean;
  entityDid: string | null;
}

export default function PositionStatements({
  slug,
  isVerified,
  entityDid,
}: Props) {
  const [positions, setPositions] = useState<Position[]>([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);

  const load = useCallback(() => {
    getPositions(slug)
      .then(setPositions)
      .catch(() => setPositions([]))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(load, [load]);

  const canEdit =
    isVerified &&
    !!entityDid &&
    typeof window !== "undefined" &&
    localStorage.getItem("rs_auth_token") === entityDid;

  if (loading) {
    return (
      <section className="position-statements">
        <h3 className="section-heading">Position Statements</h3>
        <p className="section-status">Loading...</p>
      </section>
    );
  }

  return (
    <section className="position-statements">
      <div className="position-header">
        <h3 className="section-heading">Position Statements</h3>
        {canEdit && !composing && (
          <button
            className="position-add-btn"
            onClick={() => setComposing(true)}
          >
            New Position
          </button>
        )}
      </div>

      {composing && (
        <PositionComposer
          slug={slug}
          onDone={() => {
            setComposing(false);
            load();
          }}
          onCancel={() => setComposing(false)}
        />
      )}

      {positions.length === 0 ? (
        <p className="section-empty">
          No position statements yet. The entity can post positions on civic
          topics here.
        </p>
      ) : (
        <div className="position-list">
          {positions.map((p) => (
            <PositionCard
              key={p.id}
              position={p}
              slug={slug}
              canEdit={canEdit}
              onUpdate={load}
            />
          ))}
        </div>
      )}
    </section>
  );
}
