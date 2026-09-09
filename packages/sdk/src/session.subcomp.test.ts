/**
 * T-contract: sub-composition scoped id suite (Stage 6 / F9).
 *
 * All tests use pre-inlined HTML (flat DOM with data-composition-file boundaries)
 * because the SDK only opens pre-inlined HTML — sub-comp loading is not the SDK's job.
 *
 * Boundary detection rule: an element is a host (starts a new scope) when it has
 * data-composition-file AND its value differs from its parent's data-composition-file.
 * This correctly handles the outerHTML innerRoot case (same dcf as parent → not a new host)
 * and nested hosts (different dcf from parent → new host).
 */

import { describe, it, expect } from "vitest";
import { parseHTML } from "linkedom";
import { ensureHfIds } from "@smashcut/core/sc-ids";
import { RUNTIME_BOOTSTRAP_ATTR } from "@smashcut/core";
import { resolveScoped, findById, isNewHostBoundary, bareId } from "./engine/model.js";
import { parseMutable } from "./engine/model.js";
import { buildRoots, flatElements } from "./document.js";
import { openComposition } from "./session.js";

// ─── Fixture helpers ──────────────────────────────────────────────────────────

/** Build a flat inlined HTML string simulating what inlineSubCompositions produces. */
function inlinedHtml(inner: string): string {
  return `<!DOCTYPE html><html><body>${inner}</body></html>`;
}

/** Stamp sc-ids and return a linkedom document (same as parseMutable's path). */
function makeDoc(html: string) {
  const { document } = parseHTML(ensureHfIds(html));
  return document;
}

// ─── 1. resolveScoped ─────────────────────────────────────────────────────────

describe("resolveScoped — flat id", () => {
  it("resolves a bare id at top level (same as findById)", () => {
    const doc = makeDoc(
      `<!DOCTYPE html><html><body><div data-sc-id="sc-aaaa">hi</div></body></html>`,
    );
    const el = resolveScoped(doc as unknown as Document, "sc-aaaa");
    expect(el).not.toBeNull();
    expect(el?.getAttribute("data-sc-id")).toBe("sc-aaaa");
  });

  it("returns null for a missing bare id", () => {
    const doc = makeDoc(
      `<!DOCTYPE html><html><body><div data-sc-id="sc-aaaa"></div></body></html>`,
    );
    expect(resolveScoped(doc as unknown as Document, "sc-xxxx")).toBeNull();
  });

  // A sub-composition ROOT is addressed by its composition id. When no element
  // carries that as a data-sc-id, fall back to [data-composition-id]: comp-ids
  // become first-class resolvable addresses (fixes validate / getElement).
  it("resolves a bare id to a sub-comp root via data-composition-id fallback", () => {
    const doc = makeDoc(
      `<!DOCTYPE html><html><body><div data-sc-id="sc-host" data-composition-id="sub-1"></div></body></html>`,
    ) as unknown as Document;
    const viaComp = resolveScoped(doc, "sub-1");
    const viaHf = resolveScoped(doc, "sc-host");
    expect(viaComp).not.toBeNull();
    expect(viaComp?.getAttribute("data-sc-id")).toBe("sc-host");
    // Both addresses resolve to the SAME host element.
    expect(viaComp).toBe(viaHf);
  });

  // data-sc-id MUST take precedence: a bare id that matches a real data-sc-id
  // never falls back to data-composition-id, even if some other element carries
  // that string as its composition id.
  it("data-sc-id takes precedence over data-composition-id for a bare id", () => {
    const doc = makeDoc(
      `<!DOCTYPE html><html><body>
        <div data-sc-id="dup" class="byHfId"></div>
        <div data-sc-id="sc-host" data-composition-id="dup" class="byCompId"></div>
      </body></html>`,
    ) as unknown as Document;
    const el = resolveScoped(doc, "dup");
    expect(el?.getAttribute("class")).toBe("byHfId");
  });

  // Regression: findById is the patch-replay/undo resolver. It must agree with
  // resolveScoped (forward dispatch) on an ambiguous bare id — both pick the
  // canonical (top-level) instance — or undo reverts the wrong duplicate.
  it("findById resolves an ambiguous bare id to the canonical instance (== resolveScoped)", () => {
    const doc = makeDoc(
      inlinedHtml(`
      <div data-sc-id="sc-host" data-composition-file="sub.html">
        <p data-sc-id="sc-dup" class="inside">inside</p>
      </div>
      <p data-sc-id="sc-dup" class="outside">outside</p>
    `),
    ) as unknown as Document;
    const viaFind = findById(doc, "sc-dup");
    const viaResolve = resolveScoped(doc, "sc-dup");
    expect(viaFind).toBe(viaResolve);
    expect(viaFind?.getAttribute("class")).toBe("outside");
  });
});

describe("resolveScoped — scoped id", () => {
  it("resolves hf-HOST/hf-LEAF inside the host's subtree", () => {
    // Simulated post-inline structure: host has data-composition-file
    const doc = makeDoc(
      inlinedHtml(`
      <div data-sc-id="sc-host" data-composition-file="sub.html">
        <p data-sc-id="sc-leaf">text</p>
      </div>
    `),
    );
    const el = resolveScoped(doc as unknown as Document, "sc-host/sc-leaf");
    expect(el?.getAttribute("data-sc-id")).toBe("sc-leaf");
    expect(el?.textContent?.trim()).toBe("text");
  });

  it("does NOT match a leaf outside the host when ids collide", () => {
    // Two elements with the same sc-id — one inside host, one outside.
    // resolveScoped must return the one INSIDE the host.
    const doc = makeDoc(
      inlinedHtml(`
      <div data-sc-id="sc-host" data-composition-file="sub.html">
        <p data-sc-id="sc-dup" class="inside">inside</p>
      </div>
      <p data-sc-id="sc-dup" class="outside">outside</p>
    `),
    );
    const el = resolveScoped(doc as unknown as Document, "sc-host/sc-dup");
    expect(el?.getAttribute("class")).toBe("inside");
  });

  it("resolves 3-level nesting hf-H1/hf-H2/sc-leaf", () => {
    const doc = makeDoc(
      inlinedHtml(`
      <div data-sc-id="sc-h1" data-composition-file="sub1.html">
        <div data-sc-id="sc-h2" data-composition-file="sub2.html">
          <span data-sc-id="sc-leaf">deep</span>
        </div>
      </div>
    `),
    );
    const el = resolveScoped(doc as unknown as Document, "sc-h1/sc-h2/sc-leaf");
    expect(el?.getAttribute("data-sc-id")).toBe("sc-leaf");
    expect(el?.textContent?.trim()).toBe("deep");
  });

  it("returns null when the first segment is not found", () => {
    const doc = makeDoc(
      inlinedHtml(`<div data-sc-id="sc-other"><p data-sc-id="sc-leaf"></p></div>`),
    );
    expect(resolveScoped(doc as unknown as Document, "sc-host/sc-leaf")).toBeNull();
  });

  it("returns null when the leaf is not found inside the host", () => {
    const doc = makeDoc(
      inlinedHtml(`
      <div data-sc-id="sc-host" data-composition-file="sub.html">
        <p data-sc-id="sc-other">text</p>
      </div>
    `),
    );
    expect(resolveScoped(doc as unknown as Document, "sc-host/sc-leaf")).toBeNull();
  });
});

// ─── 2. ElementSnapshot.scopedId via buildRoots ───────────────────────────────

describe("ElementSnapshot.scopedId", () => {
  it("top-level element has scopedId equal to its bare id", () => {
    const parsed = parseMutable(
      `<div data-sc-id="sc-root" data-sc-root><p data-sc-id="sc-p">hi</p></div>`,
    );
    const elements = flatElements(buildRoots(parsed.document));
    const p = elements.find((e) => e.id === "sc-p");
    expect(p?.scopedId).toBe("sc-p");
  });

  it("element inside sub-comp gets hf-HOST/hf-LEAF scopedId", () => {
    const parsed = parseMutable(
      inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-leaf">text</p>
        </div>
      </div>
    `),
    );
    const elements = flatElements(buildRoots(parsed.document));
    const leaf = elements.find((e) => e.id === "sc-leaf");
    expect(leaf?.scopedId).toBe("sc-host/sc-leaf");
  });

  it("host element itself has bare scopedId (it lives in parent scope)", () => {
    const parsed = parseMutable(
      inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-leaf">text</p>
        </div>
      </div>
    `),
    );
    const elements = flatElements(buildRoots(parsed.document));
    const host = elements.find((e) => e.id === "sc-host");
    expect(host?.scopedId).toBe("sc-host");
  });

  it("3-level nesting produces hf-H1/hf-H2/hf-LEAF", () => {
    const parsed = parseMutable(
      inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-h1" data-composition-file="sub1.html">
          <div data-sc-id="sc-h2" data-composition-file="sub2.html">
            <span data-sc-id="sc-leaf">deep</span>
          </div>
        </div>
      </div>
    `),
    );
    const elements = flatElements(buildRoots(parsed.document));
    const leaf = elements.find((e) => e.id === "sc-leaf");
    expect(leaf?.scopedId).toBe("sc-h1/sc-h2/sc-leaf");
  });

  it("same sub-comp mounted twice gets different scopedIds", () => {
    // sc-x exists in both mounts — different host ids disambiguate
    const parsed = parseMutable(
      inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-mount-a" data-composition-file="sub.html">
          <p data-sc-id="sc-x" class="in-a">A</p>
        </div>
        <div data-sc-id="sc-mount-b" data-composition-file="sub.html">
          <p data-sc-id="sc-x" class="in-b">B</p>
        </div>
      </div>
    `),
    );
    const elements = flatElements(buildRoots(parsed.document));
    const xs = elements.filter((e) => e.id === "sc-x");
    const scopedIds = xs.map((e) => e.scopedId);
    expect(scopedIds).toContain("sc-mount-a/sc-x");
    expect(scopedIds).toContain("sc-mount-b/sc-x");
    expect(new Set(scopedIds).size).toBe(2);
  });

  it("outerHTML innerRoot (same dcf as parent) is NOT itself a new host boundary", () => {
    // outerHTML case: host and innerRoot both get data-composition-file="sub.html"
    const parsed = parseMutable(
      inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <div data-sc-id="sc-inner" data-composition-id="my-sub" data-composition-file="sub.html">
            <p data-sc-id="sc-leaf">text</p>
          </div>
        </div>
      </div>
    `),
    );
    const elements = flatElements(buildRoots(parsed.document));
    const leaf = elements.find((e) => e.id === "sc-leaf");
    // Leaf should be scoped under sc-host, not sc-host/sc-inner
    expect(leaf?.scopedId).toBe("sc-host/sc-leaf");
  });
});

// ─── 3. Dispatch to scoped target ─────────────────────────────────────────────

describe("dispatch — scoped target", () => {
  it("setStyle with scoped id mutates the correct element when id collides", async () => {
    // Both host subtree and sibling have an element sc-x — scoped target must hit the right one
    const html = inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-x">inside</p>
        </div>
        <p data-sc-id="sc-x">outside</p>
      </div>
    `);
    const comp = await openComposition(html);
    comp.setStyle("sc-host/sc-x", { color: "red" });

    const inside = comp.getElement("sc-host/sc-x");
    const outside = comp.getElement("sc-x");
    expect(inside?.inlineStyles.color).toBe("red");
    // Outside element should be unchanged
    expect(outside?.inlineStyles.color).toBeUndefined();
  });

  it("dispatch emits scoped id in patch path", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-leaf">text</p>
        </div>
      </div>
    `);
    const comp = await openComposition(html);
    const patches: string[] = [];
    comp.on("patch", (e) => {
      patches.push(...e.patches.map((p) => p.path));
    });
    comp.setStyle("sc-host/sc-leaf", { color: "blue" });
    // Patch path should encode the scoped id with RFC 6902 escaping (/ → ~1)
    expect(patches.some((p) => p.includes("sc-host~1hf-leaf"))).toBe(true);
  });

  it("getElement by scopedId returns the correct snapshot", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-leaf">inside text</p>
        </div>
      </div>
    `);
    const comp = await openComposition(html);
    const el = comp.getElement("sc-host/sc-leaf");
    expect(el).not.toBeNull();
    expect(el?.text).toBe("inside text");
  });

  it("find() returns scopedIds for sub-comp elements", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-leaf" class="target">inside</p>
        </div>
        <p data-sc-id="sc-outer" class="target">outside</p>
      </div>
    `);
    const comp = await openComposition(html);
    const ids = comp.find({ tag: "p" });
    expect(ids).toContain("sc-host/sc-leaf");
    expect(ids).toContain("sc-outer");
  });
});

// ─── 3b. Comp-root GSAP tween attribution ─────────────────────────────────────

describe("sub-comp root GSAP tween — canonical sc-id attribution", () => {
  it("getElement(host).animationIds includes a tween added by comp-id target", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-id="sub-1" data-composition-file="sub.html">
          <p data-sc-id="sc-leaf">text</p>
        </div>
        <script>var tl = gsap.timeline({ paused: true });
window.__timelines = { t: tl };</script>
      </div>
    `);
    const comp = await openComposition(html);
    // Target the sub-comp ROOT by its composition id.
    const animId = comp.addGsapTween("sub-1", {
      method: "to",
      duration: 0.3,
      properties: { x: 200 },
    });
    // The tween is filed under the host's own data-sc-id (canonical form), so
    // it surfaces on the host element snapshot.
    const host = comp.getElement("sc-host");
    expect(host?.animationIds).toContain(animId);
  });
});

// ─── 4. Override-set keys for scoped ids ──────────────────────────────────────

describe("override-set — scoped id keys", () => {
  it("setStyle on scoped id produces scoped key in getOverrides()", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-leaf">text</p>
        </div>
      </div>
    `);
    const comp = await openComposition(html);
    comp.setStyle("sc-host/sc-leaf", { color: "green" });
    const overrides = comp.getOverrides();
    expect(overrides["sc-host/sc-leaf.style.color"]).toBe("green");
  });

  it("removeElement on host purges all sub-comp keys from override-set", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-leaf">text</p>
        </div>
      </div>
    `);
    const comp = await openComposition(html);
    comp.setStyle("sc-host/sc-leaf", { color: "green" });
    comp.removeElement("sc-host");
    const overrides = comp.getOverrides();
    // Removal marker for host is preserved (null); scoped property sub-keys are purged
    expect(overrides["sc-host"]).toBeNull();
    expect(
      Object.keys(overrides).some((k) => k.startsWith("sc-host/") || k.startsWith("sc-host.")),
    ).toBe(false);
  });
});

// ─── 5. find({ composition }) filter ─────────────────────────────────────────

describe("find({ composition })", () => {
  it("returns elements inside the named host sub-composition", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-leaf">inside</p>
        </div>
        <p data-sc-id="sc-outer">outside</p>
      </div>
    `);
    const comp = await openComposition(html);
    const ids = comp.find({ composition: "sc-host" });
    expect(ids).toContain("sc-host/sc-leaf");
    expect(ids).not.toContain("sc-outer");
    expect(ids).not.toContain("sc-host"); // host itself is in parent scope
  });

  it("returns empty array for unknown host id", async () => {
    const html = inlinedHtml(
      `<div data-sc-id="sc-root" data-sc-root><p data-sc-id="sc-p">x</p></div>`,
    );
    const comp = await openComposition(html);
    expect(comp.find({ composition: "sc-no-such" })).toEqual([]);
  });

  it("can combine composition filter with other query fields", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-a">match</p>
          <span data-sc-id="sc-b">no</span>
        </div>
      </div>
    `);
    const comp = await openComposition(html);
    const ids = comp.find({ composition: "sc-host", tag: "p" });
    expect(ids).toEqual(["sc-host/sc-a"]);
  });
});

// ─── 5b. Ambiguous bare id: removeElement / getElement agreement ──────────────

describe("ambiguous bare id — removeElement and getElement agree", () => {
  // Inner sub-comp dup appears FIRST in document order; the canonical top-level
  // dup appears AFTER it. querySelector document-order would return the inner one,
  // but getElement prefers the canonical (top-level) match. The two APIs must agree.
  const ambiguousHtml = () =>
    inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-dup" class="inner">inner</p>
        </div>
        <p data-sc-id="sc-dup" class="outer">outer</p>
      </div>
    `);

  it("bare id resolves to the canonical (top-level) instance, matching getElement", async () => {
    const comp = await openComposition(ambiguousHtml());

    // getElement prefers the canonical match (scopedId === id) → top-level "outer".
    const got = comp.getElement("sc-dup");
    expect(got?.scopedId).toBe("sc-dup");
    expect(got?.classNames).toContain("outer");

    // removeElement(bareId) must remove the SAME instance getElement returned.
    comp.removeElement("sc-dup");

    // The canonical top-level instance is gone — getElement(bareId) no longer
    // finds it (and does NOT silently fall through to the inner sub-comp dup).
    expect(comp.getElement("sc-dup")).toBeNull();

    // The inner instance survives, addressable only via its fully-scoped path.
    const inner = comp.getElement("sc-host/sc-dup");
    expect(inner?.classNames).toContain("inner");
  });

  it("fully-scoped path still targets the inner instance exactly", async () => {
    const comp = await openComposition(ambiguousHtml());
    comp.removeElement("sc-host/sc-dup");

    // Inner gone; canonical top-level survives.
    const inner = comp.getElement("sc-host/sc-dup");
    expect(inner).toBeNull();
    const top = comp.getElement("sc-dup");
    expect(top?.scopedId).toBe("sc-dup");
    expect(top?.classNames).toContain("outer");
  });

  it("non-duplicated bare id still resolves and removes normally", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-leaf">inside</p>
        </div>
        <p data-sc-id="sc-solo">solo</p>
      </div>
    `);
    const comp = await openComposition(html);
    expect(comp.getElement("sc-solo")?.scopedId).toBe("sc-solo");
    comp.removeElement("sc-solo");
    expect(comp.getElement("sc-solo")).toBeNull();
  });
});

// ─── 6. Scoped id stability across serialize ──────────────────────────────────

describe("scopedId stability across serialize/re-parse", () => {
  it("scopedId values are identical after serialize + re-open", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-root" data-sc-root>
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <p data-sc-id="sc-leaf">text</p>
        </div>
        <p data-sc-id="sc-outer">outer</p>
      </div>
    `);
    const comp1 = await openComposition(html);
    const serialized = comp1.serialize();
    const comp2 = await openComposition(serialized);

    const ids1 = comp1
      .getElements()
      .map((e) => e.scopedId)
      .sort();
    const ids2 = comp2
      .getElements()
      .map((e) => e.scopedId)
      .sort();
    expect(ids1).toEqual(ids2);
  });
});

// ─── 7. isNewHostBoundary ──────────────────────────────────────────────────────

describe("isNewHostBoundary", () => {
  it("is true for a host with no ancestor dcf (top-level sub-comp host)", () => {
    const doc = makeDoc(
      inlinedHtml(`<div data-sc-id="sc-host" data-composition-file="sub.html"></div>`),
    ) as unknown as Document;
    const host = doc.querySelector('[data-sc-id="sc-host"]') as unknown as Element;
    expect(isNewHostBoundary(host)).toBe(true);
  });

  it("is false for an element with no data-composition-file at all", () => {
    const doc = makeDoc(inlinedHtml(`<div data-sc-id="sc-plain"></div>`)) as unknown as Document;
    const el = doc.querySelector('[data-sc-id="sc-plain"]') as unknown as Element;
    expect(isNewHostBoundary(el)).toBe(false);
  });

  it("is false for the outerHTML innerRoot (same dcf value as its host parent)", () => {
    const doc = makeDoc(
      inlinedHtml(`
        <div data-sc-id="sc-host" data-composition-file="sub.html">
          <div data-sc-id="sc-inner" data-composition-file="sub.html"></div>
        </div>
      `),
    ) as unknown as Document;
    const inner = doc.querySelector('[data-sc-id="sc-inner"]') as unknown as Element;
    expect(isNewHostBoundary(inner)).toBe(false);
  });

  it("is true for a nested host with a DIFFERENT dcf from its parent", () => {
    const doc = makeDoc(
      inlinedHtml(`
        <div data-sc-id="sc-outer" data-composition-file="outer.html">
          <div data-sc-id="sc-inner-host" data-composition-file="inner.html"></div>
        </div>
      `),
    ) as unknown as Document;
    const innerHost = doc.querySelector('[data-sc-id="sc-inner-host"]') as unknown as Element;
    expect(isNewHostBoundary(innerHost)).toBe(true);
  });
});

// ─── 8. bareId ──────────────────────────────────────────────────────────────────

describe("bareId", () => {
  it("returns the leaf segment of a scoped id", () => {
    expect(bareId("sc-host/sc-leaf")).toBe("sc-leaf");
  });

  it("returns a deeply nested id's leaf segment", () => {
    expect(bareId("sc-a/sc-b/sc-c")).toBe("sc-c");
  });

  it("passes a bare id through unchanged", () => {
    expect(bareId("sc-solo")).toBe("sc-solo");
  });
});

// ─── 9. getRootElements — no descendant duplication ────────────────────────────

describe("getRootElements", () => {
  it("excludes descendants that getElements() also lists as top-level entries", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-panel">
        <h1 data-sc-id="sc-title">Title</h1>
      </div>
      <p data-sc-id="sc-solo">solo</p>
    `);
    const comp = await openComposition(html);

    // getElements() is flat: sc-title appears once nested under sc-panel AND
    // once again as its own top-level entry.
    const flatIds = comp.getElements().map((e) => e.id);
    expect(flatIds).toContain("sc-title");
    expect(flatIds).toContain("sc-panel");

    // getRootElements() only returns true roots — sc-title is not one, since
    // it's sc-panel's descendant.
    const rootIds = comp.getRootElements().map((e) => e.id);
    expect(rootIds).toEqual(["sc-panel", "sc-solo"]);
    expect(comp.getRootElements().find((e) => e.id === "sc-panel")?.children[0]?.id).toBe(
      "sc-title",
    );
  });

  it("treats a sub-composition host as a root even though it has descendants", async () => {
    const html = inlinedHtml(`
      <div data-sc-id="sc-host" data-composition-file="sub.html">
        <p data-sc-id="sc-leaf">inside</p>
      </div>
    `);
    const comp = await openComposition(html);
    expect(comp.getRootElements().map((e) => e.id)).toEqual(["sc-host"]);
  });
});

// ─── 10. serialize({ stripRuntime }) ───────────────────────────────────────────

describe("serialize({ stripRuntime })", () => {
  const RUNTIME_SCRIPT =
    '<script data-smashcut-preview-runtime="1" src="https://cdn.jsdelivr.net/npm/@smashcut/core/dist/smashcut.runtime.iife.js"></script>';

  it("keeps the embedded runtime script by default", async () => {
    const html = `<!DOCTYPE html><html><head>${RUNTIME_SCRIPT}</head><body><div data-sc-id="sc-a"></div></body></html>`;
    const comp = await openComposition(html);
    expect(comp.serialize()).toContain("smashcut.runtime");
  });

  it("strips the embedded runtime script when stripRuntime is true", async () => {
    const html = `<!DOCTYPE html><html><head>${RUNTIME_SCRIPT}</head><body><div data-sc-id="sc-a"></div></body></html>`;
    const comp = await openComposition(html);
    const out = comp.serialize({ stripRuntime: true });
    expect(out).not.toContain("smashcut.runtime");
    expect(out).toContain('data-sc-id="sc-a"');
  });

  it("re-exports RUNTIME_BOOTSTRAP_ATTR from @smashcut/core, matching the marker generators stamp", async () => {
    expect(RUNTIME_BOOTSTRAP_ATTR).toBe("data-smashcut-preview-runtime");
    // The fixture's marker attribute above is authored by hand — confirm it's not
    // drifted from the real constant a generator would actually stamp.
    expect(RUNTIME_SCRIPT).toContain(RUNTIME_BOOTSTRAP_ATTR);
  });
});
