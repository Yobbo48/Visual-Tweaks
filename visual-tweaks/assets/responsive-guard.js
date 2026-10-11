import { editable } from "./selection.js?ver=0.4.5";
import { labelFor } from "./assets.js?ver=0.4.5";
import { effectiveProperties } from "./styles.js?ver=0.4.5";

const screens = { desktop: "Desktop", tablet: "Tablette", mobile: "Mobile" };
// Native frames even in light editing mode (light-mode.js), which slows the theme's.
const frameTick = (win) =>
  new Promise((resolve) => {
    const raf = win.__vtRequestAnimationFrame || win.requestAnimationFrame;
    raf(() => raf(resolve));
  });
const px = (value) =>
  /^-?[\d.]+px$|^0$/.test(value || "") ? parseFloat(value) : 0;
export function intersection(a, b) {
  return (
    Math.max(0, Math.min(a.right, b.right) - Math.max(a.left, b.left)) *
    Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.top, b.top))
  );
}

// Diagnostics are disposable measurements of the one live iframe/draft, not another document.
export class ResponsiveGuard {
  constructor(
    root,
    {
      viewport,
      runtime,
      elements,
      widths,
      view,
      changed,
      preview,
      apply,
      cancelPreview,
    },
  ) {
    Object.assign(this, {
      viewport,
      runtime,
      elements,
      widths,
      view,
      changed,
      preview,
      apply,
      cancelPreview,
    });
    this.dialog = document.createElement("dialog");
    this.dialog.id = "responsive-report";
    this.dialog.className = "comfort-dialog";
    root.append(this.dialog);
    this.ignored = new Set();
    this.previewing = null;
    this.dialog.addEventListener("close", () => this.stopPreview());
    // Escape: "cancel" fires at once, "close" only on a later task. The
    // previewed correction disappears with the key press, not one task later.
    this.dialog.addEventListener("cancel", () => this.stopPreview());
    this.results = [];
    this.busy = false;
    this.source = null;
    this.metrics = { audits: 0, durationMs: 0, elementsExamined: 0 };
  }
  signature() {
    return JSON.stringify([this.elements(), this.widths()]);
  }
  get stale() {
    return this.source !== this.signature();
  }
  summary() {
    return {
      stale: this.stale,
      busy: this.busy,
      ...this.metrics,
      screens: this.results.map((r) => ({
        screen: r.screen,
        width: r.width,
        overflow: r.overflow,
        problems: this.visibleIssues(r).filter((i) => i.level === "Problème")
          .length,
        warnings: this.visibleIssues(r).filter((i) => i.level === "Attention")
          .length,
      })),
    };
  }
  async analyze() {
    if (this.busy) return;
    this.stopPreview();
    this.ignored.clear();
    this.metrics.audits++;
    this.busy = true;
    this.results = [];
    this.source = null;
    this.render();
    if (!this.dialog.open) this.dialog.showModal();
    const runtime = this.runtime(),
      doc = runtime.doc,
      win = doc.defaultView,
      viewport = this.viewport;
    const previous = { width: viewport.width, x: win.scrollX, y: win.scrollY };
    const started = performance.now();
    this.metrics.elementsExamined = 0;
    const identities = new WeakMap();
    let index = 0;
    const id = (n) => {
      if (!identities.has(n)) identities.set(n, ++index);
      return identities.get(n);
    };
    let baseline = new Set();
    try {
      for (const [screen, width] of Object.entries(this.widths())) {
        viewport.width = width;
        viewport.layout();
        await frameTick(win);
        await Promise.race([
          doc.fonts?.ready ?? Promise.resolve(),
          new Promise((resolve) => setTimeout(resolve, 2000)),
        ]);
        if (this.runtime() !== runtime || !doc.documentElement.isConnected)
          throw new Error("La page a changé pendant le test. Relancez-le.");
        runtime.render(this.elements());
        const result = this.snapshot(doc, screen, id, baseline);
        this.results.push(result);
        if (screen === "desktop") baseline = result.collisions;
      }
      this.source = this.signature();
    } catch (error) {
      this.error = error.message;
    } finally {
      viewport.width = previous.width;
      viewport.layout();
      await frameTick(win);
      if (this.runtime() === runtime) {
        runtime.render(this.elements());
        win.scrollTo(previous.x, previous.y);
      }
      this.metrics.durationMs = Math.round(performance.now() - started);
      this.busy = false;
      this.render();
      this.changed();
    }
  }
  stopPreview() {
    if (!this.previewing) return;
    this.previewing = null;
    this.cancelPreview();
    this.dialog.classList.remove("correction-preview");
  }
  showPreview(issue) {
    if (this.stale || !issue.node.isConnected) return;
    this.stopPreview();
    this.previewing = issue;
    try {
      this.preview(issue);
      this.dialog.classList.add("correction-preview");
      this.renderProposal();
    } catch (error) {
      this.stopPreview();
      this.error = error.message;
      this.render();
    }
  }
  renderProposal() {
    const issue = this.previewing,
      el = (tag, text) => {
        const n = document.createElement(tag);
        n.textContent = text;
        return n;
      };
    const button = (text, run) => {
      const n = el("button", text);
      n.onclick = run;
      return n;
    };
    this.dialog.replaceChildren(
      el("h2", `Correction ${screens[issue.screen]}`),
      el(
        "p",
        "Proposition : limiter la largeur à celle du parent (100 %). L’aperçu est temporaire, aucune retouche n’est encore créée.",
      ),
    );
    this.dialog.append(
      button("Appliquer", () => {
        if (this.stale) {
          this.stopPreview();
          this.render();
          return;
        }
        this.stopPreview();
        this.dialog.close();
        this.apply(issue);
      }),
      button("Ignorer", () => {
        this.ignored.add(issue.key);
        this.stopPreview();
        this.render();
        this.changed();
      }),
      button("Annuler l’aperçu", () => {
        this.stopPreview();
        this.render();
      }),
    );
  }
  visibleIssues(result) {
    return result.issues.filter((issue) => !this.ignored.has(issue.key));
  }
  snapshot(doc, screen, id, baseline) {
    const win = doc.defaultView,
      width = doc.documentElement.clientWidth,
      overflow = doc.documentElement.scrollWidth > width + 2;
    const issues = [],
      collisions = new Set(),
      boxes = [],
      draftByNode = new Map(
        [...this.runtime().targets].map(([key, node]) => [
          node,
          this.elements().find((e) => e.id === key),
        ]),
      );
    // Opacity is composited through ancestors, unlike the child's computed value.
    // Cache this ancestry check for the duration of one viewport snapshot.
    const transparent = new WeakMap();
    const hasTransparentAncestor = (node) => {
      if (!node) return false;
      if (!transparent.has(node))
        transparent.set(
          node,
          Number(win.getComputedStyle(node).opacity) === 0 ||
            hasTransparentAncestor(node.parentElement),
        );
      return transparent.get(node);
    };
    const all = doc.querySelectorAll("body *"),
      candidates = [...all].slice(0, 1500);
    const add = (node, kind, level, text, proposal = null) => {
      if (
        (issues.length < 40 || kind === "scan-limit") &&
        !issues.some((i) => i.node === node && i.kind === kind)
      )
        issues.push({
          node,
          kind,
          level,
          text,
          screen,
          key: `${screen}:${id(node)}:${kind}`,
          proposal,
        });
    };
    for (const node of candidates) {
      if (!editable(node)) continue;
      const rect = node.getBoundingClientRect();
      if (!rect.width || !rect.height) continue;
      const style = win.getComputedStyle(node);
      this.metrics.elementsExamined++;
      if (
        style.visibility !== "visible" ||
        Number(style.opacity) === 0 ||
        hasTransparentAncestor(node.parentElement)
      )
        continue;
      const normal = !["absolute", "fixed"].includes(style.position),
        parent = node.parentElement;
      const significant =
        ["img", "svg", "button", "a"].includes(node.localName) ||
        (!node.children.length && node.textContent.trim().length > 3);
      const available = Math.max(
        0,
        (parent?.clientWidth || width) -
          (parseFloat(win.getComputedStyle(parent || node).paddingLeft) || 0) -
          (parseFloat(win.getComputedStyle(parent || node).paddingRight) || 0),
      );
      let clippedByParent = false;
      if (overflow && rect.right > width + 2)
        for (
          let ancestor = node.parentElement;
          ancestor && ancestor !== doc.body;
          ancestor = ancestor.parentElement
        ) {
          if (
            ["hidden", "clip", "auto", "scroll"].includes(
              win.getComputedStyle(ancestor).overflowX,
            ) &&
            ancestor.getBoundingClientRect().right <= width + 2
          ) {
            clippedByParent = true;
            break;
          }
        }
      if (overflow && normal && !clippedByParent && rect.right > width + 2) {
        const tooWide = rect.width > available + 2;
        add(
          node,
          "overflow",
          "Problème",
          `Cet élément dépasse de l’écran ${screen === "mobile" ? "en mobile" : screen === "tablet" ? "en tablette" : "sur Desktop"} à ${width} px.${tooWide ? ` Sa largeur est de ${Math.round(rect.width)} px.` : ""}`,
          tooWide ? { "max-width": "100%" } : null,
        );
      }
      const entry = draftByNode.get(node),
        values = entry ? effectiveProperties(entry, screen) : {};
      if (
        screen !== "desktop" &&
        (Math.abs(px(values.translateX)) >
          Math.max(64, Math.min(width * 0.3, rect.width * 0.6)) ||
          Math.abs(px(values.translateY)) > Math.max(64, rect.height * 0.6))
      )
        add(
          node,
          "shift",
          "Attention",
          "Ce déplacement important mérite une vérification sur cet écran.",
        );
      if (
        screen !== "desktop" &&
        overflow &&
        normal &&
        [
          "marginLeft",
          "marginRight",
          "paddingLeft",
          "paddingRight",
          "gap",
        ].some((k) => parseFloat(style[k]) > width * 0.25)
      )
        add(
          node,
          "spacing",
          "Attention",
          "Cet espace important contribue à une disposition trop large.",
        );
      if (
        ["button", "a"].includes(node.localName) &&
        style.display !== "inline" &&
        (rect.width < 24 || rect.height < 24)
      )
        add(
          node,
          "touch",
          "Attention",
          "La zone cliquable est petite. Vérifiez qu’elle reste facile à utiliser.",
        );
      if (
        !node.children.length &&
        node.textContent.trim() &&
        ((["hidden", "clip"].includes(style.overflowY) &&
          node.scrollHeight > node.clientHeight + 2) ||
          (["hidden", "clip"].includes(style.overflowX) &&
            node.scrollWidth > node.clientWidth + 2))
      )
        add(
          node,
          "clipped-text",
          "Attention",
          "Du texte est coupé par son cadre. Vérifiez que cela est voulu.",
        );
      if (
        significant &&
        normal &&
        style.transform === "none" &&
        rect.width > 24 &&
        rect.height > 24
      )
        boxes.push({ node, rect, parent });
    }
    const groups = new Map();
    for (const box of boxes) {
      if (!groups.has(box.parent)) groups.set(box.parent, []);
      groups.get(box.parent).push(box);
    }
    for (const siblings of groups.values())
      for (let i = 0; i < Math.min(20, siblings.length); i++)
        for (let j = i + 1; j < Math.min(20, siblings.length); j++) {
          const a = siblings[i],
            b = siblings[j],
            area = intersection(a.rect, b.rect);
          if (
            area <
            Math.min(
              a.rect.width * a.rect.height,
              b.rect.width * b.rect.height,
            ) *
              0.25
          )
            continue;
          const key = [id(a.node), id(b.node)].sort((a, b) => a - b).join(":");
          collisions.add(key);
          if (screen !== "desktop" && !baseline.has(key))
            add(
              b.node,
              "overlap",
              "Attention",
              "Ces éléments se chevauchent sur cet écran alors qu’ils sont séparés sur Desktop. Vérifiez que cela est voulu.",
            );
        }
    if (overflow && !issues.some((i) => i.kind === "overflow"))
      add(
        doc.body,
        "page-overflow",
        "Problème",
        "La page est plus large que cet écran. Inspectez ses éléments dans Structure ou Assets.",
      );
    if (all.length > 1500)
      add(
        doc.body,
        "scan-limit",
        "Information",
        `Analyse partielle : ${candidates.length.toLocaleString("fr-FR")} éléments de la page parcourus sur ${all.length.toLocaleString("fr-FR")}. Ce nombre inclut les sous-éléments des icônes et les éléments masqués. Cette limite garde l’éditeur réactif. Les éléments restants n’ont pas été vérifiés ; cette information ne désigne aucun élément à corriger.`,
      );
    return { screen, width, overflow, issues, collisions };
  }
  render() {
    if (this.previewing) {
      this.renderProposal();
      return;
    }
    const el = (tag, text) => {
      const n = document.createElement(tag);
      n.textContent = text;
      return n;
    };
    const button = (text, run) => {
      const n = el("button", text);
      n.type = "button";
      n.onclick = run;
      return n;
    };
    this.dialog.replaceChildren(el("h2", "Tester le responsive"));
    if (this.busy) {
      this.dialog.append(
        el(
          "p",
          "Vérification des trois écrans… Aucune retouche ne sera créée.",
        ),
      );
      return;
    }
    this.dialog.append(button("Fermer", () => this.dialog.close()));
    if (this.error) {
      this.dialog.append(el("p", this.error));
      this.error = null;
    }
    if (this.stale)
      this.dialog.append(
        el(
          "p",
          "Les mesures ont changé. Relancez le test avant de vous fier à ces résultats.",
        ),
      );
    for (const result of this.results) {
      const section = el("section", "");
      section.dataset.screen = result.screen;
      const visible = this.visibleIssues(result);
      const partial = visible.some((issue) => issue.kind === "scan-limit");
      const findings = visible.filter((issue) => issue.kind !== "scan-limit");
      section.append(
        el(
          "h3",
          `${screens[result.screen]} — ${findings.length ? `${findings.length} point(s) à vérifier` : partial ? "Aucun problème détecté" : "OK"}${partial ? " — analyse partielle" : ""}`,
        ),
      );
      for (const issue of visible) {
        const row = el("article", "");
        row.dataset.kind = issue.kind;
        row.dataset.target = issue.node.getAttribute("data-vt-id") || "";
        row.append(
          el(
            "strong",
            issue.kind === "scan-limit"
              ? "Information — Analyse partielle"
              : `${issue.level} — ${issue.node === issue.node.ownerDocument.body ? "Page" : labelFor(issue.node)}`,
          ),
          el("p", issue.text),
        );
        if (issue.kind === "scan-limit") {
          section.append(row);
          continue;
        }
        if (issue.node !== issue.node.ownerDocument.body) {
          const see = button("Voir", () => {
            this.dialog.close();
            this.view(issue);
          });
          see.disabled = !issue.node.isConnected || this.stale;
          row.append(see);
        }
        if (issue.proposal) {
          const propose = button("Prévisualiser une correction", () =>
            this.showPreview(issue),
          );
          propose.disabled = this.stale || !issue.node.isConnected;
          row.append(propose);
        }
        row.append(
          button("Ignorer", () => {
            this.ignored.add(issue.key);
            this.render();
            this.changed();
          }),
        );
        section.append(row);
      }
      this.dialog.append(section);
    }
    this.dialog.append(
      el(
        "p",
        "Ce sont des mesures et recommandations, pas une garantie de compatibilité pour toutes les pages.",
      ),
    );
  }
}
