export function fitScale(
  width,
  height,
  availableWidth,
  availableHeight,
  display = "fit",
) {
  return display === "actual"
    ? 1
    : Math.min(
        1,
        Math.max(1, availableWidth) / width,
        Math.max(1, availableHeight) / height,
      );
}

// Iframe events are already in logical CSS pixels. Parent UI events are screen pixels.
export function logicalPointer(event, frame, scale) {
  if (event.target?.ownerDocument === frame.contentDocument)
    return { x: event.clientX, y: event.clientY };
  const origin = frame.getBoundingClientRect();
  return {
    x: (event.clientX - origin.left) / scale,
    y: (event.clientY - origin.top) / scale,
  };
}

export function displayedRect(rect, origin, scale) {
  const left = origin.left + rect.left * scale,
    top = origin.top + rect.top * scale;
  const width = rect.width * scale,
    height = rect.height * scale;
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
}

function mediaQueries(doc) {
  const result = new Map();
  const walk = (rules) => {
    for (const rule of rules) {
      if (rule.media?.mediaText && result.size < 60)
        result.set(
          rule.media.mediaText,
          doc.defaultView.matchMedia(rule.media.mediaText).matches,
        );
      if (rule.cssRules) walk(rule.cssRules);
    }
  };
  for (const sheet of doc.styleSheets) {
    try {
      walk(sheet.cssRules);
    } catch {
      /* Cross-origin stylesheets cannot be inspected. */
    }
  }
  return [...result].map(([query, active]) => ({ query, active }));
}

export class Viewport {
  constructor(frame, canvas, stage, height, onChange) {
    Object.assign(this, {
      frame,
      canvas,
      stage,
      height,
      onChange,
      width: 1440,
      scale: 1,
      display: "fit",
    });
    this.observer = new ResizeObserver(() => {
      cancelAnimationFrame(this.pending);
      this.pending = requestAnimationFrame(() => this.layout());
    });
    this.observer.observe(stage);
  }
  layout() {
    const scale = fitScale(
      this.width,
      this.height,
      Math.max(1, this.stage.clientWidth - 48),
      Math.max(1, this.stage.clientHeight - 48),
      this.display,
    );
    this.scale = scale;
    this.frame.style.width = `${this.width}px`;
    this.frame.style.height = `${this.height}px`;
    this.frame.style.transform = `scale(${scale})`;
    this.canvas.style.width = `${this.width * scale}px`;
    this.canvas.style.height = `${this.height * scale}px`;
    this.onChange?.();
  }
  // `origin` lets a caller that already read the frame box reuse it (no forced layout).
  point(point, origin = this.frame.getBoundingClientRect()) {
    return {
      x: origin.left + point.x * this.scale,
      y: origin.top + point.y * this.scale,
    };
  }
  rect(rect, origin = this.frame.getBoundingClientRect()) {
    return displayedRect(rect, origin, this.scale);
  }
  pointer(event) {
    return logicalPointer(event, this.frame, this.scale);
  }
  diagnostics(node = null) {
    const doc = this.frame.contentDocument,
      win = doc?.defaultView;
    const rect = node?.getBoundingClientRect();
    return {
      logicalViewport: { width: this.width, height: this.height },
      innerWidth: win?.innerWidth,
      clientWidth: doc?.documentElement.clientWidth,
      innerHeight: win?.innerHeight,
      zoom: this.scale,
      display: this.display,
      availableCanvas: {
        width: this.stage.clientWidth,
        height: this.stage.clientHeight,
      },
      adminBar: !!doc?.querySelector("#wpadminbar"),
      mediaQueries: doc ? mediaQueries(doc) : [],
      logicalBox: rect
        ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height }
        : null,
      displayedBox: rect ? this.rect(rect) : null,
    };
  }
}
