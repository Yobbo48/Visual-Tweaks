import { selectionTarget } from "./selection.js?ver=0.4.4";
import {
  assetInventory,
  groupAssets,
  structureInventory,
  svgThumbnail,
} from "./assets.js?ver=0.4.4";

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
    this.visibility = new WeakMap();
    this.thumbnails = new WeakMap();
    this.assetIndex = null;
    this.metrics = { structureBuilds: 0, assetScans: 0, assetUpdates: 0 };
  }
  observe(doc) {
    this.observer?.disconnect();
    clearTimeout(this.pending);
    this.assetIndex = null;
    this.thumbnails = new WeakMap();
    this.visibility = new WeakMap();
    this.expanded.clear();
    this.changed = new Set();
    this.structural = false;
    this.observer = new doc.defaultView.MutationObserver((records) => {
      const changed = new Set();
      let structural = false;
      for (const record of records) {
        if (record.type === "childList") {
          for (const node of [...record.addedNodes, ...record.removedNodes])
            if (node.nodeType === 1) {
              structural = true;
              this.visibility.delete(record.target);
              changed.add(node);
            }
          // Plain text overrides only update their existing label, not the tree.
          const row = this.rows.get(record.target);
          if (row && !record.target.children.length)
            row.row.querySelector("small").textContent =
              record.target.textContent.trim().slice(0, 50);
        } else changed.add(record.target);
      }
      if (!changed.size) return;
      for (const node of changed) this.changed.add(node);
      this.structural ||= structural;
      clearTimeout(this.pending);
      this.pending = setTimeout(() => this.updateMutations(doc), 200);
    });
    this.observer.observe(doc.body, {
      subtree: true,
      childList: true,
      attributes: true,
      attributeFilter: [
        "src",
        "srcset",
        "sizes",
        "class",
        "id",
        "style",
        "aria-label",
        "data-vt-id",
        "hidden",
      ],
    });
  }
  updateMutations(doc) {
    if (this.getDocument() !== doc) return;
    this.visibility = new WeakMap();
    for (const node of this.changed) {
      this.visibility.delete(node);
      this.thumbnails.delete(node);
      if (this.assetIndex) {
        const nodes = [node, ...node.querySelectorAll("*")];
        for (const candidate of nodes) {
          this.assetIndex.delete(candidate);
          const target = selectionTarget(candidate);
          if (target) this.assetIndex.delete(target);
        }
        if (node.isConnected) {
          const updates = new Map();
          for (const asset of assetInventory(doc, nodes)) {
            if (!updates.has(asset.node)) updates.set(asset.node, []);
            updates.get(asset.node).push(asset);
          }
          for (const [target, assets] of updates)
            this.assetIndex.set(target, assets);
        }
        this.metrics.assetUpdates++;
      }
    }
    if (this.structural) this.views.delete("structure");
    this.views.delete("assets");
    this.changed.clear();
    this.structural = false;
    if (!this.views.has(this.mode)) this.show(this.mode, this.selection());
  }
  viewportChanged(selected) {
    this.visibility = new WeakMap();
    // Picture sources and CSS backgrounds may change with media queries.
    this.assetIndex = null;
    this.views.delete("assets");
    if (this.mode === "assets") this.show("assets", selected);
    else this.paintTree(selected);
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
    this.assetIndex = null;
    this.visibility = new WeakMap();
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
      this.metrics.structureBuilds++;
      this.rows.clear();
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
      if (!this.assetIndex) {
        this.metrics.assetScans++;
        this.assetIndex = new Map();
        for (const asset of assetInventory(doc)) {
          if (!this.assetIndex.has(asset.node))
            this.assetIndex.set(asset.node, []);
          this.assetIndex.get(asset.node).push(asset);
        }
      }
      for (const node of this.assetIndex.keys())
        if (!node.isConnected) this.assetIndex.delete(node);
      const assets = [...this.assetIndex.values()].flat();
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
          if (item.layers?.length > 1) {
            const layers = this.el("details");
            layers.append(
              this.el("summary", `Fond — ${item.layers.length} couches`),
            );
            for (const layer of item.layers) {
              const row = this.el(
                "div",
                `${layer.index + 1}. ${layer.kind === "gradient" ? "Dégradé" : layer.src?.split("/").pop() || "Composition du thème"}`,
                "background-layer",
              );
              if (layer.src && layer.index < 20) {
                const button = this.el("button", "Remplacer");
                button.dataset.backgroundLayer = layer.index;
                button.addEventListener("click", () => {
                  this.select(item.node, { ...item, layer: layer.index });
                  this.replace();
                });
                row.append(button);
              }
              layers.append(row);
            }
            card.append(layers);
          }
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
    const key = `${item.kind}:${item.src}:${item.pseudo || ""}`;
    const cached = this.thumbnails.get(item.node)?.get(key);
    if (cached) return cached;
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
    if (!this.thumbnails.has(item.node))
      this.thumbnails.set(item.node, new Map());
    this.thumbnails.get(item.node).set(key, thumb);
    return thumb;
  }
  paintTree(selected) {
    // Read every visibility first: interleaving these reads (page layout) with
    // row writes (editor layout) forced one layout per row.
    const hidden = new Map();
    for (const node of this.rows.keys())
      hidden.set(node, this.readVisibility(node));
    for (const [node, { row, children, toggle, item }] of this.rows) {
      const active = node === selected;
      const ancestor =
        !!selected && node !== selected && node.contains(selected);
      row.classList.toggle("is-selected", active);
      row.classList.toggle("is-ancestor", ancestor);
      row.classList.toggle("is-invisible", hidden.get(node));
      row.setAttribute("aria-selected", String(active));
      row.title = hidden.get(node) ? "Invisible sur cet écran" : item.label;
      if (item.children.length) {
        const open = this.expanded.has(node);
        children.hidden = !open;
        row.setAttribute("aria-expanded", String(open));
        toggle.setAttribute("aria-expanded", String(open));
        toggle.textContent = open ? "▾" : "▸";
      }
    }
  }
  readVisibility(node, force = false) {
    if (!force && this.visibility.has(node)) return this.visibility.get(node);
    const style = node.ownerDocument.defaultView.getComputedStyle(node);
    const hidden =
      !node.getClientRects().length ||
      style.visibility === "hidden" ||
      style.opacity === "0";
    this.visibility.set(node, hidden);
    return hidden;
  }
  paintVisibility(node, row, force = false) {
    const hidden = this.readVisibility(node, force);
    row.classList.toggle("is-invisible", hidden);
    return hidden;
  }
  sync(selected, reveal = false) {
    // A drag/input preview does not remeasure every node in a large theme.
    const current = this.rows.get(selected);
    if (!reveal && current?.row.getAttribute("aria-selected") === "true") {
      this.paintVisibility(selected, current.row, true);
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
