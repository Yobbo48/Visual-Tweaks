const genericFonts = new Set([
  "serif",
  "sans-serif",
  "monospace",
  "system-ui",
  "cursive",
  "fantasy",
  "ui-serif",
  "ui-sans-serif",
  "ui-monospace",
  "ui-rounded",
]);
export function fontValue(name) {
  if (["-apple-system", "BlinkMacSystemFont"].includes(name))
    return "system-ui";
  return genericFonts.has(name) ? name : '"' + name + '"';
}
export function fontLabel(name) {
  const value = name.replaceAll('"', "");
  return (
    {
      "system-ui": "Police système",
      "-apple-system": "Police système",
      BlinkMacSystemFont: "Police système",
      "sans-serif": "Sans empattement",
      serif: "Avec empattements",
      monospace: "À chasse fixe",
    }[value] || value
  );
}
export function discoverFonts(doc) {
  const families = new Set();
  const add = (value) => {
    for (const part of value.split(",")) {
      const name = part.trim().replace(/^["']|["']$/g, "");
      if (/^[\p{L}\p{N} _-]{1,80}$/u.test(name)) families.add(name);
    }
  };
  for (const node of [
    ...doc.querySelectorAll("body,h1,h2,h3,p,a,button,span"),
  ].slice(0, 200)) {
    if (families.size > 40) break;
    add(doc.defaultView.getComputedStyle(node).fontFamily);
  }
  try {
    for (const face of doc.fonts)
      if (face.status === "loaded") add(face.family);
  } catch {}
  const names = [
    ...families,
    ...[
      "Arial",
      "Georgia",
      "Verdana",
      "Trebuchet MS",
      "Courier New",
      "system-ui",
      "serif",
      "sans-serif",
    ].filter((font) => !families.has(font)),
  ];
  return [
    ...new Map(
      names
        .filter((name) => {
          try {
            return doc.fonts?.check("16px " + fontValue(name)) ?? true;
          } catch {
            return true;
          }
        })
        .map((name) => [fontValue(name), name]),
    ).values(),
  ];
}
export function discoverColors(doc) {
  const colors = new Set();
  const selectors = [
    "body",
    "header",
    "main",
    "h1",
    "h2",
    "p",
    "a",
    "button",
    "section",
  ];
  for (const node of doc.querySelectorAll(selectors.join(","))) {
    if (colors.size >= 18) break;
    const style = doc.defaultView.getComputedStyle(node);
    for (const value of [
      style.color,
      style.backgroundColor,
      style.borderColor,
    ]) {
      const hex = toHex(value);
      if (hex) colors.add(hex);
    }
  }
  return [...colors].slice(0, 12);
}
export function toHex(value) {
  if (/^#[a-f\d]{6}$/i.test(value)) return value.toLowerCase();
  if (/^#[a-f\d]{3}$/i.test(value))
    return (
      "#" +
      value
        .slice(1)
        .split("")
        .map((c) => c + c)
        .join("")
    );
  const match = value.match(
    /^rgba?\((\d+)[ ,]+(\d+)[ ,]+(\d+)(?:[ ,/]+([\d.]+))?\)$/,
  );
  if (!match || (match[4] && Number(match[4]) < 1)) return null;
  return (
    "#" +
    match
      .slice(1, 4)
      .map((v) => Number(v).toString(16).padStart(2, "0"))
      .join("")
  );
}
const swatchValue = (value) =>
  typeof value === "string" &&
  /^(?:#[a-fA-F0-9]{3}|#[a-fA-F0-9]{6}|#[a-fA-F0-9]{8}|transparent|currentColor)$/.test(
    value,
  );
export function colorControl(
  doc,
  { label, value, siteColors, storageKey, onChange, onCommit },
) {
  const root = doc.createElement("div");
  root.className = "color-control";
  const heading = doc.createElement("span");
  heading.textContent = label;
  root.append(heading);
  const row = doc.createElement("div");
  row.className = "color-row";
  const picker = doc.createElement("input");
  picker.type = "color";
  picker.value = toHex(value) || "#000000";
  picker.setAttribute("aria-label", label);
  const hex = doc.createElement("input");
  hex.type = "text";
  hex.value = value || "";
  hex.placeholder = "#RRGGBB";
  hex.setAttribute("aria-label", `${label} — code couleur`);
  row.append(picker, hex);
  root.append(row);
  let saved = { recent: [], personal: [] };
  try {
    const parsed = JSON.parse(localStorage.getItem(storageKey));
    const colors = (values, limit) =>
      Array.isArray(values)
        ? values
            .filter(
              (color) =>
                typeof color === "string" && /^#[a-f\d]{6}$/i.test(color),
            )
            .slice(0, limit)
        : [];
    if (parsed)
      saved = {
        recent: colors(parsed.recent, 8),
        personal: colors(parsed.personal, 12),
      };
  } catch {}
  const persist = () => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(saved));
    } catch {}
  };
  const remember = (color) => {
    if (swatchValue(color)) {
      saved.recent = [color, ...saved.recent.filter((c) => c !== color)].slice(
        0,
        8,
      );
      persist();
    }
  };
  function apply(color, commit = false) {
    hex.value = color;
    picker.value = toHex(color) || picker.value;
    hex.setCustomValidity("");
    onChange(color);
    if (commit) {
      remember(color);
      onCommit();
      renderSwatches();
    }
  }
  picker.addEventListener("input", () => apply(picker.value));
  picker.addEventListener("change", () => apply(picker.value, true));
  hex.addEventListener("input", () => {
    const valid =
      hex.value === "" ||
      /^(?:#[a-f\d]{3}|#[a-f\d]{6}|#[a-f\d]{8}|transparent|currentColor)$/i.test(
        hex.value,
      );
    hex.setCustomValidity(valid ? "" : "Utilisez un code couleur #hex.");
    hex.classList.toggle("invalid", !valid);
    if (valid) apply(hex.value);
  });
  hex.addEventListener("change", () => {
    if (hex.checkValidity()) {
      remember(hex.value);
      onCommit();
      renderSwatches();
    }
  });
  const swatches = doc.createElement("div");
  root.append(swatches);
  function renderSwatches() {
    swatches.replaceChildren();
    for (const [name, colors] of [
      ["Couleurs du site", siteColors],
      ["Récentes", saved.recent],
      ["Mes couleurs", saved.personal],
    ]) {
      if (!colors.length) continue;
      const title = doc.createElement("small");
      title.textContent = name;
      swatches.append(title);
      const list = doc.createElement("div");
      list.className = "swatches";
      for (const entry of colors.filter((c) => swatchValue(c.value || c))) {
        const color = entry.value || entry;
        const name = entry.name || color;
        const button = doc.createElement("button");
        button.type = "button";
        button.title = name;
        button.setAttribute("aria-label", `Utiliser ${name}`);
        button.style.backgroundColor = color;
        button.addEventListener("click", () => apply(color, true));
        list.append(button);
      }
      swatches.append(list);
    }
  }
  const add = doc.createElement("button");
  add.type = "button";
  add.className = "subtle";
  add.textContent = "Ajouter à mes couleurs";
  add.addEventListener("click", () => {
    const color = swatchValue(hex.value) ? hex.value : picker.value;
    saved.personal = [...new Set([...saved.personal, color])].slice(-12);
    persist();
    renderSwatches();
  });
  root.append(add);
  const reset = doc.createElement("button");
  reset.type = "button";
  reset.className = "subtle";
  reset.textContent = "Couleur du site";
  reset.addEventListener("click", () => apply("", true));
  root.append(reset);
  renderSwatches();
  return root;
}
