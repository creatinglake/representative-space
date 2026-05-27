import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getSpace, type RepresentativeSpace } from "../services/api.ts";
import CandidateSpace from "./CandidateSpace.tsx";
import IndividualSpace from "./IndividualSpace.tsx";

export default function SpacePage() {
  const { slug } = useParams<{ slug: string }>();
  const [space, setSpace] = useState<RepresentativeSpace | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    getSpace(slug)
      .then(setSpace)
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) return <p style={{ textAlign: "center", padding: "2rem" }}>Loading...</p>;
  if (error) return <p style={{ textAlign: "center", padding: "2rem", color: "var(--color-error)" }}>{error}</p>;
  if (!space) return <p style={{ textAlign: "center", padding: "2rem" }}>Space not found</p>;

  if (space.sub_type === "candidate") {
    return <CandidateSpace space={space} />;
  }

  return <IndividualSpace space={space} />;
}
