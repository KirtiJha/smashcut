export type PreviewConfigEnv = Record<string, string | undefined>;

export function previewConfigPayload(
  env: PreviewConfigEnv,
  pid = process.pid,
  version = "dev",
): Record<string, unknown> | null {
  const projectDir = env.SMASHCUT_PREVIEW_PROJECT_DIR;
  const projectName = env.SMASHCUT_PREVIEW_PROJECT_NAME;
  if (!projectDir || !projectName) return null;

  const browserGpuMode = env.SMASHCUT_PREVIEW_BROWSER_GPU_MODE;
  return {
    isSmashcut: true,
    pid,
    projectName,
    projectDir,
    serverBuildSignature: null,
    ...(browserGpuMode ? { browserGpuMode } : {}),
    version,
  };
}
