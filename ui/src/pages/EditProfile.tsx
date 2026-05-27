import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  getSpace,
  updateSpace,
  setToken,
  type RepresentativeSpace,
} from "../services/api.ts";
import "./EditProfile.css";

export default function EditProfile() {
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [space, setSpace] = useState<RepresentativeSpace | null>(null);
  const [loading, setLoading] = useState(true);

  const [entityId, setEntityId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [heroImageUrl, setHeroImageUrl] = useState("");
  const [profileImageUrl, setProfileImageUrl] = useState("");
  const [bio, setBio] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [officeAddr, setOfficeAddr] = useState("");
  const [sites, setSites] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!slug) return;
    getSpace(slug)
      .then((s) => {
        setSpace(s);
        setDisplayName(s.profile.display_name);
        setHeroImageUrl(s.profile.hero_image_url ?? "");
        setProfileImageUrl(s.profile.profile_image_url ?? "");
        setBio(s.profile.public_bio);
        setEmail(s.profile.contact_channels.email ?? "");
        setPhone(s.profile.contact_channels.phone ?? "");
        setOfficeAddr(s.profile.contact_channels.office_address ?? "");
        setSites(s.profile.linked_official_sites.join("\n"));
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slug) return;
    setError(null);
    setSubmitting(true);

    setToken(entityId);

    try {
      await updateSpace(slug, {
        display_name: displayName,
        hero_image_url: heroImageUrl || undefined,
        profile_image_url: profileImageUrl || undefined,
        public_bio: bio,
        contact_channels: {
          email: email || undefined,
          phone: phone || undefined,
          office_address: officeAddr || undefined,
        },
        linked_official_sites: sites
          .split("\n")
          .map((s) => s.trim())
          .filter((s) => s.length > 0),
      });
      navigate(`/space/${slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <p style={{ textAlign: "center", padding: "2rem" }}>Loading...</p>;
  if (!space) return <p style={{ textAlign: "center", padding: "2rem" }}>Space not found</p>;

  return (
    <div className="edit-profile">
      <h2 className="edit-profile-heading">Edit Profile</h2>
      <p className="edit-profile-desc">
        Editing {space.profile.display_name}'s profile. Only entity-controlled
        fields can be changed.
      </p>

      <form className="admin-create-form" onSubmit={handleSubmit}>
        <label className="form-field">
          <span className="form-label">Your Entity ID (for auth)</span>
          <input
            type="text"
            value={entityId}
            onChange={(e) => setEntityId(e.target.value)}
            required
            placeholder="your-entity-did"
          />
          <span className="form-hint">Must match the verified entity_did on this space</span>
        </label>

        <label className="form-field">
          <span className="form-label">Display Name</span>
          <input
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            required
          />
        </label>

        <label className="form-field">
          <span className="form-label">Hero Image URL</span>
          <input
            type="url"
            value={heroImageUrl}
            onChange={(e) => setHeroImageUrl(e.target.value)}
            placeholder="https://example.com/banner.jpg"
          />
          <span className="form-hint">Banner image at the top of your profile (1200x400 recommended)</span>
        </label>

        <label className="form-field">
          <span className="form-label">Profile Image URL</span>
          <input
            type="url"
            value={profileImageUrl}
            onChange={(e) => setProfileImageUrl(e.target.value)}
            placeholder="https://example.com/headshot.jpg"
          />
          <span className="form-hint">Square headshot (300x300 recommended)</span>
        </label>

        <label className="form-field">
          <span className="form-label">Public Bio</span>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            rows={4}
          />
        </label>

        <fieldset className="form-fieldset">
          <legend>Contact Info</legend>
          <label className="form-field">
            <span className="form-label">Email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-label">Phone</span>
            <input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </label>
          <label className="form-field">
            <span className="form-label">Office Address</span>
            <input type="text" value={officeAddr} onChange={(e) => setOfficeAddr(e.target.value)} />
          </label>
        </fieldset>

        <label className="form-field">
          <span className="form-label">Official Sites (one per line)</span>
          <textarea
            value={sites}
            onChange={(e) => setSites(e.target.value)}
            rows={3}
            placeholder="https://example.com"
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" className="form-submit" disabled={submitting}>
          {submitting ? "Saving..." : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
