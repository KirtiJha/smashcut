export interface HFDebugSurface {
  __scDebug?: boolean;
  __SMASHCUT_DEBUG?: boolean;
  __sc?: {
    onSwallowed?: (event: { label: string; error: unknown }) => void;
  };
}

export function getDebugSurface(): HFDebugSurface {
  return globalThis as HFDebugSurface;
}
