export class ModerationBlockedError extends Error {
  public readonly violation_reason: string;

  constructor(violation_reason: string) {
    super(`Content blocked: ${violation_reason}`);
    this.name = "ModerationBlockedError";
    this.violation_reason = violation_reason;
  }
}
