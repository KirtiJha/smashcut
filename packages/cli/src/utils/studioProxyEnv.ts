export function studioProxyEnv(
  autoProxy: boolean,
  baseEnv: NodeJS.ProcessEnv = process.env,
  preview?: {
    projectDir: string;
    projectName: string;
    browserGpuMode?: "auto" | "hardware" | "software";
  },
): NodeJS.ProcessEnv {
  return {
    ...baseEnv,
    SMASHCUT_AUTO_PROXY: autoProxy ? "true" : "false",
    ...(preview
      ? {
          SMASHCUT_PREVIEW_PROJECT_DIR: preview.projectDir,
          SMASHCUT_PREVIEW_PROJECT_NAME: preview.projectName,
          ...(preview.browserGpuMode
            ? { SMASHCUT_PREVIEW_BROWSER_GPU_MODE: preview.browserGpuMode }
            : {}),
        }
      : {}),
  };
}
