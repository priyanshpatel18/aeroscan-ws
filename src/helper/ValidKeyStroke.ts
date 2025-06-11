export type KeyStrokes = "ArrowUp" | "ArrowDown" | "ArrowLeft" | "ArrowRight" | "KeyW" | "KeyA" | "KeyS" | "KeyD" | "ShiftLeft" | "Space" | "KeyF";

export const validKeys: KeyStrokes[] = [
  "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight",
  "KeyW", "KeyA", "KeyS", "KeyD",
  "ShiftLeft", "Space", "KeyF"
];
export function ValidKeyStroke(key: string) {
  if (validKeys.includes(key as KeyStrokes)) {
    return key as KeyStrokes;
  }
  return null;
}
