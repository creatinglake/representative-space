import type {
  RepresentativeSpace,
  CreateSpaceInput,
  UpdateSpaceInput,
  VerificationRecord,
  VerifyEntityInput,
} from "../models/space.js";
import type { Actor } from "../auth/types.js";
import { canActor } from "../auth/canActor.js";
import * as store from "../stores/spaceStore.js";
import { emitEvent } from "../events/eventEmitter.js";
import { generateId } from "../utils/id.js";

const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{1,62}[a-z0-9]$/;
const RESERVED_SLUGS = new Set([
  "admin",
  "health",
  "events",
  "debug",
  "api",
]);

const verificationRecords: VerificationRecord[] = [];

export async function createSpace(
  input: CreateSpaceInput,
  adminUserId: string,
): Promise<RepresentativeSpace> {
  if (!input.sub_type || !input.entity_slug || !input.jurisdiction ||
      !input.office_or_candidacy_label || !input.display_name) {
    throw new Error(
      "Missing required fields: sub_type, entity_slug, jurisdiction, office_or_candidacy_label, display_name",
    );
  }

  if (!SLUG_PATTERN.test(input.entity_slug)) {
    throw new Error(
      "Invalid slug: must be 3-64 chars, lowercase alphanumeric and hyphens, no leading/trailing hyphens",
    );
  }

  if (RESERVED_SLUGS.has(input.entity_slug)) {
    throw new Error(`Slug "${input.entity_slug}" is reserved`);
  }

  if (await store.slugExists(input.entity_slug)) {
    throw new Error(`Slug "${input.entity_slug}" already exists`);
  }

  const space: RepresentativeSpace = {
    id: generateId("spc"),
    sub_type: input.sub_type,
    entity_did: null,
    entity_slug: input.entity_slug,
    jurisdiction: input.jurisdiction,
    office_or_candidacy_label: input.office_or_candidacy_label,
    party_affiliation: input.party_affiliation ?? null,
    term_dates: input.term_dates ?? null,
    candidacy_record: input.candidacy_record ?? null,
    creation_date: new Date().toISOString(),
    verification_status: "unverified",
    lifecycle_state: "active",
    archived_at: null,
    archived_by: null,
    archived_reason: null,
    successor_space_slug: null,
    profile: {
      display_name: input.display_name,
      hero_image_url: input.hero_image_url ?? "",
      profile_image_url: input.profile_image_url ?? "",
      contact_channels: input.contact_channels ?? {},
      public_bio: input.public_bio ?? "",
      linked_official_sites: input.linked_official_sites ?? [],
    },
  };

  await store.createSpace(space);

  await emitEvent({
    event_type: "civic.space.created",
    actor: adminUserId,
    space_slug: space.entity_slug,
    jurisdiction: space.jurisdiction,
    data: {
      sub_type: space.sub_type,
      office_or_candidacy_label: space.office_or_candidacy_label,
      display_name: space.profile.display_name,
    },
  });

  return space;
}

export async function getSpaceBySlug(
  slug: string,
): Promise<RepresentativeSpace | undefined> {
  return store.getSpaceBySlug(slug);
}

export async function getAllSpaces(): Promise<RepresentativeSpace[]> {
  return store.getAllSpaces();
}

const PROFILE_FIELDS = new Set([
  "display_name",
  "hero_image_url",
  "profile_image_url",
  "contact_channels",
  "public_bio",
  "linked_official_sites",
]);

export async function updateSpace(
  slug: string,
  input: UpdateSpaceInput,
  actor: Actor,
): Promise<RepresentativeSpace> {
  const space = await store.getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const isAdmin = canActor(actor, "edit_space", { type: "space", slug });
  const isEntity = canActor(actor, "edit_profile", { type: "space", slug });

  if (!isAdmin && !isEntity) {
    throw new Error("Not authorized to edit this space");
  }

  let filteredInput = input;
  if (!isAdmin) {
    filteredInput = {} as UpdateSpaceInput;
    for (const key of Object.keys(input) as (keyof UpdateSpaceInput)[]) {
      if (PROFILE_FIELDS.has(key)) {
        (filteredInput as Record<string, unknown>)[key] = input[key];
      }
    }
  }

  const profilePatch: Partial<RepresentativeSpace["profile"]> = {};
  if (filteredInput.display_name !== undefined)
    profilePatch.display_name = filteredInput.display_name;
  if (filteredInput.contact_channels !== undefined)
    profilePatch.contact_channels = filteredInput.contact_channels;
  if (filteredInput.public_bio !== undefined)
    profilePatch.public_bio = filteredInput.public_bio;
  if (filteredInput.linked_official_sites !== undefined)
    profilePatch.linked_official_sites = filteredInput.linked_official_sites;
  if (filteredInput.hero_image_url !== undefined)
    profilePatch.hero_image_url = filteredInput.hero_image_url;
  if (filteredInput.profile_image_url !== undefined)
    profilePatch.profile_image_url = filteredInput.profile_image_url;

  const spacePatch: Partial<RepresentativeSpace> = {};
  if (filteredInput.office_or_candidacy_label !== undefined)
    spacePatch.office_or_candidacy_label =
      filteredInput.office_or_candidacy_label;
  if (filteredInput.jurisdiction !== undefined)
    spacePatch.jurisdiction = filteredInput.jurisdiction;
  if (filteredInput.party_affiliation !== undefined)
    spacePatch.party_affiliation = filteredInput.party_affiliation;
  if (filteredInput.term_dates !== undefined)
    spacePatch.term_dates = filteredInput.term_dates;
  if (filteredInput.candidacy_record !== undefined)
    spacePatch.candidacy_record = filteredInput.candidacy_record;
  if (filteredInput.lifecycle_state !== undefined)
    spacePatch.lifecycle_state = filteredInput.lifecycle_state;

  if (Object.keys(profilePatch).length > 0) {
    spacePatch.profile = { ...space.profile, ...profilePatch };
  }

  const updated = await store.updateSpace(space.id, spacePatch);
  if (!updated) {
    throw new Error(`Failed to update space "${slug}"`);
  }

  await emitEvent({
    event_type: "civic.space.updated",
    actor: actor.userId,
    space_slug: slug,
    jurisdiction: updated.jurisdiction,
    data: {
      updated_fields: Object.keys(filteredInput),
    },
  });

  return updated;
}

export async function verifyEntity(
  slug: string,
  adminUserId: string,
  input: VerifyEntityInput,
): Promise<{ space: RepresentativeSpace; verification: VerificationRecord }> {
  const space = await store.getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const record: VerificationRecord = {
    id: generateId("ver"),
    space_id: space.id,
    proof_type: "admin_attestation",
    verified_by: adminUserId,
    verified_at: new Date().toISOString(),
    notes: input.notes ?? "",
  };

  verificationRecords.push(record);

  const updated = await store.updateSpace(space.id, {
    verification_status: "verified",
    entity_did: input.entity_did ?? null,
  });

  if (!updated) {
    throw new Error(`Failed to verify space "${slug}"`);
  }

  await emitEvent({
    event_type: "civic.space.verified",
    actor: adminUserId,
    space_slug: slug,
    jurisdiction: updated.jurisdiction,
    data: {
      verification_id: record.id,
      entity_did: updated.entity_did,
    },
  });

  return { space: updated, verification: record };
}

export function getVerificationRecords(
  spaceId: string,
): VerificationRecord[] {
  return verificationRecords.filter((r) => r.space_id === spaceId);
}

export async function archiveSpace(
  slug: string,
  adminUserId: string,
  reason: string,
  successorSpaceSlug?: string,
): Promise<RepresentativeSpace> {
  const space = await store.getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  if (!reason || reason.trim().length === 0) {
    throw new Error("Archive reason is required");
  }

  if (successorSpaceSlug) {
    const successor = await store.getSpaceBySlug(successorSpaceSlug);
    if (!successor) {
      throw new Error(`Successor space "${successorSpaceSlug}" not found`);
    }
  }

  const updated = await store.updateSpace(space.id, {
    lifecycle_state: "archived",
    archived_at: new Date().toISOString(),
    archived_by: adminUserId,
    archived_reason: reason.trim(),
    successor_space_slug: successorSpaceSlug ?? null,
  } as Partial<RepresentativeSpace>);

  if (!updated) {
    throw new Error(`Failed to archive space "${slug}"`);
  }

  await emitEvent({
    event_type: "civic.space.archived",
    actor: adminUserId,
    space_slug: slug,
    jurisdiction: updated.jurisdiction,
    data: {
      reason: reason.trim(),
      successor_space_slug: successorSpaceSlug ?? null,
    },
  });

  return updated;
}

export async function unarchiveSpace(
  slug: string,
  adminUserId: string,
): Promise<RepresentativeSpace> {
  const space = await store.getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const updated = await store.updateSpace(space.id, {
    lifecycle_state: "active",
    archived_at: null,
    archived_by: null,
    archived_reason: null,
    successor_space_slug: null,
  } as Partial<RepresentativeSpace>);

  if (!updated) {
    throw new Error(`Failed to unarchive space "${slug}"`);
  }

  await emitEvent({
    event_type: "civic.space.unarchived",
    actor: adminUserId,
    space_slug: slug,
    jurisdiction: updated.jurisdiction,
    data: {},
  });

  return updated;
}
