"use client";

import { Fragment, type ReactNode, useSyncExternalStore } from "react";

/** Open dialog */
type Entry = { id: number; node: () => ReactNode };

let entries = [] as Entry[];
let counter = 0;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((listener) => listener());
const subscribe = (listener: () => void) => (listeners.add(listener), () => void listeners.delete(listener));

/**
 * Open a dialog from anywhere (engine bridge, menus, other dialogs) and wait for its answer.
 * `render` returns a dialog component and gives it `close(value)`, which resolves the promise.
 */
export function openDialog<T = void>(render: (close: (value?: T) => void) => ReactNode) {
  return new Promise<T | undefined>((solve) => {
    const id = ++counter;
    const close = (value?: T) => {
      if (!entries.some((entry) => entry.id === id)) {
        return;
      }
      entries = entries.filter((entry) => entry.id !== id);
      emit();
      solve(value);
    };
    entries = [...entries, { id, node: () => render(close) }];
    emit();
  });
}

/** Renders every open dialog (mounted once in the editor) */
export function DialogHost() {
  const current = useSyncExternalStore(
    subscribe,
    () => entries,
    () => entries,
  );
  return (
    <>
      {current.map((entry) => (
        <Fragment key={entry.id}>{entry.node()}</Fragment>
      ))}
    </>
  );
}
