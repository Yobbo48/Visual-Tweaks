export class ContextualToolbar {
  constructor(root, stage) {
    this.stage = stage;
    this.root = root;
    this.root.hidden = true;
    this.bar = document.createElement("div");
    this.bar.className = "context-actions";
    this.root.append(this.bar);
    this.popover = document.createElement("div");
    this.popover.className = "context-popover";
    this.popover.hidden = true;
    this.root.append(this.popover);
    this.root.setAttribute("role", "toolbar");
    this.root.setAttribute("aria-label", "Actions de l’élément");
  }
  setActions(actions) {
    this.bar.replaceChildren();
    this.close();
    for (const action of actions) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = action.label;
      button.title = action.title || action.label;
      button.dataset.action = action.id;
      if (action.active !== undefined) {
        button.setAttribute("aria-pressed", String(action.active));
        button.classList.toggle("active", action.active);
      }
      button.addEventListener("click", () => action.run());
      this.bar.append(button);
    }
    this.root.hidden = false;
  }
  open(label, build) {
    this.popover.replaceChildren();
    this.popover.hidden = false;
    const heading = document.createElement("div");
    heading.className = "popover-heading";
    const title = document.createElement("strong");
    title.textContent = label;
    const close = document.createElement("button");
    close.textContent = "Fermer";
    close.addEventListener("click", () => this.close());
    heading.append(title, close);
    this.popover.append(heading);
    const body = document.createElement("div");
    body.className = "fields";
    this.popover.append(body);
    build(body);
  }
  close() {
    this.popover.hidden = true;
    this.popover.replaceChildren();
  }
  hide() {
    this.root.hidden = true;
    this.close();
  }
  position(rect, frameRect) {
    const stage = this.stage.getBoundingClientRect();
    if (
      rect.bottom < frameRect.top ||
      rect.top > frameRect.bottom ||
      rect.right < frameRect.left ||
      rect.left > frameRect.right
    ) {
      this.root.hidden = true;
      return;
    }
    this.root.hidden = false;
    const x = rect.left - stage.left + this.stage.scrollLeft;
    const y = rect.top - stage.top + this.stage.scrollTop;
    const width = this.root.offsetWidth || 350;
    const minX = this.stage.scrollLeft + 12,
      maxX = this.stage.scrollLeft + this.stage.clientWidth - width - 12;
    this.root.style.left = `${Math.max(minX, Math.min(x, maxX))}px`;
    const above = y - 52;
    this.root.style.top = `${above >= this.stage.scrollTop + 12 ? above : Math.min(this.stage.scrollTop + this.stage.clientHeight - 52, y + rect.height + 16)}px`;
    this.root.classList.toggle(
      "popover-up",
      this.root.offsetTop - this.stage.scrollTop > this.stage.clientHeight / 2,
    );
  }
}
