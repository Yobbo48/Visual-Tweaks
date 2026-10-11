import {
  assetInventory,
  groupAssets,
  structureInventory,
  svgThumbnail,
} from "./assets.js?ver=0.3.3";

// The DOM node supplied by the editor is the only selection; navigation keeps only view state.
export class Navigation {
  constructor(
    root,
    { document: getDocument, select, replace, highlight, selection },
  ) {
    Object.assign(this, {
      root,
      getDocument,
      select,
      replace,
      highlight,
      selection,
    });
    this.views = new Map();
    this.scroll = new Map();
    this.expanded = new Set();
    this.rows = new Map();
    this.mode = "structure";
  }
  show(mode, selected) {
    this.scroll.set(this.mode, this.root.scrollTop);
    this.mode = mode;
    if (!this.views.has(mode)) this.build(mode);
    this.root.replaceChildren(this.views.get(mode));
    this.root.scrollTop = this.scroll.get(mode) || 0;
    this.sync(selected, true);
  }
  refresh(selected) {
    this.scroll.set(this.mode, this.root.scrollTop);
    this.views.clear();
    this.rows.clear();
    this.show(this.mode, selected);
  }
  el(tag, text, className) {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    if (className) node.className = className;
    return node;
  }
  build(mode) {
    const doc = this.getDocument();
    if (!doc) return;
    const view = this.el("div", "", "navigation-view");
    const heading = this.el(
      "h2",
      mode === "assets" ? "Assets de la page" : "Structure de la page",
    );
    const refresh = this.el("button", "Actualiser", "subtle");
    refresh.addEventListener("click", () => this.refresh(this.selection()));
    view.append(heading, refresh);
    if (mode === "structure") {
      const items = structureInventory(doc);
      const tree = this.el("div", "", "structure-tree");
      tree.setAttribute("role", "tree");
      view.append(tree);
      for (const item of items) {
        const branch = this.el("div", "", "structure-branch");
        const row = this.el("div", "", "structure-item");
        row.setAttribute("role", "treeitem");
        row.style.setProperty("--depth", item.depth);
        row.dataset.assetId =
          item.node.getAttribute("data-vt-id") || item.node.id || "";
        const toggle = this.el("button", "▸", "tree-toggle");
        toggle.setAttribute("aria-label", `Déplier ${item.label}`);
        toggle.hidden = !item.children.length;
        const pick = this.el("button", "", "tree-pick");
        pick.setAttribute("aria-label", `Sélectionner ${item.label}`);
        pick.title = item.node.localName;
        pick.append(this.el("strong", item.type), this.el("small", item.label));
        pick.addEventListener("click", () => this.select(item.node));
        row.addEventListener("pointerenter", () => this.highlight(item.node));
        row.addEventListener("pointerleave", () => this.highlight(null));
        const children = this.el("div", "", "tree-children");
        this.rows.set(item.node, { item, row, children, toggle });
        toggle.addEventListener("click", () => {
          if (this.expanded.has(item.node)) this.expanded.delete(item.node);
          else this.expanded.add(item.node);
          this.paintTree(this.selection());
        });
        row.append(toggle, pick);
        branch.append(row, children);
        (item.parent ? this.rows.get(item.parent.node).children : tree).append(
          branch,
        );
      }
    } else {
      const assets = assetInventory(doc);
      view.append(
        this.el(
          "p",
          `${assets.length} visuels · chaque occurrence reste sélectionnable.`,
          "note",
        ),
      );
      for (const group of groupAssets(assets)) {
        const wrapper = this.el("details", "", "asset-group");
        wrapper.open = group.items.length === 1;
        const summary = this.el("summary");
        summary.append(
          this.thumbnail(group.items[0]),
          this.el(
            "strong",
            `${group.name}${group.items.length > 1 ? ` — utilisé ${group.items.length} fois` : ""}`,
          ),
        );
        wrapper.append(summary);
        for (const item of group.items) {
          const card = this.el("article", "", "asset-card");
          card.dataset.assetId =
            item.node.getAttribute("data-vt-id") || item.node.id || "";
          card._occurrence = item;
          card.append(
            this.el("strong", item.name),
            this.el(
              "small",
              `${item.type} · ${item.area} · ${item.width} × ${item.height} px`,
            ),
          );
          const actions = this.el("div", "", "asset-actions");
          const pick = this.el("button", "Sélectionner");
          pick.title = "Sélectionner dans la page";
          pick.addEventListener("click", () => this.select(item.node, item));
          actions.append(pick);
          if (item.replaceable) {
            const replace = this.el("button", "Remplacer");
            replace.addEventListener("click", () => {
              this.select(item.node, item);
              this.replace();
            });
            actions.append(replace);
          }
          card.append(actions);
          const advanced = this.el("details");
          advanced.append(
            this.el("summary", "Avancé"),
            this.el(
              "code",
              `${item.pseudo || ""}${item.layer !== undefined ? ` couche ${item.layer + 1}\n` : ""}${item.src || "<svg>"}`,
            ),
          );
          card.append(advanced);
          wrapper.append(card);
        }
        view.append(wrapper);
      }
    }
    this.views.set(mode, view);
  }
  thumbnail(item) {
    const thumb =
      item.kind === "svg" ? svgThumbnail(item.node, document) : this.el("img");
    thumb.setAttribute("class", "asset-thumb");
    if (item.kind !== "svg") {
      // Never turn an untrusted CSS URL into an executable embedded document.
      try {
        const url = new URL(item.src, this.getDocument().baseURI);
        if (
          ["http:", "https:", "blob:"].includes(url.protocol) ||
          /^data:image\//i.test(item.src)
        )
          thumb.src = url.href;
      } catch {}
      thumb.alt = "";
      thumb.loading = "lazy";
    }
    return thumb;
  }
  paintTree(selected) {
    for (const [node, { row, children, toggle, item }] of this.rows) {
      const active = node === selected;
      const ancestor =
        !!selected && node !== selected && node.contains(selected);
      row.classList.toggle("is-selected", active);
      row.classList.toggle("is-ancestor", ancestor);
      const hidden = this.paintVisibility(node, row);
      row.setAttribute("aria-selected", String(active));
      row.title = hidden ? "Invisible sur cet écran" : item.label;
      if (item.children.length) {
        const open = this.expanded.has(node);
        children.hidden = !open;
        row.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-expanded", String(open));
        toggle.textContent = open ? "▾" : "▸";
      }
    }
  }
  paintVisibility(node, row) {
    const style = node.ownerDocument.defaultView.getComputedStyle(node);
    const hidden =
      !node.getClientRects().length ||
      style.visibility === "hidden" ||
      style.opacity === "0";
    row.classList.toggle("is-invisible", hidden);
    return hidden;
  }
  sync(selected, reveal = false) {
    // A drag/input preview does not remeasure every node in a large theme.
    const current = this.rows.get(selected);
    if (!reveal && current?.row.getAttribute("aria-selected") === "true") {
      this.paintVisibility(selected, current.row);
      return;
    }
    if (selected)
      for (let node = selected.parentElement; node; node = node.parentElement)
        this.expanded.add(node);
    this.paintTree(selected);
    const view = this.views.get("assets");
    if (view)
      for (const card of view.querySelectorAll(".asset-card")) {
        const active = card._occurrence.node === selected;
        card.classList.toggle("is-selected", active);
        if (active) card.closest(".asset-group").open = true;
      }
    if (!reveal || this.root.closest("[hidden]")) return;
    const row =
      this.mode === "structure"
        ? this.rows.get(selected)?.row
        : [...(view?.querySelectorAll(".asset-card") || [])].find(
            (card) => card._occurrence.node === selected,
          );
    if (!row) return;
    const rect = row.getBoundingClientRect(),
      bounds = this.root.getBoundingClientRect();
    if (rect.top < bounds.top) this.root.scrollTop += rect.top - bounds.top - 8;
    else if (rect.bottom > bounds.bottom)
      this.root.scrollTop += rect.bottom - bounds.bottom + 8;
    this.scroll.set(this.mode, this.root.scrollTop);
  }
}
