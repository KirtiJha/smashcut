import { createReadinessAdapter } from "./_readiness";

type D3TransitionLike = {
  end: () => PromiseLike<void>;
};

export function createD3Adapter() {
  return createReadinessAdapter<D3TransitionLike>({
    name: "d3",
    getInstances: () => {
      if (typeof window === "undefined") return [];
      const arr = (window as { __scD3?: D3TransitionLike[] }).__scD3;
      return Array.isArray(arr) ? arr : [];
    },
    waitFor: (t) => t.end(),
  });
}
