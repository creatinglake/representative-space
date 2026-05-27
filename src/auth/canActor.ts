import type { Actor, Action, Resource } from "./types.js";

export function canActor(
  actor: Actor,
  action: Action,
  resource: Resource,
): boolean {
  switch (action) {
    // Admin-only actions
    case "create_space":
    case "edit_space":
    case "verify_entity":
    case "archive_space":
    case "unarchive_space":
    case "hide_content":
    case "restore_content":
      return actor.role === "admin";

    // Verified entity on own space
    case "edit_profile":
    case "respond_to_outcome":
    case "post_position":
    case "edit_position":
    case "respond_to_issue":
      return (
        actor.role === "verified_entity" &&
        !!actor.spaceSlug &&
        actor.spaceSlug === resource.slug
      );

    // Close issue: entity on own space only
    case "close_issue":
      return (
        actor.role === "verified_entity" &&
        !!actor.spaceSlug &&
        actor.spaceSlug === resource.slug
      );

    // Citizen-only actions (verified_citizen and citizen, NOT admin)
    case "raise_issue":
    case "signal_issue":
      return (
        actor.role === "verified_citizen" || actor.role === "citizen"
      );

    // Host deliberation: entity on own space (P6)
    case "host_deliberation":
      return (
        actor.role === "verified_entity" &&
        !!actor.spaceSlug &&
        actor.spaceSlug === resource.slug
      );

    // Participate deliberation: any authenticated user (P6)
    // TODO: tighten to verified_citizen + verified_entity + admin before production
    case "participate_deliberation":
      return (
        actor.role === "citizen" ||
        actor.role === "verified_citizen" ||
        actor.role === "verified_entity" ||
        actor.role === "admin"
      );

    // Public actions
    case "view_space":
    case "list_spaces":
      return true;

    default:
      return false;
  }
}
