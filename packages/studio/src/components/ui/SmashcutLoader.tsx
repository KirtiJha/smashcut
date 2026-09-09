import { SmashcutMark } from "./SmashcutMark";

export interface SmashcutLoaderProps {
  /** Status text shown below the mark. */
  title: string;
  /** Optional secondary detail line. */
  detail?: string;
  /** Optional monospace third line for IDs, counts, or percentages. */
  mono?: string;
  /** Pixel size of the mark itself; status text scales independently. */
  size?: number;
  /** Optional normalized progress value from 0 to 1. */
  progress?: number;
}

export function SmashcutLoader({
  title,
  detail,
  mono,
  size = 64,
  progress,
}: SmashcutLoaderProps) {
  const boundedProgress =
    typeof progress === "number" && Number.isFinite(progress)
      ? Math.min(1, Math.max(0, progress))
      : undefined;
  const markFrameSize = Math.round(size * 1.16);

  return (
    <div className="sc-loader" role="status" draggable={false}>
      <div
        className="sc-loader-mark-frame"
        style={{ width: markFrameSize, height: markFrameSize }}
        draggable={false}
      >
        <SmashcutMark className="sc-loader-mark" width={size} height={size} />
      </div>
      <div className="sc-loader-title">{title}</div>
      {detail && <div className="sc-loader-detail">{detail}</div>}
      {boundedProgress !== undefined && (
        <div
          className="sc-loader-progress"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(boundedProgress * 100)}
        >
          <div
            className="sc-loader-progress__fill"
            style={{ transform: `scaleX(${boundedProgress})` }}
          />
        </div>
      )}
      {mono && <div className="sc-loader-mono">{mono}</div>}
    </div>
  );
}

// fallow-ignore-next-line unused-export
export function StatusFrame(props: SmashcutLoaderProps) {
  return (
    <div className="sc-frame">
      <SmashcutLoader {...props} />
    </div>
  );
}
