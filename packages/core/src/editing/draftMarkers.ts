/**
 * Browser-safe wire constants shared by the runtime, Studio, and studio-server.
 *
 * Keep this module dependency-free. These names are part of the edit protocol,
 * not server implementation details, so browser code must be able to import
 * them without pulling the studio-server package into its graph.
 */
export const STUDIO_OFFSET_X_PROP = "--sc-studio-offset-x";
export const STUDIO_OFFSET_Y_PROP = "--sc-studio-offset-y";
export const STUDIO_WIDTH_PROP = "--sc-studio-width";
export const STUDIO_HEIGHT_PROP = "--sc-studio-height";
export const STUDIO_MANUAL_EDIT_GESTURE_ATTR = "data-sc-studio-manual-edit-gesture";
