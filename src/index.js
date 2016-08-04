/* @flow */

"use strict";

import {defer} from "./defer";
import type {Deferred} from "./defer";

type TrezorDeviceInfo = {path: string};

export default class ChromeUdpTransport {
  waiting: {[id: string]: Deferred<ArrayBuffer>} = {};
  buffered: {[id: string]: Array<ArrayBuffer>} = {};

  infos: {[id: string]: {address: string, port: number}} = {};

  _udpDisconnect(socketId: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        chrome.sockets.udp.close(socketId, () => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            delete this.infos[socketId.toString()];
            resolve();
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  _udpConnect(
      port: number
  ): Promise<number> {
    const address = `127.0.0.1`;
    return new Promise((resolve, reject) => {
      try {
        chrome.sockets.udp.create({}, ({socketId}) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            try {
              chrome.sockets.udp.bind(socketId, `127.0.0.1`, port + portDiff, (result: number) => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  if (result >= 0) {
                    this.infos[socketId.toString()] = {address: address, port: port};
                    resolve(socketId);
                  } else {
                    reject(`Cannot create socket, error: ${result}`);
                  }
                }
              });
            } catch (e) {
              reject(e);
            }
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  _udpReceive(socketId: number): Promise<ArrayBuffer> {
    return this._udpReceiveUnsliced(socketId).then(data => {
      const dataView: Uint8Array = new Uint8Array(data);
      if (dataView[0] !== 63) {
        throw new Error(`Invalid data; first byte should be 63, is ${dataView[0]}`);
      }
      return data.slice(1);
    });
  }

  _udpReceiveUnsliced(
    socketId: number
  ): Promise<ArrayBuffer> {
    const id = socketId.toString();

    if (this.buffered[id] != null) {
      const res = this.buffered[id].shift();
      if (this.buffered[id].length === 0) {
        delete this.buffered[id];
      }
      return Promise.resolve(res);
    }

    if (this.waiting[id] != null) {
      return Promise.reject(`Something else already listening on socketId ${socketId}`);
    }
    const d = defer();
    this.waiting[id] = d;
    return d.promise;
  }

  _udpSend(socketId: number, data: ArrayBuffer): Promise<void> {
    const id = socketId.toString();
    const info = this.infos[id];
    if (info == null) {
      return Promise.reject(`Socket ${socketId} does not exist`);
    }

    const sendDataV: Uint8Array = new Uint8Array(64);
    sendDataV[0] = 63;
    sendDataV.set(new Uint8Array(data), 1);
    const sendData = sendDataV.buffer;

    return new Promise((resolve, reject) => {
      try {
        chrome.sockets.udp.send(socketId, sendData, info.address, info.port, ({resultCode}) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            if (resultCode >= 0) {
              resolve();
            } else {
              reject(`Cannot send, error: ${resultCode}`);
            }
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  _udpListener(socketId: number, data: ArrayBuffer) {
    const id = socketId.toString();
    const d: ?Deferred<ArrayBuffer> = this.waiting[id];
    if (d != null) {
      d.resolve(data);
      delete this.waiting[id];
    } else {
      if (this.infos[id] != null) {
        if (this.buffered[id] == null) {
          this.buffered[id] = [];
        }
        this.buffered[id].pop(data);
      }
    }
  }

  constructor(portDiff: number) {
    this.portDiff = portDiff;
    chrome.sockets.udp.onReceive.addListener(({socketId, data}) => {
      this._udpListener(socketId, data);
    });
  }

  ports: Array<number> = [];

  setPorts(ports: Array<number>) {
    if (ports.length > portDiff) {
      throw new Error(`Too many ports. Max ${portDiff} allowed.`);
    }
    this.ports = ports;
  }

  enumerate(): Promise<Array<TrezorDeviceInfo>> {
    const devices = this.ports.map(port => {
      return {
        path: port.toString(),
      };
    });
    return Promise.resolve(devices);
  }

  send(device: string, session: string, data: ArrayBuffer): Promise<void> {
    const socket = parseInt(session);
    if (isNaN(socket)) {
      return Promise.reject(new Error(`Session not a number`));
    }
    return this._udpSend(socket, data);
  }

  receive(device: string, session: string): Promise<ArrayBuffer> {
    const socket = parseInt(session);
    if (isNaN(socket)) {
      return Promise.reject(new Error(`Session not a number`));
    }
    return this._udpReceive(socket);
  }

  connect(device: string): Promise<string> {
    const port = parseInt(device);
    if (isNaN(port)) {
      return Promise.reject(new Error(`Device not a number`));
    }
    return this._udpConnect(port).then(n => n.toString());
  }

  disconnect(path: string, session: string): Promise<void> {
    const socket = parseInt(session);
    if (isNaN(socket)) {
      return Promise.reject(new Error(`Session not a number`));
    }
    return this._udpDisconnect(socket);
  }
}

