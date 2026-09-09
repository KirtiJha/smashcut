import { describe, expect, it } from "vitest";
import { lintHyperframeHtml } from "../hyperframeLinter.js";

function baseHtml(body: string, style = ""): string {
  return `<html><body>
  <div data-composition-id="main" data-width="1920" data-height="1080">
    ${body}
  </div>
  <style>${style}</style>
  <script>window.__timelines = window.__timelines || {}; window.__timelines["main"] = gsap.timeline({ paused: true });</script>
</body></html>`;
}

const textureCss = `
.sc-texture-text {
  color: #fff;
  -webkit-mask-size: var(--mask-size, cover);
  mask-size: var(--mask-size, cover);
}
.sc-texture-lava {
  -webkit-mask-image: url("masks/lava.png");
  mask-image: url("masks/lava.png");
}
`;

describe("texture rules", () => {
  it("does not warn for a valid texture mask text usage", async () => {
    const html = baseHtml(
      '<div class="shadow"><div class="sc-texture-text sc-texture-lava">TEXT</div></div>',
      `${textureCss}.shadow { filter: drop-shadow(1px 2px 1px rgba(0,0,0,.48)); }`,
    );

    const result = await lintHyperframeHtml(html);

    expect(result.findings.filter((finding) => finding.code.startsWith("texture_"))).toEqual([]);
  });

  it("warns when a material class is used without sc-texture-text", async () => {
    const html = baseHtml('<div class="sc-texture-lava">TEXT</div>', textureCss);

    const result = await lintHyperframeHtml(html);
    const finding = result.findings.find((item) => item.code === "texture_class_missing_base");

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("warning");
    expect(finding?.fixHint).toContain("sc-texture-text");
  });

  it("warns when sc-texture-text has no material class or custom mask image", async () => {
    const html = baseHtml('<div class="sc-texture-text">TEXT</div>', textureCss);

    const result = await lintHyperframeHtml(html);
    const finding = result.findings.find((item) => item.code === "texture_text_missing_mask");

    expect(finding).toBeDefined();
    expect(finding?.severity).toBe("warning");
  });

  it("allows sc-texture-text with an inline custom mask image", async () => {
    const html = baseHtml(
      '<div class="sc-texture-text" style="-webkit-mask-image:url(custom.png); mask-image:url(custom.png)">TEXT</div>',
      textureCss,
    );

    const result = await lintHyperframeHtml(html);
    const finding = result.findings.find((item) => item.code === "texture_text_missing_mask");

    expect(finding).toBeUndefined();
  });

  it("warns when a texture material class is not defined by local CSS", async () => {
    const html = baseHtml('<div class="sc-texture-text sc-texture-marbel">TEXT</div>', textureCss);

    const result = await lintHyperframeHtml(html);
    const finding = result.findings.find((item) => item.code === "texture_class_unknown");

    expect(finding).toBeDefined();
    expect(finding?.message).toContain("sc-texture-marbel");
  });

  it("warns when drop-shadow is applied inline to the textured text element", async () => {
    const html = baseHtml(
      '<div class="sc-texture-text sc-texture-lava" style="filter: drop-shadow(1px 2px 1px black)">TEXT</div>',
      textureCss,
    );

    const result = await lintHyperframeHtml(html);
    const finding = result.findings.find((item) => item.code === "texture_drop_shadow_on_text");

    expect(finding).toBeDefined();
    expect(finding?.fixHint).toContain("wrapper");
  });

  it("warns when drop-shadow is applied by CSS directly to sc-texture-text", async () => {
    const html = baseHtml(
      '<div class="sc-texture-text sc-texture-lava">TEXT</div>',
      `${textureCss}.sc-texture-text { filter: drop-shadow(1px 2px 1px black); }`,
    );

    const result = await lintHyperframeHtml(html);
    const finding = result.findings.find((item) => item.code === "texture_drop_shadow_on_text");

    expect(finding).toBeDefined();
    expect(finding?.selector).toBe(".sc-texture-text");
  });

  it("warns when drop-shadow targets a material class before the mask rule is declared", async () => {
    const html = baseHtml(
      '<div class="sc-texture-text sc-texture-lava">TEXT</div>',
      `.sc-texture-lava { filter: drop-shadow(1px 2px 1px black); }
       ${textureCss}`,
    );

    const result = await lintHyperframeHtml(html);
    const finding = result.findings.find((item) => item.code === "texture_drop_shadow_on_text");

    expect(finding).toBeDefined();
    expect(finding?.selector).toBe(".sc-texture-lava");
  });

  it("warns when drop-shadow targets another class on the textured text element", async () => {
    const html = baseHtml(
      '<div class="sc-texture-text sc-texture-lava headline">TEXT</div>',
      `${textureCss}.headline { filter: drop-shadow(1px 2px 1px black); }`,
    );

    const result = await lintHyperframeHtml(html);
    const finding = result.findings.find((item) => item.code === "texture_drop_shadow_on_text");

    expect(finding).toBeDefined();
    expect(finding?.selector).toBe(".headline");
  });

  it("does not warn when another-class drop-shadow selector needs an unmatched ancestor", async () => {
    const html = baseHtml(
      '<div class="sc-texture-text sc-texture-lava headline">TEXT</div>',
      `${textureCss}.card .headline { filter: drop-shadow(1px 2px 1px black); }`,
    );

    const result = await lintHyperframeHtml(html);
    const finding = result.findings.find((item) => item.code === "texture_drop_shadow_on_text");

    expect(finding).toBeUndefined();
  });
});
