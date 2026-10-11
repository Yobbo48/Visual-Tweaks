import { BREAKPOINTS, declarations } from "./styles.js?ver=0.4.4";
import { resolve } from "./selection.js?ver=0.4.4";

// Patch only existing, ordinary CSS rules. New targets, content, image zoom and
// structural resets retain the full renderer as the authoritative fallback.
export class StylePatcher {
  constructor(runtime) {
    this.runtime = runtime;
    this.renderVersion = -1;
    this.count = 0;
  }
  index() {
    const runtime = this.runtime;
    if (this.renderVersion === runtime.metrics.renders) return;
    this.rules = new Map();
    const walk = (rules, mode = "desktop") => {
      for (const rule of rules) {
        if (rule.conditionText && rule.cssRules) {
          const width = rule.conditionText?.match(/max-width\s*:\s*(\d+)px/);
          const next = Object.keys(BREAKPOINTS).find(
            (key) => BREAKPOINTS[key] === Number(width?.[1]),
          );
          if (next) walk(rule.cssRules, next);
          continue;
        }
        const id = rule.selectorText?.match(
          /^\[data-vt-target="([a-zA-Z0-9_-]+)"\]$/,
        )?.[1];
        if (
          !id ||
          rule.style.getPropertyValue("--vt-base-x") ||
          rule.style.getPropertyValue("background-image")
        )
          continue;
        this.rules.set(`${id}:${mode}`, rule);
      }
    };
    walk(runtime.style.sheet.cssRules);
    this.renderVersion = runtime.metrics.renders;
  }
  apply(elements, id) {
    const runtime = this.runtime;
    if (runtime.issues.length || elements.length !== runtime.elements.length)
      return false;
    const index = runtime.elements.findIndex((entry) => entry.id === id);
    const entry = elements.find((entry) => entry.id === id),
      previous = runtime.elements[index];
    if (
      !entry ||
      !previous ||
      JSON.stringify(entry.content) !== JSON.stringify(previous.content)
    )
      return false;
    const properties = Object.values(entry.changes).flatMap((values) =>
      Object.keys(values),
    );
    if (properties.some((key) => ["imageZoom", "overlay-color"].includes(key)))
      return false;
    if (
      Object.values(previous.changes).some(
        (values) => "imageZoom" in values || "overlay-color" in values,
      )
    )
      return false;
    if (
      runtime.targets.get(id) !== resolve(runtime.doc, entry, runtime.originals)
    )
      return false;
    try {
      this.index();
      const updates = [];
      let inherited = {};
      for (const mode of Object.keys(BREAKPOINTS)) {
        const values = entry.changes[mode] || {},
          rule = this.rules.get(`${id}:${mode}`);
        const css = declarations(values, inherited);
        if (css && !rule) return false;
        if (rule) updates.push([rule, css]);
        inherited = { ...inherited, ...values };
      }
      for (const [rule, css] of updates) rule.style.cssText = css;
      runtime.elements[index] = structuredClone(entry);
      this.count++;
      return true;
    } catch {
      return false;
    }
  }
}
