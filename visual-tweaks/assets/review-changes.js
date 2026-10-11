import { labelFor, areaFor } from "./assets.js?ver=0.4.5";

const screens = { desktop: "Desktop", tablet: "Tablette", mobile: "Mobile" };
const names = {
  width: "Largeur",
  height: "Hauteur",
  "max-width": "Largeur maximale",
  "font-size": "Taille du texte",
  color: "Couleur",
  "background-color": "Fond",
  "border-radius": "Arrondi",
  "font-family": "Police",
  "font-weight": "Graisse",
  "text-align": "Alignement du texte",
  visibility: "Visibilité",
  gap: "Espace entre éléments",
  "object-position": "Position de l’image",
  "background-position": "Position du fond",
};
export function changeSummary(entry) {
  const lines = [];
  for (const [screen, properties] of Object.entries(entry.changes)) {
    const values = [];
    if ("translateX" in properties || "translateY" in properties)
      values.push(
        `Déplacement : X ${properties.translateX ?? "hérité"}, Y ${properties.translateY ?? "hérité"}`,
      );
    for (const [key, value] of Object.entries(properties)) {
      if (["translateX", "translateY"].includes(key)) continue;
      const name =
        names[key] ||
        (key.startsWith("margin-")
          ? "Espace extérieur"
          : key.startsWith("padding-")
            ? "Espace intérieur"
            : "Style");
      values.push(`${name} : ${value}`);
    }
    if (values.length) lines.push(`${screens[screen]} — ${values.join(" · ")}`);
  }
  if (entry.content?.text !== undefined) lines.push("Texte modifié");
  if (entry.content?.href !== undefined) lines.push("Lien modifié");
  if (entry.content?.attachmentId) lines.push("Image remplacée");
  if (entry.content?.backgroundLayers?.length)
    lines.push("Couches du fond remplacées");
  return lines;
}

// A read-only projection of the current draft, never a parallel override store.
export class ReviewChanges {
  constructor(root, { elements, target, view, reset, resetAll }) {
    Object.assign(this, { elements, target, view, reset, resetAll });
    this.dialog = document.createElement("dialog");
    this.dialog.id = "review-changes";
    this.dialog.className = "comfort-dialog";
    root.append(this.dialog);
  }
  open() {
    this.render(true);
    this.dialog.showModal();
  }
  render(force = false) {
    if (!this.dialog.open && !force) return;
    const el = (tag, text) => {
      const n = document.createElement(tag);
      n.textContent = text;
      return n;
    };
    const button = (text, run) => {
      const b = el("button", text);
      b.type = "button";
      b.onclick = run;
      return b;
    };
    this.dialog.replaceChildren();
    this.dialog.append(
      el("h2", `Modifications — ${this.elements().length}`),
      button("Fermer", () => this.dialog.close()),
    );
    if (!this.elements().length)
      this.dialog.append(el("p", "Aucune retouche sur cette page."));
    for (const entry of this.elements()) {
      const node = this.target(entry.id),
        row = el("article", "");
      row.dataset.entryId = entry.id;
      row.append(
        el(
          "h3",
          node
            ? `${areaFor(node)} — ${labelFor(node)}`
            : entry.fingerprint.anchor || "Élément introuvable",
        ),
      );
      for (const line of changeSummary(entry)) row.append(el("p", line));
      const see = button("Voir", () => {
        this.dialog.close();
        this.view(entry.id);
      });
      see.disabled = !node?.isConnected;
      row.append(
        see,
        button("Réinitialiser", () => this.reset(entry.id)),
      );
      this.dialog.append(row);
    }
    this.dialog.append(
      button("Réinitialiser toutes les modifications de cette page", () =>
        this.resetAll(),
      ),
    );
  }
  update() {
    if (this.dialog.open) this.render();
  }
}
