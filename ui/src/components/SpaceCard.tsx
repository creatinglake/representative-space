import { Link } from "react-router-dom";
import type { RepresentativeSpace } from "../services/api.ts";
import "./SpaceCard.css";

interface Props {
  space: RepresentativeSpace;
}

export default function SpaceCard({ space }: Props) {
  const isVerified = space.verification_status === "verified";

  return (
    <Link to={`/space/${space.entity_slug}`} className="space-card">
      <div className="space-card-header">
        <h3 className="space-card-name">{space.profile.display_name}</h3>
        <span className={`sub-type-pill sub-type-${space.sub_type}`}>
          {space.sub_type === "individual" ? "Representative" : "Candidate"}
        </span>
      </div>
      <p className="space-card-office">{space.office_or_candidacy_label}</p>
      <p className="space-card-meta">
        <span>{space.jurisdiction}</span>
        {space.party_affiliation && (
          <span className="space-card-party">{space.party_affiliation}</span>
        )}
        {isVerified && <span className="verified-badge">Verified</span>}
      </p>
    </Link>
  );
}
