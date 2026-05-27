import { Link } from "react-router-dom";
import { useState } from "react";
import { setToken, clearToken } from "../services/api.ts";
import "./Nav.css";

const DEV_PERSONAS = [
  { label: "Not logged in", value: "" },
  { label: "Admin", value: "admin@example.com" },
  { label: "Jane Doe (entity)", value: "did:example:jane" },
  { label: "Bob Smith (entity)", value: "did:example:bob" },
  { label: "Citizen", value: "citizen@example.com" },
];

export default function Nav() {
  const [identity, setIdentity] = useState(() => {
    try {
      return localStorage.getItem("rs_auth_token") ?? "";
    } catch {
      return "";
    }
  });

  function handleChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const val = e.target.value;
    setIdentity(val);
    if (val) {
      setToken(val);
    } else {
      clearToken();
    }
    window.location.reload();
  }

  return (
    <nav className="nav">
      <div className="nav-inner">
        <Link to="/" className="nav-brand">
          Representative Space
        </Link>
        <div className="nav-links">
          <Link to="/admin/create" className="nav-link">
            + Create Space
          </Link>
          {import.meta.env.DEV && (
            <select
              className="dev-identity-select"
              value={identity}
              onChange={handleChange}
            >
              {DEV_PERSONAS.map((p) => (
                <option key={p.value} value={p.value}>
                  {p.label}
                </option>
              ))}
            </select>
          )}
        </div>
      </div>
    </nav>
  );
}
