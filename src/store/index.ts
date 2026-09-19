import dataStore from "./data.store";
import viewStore from "./view.store";
import interactionStore from "./interaction.store";

// Store 门面：保持历史默认导出不变，字段按职责下沉到三个子 store。
// 运行时新增的未声明字段（如 core.js 的 toJsonOptions）落入 interactionStore。
interface Owner {
  [key: PropertyKey]: unknown;
}

const domains: Owner[] = [
  dataStore as unknown as Owner,
  viewStore as unknown as Owner,
  interactionStore as unknown as Owner,
];
const ownerOf = new Map<PropertyKey, Owner>();
for (const domain of domains) {
  for (const key of Object.keys(domain)) {
    if (!ownerOf.has(key)) {
      ownerOf.set(key, domain);
    }
  }
}

function resolveOwner(
  key: PropertyKey,
  forWrite: boolean
): Owner | undefined {
  const owner = ownerOf.get(key);
  if (owner) {
    return owner;
  }
  if (typeof key === "symbol") {
    return undefined;
  }
  if (forWrite) {
    ownerOf.set(key, interactionStore);
    return interactionStore;
  }
  return undefined;
}

const Store = new Proxy(
  {} as Record<PropertyKey, unknown>,
  {
    get(_target, key) {
      if (key === "hasOwnProperty") {
        return (k: PropertyKey) => resolveOwner(k, false) !== undefined;
      }
      const owner = resolveOwner(key, false);
      if (owner) {
        return owner[key];
      }
      // 兜底: toString/valueOf 等 Object.prototype 成员
      return Reflect.get(_target, key);
    },
    set(_target, key, value) {
      const owner = resolveOwner(key, true);
      if (!owner) {
        return true;
      }
      owner[key] = value;
      return true;
    },
    // util.defineBasicReactive 会对 Store 字段装 get/set 观察者，转发到属主对象
    defineProperty(_target, key, descriptor) {
      const owner = resolveOwner(key, true);
      return Reflect.defineProperty(owner || _target, key, descriptor);
    },
    has(_target, key) {
      if (ownerOf.has(key)) {
        return true;
      }
      if (typeof key === "symbol") {
        return Object.prototype.hasOwnProperty.call(interactionStore, key);
      }
      return false;
    },
    deleteProperty(_target, key) {
      const owner = ownerOf.get(key);
      if (owner) {
        delete owner[key];
        ownerOf.delete(key);
      }
      return true;
    },
    ownKeys() {
      return [...ownerOf.keys()].filter(
        (k) => typeof k === "string" || typeof k === "symbol"
      );
    },
    getOwnPropertyDescriptor(_target, key) {
      const owner = ownerOf.get(key);
      if (!owner) {
        return undefined;
      }
      return {
        value: owner[key],
        writable: true,
        enumerable: true,
        configurable: true,
      };
    },
  }
);

export default Store;
export { dataStore, viewStore, interactionStore };
