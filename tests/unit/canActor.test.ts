import { describe, it, expect } from "vitest";
import { canActor } from "../../src/auth/canActor.js";
import type { Actor, Action, Resource } from "../../src/auth/types.js";

const space: Resource = { type: "space", slug: "test-space" };
const otherSpace: Resource = { type: "space", slug: "other-space" };

const admin: Actor = { role: "admin", userId: "admin@test.com" };
const entity: Actor = {
  role: "verified_entity",
  userId: "entity-did",
  spaceSlug: "test-space",
};
const entityOther: Actor = {
  role: "verified_entity",
  userId: "entity-did",
  spaceSlug: "other-space",
};
const citizen: Actor = { role: "citizen", userId: "citizen-1" };
const verifiedCitizen: Actor = {
  role: "verified_citizen",
  userId: "citizen-2",
};

describe("canActor", () => {
  describe("admin-only actions", () => {
    const adminActions: Action[] = ["create_space", "edit_space", "verify_entity"];

    for (const action of adminActions) {
      it(`allows admin to ${action}`, () => {
        expect(canActor(admin, action, space)).toBe(true);
      });

      it(`denies citizen to ${action}`, () => {
        expect(canActor(citizen, action, space)).toBe(false);
      });

      it(`denies verified_citizen to ${action}`, () => {
        expect(canActor(verifiedCitizen, action, space)).toBe(false);
      });

      it(`denies verified_entity to ${action}`, () => {
        expect(canActor(entity, action, space)).toBe(false);
      });
    }
  });

  describe("edit_profile", () => {
    it("allows verified_entity on their own space", () => {
      expect(canActor(entity, "edit_profile", space)).toBe(true);
    });

    it("denies verified_entity on a different space", () => {
      expect(canActor(entity, "edit_profile", otherSpace)).toBe(false);
    });

    it("denies admin", () => {
      expect(canActor(admin, "edit_profile", space)).toBe(false);
    });

    it("denies citizen", () => {
      expect(canActor(citizen, "edit_profile", space)).toBe(false);
    });

    it("denies entity without spaceSlug", () => {
      const noSlug: Actor = { role: "verified_entity", userId: "x" };
      expect(canActor(noSlug, "edit_profile", space)).toBe(false);
    });
  });

  describe("entity-only actions (Prompt 2)", () => {
    const entityActions: Action[] = [
      "respond_to_outcome",
      "post_position",
      "edit_position",
    ];

    for (const action of entityActions) {
      it(`allows verified_entity on own space to ${action}`, () => {
        expect(canActor(entity, action, space)).toBe(true);
      });

      it(`denies verified_entity on other space to ${action}`, () => {
        expect(canActor(entity, action, otherSpace)).toBe(false);
      });

      it(`denies admin to ${action}`, () => {
        expect(canActor(admin, action, space)).toBe(false);
      });

      it(`denies citizen to ${action}`, () => {
        expect(canActor(citizen, action, space)).toBe(false);
      });
    }
  });

  describe("host_deliberation (Prompt 6)", () => {
    it("allows verified_entity on own space", () => {
      expect(canActor(entity, "host_deliberation", space)).toBe(true);
    });

    it("denies verified_entity on other space", () => {
      expect(canActor(entity, "host_deliberation", otherSpace)).toBe(false);
    });

    it("denies admin", () => {
      expect(canActor(admin, "host_deliberation", space)).toBe(false);
    });

    it("denies citizen", () => {
      expect(canActor(citizen, "host_deliberation", space)).toBe(false);
    });

    it("denies verified_citizen", () => {
      expect(canActor(verifiedCitizen, "host_deliberation", space)).toBe(false);
    });
  });

  describe("participate_deliberation (Prompt 6)", () => {
    it("allows verified_citizen", () => {
      expect(canActor(verifiedCitizen, "participate_deliberation", space)).toBe(true);
    });

    it("allows verified_entity", () => {
      expect(canActor(entity, "participate_deliberation", space)).toBe(true);
    });

    it("allows admin", () => {
      expect(canActor(admin, "participate_deliberation", space)).toBe(true);
    });

    it("allows plain citizen (relaxed for demo)", () => {
      expect(canActor(citizen, "participate_deliberation", space)).toBe(true);
    });
  });

  describe("public actions", () => {
    const publicActions: Action[] = ["view_space", "list_spaces"];

    for (const action of publicActions) {
      it(`allows citizen to ${action}`, () => {
        expect(canActor(citizen, action, space)).toBe(true);
      });

      it(`allows admin to ${action}`, () => {
        expect(canActor(admin, action, space)).toBe(true);
      });

      it(`allows verified_entity to ${action}`, () => {
        expect(canActor(entity, action, space)).toBe(true);
      });
    }
  });
});
