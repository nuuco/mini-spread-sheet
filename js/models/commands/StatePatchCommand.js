import {
  applyPatches,
  enablePatches,
  produceWithPatches,
} from 'https://esm.sh/immer@10.1.1?bundle';

enablePatches();

export class StatePatchCommand {
  constructor(actionName, stateMutator, { persistMode = 'schedule' } = {}) {
    this.actionName = actionName;
    this.stateMutator = stateMutator;
    this.persistMode = persistMode;
    this.patches = null;
    this.inversePatches = null;
    this.meta = {
      changedCells: [],
      structureChanged: false,
    };
  }

  static parsePatchMeta(patches) {
    const changedMap = new Map();
    let structureChanged = false;

    patches.forEach((patch) => {
      const [root, row, col] = patch.path;
      if (root === 'rows' || root === 'cols') {
        structureChanged = true;
      }
      if (root !== 'data' || typeof row !== 'number' || typeof col !== 'number') {
        return;
      }
      const key = `${row}:${col}`;
      if (!changedMap.has(key)) {
        changedMap.set(key, { row, col });
      }
    });

    return {
      changedCells: [...changedMap.values()],
      structureChanged,
    };
  }

  execute(model) {
    if (!this.patches) {
      const [nextState, patches, inversePatches] = produceWithPatches(
        model.createPatchState(),
        this.stateMutator,
      );
      this.patches = patches;
      this.inversePatches = inversePatches;
      this.meta = StatePatchCommand.parsePatchMeta(patches);
      model.applyPatchState(nextState);
      return;
    }

    const nextState = applyPatches(model.createPatchState(), this.patches);
    model.applyPatchState(nextState);
  }

  undo(model) {
    const prevState = applyPatches(model.createPatchState(), this.inversePatches);
    model.applyPatchState(prevState);
  }
}
