import { chartSize } from "./metrics.ts";
import { pointX, pointY, type PlotScale } from "./plot.ts";
import type { FilteredPoint, ScoredPoint } from "./model.ts";
import type { UiContext } from "./context.ts";

export function drawLabels(
  context: UiContext,
  points: readonly FilteredPoint[],
  minScore: number,
  scale: PlotScale,
): void {
  const { margin, width, height } = chartSize;
  const boxes = points.map((point) => ({
    x: pointX(point, scale) - 7,
    y: pointY(point.s, scale) - 7,
    w: 14,
    h: 14,
  }));
  if (minScore > 0)
    boxes.push({ x: width - margin.right - 130, y: pointY(minScore, scale) + 3, w: 130, h: 15 });
  points.forEach((point) => {
    drawLabel(context, point, boxes, scale, margin, width, height);
  });
}

function drawLabel(
  context: UiContext,
  point: Readonly<ScoredPoint>,
  boxes: { x: number; y: number; w: number; h: number }[],
  scale: PlotScale,
  margin: typeof chartSize.margin,
  width: number,
  height: number,
): void {
  const cx = pointX(point, scale);
  const cy = pointY(point.s, scale);
  const textWidth = point.label.length * 6.1;
  const labelHeight = 13;
  const positions = labelPositions(cx, cy, textWidth);
  for (const [x, y] of positions) {
    const box = { x, y, w: textWidth, h: labelHeight };
    if (labelOverlaps(box, boxes, margin, width, height)) continue;
    boxes.push(box);
    const text = addSvg(context, "text", { x, y: y + labelHeight - 3 });
    text.textContent = point.label;
    text.style.fill = "var(--fg)";
    text.style.fontSize = "11.5px";
    break;
  }
}

function labelPositions(
  cx: number,
  cy: number,
  width: number,
): readonly (readonly [number, number])[] {
  return [
    [cx + 9, cy - 7],
    [cx - 9 - width, cy - 7],
    [cx - width / 2, cy - 22],
    [cx - width / 2, cy + 9],
    [cx + 9, cy - 19],
    [cx + 9, cy + 5],
    [cx - 9 - width, cy - 19],
    [cx - 9 - width, cy + 5],
  ];
}

function labelOverlaps(
  box: { x: number; y: number; w: number; h: number },
  boxes: readonly { x: number; y: number; w: number; h: number }[],
  margin: typeof chartSize.margin,
  width: number,
  height: number,
): boolean {
  if (box.x < margin.left || box.x + box.w > width - margin.right) return true;
  if (box.y < margin.top - 4 || box.y + box.h > height - margin.bottom) return true;
  return boxes.some(
    (other) =>
      box.x < other.x + other.w &&
      box.x + box.w > other.x &&
      box.y < other.y + other.h &&
      box.y + box.h > other.y,
  );
}

function addSvg(
  context: UiContext,
  name: string,
  attributes: Readonly<Record<string, string | number>>,
): SVGElement {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => {
    element.setAttribute(key, String(value));
  });
  context.elements.chart.append(element);
  return element;
}
