import { fontValue, fontLabel } from "./appearance-controls.js?ver=0.4.4";
import { validValue } from "./validation.js?ver=0.4.4";
export const colorRoles = {
  primary: "Principale",
  secondary: "Secondaire",
  accent: "Accent",
  text: "Texte",
  background: "Fond",
};
export const fontRoles = { heading: "Titres", body: "Texte" };
const normalize = (value) => ({
  revision: value?.revision || 0,
  colors: { ...value?.colors },
  fonts: { ...value?.fonts },
  radius: value?.radius || "",
  shadow: value?.shadow || "",
});
export class SiteStyle {
  constructor(ui, config, onSave) {
    Object.assign(this, { ui, config, onSave });
    this.saved = normalize(config.siteStyle);
    this.value = structuredClone(this.saved);
    this.key = `visual-tweaks-site-style:${location.origin}:${config.userId}`;
    try {
      const local = JSON.parse(localStorage.getItem(this.key));
      if (local) this.value = normalize(local);
    } catch {}
    this.dialog = document.createElement("dialog");
    this.dialog.className = "site-style-dialog";
    this.dialog.setAttribute("aria-label", "Style du site");
    ui.append(this.dialog);
  }
  dirty() {
    return JSON.stringify(this.value) !== JSON.stringify(this.saved);
  }
  persist() {
    try {
      if (this.dirty())
        localStorage.setItem(this.key, JSON.stringify(this.value));
      else localStorage.removeItem(this.key);
    } catch {
      this.status.textContent =
        "Le brouillon de palette ne peut pas être conservé. Enregistrez avant de fermer.";
    }
  }
  open(fonts) {
    this.dialog.replaceChildren();
    const heading = document.createElement("h2");
    heading.textContent = "Style du site";
    const note = document.createElement("p");
    note.textContent =
      "Une palette pour retrouver vos couleurs et polices. L’appliquer à un élément crée une retouche personnalisée ; modifier la palette ne change pas les retouches déjà enregistrées.";
    this.dialog.append(heading, note);
    const fields = document.createElement("div");
    fields.className = "site-style-fields";
    this.dialog.append(fields);
    this.status = document.createElement("p");
    this.status.setAttribute("role", "status");
    this.status.id = "site-style-state";
    this.dialog.append(this.status);
    const refresh = () => {
      this.status.textContent = this.dirty()
        ? this.value.revision === this.saved.revision
          ? "Palette non enregistrée"
          : "Brouillon d’une autre révision : exportez-le ou revenez à la palette sauvegardée."
        : "Palette enregistrée";
      this.persist();
    };
    const field = (label, key, group, choices) => {
      const wrap = document.createElement("label");
      wrap.textContent = label;
      const input = document.createElement(choices ? "select" : "input");
      input.setAttribute("aria-label", label);
      input.dataset.siteRole = group ? `${group}.${key}` : key;
      if (choices)
        for (const [value, name] of choices) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = name;
          input.append(option);
        }
      else {
        input.type = "text";
        input.placeholder =
          group === "colors" ? "#123456" : "Valeur facultative";
      }
      input.value = group ? this.value[group][key] || "" : this.value[key];
      if (
        choices &&
        input.value !== (group ? this.value[group][key] || "" : this.value[key])
      ) {
        const option = document.createElement("option");
        option.value = group ? this.value[group][key] : this.value[key];
        option.textContent = option.value;
        input.append(option);
        input.value = option.value;
      }
      const update = () => {
        const property =
          group === "colors"
            ? "color"
            : group === "fonts"
              ? "font-family"
              : key === "radius"
                ? "border-radius"
                : "box-shadow";
        if (input.value !== "" && !validValue(property, input.value)) {
          input.setCustomValidity("Cette valeur n’est pas autorisée.");
          return;
        }
        input.setCustomValidity("");
        if (group) {
          if (input.value === "") delete this.value[group][key];
          else this.value[group][key] = input.value;
        } else this.value[key] = input.value;
        refresh();
      };
      input.addEventListener("input", update);
      input.addEventListener("change", update);
      wrap.append(input);
      if (group === "colors") {
        const picker = document.createElement("input");
        picker.type = "color";
        picker.value = /^#[a-f\d]{6}$/i.test(input.value)
          ? input.value
          : "#176e52";
        picker.setAttribute("aria-label", `Choisir ${label}`);
        picker.addEventListener("input", () => {
          input.value = picker.value;
          update();
        });
        wrap.append(picker);
      }
      fields.append(wrap);
    };
    for (const [key, name] of Object.entries(colorRoles))
      field(`Couleur ${name.toLowerCase()}`, key, "colors");
    for (const [key, name] of Object.entries(fontRoles))
      field(`Police ${name.toLowerCase()}`, key, "fonts", [
        ["", "Non définie"],
        ...fonts.map((n) => [fontValue(n), fontLabel(n)]),
      ]);
    field("Arrondi par défaut", "radius", null, [
      ["", "Non défini"],
      ["0px", "Aucun"],
      ["4px", "Léger"],
      ["16px", "Arrondi"],
      ["32px", "Très arrondi"],
      ["9999px", "Pilule"],
    ]);
    field("Ombre par défaut", "shadow", null, [
      ["", "Non définie"],
      ["none", "Aucune"],
      ["0px 2px 8px 0px #163b3026", "Légère"],
      ["0px 8px 20px 0px #163b3033", "Moyenne"],
      ["0px 16px 36px 0px #163b304d", "Forte"],
    ]);
    const actions = document.createElement("div");
    actions.className = "site-style-actions";
    this.dialog.append(actions);
    const button = (label, run) => {
      const b = document.createElement("button");
      b.textContent = label;
      b.addEventListener("click", run);
      actions.append(b);
      return b;
    };
    const save = button("Enregistrer le style du site", async () => {
      if (
        this.busy ||
        ![...fields.querySelectorAll("input,select")].every((n) =>
          n.reportValidity(),
        )
      )
        return;
      this.busy = true;
      save.disabled = true;
      const snapshot = structuredClone(this.value);
      this.status.textContent = "Enregistrement…";
      try {
        const response = await fetch(this.config.styleApi, {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            "X-WP-Nonce": this.config.nonce,
          },
          body: JSON.stringify(snapshot),
          signal: AbortSignal.timeout(20000),
        });
        const data = await response.json();
        if (!response.ok)
          throw new Error(
            response.status === 409
              ? "La palette a changé dans une autre session. Exportez votre brouillon avant de recharger."
              : data.message || "Sauvegarde impossible.",
          );
        this.saved = normalize(data);
        if (JSON.stringify(this.value) === JSON.stringify(snapshot))
          this.value = structuredClone(this.saved);
        else this.value.revision = this.saved.revision;
        this.onSave(this.saved);
        refresh();
      } catch (error) {
        this.status.textContent =
          error.message + " Le brouillon de palette est conservé.";
        this.persist();
      } finally {
        this.busy = false;
        save.disabled = false;
      }
    });
    save.className = "primary";
    button("Revenir à la palette sauvegardée", () => {
      if (this.busy) return;
      this.value = structuredClone(this.saved);
      this.persist();
      this.open(fonts);
    });
    button("Exporter la palette", () => {
      const url = URL.createObjectURL(
        new Blob([JSON.stringify(this.value, null, 2)], {
          type: "application/json",
        }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = "visual-tweaks-site-style.json";
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    });
    button("Fermer", () => this.dialog.close());
    refresh();
    if (!this.dialog.open) this.dialog.showModal();
  }
}
