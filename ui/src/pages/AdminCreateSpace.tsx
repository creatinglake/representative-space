import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createSpace,
  setToken,
  type SpaceSubType,
  type CreateSpaceInput,
} from "../services/api.ts";
import "./AdminCreateSpace.css";

export default function AdminCreateSpace() {
  const navigate = useNavigate();
  const [adminEmail, setAdminEmail] = useState("");
  const [subType, setSubType] = useState<SpaceSubType>("candidate");
  const [slug, setSlug] = useState("");
  const [jurisdiction, setJurisdiction] = useState("");
  const [officeLabel, setOfficeLabel] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [party, setParty] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [officeAddr, setOfficeAddr] = useState("");
  const [termStart, setTermStart] = useState("");
  const [termEnd, setTermEnd] = useState("");
  const [electionDate, setElectionDate] = useState("");
  const [electionType, setElectionType] = useState("general");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    setToken(adminEmail);

    const input: CreateSpaceInput = {
      sub_type: subType,
      entity_slug: slug,
      jurisdiction,
      office_or_candidacy_label: officeLabel,
      display_name: displayName,
      party_affiliation: party || undefined,
      public_bio: bio || undefined,
      contact_channels: {
        email: email || undefined,
        phone: phone || undefined,
        office_address: officeAddr || undefined,
      },
    };

    if (subType === "individual" && termStart) {
      input.term_dates = {
        start: termStart,
        end: termEnd || undefined,
      };
    }

    if (subType === "candidate" && electionDate) {
      input.candidacy_record = {
        election_date: electionDate,
        election_type: electionType,
        status: "filed",
      };
    }

    try {
      const space = await createSpace(input);
      navigate(`/space/${space.entity_slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create space");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="admin-create">
      <h2 className="admin-create-heading">Create Representative Space</h2>
      <p className="admin-create-desc">Admin-only. Creates a new space for a representative or candidate.</p>

      <form className="admin-create-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span className="form-label">Admin Email (for auth)</span>
          <input type="email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} required placeholder="admin@example.com" />
        </label>

        <label className="form-field">
          <span className="form-label">Sub-type</span>
          <select value={subType} onChange={(e) => setSubType(e.target.value as SpaceSubType)}>
            <option value="candidate">Candidate</option>
            <option value="individual">Individual (Incumbent)</option>
          </select>
        </label>

        <label className="form-field">
          <span className="form-label">URL Slug</span>
          <input type="text" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))} required placeholder="jane-doe" pattern="[a-z0-9][a-z0-9-]{1,62}[a-z0-9]" />
          <span className="form-hint">Lowercase letters, numbers, hyphens. 3-64 characters.</span>
        </label>

        <label className="form-field">
          <span className="form-label">Display Name</span>
          <input type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)} required placeholder="Jane Doe" />
        </label>

        <label className="form-field">
          <span className="form-label">Office / Candidacy Label</span>
          <input type="text" value={officeLabel} onChange={(e) => setOfficeLabel(e.target.value)} required placeholder="U.S. House VA-9 Candidate" />
        </label>

        <label className="form-field">
          <span className="form-label">Jurisdiction</span>
          <input type="text" value={jurisdiction} onChange={(e) => setJurisdiction(e.target.value)} required placeholder="us-va-09" />
        </label>

        <label className="form-field">
          <span className="form-label">Party Affiliation (optional)</span>
          <input type="text" value={party} onChange={(e) => setParty(e.target.value)} placeholder="Independent" />
        </label>

        <label className="form-field">
          <span className="form-label">Public Bio (optional)</span>
          <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} placeholder="Brief bio..." />
        </label>

        <fieldset className="form-fieldset">
          <legend>Contact (optional)</legend>
          <label className="form-field">
            <span className="form-label">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="office@example.com" />
          </label>
          <label className="form-field">
            <span className="form-label">Phone</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="202-555-0100" />
          </label>
          <label className="form-field">
            <span className="form-label">Office Address</span>
            <input type="text" value={officeAddr} onChange={(e) => setOfficeAddr(e.target.value)} placeholder="123 Main St, Suite 100" />
          </label>
        </fieldset>

        {subType === "individual" && (
          <fieldset className="form-fieldset">
            <legend>Term Dates</legend>
            <label className="form-field">
              <span className="form-label">Start</span>
              <input type="date" value={termStart} onChange={(e) => setTermStart(e.target.value)} />
            </label>
            <label className="form-field">
              <span className="form-label">End (optional)</span>
              <input type="date" value={termEnd} onChange={(e) => setTermEnd(e.target.value)} />
            </label>
          </fieldset>
        )}

        {subType === "candidate" && (
          <fieldset className="form-fieldset">
            <legend>Candidacy Details</legend>
            <label className="form-field">
              <span className="form-label">Election Date</span>
              <input type="date" value={electionDate} onChange={(e) => setElectionDate(e.target.value)} />
            </label>
            <label className="form-field">
              <span className="form-label">Election Type</span>
              <select value={electionType} onChange={(e) => setElectionType(e.target.value)}>
                <option value="general">General</option>
                <option value="primary">Primary</option>
                <option value="special">Special</option>
              </select>
            </label>
          </fieldset>
        )}

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="form-submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create Space"}
        </button>
      </form>
    </div>
  );
}
