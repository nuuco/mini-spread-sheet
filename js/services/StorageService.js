import { STORAGE_KEY } from '../constants.js';

export class StorageService {
  constructor(key = STORAGE_KEY) {
    this.key = key;
  }

  load(model) {
    const raw = localStorage.getItem(this.key);
    if (!raw) {
      model.resetToDefaults();
      return;
    }

    try {
      const saved = JSON.parse(raw);
      model.applyPayload({
        rows: saved.rows,
        cols: saved.cols,
        data: saved.data,
        title: saved.title,
      });
    } catch {
      model.resetToDefaults();
    }
  }

  save(model) {
    localStorage.setItem(this.key, JSON.stringify(model.toPayload()));
  }
}
