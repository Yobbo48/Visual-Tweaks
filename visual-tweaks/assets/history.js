export class History {
  constructor(initial, limit = 80) {
    this.entries = [structuredClone(initial)];
    this.index = 0;
    this.limit = limit;
  }
  push(value) {
    if (JSON.stringify(value) === JSON.stringify(this.entries[this.index]))
      return;
    this.entries.splice(this.index + 1);
    this.entries.push(structuredClone(value));
    if (this.entries.length > this.limit) this.entries.shift();
    this.index = this.entries.length - 1;
  }
  undo() {
    if (this.index > 0) this.index--;
    return structuredClone(this.entries[this.index]);
  }
  redo() {
    if (this.index < this.entries.length - 1) this.index++;
    return structuredClone(this.entries[this.index]);
  }
  get canUndo() {
    return this.index > 0;
  }
  get canRedo() {
    return this.index < this.entries.length - 1;
  }
}
