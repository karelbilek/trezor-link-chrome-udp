/* @flow */

"use strict";

export type Deferred<T> = {
  resolve: (t: T) => void;
  reject: (e?: ?Error) => void;
  promise: Promise<T>;
};

export function defer<T>(): Deferred<T> {
  let localResolve: (t: T) => void = (t: T) => {};
  let localReject: (e?: ?Error) => void = (e) => {};
  const promise = new Promise((resolve, reject) => {
    localResolve = resolve;
    localReject = reject;
  });
  return {
    resolve: localResolve,
    reject: localReject,
    promise,
  };
}
