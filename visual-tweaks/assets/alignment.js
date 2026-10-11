import { canEditText } from "./selection.js?ver=0.4.5";
const unavailable =
  "Ce type de bloc ne peut pas être aligné ainsi avec sa disposition actuelle.";
const fail = (reason = unavailable) => ({ error: reason });
const flowChildren = (node) =>
  [...node.children].filter((child) => {
    const style = node.ownerDocument.defaultView.getComputedStyle(child);
    return (
      style.display !== "none" &&
      !["absolute", "fixed"].includes(style.position)
    );
  });
function edge(value, axis, style, flex = false) {
  if (value === "center") return "center";
  const end = value === (axis === "horizontal" ? "right" : "bottom");
  const reversed = axis === "horizontal" && style.direction === "rtl";
  return end !== reversed
    ? flex
      ? "flex-end"
      : "end"
    : flex
      ? "flex-start"
      : "start";
}
export function alignElement(node, axis, value) {
  const win = node.ownerDocument.defaultView;
  const style = win.getComputedStyle(node),
    parent = node.parentElement;
  if (!parent) return fail();
  if (["none", "contents"].includes(style.display))
    return fail(
      "Cet élément ne possède pas de cadre visible à aligner sur cet écran.",
    );
  const layout = win.getComputedStyle(parent);
  if (
    layout.writingMode !== "horizontal-tb" ||
    ["absolute", "fixed"].includes(style.position)
  )
    return fail();
  if (layout.display.includes("grid"))
    return {
      properties: {
        [axis === "horizontal" ? "justify-self" : "align-self"]: edge(
          value,
          axis,
          layout,
        ),
      },
    };
  if (layout.display.includes("flex")) {
    const row = layout.flexDirection.startsWith("row");
    const main = (axis === "horizontal") === row;
    if (!main) {
      let align = edge(value, axis, layout, true);
      if (layout.flexWrap === "wrap-reverse" && align !== "center")
        align = align === "flex-start" ? "flex-end" : "flex-start";
      const sides =
        axis === "horizontal" ? ["left", "right"] : ["top", "bottom"];
      return {
        properties: {
          "align-self": align,
          ...Object.fromEntries(sides.map((side) => [`margin-${side}`, "0"])),
        },
      };
    }
    if (flowChildren(parent).length !== 1)
      return fail(
        "Cet élément partage une rangée avec d’autres éléments. Alignez le contenu du groupe ou utilisez Déplacer pour une retouche locale.",
      );
    const available =
      axis === "horizontal"
        ? parent.clientWidth -
          parseFloat(layout.paddingLeft) -
          parseFloat(layout.paddingRight)
        : parent.clientHeight -
          parseFloat(layout.paddingTop) -
          parseFloat(layout.paddingBottom);
    const size = parseFloat(axis === "horizontal" ? style.width : style.height);
    if (parseFloat(style.flexGrow) > 0 || size >= available - 0.5)
      return fail(
        "Cet élément remplit l’espace disponible. Réduisez sa taille avant de l’aligner.",
      );
    return { properties: autoMargins(axis, value) };
  }
  if (axis === "vertical")
    return fail(
      "Le centrage vertical nécessite un groupe compatible. Cette action ne change pas la disposition de votre section.",
    );
  if (style.float !== "none") return fail();
  const properties = autoMargins(axis, value);
  if (style.display.startsWith("inline")) {
    if (!["img", "svg", "a", "button"].includes(node.localName)) return fail();
    properties.display = "block";
    if (!["img", "svg"].includes(node.localName))
      properties.width = "fit-content";
  }
  const width = parseFloat(style.width),
    parentWidth =
      parent.clientWidth -
      parseFloat(layout.paddingLeft) -
      parseFloat(layout.paddingRight);
  if (!properties.display && width >= parentWidth - 0.5)
    return fail(
      "Cet élément occupe déjà toute la largeur disponible. Réduisez sa largeur avant de l’aligner.",
    );
  return { properties };
}
function autoMargins(axis, value) {
  const horizontal = axis === "horizontal",
    before = horizontal ? "left" : "top",
    after = horizontal ? "right" : "bottom";
  return {
    [`margin-${before}`]:
      value === (horizontal ? "left" : "top") ? "0" : "auto",
    [`margin-${after}`]:
      value === (horizontal ? "right" : "bottom") ? "0" : "auto",
  };
}
export function alignContent(node, axis, value) {
  const win = node.ownerDocument.defaultView,
    style = win.getComputedStyle(node);
  if (style.writingMode !== "horizontal-tb") return fail();
  if (["none", "contents", "inline"].includes(style.display))
    return fail(
      "Ce contenu est en ligne ou sans cadre. Alignez le contenu de son bloc parent.",
    );
  if (style.display.includes("flex")) {
    const main =
      (axis === "horizontal") === style.flexDirection.startsWith("row");
    let align = edge(value, axis, style, true);
    const reverse = main
      ? style.flexDirection.endsWith("reverse")
      : style.flexWrap === "wrap-reverse";
    if (reverse && align !== "center")
      align = align === "flex-start" ? "flex-end" : "flex-start";
    return {
      properties: { [main ? "justify-content" : "align-items"]: align },
    };
  }
  if (style.display.includes("grid"))
    return {
      properties: {
        [axis === "horizontal" ? "justify-items" : "align-items"]: edge(
          value,
          axis,
          style,
        ),
      },
    };
  if (
    axis === "horizontal" &&
    (canEditText(node) ||
      flowChildren(node).every((child) =>
        win.getComputedStyle(child).display.startsWith("inline"),
      ))
  )
    return {
      properties: { "text-align": value === "center" ? "center" : value },
    };
  return fail(
    "Ce groupe contient des blocs en disposition classique. Leur alignement doit être réglé élément par élément.",
  );
}

export const resetGroups = {
  position: ["translateX", "translateY", "position", "z-index"],
  spacing: [
    "margin-top",
    "margin-right",
    "margin-bottom",
    "margin-left",
    "padding-top",
    "padding-right",
    "padding-bottom",
    "padding-left",
    "gap",
  ],
  alignment: [
    "align-self",
    "justify-self",
    "align-items",
    "justify-items",
    "justify-content",
    "text-align",
  ],
};
export function groupProperties(group, values, node) {
  const properties = [...(resetGroups[group] || [])];
  if (group === "alignment") {
    for (const sides of [
      ["left", "right"],
      ["top", "bottom"],
    ]) {
      if (sides.some((side) => values[`margin-${side}`] === "auto"))
        for (const side of sides)
          if (["auto", "0"].includes(values[`margin-${side}`]))
            properties.push(`margin-${side}`);
    }
    if (values["align-self"] !== undefined && node?.parentElement) {
      const parent = node.ownerDocument.defaultView.getComputedStyle(
        node.parentElement,
      );
      if (parent.display.includes("flex")) {
        const sides = parent.flexDirection.startsWith("row")
          ? ["top", "bottom"]
          : ["left", "right"];
        for (const side of sides)
          if (values[`margin-${side}`] === "0")
            properties.push(`margin-${side}`);
      }
    }
    if (values.display === "block") {
      properties.push("display");
      if (values.width === "fit-content") properties.push("width");
    }
  }
  return [...new Set(properties)];
}
