export function dimensionsOf(node) {
  const style = node.ownerDocument.defaultView.getComputedStyle(node);
  const edges = boxEdges(style);
  const dimension = (axis, offset) => {
    const value = /^\d+(?:\.\d+)?px$/.test(style[axis])
      ? parseFloat(style[axis])
      : NaN;
    return Number.isFinite(value) ? value + edges[axis] : offset;
  };
  return {
    width: dimension("width", node.offsetWidth),
    height: dimension("height", node.offsetHeight),
  };
}
export function boxEdges(style) {
  if (style.boxSizing === "border-box") return { width: 0, height: 0 };
  const number = (property) => parseFloat(style[property]) || 0;
  return {
    width:
      number("paddingLeft") +
      number("paddingRight") +
      number("borderLeftWidth") +
      number("borderRightWidth"),
    height:
      number("paddingTop") +
      number("paddingBottom") +
      number("borderTopWidth") +
      number("borderBottomWidth"),
  };
}
export function matrixFor(node) {
  const win = node.ownerDocument.defaultView;
  let matrix = new win.DOMMatrix();
  for (
    let current = node;
    current && current.localName !== "html";
    current = current.parentElement
  ) {
    const style = win.getComputedStyle(current);
    if (style.perspective !== "none")
      throw new Error(
        "Cet élément utilise une perspective. Utilisez les réglages de taille.",
      );
    const local =
      style.transform === "none"
        ? new win.DOMMatrix()
        : new win.DOMMatrix(style.transform);
    if (!local.is2D)
      throw new Error(
        "Cet élément utilise un effet 3D. Utilisez les réglages de taille.",
      );
    if (style.rotate && style.rotate !== "none") {
      const parts = style.rotate.split(" ");
      if (parts.length > 1 && parts[0] !== "z")
        throw new Error(
          "Cette rotation est en 3D. Utilisez les réglages de taille.",
        );
      const value = parts.at(-1),
        angle =
          parseFloat(value) *
          (value.endsWith("grad")
            ? 0.9
            : value.endsWith("rad")
              ? 180 / Math.PI
              : value.endsWith("turn")
                ? 360
                : 1);
      local.preMultiplySelf(new win.DOMMatrix().rotate(angle));
    }
    if (style.scale && style.scale !== "none") {
      const [x, y] = style.scale.split(" ").map(Number);
      local.preMultiplySelf(new win.DOMMatrix().scale(x, y ?? x));
    }
    const zoom = Number(style.zoom) || 1;
    if (zoom !== 1) local.preMultiplySelf(new win.DOMMatrix().scale(zoom));
    matrix = local.multiply(matrix);
  }
  if (Math.abs(matrix.a * matrix.d - matrix.b * matrix.c) < 0.0001)
    throw new Error("Cet élément ne peut pas être redimensionné à la souris.");
  return matrix;
}
export function localDelta(matrix, x, y) {
  const determinant = matrix.a * matrix.d - matrix.b * matrix.c;
  return {
    x: (matrix.d * x - matrix.c * y) / determinant,
    y: (-matrix.b * x + matrix.a * y) / determinant,
  };
}
export function visualQuad(node) {
  const matrix = matrixFor(node),
    rect = node.getBoundingClientRect(),
    width = dimensionsOf(node).width,
    height = dimensionsOf(node).height;
  const points = [
    [0, 0],
    [width, 0],
    [width, height],
    [0, height],
  ].map(([x, y]) => ({
    x: matrix.a * x + matrix.c * y,
    y: matrix.b * x + matrix.d * y,
  }));
  const left = Math.min(...points.map((p) => p.x)),
    top = Math.min(...points.map((p) => p.y));
  return Object.fromEntries(
    ["nw", "ne", "se", "sw"].map((key, index) => [
      key,
      {
        x: rect.left + points[index].x - left,
        y: rect.top + points[index].y - top,
      },
    ]),
  );
}
export function resizeDimensions({ width, height, dx, dy, corner, ratio }) {
  const horizontal = corner.includes("e") ? 1 : -1,
    vertical = corner.includes("s") ? 1 : -1;
  let nextWidth = width + horizontal * dx,
    nextHeight = height + vertical * dy;
  if (ratio) {
    const factor =
      1 +
      (horizontal * dx * width + vertical * dy * height) /
        (width * width + height * height);
    nextWidth = width * factor;
    nextHeight = height * factor;
  }
  const min = 12,
    max = 99999;
  if (ratio) {
    const factor = Math.max(
      min / Math.min(width, height),
      Math.min(max / Math.max(width, height), nextWidth / width),
    );
    nextWidth = width * factor;
    nextHeight = height * factor;
  }
  return {
    width: Math.round(Math.max(min, Math.min(max, nextWidth))),
    height: Math.round(Math.max(min, Math.min(max, nextHeight))),
  };
}
