export type SmashcutPickerBoundingBox = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type SmashcutPickerElementInfo = {
  id: string | null;
  tagName: string;
  selector: string;
  label: string;
  boundingBox: SmashcutPickerBoundingBox;
  textContent: string | null;
  src: string | null;
  dataAttributes: Record<string, string>;
};

export type SmashcutPickerApi = {
  enable: () => void;
  disable: () => void;
  isActive: () => boolean;
  getHovered: () => SmashcutPickerElementInfo | null;
  getSelected: () => SmashcutPickerElementInfo | null;
  getCandidatesAtPoint: (
    clientX: number,
    clientY: number,
    limit?: number,
  ) => SmashcutPickerElementInfo[];
  pickAtPoint: (
    clientX: number,
    clientY: number,
    index?: number,
  ) => SmashcutPickerElementInfo | null;
  pickManyAtPoint: (
    clientX: number,
    clientY: number,
    indexes?: number[],
  ) => SmashcutPickerElementInfo[];
};

declare global {
  interface Window {
    __HF_PICKER_API?: SmashcutPickerApi;
  }
}
