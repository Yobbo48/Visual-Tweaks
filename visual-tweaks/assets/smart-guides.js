export function nearestGuide(start, size, delta, targets, threshold = 4) {
  let best = null;
  for (const target of targets)
    for (const offset of [0, size / 2, size]) {
      const correction = target.value - (start + offset + delta);
      if (
        Math.abs(correction) <= threshold &&
        (!best || Math.abs(correction) < Math.abs(best.correction))
      )
        best = { ...target, correction };
    }
  return best;
}

export class SmartGuides {
  constructor(stage, viewport) {
    Object.assign(this, { stage, viewport });
    this.root = document.createElement("div");
    this.root.className = "smart-guides";
    this.root.hidden = true;
    this.lines = ["x", "y"].map((axis) => {
      const line = document.createElement("div");
      line.className = `smart-guide ${axis}`;
      this.root.append(line);
      return line;
    });
    stage.append(this.root);
    this.metrics = { candidates: 0, paints: 0 };
  }
  begin(node, enabled) {
    this.end();
    if (!enabled || !node.parentElement) return;
    const rect = node.getBoundingClientRect(),
      parent = node.parentElement.getBoundingClientRect();
    const targets = { x: [], y: [] };
    const add = (box, label, centersOnly = false) => {
      for (const [axis, start, size] of [
        ["x", box.left, box.width],
        ["y", box.top, box.height],
      ])
        for (const fraction of centersOnly ? [0.5] : [0, 0.5, 1])
          targets[axis].push({
            value: start + size * fraction,
            label: fraction === 0.5 ? `Centre ${label}` : `Bord ${label}`,
          });
    };
    add(parent, "du parent");
    for (const sibling of [...node.parentElement.children]
      .filter((n) => n !== node)
      .slice(0, 24)) {
      const box = sibling.getBoundingClientRect(),
        style = node.ownerDocument.defaultView.getComputedStyle(sibling);
      if (
        box.width &&
        box.height &&
        style.visibility !== "hidden" &&
        !["absolute", "fixed"].includes(style.position)
      )
        add(box, "voisin", true);
    }
    this.session = { rect, parent, targets };
    this.metrics.candidates = targets.x.length + targets.y.length;
  }
  snap(dx, dy, disabled) {
    this.clear();
    const s = this.session;
    if (!s || disabled) return { x: dx, y: dy };
    const x = nearestGuide(s.rect.left, s.rect.width, dx, s.targets.x),
      y = nearestGuide(s.rect.top, s.rect.height, dy, s.targets.y);
    const result = {
      x: dx + (x?.correction || 0),
      y: dy + (y?.correction || 0),
    };
    if (!x && !y) return result;
    this.root.hidden = false;
    this.metrics.paints++;
    const stage = this.stage.getBoundingClientRect();
    for (const [i, guide] of [x, y].entries()) {
      const line = this.lines[i];
      line.hidden = !guide;
      if (!guide) continue;
      const a = this.viewport.point(
        i === 0
          ? { x: guide.value, y: Math.min(s.parent.top, s.rect.top + result.y) }
          : {
              x: Math.min(s.parent.left, s.rect.left + result.x),
              y: guide.value,
            },
      );
      const b = this.viewport.point(
        i === 0
          ? {
              x: guide.value,
              y: Math.max(s.parent.bottom, s.rect.bottom + result.y),
            }
          : {
              x: Math.max(s.parent.right, s.rect.right + result.x),
              y: guide.value,
            },
      );
      line.style.left = `${a.x - stage.left + this.stage.scrollLeft}px`;
      line.style.top = `${a.y - stage.top + this.stage.scrollTop}px`;
      line.style.width = `${i === 0 ? 1 : b.x - a.x}px`;
      line.style.height = `${i === 0 ? b.y - a.y : 1}px`;
      line.title = guide.label;
    }
    return result;
  }
  clear() {
    this.root.hidden = true;
  }
  end() {
    this.clear();
    this.session = null;
  }
}
