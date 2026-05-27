import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the anthropic module before importing the service
vi.mock("../../src/utils/anthropic.js", () => ({
  callClaude: vi.fn(),
  DEFAULT_MODEL: "claude-sonnet-4-6",
}));

import { moderateContent } from "../../src/modules/civic.moderation/service.js";
import { ModerationBlockedError } from "../../src/modules/civic.moderation/errors.js";
import { requireModeration } from "../../src/modules/civic.moderation/service.js";
import { callClaude } from "../../src/utils/anthropic.js";

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>;

describe("AI Moderation", () => {
  const originalApiKey = process.env.ANTHROPIC_API_KEY;

  beforeEach(() => {
    vi.clearAllMocks();
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
  });

  afterEach(() => {
    if (originalApiKey !== undefined) {
      process.env.ANTHROPIC_API_KEY = originalApiKey;
    } else {
      delete process.env.ANTHROPIC_API_KEY;
    }
  });

  describe("moderateContent", () => {
    it("allows clean content", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":true}',
        model: "claude-sonnet-4-6",
      });

      const result = await moderateContent(
        "The park needs better lighting for pedestrian safety.",
      );

      expect(result.allowed).toBe(true);
      expect(result.violation_reason).toBeUndefined();
      expect(mockCallClaude).toHaveBeenCalledOnce();
    });

    it("blocks violating content with reason", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":false,"violation_reason":"Personal attack: calling someone an idiot targets the person rather than their argument."}',
        model: "claude-sonnet-4-6",
      });

      const result = await moderateContent("You're a complete idiot.");

      expect(result.allowed).toBe(false);
      expect(result.violation_reason).toContain("Personal attack");
    });

    it("allows content when no API key is set (graceful degradation)", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      const result = await moderateContent("Any content at all.");

      expect(result.allowed).toBe(true);
      expect(mockCallClaude).not.toHaveBeenCalled();
    });

    it("allows content on API error (fail open)", async () => {
      mockCallClaude.mockRejectedValue(new Error("Anthropic API 500: internal error"));

      const result = await moderateContent("Some content.");

      expect(result.allowed).toBe(true);
    });

    it("allows content on timeout (fail open)", async () => {
      mockCallClaude.mockRejectedValue(
        new Error("Anthropic API call exceeded 180000ms — aborted"),
      );

      const result = await moderateContent("Some content.");

      expect(result.allowed).toBe(true);
    });

    it("allows content on malformed JSON response (fail open)", async () => {
      mockCallClaude.mockResolvedValue({
        text: "I think this content is fine",
        model: "claude-sonnet-4-6",
      });

      const result = await moderateContent("Some content.");

      expect(result.allowed).toBe(true);
    });

    it("handles response wrapped in markdown code fences", async () => {
      mockCallClaude.mockResolvedValue({
        text: '```json\n{"allowed":false,"violation_reason":"Spam"}\n```',
        model: "claude-sonnet-4-6",
      });

      const result = await moderateContent("Buy now! Click here!");

      expect(result.allowed).toBe(false);
      expect(result.violation_reason).toBe("Spam");
    });

    it("allows content when response missing 'allowed' field", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"result":"ok"}',
        model: "claude-sonnet-4-6",
      });

      const result = await moderateContent("Some content.");

      expect(result.allowed).toBe(true);
    });

    it("sends content to Claude with correct system prompt", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":true}',
        model: "claude-sonnet-4-6",
      });

      await moderateContent("Test content here");

      expect(mockCallClaude).toHaveBeenCalledWith({
        model: "claude-sonnet-4-6",
        system: expect.stringContaining("Code of Conduct"),
        userText: "Test content here",
        maxTokens: 256,
      });
    });
  });

  describe("requireModeration", () => {
    it("does not throw for allowed content", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":true}',
        model: "claude-sonnet-4-6",
      });

      await expect(
        requireModeration("Clean civic discourse."),
      ).resolves.toBeUndefined();
    });

    it("throws ModerationBlockedError for blocked content", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":false,"violation_reason":"Incitement to violence"}',
        model: "claude-sonnet-4-6",
      });

      await expect(
        requireModeration("Violent content here."),
      ).rejects.toThrow(ModerationBlockedError);
    });

    it("ModerationBlockedError has violation_reason", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":false,"violation_reason":"Harassment detected"}',
        model: "claude-sonnet-4-6",
      });

      try {
        await requireModeration("Harassing content.");
        expect.fail("Should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(ModerationBlockedError);
        expect((err as ModerationBlockedError).violation_reason).toBe(
          "Harassment detected",
        );
      }
    });

    it("does not throw when no API key (fail open)", async () => {
      delete process.env.ANTHROPIC_API_KEY;

      await expect(
        requireModeration("Any content."),
      ).resolves.toBeUndefined();
    });
  });
});
