// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { swallow } from "./diagnostics";

interface HFTestWindow {
  __scDebug?: boolean;
  __SMASHCUT_DEBUG?: boolean;
  __sc?: {
    onSwallowed?: (e: { label: string; error: unknown }) => void;
  };
}

describe("swallow", () => {
  const w = window as unknown as HFTestWindow;
  const originalDebug = console.debug;

  beforeEach(() => {
    delete w.__scDebug;
    delete w.__SMASHCUT_DEBUG;
    delete w.__sc;
    console.debug = vi.fn();
  });

  afterEach(() => {
    console.debug = originalDebug;
    delete w.__scDebug;
    delete w.__SMASHCUT_DEBUG;
    delete w.__sc;
  });

  it("is silent by default — no console output, no handler call", () => {
    swallow("test.silent", new Error("boom"));
    expect(console.debug).not.toHaveBeenCalled();
  });

  it("logs to console.debug when window.__scDebug is true", () => {
    w.__scDebug = true;
    const err = new Error("boom");
    swallow("test.debug", err);
    expect(console.debug).toHaveBeenCalledWith("[smashcut] test.debug swallowed:", err);
  });

  it("also honors window.__SMASHCUT_DEBUG (legacy flag)", () => {
    w.__SMASHCUT_DEBUG = true;
    swallow("test.legacy", "string-error");
    expect(console.debug).toHaveBeenCalledWith(
      "[smashcut] test.legacy swallowed:",
      "string-error",
    );
  });

  it("dispatches to window.__sc.onSwallowed when installed", () => {
    const handler = vi.fn();
    w.__sc = { onSwallowed: handler };
    const err = new Error("from handler");
    swallow("test.handler", err);
    expect(handler).toHaveBeenCalledWith({ label: "test.handler", error: err });
  });

  it("does not propagate errors from the user-installed handler", () => {
    w.__sc = {
      onSwallowed: () => {
        throw new Error("handler exploded");
      },
    };
    expect(() => swallow("test.handler-throws", new Error("real"))).not.toThrow();
  });

  it("can run with both handler AND debug flag set", () => {
    w.__scDebug = true;
    const handler = vi.fn();
    w.__sc = { onSwallowed: handler };
    swallow("test.both", "err");
    expect(handler).toHaveBeenCalled();
    expect(console.debug).toHaveBeenCalled();
  });
});
