import { useEffect, useState, useCallback } from "react";
import { getOutcomes, type OutcomeDelivery } from "../services/api.ts";
import OutcomeCard from "./OutcomeCard.tsx";
import "./OutcomeDeliveries.css";

interface Props {
  slug: string;
  isVerified: boolean;
  entityDid: string | null;
}

export default function OutcomeDeliveries({
  slug,
  isVerified,
  entityDid,
}: Props) {
  const [outcomes, setOutcomes] = useState<OutcomeDelivery[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    getOutcomes(slug)
      .then(setOutcomes)
      .catch(() => setOutcomes([]))
      .finally(() => setLoading(false));
  }, [slug]);

  useEffect(load, [load]);

  const canRespond =
    isVerified &&
    !!entityDid &&
    typeof window !== "undefined" &&
    localStorage.getItem("rs_auth_token") === entityDid;

  if (loading) {
    return (
      <section className="outcome-deliveries">
        <h3 className="section-heading">Civic Outcome Deliveries</h3>
        <p className="section-status">Loading...</p>
      </section>
    );
  }

  return (
    <section className="outcome-deliveries">
      <h3 className="section-heading">Civic Outcome Deliveries</h3>
      {outcomes.length === 0 ? (
        <p className="section-empty">
          No outcomes delivered yet. Outcomes from Civic Hub processes addressed
          to this space will appear here.
        </p>
      ) : (
        <div className="outcome-list">
          {outcomes.map((o) => (
            <OutcomeCard
              key={o.id}
              outcome={o}
              slug={slug}
              canRespond={canRespond}
              onUpdate={load}
            />
          ))}
        </div>
      )}
    </section>
  );
}
