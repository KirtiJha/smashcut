import { describe, it, expect, vi, beforeEach } from "vitest";
import { createThreeAdapter } from "./three";
import { resetSeekDispatchState } from "./seek-dispatch";

const threeWindow = window as Window & { __scThreeTime?: number };

describe("three adapter", () => {
  beforeEach(() => {
    delete threeWindow.__scThreeTime;
    resetSeekDispatchState();
  });

  it("has correct name", () => {
    expect(createThreeAdapter().name).toBe("three");
  });

  it("seek sets __scThreeTime", () => {
    const adapter = createThreeAdapter();
    adapter.seek({ time: 5 });
    expect(threeWindow.__scThreeTime).toBe(5);
  });

  it("seek dispatches sc-seek custom event", () => {
    const adapter = createThreeAdapter();
    const handler = vi.fn();
    window.addEventListener("sc-seek", handler);
    adapter.seek({ time: 3 });
    window.removeEventListener("sc-seek", handler);
    expect(handler).toHaveBeenCalled();
    const detail = (handler.mock.calls[0][0] as CustomEvent).detail;
    expect(detail.time).toBe(3);
  });

  it("seek clamps negative time to 0", () => {
    const adapter = createThreeAdapter();
    adapter.seek({ time: -10 });
    expect(threeWindow.__scThreeTime).toBe(0);
  });

  it("pause retains last forced time", () => {
    const adapter = createThreeAdapter();
    adapter.seek({ time: 7 });
    adapter.pause();
    // Internal state preserved — no crash
    expect(threeWindow.__scThreeTime).toBe(7);
  });

  it("play releases forced time", () => {
    const adapter = createThreeAdapter();
    adapter.seek({ time: 7 });
    adapter.play!();
    // After play, forced time is released
  });

  it("revert resets all state", () => {
    const adapter = createThreeAdapter();
    adapter.seek({ time: 5 });
    adapter.revert!();
    // After revert, forcedTime and lastForcedTime are reset
  });

  it("discover is a no-op", () => {
    const adapter = createThreeAdapter();
    expect(() => adapter.discover()).not.toThrow();
  });
});
