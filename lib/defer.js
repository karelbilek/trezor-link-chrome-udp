"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.defer = defer;
function defer() {
  let localResolve = t => {};
  let localReject = e => {};
  const promise = new Promise((resolve, reject) => {
    localResolve = resolve;
    localReject = reject;
  });
  return {
    resolve: localResolve,
    reject: localReject,
    promise
  };
}