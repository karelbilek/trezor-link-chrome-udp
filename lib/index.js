"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _defer = require("./defer");

class ChromeUdpTransport {

  constructor(portDiff) {
    this.waiting = {};
    this.buffered = {};
    this.infos = {};
    this.ports = [];

    this.portDiff = portDiff;
    chrome.sockets.udp.onReceive.addListener(_ref => {
      let socketId = _ref.socketId;
      let data = _ref.data;

      this._udpListener(socketId, data);
    });
  }

  setPorts(ports) {
    if (ports.length > this.portDiff) {
      throw new Error(`Too many ports. Max ${ this.portDiff } allowed.`);
    }
    this.ports = ports;
  }

  enumerate() {
    const devices = this.ports.map(port => {
      return {
        path: port.toString()
      };
    });
    return Promise.resolve(devices);
  }

  send(device, session, data) {
    const socket = parseInt(session);
    if (isNaN(socket)) {
      return Promise.reject(new Error(`Session not a number`));
    }
    return this._udpSend(socket, data);
  }

  receive(device, session) {
    const socket = parseInt(session);
    if (isNaN(socket)) {
      return Promise.reject(new Error(`Session not a number`));
    }
    return this._udpReceive(socket);
  }

  connect(device) {
    const port = parseInt(device);
    if (isNaN(port)) {
      return Promise.reject(new Error(`Device not a number`));
    }
    return this._udpConnect(port).then(n => n.toString());
  }

  disconnect(path, session) {
    const socket = parseInt(session);
    if (isNaN(socket)) {
      return Promise.reject(new Error(`Session not a number`));
    }
    return this._udpDisconnect(socket);
  }

  _udpDisconnect(socketId) {
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

  _udpConnect(port) {
    const address = `127.0.0.1`;
    return new Promise((resolve, reject) => {
      try {
        chrome.sockets.udp.create({}, _ref2 => {
          let socketId = _ref2.socketId;

          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            try {
              chrome.sockets.udp.bind(socketId, `127.0.0.1`, port + this.portDiff, result => {
                if (chrome.runtime.lastError) {
                  reject(chrome.runtime.lastError);
                } else {
                  if (result >= 0) {
                    this.infos[socketId.toString()] = { address: address, port: port };
                    resolve(socketId);
                  } else {
                    reject(`Cannot create socket, error: ${ result }`);
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

  _udpReceive(socketId) {
    return this._udpReceiveUnsliced(socketId).then(data => {
      const dataView = new Uint8Array(data);
      if (dataView[0] !== 63) {
        throw new Error(`Invalid data; first byte should be 63, is ${ dataView[0] }`);
      }
      return data.slice(1);
    });
  }

  _udpReceiveUnsliced(socketId) {
    const id = socketId.toString();

    if (this.buffered[id] != null) {
      const res = this.buffered[id].shift();
      if (this.buffered[id].length === 0) {
        delete this.buffered[id];
      }
      return Promise.resolve(res);
    }

    if (this.waiting[id] != null) {
      return Promise.reject(`Something else already listening on socketId ${ socketId }`);
    }
    const d = (0, _defer.defer)();
    this.waiting[id] = d;
    return d.promise;
  }

  _udpSend(socketId, data) {
    const id = socketId.toString();
    const info = this.infos[id];
    if (info == null) {
      return Promise.reject(`Socket ${ socketId } does not exist`);
    }

    const sendDataV = new Uint8Array(64);
    sendDataV[0] = 63;
    sendDataV.set(new Uint8Array(data), 1);
    const sendData = sendDataV.buffer;

    return new Promise((resolve, reject) => {
      try {
        chrome.sockets.udp.send(socketId, sendData, info.address, info.port, _ref3 => {
          let resultCode = _ref3.resultCode;

          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            if (resultCode >= 0) {
              resolve();
            } else {
              reject(`Cannot send, error: ${ resultCode }`);
            }
          }
        });
      } catch (e) {
        reject(e);
      }
    });
  }

  _udpListener(socketId, data) {
    const id = socketId.toString();
    const d = this.waiting[id];
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

}
exports.default = ChromeUdpTransport;
module.exports = exports['default'];