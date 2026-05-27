import type { RepresentativeSpace } from "../services/api.ts";
import ContactInfo from "./ContactInfo.tsx";
import "./IdentityCard.css";

interface Props {
  space: RepresentativeSpace;
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export default function IdentityCard({ space }: Props) {
  const isVerified = space.verification_status === "verified";
  const isCandidate = space.sub_type === "candidate";
  const heroUrl = space.profile.hero_image_url;
  const avatarUrl = space.profile.profile_image_url;

  return (
    <div className="identity-card">
      <div
        className="identity-hero"
        style={heroUrl ? { backgroundImage: `url(${heroUrl})` } : undefined}
      />

      <div className="identity-card-body">
        <div className="identity-avatar-row">
          {avatarUrl ? (
            <img
              className="identity-avatar"
              src={avatarUrl}
              alt={space.profile.display_name}
            />
          ) : (
            <div className="identity-avatar-placeholder">
              {getInitials(space.profile.display_name)}
            </div>
          )}
          <div className="identity-avatar-badges">
            <span className={`sub-type-pill sub-type-${space.sub_type}`}>
              {isCandidate ? "Candidate" : "Representative"}
            </span>
            {isVerified && (
              <span className="identity-verified-badge">Verified</span>
            )}
          </div>
        </div>

        <div className="identity-card-top">
          <h1 className="identity-card-name">
            {space.profile.display_name}
          </h1>
        </div>

        <p className="identity-card-office">
          {space.office_or_candidacy_label}
        </p>

        <div className="identity-card-meta">
          <span className="identity-card-jurisdiction">
            {space.jurisdiction}
          </span>
          {space.party_affiliation && (
            <span className="identity-card-party">
              {space.party_affiliation}
            </span>
          )}
        </div>

        {!isCandidate && space.term_dates && (
          <p className="identity-card-term">
            In office since{" "}
            {new Date(space.term_dates.start).toLocaleDateString("en-US", {
              month: "long",
              year: "numeric",
            })}
            {space.term_dates.end &&
              ` — term ends ${new Date(space.term_dates.end).toLocaleDateString("en-US", { month: "long", year: "numeric" })}`}
          </p>
        )}

        {isCandidate && space.candidacy_record && (
          <div className="identity-card-candidacy">
            {space.candidacy_record.election_type && (
              <span>
                {space.candidacy_record.election_type.charAt(0).toUpperCase() +
                  space.candidacy_record.election_type.slice(1)}{" "}
                election
              </span>
            )}
            {space.candidacy_record.election_date && (
              <span>
                {new Date(
                  space.candidacy_record.election_date,
                ).toLocaleDateString("en-US", {
                  month: "long",
                  day: "numeric",
                  year: "numeric",
                })}
              </span>
            )}
          </div>
        )}

        {space.profile.public_bio && (
          <p className="identity-card-bio">{space.profile.public_bio}</p>
        )}

        <ContactInfo channels={space.profile.contact_channels} />
      </div>
    </div>
  );
}
