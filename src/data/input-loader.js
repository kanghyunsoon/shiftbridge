import { FIELDS } from './csv.js';

// Each input selection commits atomically; an older read cannot overwrite a newer one.
export function createInputLoader(readDefault, { onStart, onCommit, onError, onFinish }) {
  const names = Object.keys(FIELDS).map(kind => kind + '.csv');
  let generation = 0, currentFiles = {};
  const safeRead = async reader => { try { return await reader(); } catch { return null; } };
  async function execute(build, metadata) {
    const request = ++generation;
    let committed = false;
    try {
      onStart();
      const next = await build({ ...currentFiles });
      if (request !== generation) return;
      onCommit({ ...next }, metadata);
      currentFiles = next;
      committed = true;
    } catch (error) {
      if (request === generation) onError(error);
    } finally {
      if (request === generation) onFinish(committed);
    }
  }
  return {
    loadDefaults() {
      return execute(async () => Object.fromEntries(await Promise.all(names.map(async name => [name, await safeRead(() => readDefault(name))]))), { mode: 'default', selected: [], ignored: [] });
    },
    replaceFiles(selected) {
      const replacements = new Map(selected.filter(file => names.includes(file.name)).map(file => [file.name, file]));
      return execute(async previous => Object.fromEntries(await Promise.all(names.map(async name => {
        if (replacements.has(name)) return [name, await safeRead(() => replacements.get(name).text())];
        return [name, Object.hasOwn(previous, name) ? previous[name] : await safeRead(() => readDefault(name))];
      }))), { mode: 'selected', selected: [...replacements.keys()], ignored: selected.filter(file => !names.includes(file.name)).map(file => file.name) });
    }
  };
}
