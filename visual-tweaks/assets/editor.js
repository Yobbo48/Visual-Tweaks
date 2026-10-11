import { ResponsiveGuard } from "./responsive-guard.js?ver=0.4.4";
import { SmartGuides } from "./smart-guides.js?ver=0.4.4";
import { ReviewChanges } from "./review-changes.js?ver=0.4.4";
import { StylePatcher } from "./style-patcher.js?ver=0.4.4";
import { GesturePreview } from "./gesture-preview.js?ver=0.4.4";
import { SiteStyle, colorRoles, fontRoles } from "./site-style.js?ver=0.4.4";
import { Navigation } from "./navigation.js?ver=0.4.4";
import {
  alignElement,
  alignContent,
  groupProperties,
} from "./alignment.js?ver=0.4.4";
import {
  assetInfo,
  labelFor,
  backgroundLayerModel,
} from "./assets.js?ver=0.4.4";
import { normalizeElements } from "./state.js?ver=0.4.4";
import {
  identify,
  editable,
  canEditText,
  selectionTarget,
} from "./selection.js?ver=0.4.4";
import { History } from "./history.js?ver=0.4.4";
import { effectiveProperties, propertyOrigin } from "./styles.js?ver=0.4.4";
import {
  validValue,
  validHref,
  canonicalValue,
  invalidOverride,
} from "./validation.js?ver=0.4.4";
import { InlineEditor } from "./inline-editor.js?ver=0.4.4";
import { ContextualToolbar } from "./contextual-toolbar.js?ver=0.4.4";
import {
  discoverFonts,
  fontValue,
  fontLabel,
  discoverColors,
  colorControl,
  toHex,
} from "./appearance-controls.js?ver=0.4.4";
import {
  matrixFor,
  localDelta,
  resizeDimensions,
  dimensionsOf,
  boxEdges,
  visualQuad,
} from "./geometry.js?ver=0.4.4";

import { Viewport } from "./viewport.js?ver=0.4.4";

const config = window.VisualTweaksConfig;
if (config?.editor) start();
function start() {
  const originalWindow = {
    width: document.documentElement.clientWidth,
    height: window.innerHeight,
  };
  let desktopWidth = config.editor.desktopWidth || 1440;
  const host = document.createElement("div");
  host.id = "vt-editor-host";
  document.body.append(host);
  const ui = host.attachShadow({ mode: "open" });
  const css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = new URL("./editor.css?ver=0.4.4", import.meta.url).href;
  ui.append(css);
  const shell = document.createElement("div");
  shell.className = "shell";
  shell.innerHTML = `<header><div class="brand"><b>VT</b><span>Visual Tweaks<small>Retouches de cette page</small></span></div><nav aria-label="Aperçu responsive"><button data-mode="desktop"><img alt="" src="${new URL("./icons/device-desktop.svg", import.meta.url)}">Desktop</button><button data-mode="tablet"><img alt="" src="${new URL("./icons/device-tablet.svg", import.meta.url)}">Tablette</button><button data-mode="mobile"><img alt="" src="${new URL("./icons/device-mobile.svg", import.meta.url)}">Mobile</button></nav><span class="interaction-switch" aria-label="Interaction avec le site"><button id="interaction-edit" aria-pressed="true">Modifier</button><button id="interaction-browse" aria-pressed="false">Naviguer</button></span><span id="state" role="status"></span><button id="undo" title="Cmd/Ctrl + Z">Annuler</button><button id="redo" title="Cmd/Ctrl + Shift + Z">Rétablir</button><button id="save" class="primary">Enregistrer</button><button id="toggle-navigation" aria-expanded="true">Navigation</button><button id="toggle-panel" title="Afficher ou masquer les réglages" aria-expanded="true">Réglages</button><button id="site-style">Style du site</button><button id="exit">Quitter</button></header><div id="global-error" role="alert" hidden></div><div id="recovery"></div><div class="canvas-controls"><label>Desktop <select id="desktop-width" aria-label="Viewport desktop"><option value="1280">1280 px</option><option value="1440">1440 px</option><option value="1600">1600 px</option><option value="1920">1920 px</option><option value="current">Fenêtre actuelle</option><option value="custom">Personnalisé</option></select></label><input id="logical-width" aria-label="Largeur du viewport desktop" type="number" min="320" max="3840" step="1"><output id="viewport-size"></output><button id="fit-canvas">Adapter</button><button id="actual-canvas">100 %</button><output id="zoom-label"></output><button id="test-responsive">Tester le responsive</button><button id="review-button">Modifications</button><button id="viewport-diagnostic">Comparer le rendu</button></div><pre id="canvas-diagnostic" hidden></pre><main><aside id="navigation" aria-label="Navigation de la page"><div class="navigation-tabs" role="tablist"><button id="structure-tab" role="tab" aria-selected="true">Structure</button><button id="assets-tab" role="tab">Assets</button><button id="close-navigation" aria-label="Masquer la navigation">×</button></div><div id="inventory"></div></aside><div class="stage"><div id="frame-status" role="status"><span>Activation de l’éditeur…</span><button id="retry-frame" hidden>Réessayer</button></div><div class="viewport"><div class="canvas"><iframe title="Page WordPress — aperçu réel"></iframe></div></div><div class="outline hover"><span></span></div><div class="outline selected"><span></span><button class="drag" title="Glisser pour déplacer" aria-label="Déplacer l’élément"><img alt="" src="${new URL("./icons/arrows-move.svg", import.meta.url)}"></button></div><div id="context-toolbar"></div><div id="handles" hidden></div><div class="gesture-feedback" hidden></div></div><aside id="properties" hidden aria-label="Propriétés de l’élément"><div id="panel"></div></aside></main><footer class="page-actions"><button id="reset-page">Réinitialiser la page</button><button id="export">Exporter le brouillon JSON</button><button id="discard">Revenir à la sauvegarde</button><p id="message" role="status" aria-live="polite"></p></footer>`;
  ui.append(shell);
  const $ = (selector) => ui.querySelector(selector);
  const frame = $("iframe"),
    panel = $("#panel"),
    state = $("#state");
  let viewport,
    outlineFrame = 0; // pending scheduleOutline() frame, read by updateOutline()
  viewport = new Viewport(
    frame,
    $(".canvas"),
    $(".stage"),
    originalWindow.height,
    () => {
      $("#viewport-size").textContent =
        `${viewport.width} × ${viewport.height}`;
      $("#zoom-label").textContent =
        `Zoom ${Math.round(viewport.scale * 100)} %`;
      $("#fit-canvas").setAttribute(
        "aria-pressed",
        String(viewport.display === "fit"),
      );
      $("#actual-canvas").setAttribute(
        "aria-pressed",
        String(viewport.display === "actual"),
      );
      if (typeof updateOutline === "function") updateOutline();
      if (!$("#canvas-diagnostic").hidden) showDiagnostic();
    },
  );
  const smartGuides = new SmartGuides($(".stage"), viewport);
  function showDiagnostic() {
    $("#canvas-diagnostic").textContent = JSON.stringify(
      viewport.diagnostics(selected),
      null,
      2,
    );
  }
  window.VisualTweaksViewport = {
    diagnostics: () => viewport.diagnostics(selected),
  };
  $("#viewport-diagnostic").addEventListener("click", () => {
    $("#canvas-diagnostic").hidden = !$("#canvas-diagnostic").hidden;
    showDiagnostic();
  });
  for (const [id, display] of [
    ["fit-canvas", "fit"],
    ["actual-canvas", "actual"],
  ])
    $("#" + id).addEventListener("click", () => {
      if (drag) cancelGesture();
      viewport.display = display;
      viewport.layout();
    });
  $("#logical-width").value = desktopWidth;
  $("#desktop-width").value = [1280, 1440, 1600, 1920].includes(desktopWidth)
    ? String(desktopWidth)
    : "custom";
  $("#desktop-width").addEventListener("change", (event) => {
    if (event.target.value === "custom") {
      $("#logical-width").focus();
      return;
    }
    desktopWidth =
      event.target.value === "current"
        ? originalWindow.width
        : Number(event.target.value);
    $("#logical-width").value = desktopWidth;
    setMode("desktop");
  });
  $("#logical-width").addEventListener("change", (event) => {
    const width = Number(event.target.value);
    if (!Number.isInteger(width) || width < 320 || width > 3840) {
      event.target.value = desktopWidth;
      return;
    }
    desktopWidth = width;
    $("#desktop-width").value = "custom";
    setMode("desktop");
  });
  $(".shell").insertBefore($("#message"), $("main"));
  let draft = normalizeElements(config.elements),
    saved = JSON.stringify(draft),
    revision = config.revision,
    savedRevision = config.revision;
  const history = new History(draft);
  let selected = null,
    spec = null,
    mode = "desktop",
    interactionMode = "edit",
    runtime = null,
    gesturePreview = null,
    stylePatcher = null,
    frameReady = false,
    framePhase = "loading",
    frameError = null,
    frameController = null,
    frameTimer = null,
    activeDocument = null,
    busy = false,
    pending = null,
    drag = null;
  let cropMode = false,
    lockRatio = true,
    fonts = [],
    siteColors = [],
    inlineSnapshot = null,
    inventoryMode = "structure",
    moveStep = 1,
    selectedBackgroundLayer = null;
  const colorStorageKey = `visual-tweaks-colors:${location.origin}:${config.editor.userId}`;
  const siteStyle = new SiteStyle(ui, config.editor, (value) => {
    config.editor.siteStyle = value;
    siteColors = paletteColors(frame.contentDocument);
    if (selected) renderPanel();
  });
  $("#site-style").addEventListener("click", () => siteStyle.open(fonts));
  function paletteColors(doc) {
    return [
      ...Object.entries(config.editor.siteStyle?.colors || {}).map(
        ([role, value]) => ({ value, name: colorRoles[role] }),
      ),
      ...discoverColors(doc),
    ];
  }
  let copiedStyle = null;
  const contextual = new ContextualToolbar($("#context-toolbar"), $(".stage"));
  const inline = new InlineEditor({
    runtime: () => runtime,
    onInput: (text) =>
      modify((item) => {
        item.content ||= {};
        item.content.text = text;
      }),
    onFinish: () => {
      preview();
      flush();
      renderPanel();
      message("Texte modifié. Enregistrez pour le conserver.");
    },
    onCancel: () => {
      draft = inlineSnapshot;
      preview();
      renderPanel();
      message("Édition du texte annulée.");
    },
  });
  $("#toggle-panel").addEventListener("click", () => {
    const hidden = !$("#properties").hidden;
    $("#properties").hidden = hidden || !selected;
    $("#toggle-panel").setAttribute("aria-expanded", String(!hidden));
    viewport.layout();
    updateOutline();
  });
  const draftKey = `visual-tweaks:${location.origin}:${config.editor.userId}:${config.page}`;
  const review = new ReviewChanges(ui, {
    elements: () => draft,
    target: (id) => runtime?.targets.get(id),
    view: (id) => {
      setInteraction("edit");
      const node = runtime?.targets.get(id);
      if (node) selectListed(node);
    },
    reset: (id) => {
      if (!canModify()) return;
      inline.finish();
      flush();
      draft = draft.filter((item) => item.id !== id);
      history.push(draft);
      preview();
      renderPanel();
      message("Retouches retirées du brouillon. Vous pouvez annuler.");
    },
    resetAll: () => {
      if (canModify()) $("#reset-page").click();
    },
  });
  $("#review-button").addEventListener("click", () => {
    inline.finish();
    flush();
    review.open();
  });
  const responsiveGuard = new ResponsiveGuard(ui, {
    viewport,
    runtime: () => runtime,
    elements: () => draft,
    widths: () => ({ desktop: desktopWidth, tablet: 820, mobile: 390 }),
    view: (issue) => {
      setMode(issue.screen);
      if (issue.node !== frame.contentDocument.body) selectListed(issue.node);
    },
    preview: (issue) => {
      setMode(issue.screen);
      selectListed(issue.node);
      if (selected !== issue.node)
        throw new Error("Cette cible n’est plus disponible.");
      gesturePreview.begin(selected);
      gesturePreview.render(issue.proposal, effectiveProperties(entry(), mode));
      updateOutline();
    },
    cancelPreview: () => {
      gesturePreview?.end();
      updateOutline();
    },
    apply: (issue) => {
      setMode(issue.screen);
      selectListed(issue.node);
      setProperties(issue.proposal);
      flush();
      renderPanel();
      message(
        "Correction ajoutée au brouillon. Annulez, réinitialisez ou enregistrez comme toute retouche.",
      );
    },
    changed: () => {
      status();
      updateOutline();
    },
  });
  $("#test-responsive").addEventListener("click", () => {
    if (!canModify()) return;
    inline.finish();
    flush();
    responsiveGuard.analyze();
  });
  let recovered = null;
  try {
    recovered = JSON.parse(localStorage.getItem(draftKey));
    if (Array.isArray(recovered?.elements))
      recovered.elements = normalizeElements(recovered.elements);
  } catch {}
  // Order-independent comparison of documents; image URLs are derived by the
  // server from attachment ids and never decide whether data differs.
  const comparable = (elements) =>
    JSON.stringify(elements, (key, value) =>
      key === "image" && value && typeof value === "object" && "src" in value
        ? undefined
        : value && typeof value === "object" && !Array.isArray(value)
          ? Object.fromEntries(
              Object.keys(value)
                .sort()
                .map((k) => [k, value[k]]),
            )
          : value,
    );
  // The page was left while a save was in flight and WordPress accepted it:
  // the newer revision is exactly our own payload, so the local draft (which
  // may hold later edits) continues on it instead of becoming a conflict.
  try {
    const sent = JSON.parse(localStorage.getItem(`${draftKey}:envoi`));
    if (
      recovered?.page === config.page &&
      sent?.page === config.page &&
      Number.isInteger(sent.baseRevision) &&
      recovered.revision === sent.baseRevision &&
      config.revision === sent.baseRevision + 1 &&
      Array.isArray(sent.sends) &&
      sent.sends.some(
        (payload) =>
          comparable(normalizeElements(payload)) ===
          comparable(normalizeElements(config.elements)),
      )
    ) {
      recovered.revision = config.revision;
      recovered.rebased = true;
    }
    if (sent && config.revision !== sent.baseRevision)
      localStorage.removeItem(`${draftKey}:envoi`);
  } catch {}
  let recoveryPending = !!(
    recovered &&
    recovered.page === config.page &&
    Array.isArray(recovered.elements) &&
    comparable(recovered.elements) !== comparable(JSON.parse(saved))
  );
  let autoRecovered = false;
  if (
    recoveryPending &&
    recovered.revision === revision &&
    !invalidOverride(recovered.elements)
  ) {
    draft = structuredClone(recovered.elements);
    history.push(draft);
    recoveryPending = false;
    autoRecovered = true;
  }
  const message = (text, error = false) => {
    $("#message").textContent = text;
    $("#message").classList.toggle("error", error);
    $("#global-error").hidden = !error;
    $("#global-error").textContent = error ? text : "";
  };
  const dirty = () => JSON.stringify(draft) !== saved;
  // Other editor tabs on the same page share this browser's draft: say so,
  // and tell them when a revision is saved here.
  let peers = null;
  try {
    peers = new BroadcastChannel(draftKey);
    const tab = crypto.randomUUID();
    peers.onmessage = ({ data }) => {
      if (!data || data.tab === tab) return;
      if (data.type === "hello") peers.postMessage({ type: "here", tab });
      if (data.type === "hello" || data.type === "here") {
        shell.dataset.sharedPage = "true";
        message(sharedNotice);
      }
      if (data.type === "saved" && data.revision > revision)
        message(
          `Un autre onglet a enregistré la révision ${data.revision} de cette page. Vos retouches non enregistrées restent ici ; à l’enregistrement, vous pourrez exporter ou remplacer.`,
          true,
        );
    };
    const sharedNotice =
      "Cette page est aussi ouverte dans un autre onglet de l’éditeur. Enregistrez depuis un seul onglet pour éviter un conflit.";
    peers.postMessage({ type: "hello", tab });
    const announce = peers.postMessage.bind(peers);
    peers.postMessage = (value) => announce({ ...value, tab });
  } catch {}
  function persistDraft() {
    try {
      if (dirty())
        localStorage.setItem(
          draftKey,
          JSON.stringify({
            schemaVersion: 1,
            page: config.page,
            revision,
            elements: draft,
          }),
        );
      else if (!recoveryPending) localStorage.removeItem(draftKey);
    } catch {
      message(
        "Le brouillon local n’a pas pu être conservé. Enregistrez ou exportez avant de fermer.",
        true,
      );
    }
  }
  function responsiveIndicators() {
    const stale = responsiveGuard.stale;
    for (const button of ui.querySelectorAll("[data-mode]")) {
      const screen = button.dataset.mode;
      const specific = draft.some(
        (item) => Object.keys(item.changes[screen] || {}).length,
      );
      let badge = button.querySelector(".screen-indicator");
      if (!badge) {
        badge = document.createElement("small");
        badge.className = "screen-indicator";
        badge.setAttribute("aria-hidden", "true");
        button.append(badge);
      }
      const result = stale
        ? null
        : responsiveGuard.results.find((r) => r.screen === screen);
      const recommendations = result
        ? responsiveGuard
            .visibleIssues(result)
            .filter((i) => i.level !== "Information").length
        : 0;
      badge.textContent = recommendations
        ? `! ${recommendations}`
        : specific
          ? "●"
          : "";
      badge.classList.toggle("warning", !!recommendations);
      button.dataset.hasOverrides = String(specific);
      badge.title = recommendations
        ? `${recommendations} point(s) à vérifier`
        : specific
          ? "Réglages propres à cet écran"
          : "";
    }
  }
  function status() {
    $("#review-button").textContent = `Modifications — ${draft.length}`;
    review.update();
    responsiveIndicators();
    if (autoRecovered && !dirty()) {
      $("#recovery").replaceChildren();
      autoRecovered = false;
    }
    shell.dataset.editorState = frameReady ? "ready" : framePhase;
    state.textContent = !frameReady
      ? "Activation de l’éditeur…"
      : recoveryPending
        ? "Brouillon à récupérer"
        : busy
          ? "Enregistrement…"
          : dirty()
            ? "Modifications non enregistrées"
            : "Enregistré";
    state.classList.toggle("dirty", dirty());
    $("#undo").disabled = interactionMode !== "edit" || !history.canUndo;
    $("#redo").disabled = interactionMode !== "edit" || !history.canRedo;
    $("#save").disabled = busy || !dirty() || !frameReady || recoveryPending;
    $("#reset-page").disabled = busy || interactionMode !== "edit";
    persistDraft();
  }
  function flush() {
    if (inline.active) return;
    clearTimeout(pending);
    pending = null;
    history.push(draft);
    status();
  }
  function commit() {
    clearTimeout(pending);
    pending = setTimeout(flush, 350);
  }
  function preview(changedId = null) {
    const patched = changedId && stylePatcher?.apply(draft, changedId);
    const issues = patched ? runtime.issues : runtime?.render(draft) || [];
    if (issues.length)
      message(
        `${issues.length} cible(s) introuvable(s) ou modifiée(s). Aucun override appliqué à ces cibles.`,
        true,
      );
    status();
    updateOutline();
    syncQuick();
  }
  function entry() {
    return draft.find((e) => e.id === spec?.id) || spec;
  }
  function canModify() {
    if (responsiveGuard.busy) {
      message("Le test responsive est en cours. Attendez sa fin.", true);
      return false;
    }
    if (interactionMode !== "edit") {
      message("Revenez en mode Modifier pour retoucher cet élément.", true);
      return false;
    }
    if (!frameReady) {
      message(
        "L’éditeur n’est pas encore actif. Attendez son activation ou utilisez Réessayer.",
        true,
      );
      return false;
    }
    if (recoveryPending) {
      message(
        "Un brouillon local attend votre décision. Récupérez-le ou utilisez « Revenir à la sauvegarde » avant de retoucher.",
        true,
      );
      return false;
    }
    return true;
  }
  function modify(callback) {
    if (!spec || !canModify()) return;
    let item = draft.find((e) => e.id === spec.id);
    if (!item) {
      item = structuredClone(spec);
      draft.push(item);
    }
    callback(item);
    if (
      Object.values(item.changes).every(
        (values) => !Object.keys(values).length,
      ) &&
      !Object.keys(item.content || {}).length
    )
      draft = draft.filter((e) => e !== item);
    preview(spec.id);
    if (!drag && !inline.active) commit();
  }
  function setProperties(values) {
    const canonical = {};
    for (const [property, value] of Object.entries(values)) {
      canonical[property] = canonicalValue(property, value);
      if (canonical[property] === null) {
        message(
          "Ce réglage ne peut pas être appliqué. Aucune valeur n’a été modifiée.",
          true,
        );
        return false;
      }
    }
    if (recoveryPending) {
      message(
        "Récupérez le brouillon local ou revenez à la sauvegarde avant de retoucher.",
        true,
      );
      return;
    }
    message("");
    if (
      Object.entries(canonical).every(([property, value]) =>
        value === ""
          ? entry()?.changes[mode]?.[property] === undefined
          : entry()?.changes[mode]?.[property] === value,
      )
    )
      return true;
    modify((item) => {
      item.changes[mode] ||= {};
      for (const [property, value] of Object.entries(canonical)) {
        if (value === "") delete item.changes[mode][property];
        else item.changes[mode][property] = value;
      }
    });
    return true;
  }
  function setProperty(property, value) {
    return setProperties({ [property]: value });
  }
  // Overlay geometry: every read (frame, stage, targets) happens before any write,
  // so one call costs one layout instead of one per overlay or resize handle.
  function overlayGeometry() {
    const stage = $(".stage");
    return {
      frame: frame.getBoundingClientRect(),
      stage: stage.getBoundingClientRect(),
      scrollLeft: stage.scrollLeft,
      scrollTop: stage.scrollTop,
    };
  }
  function placeOverlay(box, rect, geometry) {
    if (!rect) {
      box.hidden = true;
      return;
    }
    const screen = viewport.rect(rect, geometry.frame),
      bounds = geometry.frame,
      stage = geometry.stage;
    const left = Math.max(screen.left, bounds.left),
      top = Math.max(screen.top, bounds.top);
    const r = {
      left,
      top,
      width: Math.max(0, Math.min(screen.right, bounds.right) - left),
      height: Math.max(0, Math.min(screen.bottom, bounds.bottom) - top),
    };
    box.hidden = r.width === 0 || r.height === 0;
    box.style.left = `${r.left - stage.left + geometry.scrollLeft}px`;
    box.style.top = `${r.top - stage.top + geometry.scrollTop}px`;
    box.style.width = `${r.width}px`;
    box.style.height = `${r.height}px`;
  }
  function rectOverlay(box, node) {
    placeOverlay(
      box,
      node?.isConnected ? node.getBoundingClientRect() : null,
      overlayGeometry(),
    );
  }
  // Scroll and resize can fire several times per frame (page and stage): the
  // outline follows them once per frame, in the same frame (no visible lag).
  function scheduleOutline() {
    if (!outlineFrame)
      outlineFrame = requestAnimationFrame(() => {
        outlineFrame = 0;
        updateOutline();
      });
  }
  function updateOutline() {
    if (outlineFrame) {
      cancelAnimationFrame(outlineFrame);
      outlineFrame = 0;
    }
    if (interactionMode !== "edit") {
      $(".hover").hidden = true;
      $(".selected").hidden = true;
      $("#handles").hidden = true;
      contextual.hide();
      return;
    }
    // Reads.
    const geometry = overlayGeometry();
    const hoverTarget =
      editable(hoverNode) && hoverNode !== selected && hoverNode.isConnected
        ? hoverNode
        : null;
    const hoverRect = hoverTarget?.getBoundingClientRect() || null;
    const rect = selected?.getBoundingClientRect() || null;
    let quad = null;
    if (selected)
      try {
        quad = visualQuad(selected);
      } catch {}
    const dimensions = $("#dimensions");
    const size = selected && dimensions ? dimensionsOf(selected) : null;
    // Writes.
    placeOverlay($(".hover"), hoverRect, geometry);
    placeOverlay($(".selected"), selected?.isConnected ? rect : null, geometry);
    if (!selected) {
      contextual.hide();
      $("#handles").hidden = true;
      return;
    }
    if (!drag)
      contextual.position(viewport.rect(rect, geometry.frame), geometry.frame);
    $(".selected").classList.toggle("cropping", cropMode);
    if (!quad) $("#handles").hidden = true;
    else {
      $("#handles").hidden =
        cropMode ||
        inline.active ||
        !(selected.localName === "img" || !canEditText(selected));
      const bounds = geometry.frame;
      for (const button of $("#handles").children) {
        const point = viewport.point(
          quad[button.dataset.corner],
          geometry.frame,
        );
        button.hidden =
          point.x < bounds.left ||
          point.x > bounds.right ||
          point.y < bounds.top ||
          point.y > bounds.bottom;
        button.style.left = `${point.x - geometry.stage.left + geometry.scrollLeft}px`;
        button.style.top = `${point.y - geometry.stage.top + geometry.scrollTop}px`;
      }
    }
    if (size)
      dimensions.textContent = `${Math.round(size.width)} × ${Math.round(size.height)} px`;
  }
  function choose(node) {
    clickCandidate = null;
    selectedBackgroundLayer = null;
    hoverNode = null;
    $(".hover").hidden = true;
    node = selectionTarget(node);
    inline.finish();
    cropMode = false;
    flush();
    if (!node) {
      selected = null;
      spec = null;
      navigation.sync(null);
      renderPanel();
      viewport.layout();
      updateOutline();
      return;
    }
    try {
      const existing = [...runtime.targets].find(
        ([, target]) => target === node,
      );
      spec = existing
        ? structuredClone(draft.find((e) => e.id === existing[0]))
        : identify(node);
      spec.changes = {};
      delete spec.content;
      selected = node;
      navigation.sync(selected, true);
      message(
        spec.strategy === "hierarchy"
          ? "Élément sélectionné. Ses réglages sont disponibles à droite."
          : "",
      );
      $(".selected span").textContent = labelFor(node);
      $("#properties").hidden = false;
      renderPanel();
      // The new panel width must be reflected before a move/resize can start.
      viewport.layout();
      updateOutline();
    } catch (error) {
      message(error.message, true);
    }
  }
  function group(title, key, open = false) {
    const details = document.createElement("details");
    details.open = open;
    details.dataset.group = key;
    const summary = document.createElement("summary");
    summary.textContent = title;
    details.append(summary);
    const fields = document.createElement("div");
    fields.className = "fields";
    details.append(fields);
    const resetKey = {
      size: "position",
      spacing: "spacing",
      alignment: "alignment",
    }[key];
    if (resetKey) resetGroupControl(details, resetKey);
    panel.append(details);
    return fields;
  }
  function resetGroupControl(container, key) {
    const names = {
      position: "Position",
      spacing: "Espacement",
      alignment: "Alignement",
    };
    const button = document.createElement("button");
    button.className = "subtle reset-group";
    button.dataset.resetGroup = key;
    button.textContent = `Réinitialiser ${names[key]}`;
    button.addEventListener("click", () => {
      flush();
      const values = entry()?.changes[mode] || {};
      if (
        setProperties(
          Object.fromEntries(
            groupProperties(key, values, selected).map((property) => [
              property,
              "",
            ]),
          ),
        )
      ) {
        flush();
        renderPanel();
        message(
          `${names[key]} réinitialisé pour cet écran. Les autres réglages sont conservés.`,
        );
      }
    });
    container.append(button);
  }
  const choiceNames = {
    static: "Dans la page",
    relative: "Décalage autorisé",
    sticky: "Rester visible",
    auto: "Automatique",
    none: "Aucun",
    normal: "Normal",
    italic: "Italique",
    start: "Au début",
    end: "À la fin",
    left: "Gauche",
    right: "Droite",
    center: "Centré",
    justify: "Justifié",
    stretch: "Étirer",
    baseline: "Sur la ligne du texte",
    "space-between": "Répartir",
    "space-around": "Espacer autour",
    "space-evenly": "Espacer également",
    cover: "Remplir le cadre",
    contain: "Afficher en entier",
    fill: "Étirer",
    "scale-down": "Réduire si nécessaire",
    visible: "Afficher",
    hidden: "Masquer",
    solid: "Trait continu",
    dashed: "Tirets",
    dotted: "Points",
    uppercase: "MAJUSCULES",
    lowercase: "minuscules",
    capitalize: "Initiales",
    100: "Très fin",
    200: "Fin",
    300: "Léger",
    400: "Normal",
    500: "Moyen",
    600: "Semi-gras",
    700: "Gras",
    800: "Très gras",
    900: "Extra-gras",
  };
  function resetControl(container, property, label) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reset-control";
    button.dataset.resetProperty = property;
    button.disabled = entry()?.changes[mode]?.[property] === undefined;
    button.textContent = "↺";
    button.title = `Réinitialiser ce réglage : ${label}`;
    button.setAttribute("aria-label", button.title);
    button.addEventListener("click", (event) => {
      event.preventDefault();
      flush();
      setProperty(property, "");
      flush();
      renderPanel();
    });
    container.append(button);
  }
  function control(container, property, label, options = {}) {
    const wrap = document.createElement("div");
    wrap.className = "field";
    const title = document.createElement("span");
    title.textContent = label;
    if (
      mode !== "desktop" &&
      entry()?.changes[mode]?.[property] !== undefined
    ) {
      const badge = document.createElement("small");
      badge.className = "exception";
      badge.textContent = mode === "mobile" ? "Mobile" : "Tablette";
      title.append(badge);
    }
    const origin = propertyOrigin(entry(), mode, property);
    if (origin && origin !== mode) {
      const inherited = document.createElement("small");
      inherited.className = "inherited-label";
      inherited.dataset.inheritedFrom = origin;
      inherited.textContent = `Héritée de ${origin === "desktop" ? "Desktop" : "Tablette"}`;
      title.append(inherited);
    }
    wrap.append(title);
    resetControl(wrap, property, label);
    const current = entry()?.changes[mode]?.[property];
    const effective = effectiveProperties(entry(), mode)[property];
    const computed = frame.contentWindow
      .getComputedStyle(selected)
      .getPropertyValue(property);
    const inherited =
      property === "translateX" || property === "translateY"
        ? "0px"
        : computed.trim();
    if (property === "opacity") {
      const range = document.createElement("input");
      range.type = "range";
      range.min = "0";
      range.max = "100";
      range.value = String(Math.round(Number(current ?? computed) * 100));
      range.dataset.property = property;
      range.setAttribute("aria-label", label);
      const output = document.createElement("output");
      output.textContent = range.value + " %";
      wrap.append(range, output);
      range.addEventListener("input", () => {
        output.textContent = range.value + " %";
        setProperty(property, String(Number(range.value) / 100));
      });
      range.addEventListener("change", () => {
        if (!inline.active) flush();
      });
      container.append(wrap);
      return range;
    }
    if (
      ["color", "background-color", "border-color", "overlay-color"].includes(
        property,
      )
    ) {
      const color = colorControl(document, {
        label,
        value: current ?? toHex(computed) ?? effective ?? "",
        siteColors,
        storageKey: colorStorageKey,
        onChange: (value) => setProperty(property, value),
        onCommit: flush,
      });
      resetControl(color, property, label);
      color.dataset.property = property;
      container.append(color);
      return color;
    }
    let input;
    if (options.choices) {
      input = document.createElement("select");
      for (const [value, name] of [
        ["", "Valeur du site"],
        ...options.choices.map((v) => [v, choiceNames[v] || v]),
      ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = name;
        input.append(option);
      }
    } else {
      input = document.createElement("input");
      input.type = "text";
      input.autocomplete = "off";
      input.spellcheck = false;
      input.placeholder = effective ?? inherited;
      input.title =
        "Entrez une valeur ; sans unité, la taille est en pixels. Vide : valeur du site.";
      if (!["z-index"].includes(property)) input.inputMode = "decimal";
    }
    input.value = current ?? "";
    input.dataset.property = property;
    input.setAttribute("aria-label", label);
    input.addEventListener("input", () => {
      const value = canonicalValue(property, input.value, true);
      const valid = value !== null;
      input.setCustomValidity(
        valid ? "" : "Cette valeur ne peut pas être utilisée.",
      );
      input.classList.toggle("invalid", !valid);
      if (valid) {
        if (
          property === "text-align" &&
          value !== "" &&
          ["inline", "contents", "none"].includes(
            frame.contentWindow.getComputedStyle(selected).display,
          )
        ) {
          input.value = entry()?.changes[mode]?.[property] ?? "";
          message(
            "Ce texte est en ligne ou sans cadre. Alignez le texte de son bloc parent.",
            true,
          );
          return;
        }
        if (options.onValue) options.onValue(value);
        else setProperty(property, value);
        if (value === "" && input.localName === "input")
          input.placeholder =
            effectiveProperties(entry(), mode)[property] ??
            (property === "translateX" || property === "translateY"
              ? "0px"
              : frame.contentWindow
                  .getComputedStyle(selected)
                  .getPropertyValue(property)
                  .trim());
        syncQuick();
      } else
        message(
          "Cette valeur ne convient pas. Le dernier réglage valide reste appliqué.",
          true,
        );
    });
    input.addEventListener("change", () => {
      if (!inline.active) flush();
    });
    wrap.append(input);
    container.append(wrap);
    return input;
  }
  function fontControl(container) {
    const label = document.createElement("label");
    label.className = "field full";
    label.textContent = "Police";
    const select = document.createElement("select");
    select.dataset.property = "font-family";
    select.setAttribute("aria-label", "Police");
    const computed = frame.contentWindow.getComputedStyle(selected).fontFamily;
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Police du site";
    select.append(option);
    for (const [role, family] of Object.entries(
      config.editor.siteStyle?.fonts || {},
    )) {
      const option = document.createElement("option");
      option.value = family;
      option.textContent = `${fontRoles[role]} — ${fontLabel(family)}`;
      if (frame.contentDocument.fonts.check("16px " + family))
        option.style.fontFamily = family;
      select.append(option);
    }
    for (const name of fonts) {
      const option = document.createElement("option");
      option.value = fontValue(name);
      option.textContent = fontLabel(name);
      option.style.fontFamily = option.value;
      select.append(option);
    }
    const value = entry()?.changes[mode]?.["font-family"] ?? "";
    if (value && ![...select.options].some((o) => o.value === value)) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value.replaceAll('"', "");
      select.append(option);
    }
    select.value = value;
    select.title = computed;
    select.addEventListener("change", () => {
      setProperty("font-family", select.value);
      if (!inline.active) flush();
      syncQuick();
    });
    label.append(select);
    container.append(label);
  }
  function typography(container) {
    fontControl(container);
    control(container, "font-size", "Taille");
    control(container, "font-weight", "Graisse", {
      choices: ["300", "400", "500", "600", "700", "800", "900"],
    });
    control(container, "font-style", "Style", {
      choices: ["normal", "italic"],
    });
    control(container, "line-height", "Interligne");
    control(container, "letter-spacing", "Espacement des lettres");
    control(container, "text-transform", "Casse", {
      choices: ["none", "uppercase", "lowercase", "capitalize"],
    });
    control(container, "text-align", "Alignement", {
      choices: ["left", "center", "right", "justify"],
    });
  }
  function radiusControl(container) {
    const label = document.createElement("label");
    label.className = "field full";
    label.textContent = "Arrondi";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Preset d’arrondi");
    select.dataset.radiusPreset = "";
    const choices = [
      ["", "Valeur du site"],
      ["0px", "Aucun"],
      ["4px", "Léger"],
      ["16px", "Arrondi"],
      ["32px", "Très arrondi"],
      ["9999px", "Pilule"],
      ["custom", "Personnaliser"],
    ];
    if (config.editor.siteStyle?.radius)
      choices.splice(1, 0, [config.editor.siteStyle.radius, "Arrondi du site"]);
    for (const [value, name] of choices) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      select.append(option);
    }
    const current = entry()?.changes[mode]?.["border-radius"] || "";
    select.value = choices.some(([value]) => value === current)
      ? current
      : "custom";
    const custom = document.createElement("details");
    custom.className = "full";
    custom.dataset.radiusCustom = "";
    custom.open = select.value === "custom";
    const summary = document.createElement("summary");
    summary.textContent = "Personnaliser l’arrondi";
    custom.append(summary);
    control(custom, "border-radius", "Arrondi personnalisé");
    select.addEventListener("change", () => {
      custom.open = select.value === "custom";
      if (select.value !== "custom") {
        flush();
        setProperty("border-radius", select.value);
        flush();
        custom.querySelector("input").value = select.value;
      }
    });
    label.append(select);
    container.append(label, custom);
  }
  function spacingControls(container) {
    for (const [prefix, label] of [
      ["margin", "Espace extérieur"],
      ["padding", "Espace intérieur"],
    ]) {
      const box = document.createElement("div");
      box.className = "spacing-box";
      const header = document.createElement("div");
      header.className = "spacing-title";
      header.textContent = label;
      const link = document.createElement("label");
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      link.append(checkbox, document.createTextNode(" Lier"));
      header.append(link);
      box.append(header);
      const preset = document.createElement("select");
      preset.dataset.spacingPreset = prefix;
      preset.setAttribute("aria-label", `Preset ${label.toLowerCase()}`);
      for (const [value, name] of [
        ["", "Personnalisé / valeur du site"],
        ["0px", "Aucun"],
        ["8px", "Petit"],
        ["16px", "Moyen"],
        ["32px", "Grand"],
      ]) {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = name;
        preset.append(option);
      }
      preset.addEventListener("change", () => {
        if (preset.value === "") return;
        flush();
        if (
          setProperties(
            Object.fromEntries(
              ["top", "right", "bottom", "left"].map((side) => [
                `${prefix}-${side}`,
                preset.value,
              ]),
            ),
          )
        ) {
          flush();
          for (const input of grid.querySelectorAll("input"))
            input.value = preset.value;
        }
      });
      box.append(preset);
      const grid = document.createElement("div");
      grid.className = "spacing-grid";
      box.append(grid);
      const inputs = ["top", "right", "bottom", "left"].map((side, index) => {
        const input = control(
          grid,
          `${prefix}-${side}`,
          ["Haut", "Droite", "Bas", "Gauche"][index],
          {
            onValue: (value) => {
              if (checkbox.checked) {
                setProperties(
                  Object.fromEntries(
                    ["top", "right", "bottom", "left"].map((side) => [
                      `${prefix}-${side}`,
                      value,
                    ]),
                  ),
                );
                for (const sibling of grid.querySelectorAll(
                  "input[data-property]",
                ))
                  if (sibling !== input) sibling.value = value;
              } else setProperty(`${prefix}-${side}`, value);
            },
          },
        );
        input.parentElement.dataset.side = side;
        return input;
      });
      const center = document.createElement("span");
      center.className = "spacing-center";
      center.textContent = prefix === "margin" ? "Élément" : "Contenu";
      grid.append(center);
      container.append(box);
    }
    const display = frame.contentWindow.getComputedStyle(selected).display;
    if (display.includes("flex") || display.includes("grid"))
      control(container, "gap", "Entre les éléments");
  }
  function alignCommand(scope, axis, value) {
    inline.finish();
    flush();
    const plan = (scope === "element" ? alignElement : alignContent)(
      selected,
      axis,
      value,
    );
    if (plan.error) {
      message(plan.error, true);
      return;
    }
    if (setProperties(plan.properties)) {
      flush();
      renderPanel();
      message(
        "Alignement appliqué. Déplacer reste disponible pour la finition.",
      );
    }
  }
  function alignment(container) {
    for (const [scope, title] of [
      ["element", "Aligner l’élément"],
      ["content", "Aligner le contenu"],
    ]) {
      const box = document.createElement("div");
      box.className = "alignment-box full";
      const heading = document.createElement("strong");
      heading.textContent = title;
      box.append(heading);
      for (const [axis, values, icons] of [
        ["horizontal", ["left", "center", "right"], ["⇤", "↔", "⇥"]],
        ["vertical", ["top", "center", "bottom"], ["⇡", "↕", "⇣"]],
      ]) {
        const row = document.createElement("div");
        row.className = "align-actions";
        values.forEach((value, index) => {
          const name =
            axis === "horizontal"
              ? ["Gauche", "Centrer horizontalement", "Droite"][index]
              : ["Haut", "Milieu", "Bas"][index];
          const button = document.createElement("button");
          button.textContent = `${icons[index]} ${name}`;
          button.dataset.alignScope = scope;
          button.dataset.alignAxis = axis;
          button.dataset.alignValue = value;
          button.title = `${title} : ${name}`;
          button.setAttribute("aria-label", button.title);
          button.addEventListener("click", () =>
            alignCommand(scope, axis, value),
          );
          row.append(button);
        });
        box.append(row);
      }
      container.append(box);
    }
    if (canEditText(selected))
      control(container, "text-align", "Alignement du texte", {
        choices: ["left", "center", "right", "justify"],
      });
  }
  function appearanceExtras(container) {
    const label = document.createElement("label");
    label.className = "field full";
    label.textContent = "Ombre";
    const select = document.createElement("select");
    select.dataset.property = "box-shadow";
    const presets = [
      ["", "Valeur du site"],
      ["none", "Aucune"],
      ["0px 2px 8px 0px #163b3026", "Légère"],
      ["0px 8px 20px 0px #163b3033", "Moyenne"],
      ["0px 16px 36px 0px #163b304d", "Forte"],
      ["custom", "Personnalisée"],
    ];
    if (config.editor.siteStyle?.shadow)
      presets.splice(1, 0, [config.editor.siteStyle.shadow, "Ombre du site"]);
    for (const [value, name] of presets) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = name;
      select.append(option);
    }
    const current = entry().changes[mode]?.["box-shadow"] || "";
    select.value = presets.some(([value]) => value === current)
      ? current
      : "custom";
    label.append(select);
    container.append(label);
    const custom = document.createElement("div");
    custom.className = "shadow-custom";
    container.append(custom);
    function customFields(value) {
      custom.replaceChildren();
      custom.hidden = select.value !== "custom";
      if (custom.hidden) return;
      const parts = (value || "0px 8px 20px 0px #163b3033").split(" ");
      const inputs = [];
      const apply = () => {
        const values = inputs.map((input) => `${input.value || 0}px`);
        const alpha = Math.round(Number(opacity.value) * 2.55)
          .toString(16)
          .padStart(2, "0");
        const shadow = `${values.join(" ")} ${color.value}${alpha}`;
        if (validValue("box-shadow", shadow)) setProperty("box-shadow", shadow);
      };
      for (const [index, name] of [
        "Horizontal",
        "Vertical",
        "Diffusion",
        "Étendue",
      ].entries()) {
        const wrap = document.createElement("label");
        wrap.textContent = name;
        const input = document.createElement("input");
        input.type = "number";
        input.min = index === 2 ? "0" : "-999";
        input.max = "999";
        input.value = parseInt(parts[index]) || 0;
        input.addEventListener("input", apply);
        input.addEventListener("change", flush);
        inputs.push(input);
        wrap.append(input);
        custom.append(wrap);
      }
      const color = document.createElement("input");
      color.type = "color";
      color.value = parts[4]?.slice(0, 7) || "#163b30";
      color.setAttribute("aria-label", "Couleur de l’ombre");
      const opacity = document.createElement("input");
      opacity.type = "range";
      opacity.min = "0";
      opacity.max = "100";
      opacity.value = String(
        Math.round(parseInt(parts[4]?.slice(7) || "33", 16) / 2.55),
      );
      opacity.setAttribute("aria-label", "Opacité de l’ombre");
      for (const input of [color, opacity]) {
        input.addEventListener("input", apply);
        input.addEventListener("change", flush);
        custom.append(input);
      }
    }
    customFields(current);
    select.addEventListener("change", () => {
      const value =
        select.value === "custom" ? "0px 8px 20px 0px #163b3033" : select.value;
      flush();
      setProperty("box-shadow", value);
      flush();
      customFields(value);
    });
    const blur = document.createElement("label");
    blur.className = "field full";
    blur.textContent = "Flou";
    const range = document.createElement("input");
    range.type = "range";
    range.min = "0";
    range.max = "12";
    range.value = parseInt(
      effectiveProperties(entry(), mode).filter?.match(/\d+/)?.[0] || "0",
    );
    range.dataset.property = "filter";
    range.addEventListener("input", () =>
      setProperty(
        "filter",
        Number(range.value) ? `blur(${range.value}px)` : "none",
      ),
    );
    range.addEventListener("change", flush);
    blur.append(range);
    container.append(blur);
    if (
      assetInfo(selected)?.kind === "background" &&
      assetInfo(selected).replaceable
    ) {
      control(container, "overlay-color", "Voile de couleur");
      const label = document.createElement("label");
      label.className = "field full";
      label.textContent = "Intensité du voile";
      const range = document.createElement("input");
      range.type = "range";
      range.min = "0";
      range.max = "100";
      const value =
        effectiveProperties(entry(), mode)["overlay-color"] || "#00000000";
      range.value =
        value.length === 9
          ? Math.round(parseInt(value.slice(7), 16) / 2.55)
          : value === "transparent"
            ? 0
            : 100;
      range.addEventListener("input", () => {
        const value =
          effectiveProperties(entry(), mode)["overlay-color"] || "#000000";
        const hex = /^#[a-f\d]{6,8}$/i.test(value)
          ? value.slice(0, 7)
          : "#000000";
        setProperty(
          "overlay-color",
          hex +
            Math.round(Number(range.value) * 2.55)
              .toString(16)
              .padStart(2, "0"),
        );
      });
      range.addEventListener("change", flush);
      label.append(range);
      container.append(label);
    }
  }
  function imageControls(container) {
    const background = assetInfo(selected)?.kind === "background";
    const positionProperty = background
      ? "background-position"
      : "object-position";
    const fitProperty = background ? "background-size" : "object-fit";
    const replace = document.createElement("button");
    replace.textContent = "Remplacer l’image";
    replace.id = "replace-image";
    replace.className = "full";
    replace.addEventListener("click", replaceImage);
    if (assetInfo(selected)?.replaceable) container.append(replace);
    const choices = document.createElement("div");
    choices.className = "fit-options full";
    choices.setAttribute("aria-label", "Affichage de l’image");
    for (const [value, label] of [
      ["cover", "Couvrir"],
      ["contain", "Contenir"],
      [background ? "auto" : "none", "Taille réelle"],
    ]) {
      const button = document.createElement("button");
      button.textContent = label;
      button.dataset.fit = value;
      button.setAttribute(
        "aria-pressed",
        String(
          (effectiveProperties(entry(), mode)[fitProperty] ||
            frame.contentWindow
              .getComputedStyle(selected)
              .getPropertyValue(fitProperty)) === value,
        ),
      );
      button.addEventListener("click", () => {
        setProperty(fitProperty, value);
        if (background) setProperty("background-repeat", "no-repeat");
        flush();
        for (const sibling of choices.children)
          sibling.setAttribute("aria-pressed", String(sibling === button));
      });
      choices.append(button);
    }
    container.append(choices);
    if (
      background ||
      frame.contentWindow.CSS.supports("object-view-box", "inset(5%)")
    ) {
      const label = document.createElement("label");
      label.className = "field full";
      label.textContent = "Zoom";
      const zoom = document.createElement("input");
      zoom.type = "range";
      zoom.min = "100";
      zoom.max = "180";
      zoom.value = effectiveProperties(entry(), mode).imageZoom || "100";
      zoom.dataset.property = "imageZoom";
      zoom.addEventListener("input", () =>
        setProperty("imageZoom", zoom.value),
      );
      zoom.addEventListener("change", flush);
      label.append(zoom);
      container.append(label);
    }
    const pad = document.createElement("div");
    pad.className = "crop-pad full";
    pad.setAttribute("role", "slider");
    pad.tabIndex = 0;
    pad.setAttribute("aria-label", "Position de l’image");
    pad.setAttribute("aria-valuemin", "0");
    pad.setAttribute("aria-valuemax", "100");
    const dot = document.createElement("span");
    pad.append(dot);
    container.append(pad);
    let values = (
      effectiveProperties(entry(), mode)[positionProperty] ||
      frame.contentWindow
        .getComputedStyle(selected)
        .getPropertyValue(positionProperty)
    )
      .split(" ")
      .map(parseFloat);
    if (values.some((v) => !Number.isFinite(v))) values = [50, 50];
    const draw = () => {
      dot.style.left = values[0] + "%";
      dot.style.top = values[1] + "%";
      pad.setAttribute("aria-valuenow", String(values[0]));
      pad.setAttribute(
        "aria-valuetext",
        `Horizontal ${values[0]} %, vertical ${values[1]} %`,
      );
    };
    draw();
    const set = (event) => {
      const rect = pad.getBoundingClientRect();
      values = [
        Math.round(
          Math.max(
            0,
            Math.min(100, ((event.clientX - rect.left) / rect.width) * 100),
          ),
        ),
        Math.round(
          Math.max(
            0,
            Math.min(100, ((event.clientY - rect.top) / rect.height) * 100),
          ),
        ),
      ];
      draw();
      setProperty(positionProperty, `${values[0]}% ${values[1]}%`);
    };
    pad.addEventListener("pointerdown", (event) => {
      event.preventDefault();
      pad.setPointerCapture(event.pointerId);
      pad.dataset.dragging = "yes";
      flush();
      set(event);
    });
    pad.addEventListener("pointermove", (event) => {
      if (pad.dataset.dragging) set(event);
    });
    const stop = () => {
      delete pad.dataset.dragging;
      flush();
    };
    pad.addEventListener("pointerup", stop);
    pad.addEventListener("pointercancel", stop);
    pad.addEventListener("keydown", (event) => {
      const axis = ["ArrowLeft", "ArrowRight"].includes(event.key) ? 0 : 1;
      if (
        !["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key)
      )
        return;
      event.preventDefault();
      values[axis] = Math.max(
        0,
        Math.min(
          100,
          values[axis] +
            (["ArrowLeft", "ArrowUp"].includes(event.key) ? -5 : 5),
        ),
      );
      draw();
      setProperty(positionProperty, `${values[0]}% ${values[1]}%`);
      flush();
    });
    const hint = document.createElement("p");
    hint.className = "note full";
    hint.textContent =
      "Déplacez le point pour cadrer l’image, ou activez « Recadrer » pour la glisser dans son cadre.";
    container.append(hint);
    const center = document.createElement("button");
    center.textContent = "Centrer l’image";
    center.addEventListener("click", () => {
      values = [50, 50];
      draw();
      setProperty(positionProperty, "50% 50%");
      flush();
    });
    container.append(center);
    const crop = document.createElement("button");
    crop.textContent = cropMode
      ? "Terminer le cadrage"
      : "Recadrer dans la page";
    crop.addEventListener("click", toggleCrop);
    container.append(crop);
  }
  function renderPanel() {
    if (!selected) $("#properties").hidden = true;
    $("#toggle-panel").disabled = !selected;
    $("#toggle-panel").setAttribute(
      "aria-expanded",
      String(!$("#properties").hidden),
    );
    panel.replaceChildren();
    if (!selected) {
      contextual.hide();
      return;
    }
    const head = document.createElement("div");
    head.className = "panel-heading";
    const heading = document.createElement("h2");
    heading.textContent = labelFor(selected);
    head.append(heading);
    const close = document.createElement("button");
    close.textContent = "×";
    close.setAttribute("aria-label", "Masquer les propriétés");
    close.addEventListener("click", () => $("#toggle-panel").click());
    head.append(close);
    const dimensions = document.createElement("span");
    dimensions.id = "dimensions";
    head.append(dimensions);
    panel.append(head);
    const modeInfo = document.createElement("p");
    modeInfo.className = "mode-note";
    modeInfo.textContent =
      mode === "desktop"
        ? "Réglages pour tous les écrans"
        : `Réglages ${mode === "mobile" ? "mobile" : "tablette"} · les valeurs personnalisées sont indiquées`;
    panel.append(modeInfo);
    const comforts = document.createElement("details");
    comforts.className = "element-actions";
    const summary = document.createElement("summary");
    summary.textContent = "Actions de l’élément";
    comforts.append(summary);
    for (const [name, run] of [
      [
        "Copier le style",
        () => {
          const values = effectiveProperties(entry(), mode);
          copiedStyle = Object.fromEntries(
            Object.entries(values).filter(
              ([key]) =>
                ![
                  "translateX",
                  "translateY",
                  "position",
                  "z-index",
                  "visibility",
                ].includes(key),
            ),
          );
          message(
            Object.keys(copiedStyle).length
              ? "Style copié : couleurs, texte, taille et espaces. Le contenu et le déplacement sont conservés."
              : "Cet élément n’a aucun style personnalisé à copier.",
            !Object.keys(copiedStyle).length,
          );
        },
      ],
      [
        "Coller le style",
        () => {
          if (!copiedStyle || !Object.keys(copiedStyle).length) {
            message("Copiez d’abord le style d’un élément personnalisé.", true);
            return;
          }
          flush();
          if (setProperties(copiedStyle)) {
            flush();
            renderPanel();
            message(
              "Style collé pour cet écran. Vous pouvez annuler cette action.",
            );
          }
        },
      ],
    ]) {
      const button = document.createElement("button");
      button.textContent = name;
      button.addEventListener("click", run);
      comforts.append(button);
    }
    panel.append(comforts);
    const content = group("Contenu", "content", true);
    if (assetInfo(selected)?.kind !== "svg" && assetInfo(selected))
      imageControls(content);
    if (canEditText(selected)) {
      const edit = document.createElement("button");
      edit.className = "full primary";
      edit.textContent = inline.active
        ? "Terminer le texte"
        : "Modifier le texte dans la page";
      edit.dataset.inlineEdit = "";
      edit.addEventListener("click", () =>
        inline.active ? inline.finish() : startInline(),
      );
      content.append(edit);
      const wrap = document.createElement("label");
      wrap.className = "text-field";
      wrap.textContent = "Texte";
      const input = document.createElement("textarea");
      input.value = entry().content?.text ?? selected.textContent;
      input.maxLength = 4000;
      input.disabled = inline.active;
      input.addEventListener("input", () => {
        inline.finish();
        modify((item) => {
          item.content ||= {};
          item.content.text = input.value;
        });
      });
      input.addEventListener("change", flush);
      wrap.append(input);
      content.append(wrap);
    }
    if (selected.localName === "a") linkControl(content);
    if (assetInfo(selected)?.kind === "background") backgroundControls(content);
    if (!content.children.length) {
      const note = document.createElement("p");
      note.className = "note full";
      note.textContent =
        "Cette zone contient des éléments du site. Sélectionnez un texte ou une image pour en modifier le contenu.";
      content.append(note);
    }
    const sizes = group("Taille et position", "size");
    movementControls(sizes);
    for (const [prop, label] of [
      ["width", "Largeur"],
      ["height", "Hauteur"],
      ["max-width", "Largeur maximale"],
      ["min-width", "Largeur minimale"],
      ["translateX", "Déplacer horizontalement"],
      ["translateY", "Déplacer verticalement"],
    ])
      control(sizes, prop, label);
    alignment(group("Alignement", "alignment"));
    if (selected.localName === "img") {
      const label = document.createElement("label");
      label.className = "link-values full";
      const ratio = document.createElement("input");
      ratio.type = "checkbox";
      ratio.checked = lockRatio;
      ratio.addEventListener("change", () => (lockRatio = ratio.checked));
      label.append(
        ratio,
        document.createTextNode(" Conserver les proportions"),
      );
      sizes.append(label);
    }
    spacingControls(group("Espacement", "spacing"));
    const appearance = group("Style", "style");
    control(appearance, "background-color", "Fond");
    if (selected.localName !== "img") control(appearance, "color", "Couleur");
    radiusControl(appearance);
    for (const [prop, label] of [
      ["opacity", "Opacité"],
      ["border-width", "Épaisseur de bordure"],
    ])
      control(appearance, prop, label);
    control(appearance, "border-style", "Bordure", {
      choices: ["none", "solid", "dashed", "dotted"],
    });
    control(appearance, "border-color", "Couleur de bordure");
    appearanceExtras(appearance);
    if (selected.localName !== "img" && selected.textContent.trim())
      typography(group("Texte", "text"));
    const responsive = group("Responsive", "responsive");
    const note = document.createElement("p");
    note.className = "note full";
    note.textContent =
      "Choisissez l’écran en haut. Les réglages du site sont conservés tant que vous ne les personnalisez pas.";
    responsive.append(note);
    control(responsive, "visibility", "Afficher cet élément", {
      choices: ["visible", "hidden"],
    });
    const advanced = group("Réglages avancés", "advanced");
    control(advanced, "position", "Comportement", {
      choices: ["static", "relative", "sticky"],
    });
    control(advanced, "z-index", "Ordre des plans");
    if (assetInfo(selected)?.kind !== "svg" && assetInfo(selected))
      control(
        advanced,
        assetInfo(selected).kind === "background"
          ? "background-position"
          : "object-position",
        "Position précise",
      );
    const info = document.createElement("div");
    info.className = "info full";
    for (const text of [
      `<${selected.localName}>${selected.id ? ` #${selected.id}` : ""}`,
      [...selected.classList].join(" "),
      spec.selector,
    ]) {
      const line = document.createElement("code");
      line.textContent = text;
      info.append(line);
    }
    advanced.append(info);
    const reset = document.createElement("button");
    reset.textContent = "Réinitialiser cet élément";
    reset.id = "reset-element";
    reset.className = "reset-element";
    reset.addEventListener("click", () => {
      if (recoveryPending) {
        message("Récupérez le brouillon avant de réinitialiser.", true);
        return;
      }
      inline.finish();
      flush();
      draft = draft.filter((e) => e.id !== spec.id);
      history.push(draft);
      preview();
      renderPanel();
      message("Élément réinitialisé. Enregistrez pour conserver ce retour.");
    });
    const resetMode = document.createElement("button");
    resetMode.id = "reset-breakpoint";
    resetMode.textContent = `Réinitialiser les réglages ${mode === "mobile" ? "Mobile" : mode === "tablet" ? "Tablette" : "Desktop"}`;
    resetMode.disabled = !Object.keys(entry()?.changes[mode] || {}).length;
    resetMode.addEventListener("click", () => {
      if (recoveryPending) {
        message("Récupérez le brouillon avant de réinitialiser.", true);
        return;
      }
      inline.finish();
      flush();
      const item = draft.find((e) => e.id === spec.id);
      if (item) {
        delete item.changes[mode];
        if (!Object.keys(item.changes).length && !item.content)
          draft = draft.filter((e) => e.id !== spec.id);
      }
      history.push(draft);
      preview();
      renderPanel();
      message(
        "Réglages de cet écran réinitialisés. Enregistrez pour conserver ce retour.",
      );
    });
    panel.append(resetMode);
    panel.append(reset);
    renderContext();
    updateOutline();
  }
  function backgroundControls(container) {
    const layers = backgroundLayerModel(selected),
      heading = document.createElement("p");
    heading.textContent = `Fond — ${layers.length} couche(s)`;
    container.append(heading);
    for (const layer of layers) {
      const row = document.createElement("div");
      row.className = "background-layer";
      let name = layer.kind === "gradient" ? "Dégradé" : "Composition du thème";
      if (layer.src) {
        try {
          name = decodeURIComponent(
            new URL(layer.src, frame.contentDocument.baseURI).pathname
              .split("/")
              .pop(),
          );
        } catch {
          name = "Image";
        }
      }
      const label = document.createElement("span");
      label.textContent = `${layer.index + 1}. ${name}`;
      row.append(label);
      if (layer.src && layer.index < 20) {
        const button = document.createElement("button");
        button.type = "button";
        button.textContent = "Remplacer";
        button.dataset.backgroundLayer = layer.index;
        button.onclick = () => replaceImage(layer.index);
        row.append(button);
      }
      container.append(row);
    }
  }
  function replaceImage(layer = null) {
    if (!selected || !canModify()) return;
    const layers =
      assetInfo(selected)?.kind === "background"
        ? backgroundLayerModel(selected)
        : [];
    if (layers.length > 1 && !Number.isInteger(layer)) {
      contextual.open("Images du fond", backgroundControls);
      updateOutline();
      return;
    }
    inline.finish();
    if (!window.wp?.media) {
      message("La médiathèque n’est pas disponible.", true);
      return;
    }
    if (!assetInfo(selected)?.replaceable) {
      message(
        "Cette composition ne possède pas de couche image remplaçable. Elle reste contrôlée par le thème.",
        true,
      );
      return;
    }
    const background = assetInfo(selected).kind === "background";
    const targetLayer = Number.isInteger(layer)
      ? layer
      : layers.find((l) => l.src)?.index;
    if (background && (targetLayer >= 20 || !layers[targetLayer]?.src)) {
      message("Cette couche complexe reste contrôlée par le thème.", true);
      return;
    }
    const targetId = spec.id;
    const media = window.wp.media({
      title: "Remplacer cette image",
      library: { type: "image" },
      button: { text: "Utiliser cette image" },
      multiple: false,
    });
    media.on("select", () => {
      if (spec?.id !== targetId) return;
      const asset = media.state().get("selection").first().toJSON();
      flush();
      modify((item) => {
        item.content ||= {};
        if (background && layers.length > 1) {
          item.content.backgroundLayers ||= [];
          if (item.content.attachmentId) {
            item.content.backgroundLayers.push({
              layer: layers.find((l) => l.src).index,
              attachmentId: item.content.attachmentId,
              image: item.content.image,
            });
            delete item.content.attachmentId;
            delete item.content.image;
            delete item.content.assetKind;
          }
          item.content.backgroundLayers = item.content.backgroundLayers.filter(
            (l) => l.layer !== targetLayer,
          );
          item.content.backgroundLayers.push({
            layer: targetLayer,
            attachmentId: asset.id,
            image: { src: asset.url, alt: asset.alt || "" },
          });
        } else {
          item.content.attachmentId = asset.id;
          if (background) item.content.assetKind = "background";
          item.content.image = { src: asset.url, alt: asset.alt || "" };
        }
      });
      flush();
      renderPanel();
      renderInventory();
      message("Image remplacée. Enregistrez pour conserver ce choix.");
    });
    media.open();
    media.content.mode("browse");
  }
  function linkControl(container) {
    const label = document.createElement("label");
    label.className = "field full";
    label.textContent = "Adresse du lien";
    const input = document.createElement("input");
    input.type = "text";
    input.value = entry().content?.href ?? selected.getAttribute("href") ?? "";
    input.placeholder = "https://… ou /une-page";
    input.setAttribute("aria-label", "Adresse du lien");
    input.addEventListener("input", () => {
      const value = input.value.trim();
      const valid = validHref(value);
      input.classList.toggle("invalid", !valid);
      input.setCustomValidity(
        valid ? "" : "Utilisez une adresse web ou un chemin relatif.",
      );
      if (valid)
        modify((item) => {
          item.content ||= {};
          item.content.href = value;
        });
      else message("Cette adresse de lien est refusée.", true);
    });
    input.addEventListener("change", flush);
    label.append(input);
    container.append(label);
  }
  function startInline() {
    if (!canModify()) return;
    if (!selected || !canEditText(selected)) {
      message(
        "Ce texte contient des éléments imbriqués. Sélectionnez un texte simple ou son enfant.",
        true,
      );
      return;
    }
    cropMode = false;
    flush();
    inlineSnapshot = structuredClone(draft);
    if (inline.start(selected)) {
      message(
        "Écrivez directement dans la page. « Terminer » valide le texte ; Échap annule cette édition.",
      );
      renderPanel();
      updateOutline();
    }
  }
  function openQuick(kind) {
    cropMode = false;
    updateOutline();
    const titles = {
      text: "Style du texte",
      color: "Couleur",
      alignment: "Alignement",
      size: "Taille",
      style: "Apparence",
      move: "Déplacer",
      position: "Position de l’image",
      spacing: "Espacement",
      background: "Fond",
      link: "Lien",
    };
    contextual.open(titles[kind] || "Réglages", (container) => {
      if (kind === "move") movementControls(container);
      if (kind === "position") imageControls(container);
      if (kind === "text") typography(container);
      if (kind === "color") control(container, "color", "Couleur");
      if (kind === "background") {
        control(container, "background-color", "Fond");
        appearanceExtras(container);
      }
      if (kind === "alignment") alignment(container);
      if (kind === "spacing") spacingControls(container);
      if (kind === "size") {
        control(container, "width", "Largeur");
        control(container, "height", "Hauteur");
        control(container, "max-width", "Largeur maximale");
      }
      if (kind === "style") {
        control(container, "border-radius", "Arrondi");
        control(container, "opacity", "Opacité");
        control(container, "background-color", "Fond");
        control(container, "border-color", "Couleur de bordure");
        control(container, "border-width", "Épaisseur de bordure");
        control(container, "border-style", "Bordure", {
          choices: ["none", "solid", "dashed", "dotted"],
        });
        if (assetInfo(selected)?.kind === "svg")
          control(container, "color", "Couleur");
        appearanceExtras(container);
      }
      if (kind === "link") linkControl(container);
    });
    updateOutline();
  }
  function measureSelection() {
    if (!selected) return;
    contextual.open("Mesurer", (container) => {
      const rect = selected.getBoundingClientRect(),
        parent = selected.parentElement?.getBoundingClientRect(),
        size = dimensionsOf(selected);
      const line = (text, key) => {
        const p = document.createElement("p");
        p.textContent = text;
        p.dataset.measurement = key;
        container.append(p);
      };
      line(
        `Largeur ${Math.round(size.width)} px · Hauteur ${Math.round(size.height)} px`,
        "size",
      );
      if (parent)
        line(
          `Bords du parent : gauche ${Math.round(rect.left - parent.left)} px · haut ${Math.round(rect.top - parent.top)} px · droite ${Math.round(parent.right - rect.right)} px · bas ${Math.round(parent.bottom - rect.bottom)} px`,
          "parent",
        );
      const neighbours = [...(selected.parentElement?.children || [])]
        .filter((node) => node !== selected)
        .slice(0, 24)
        .map((node) => node.getBoundingClientRect())
        .filter((box) => box.width && box.height);
      const distance = neighbours
        .map((box) =>
          Math.hypot(
            Math.max(0, box.left - rect.right, rect.left - box.right),
            Math.max(0, box.top - rect.bottom, rect.top - box.bottom),
          ),
        )
        .sort((a, b) => a - b)[0];
      if (distance !== undefined)
        line(`Voisin le plus proche : ${Math.round(distance)} px`, "neighbour");
      line(
        "Mesures du cadre et distances visuelles en pixels du site, indépendantes du zoom. Aucune valeur n’est enregistrée.",
        "help",
      );
    });
    updateOutline();
  }
  function toggleStyle(property, onValue, offValue) {
    const current =
      effectiveProperties(entry(), mode)[property] ||
      frame.contentWindow.getComputedStyle(selected).getPropertyValue(property);
    setProperty(property, current === onValue ? offValue : onValue);
    if (!inline.active) flush();
    syncQuick();
  }
  function renderContext() {
    if (!selected) {
      contextual.hide();
      return;
    }
    const action = (id, label, run, active) => ({ id, label, run, active });
    let actions;
    if (canEditText(selected) && !assetInfo(selected)) {
      actions = [
        action("edit", inline.active ? "Terminer" : "Modifier", () =>
          inline.active ? inline.finish() : startInline(),
        ),
        action(
          "bold",
          "Gras",
          () => toggleStyle("font-weight", "700", "400"),
          parseInt(frame.contentWindow.getComputedStyle(selected).fontWeight) >=
            700,
        ),
        action(
          "italic",
          "Italique",
          () => toggleStyle("font-style", "italic", "normal"),
          frame.contentWindow.getComputedStyle(selected).fontStyle === "italic",
        ),
        action("text", "Police / Taille", () => openQuick("text")),
        action("color", "Couleur", () => openQuick("color")),
        action(
          selected.localName === "a" ? "link" : "alignment",
          selected.localName === "a" ? "Lien" : "Aligner",
          () => openQuick(selected.localName === "a" ? "link" : "alignment"),
        ),
      ];
    } else if (assetInfo(selected))
      actions = [
        ...(assetInfo(selected)?.replaceable
          ? [action("replace", "Remplacer", replaceImage)]
          : []),
        ...(assetInfo(selected)?.kind !== "svg"
          ? [
              action("position", "Position", () => openQuick("position")),
              action(
                "crop",
                cropMode ? "Terminer" : "Recadrer",
                toggleCrop,
                cropMode,
              ),
            ]
          : []),
        action("size", "Taille", () => openQuick("size")),
        action("style", "Apparence", () => openQuick("style")),
      ];
    else
      actions = [
        action("spacing", "Espacement", () => openQuick("spacing")),
        action("alignment", "Aligner", () => openQuick("alignment")),
        action("background", "Fond", () => openQuick("background")),
        action("size", "Taille", () => openQuick("size")),
      ];
    if (!inline.active && !actions.some((item) => item.id === "alignment"))
      actions.push(
        action("alignment", "Aligner", () => openQuick("alignment")),
      );
    if (!inline.active)
      actions.unshift(action("move", "Déplacer", () => openQuick("move")));
    if (!inline.active) {
      const text =
        canEditText(selected) && !["a", "button"].includes(selected.localName);
      actions.push(
        action("center", text ? "Centrer le texte" : "Centrer", () =>
          alignCommand(text ? "content" : "element", "horizontal", "center"),
        ),
      );
    }
    if (!inline.active)
      actions.push(
        action("more", "…", () =>
          contextual.open("Autres actions", (container) => {
            const button = document.createElement("button");
            button.textContent = "Mesurer";
            button.dataset.measure = "true";
            button.onclick = measureSelection;
            container.append(button);
          }),
        ),
      );
    contextual.setActions(actions);
    const badge = document.createElement("small");
    badge.className = "context-mode";
    badge.textContent =
      mode === "desktop"
        ? "Tous les écrans"
        : mode === "mobile"
          ? "Mobile"
          : "Tablette";
    contextual.bar.prepend(badge);
    syncQuick();
  }
  function syncQuick() {
    if (!selected) return;
    navigation.sync(selected);
    for (const button of ui.querySelectorAll("[data-reset-group]"))
      button.disabled = !groupProperties(
        button.dataset.resetGroup,
        entry()?.changes[mode] || {},
        selected,
      ).some((property) => entry()?.changes[mode]?.[property] !== undefined);
    for (const button of ui.querySelectorAll("[data-reset-property]"))
      button.disabled =
        entry()?.changes[mode]?.[button.dataset.resetProperty] === undefined;
    const resetMode = $("#reset-breakpoint");
    if (resetMode)
      resetMode.disabled = !Object.keys(entry()?.changes[mode] || {}).length;
    const style = frame.contentWindow.getComputedStyle(selected);
    for (const [id, active] of [
      ["bold", parseInt(style.fontWeight) >= 700],
      ["italic", style.fontStyle === "italic"],
    ]) {
      const button = contextual.bar.querySelector(`[data-action="${id}"]`);
      if (button) {
        button.classList.toggle("active", active);
        button.setAttribute("aria-pressed", String(active));
      }
    }
    for (const button of ui.querySelectorAll("[data-mode]"))
      button.classList.toggle(
        "has-exceptions",
        button.dataset.mode !== "desktop" &&
          !!Object.keys(entry()?.changes[button.dataset.mode] || {}).length,
      );
  }
  function toggleCrop() {
    inline.finish();
    cropMode = !cropMode;
    if (cropMode) {
      const background = assetInfo(selected)?.kind === "background";
      setProperty(background ? "background-size" : "object-fit", "cover");
      if (background) setProperty("background-repeat", "no-repeat");
      flush();
      message(
        "Glissez l’image à l’intérieur de son cadre pour ajuster le cadrage.",
      );
    } else message("Cadrage terminé.");
    renderContext();
    updateOutline();
  }
  function setMode(value) {
    if (drag) cancelGesture();
    inline.finish();
    cropMode = false;
    flush();
    mode = value;
    viewport.width = { desktop: desktopWidth, tablet: 820, mobile: 390 }[mode];
    $("#desktop-width").disabled = mode !== "desktop";
    $("#logical-width").disabled = mode !== "desktop";
    viewport.layout();
    for (const button of ui.querySelectorAll("[data-mode]")) {
      const active = button.dataset.mode === mode;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", String(active));
    }
    renderPanel();
    if (runtime) navigation.viewportChanged(selected);
    $(".hover").hidden = true;
    requestAnimationFrame(() => {
      selected?.scrollIntoView({
        behavior: "instant",
        block: "nearest",
        inline: "nearest",
      });
      updateOutline();
    });
  }
  for (const button of ui.querySelectorAll("[data-mode]"))
    button.addEventListener("click", () => setMode(button.dataset.mode));
  function undo(redo = false) {
    if (drag) {
      cancelGesture();
      return;
    }
    inline.finish();
    cropMode = false;
    flush();
    draft = redo ? history.redo() : history.undo();
    preview();
    if (spec && !selected?.isConnected) choose(null);
    else renderPanel();
  }
  $("#undo").addEventListener("click", () => undo());
  $("#redo").addEventListener("click", () => undo(true));
  function nudge(dx, dy, step = moveStep) {
    if (!selected || inline.active || drag || !canModify()) return;
    const values = effectiveProperties(entry(), mode);
    const x = values.translateX || "0px",
      y = values.translateY || "0px";
    if (![x, y].every((value) => /^-?[\d.]+(?:px)?$/.test(value))) {
      message(
        "Ce déplacement utilise une mesure relative. Ajustez-la dans les réglages avancés avant d’utiliser les flèches.",
        true,
      );
      return;
    }
    modify((item) => {
      item.changes[mode] ||= {};
      item.changes[mode].translateX =
        `${Math.round((parseFloat(x) || 0) + dx * step)}px`;
      item.changes[mode].translateY =
        `${Math.round((parseFloat(y) || 0) + dy * step)}px`;
    });
    for (const input of ui.querySelectorAll(
      '[data-property="translateX"], [data-property="translateY"]',
    ))
      if (input !== ui.activeElement)
        input.value = entry().changes[mode]?.[input.dataset.property] ?? "";
    clearTimeout(pending);
    pending = setTimeout(flush, 550);
  }
  function movementControls(container) {
    const pad = document.createElement("div");
    pad.className = "move-pad full";
    pad.setAttribute("aria-label", "Déplacer l’élément");
    for (const [name, glyph, dx, dy] of [
      ["Haut", "↑", 0, -1],
      ["Gauche", "←", -1, 0],
      ["Droite", "→", 1, 0],
      ["Bas", "↓", 0, 1],
    ]) {
      const button = document.createElement("button");
      button.textContent = glyph;
      button.dataset.nudge = name.toLowerCase();
      button.title = `Déplacer vers ${name.toLowerCase()}`;
      button.setAttribute("aria-label", button.title);
      button.addEventListener("click", () => nudge(dx, dy));
      pad.append(button);
    }
    const center = document.createElement("span");
    center.textContent = "●";
    center.className = "move-center";
    pad.append(center);
    container.append(pad);
    const label = document.createElement("label");
    label.className = "field full";
    label.textContent = "Pas du déplacement";
    const select = document.createElement("select");
    select.setAttribute("aria-label", "Pas du déplacement");
    for (const value of [1, 5, 10]) {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = `${value} px`;
      select.append(option);
    }
    select.value = String(moveStep);
    select.addEventListener("change", () => {
      flush();
      moveStep = Number(select.value);
    });
    label.append(select);
    container.append(label);
    const hint = document.createElement("p");
    hint.className = "note full";
    hint.textContent =
      "Utilisez aussi les flèches du clavier. Maj + flèche : 10 px.";
    container.append(hint);
  }
  const navigation = new Navigation($("#inventory"), {
    document: () => frame.contentDocument,
    selection: () => selected,
    select: selectListed,
    replace: () => replaceImage(selectedBackgroundLayer),
    highlight: (node) => {
      hoverNode = node;
      rectOverlay($(".hover"), node);
      if (node) $(".hover span").textContent = labelFor(node);
    },
  });
  function showInventory(kind) {
    inventoryMode = kind;
    $("#navigation").hidden = false;
    $("#toggle-navigation").setAttribute("aria-expanded", "true");
    for (const tab of ["assets", "structure"]) {
      $("#" + tab + "-tab").setAttribute("aria-selected", String(tab === kind));
      $("#" + tab + "-tab").setAttribute("aria-pressed", String(tab === kind));
    }
    navigation.show(kind, selected);
    viewport.layout();
    updateOutline();
  }
  function selectListed(node, occurrence) {
    if (!node.isConnected) {
      message("Cet élément a quitté la page. Actualisez la navigation.", true);
      return;
    }
    node.scrollIntoView({
      behavior: "instant",
      block: "nearest",
      inline: "nearest",
    });
    choose(node);
    selectedBackgroundLayer = occurrence?.layer ?? null;
    if (occurrence?.pseudo)
      message(
        "Ce décor appartient à son bloc. Vous modifiez le bloc ; le remplacement du décor reste réservé au thème.",
      );
    else if (
      !node.getBoundingClientRect().width ||
      !node.getBoundingClientRect().height
    )
      message(
        "Cet élément est masqué sur cet écran. Ses réglages restent accessibles.",
      );
    requestAnimationFrame(updateOutline);
  }
  function renderInventory() {
    if (!runtime) return;
    navigation.refresh(selected);
  }
  function hideNavigation() {
    $("#navigation").hidden = true;
    $("#toggle-navigation").setAttribute("aria-expanded", "false");
    viewport.layout();
    updateOutline();
  }
  $("#toggle-navigation").addEventListener("click", () =>
    $("#navigation").hidden ? showInventory(inventoryMode) : hideNavigation(),
  );
  $("#close-navigation").addEventListener("click", hideNavigation);
  function stackedElements(event) {
    const nodes = [];
    for (const hit of frame.contentDocument.elementsFromPoint(
      event.clientX,
      event.clientY,
    )) {
      for (
        let node = selectionTarget(hit);
        node;
        node = selectionTarget(node.parentElement)
      ) {
        if (!nodes.includes(node)) nodes.push(node);
        if (nodes.length >= 12) break;
      }
      if (nodes.length >= 12) break;
    }
    if (!nodes.length) return;
    choose(nodes[0]);
    contextual.open("Choisir un élément", (container) => {
      for (const node of nodes) {
        const button = document.createElement("button");
        button.textContent = `${labelFor(node)}${node.getAttribute("aria-label") ? " · " + node.getAttribute("aria-label") : ""}`;
        button.addEventListener("click", () => choose(node));
        container.append(button);
      }
    });
    updateOutline();
  }
  $("#assets-tab").addEventListener("click", () => showInventory("assets"));
  $("#structure-tab").addEventListener("click", () =>
    showInventory("structure"),
  );
  function setInteraction(value) {
    if (drag) cancelGesture();
    inline.finish();
    flush();
    cropMode = false;
    hoverNode = null;
    interactionMode = value;
    $("#properties").inert = value !== "edit";
    $("#navigation").inert = value !== "edit";
    for (const [id, state] of [
      ["interaction-edit", "edit"],
      ["interaction-browse", "browse"],
    ])
      $("#" + id).setAttribute("aria-pressed", String(value === state));
    message(
      value === "browse"
        ? "Explorez les interactions et les ancres. Les autres pages s’ouvrent dans un nouvel onglet pour préserver vos retouches."
        : "Mode Modifier : votre sélection et vos retouches sont conservées.",
    );
    status();
    renderContext();
    updateOutline();
  }
  $("#interaction-edit").addEventListener("click", () =>
    setInteraction("edit"),
  );
  $("#interaction-browse").addEventListener("click", () =>
    setInteraction("browse"),
  );
  function keyboard(event) {
    if (
      interactionMode !== "edit" ||
      responsiveGuard.busy ||
      responsiveGuard.dialog.open ||
      siteStyle.dialog.open
    )
      return;
    const typing = event
      .composedPath()
      .some((node) =>
        node?.matches?.(
          "input,textarea,select,[contenteditable],[role=slider]",
        ),
      );
    if (
      ["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown"].includes(event.key) &&
      selected &&
      !typing &&
      !inline.active &&
      !event.ctrlKey &&
      !event.metaKey &&
      !event.altKey
    ) {
      event.preventDefault();
      const direction = {
        ArrowLeft: [-1, 0],
        ArrowRight: [1, 0],
        ArrowUp: [0, -1],
        ArrowDown: [0, 1],
      }[event.key];
      nudge(direction[0], direction[1], event.shiftKey ? 10 : 1);
      return;
    }
    if (event.key === "Escape") {
      if (drag) {
        cancelGesture();
        return;
      }
      if (inline.active) {
        inline.cancel();
        return;
      }
      if (cropMode) {
        cropMode = false;
        renderContext();
        updateOutline();
        return;
      }
      choose(null);
      return;
    }
    if (
      (event.ctrlKey || event.metaKey) &&
      event.key.toLowerCase() === "z" &&
      !event
        .composedPath()[0]
        ?.closest?.("input,textarea,select,[contenteditable]")
    ) {
      event.preventDefault();
      undo(event.shiftKey);
    }
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s") {
      event.preventDefault();
      save();
    }
  }
  document.addEventListener("keydown", keyboard);
  window.addEventListener("beforeunload", (event) => {
    if (dirty()) {
      event.preventDefault();
      event.returnValue = "";
    }
  });
  // Journal of the request in flight: if the page is left before the answer,
  // the next opening can tell that the newer server revision is exactly this
  // payload (our own save) and continue the local draft on it without conflict.
  const sendKey = `${draftKey}:envoi`;
  // Every unconfirmed send on the same base revision is kept (a retry must
  // not hide an earlier send that WordPress may have stored).
  function journalSend(payload) {
    try {
      const previous = JSON.parse(localStorage.getItem(sendKey));
      const sends =
        previous?.page === config.page && previous.baseRevision === revision
          ? previous.sends.slice(-4)
          : [];
      localStorage.setItem(
        sendKey,
        JSON.stringify({
          schemaVersion: 2,
          page: config.page,
          baseRevision: revision,
          sends: [...sends, payload],
        }),
      );
    } catch {}
  }
  const journaled = (sent, elements) =>
    Array.isArray(sent?.sends) &&
    sent.sends.some(
      (payload) =>
        comparable(normalizeElements(payload)) ===
        comparable(normalizeElements(elements)),
    );
  function clearJournal() {
    try {
      localStorage.removeItem(sendKey);
    } catch {}
  }
  async function readResponse(response) {
    const text = await response.text();
    try {
      return JSON.parse(text);
    } catch {
      return null;
    }
  }
  // An expired REST nonce is renewed once from WordPress, then the same
  // request is replayed. A logged-out session cannot be renewed: the draft stays.
  async function renewNonce() {
    if (!config.editor.nonceUrl) return false;
    try {
      const response = await fetch(config.editor.nonceUrl, {
        credentials: "same-origin",
      });
      const nonce = (await response.text()).trim();
      if (!response.ok || !/^[a-f0-9]{10}$/.test(nonce)) return false;
      config.editor.nonce = nonce;
      return true;
    } catch {
      return false;
    }
  }
  function saveError(status, data) {
    const error = new Error(
      data?.message ||
        (status
          ? `Réponse illisible du serveur (HTTP ${status}).`
          : "Le serveur n’a pas répondu."),
    );
    error.status = status;
    error.code = data?.code || null;
    return error;
  }
  async function putPage(payload, attempt = 0) {
    let response;
    try {
      response = await fetch(config.editor.api, {
        method: "PUT",
        credentials: "same-origin",
        headers: {
          "Content-Type": "application/json",
          "X-WP-Nonce": config.editor.nonce,
        },
        body: JSON.stringify({
          page: config.page,
          revision,
          elements: payload,
        }),
      });
    } catch {
      throw saveError(0, {
        message:
          "Connexion interrompue : la sauvegarde n’a pas été confirmée par WordPress.",
      });
    }
    const data = await readResponse(response);
    if (
      response.status === 403 &&
      ["vt_nonce", "rest_cookie_invalid_nonce"].includes(data?.code) &&
      attempt === 0 &&
      (await renewNonce())
    )
      return putPage(payload, 1);
    if (!response.ok) throw saveError(response.status, data);
    if (
      !data ||
      !Number.isInteger(data.revision) ||
      !Array.isArray(data.elements)
    )
      throw saveError(response.status, {
        message: "La réponse de sauvegarde est incomplète.",
      });
    return data;
  }
  // What a saved page means for visitors: the data is in WordPress, but a page
  // cache may still serve the previous HTML until it is purged.
  function publicationNotice(cache) {
    const parts = [];
    if (cache?.litespeed === "purged")
      parts.push("Cache LiteSpeed de cette page vidé.");
    else if (cache?.litespeed === "failed")
      parts.push(
        "Le cache LiteSpeed n’a pas pu être vidé : les visiteurs peuvent encore voir l’ancienne version.",
      );
    if (cache?.cdn?.provider === "hostinger")
      parts.push(
        "Le CDN Hostinger peut encore servir l’ancienne version aux visiteurs.",
      );
    else if (cache?.litespeed === "absent")
      parts.push(
        "Si un cache de page ou un CDN est actif, videz-le pour que les visiteurs voient cette version.",
      );
    return parts.join(" ");
  }
  function offerCdnPurge(cdn) {
    $("#cdn-purge")?.remove();
    if (cdn?.provider !== "hostinger" || !cdn.purge) return;
    const button = document.createElement("button");
    button.id = "cdn-purge";
    button.textContent = "Vider le cache Hostinger (tout le site)";
    button.addEventListener("click", async () => {
      if (
        !confirm(
          "Vider le cache serveur et le CDN Hostinger de tout le site ? Les premières visites seront un peu plus lentes le temps qu’il se reconstitue.",
        )
      )
        return;
      button.disabled = true;
      try {
        const response = await fetch(cdn.purge, {
          method: "DELETE",
          credentials: "same-origin",
          headers: { "X-WP-Nonce": config.editor.nonce },
        });
        const data = await readResponse(response);
        if (!response.ok || data?.data?.purged === false)
          throw new Error(
            data?.message ||
              data?.data?.message ||
              `HTTP ${response.status}`,
          );
        button.remove();
        message(
          "Cache Hostinger vidé (tout le site). Les visiteurs reçoivent la dernière version enregistrée.",
        );
      } catch (error) {
        button.disabled = false;
        message(
          `Le cache Hostinger n’a pas pu être vidé : ${error.message}. Vos retouches sont enregistrées ; réessayez ou videz-le depuis hPanel.`,
          true,
        );
      }
    });
    $("#message").after(button);
  }
  // A refused revision keeps the draft. The user may replace the stored
  // version explicitly; that version is first downloaded as a JSON backup.
  function offerConflictResolution() {
    $("#conflict-actions")?.remove();
    const bar = document.createElement("div");
    bar.id = "conflict-actions";
    const exportButton = document.createElement("button");
    exportButton.textContent = "Exporter mon brouillon";
    exportButton.addEventListener("click", () => $("#export").click());
    const replace = document.createElement("button");
    replace.textContent = "Remplacer la version enregistrée par mon brouillon";
    replace.addEventListener("click", replaceStoredVersion);
    bar.append(exportButton, replace);
    $("#message").after(bar);
  }
  async function replaceStoredVersion() {
    if (
      !confirm(
        "Remplacer la version enregistrée dans WordPress par ce brouillon ? Les retouches enregistrées depuis une autre session seront remplacées ; elles sont d’abord téléchargées en JSON.",
      )
    )
      return;
    try {
      const url = new URL(config.editor.api);
      url.searchParams.set("page", config.page);
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { "X-WP-Nonce": config.editor.nonce },
      });
      const current = await readResponse(response);
      if (!response.ok || !Number.isInteger(current?.revision))
        throw saveError(response.status, current);
      download(
        `visual-tweaks-version-enregistree-r${current.revision}.json`,
        {
          schemaVersion: 1,
          page: config.page,
          revision: current.revision,
          breakpoints: config.breakpoints,
          elements: current.elements,
        },
      );
      revision = current.revision;
      savedRevision = current.revision;
      saved = JSON.stringify(normalizeElements(current.elements));
      $("#conflict-actions")?.remove();
      await save();
    } catch (error) {
      message(
        `Remplacement impossible : ${error.message} Le brouillon est conservé.`,
        true,
      );
    }
  }
  // A 409 may answer our own save whose response was lost (connection cut
  // after WordPress stored it). If the stored revision is exactly the journaled
  // payload on our base revision, adopt it: no other session is involved.
  async function adoptOwnSave() {
    try {
      const sent = JSON.parse(localStorage.getItem(sendKey));
      if (sent?.page !== config.page || sent.baseRevision !== revision)
        return false;
      const url = new URL(config.editor.api);
      url.searchParams.set("page", config.page);
      const response = await fetch(url, {
        credentials: "same-origin",
        headers: { "X-WP-Nonce": config.editor.nonce },
      });
      const current = await readResponse(response);
      if (
        !response.ok ||
        current?.revision !== sent.baseRevision + 1 ||
        !journaled(sent, current.elements)
      )
        return false;
      revision = current.revision;
      savedRevision = current.revision;
      saved = JSON.stringify(normalizeElements(current.elements));
      clearJournal();
      return true;
    } catch {
      return false;
    }
  }
  async function save() {
    if (drag) endGesture();
    inline.finish();
    if (busy || !dirty() || !frameReady || recoveryPending) return;
    flush();
    busy = true;
    status();
    let adopted = false;
    const payload = structuredClone(draft);
    try {
      const invalid = invalidOverride(payload);
      if (invalid) {
        console.warn("Visual Tweaks : override refusé avant envoi", {
          ...invalid,
          provenance: "document d’overrides (édition ou brouillon récupéré)",
        });
        const label =
          invalid.property === "width" ? "Largeur" : invalid.property;
        throw new Error(
          `${label} invalide pour « ${invalid.element} » (${invalid.breakpoint}). Corrigez ce champ ou videz-le pour retrouver la valeur du site.`,
        );
      }
      journalSend(payload);
      const data = await putPage(payload);
      const unchanged = JSON.stringify(draft) === JSON.stringify(payload);
      revision = data.revision;
      savedRevision = data.revision;
      // Acknowledge the canonical server state, while keeping edits made in flight.
      const confirmed = normalizeElements(data.elements);
      saved = JSON.stringify(confirmed);
      if (unchanged) {
        draft = confirmed;
        history.entries[history.index] = structuredClone(confirmed);
        preview();
      }
      clearJournal();
      $("#conflict-actions")?.remove();
      peers?.postMessage({ type: "saved", revision: data.revision });
      const notice = publicationNotice(data.cache);
      message(
        (dirty()
          ? `Révision ${data.revision} enregistrée. De nouvelles retouches restent à enregistrer.`
          : `Réglages enregistrés dans WordPress (révision ${data.revision}).`) +
          (notice ? " " + notice : ""),
      );
      offerCdnPurge(data.cache?.cdn);
    } catch (error) {
      if (error.status === 409 && (await adoptOwnSave())) {
        adopted = true;
        message(
          `La sauvegarde précédente avait bien été enregistrée (révision ${revision}).${dirty() ? " Envoi des retouches suivantes…" : ""}`,
        );
        return;
      }
      // The request may have been refused before reaching the store: nothing
      // in the journal can be trusted for a later rebase.
      if (error.status) clearJournal();
      message(
        error.status === 409
          ? "Une autre session a enregistré cette page entre-temps. Votre brouillon est conservé : exportez-le, ou remplacez la version enregistrée."
          : `Sauvegarde impossible : ${error.message} Le brouillon est conservé.`,
        true,
      );
      if (error.status === 409) offerConflictResolution();
    } finally {
      busy = false;
      status();
      if (adopted && dirty()) save();
    }
  }
  $("#save").addEventListener("click", save);
  function download(name, value) {
    const blob = new Blob([JSON.stringify(value, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  $("#export").addEventListener("click", () => {
    inline.finish();
    flush();
    download("visual-tweaks-draft.json", {
      schemaVersion: 1,
      page: config.page,
      revision: recoveryPending ? recovered.revision : revision,
      breakpoints: config.breakpoints,
      elements: recoveryPending ? recovered.elements : draft,
    });
    message("Brouillon exporté.");
  });
  $("#reset-page").addEventListener("click", () => {
    if (recoveryPending) {
      message(
        "Récupérez le brouillon local ou revenez à la sauvegarde avant de réinitialiser.",
        true,
      );
      return;
    }
    inline.finish();
    if (
      !confirm(
        "Retirer toutes les retouches de cette page ? Ce reset reste annulable avant et après sauvegarde dans cette session.",
      )
    )
      return;
    flush();
    draft = [];
    history.push(draft);
    preview();
    choose(null);
    message(
      "Page réinitialisée dans le brouillon. Enregistrez pour conserver ce reset.",
    );
  });
  $("#discard").addEventListener("click", () => {
    inline.finish();
    flush();
    recoveryPending = false;
    $("#recovery").replaceChildren();
    draft = JSON.parse(saved);
    revision = savedRevision;
    history.push(draft);
    preview();
    renderPanel();
    message("Retour à la dernière sauvegarde.");
  });
  $("#exit").addEventListener("click", () => {
    inline.finish();
    flush();
    if (
      dirty() &&
      !confirm(
        "Quitter avec des retouches non enregistrées ? Le brouillon local reste disponible sur ce navigateur.",
      )
    )
      return;
    const url = new URL(location.href);
    url.searchParams.delete("vt-edit");
    url.searchParams.delete("vt-frame");
    location.href = url.href;
  });
  if (autoRecovered) {
    const notice = document.createElement("span");
    notice.textContent = recovered.rebased
      ? `La sauvegarde interrompue a bien été enregistrée (révision ${config.revision}). Les retouches faites ensuite sont restaurées : enregistrez-les.`
      : "Brouillon local restauré. Vous pouvez continuer à modifier, annuler ou revenir à la sauvegarde.";
    $("#recovery").append(notice);
  }
  if (autoRecovered || recoveryPending) {
    const discard = document.createElement("button");
    discard.textContent = "Revenir à la sauvegarde";
    discard.addEventListener("click", () => $("#discard").click());
    $("#recovery").append(discard);
  }
  if (recoveryPending) {
    const recovery = $("#recovery");
    const notice = document.createElement("strong");
    notice.textContent =
      "Un brouillon local attend votre décision. Récupérez-le ou revenez à la sauvegarde pour éditer.";
    recovery.append(notice);
    const restore = document.createElement("button");
    restore.textContent = "Récupérer le brouillon local";
    recovery.append(restore);
    restore.addEventListener("click", () => {
      flush();
      recoveryPending = false;
      draft = structuredClone(recovered.elements);
      history.push(draft);
      revision = recovered.revision;
      preview();
      renderPanel();
      recovery.replaceChildren();
      message(
        revision !== config.revision
          ? "Brouillon récupéré sur une ancienne version. La sauvegarde sera refusée pour préserver la version actuelle : exportez-le, ou remplacez explicitement la version enregistrée."
          : "Brouillon local récupéré.",
        revision !== config.revision,
      );
      if (revision !== config.revision) offerConflictResolution();
    });
  }
  // Keep WordPress media dialogs above the editor host, outside its isolated styles.
  const mediaStyle = document.createElement("style");
  mediaStyle.textContent =
    ".media-modal{z-index:2147483646!important}.media-modal-backdrop{z-index:2147483645!important}";
  document.head.append(mediaStyle);
  window.VisualTweaksEditor = {
    diagnostics: () => ({
      phase: framePhase,
      ready: frameReady,
      recoveryPending,
      error: frameError,
      interactionMode,
      selected: spec?.selector || null,
      dirty: dirty(),
      revision,
      frameURL: frame.src,
      runtime: !!runtime,
      unresolvedTargets: runtime?.issues.map((item) => item.selector) || [],
      navigation: { ...navigation.metrics },
      responsive: responsiveGuard.summary(),
      guides: { ...smartGuides.metrics },
      rendering: runtime
        ? {
            ...runtime.metrics,
            gesturePreviews: gesturePreview?.count || 0,
            stylePatches: stylePatcher?.count || 0,
          }
        : null,
    }),
  };
  function frameFailure(error) {
    frameReady = false;
    framePhase = "error";
    frameError = String(error.message || error);
    $("#frame-status").hidden = false;
    $("#frame-status span").textContent =
      "L’éditeur n’a pas pu s’activer. " + frameError;
    $("#retry-frame").hidden = false;
    message($("#frame-status span").textContent, true);
    status();
  }
  function loadFrame() {
    clearTimeout(frameTimer);
    frameController?.abort();
    if (drag) cancelGesture();
    inline.finish();
    flush();
    frameReady = false;
    framePhase = "waiting-runtime";
    frameError = null;
    runtime = null;
    selected = null;
    spec = null;
    activeDocument = null;
    $("#frame-status").hidden = false;
    $("#frame-status span").textContent = "Activation de l’éditeur…";
    $("#retry-frame").hidden = true;
    renderPanel();
    updateOutline();
    status();
    const deadline = performance.now() + 15000;
    function waitForRuntime() {
      try {
        const doc = frame.contentDocument;
        const readyRuntime = frame.contentWindow.VisualTweaksRuntime;
        if (readyRuntime?.doc === doc) {
          if (doc.defaultView.VisualTweaksConfig?.page !== config.page)
            throw new Error(
              "L’aperçu a changé de page. Rouvrez Visual Tweaks sur la page à retoucher.",
            );
          activateFrame(doc, readyRuntime);
          return;
        }
        if (performance.now() >= deadline)
          throw new Error(
            "Runtime indisponible : vérifiez wp_footer(), la session et les optimisations de scripts.",
          );
        frameTimer = setTimeout(waitForRuntime, 100);
      } catch (error) {
        frameFailure(error);
      }
    }
    waitForRuntime();
  }
  $("#retry-frame").addEventListener("click", loadFrame);
  frame.addEventListener("load", loadFrame);
  function activateFrame(doc, readyRuntime) {
    if (activeDocument === doc) return;
    runtime = readyRuntime;
    gesturePreview = new GesturePreview(doc);
    stylePatcher = new StylePatcher(runtime);
    navigation.observe(doc);
    frameController = new frame.contentWindow.AbortController();
    const capture = { capture: true, signal: frameController.signal };
    let inventoryError = null;
    try {
      doc.addEventListener(
        "pointermove",
        (event) => {
          if (interactionMode !== "edit" || drag || inline.active) return;
          const node = selectionTarget(event.target);
          if (hoverNode === node) return;
          hoverNode = node;
          if (editable(node) && node !== selected) {
            $(".hover span").textContent = labelFor(node);
            rectOverlay($(".hover"), node);
          } else $(".hover").hidden = true;
        },
        capture,
      );
      doc.addEventListener(
        "click",
        (event) => {
          if (interactionMode !== "edit" || inline.contains(event.target))
            return;
          event.preventDefault();
          event.stopImmediatePropagation();
          if (dragSuppress) {
            dragSuppress = false;
            return;
          }
          if (cropMode && event.target === selected) return;
          const target = selectionTarget(event.target);
          if (event.altKey || event.metaKey) {
            stackedElements(event);
            return;
          }
          // Opening properties may change the visual zoom between the two clicks.
          // Match the gesture in screen pixels, then keep the first text target.
          const candidate = clickCandidate;
          if (
            event.detail === 2 &&
            candidate &&
            performance.now() - candidate.time < 600 &&
            Math.hypot(
              event.screenX - candidate.x,
              event.screenY - candidate.y,
            ) < 8 &&
            candidate.node.isConnected &&
            canEditText(candidate.node)
          ) {
            choose(candidate.node);
            startInline();
            return;
          }
          if (target) {
            choose(target);
            if (canEditText(target))
              clickCandidate = {
                node: target,
                time: performance.now(),
                x: event.screenX,
                y: event.screenY,
              };
          }
        },
        capture,
      );
      doc.addEventListener(
        "dblclick",
        (event) => {
          if (interactionMode !== "edit" || inline.active) return;
          event.preventDefault();
          event.stopImmediatePropagation();
          const target = selectionTarget(event.target);
          if (target && canEditText(target)) {
            choose(target);
            startInline();
          }
        },
        capture,
      );
      doc.addEventListener(
        "pointerdown",
        (event) => {
          if (interactionMode !== "edit" || inline.contains(event.target))
            return;
          if (inline.active) inline.finish();
          if (
            !event.altKey &&
            !event.metaKey &&
            (selectionTarget(event.target) === selected ||
              ((cropMode || assetInfo(selected)?.kind === "background") &&
                selected?.contains(event.target))) &&
            (cropMode || assetInfo(selected))
          )
            beginGesture(event, cropMode ? "crop" : "move");
        },
        capture,
      );
      doc.addEventListener(
        "submit",
        (event) => {
          if (interactionMode !== "edit") return;
          event.preventDefault();
          event.stopImmediatePropagation();
        },
        capture,
      );
      doc.addEventListener(
        "click",
        (event) => {
          if (
            interactionMode !== "browse" ||
            event.defaultPrevented ||
            event.button !== 0
          )
            return;
          const link = event.target.closest?.("a[href]");
          if (!link || link.target || link.hasAttribute("download")) return;
          const destination = new URL(link.href),
            current = new URL(doc.location.href);
          for (const url of [destination, current]) {
            url.searchParams.delete("vt-frame");
            url.searchParams.delete("vt-edit");
          }
          if (
            destination.origin === current.origin &&
            destination.pathname === current.pathname &&
            destination.search === current.search &&
            destination.hash
          )
            return;
          if (!["http:", "https:"].includes(destination.protocol)) return;
          event.preventDefault();
          doc.defaultView.open(destination.href, "_blank", "noopener");
        },
        { signal: frameController.signal },
      );
      doc.addEventListener(
        "submit",
        (event) => {
          if (
            interactionMode !== "browse" ||
            event.defaultPrevented ||
            event.target.target
          )
            return;
          event.target.target = "_blank";
          setTimeout(() => event.target.removeAttribute("target"), 0);
        },
        { signal: frameController.signal },
      );
      doc.addEventListener("keydown", keyboard, capture);
      doc.addEventListener(
        "scroll",
        () => {
          hoverNode = null;
          smartGuides.end();
          $(".hover").hidden = true;
          scheduleOutline();
        },
        capture,
      );
      doc.defaultView.addEventListener("resize", scheduleOutline, {
        signal: frameController.signal,
      });
      doc.fonts?.addEventListener(
        "loadingdone",
        () => {
          if (activeDocument !== doc) return;
          fonts = discoverFonts(doc);
          updateOutline();
        },
        { signal: frameController.signal },
      );
      doc.fonts?.ready.then(() => {
        if (activeDocument !== doc) return;
        try {
          fonts = discoverFonts(doc);
          updateOutline();
        } catch (error) {
          message(
            "Certaines polices n’ont pas pu être détectées : " + error.message,
            true,
          );
        }
      });
      // Discovery is optional: a theme-specific inventory failure cannot disable editing.
      try {
        fonts = discoverFonts(doc);
        siteColors = paletteColors(doc);
        renderInventory();
      } catch (error) {
        inventoryError = error;
        frameError = error.message;
        message("Navigation incomplète : " + error.message, true);
      }
      doc.getElementById("vt-inline-edit-style")?.remove();
      const editingStyle = doc.createElement("style");
      editingStyle.id = "vt-inline-edit-style";
      editingStyle.textContent =
        "[data-vt-inline-edit]{outline:2px solid #10a477!important;outline-offset:4px;white-space:pre-wrap!important;cursor:text!important;min-height:1em}";
      doc.head.append(editingStyle);
      activeDocument = doc;
      frameReady = true;
      framePhase = "ready";
      $("#frame-status").hidden = true;
      preview();
      renderPanel();
      if (!recoveryPending && !inventoryError && !runtime.issues.length)
        message("Prêt. Cliquez sur un élément dans la page.");
    } catch (error) {
      frameController.abort();
      frameFailure(error);
    }
  }
  $(".stage").addEventListener("scroll", () => {
    hoverNode = null;
    $(".hover").hidden = true;
    scheduleOutline();
  });
  let dragSuppress = false,
    clickCandidate = null,
    hoverNode = null;
  const handles = $("#handles");
  for (const corner of ["nw", "ne", "se", "sw"]) {
    const button = document.createElement("button");
    button.className = `resize-handle ${corner}`;
    button.dataset.corner = corner;
    button.title = "Glisser pour redimensionner. Maj : proportions libres.";
    const cornerLabel = {
      nw: "coin supérieur gauche",
      ne: "coin supérieur droit",
      se: "coin inférieur droit",
      sw: "coin inférieur gauche",
    };
    button.setAttribute(
      "aria-label",
      `Redimensionner — ${cornerLabel[corner]}`,
    );
    button.addEventListener("pointerdown", (event) =>
      beginGesture(event, "resize", corner),
    );
    handles.append(button);
  }
  function beginGesture(event, kind, corner = null) {
    if (!selected || event.button !== 0 || !canModify()) return;
    inline.finish();
    flush();
    const values = effectiveProperties(entry(), mode),
      style = frame.contentWindow.getComputedStyle(selected);
    const x = values.translateX || "0px",
      y = values.translateY || "0px";
    if (![x, y].every((v) => /^-?[\d.]+(?:px)?$/.test(v)) && kind !== "crop") {
      message(
        "Ce décalage utilise une unité relative. Ajustez-le dans Taille et position avant de le déplacer.",
        true,
      );
      return;
    }
    try {
      const dimensions = dimensionsOf(selected),
        edges = boxEdges(style);
      if (
        kind === "resize" &&
        (!Number.isFinite(dimensions.width) ||
          !Number.isFinite(dimensions.height))
      )
        throw new Error(
          "La taille de cet élément ne peut pas être mesurée. Utilisez les champs de taille.",
        );
      const own = matrixFor(selected),
        parent = selected.parentElement
          ? matrixFor(selected.parentElement)
          : new frame.contentWindow.DOMMatrix();
      const quad = visualQuad(selected),
        opposite = { nw: "se", ne: "sw", se: "nw", sw: "ne" }[corner];
      drag = {
        kind,
        corner,
        x: viewport.pointer(event).x,
        y: viewport.pointer(event).y,
        target: event.target,
        baseX: parseFloat(x) || 0,
        baseY: parseFloat(y) || 0,
        matrix: own,
        parent,
        width: dimensionsOf(selected).width,
        height: dimensionsOf(selected).height,
        offsetW: edges.width,
        offsetH: edges.height,
        ratio: selected.localName === "img" && lockRatio && !event.shiftKey,
        anchor: opposite ? quad[opposite] : null,
        opposite,
        position: (
          values[
            assetInfo(selected)?.kind === "background"
              ? "background-position"
              : "object-position"
          ] ||
          (assetInfo(selected)?.kind === "background"
            ? style.backgroundPosition
            : style.objectPosition)
        )
          .split(" ")
          .map(parseFloat),
        moved: false,
        snapshot: structuredClone(draft),
        background: assetInfo(selected)?.kind === "background",
        values: {},
        inherited: values,
        source: assetInfo(selected)?.src,
        animationFrame: null,
        latestEvent: null,
      };
      if (kind === "move") {
        const axisAligned = [own, parent].every(
          (m) =>
            Math.abs(m.a - 1) < 0.001 &&
            Math.abs(m.d - 1) < 0.001 &&
            Math.abs(m.b) < 0.001 &&
            Math.abs(m.c) < 0.001,
        );
        smartGuides.begin(selected, axisAligned);
      }
      gesturePreview.begin(selected);
      event.preventDefault();
      event.stopImmediatePropagation();
      event.target.setPointerCapture(event.pointerId);
      event.target.addEventListener("pointermove", moveGesture);
      event.target.addEventListener("pointerup", endGesture);
      event.target.addEventListener("pointercancel", cancelGesture);
      event.target.addEventListener("lostpointercapture", cancelGesture);
      contextual.root.hidden = true;
    } catch (error) {
      message(error.message, true);
    }
  }
  function gestureProperties(values) {
    const canonical = {};
    for (const [property, value] of Object.entries(values)) {
      const normalized = canonicalValue(property, value);
      if (normalized === null) {
        message(
          "Ce geste dépasse les limites autorisées. Ajustez la valeur dans les réglages.",
          true,
        );
        return false;
      }
      canonical[property] = normalized;
    }
    drag.values = { ...drag.values, ...canonical };
    gesturePreview.render(drag.values, drag.inherited);
    updateOutline();
    return true;
  }
  function moveGesture(event) {
    if (!drag) return;
    drag.latestEvent = event;
    if (drag.animationFrame !== null) return;
    drag.animationFrame = requestAnimationFrame(() => {
      if (!drag) return;
      drag.animationFrame = null;
      paintGesture(drag.latestEvent);
    });
  }
  function paintGesture(event) {
    if (!drag) return;
    const point = viewport.pointer(event);
    const dx = point.x - drag.x,
      dy = point.y - drag.y;
    if (!drag.moved && Math.hypot(dx, dy) < 3) return;
    drag.moved = true;
    if (drag.kind === "move") {
      const snapped = smartGuides.snap(dx, dy, event.ctrlKey);
      const delta = localDelta(drag.parent, snapped.x, snapped.y);
      gestureProperties({
        translateX: `${Math.round(drag.baseX + delta.x)}px`,
        translateY: `${Math.round(drag.baseY + delta.y)}px`,
      });
      feedback(
        `Déplacer : ${Math.round(delta.x)} / ${Math.round(delta.y)} px · Ctrl : sans aimant`,
        event,
      );
    } else if (drag.kind === "resize") {
      const delta = localDelta(drag.matrix, dx, dy);
      const size = resizeDimensions({
        width: drag.width,
        height: drag.height,
        dx: delta.x,
        dy: delta.y,
        corner: drag.corner,
        ratio: drag.ratio,
      });
      const width = Math.max(12, size.width - drag.offsetW),
        height = Math.max(12, size.height - drag.offsetH);
      if (
        !gestureProperties({
          width: `${width}px`,
          height: `${height}px`,
          "max-width": `${width}px`,
          translateX: `${drag.baseX}px`,
          translateY: `${drag.baseY}px`,
        })
      )
        return;
      const current = visualQuad(selected)[drag.opposite];
      const compensation = localDelta(
        drag.parent,
        drag.anchor.x - current.x,
        drag.anchor.y - current.y,
      );
      gestureProperties({
        translateX: `${Math.round(drag.baseX + compensation.x)}px`,
        translateY: `${Math.round(drag.baseY + compensation.y)}px`,
      });
      feedback(`${Math.round(width)} × ${Math.round(height)} px`, event);
    } else {
      const delta = localDelta(drag.matrix, dx, dy);
      const source = drag.source;
      const natural = drag.background ? runtime.images.get(source) : selected;
      const naturalW = natural?.naturalWidth || dimensionsOf(selected).width,
        naturalH = natural?.naturalHeight || dimensionsOf(selected).height;
      const scale =
        (Math.max(
          selected.clientWidth / naturalW,
          selected.clientHeight / naturalH,
        ) *
          Number(drag.inherited.imageZoom || 100)) /
        100;
      const overflowX = naturalW * scale - selected.clientWidth,
        overflowY = naturalH * scale - selected.clientHeight;
      const px =
        overflowX > 1
          ? Math.max(
              0,
              Math.min(
                100,
                (drag.position[0] || 0) - (delta.x / overflowX) * 100,
              ),
            )
          : 50;
      const py =
        overflowY > 1
          ? Math.max(
              0,
              Math.min(
                100,
                (drag.position[1] || 0) - (delta.y / overflowY) * 100,
              ),
            )
          : 50;
      gestureProperties({
        [drag.background ? "background-position" : "object-position"]:
          `${Math.round(px)}% ${Math.round(py)}%`,
      });
      feedback("Position de l’image", event);
    }
  }
  function feedback(text, event) {
    const box = $(".gesture-feedback");
    const stage = $(".stage").getBoundingClientRect();
    const point = viewport.point(viewport.pointer(event));
    box.hidden = false;
    box.textContent = text;
    box.style.left = `${Math.max($(".stage").scrollLeft + 8, Math.min($(".stage").scrollLeft + $(".stage").clientWidth - 180, point.x - stage.left + $(".stage").scrollLeft + 15))}px`;
    box.style.top = `${point.y - stage.top + $(".stage").scrollTop + 18}px`;
  }
  function cleanupGesture() {
    if (!drag) return;
    const { target } = drag;
    cancelAnimationFrame(drag.animationFrame);
    gesturePreview.end();
    smartGuides.end();
    target.removeEventListener("pointermove", moveGesture);
    target.removeEventListener("pointerup", endGesture);
    target.removeEventListener("pointercancel", cancelGesture);
    target.removeEventListener("lostpointercapture", cancelGesture);
    $(".gesture-feedback").hidden = true;
  }
  function endGesture(event) {
    if (!drag) return;
    if (drag.latestEvent) paintGesture(drag.latestEvent);
    const moved = drag.moved;
    const values = drag.values;
    const inFrame = drag.target.ownerDocument !== document;
    cleanupGesture();
    drag = null;
    if (moved) setProperties(values);
    flush();
    if (moved && inFrame) {
      dragSuppress = true;
      setTimeout(() => (dragSuppress = false), 50);
    }
    renderPanel();
  }
  function cancelGesture() {
    if (!drag) return;
    const previous = drag.snapshot;
    cleanupGesture();
    drag = null;
    draft = previous;
    preview();
    renderPanel();
  }
  $(".drag").addEventListener("pointerdown", (event) =>
    beginGesture(event, "move"),
  );
  $(".hover").hidden = true;
  $(".selected").hidden = true;
  const url = new URL(location.href);
  url.searchParams.delete("vt-edit");
  url.searchParams.set("vt-frame", "1");
  frame.src = url.href;
  setMode("desktop");
  renderPanel();
  status();
  css.addEventListener("load", () => setMode(mode));
  window.addEventListener("resize", () => {
    if (drag) cancelGesture();
    viewport.height = window.innerHeight;
    viewport.layout();
  });
}
