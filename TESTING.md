# TESTING.md — Representative Space Test Coverage Inventory

Updated after every slice. Tracks which flows are tested and how.

---

## Test Infrastructure

- **Runner:** Vitest (`npm test` / `npm run test:watch`)
- **API tests:** Start the Express app on a random port via `tests/fixtures/helpers.ts`, seed via HTTP
- **Store isolation:** `resetStores()` called in `beforeEach` to clear in-memory state between tests

---

## Unit Tests

### `tests/unit/canActor.test.ts` — 44 tests

| Flow | Covered |
|------|---------|
| Admin can create_space, edit_space, verify_entity | Yes |
| Citizen denied create_space, edit_space, verify_entity | Yes |
| Verified citizen denied admin-only actions | Yes |
| Verified entity denied admin-only actions | Yes |
| Verified entity can edit_profile on own space | Yes |
| Verified entity denied edit_profile on other space | Yes |
| Admin denied edit_profile | Yes |
| Citizen denied edit_profile | Yes |
| Entity without spaceSlug denied edit_profile | Yes |
| All roles can view_space | Yes |
| All roles can list_spaces | Yes |
| Verified entity can respond_to_outcome on own space | Yes |
| Verified entity denied respond_to_outcome on other space | Yes |
| Admin denied respond_to_outcome | Yes |
| Citizen denied respond_to_outcome | Yes |
| Verified entity can post_position on own space | Yes |
| Verified entity denied post_position on other space | Yes |
| Admin denied post_position | Yes |
| Citizen denied post_position | Yes |
| Verified entity can edit_position on own space | Yes |
| Verified entity denied edit_position on other space | Yes |
| Admin denied edit_position | Yes |
| Citizen denied edit_position | Yes |
| Verified entity can host_deliberation on own space | Yes |
| Verified entity denied host_deliberation on other space | Yes |
| Admin denied host_deliberation | Yes |
| Citizen denied host_deliberation | Yes |
| Verified citizen denied host_deliberation | Yes |
| Verified citizen can participate_deliberation | Yes |
| Verified entity can participate_deliberation | Yes |
| Admin can participate_deliberation | Yes |
| Plain citizen denied participate_deliberation | Yes |

---

## API Tests

### `tests/api/health.test.ts` — 1 test

| Flow | Covered |
|------|---------|
| GET /health returns 200 with ok status | Yes |

### `tests/api/discovery.test.ts` — 1 test

| Flow | Covered |
|------|---------|
| GET /.well-known/civic.json returns manifest with all required fields | Yes |

### `tests/api/spaces.test.ts` — 16 tests

| Flow | Covered |
|------|---------|
| Create candidate space with admin auth | Yes |
| Create individual space with admin auth | Yes |
| Reject duplicate slugs (409) | Yes |
| Reject create without admin auth (403) | Yes |
| Reject create without any auth (401) | Yes |
| Reject invalid slug format (400) | Yes |
| List spaces — empty | Yes |
| List spaces — returns all | Yes |
| Get space by slug — found | Yes |
| Get space by slug — not found (404) | Yes |
| Admin update space fields | Yes |
| Update — not found (404) | Yes |
| Update — unauthenticated (401) | Yes |
| Verify entity — success | Yes |
| Verify — non-admin rejected (403) | Yes |
| Verify — not found (404) | Yes |

### `tests/api/events.test.ts` — 5 tests

| Flow | Covered |
|------|---------|
| civic.space.created emitted on create | Yes |
| civic.space.updated emitted on update | Yes |
| civic.space.verified emitted on verify | Yes |
| Filter events by space_slug query param | Yes |
| Event has correct civic event structure (id, version, event_type, timestamp, actor, action_url, source, data, meta) | Yes |

---

### `tests/api/outcomes.test.ts` — 11 tests

| Flow | Covered |
|------|---------|
| Inbox with valid HMAC → 201 | Yes |
| Inbox with invalid HMAC → 403 | Yes |
| Inbox with missing signature → 401 | Yes |
| Inbox to nonexistent space → 404 | Yes |
| GET outcomes returns reverse-chron list | Yes |
| GET outcome/:id returns with response data | Yes |
| POST response with verified entity → 201 | Yes |
| POST response without auth → 401 | Yes |
| POST response with wrong entity → 403 | Yes |
| PATCH response creates new version, preserves old | Yes |
| civic.response_posted and civic.response_edited events emitted | Yes |

### `tests/api/positions.test.ts` — 7 tests

| Flow | Covered |
|------|---------|
| POST position with verified entity → 201 | Yes |
| POST position without auth → 401 | Yes |
| POST position with wrong entity → 403 | Yes |
| GET positions returns current only | Yes |
| PATCH position creates new version, marks old superseded | Yes |
| GET history returns version chain | Yes |
| civic.position_posted and civic.position_updated events emitted | Yes |

### `tests/api/issues.test.ts` — 18 tests

| Flow | Covered |
|------|---------|
| POST issue as verified citizen → 201 | Yes |
| POST question entry_type → 201 | Yes |
| POST poll with options → 201 | Yes |
| POST issue without auth → 401 | Yes |
| POST issue as admin (denied) → 403 | Yes |
| GET issues returns sorted by net support | Yes |
| GET issues filters by entry_type | Yes |
| GET issues filters by response status | Yes |
| GET single issue by ID | Yes |
| GET hidden issue body is redacted | Yes |
| PATCH issue creates new version | Yes |
| POST signal (support) → tallies updated | Yes |
| POST signal (poll vote) → poll_tally updated | Yes |
| POST signal upsert (change vote) | Yes |
| PATCH close issue (entity on own space) | Yes |
| POST respond to issue (entity) | Yes |
| PATCH edit issue response (versioned) | Yes |
| Issue events emitted (raised, signaled, responded, closed) | Yes |

### `tests/api/archive.test.ts` — 13 tests

| Flow | Covered |
|------|---------|
| POST archive with reason → 200 | Yes |
| POST archive with successor space → 200 | Yes |
| POST archive with nonexistent successor → 404 | Yes |
| POST archive without reason → 400 | Yes |
| POST archive as non-admin → 403 | Yes |
| Archive emits civic.space.archived event | Yes |
| Archived space rejects POST issues → 403 | Yes |
| Archived space rejects POST positions → 403 | Yes |
| Archived space still serves GET issues | Yes |
| 403 response includes successor_space_slug | Yes |
| POST unarchive → 200 | Yes |
| Unarchived space accepts writes again | Yes |
| POST unarchive as non-admin → 403 | Yes |

### `tests/api/moderation.test.ts` — 10 tests

| Flow | Covered |
|------|---------|
| Clean issue content passes through | Yes |
| Violating issue content blocked → 400 | Yes |
| Violating issue edit blocked → 400 | Yes |
| Clean position content passes through | Yes |
| Violating position blocked → 400 | Yes |
| Violating outcome response blocked → 400 | Yes |
| Violating issue response blocked → 400 | Yes |
| Violating issue edit response blocked → 400 | Yes |
| Malformed AI response → fail-open (allows) | Yes |
| AI error → fail-open (allows) | Yes |

### `tests/api/admin-moderation.test.ts` — 11 tests

| Flow | Covered |
|------|---------|
| Admin hides an issue | Yes |
| Hidden issue excluded from list | Yes |
| Hidden issue body redacted on GET | Yes |
| Hide requires reason | Yes |
| Non-admin denied hide | Yes |
| Admin restores a hidden issue | Yes |
| Restored issue reappears in list | Yes |
| Non-admin denied restore | Yes |
| GET /admin/moderation/log returns entries | Yes |
| Non-admin denied moderation log | Yes |
| Hide/restore events excluded from public feed | Yes |

### `tests/unit/moderation.test.ts` — 13 tests

| Flow | Covered |
|------|---------|
| moderateContent returns allowed:true for clean content | Yes |
| moderateContent returns allowed:false with reason | Yes |
| moderateContent handles markdown code fences | Yes |
| moderateContent fail-open on missing API key | Yes |
| moderateContent fail-open on malformed JSON | Yes |
| moderateContent fail-open on non-boolean allowed | Yes |
| moderateContent fail-open on API error | Yes |
| requireModeration passes clean content | Yes |
| requireModeration throws ModerationBlockedError | Yes |
| ModerationBlockedError has violation_reason | Yes |
| Code of Conduct prompt structure | Yes |
| Timeout handling (AbortController) | Yes |
| Model parameter passed correctly | Yes |

### `tests/api/ledger.test.ts` — 18 tests

| Flow | Covered |
|------|---------|
| Empty ledger for new space | Yes |
| 404 for nonexistent space | Yes |
| Only ledger-renderable types returned | Yes |
| Single event_type filter | Yes |
| Multiple event_type filter | Yes |
| Invalid event_type → 400 | Yes |
| No filter → all renderable types | Yes |
| Date range: from only | Yes |
| Date range: to only | Yes |
| Date range: both from and to | Yes |
| Default limit (20) | Yes |
| Custom limit respected | Yes |
| Limit clamped to 100 | Yes |
| next_cursor present when has_more | Yes |
| next_cursor null when no more | Yes |
| Cursor returns next page with no overlap | Yes |
| Multi-page iteration covers all events | Yes |
| Restricted-visibility events excluded | Yes |

### `tests/api/deliberation.test.ts` — 25 tests

| Flow | Covered |
|------|---------|
| POST process as verified entity → 201 | Yes |
| POST process without auth → 401 | Yes |
| POST process as citizen → 403 | Yes |
| POST process as wrong entity → 403 | Yes |
| POST process on nonexistent space → 404 | Yes |
| POST process with unknown type → 400 | Yes |
| Admin denied host_deliberation → 403 | Yes |
| GET processes — list (public, no auth) | Yes |
| GET processes — empty list | Yes |
| GET process read model (public) | Yes |
| GET nonexistent process → 404 | Yes |
| State initializes deadline + threshold | Yes |
| State initializes continued_from_response_id | Yes |
| Vote without auth → 401 | Yes |
| Vote as citizen → 403 | Yes |
| Submit statement without auth → 401 | Yes |
| Get next statement without auth → 401 | Yes |
| Vote on draft process → 409 | Yes |
| Submit statement on draft process → 409 | Yes |
| Get clusters on draft process → 409 | Yes |
| Vote missing statement_id → 400/409 | Yes |
| Vote invalid direction → 400/409 | Yes |
| Close by citizen → 403 | Yes |
| Regenerate by citizen → 403 | Yes |
| civic.process.created event emitted | Yes |

### `tests/api/immutableResponse.test.ts` — 3 tests

| Flow | Covered |
|------|---------|
| Response to polis outcome is immutable — edit rejected | Yes |
| Response to regular outcome is editable | Yes |
| Polis outcome has originating_process_type in GET | Yes |

### `tests/api/methodology.test.ts` — 2 tests

| Flow | Covered |
|------|---------|
| GET /methodology/polis-summarization-v1 returns prompt metadata | Yes |
| Prompt contains required behavioral constraints | Yes |

---

## Not Yet Covered (deferred to later sessions)

- Entity profile edit via PATCH with verified_entity auth (needs verification + entity_did matching flow)
- Frontend component rendering (no E2E tests yet)
- Linked official sites CRUD
- Deliberation lifecycle tests: full active→closed flow with real Polis integration (current tests use mock mode)
- Civic-hub integration hook for outcome delivery (deferred to separate session)
