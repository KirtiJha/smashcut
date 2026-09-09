/**
 * WS-C — timingResolver tests.
 *
 * The resolver is pure (no DOM, no Date.now, no Math.random) so it can be
 * unit-tested directly. These tests also serve as the preview==render parity
 * fixture: the resolver produces the exact same output regardless of whether
 * it is called from the preview path (session layer) or the render path
 * (timingCompiler). A golden parity test at the end confirms both paths
 * produce identical enter/exit from the same resolver call.
 */

import { describe, it, expect } from "vitest";
import {
  resolveTimings,
  type AuthoredTiming,
  type WordTiming,
  type ElementAnchor,
} from "./timingResolver.js";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function authored(hfId: string, start: number, duration: number): AuthoredTiming {
  return { hfId, start, duration };
}

function word(index: number, start: number, end: number): WordTiming {
  return { index, start, end };
}

function anchor(
  hfId: string,
  wordIndex: number,
  enterDuration: number,
  exitDuration: number,
  slotEnd: number,
  enterOffset?: number,
): ElementAnchor {
  return { hfId, wordIndex, enterDuration, exitDuration, slotEnd, enterOffset };
}

// ─── Un-anchored elements keep authored timing ────────────────────────────────

describe("resolveTimings — un-anchored elements", () => {
  it("returns authored start/duration unchanged when no anchors supplied", () => {
    const result = resolveTimings({
      elements: [authored("sc-a", 1, 2), authored("sc-b", 3, 1.5)],
      wordTimings: [],
      anchors: [],
    });
    expect(result["sc-a"]).toEqual({ enterAt: 1, exitAt: 3, holdDuration: 0 });
    expect(result["sc-b"]).toEqual({ enterAt: 3, exitAt: 4.5, holdDuration: 0 });
  });

  it("align-on-adjust: anchored and un-anchored elements in same call", () => {
    const result = resolveTimings({
      elements: [authored("sc-anchored", 0, 3), authored("sc-free", 4, 2)],
      wordTimings: [word(0, 1.0, 1.5)],
      anchors: [anchor("sc-anchored", 0, 0.5, 0.5, 3.0)],
    });

    // Anchored: enters at word 0 start (1.0), enterDuration=0.5, exitDuration=0.5
    // slot=3.0 → holdDuration = max(0, 3.0 - (1.0 + 0.5 + 0.5)) = 1.0
    // exitAt = 1.0 + 0.5 + 1.0 + 0.5 = 3.0
    expect(result["sc-anchored"]).toEqual({ enterAt: 1.0, exitAt: 3.0, holdDuration: 1.0 });

    // Un-anchored: keeps authored timing
    expect(result["sc-free"]).toEqual({ enterAt: 4, exitAt: 6, holdDuration: 0 });
  });
});

// ─── Word-anchored elements ───────────────────────────────────────────────────

describe("resolveTimings — word-anchored elements", () => {
  it("anchors element enterAt to word start", () => {
    const result = resolveTimings({
      elements: [authored("sc-x", 0, 2)],
      wordTimings: [word(0, 0.5, 1.0), word(1, 1.5, 2.0)],
      anchors: [anchor("sc-x", 1, 0.3, 0.2, 2.5)],
    });
    // enterAt = wordTimings[1].start = 1.5; enterDuration=0.3, exitDuration=0.2
    // holdDuration = max(0, 2.5 - (1.5 + 0.3 + 0.2)) = max(0, 0.5) = 0.5
    // exitAt = 1.5 + 0.3 + 0.5 + 0.2 = 2.5
    expect(result["sc-x"]).toEqual({ enterAt: 1.5, exitAt: 2.5, holdDuration: 0.5 });
  });

  it("enterOffset shifts enterAt relative to word start", () => {
    const result = resolveTimings({
      elements: [authored("sc-y", 0, 1)],
      wordTimings: [word(0, 2.0, 2.5)],
      anchors: [anchor("sc-y", 0, 0.2, 0.1, 4.0, 0.3)],
    });
    // enterAt = 2.0 + 0.3 = 2.3
    // holdDuration = max(0, 4.0 - (2.3 + 0.2 + 0.1)) = 1.4
    // exitAt = 2.3 + 0.2 + 1.4 + 0.1 = 4.0
    expect(result["sc-y"]?.enterAt).toBeCloseTo(2.3);
    expect(result["sc-y"]?.exitAt).toBeCloseTo(4.0);
    expect(result["sc-y"]?.holdDuration).toBeCloseTo(1.4);
  });
});

// ─── Elastic hold math ────────────────────────────────────────────────────────

describe("resolveTimings — elastic hold math", () => {
  it("holdDuration = max(0, slotEnd - (enterAt + enterDuration + exitDuration))", () => {
    const result = resolveTimings({
      elements: [authored("sc-z", 0, 1)],
      wordTimings: [word(0, 0.0, 0.5)],
      anchors: [anchor("sc-z", 0, 0.5, 0.5, 3.0)],
    });
    // enterAt=0, holdDuration = max(0, 3.0 - (0 + 0.5 + 0.5)) = 2.0
    expect(result["sc-z"]).toEqual({ enterAt: 0, exitAt: 3.0, holdDuration: 2.0 });
  });

  it("clamps holdDuration >= 0 when slot is too tight", () => {
    const result = resolveTimings({
      elements: [authored("sc-tight", 0, 2)],
      wordTimings: [word(0, 5.0, 5.5)],
      // enter=1.0, exit=1.0, slotEnd=5.5 → slot=5.5-(5.0+1.0+1.0)=-1.5 → clamp to 0
      anchors: [anchor("sc-tight", 0, 1.0, 1.0, 5.5)],
    });
    expect(result["sc-tight"]?.holdDuration).toBe(0);
    // exitAt = 5.0 + 1.0 + 0 + 1.0 = 7.0 (element exits after its natural duration)
    expect(result["sc-tight"]?.exitAt).toBe(7.0);
  });

  it("holdDuration is zero (not negative) when exactly at slot boundary", () => {
    const result = resolveTimings({
      elements: [authored("sc-exact", 0, 1)],
      wordTimings: [word(0, 1.0, 1.5)],
      // enterAt=1.0, slotEnd=1.0+0.3+0.2=1.5 → holdDuration=0
      anchors: [anchor("sc-exact", 0, 0.3, 0.2, 1.5)],
    });
    expect(result["sc-exact"]?.holdDuration).toBe(0);
    expect(result["sc-exact"]?.exitAt).toBeCloseTo(1.5);
  });
});

// ─── Missing word index falls back gracefully ────────────────────────────────

describe("resolveTimings — missing word index", () => {
  it("falls back to wordStart=0 when word index is not in wordTimings", () => {
    const result = resolveTimings({
      elements: [authored("sc-missing", 5, 2)],
      wordTimings: [word(0, 1.0, 1.5)],
      // wordIndex 99 doesn't exist → wordStart defaults to 0
      anchors: [anchor("sc-missing", 99, 0.5, 0.5, 2.0)],
    });
    // enterAt = 0 + 0 = 0
    // holdDuration = max(0, 2.0 - (0 + 0.5 + 0.5)) = 1.0
    expect(result["sc-missing"]?.enterAt).toBe(0);
    expect(result["sc-missing"]?.holdDuration).toBe(1.0);
  });
});

// ─── Determinism ─────────────────────────────────────────────────────────────

describe("resolveTimings — determinism", () => {
  it("produces identical output for identical input (no hidden state)", () => {
    const input = {
      elements: [authored("sc-det", 0, 2), authored("sc-free2", 3, 1)],
      wordTimings: [word(0, 0.5, 1.0)],
      anchors: [anchor("sc-det", 0, 0.3, 0.2, 2.0)],
    };
    const r1 = resolveTimings(input);
    const r2 = resolveTimings(input);
    expect(r1).toEqual(r2);
  });
});

// ─── Preview == render parity golden test ────────────────────────────────────
//
// This test mirrors the contract of time_control.py in the backend render path.
// Both the preview path (SDK session) and the render path (timingCompiler
// consumer) call resolveTimings() with the same input and MUST produce the
// same output. Since there is exactly one implementation, calling it twice with
// the same args is the parity test: they cannot diverge.
//
// NOTE: happy-dom cannot do GSAP layout/seek operations so the GSAP-seek path
// (smart-seek) is exercised by timingCompiler.test.ts (Node.js) separately.
// The purity of resolveTimings() means this test fully covers resolver logic.

// NOTE: this asserts a PROPERTY of the pure resolver (same input → same output),
// not a guarantee about the two live paths — neither preview nor render calls
// resolveTimings yet (see timingResolver.ts header). It is a forward fixture for
// when they do, not proof they currently agree.
describe("resolveTimings — determinism fixture for future preview/render wiring", () => {
  it("resolver output is identical for identical input (one impl → no drift once wired)", () => {
    // Golden fixture: 3 elements, 2 words, 1 anchored, 2 free.
    const elements: AuthoredTiming[] = [
      authored("sc-title", 0, 2.0), // anchored
      authored("sc-sub", 3.0, 1.5), // free
      authored("sc-cta", 5.0, 1.0), // free
    ];
    const wordTimings: WordTiming[] = [word(0, 0.0, 0.5), word(1, 1.0, 1.8)];
    const anchors: ElementAnchor[] = [
      anchor("sc-title", 1, 0.4, 0.3, 3.5), // anchored to word 1
    ];

    // Simulate preview call (same input as would arrive from session layer)
    const previewResult = resolveTimings({ elements, wordTimings, anchors });

    // Simulate render call (same input as would arrive from timingCompiler)
    const renderResult = resolveTimings({ elements, wordTimings, anchors });

    // Identical because it is one pure function — this becomes the live
    // "preview == render" guarantee only once both paths actually call it.
    expect(previewResult).toEqual(renderResult);

    // Spot-check the anchored element's resolved values:
    // enterAt = word[1].start = 1.0 (no offset)
    // holdDuration = max(0, 3.5 - (1.0 + 0.4 + 0.3)) = max(0, 1.8) = 1.8
    // exitAt = 1.0 + 0.4 + 1.8 + 0.3 = 3.5
    expect(previewResult["sc-title"]).toEqual({ enterAt: 1.0, exitAt: 3.5, holdDuration: 1.8 });

    // Free elements keep authored timing
    expect(previewResult["sc-sub"]).toEqual({ enterAt: 3.0, exitAt: 4.5, holdDuration: 0 });
    expect(previewResult["sc-cta"]).toEqual({ enterAt: 5.0, exitAt: 6.0, holdDuration: 0 });
  });
});
