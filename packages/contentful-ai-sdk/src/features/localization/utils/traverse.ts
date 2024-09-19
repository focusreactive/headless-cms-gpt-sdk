// const traverseObject = ({
//   object,
//   condition,
//   transformKey = ({ newPath }) => newPath,
//   transformValue = ({ value }) => value,
//   path = "",
//   outputArr = [],
// }: TraverseObject) => {
//   if (object && typeof object === "object") {
//     for (const [key, value] of Object.entries(object)) {
//       const newPath = [path, key].filter(Boolean).join(".");

//       if (condition({ key, value, object, newPath })) {
//         outputArr.push([
//           transformKey({ key, newPath, value, object }),
//           transformValue({ key, newPath, value, object }),
//         ]);
//       } else if (value && typeof value === "object") {
//         traverseObject({
//           object: value,
//           condition,
//           transformKey,
//           transformValue,
//           path: newPath,
//           outputArr,
//         });
//       }
//     }
//   }

//   return outputArr;
// }

type NonEmptyObject = { [key: string]: any };
type Callback = (args: { key: string; value: any; parent: NonEmptyObject; path: string[] }) => void | boolean;

export const traverseObject = (root: NonEmptyObject, callback: Callback) => {
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

const _traverse = (root: NonEmptyObject, callback: Callback, path: string[] = []) => {
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

export const getProperty = (root: NonEmptyObject, path: string[]) => {
  let value = root;
  for (const key of path) {
    value = value[key];
  }
  return value;
};

export const setProperty = (root: NonEmptyObject, path: string[], value: any) => {
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

export const deleteProperty = (root: NonEmptyObject, path: string[]) => {
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
