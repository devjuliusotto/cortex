export type StorageAdapter<T> = {
  load: () => Promise<T | null>;
  save: (value: T) => Promise<void>;
  clear: () => Promise<void>;
};
