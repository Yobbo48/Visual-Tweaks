import { canEditText } from "./selection.js?ver=0.4.4";

// Keep editing plain text: pastes and line breaks never introduce HTML nodes.
export class InlineEditor {
  constructor({ runtime, onInput, onFinish, onCancel }) {
    Object.assign(this, { runtime, onInput, onFinish, onCancel });
    this.node = null;
  }
  get active() {
    return !!this.node;
  }
  contains(node) {
    return this.node && (node === this.node || this.node.contains(node));
  }
  start(node) {
    if (!canEditText(node)) return false;
    this.finish();
    this.node = node;
    this.initial = node.textContent;
    this.previous = {
      editable: node.getAttribute("contenteditable"),
      spellcheck: node.getAttribute("spellcheck"),
    };
    this.runtime().remember(node);
    this.runtime().editingNode = node;
    node.setAttribute("data-vt-inline-edit", "");
    node.setAttribute("contenteditable", "plaintext-only");
    node.setAttribute("spellcheck", "true");
    this.input = () => {
      if (node.childElementCount || node.textContent.length > 4000) {
        const selection = node.ownerDocument.getSelection();
        let offset = node.textContent.length;
        if (selection?.rangeCount) {
          const range = selection.getRangeAt(0).cloneRange();
          range.selectNodeContents(node);
          range.setEnd(selection.anchorNode, selection.anchorOffset);
          offset = range.toString().length;
        }
        const plain =
          node.textContent === ""
            ? ""
            : (node.innerText || node.textContent)
                .replace(/\r\n?/g, "\n")
                .slice(0, 4000);
        node.textContent = plain;
        const text =
          node.firstChild ||
          node.appendChild(node.ownerDocument.createTextNode(""));
        const range = node.ownerDocument.createRange();
        range.setStart(text, Math.min(offset, plain.length));
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);
      }
      this.onInput(node.textContent.slice(0, 4000));
    };
    this.insert = (text) => {
      const selection = node.ownerDocument.getSelection();
      if (!selection.rangeCount) return;
      const range = selection.getRangeAt(0);
      if (!node.contains(range.commonAncestorContainer)) return;
      const available =
        4000 - node.textContent.length + range.toString().length;
      const plain = text
        .replace(/\r\n?/g, "\n")
        .slice(0, Math.max(0, available));
      range.deleteContents();
      const textNode = node.ownerDocument.createTextNode(plain);
      range.insertNode(textNode);
      range.setStartAfter(textNode);
      range.collapse(true);
      selection.removeAllRanges();
      selection.addRange(range);
      this.input();
    };
    this.paste = (event) => {
      event.preventDefault();
      this.insert(event.clipboardData?.getData("text/plain") || "");
    };
    this.before = (event) => {
      if (
        event.inputType.startsWith("format") ||
        event.inputType === "insertFromDrop"
      )
        event.preventDefault();
      if (["insertParagraph", "insertLineBreak"].includes(event.inputType)) {
        event.preventDefault();
        this.insert("\n");
      }
      if (
        event.inputType === "insertText" &&
        node.textContent.length >= 4000 &&
        !node.ownerDocument.getSelection()?.toString()
      )
        event.preventDefault();
    };
    this.key = (event) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        this.cancel();
      }
    };
    node.addEventListener("input", this.input);
    node.addEventListener("paste", this.paste);
    node.addEventListener("beforeinput", this.before);
    node.addEventListener("keydown", this.key);
    node.focus();
    const range = node.ownerDocument.createRange();
    range.selectNodeContents(node);
    const selection = node.ownerDocument.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    return true;
  }
  cleanup() {
    const node = this.node;
    if (!node) return;
    node.removeEventListener("input", this.input);
    node.removeEventListener("paste", this.paste);
    node.removeEventListener("beforeinput", this.before);
    node.removeEventListener("keydown", this.key);
    node.removeAttribute("data-vt-inline-edit");
    for (const [attr, value] of [
      ["contenteditable", this.previous.editable],
      ["spellcheck", this.previous.spellcheck],
    ]) {
      if (value === null) node.removeAttribute(attr);
      else node.setAttribute(attr, value);
    }
    this.runtime().editingNode = null;
    this.node = null;
  }
  finish() {
    if (!this.node) return;
    const text = this.node.textContent.slice(0, 4000);
    this.cleanup();
    this.onFinish(text);
  }
  cancel() {
    if (!this.node) return;
    const node = this.node;
    node.textContent = this.initial;
    this.cleanup();
    this.onCancel();
  }
}
