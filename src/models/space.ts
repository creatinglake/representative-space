export type SpaceSubType = "individual" | "candidate";
export type VerificationStatus = "unverified" | "verified";
export type LifecycleState = "active" | "archived";

export interface ContactChannels {
  phone?: string;
  email?: string;
  office_address?: string;
}

export interface ProfileData {
  display_name: string;
  hero_image_url: string;
  profile_image_url: string;
  contact_channels: ContactChannels;
  public_bio: string;
  linked_official_sites: string[];
}

export interface TermDates {
  start: string;
  end?: string;
}

export interface CandidacyRecord {
  filing_date?: string;
  election_date?: string;
  election_type?: string;
  status?: string;
}

export interface RepresentativeSpace {
  id: string;
  sub_type: SpaceSubType;
  entity_did: string | null;
  entity_slug: string;
  jurisdiction: string;
  office_or_candidacy_label: string;
  party_affiliation: string | null;
  term_dates: TermDates | null;
  candidacy_record: CandidacyRecord | null;
  creation_date: string;
  verification_status: VerificationStatus;
  lifecycle_state: LifecycleState;
  archived_at: string | null;
  archived_by: string | null;
  archived_reason: string | null;
  successor_space_slug: string | null;
  profile: ProfileData;
}

export interface VerificationRecord {
  id: string;
  space_id: string;
  proof_type: "admin_attestation";
  verified_by: string;
  verified_at: string;
  notes: string;
}

export interface CreateSpaceInput {
  sub_type: SpaceSubType;
  entity_slug: string;
  jurisdiction: string;
  office_or_candidacy_label: string;
  display_name: string;
  party_affiliation?: string;
  term_dates?: TermDates;
  candidacy_record?: CandidacyRecord;
  contact_channels?: ContactChannels;
  public_bio?: string;
  linked_official_sites?: string[];
  hero_image_url?: string;
  profile_image_url?: string;
}

export interface UpdateSpaceInput {
  office_or_candidacy_label?: string;
  jurisdiction?: string;
  party_affiliation?: string | null;
  term_dates?: TermDates | null;
  candidacy_record?: CandidacyRecord | null;
  lifecycle_state?: LifecycleState;
  display_name?: string;
  contact_channels?: ContactChannels;
  public_bio?: string;
  linked_official_sites?: string[];
  hero_image_url?: string;
  profile_image_url?: string;
}

export interface VerifyEntityInput {
  entity_did?: string;
  notes?: string;
}
