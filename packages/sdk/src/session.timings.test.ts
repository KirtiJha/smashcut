// fallow-ignore-file code-duplication
/**
 * WS-C — getElementTimings / setElementTiming / setHold tests.
 *
 * Tests the session-layer wiring for the new typed methods.
 * happy-dom can't do GSAP seek/layout so we test DOM attribute reads and
 * dispatch behavior directly.
 */

import { describe, it, expect } from "vitest";
import { openComposition } from "./session.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

/** Duration-authored clip (data-duration preferred by handleSetTiming). */
const DURATION_AUTHORED_HTML = `
<div data-sc-id="sc-stage" data-sc-root style="width:1280px;height:720px" data-duration="10">
  <h1 data-sc-id="sc-title" data-start="0" data-duration="3">Hello</h1>
  <p  data-sc-id="sc-sub"   data-start="2" data-duration="2">World</p>
</div>
`.trim();

/** End-authored clip (data-end only, no data-duration). */
const END_AUTHORED_HTML = `
<div data-sc-id="sc-stage" data-sc-root style="width:1280px;height:720px" data-duration="10">
  <h1 data-sc-id="sc-title" data-start="1" data-end="4">Hello</h1>
</div>
`.trim();

/** Both data-duration and data-end (data-duration wins). */
const BOTH_ATTRS_HTML = `
<div data-sc-id="sc-stage" data-sc-root style="width:1280px;height:720px" data-duration="10">
  <h1 data-sc-id="sc-title" data-start="0" data-duration="3" data-end="99">Hello</h1>
</div>
`.trim();

/** Has a GSAP script with addLabel. */
const GSAP_LABEL_HTML = `
<div data-sc-id="sc-stage" data-sc-root style="width:1280px;height:720px">
  <div data-sc-id="sc-box" data-start="0" data-duration="5" style="opacity:0"></div>
  <script>var tl = gsap.timeline({ paused: true });
tl.to("[data-sc-id=\\"sc-box\\"]", { opacity: 1, duration: 1 }, 0);
tl.addLabel("intro", 0.5);
tl.addLabel("outro", 4.0);
window.__timelines = { t: tl };</script>
</div>
`.trim();

const GSAP_TEMPLATE_LABEL_HTML = `
<div data-sc-id="sc-stage" data-sc-root style="width:1280px;height:720px">
  <template data-composition-id="label-sub-comp">
    <div data-sc-id="sc-box" data-start="0" data-duration="5"></div>
    <script>
      var tl = gsap.timeline({ paused: true });
      tl.addLabel("template-label", 1.5);
      window.__timelines = { t: tl };
    </script>
  </template>
</div>
`.trim();

// ─── getElementTimings — duration-authored clips ──────────────────────────────

describe("getElementTimings — duration-authored clips", () => {
  it("reads enterAt = data-start, exitAt = data-start + data-duration", async () => {
    const comp = await openComposition(DURATION_AUTHORED_HTML);
    const timings = comp.getElementTimings();

    expect(timings["sc-title"]).toMatchObject({ enterAt: 0, exitAt: 3 });
    expect(timings["sc-sub"]).toMatchObject({ enterAt: 2, exitAt: 4 });
  });

  it("returns empty labels array when no GSAP script", async () => {
    const comp = await openComposition(DURATION_AUTHORED_HTML);
    const timings = comp.getElementTimings();
    expect(timings["sc-title"]?.labels).toEqual([]);
  });
});

// ─── getElementTimings — end-authored clips ───────────────────────────────────

describe("getElementTimings — end-authored clips", () => {
  it("falls back to data-end − data-start when no data-duration", async () => {
    const comp = await openComposition(END_AUTHORED_HTML);
    const timings = comp.getElementTimings();

    // enterAt = 1, exitAt = 4 (from data-end = 4, data-start = 1, duration = 3)
    expect(timings["sc-title"]).toMatchObject({ enterAt: 1, exitAt: 4 });
  });
});

// ─── getElementTimings — data-duration wins over data-end ────────────────────

describe("getElementTimings — data-duration wins over data-end", () => {
  it("uses data-duration when both data-duration and data-end are present", async () => {
    const comp = await openComposition(BOTH_ATTRS_HTML);
    const timings = comp.getElementTimings();

    // data-duration=3 wins; exitAt = 0+3=3, NOT from data-end=99
    expect(timings["sc-title"]).toMatchObject({ enterAt: 0, exitAt: 3 });
  });
});

// ─── getElementTimings — labels from GSAP script ─────────────────────────────

describe("getElementTimings — GSAP labels", () => {
  it("returns labels whose position falls within [enterAt, exitAt]", async () => {
    const comp = await openComposition(GSAP_LABEL_HTML);
    const timings = comp.getElementTimings();

    // sc-box: enterAt=0, exitAt=5; labels "intro"@0.5 and "outro"@4.0 are both in range
    const box = timings["sc-box"];
    expect(box?.labels).toContain("intro");
    expect(box?.labels).toContain("outro");
  });

  it("parses labels fresh — no stale cache after mutation", async () => {
    const comp = await openComposition(GSAP_LABEL_HTML);

    const before = comp.getElementTimings()["sc-box"]?.labels ?? [];
    expect(before).toContain("intro");

    // Move the element so timing changes; labels should still parse fresh
    comp.setTiming("sc-box", { start: 0, duration: 5 }); // no-op but triggers re-parse
    const after = comp.getElementTimings()["sc-box"]?.labels ?? [];
    expect(after).toContain("intro");
  });

  it("reads labels from GSAP scripts inside composition templates", async () => {
    const comp = await openComposition(GSAP_TEMPLATE_LABEL_HTML);
    const labels = comp.getElementTimings()["sc-box"]?.labels ?? [];

    expect(labels).toContain("template-label");
  });
});

// ─── getElementTimings — relative data-start references ──────────────────────

/** "intro" starts at data-start=1 for 3s (ends at 4). "outro" starts 2s after intro ends. */
const RELATIVE_START_HTML = `
<div data-sc-id="sc-stage" data-sc-root style="width:1280px;height:720px" data-duration="20">
  <h1 data-sc-id="sc-intro" data-start="1" data-duration="3">Intro</h1>
  <p  data-sc-id="sc-outro" data-start="sc-intro + 2" data-duration="4">Outro</p>
  <p  data-sc-id="sc-right-after" data-start="sc-intro" data-duration="1">Right after</p>
</div>
`.trim();

describe("getElementTimings — relative data-start references", () => {
  it("resolves 'ref + offset' against the referenced element's resolved end", async () => {
    const comp = await openComposition(RELATIVE_START_HTML);
    const timings = comp.getElementTimings();

    // sc-intro: enterAt=1, exitAt=4
    expect(timings["sc-intro"]).toMatchObject({ enterAt: 1, exitAt: 4 });
    // sc-outro: "sc-intro + 2" = intro's exitAt (4) + 2 = 6
    expect(timings["sc-outro"]).toMatchObject({ enterAt: 6, exitAt: 10 });
  });

  it("resolves a bare reference (no offset) to the referenced element's exitAt", async () => {
    const comp = await openComposition(RELATIVE_START_HTML);
    const timings = comp.getElementTimings();
    expect(timings["sc-right-after"]).toMatchObject({ enterAt: 4, exitAt: 5 });
  });

  it("resolves to 0 (not NaN) when the reference target doesn't exist", async () => {
    const html = `
      <div data-sc-id="sc-stage" data-sc-root style="width:1280px;height:720px">
        <p data-sc-id="sc-orphan" data-start="sc-nonexistent + 5" data-duration="2"></p>
      </div>
    `.trim();
    const comp = await openComposition(html);
    const timings = comp.getElementTimings();
    expect(timings["sc-orphan"]).toMatchObject({ enterAt: 0, exitAt: 2 });
  });

  it("resolves a chained reference (A -> B -> C) through the recursive resolver", async () => {
    const html = `
      <div data-sc-id="sc-stage" data-sc-root style="width:1280px;height:720px">
        <h1 data-sc-id="sc-a" data-start="0" data-duration="2">A</h1>
        <p  data-sc-id="sc-b" data-start="sc-a" data-duration="3">B</p>
        <p  data-sc-id="sc-c" data-start="sc-b + 1" data-duration="1">C</p>
      </div>
    `.trim();
    const comp = await openComposition(html);
    const timings = comp.getElementTimings();

    expect(timings["sc-a"]).toMatchObject({ enterAt: 0, exitAt: 2 });
    // sc-b: "sc-a" (no offset) = a's exitAt (2)
    expect(timings["sc-b"]).toMatchObject({ enterAt: 2, exitAt: 5 });
    // sc-c: "sc-b + 1" = b's exitAt (5) + 1 = 6
    expect(timings["sc-c"]).toMatchObject({ enterAt: 6, exitAt: 7 });
  });

  it("terminates (not an infinite loop) on a direct self-reference", async () => {
    const html = `
      <div data-sc-id="sc-stage" data-sc-root style="width:1280px;height:720px">
        <p data-sc-id="sc-self" data-start="sc-self" data-duration="2"></p>
      </div>
    `.trim();
    const comp = await openComposition(html);
    const timings = comp.getElementTimings();
    // Cyclic references are invalid. The shared contract leaves the reference
    // unresolved and this snapshot adapter applies its documented zero fallback.
    expect(timings["sc-self"]).toMatchObject({ enterAt: 0, exitAt: 2 });
    expect(Number.isFinite(timings["sc-self"]?.enterAt)).toBe(true);
  });

  it("terminates (not an infinite loop) on a mutual A <-> B reference cycle", async () => {
    const html = `
      <div data-sc-id="sc-stage" data-sc-root style="width:1280px;height:720px">
        <p data-sc-id="sc-a" data-start="sc-b" data-duration="2"></p>
        <p data-sc-id="sc-b" data-start="sc-a" data-duration="3"></p>
      </div>
    `.trim();
    const comp = await openComposition(html);
    const timings = comp.getElementTimings();
    // Both invalid starts get the same deterministic fallback; results no
    // longer depend on document traversal order.
    expect(timings["sc-a"]).toMatchObject({ enterAt: 0, exitAt: 2 });
    expect(timings["sc-b"]).toMatchObject({ enterAt: 0, exitAt: 3 });
    expect(Number.isFinite(timings["sc-a"]?.enterAt)).toBe(true);
    expect(Number.isFinite(timings["sc-b"]?.enterAt)).toBe(true);
  });

  it("resolves a colliding bare id to the TOP-LEVEL match, not a same-scope sibling", async () => {
    // Bare ids have no scope syntax — resolveScoped's bare-id rule prefers the
    // canonical top-level match when one exists, same as the runtime's own (also
    // global, not scope-aware) resolver. Both the outer document AND the sub-comp
    // author an element with the SAME bare id "sc-intro" — a genuine collision.
    const html = `
      <!DOCTYPE html><html><body>
        <h1 data-sc-id="sc-intro" data-start="0" data-duration="10">Outer intro</h1>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <h1 data-sc-id="sc-intro" data-start="0" data-duration="1">Inner intro (same bare id)</h1>
          <p data-sc-id="sc-outro" data-start="sc-intro + 1" data-duration="1">Inner outro</p>
        </div>
      </body></html>
    `.trim();
    const comp = await openComposition(html);
    const timings = comp.getElementTimings();
    // "sc-intro + 1", authored on an element INSIDE the sub-comp, still resolves
    // against the OUTER sc-intro (exitAt=10) — 10 + 1 = 11 — not the same-scope
    // inner sc-intro (exitAt=1, which would give 2). This pins current behavior;
    // it is a real authoring footgun, not a claim that it's the ideal semantics.
    expect(timings["sc-host/sc-outro"]).toMatchObject({ enterAt: 11, exitAt: 12 });
  });
});

// ─── setElementTiming — sparse map + batched dispatch ────────────────────────

describe("setElementTiming", () => {
  it("applies sparse timing map to multiple elements", async () => {
    const comp = await openComposition(DURATION_AUTHORED_HTML);

    comp.setElementTiming({
      "sc-title": { start: 1, duration: 2 },
      "sc-sub": { start: 4 },
    });

    const timings = comp.getElementTimings();
    expect(timings["sc-title"]).toMatchObject({ enterAt: 1, exitAt: 3 });
    expect(timings["sc-sub"]).toMatchObject({ enterAt: 4 });
  });

  it("emits exactly one patch event for multiple entries (batched)", async () => {
    const comp = await openComposition(DURATION_AUTHORED_HTML);
    const patches: unknown[] = [];
    comp.on("patch", (e) => patches.push(e));

    comp.setElementTiming({
      "sc-title": { start: 0.5 },
      "sc-sub": { start: 3.0 },
    });

    // One batch → one patch event
    expect(patches).toHaveLength(1);
  });

  it("is a no-op for empty map", async () => {
    const comp = await openComposition(DURATION_AUTHORED_HTML);
    const patches: unknown[] = [];
    comp.on("patch", (e) => patches.push(e));

    comp.setElementTiming({});
    expect(patches).toHaveLength(0);
  });

  it("respects data-duration vs data-end preference on write", async () => {
    const comp = await openComposition(DURATION_AUTHORED_HTML);

    // Before: sc-title has data-duration=3, data-start=0
    comp.setElementTiming({ "sc-title": { duration: 5 } });

    const timings = comp.getElementTimings();
    // Should read back the new duration
    expect(timings["sc-title"]).toMatchObject({ exitAt: 5 });
  });

  it("can be undone as a single step", async () => {
    const comp = await openComposition(DURATION_AUTHORED_HTML);

    const before = comp.getElementTimings()["sc-title"];

    comp.setElementTiming({ "sc-title": { start: 2 } });
    comp.undo();

    const after = comp.getElementTimings()["sc-title"];
    expect(after?.enterAt).toBe(before?.enterAt);
  });

  it("setElementTiming inverse restores original timing", async () => {
    const comp = await openComposition(DURATION_AUTHORED_HTML);
    const originalTimings = comp.getElementTimings();

    comp.setElementTiming({
      "sc-title": { start: 10, duration: 1 },
      "sc-sub": { start: 12, duration: 1 },
    });
    comp.undo();

    const restored = comp.getElementTimings();
    expect(restored["sc-title"]).toEqual(originalTimings["sc-title"]);
    expect(restored["sc-sub"]).toEqual(originalTimings["sc-sub"]);
  });
});

// ─── setHold — typed wrapper ──────────────────────────────────────────────────

describe("setHold — typed method", () => {
  it("dispatches the setHold op (regression: existing op unchanged)", async () => {
    const comp = await openComposition(DURATION_AUTHORED_HTML);
    const patches: unknown[] = [];
    comp.on("patch", (e) => patches.push(e));

    comp.setHold("sc-title", { start: 0.5, end: 2.5, fill: "freeze" });

    // Should emit a patch
    expect(patches).toHaveLength(1);
  });

  it("setHold writes data-hold-start / data-hold-end / data-hold-fill attrs", async () => {
    const comp = await openComposition(DURATION_AUTHORED_HTML);

    comp.setHold("sc-title", { start: 1.0, end: 2.0, fill: "loop" });

    // Verify via serialize (attrs are in the HTML output)
    const html = comp.serialize();
    expect(html).toContain('data-hold-start="1"');
    expect(html).toContain('data-hold-end="2"');
    expect(html).toContain('data-hold-fill="loop"');
  });

  it("setHold typed method equals dispatch({type:setHold})", async () => {
    // Run typed method path
    const comp1 = await openComposition(DURATION_AUTHORED_HTML);
    comp1.setHold("sc-title", { start: 0.5, end: 2.5, fill: "freeze" });
    const html1 = comp1.serialize();

    // Run raw dispatch path
    const comp2 = await openComposition(DURATION_AUTHORED_HTML);
    comp2.dispatch({
      type: "setHold",
      target: "sc-title",
      hold: { start: 0.5, end: 2.5, fill: "freeze" },
    });
    const html2 = comp2.serialize();

    expect(html1).toBe(html2);
  });
});
