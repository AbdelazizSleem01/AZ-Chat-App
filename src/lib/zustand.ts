import { useSyncExternalStore } from 'react';

type SetState<T> = (partial: Partial<T> | ((state: T) => Partial<T>), replace?: boolean) => void;
type GetState<T> = () => T;

type StateCreator<T> = (set: SetState<T>, get: GetState<T>) => T;

type StoreApi<T> = {
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: () => void) => () => void;
};

type UseStore<T> = {
  (): T;
  <U>(selector: (state: T) => U): U;
  getState: GetState<T>;
  setState: SetState<T>;
  subscribe: (listener: () => void) => () => void;
};

export function create<T>(createState: StateCreator<T>): UseStore<T> {
  let state: T;
  const listeners = new Set<() => void>();

  const getState: GetState<T> = () => state;

  const setState: SetState<T> = (partial, replace = false) => {
    const nextPartial = typeof partial === 'function' ? partial(state) : partial;
    const nextState = replace ? (nextPartial as T) : ({ ...state, ...nextPartial } as T);
    if (Object.is(nextState, state)) {
      return;
    }
    state = nextState;
    listeners.forEach((listener) => listener());
  };

  const subscribe = (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  state = createState(setState, getState);

  const api: StoreApi<T> = { getState, setState, subscribe };

  function useStore<U>(selector?: (state: T) => U) {
    const selected = useSyncExternalStore(api.subscribe, () => (selector ? selector(api.getState()) : (api.getState() as unknown as U)));
    return selected;
  }

  const typedUseStore = useStore as UseStore<T>;
  typedUseStore.getState = api.getState;
  typedUseStore.setState = api.setState;
  typedUseStore.subscribe = api.subscribe;

  return typedUseStore;
}
