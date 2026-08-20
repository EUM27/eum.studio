export function resolveTypewriterScrollTop(input: Readonly<{
  currentScrollTop: number;
  cursorBottom: number;
  cursorTop: number;
  maxScrollTop: number;
  viewportHeight: number;
  positionPercent: number;
  scrollerTop: number;
}>): number {
  const cursorCenter = (input.cursorTop + input.cursorBottom) / 2;
  const targetViewportY =
    input.scrollerTop + input.viewportHeight * (input.positionPercent / 100);
  return Math.max(
    0,
    Math.min(
      input.maxScrollTop,
      input.currentScrollTop + cursorCenter - targetViewportY,
    ),
  );
}
