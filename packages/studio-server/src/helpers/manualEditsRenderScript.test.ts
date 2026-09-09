import { describe, expect, it } from "vitest";
import { Window } from "happy-dom";
import {
  createStudioManualEditsRenderBodyScript,
  createStudioPositionSeekReapplyScript,
} from "./manualEditsRenderScript";

function runScript(
  window: Window,
  script: string,
  getComputedStyle: typeof window.getComputedStyle = window.getComputedStyle.bind(window),
  timers: {
    setInterval?: typeof globalThis.setInterval;
    clearInterval?: typeof globalThis.clearInterval;
  } = {},
): void {
  const execute = new Function(
    "window",
    "document",
    "HTMLElement",
    "getComputedStyle",
    "setInterval",
    "clearInterval",
    script,
  );
  execute(
    window,
    window.document,
    window.HTMLElement,
    getComputedStyle,
    timers.setInterval ??
      (((callback: TimerHandler) => {
        void callback;
        return 0 as never;
      }) as typeof globalThis.setInterval),
    timers.clearInterval ?? globalThis.clearInterval,
  );
}

describe("createStudioManualEditsRenderBodyScript", () => {
  it("returns null for an empty manifest", () => {
    expect(createStudioManualEditsRenderBodyScript("")).toBeNull();
  });

  it("applies manual edits and reapplies them after render seeks", () => {
    const window = new Window();
    window.document.body.innerHTML = '<div id="card" style="width: 20px; height: 20px"></div>';
    const card = window.document.getElementById("card");
    if (!(card instanceof window.HTMLElement)) {
      throw new Error("card fixture missing");
    }

    let seekCalls = 0;
    (
      window as unknown as {
        __sc: { seek: (time: number) => void };
      }
    ).__sc = {
      seek: () => {
        seekCalls += 1;
        card.style.removeProperty("translate");
      },
    };

    const script = createStudioManualEditsRenderBodyScript(
      JSON.stringify({
        version: 1,
        edits: [
          {
            kind: "path-offset",
            target: { sourceFile: "index.html", id: "card" },
            x: 12,
            y: 24,
          },
          {
            kind: "box-size",
            target: { sourceFile: "index.html", id: "card" },
            width: 120,
            height: 64,
          },
          {
            kind: "rotation",
            target: { sourceFile: "index.html", id: "card" },
            angle: 15,
          },
        ],
      }),
    );
    if (!script) throw new Error("script fixture missing");

    const computedStyle = (element: Element) =>
      ({
        display: element === card ? "block" : "block",
        flexDirection: "row",
      }) as CSSStyleDeclaration;

    const intervalCallbacks: Array<() => void> = [];
    runScript(window, script, computedStyle, {
      setInterval: ((callback: TimerHandler) => {
        if (typeof callback === "function") intervalCallbacks.push(callback as () => void);
        return 0 as never;
      }) as typeof globalThis.setInterval,
    });

    expect(card.style.getPropertyValue("translate")).toContain("--sc-studio-offset-x");
    expect(card.style.getPropertyValue("width")).toBe("120px");
    expect(card.style.getPropertyValue("height")).toBe("64px");
    expect(card.style.getPropertyValue("rotate")).toContain("--sc-studio-rotation");
    expect(card.style.getPropertyValue("transform-origin")).toBe("center center");

    (
      window as unknown as {
        __sc: { seek: (time: number) => void };
      }
    ).__sc.seek(1);

    expect(seekCalls).toBe(1);
    expect(card.style.getPropertyValue("translate")).toContain("--sc-studio-offset-x");

    (
      window as unknown as {
        __sc: { seek: (time: number) => void };
      }
    ).__sc.seek = () => {
      card.style.removeProperty("rotate");
    };
    intervalCallbacks.forEach((callback) => callback());
    (
      window as unknown as {
        __sc: { seek: (time: number) => void };
      }
    ).__sc.seek(2);
    expect(card.style.getPropertyValue("rotate")).toContain("--sc-studio-rotation");

    (
      window as unknown as {
        __player: { renderSeek: (time: number) => void };
      }
    ).__player = {
      renderSeek: () => {
        card.style.removeProperty("rotate");
      },
    };
    intervalCallbacks.forEach((callback) => callback());
    (
      window as unknown as {
        __player: { renderSeek: (time: number) => void };
      }
    ).__player.renderSeek(3);
    expect(card.style.getPropertyValue("rotate")).toContain("--sc-studio-rotation");
  });

  it("applies render edits to the matching source file target", () => {
    const window = new Window();
    window.document.body.innerHTML = `
      <div data-composition-id="root">
        <div id="card"></div>
        <div data-composition-id="nested" data-composition-file="scenes/nested.html">
          <div id="card"></div>
        </div>
      </div>
    `;
    const cards = Array.from(window.document.getElementsByTagName("*")).filter(
      (element): element is HTMLElement =>
        element instanceof window.HTMLElement && element.id === "card",
    );
    const rootCard = cards[0];
    const nestedCard = cards[1];
    if (!rootCard || !nestedCard) {
      throw new Error("source-scoped render fixture missing");
    }

    const script = createStudioManualEditsRenderBodyScript(
      JSON.stringify({
        version: 1,
        edits: [
          {
            kind: "rotation",
            target: { sourceFile: "scenes/nested.html", id: "card" },
            angle: 21,
          },
        ],
      }),
    );
    if (!script) throw new Error("script fixture missing");

    runScript(window, script);

    expect(rootCard.style.getPropertyValue("rotate")).toBe("");
    expect(nestedCard.style.getPropertyValue("rotate")).toContain("--sc-studio-rotation");
  });

  it("applies render edits inside composition-file hosts without composition ids", () => {
    const window = new Window();
    window.document.body.innerHTML = `
      <div data-composition-id="root">
        <div id="card"></div>
        <div data-composition-file="scenes/anonymous.html">
          <div id="card"></div>
        </div>
      </div>
    `;
    const cards = Array.from(window.document.getElementsByTagName("*")).filter(
      (element): element is HTMLElement =>
        element instanceof window.HTMLElement && element.id === "card",
    );
    const rootCard = cards[0];
    const nestedCard = cards[1];
    if (!rootCard || !nestedCard) {
      throw new Error("anonymous composition render fixture missing");
    }

    const script = createStudioManualEditsRenderBodyScript(
      JSON.stringify({
        version: 1,
        edits: [
          {
            kind: "path-offset",
            target: { sourceFile: "scenes/anonymous.html", id: "card" },
            x: 12,
            y: 24,
          },
        ],
      }),
    );
    if (!script) throw new Error("script fixture missing");

    runScript(window, script);

    expect(rootCard.style.getPropertyValue("translate")).toBe("");
    expect(nestedCard.style.getPropertyValue("translate")).toContain("--sc-studio-offset-x");
  });

  it("uses the active composition path as the unscoped document fallback", () => {
    const window = new Window();
    window.document.body.innerHTML = `<div id="card"></div>`;
    const card = window.document.getElementById("card");
    if (!(card instanceof window.HTMLElement)) {
      throw new Error("card fixture missing");
    }

    const script = createStudioManualEditsRenderBodyScript(
      JSON.stringify({
        version: 1,
        edits: [
          {
            kind: "path-offset",
            target: { sourceFile: "compositions/scene-2.html", id: "card" },
            x: 12,
            y: 24,
          },
        ],
      }),
      { activeCompositionPath: "compositions/scene-2.html" },
    );
    if (!script) throw new Error("script fixture missing");

    runScript(window, script);

    expect(card.style.getPropertyValue("translate")).toContain("--sc-studio-offset-x");
  });

  it("preserves computed transform longhands as render edit bases", () => {
    const window = new Window();
    window.document.body.innerHTML = `<div id="card"></div>`;
    const card = window.document.getElementById("card");
    if (!(card instanceof window.HTMLElement)) {
      throw new Error("card fixture missing");
    }

    const script = createStudioManualEditsRenderBodyScript(
      JSON.stringify({
        version: 1,
        edits: [
          {
            kind: "path-offset",
            target: { sourceFile: "index.html", id: "card" },
            x: 12,
            y: 24,
          },
          {
            kind: "rotation",
            target: { sourceFile: "index.html", id: "card" },
            angle: 15,
          },
        ],
      }),
    );
    if (!script) throw new Error("script fixture missing");

    const computedStyle = (element: Element) =>
      ({
        getPropertyValue: (property: string) => {
          if (element !== card) return "";
          if (property === "translate") return "10px 20px";
          if (property === "rotate") return "8deg";
          return "";
        },
      }) as CSSStyleDeclaration;

    runScript(window, script, computedStyle);

    expect(card.style.getPropertyValue("translate")).toContain("calc(10px +");
    expect(card.style.getPropertyValue("translate")).toContain("calc(20px +");
    expect(card.style.getPropertyValue("rotate")).toContain("8deg");
    expect(card.style.getPropertyValue("rotate")).toContain("--sc-studio-rotation");
    expect(card.style.getPropertyValue("transform-origin")).toBe("center center");
  });

  it("does not compound stale studio variables during render reapply", () => {
    const window = new Window();
    window.document.body.innerHTML = `
      <div id="card" style="
        translate: var(--sc-studio-offset-x, 0px) var(--sc-studio-offset-y, 0px);
        rotate: var(--sc-studio-rotation, 0deg);
      "></div>
    `;
    const card = window.document.getElementById("card");
    if (!(card instanceof window.HTMLElement)) {
      throw new Error("card fixture missing");
    }

    const script = createStudioManualEditsRenderBodyScript(
      JSON.stringify({
        version: 1,
        edits: [
          {
            kind: "path-offset",
            target: { sourceFile: "index.html", id: "card" },
            x: 12,
            y: 24,
          },
          {
            kind: "rotation",
            target: { sourceFile: "index.html", id: "card" },
            angle: 15,
          },
        ],
      }),
    );
    if (!script) throw new Error("script fixture missing");

    runScript(window, script);

    expect(card.style.getPropertyValue("translate")).toBe(
      "var(--sc-studio-offset-x, 0px) var(--sc-studio-offset-y, 0px)",
    );
    expect(card.style.getPropertyValue("rotate")).toBe("var(--sc-studio-rotation, 0deg)");
  });

  it("exposes a render reapply hook for thumbnails after layout settles", () => {
    const window = new Window();
    window.document.body.innerHTML = `<div id="card"></div>`;
    const card = window.document.getElementById("card");
    if (!(card instanceof window.HTMLElement)) {
      throw new Error("card fixture missing");
    }

    const script = createStudioManualEditsRenderBodyScript(
      JSON.stringify({
        version: 1,
        edits: [
          {
            kind: "path-offset",
            target: { sourceFile: "index.html", id: "card" },
            x: 12,
            y: 24,
          },
        ],
      }),
    );
    if (!script) throw new Error("script fixture missing");

    runScript(window, script);
    card.style.removeProperty("translate");

    (
      window as unknown as {
        __scStudioManualEditsApply?: () => number;
      }
    ).__scStudioManualEditsApply?.();

    expect(card.style.getPropertyValue("translate")).toContain("--sc-studio-offset-x");
  });
});

describe("createStudioPositionSeekReapplyScript", () => {
  function runPositionScript(
    window: Window,
    timers: {
      setInterval?: typeof globalThis.setInterval;
      clearInterval?: typeof globalThis.clearInterval;
    } = {},
  ): void {
    Object.assign(window, { SyntaxError });
    const script = createStudioPositionSeekReapplyScript();
    const execute = new Function(
      "window",
      "document",
      "HTMLElement",
      "DOMMatrix",
      "setInterval",
      "clearInterval",
      script,
    );
    execute(
      window,
      window.document,
      window.HTMLElement,
      globalThis.DOMMatrix,
      timers.setInterval ??
        (((callback: TimerHandler) => {
          void callback;
          return 0 as never;
        }) as typeof globalThis.setInterval),
      timers.clearInterval ?? globalThis.clearInterval,
    );
  }

  it("reapplies box-size after seek", () => {
    const window = new Window();
    window.document.body.innerHTML = `
      <div id="card"
        data-sc-studio-box-size="true"
        style="--sc-studio-width: 200px; --sc-studio-height: 100px; width: 200px; height: 100px">
      </div>
    `;
    const card = window.document.getElementById("card") as unknown as HTMLElement;

    const originalSeek = () => {
      card.style.removeProperty("width");
      card.style.removeProperty("height");
    };
    (window as unknown as { __sc: Record<string, unknown> }).__sc = { seek: originalSeek };

    runPositionScript(window);
    const wrappedSeek = (window as unknown as { __sc: { seek: (t: number) => void } }).__sc.seek;
    wrappedSeek(1);

    expect(card.style.getPropertyValue("width")).toBe("200px");
    expect(card.style.getPropertyValue("height")).toBe("100px");
  });

  it("strips GSAP translate from transform after reapplying path offset", () => {
    const window = new Window();
    window.document.body.innerHTML = `
      <div id="card"
        data-sc-studio-path-offset="true"
        data-sc-studio-original-translate=""
        style="--sc-studio-offset-x: 50px; --sc-studio-offset-y: 30px; translate: var(--sc-studio-offset-x, 0px) var(--sc-studio-offset-y, 0px)">
      </div>
    `;
    const card = window.document.getElementById("card") as unknown as HTMLElement;

    const originalSeek = () => {
      card.style.setProperty("transform", "matrix(1, 0, 0, 1, 120, 60)");
    };
    (window as unknown as { __sc: Record<string, unknown> }).__sc = { seek: originalSeek };

    runPositionScript(window);
    const wrappedSeek = (window as unknown as { __sc: { seek: (t: number) => void } }).__sc.seek;
    wrappedSeek(1);

    expect(card.style.getPropertyValue("translate")).toContain("--sc-studio-offset-x");
    const transform = card.style.getPropertyValue("transform");
    if (transform && transform !== "none") {
      const m = new DOMMatrix(transform);
      expect(m.m41).toBe(0);
      expect(m.m42).toBe(0);
    }
  });

  it("preserves non-translate components when stripping GSAP transform", () => {
    const window = new Window();
    window.document.body.innerHTML = `
      <div id="card"
        data-sc-studio-path-offset="true"
        data-sc-studio-original-translate=""
        style="--sc-studio-offset-x: 10px; --sc-studio-offset-y: 20px; translate: var(--sc-studio-offset-x, 0px) var(--sc-studio-offset-y, 0px)">
      </div>
    `;
    const card = window.document.getElementById("card") as unknown as HTMLElement;

    const originalSeek = () => {
      card.style.setProperty("transform", "matrix(0.5, 0, 0, 0.5, 80, 40)");
    };
    (window as unknown as { __sc: Record<string, unknown> }).__sc = { seek: originalSeek };

    runPositionScript(window);
    const wrappedSeek = (window as unknown as { __sc: { seek: (t: number) => void } }).__sc.seek;
    wrappedSeek(1);

    const transform = card.style.getPropertyValue("transform");
    expect(transform).toBeTruthy();
    expect(transform).not.toContain("80");
    expect(transform).not.toContain("40");
  });

  it("removes transform entirely when it becomes identity after stripping translate", () => {
    const window = new Window();
    window.document.body.innerHTML = `
      <div id="card"
        data-sc-studio-path-offset="true"
        data-sc-studio-original-translate=""
        style="--sc-studio-offset-x: 10px; --sc-studio-offset-y: 20px; translate: var(--sc-studio-offset-x, 0px) var(--sc-studio-offset-y, 0px)">
      </div>
    `;
    const card = window.document.getElementById("card") as unknown as HTMLElement;

    const originalSeek = () => {
      card.style.setProperty("transform", "matrix(1, 0, 0, 1, 50, 25)");
    };
    (window as unknown as { __sc: Record<string, unknown> }).__sc = { seek: originalSeek };

    runPositionScript(window);
    const wrappedSeek = (window as unknown as { __sc: { seek: (t: number) => void } }).__sc.seek;
    wrappedSeek(1);

    const transform = card.style.getPropertyValue("transform");
    expect(!transform || transform === "none" || transform === "").toBe(true);
  });

  it("no-ops when transform is 'none'", () => {
    const window = new Window();
    window.document.body.innerHTML = `
      <div id="card"
        data-sc-studio-path-offset="true"
        data-sc-studio-original-translate=""
        style="--sc-studio-offset-x: 10px; --sc-studio-offset-y: 20px; translate: var(--sc-studio-offset-x, 0px) var(--sc-studio-offset-y, 0px); transform: none">
      </div>
    `;
    const card = window.document.getElementById("card") as unknown as HTMLElement;

    (window as unknown as { __sc: Record<string, unknown> }).__sc = { seek: () => {} };
    runPositionScript(window);

    expect(card.style.getPropertyValue("transform")).toBe("none");
  });

  it("strips GSAP translate for rotation-only elements", () => {
    const window = new Window();
    window.document.body.innerHTML = `
      <div id="card"
        data-sc-studio-rotation="true"
        data-sc-studio-original-rotate=""
        style="--sc-studio-rotation: 45deg; rotate: var(--sc-studio-rotation, 0deg)">
      </div>
    `;
    const card = window.document.getElementById("card") as unknown as HTMLElement;

    const originalSeek = () => {
      card.style.setProperty("transform", "matrix(1, 0, 0, 1, 100, 50)");
    };
    (window as unknown as { __sc: Record<string, unknown> }).__sc = { seek: originalSeek };

    runPositionScript(window);
    const wrappedSeek = (window as unknown as { __sc: { seek: (t: number) => void } }).__sc.seek;
    wrappedSeek(1);

    expect(card.style.getPropertyValue("rotate")).toContain("--sc-studio-rotation");
    const transform = card.style.getPropertyValue("transform");
    expect(!transform || transform === "none" || transform === "").toBe(true);
  });
});
