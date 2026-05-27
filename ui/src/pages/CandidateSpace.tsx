import { Link } from "react-router-dom";
import type { RepresentativeSpace } from "../services/api.ts";
import IdentityCard from "../components/IdentityCard.tsx";
import PositionStatements from "../components/PositionStatements.tsx";
import Deliberations from "../components/deliberation/Deliberations.tsx";
import IssueBoard from "../components/IssueBoard.tsx";
import ResponsivenessLedger from "../components/ResponsivenessLedger.tsx";
import PlaceholderSection from "../components/PlaceholderSection.tsx";
import "./CandidateSpace.css";

interface Props {
  space: RepresentativeSpace;
}

export default function CandidateSpace({ space }: Props) {
  const isVerified = space.verification_status === "verified";
  const token =
    typeof window !== "undefined"
      ? localStorage.getItem("rs_auth_token")
      : null;
  const isOwner = isVerified && !!space.entity_did && token === space.entity_did;

  return (
    <div className="candidate-space">
      <IdentityCard space={space} />

      {isOwner && (
        <div className="space-actions">
          <Link to={`/space/${space.entity_slug}/edit`} className="edit-link">
            Edit Profile
          </Link>
        </div>
      )}

      <Deliberations slug={space.entity_slug} isOwner={isOwner} />

      <PositionStatements
        slug={space.entity_slug}
        isVerified={isVerified}
        entityDid={space.entity_did}
      />

      <IssueBoard
        slug={space.entity_slug}
        isVerified={isVerified}
        entityDid={space.entity_did}
      />

      <PlaceholderSection
        title="Candidacy Timeline"
        description="Filing dates, debates, and election milestones"
      />

      <ResponsivenessLedger slug={space.entity_slug} />
    </div>
  );
}
