// Édition allégée (0.4.5), dans l'aperçu seulement et sur demande :
// - les boucles requestAnimationFrame du thème tournent à 4 images par seconde
//   (leurs animations finies se terminent quand même, à l'heure prévue) ;
// - les animations CSS et Web infinies, et les vidéos en lecture, sont en pause ;
// - les animations finies (apparitions, transitions) ne sont pas touchées :
//   aucun contenu ne reste figé à mi-chemin.
// Les scripts du thème continuent de s'exécuter (événements, minuteries,
// observateurs), le site public n'est pas concerné, et désactiver rend
// immédiatement le rendu animé réel. Limite : une boucle qui a gardé sa propre
// référence à requestAnimationFrame avant l'ouverture de l'éditeur n'est pas ralentie.
const SLOW_FRAME_MS = 250;
const PAUSED = "data-vt-light-paused";

export class LightMode {
  constructor() {
    this.active = false;
    this.doc = null;
    this.metrics = { deferredFrames: 0, pausedAnimations: 0, pausedVideos: 0 };
  }
  // New preview document (load, reload): the previous one is gone.
  attach(doc) {
    this.release();
    this.doc = doc;
    if (this.active) this.pause();
  }
  set(active) {
    if (active === this.active) return;
    this.active = active;
    if (!this.doc) return;
    if (active) this.pause();
    else this.release();
  }
  pause() {
    const doc = this.doc,
      win = doc.defaultView;
    const state = (this.state = {
      doc,
      queue: new Map(),
      timer: 0,
      next: 0x40000000,
      animations: new Set(),
      videos: new Set(),
    });
    // Animation frames of the theme, slowed down. The editor's own frame
    // callbacks (responsive test) use the native function.
    const native = win.requestAnimationFrame,
      nativeCancel = win.cancelAnimationFrame;
    const flush = () => {
      state.timer = 0;
      const callbacks = [...state.queue.values()];
      state.queue.clear();
      // One native frame per callback: an error stays isolated, as before.
      for (const callback of callbacks) native.call(win, callback);
    };
    state.request = function requestAnimationFrame(callback) {
      const id = ++state.next;
      state.queue.set(id, callback);
      this.metrics.deferredFrames++;
      if (!state.timer) state.timer = win.setTimeout(flush, SLOW_FRAME_MS);
      return id;
    }.bind(this);
    state.cancel = function cancelAnimationFrame(id) {
      if (!state.queue.delete(id)) nativeCancel.call(win, id);
    };
    state.restore = () => {
      if (win.requestAnimationFrame === state.request)
        win.requestAnimationFrame = native;
      if (win.cancelAnimationFrame === state.cancel)
        win.cancelAnimationFrame = nativeCancel;
      delete win.__vtRequestAnimationFrame;
      win.clearTimeout(state.timer);
      // Pending frames run at the next frame, at full rate again.
      for (const callback of state.queue.values()) native.call(win, callback);
      state.queue.clear();
    };
    win.__vtRequestAnimationFrame = native.bind(win);
    win.requestAnimationFrame = state.request;
    win.cancelAnimationFrame = state.cancel;
    // Infinite CSS animations: paused by a rule on their element, so that the
    // theme's own animation-play-state applies again once released.
    state.style = doc.createElement("style");
    state.style.id = "vt-light-mode";
    state.style.textContent = `[${PAUSED}~="element"],[${PAUSED}~="before"]::before,[${PAUSED}~="after"]::after,[${PAUSED}~="marker"]::marker{animation-play-state:paused!important}`;
    doc.head.append(state.style);
    for (const animation of doc.getAnimations()) this.hold(animation);
    state.started = (event) => {
      for (const animation of event.target.getAnimations?.() || [])
        this.hold(animation);
    };
    doc.addEventListener("animationstart", state.started, true);
    for (const video of doc.querySelectorAll("video"))
      if (!video.paused) {
        video.pause();
        state.videos.add(video);
        this.metrics.pausedVideos++;
      }
  }
  hold(animation) {
    const state = this.state,
      win = state.doc.defaultView;
    if (
      animation.playState !== "running" ||
      animation.effect?.getComputedTiming?.().iterations !== Infinity ||
      animation instanceof win.CSSTransition
    )
      return;
    if (animation instanceof win.CSSAnimation) {
      const target = animation.effect.target,
        part = animation.effect.pseudoElement?.replace(/^:+/, "") || "element";
      if (!target) return;
      const parts = new Set(
        (target.getAttribute(PAUSED) || "").split(" ").filter(Boolean),
      );
      if (parts.has(part)) return;
      parts.add(part);
      target.setAttribute(PAUSED, [...parts].join(" "));
    } else {
      animation.pause();
      state.animations.add(animation);
    }
    this.metrics.pausedAnimations++;
  }
  release() {
    const state = this.state;
    this.state = null;
    if (!state) return;
    const doc = state.doc;
    try {
      state.restore();
    } catch {
      /* Preview document already replaced: nothing left to restore. */
    }
    doc.removeEventListener("animationstart", state.started, true);
    state.style.remove();
    for (const node of doc.querySelectorAll(`[${PAUSED}]`))
      node.removeAttribute(PAUSED);
    for (const animation of state.animations)
      if (animation.playState === "paused") animation.play();
    for (const video of state.videos)
      if (video.isConnected && video.paused) video.play().catch(() => {});
  }
}
