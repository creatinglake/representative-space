import { useEffect, useState, useCallback } from "react";
import {
  getLedger,
  type CivicEvent,
  type LedgerEventType,
} from "../services/api.ts";
import LedgerEventCard from "./LedgerEventCard.tsx";
import "./ResponsivenessLedger.css";

interface Props {
  slug: string;
}

type FilterCategory = "all" | "outcomes" | "responses" | "positions" | "issues";

const FILTER_MAP: Record<FilterCategory, LedgerEventType[] | undefined> = {
  all: undefined,
  outcomes: ["civic.outcome_delivered"],
  responses: ["civic.response_posted", "civic.issue_responded"],
  positions: ["civic.position_posted", "civic.position_updated"],
  issues: ["civic.issue_raised"],
};

export default function ResponsivenessLedger({ slug }: Props) {
  const [events, setEvents] = useState<CivicEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [filterCategory, setFilterCategory] = useState<FilterCategory>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const loadLedger = useCallback(
    (append = false, cursor?: string) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      getLedger(slug, {
        event_types: FILTER_MAP[filterCategory],
        from: dateFrom || undefined,
        to: dateTo || undefined,
        cursor,
      })
        .then((result) => {
          if (append) {
            setEvents((prev) => [...prev, ...result.events]);
          } else {
            setEvents(result.events);
          }
          setNextCursor(result.next_cursor);
          setHasMore(result.has_more);
        })
        .catch(() => {
          if (!append) setEvents([]);
        })
        .finally(() => {
          setLoading(false);
          setLoadingMore(false);
        });
    },
    [slug, filterCategory, dateFrom, dateTo],
  );

  useEffect(() => {
    loadLedger(false);
  }, [loadLedger]);

  const handleLoadMore = () => {
    if (nextCursor) {
      loadLedger(true, nextCursor);
    }
  };

  const filters: { key: FilterCategory; label: string }[] = [
    { key: "all", label: "All" },
    { key: "outcomes", label: "Outcomes" },
    { key: "responses", label: "Responses" },
    { key: "positions", label: "Positions" },
    { key: "issues", label: "Issues" },
  ];

  return (
    <section className="responsiveness-ledger">
      <h3 className="section-heading">Responsiveness Ledger</h3>

      <div className="ledger-controls">
        <div className="ledger-filter-bar">
          {filters.map((f) => (
            <button
              key={f.key}
              className={`ledger-filter-btn ${filterCategory === f.key ? "active" : ""}`}
              onClick={() => setFilterCategory(f.key)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="ledger-date-range">
          <label>
            From
            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
            />
          </label>
          <label>
            To
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
            />
          </label>
        </div>
      </div>

      {loading ? (
        <p className="section-status">Loading ledger...</p>
      ) : events.length === 0 ? (
        <p className="section-empty">
          No activity recorded yet. Outcomes, positions, issues, and responses will appear here.
        </p>
      ) : (
        <>
          <div className="ledger-event-list">
            {events.map((event) => (
              <LedgerEventCard key={event.id} event={event} />
            ))}
          </div>

          {hasMore && (
            <button
              className="ledger-load-more"
              onClick={handleLoadMore}
              disabled={loadingMore}
            >
              {loadingMore ? "Loading..." : "Load More"}
            </button>
          )}
        </>
      )}
    </section>
  );
}
