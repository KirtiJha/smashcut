import type { RuntimeSeekOptions, RuntimeTimelineMessage, RuntimeTimelineLike } from "./types";
import type { RuntimeColorGradingApi } from "./colorGrading";
import type { HyperframePickerApi } from "../inline-scripts/pickerApi";
import type { PlayerAPI } from "../core.types";
import type { ClipTree } from "./clipTree";

type ThreeClockLike = {
  elapsedTime: number;
  oldTime: number;
  startTime: number;
  getElapsedTime: () => number;
  getDelta: () => number;
};

type ThreeAnimationMixerLike = {
  setTime?: (time: number) => void;
  update: (deltaTime: number) => ThreeAnimationMixerLike;
};

type ThreeLike = {
  Clock?: {
    prototype: ThreeClockLike;
  };
  AnimationMixer?: {
    prototype: ThreeAnimationMixerLike;
  };
};

declare global {
  interface Window {
    __timelines: Record<string, RuntimeTimelineLike>;
    __player?: PlayerAPI;
    __smashcut?: {
      registerRuntimeDataHandler?: (
        channel: string,
        handler: (payload: unknown) => void,
      ) => () => void;
      setRuntimeData?: (channel: string, payload: unknown, requestId?: number) => void;
      clearRuntimeData?: (channel: string) => void;
      [key: string]: unknown;
    };
    __clipManifest?: RuntimeTimelineMessage;
    __clipTree?: ClipTree;
    __sc?: {
      colorGrading?: RuntimeColorGradingApi;
      onSwallowed?: (label: string, err: unknown) => void;
      seek?: (timeSeconds: number, options?: RuntimeSeekOptions) => void;
      duration?: number;
    };
    __playerReady?: boolean;
    __renderReady?: boolean;
    __scRuntimeTeardown?: (() => void) | null;
    __HF_EXPORT_RENDER_SEEK_CONFIG?: {
      mode?: string;
      diagnostics?: boolean;
      step?: number;
      offsetFraction?: number;
      fps?: number;
      fpsSource?: "render-options" | "default";
      fpsFallbackReason?: "missing" | "invalid";
      owner?: string;
    };
    __HF_PARITY_MODE?: boolean;
    /** Legacy debug-only fps hint. Render-mode runtime fps uses __HF_EXPORT_RENDER_SEEK_CONFIG.fps. */
    __HF_FPS?: number;
    __HF_MAX_DURATION_SEC?: number;
    __scThreeTime?: number;
    /**
     * Current seek position in seconds, set by the TypeGPU/WebGPU adapter.
     * Poll this from your WebGPU render loop instead of `performance.now()`
     * to get the deterministic seek position.
     *
     * Also listen for the `"sc-seek"` CustomEvent on `window` for an
     * imperative push signal: `window.addEventListener("sc-seek", e => render(e.detail.time))`.
     */
    __scTypegpuTime?: number;
    /**
     * Re-render GPU adapters (Three.js / WebGPU) at the given time, bypassing
     * the `"sc-seek"` dedup. Called by the engine after injecting decoded
     * video frames so GPU compositions re-upload their video textures from the
     * freshly-injected `__render_frame__` images. See `forceDispatchSeekEvent`.
     */
    __scReseekGpu?: (time: number) => void;
    /**
     * Await GPU work registered synchronously by `sc-seek` listeners through
     * `event.detail.waitUntil(...)`.
     */
    __scWaitForSeekCompletion?: () => Promise<void>;
    /**
     * Canonical root-timeline start for a media element. Snapshot capture uses
     * this runtime-owned resolver so reference expressions, authored timing
     * restoration, and arbitrary composition nesting cannot drift.
     */
    __scResolveMediaStartSeconds?: (element: Element) => number;
    __HF_PICKER_API?: HyperframePickerApi;
    gsap?: {
      timeline: (params?: { paused?: boolean }) => RuntimeTimelineLike;
      parseEase?: (
        ease: string | ((progress: number) => number),
        ...args: unknown[]
      ) => ((progress: number) => number) | null;
      registerPlugin?: (plugin: unknown) => void;
      ticker?: {
        tick: () => void;
      };
    };
    THREE?: ThreeLike;
    /**
     * Global Anime.js v4 namespace (set by the UMD or IIFE bundle).
     * Register returned instances on `window.__scAnime`; v4 has no
     * `anime.running` auto-discovery registry.
     */
    anime?: {
      animate?: (targets: unknown, params?: unknown) => unknown;
      createTimeline?: (params?: unknown) => unknown;
      /** Legacy v3 registry retained for backward-compatible discovery. */
      running?: unknown[];
    };
    /**
     * anime.js instances registered by compositions.
     * The adapter seeks all instances when the player is seeked.
     *
     * Push your animation or timeline instance here:
     *   window.__scAnime = window.__scAnime || [];
     *   window.__scAnime.push(anim);
     */
    __scAnime?: unknown[];
    /**
     * Global lottie-web instance (set by including the lottie.min.js script).
     * The adapter uses `lottie.getRegisteredAnimations()` for auto-discovery.
     */
    lottie?: {
      loadAnimation: (params: unknown) => unknown;
      getRegisteredAnimations: () => unknown[];
    };
    /**
     * Lottie animation instances registered by compositions.
     * The adapter seeks all instances when the player is seeked.
     *
     * Push your animation instance here after calling `lottie.loadAnimation()`:
     *   window.__scLottie = window.__scLottie || [];
     *   window.__scLottie.push(anim);
     */
    __scLottie?: unknown[];
    /**
     * Mapbox GL JS map instances. Push your map here after creating it:
     *   window.__scMapbox = window.__scMapbox || [];
     *   window.__scMapbox.push(map);
     */
    __scMapbox?: unknown[];
    /**
     * Leaflet map instances. Push your map here after creating it:
     *   window.__scLeaflet = window.__scLeaflet || [];
     *   window.__scLeaflet.push(map);
     */
    __scLeaflet?: unknown[];
    /**
     * Google Maps instances. Push your map here after creating it:
     *   window.__scGoogleMaps = window.__scGoogleMaps || [];
     *   window.__scGoogleMaps.push(map);
     */
    __scGoogleMaps?: unknown[];
    /**
     * MapLibre GL JS map instances. Push your map here after creating it:
     *   window.__scMaplibre = window.__scMaplibre || [];
     *   window.__scMaplibre.push(map);
     */
    __scMaplibre?: unknown[];
    /**
     * D3 transition instances. Push your transition here after creating it:
     *   window.__scD3 = window.__scD3 || [];
     *   window.__scD3.push(transition);
     */
    __scD3?: unknown[];
    /**
     * Render-time variable overrides injected by the engine when the user
     * passes `smashcut render --variables '<json>'`. Read indirectly via
     * `window.__smashcut.getVariables()` (or the named `getVariables`
     * export from `@smashcut/core`), which merges these over the
     * declared defaults from `<html data-composition-variables="...">`.
     */
    __scVariables?: Record<string, unknown>;
    /**
     * Per-instance, pre-merged variables for sub-compositions. Keyed by the
     * sub-composition's `data-composition-id`. Populated by the runtime
     * composition loader at mount time: layers the host element's
     * `data-variable-values` over the sub-comp's declared defaults so the
     * scoped `getVariables()` exposed by `compositionScoping.ts` returns the
     * resolved values for the instance currently executing.
     */
    __scVariablesByComp?: Record<string, Record<string, unknown>>;
    /**
     * Set to `true` while the GSAP tween-batching interceptor (injected via
     * HF_EARLY_STUB in fileServer.ts) is still draining queued tween calls
     * through requestAnimationFrame batches. Cleared and the "sc-timelines-built"
     * CustomEvent is dispatched when all queues are empty.
     *
     * init.ts uses this to decide whether to defer `bindRootTimelineIfAvailable`:
     * if true at DOMContentLoaded time, it adds a one-shot event listener and
     * rebinds after the event fires.
     */
    __scTimelinesBuilding?: boolean;
  }
}

export {};
