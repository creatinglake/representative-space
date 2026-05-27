import type { CivicEvent } from "../services/api.ts";
import "./LedgerEventCard.css";

interface Props {
  event: CivicEvent;
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

function typePill(eventType: string): { label: string; className: string } {
  switch (eventType) {
    case "civic.outcome_delivered":
      return { label: "Outcome", className: "pill-outcome" };
    case "civic.response_posted":
      return { label: "Response", className: "pill-response" };
    case "civic.position_posted":
      return { label: "Position", className: "pill-position" };
    case "civic.position_updated":
      return { label: "Position Updated", className: "pill-position" };
    case "civic.issue_raised":
      return { label: "Issue", className: "pill-issue" };
    case "civic.issue_responded":
      return { label: "Issue Response", className: "pill-response" };
    case "civic.space.archived":
      return { label: "Archived", className: "pill-archived" };
    default:
      return { label: "Event", className: "pill-default" };
  }
}

function OutcomeCard({ event }: Props) {
  const data = event.data;
  return (
    <div className="ledger-card-body">
      <p className="ledger-card-summary">
        Outcome delivered from <strong>{String(data.originating_hub_id ?? "external hub")}</strong>
      </p>
      {data.originating_process_id && (
        <p className="ledger-card-detail">Process: {String(data.originating_process_id)}</p>
      )}
    </div>
  );
}

function ResponseCard({ event }: Props) {
  const data = event.data;
  return (
    <div className="ledger-card-body">
      <p className="ledger-card-summary">
        Response posted to {String(data.in_response_to_type ?? "outcome")}
      </p>
    </div>
  );
}

function PositionCard({ event }: Props) {
  const data = event.data;
  const isUpdate = event.event_type === "civic.position_updated";
  return (
    <div className="ledger-card-body">
      <p className="ledger-card-summary">
        {isUpdate ? "Updated position on" : "New position on"}{" "}
        <strong>{String(data.topic ?? "a topic")}</strong>
      </p>
      {isUpdate && data.version && (
        <p className="ledger-card-detail">Version {String(data.version)}</p>
      )}
    </div>
  );
}

function IssueCard({ event }: Props) {
  const data = event.data;
  return (
    <div className="ledger-card-body">
      <p className="ledger-card-summary">
        Citizen raised: <strong>{String(data.title ?? "an issue")}</strong>
      </p>
      {data.entry_type && (
        <p className="ledger-card-detail">Type: {String(data.entry_type)}</p>
      )}
    </div>
  );
}

function IssueResponseCard({ event }: Props) {
  const data = event.data;
  return (
    <div className="ledger-card-body">
      <p className="ledger-card-summary">
        Representative responded to issue
      </p>
      {data.issue_id && (
        <p className="ledger-card-detail">Issue: {String(data.issue_id)}</p>
      )}
    </div>
  );
}

function ArchiveCard(_props: Props) {
  return (
    <div className="ledger-card-body ledger-card-archive">
      <p className="ledger-card-summary">Space archived</p>
    </div>
  );
}

function DefaultCard({ event }: Props) {
  return (
    <div className="ledger-card-body">
      <p className="ledger-card-summary">{event.event_type}</p>
    </div>
  );
}

export default function LedgerEventCard({ event }: Props) {
  const pill = typePill(event.event_type);

  const cardContent = () => {
    switch (event.event_type) {
      case "civic.outcome_delivered":
        return <OutcomeCard event={event} />;
      case "civic.response_posted":
        return <ResponseCard event={event} />;
      case "civic.position_posted":
      case "civic.position_updated":
        return <PositionCard event={event} />;
      case "civic.issue_raised":
        return <IssueCard event={event} />;
      case "civic.issue_responded":
        return <IssueResponseCard event={event} />;
      case "civic.space.archived":
        return <ArchiveCard event={event} />;
      default:
        return <DefaultCard event={event} />;
    }
  };

  return (
    <div className={`ledger-event-card ${pill.className}`}>
      <div className="ledger-card-header">
        <span className={`ledger-pill ${pill.className}`}>{pill.label}</span>
        <span className="ledger-card-time">{relativeTime(event.timestamp)}</span>
      </div>
      {cardContent()}
    </div>
  );
}
