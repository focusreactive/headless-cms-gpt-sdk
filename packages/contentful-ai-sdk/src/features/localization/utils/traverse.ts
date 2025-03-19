import { KeyValueMap } from '../../../types';

type Callback = (args: { key: string; value: any; parent: KeyValueMap; path: string[] }) => void | boolean;

export const traverseObject = (root: KeyValueMap, callback: Callback) => {
  try {
    _traverse(root, callback);
  } catch (error) {
    if (error instanceof StopTraversalError) {
      return;
    }
    throw error;
  }
};

export class StopTraversalError extends Error {}

const _traverse = (root: KeyValueMap, callback: Callback, path: string[] = []) => {
  for (const [key, value] of Object.entries(root)) {
    if (typeof value === 'object') {
      const result = callback({ key, value, parent: root, path });
      if (result === false) {
        // skip in-depth traversal
        continue;
      }

      // Object.defineProperty(value, '__parent', { value: root, enumerable: false });
      _traverse(value, callback, path.concat(key));
    } else {
      callback({ key, value, parent: root, path });
    }
  }
};

export const getProperty = (root: KeyValueMap, path: string[]) => {
  let value = root;
  for (const key of path) {
    value = value[key];
  }
  return value;
};

export const setProperty = (root: KeyValueMap, path: string[], value: any) => {
  let current = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!current[key]) {
      current[key] = {};
    }
    current = current[key];
  }
  current[path[path.length - 1]] = value;
};

export const deleteProperty = (root: KeyValueMap, path: string[]) => {
  let current = root;
  for (let i = 0; i < path.length - 1; i++) {
    const key = path[i];
    if (!current[key]) {
      return;
    }
    current = current[key];
  }
  delete current[path[path.length - 1]];
};
