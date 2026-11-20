// GENERADO por back/mundo/empaquetar.mjs: no editar.
import { createRequire as __cr } from 'node:module'; const require = __cr(import.meta.url);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf, __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require < "u" ? require : typeof Proxy < "u" ? new Proxy(x, {
  get: (a, b) => (typeof require < "u" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require < "u") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __commonJS = (cb, mod) => function() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from == "object" || typeof from == "function")
    for (let key of __getOwnPropNames(from))
      !__hasOwnProp.call(to, key) && key !== except && __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: !0 }) : target,
  mod
));

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"], hasBlob = typeof Blob < "u";
    hasBlob && BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: Symbol("kIsForOnEventAttribute"),
      kListener: Symbol("kListener"),
      kStatusCode: Symbol("status-code"),
      kWebSocket: Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { websocketMask, websocketUnmask } = __require("http"), { EMPTY_BUFFER } = require_constants(), FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      let target = Buffer.allocUnsafe(totalLength), offset = 0;
      for (let i = 0; i < list.length; i++) {
        let buf = list[i];
        target.set(buf, offset), offset += buf.length;
      }
      return offset < totalLength ? new FastBuffer(target.buffer, target.byteOffset, offset) : target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++)
        output[offset + i] = source[i] ^ mask[i & 3];
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++)
        buffer[i] ^= mask[i & 3];
    }
    function toArrayBuffer(buf) {
      return buf.length === buf.buffer.byteLength ? buf.buffer : buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      if (toBuffer.readOnly = !0, Buffer.isBuffer(data)) return data;
      let buf;
      return data instanceof ArrayBuffer ? buf = new FastBuffer(data) : ArrayBuffer.isView(data) ? buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength) : (buf = Buffer.from(data), toBuffer.readOnly = !1), buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (websocketMask)
      module.exports.mask = function(source, mask, output, offset, length) {
        length < 24 ? _mask(source, mask, output, offset, length) : websocketMask(source, mask, output, offset, length);
      }, module.exports.unmask = function(buffer, mask) {
        buffer.length < 24 ? _unmask(buffer, mask) : websocketUnmask(buffer, mask);
      };
    else if (!process.env.WS_NO_BUFFER_UTIL)
      try {
        let bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          length < 48 ? _mask(source, mask, output, offset, length) : bufferUtil.mask(source, mask, output, offset, length);
        }, module.exports.unmask = function(buffer, mask) {
          buffer.length < 32 ? _unmask(buffer, mask) : bufferUtil.unmask(buffer, mask);
        };
      } catch {
      }
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = Symbol("kDone"), kRun = Symbol("kRun"), Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--, this[kRun]();
        }, this.concurrency = concurrency || 1 / 0, this.jobs = [], this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job), this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending !== this.concurrency && this.jobs.length) {
          let job = this.jobs.shift();
          this.pending++, job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib"), bufferUtil = require_buffer_util(), Limiter = require_limiter(), { kStatusCode } = require_constants(), FastBuffer = Buffer[Symbol.species], TRAILER = Buffer.from([0, 0, 255, 255]), kPerMessageDeflate = Symbol("permessage-deflate"), kTotalLength = Symbol("total-length"), kCallback = Symbol("callback"), kBuffers = Symbol("buffers"), kError = Symbol("error"), zlibLimiter, PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        if (this._options = options || {}, this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024, this._maxPayload = this._options.maxPayload | 0, this._isServer = !!this._options.isServer, this._deflate = null, this._inflate = null, this.params = null, !zlibLimiter) {
          let concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        let params = {};
        return this._options.serverNoContextTakeover && (params.server_no_context_takeover = !0), this._options.clientNoContextTakeover && (params.client_no_context_takeover = !0), this._options.serverMaxWindowBits && (params.server_max_window_bits = this._options.serverMaxWindowBits), this._options.clientMaxWindowBits ? params.client_max_window_bits = this._options.clientMaxWindowBits : this._options.clientMaxWindowBits == null && (params.client_max_window_bits = !0), params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        return configurations = this.normalizeParams(configurations), this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations), this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate && (this._inflate.close(), this._inflate = null), this._deflate) {
          let callback = this._deflate[kCallback];
          this._deflate.close(), this._deflate = null, callback && callback(
            new Error(
              "The deflate stream was closed while data was being processed"
            )
          );
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        let opts = this._options, accepted = offers.find((params) => !(opts.serverNoContextTakeover === !1 && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === !1 || typeof opts.serverMaxWindowBits == "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits == "number" && (typeof params.client_max_window_bits == "number" ? opts.clientMaxWindowBits > params.client_max_window_bits : !params.client_max_window_bits)));
        if (!accepted)
          throw new Error("None of the extension offers can be accepted");
        return opts.serverNoContextTakeover && (accepted.server_no_context_takeover = !0), opts.clientNoContextTakeover && (accepted.client_no_context_takeover = !0), typeof opts.serverMaxWindowBits == "number" && (accepted.server_max_window_bits = opts.serverMaxWindowBits), typeof opts.clientMaxWindowBits == "number" ? accepted.client_max_window_bits = opts.clientMaxWindowBits : (accepted.client_max_window_bits === !0 || opts.clientMaxWindowBits === !1) && delete accepted.client_max_window_bits, accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        let params = response[0];
        if (this._options.clientNoContextTakeover === !1 && params.client_no_context_takeover)
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        if (!params.client_max_window_bits)
          typeof this._options.clientMaxWindowBits == "number" && (params.client_max_window_bits = this._options.clientMaxWindowBits);
        else if (this._options.clientMaxWindowBits === !1 || typeof this._options.clientMaxWindowBits == "number" && params.client_max_window_bits > this._options.clientMaxWindowBits)
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        return configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1)
              throw new Error(`Parameter "${key}" must have only a single value`);
            if (value = value[0], key === "client_max_window_bits") {
              if (value !== !0) {
                let num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15)
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                value = num;
              } else if (!this._isServer)
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
            } else if (key === "server_max_window_bits") {
              let num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15)
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== !0)
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
            } else
              throw new Error(`Unknown parameter "${key}"`);
            params[key] = value;
          });
        }), configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done(), callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done(), callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        let endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          let key = `${endpoint}_max_window_bits`, windowBits = typeof this.params[key] != "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          }), this._inflate[kPerMessageDeflate] = this, this._inflate[kTotalLength] = 0, this._inflate[kBuffers] = [], this._inflate.on("error", inflateOnError), this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback, this._inflate.write(data), fin && this._inflate.write(TRAILER), this._inflate.flush(() => {
          let err = this._inflate[kError];
          if (err) {
            this._inflate.close(), this._inflate = null, callback(err);
            return;
          }
          let data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          this._inflate._readableState.endEmitted ? (this._inflate.close(), this._inflate = null) : (this._inflate[kTotalLength] = 0, this._inflate[kBuffers] = [], fin && this.params[`${endpoint}_no_context_takeover`] && this._inflate.reset()), callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        let endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          let key = `${endpoint}_max_window_bits`, windowBits = typeof this.params[key] != "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          }), this._deflate[kTotalLength] = 0, this._deflate[kBuffers] = [], this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback, this._deflate.write(data), this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate)
            return;
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          fin && (data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4)), this._deflate[kCallback] = null, this._deflate[kTotalLength] = 0, this._deflate[kBuffers] = [], fin && this.params[`${endpoint}_no_context_takeover`] && this._deflate.reset(), callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk), this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      if (this[kTotalLength] += chunk.length, this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded"), this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH", this[kError][kStatusCode] = 1009, this.removeListener("data", inflateOnData), this.reset();
    }
    function inflateOnError(err) {
      if (this[kPerMessageDeflate]._inflate = null, this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007, this[kCallback](err);
    }
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer"), { hasBlob } = require_constants(), tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      let len = buf.length, i = 0;
      for (; i < len; )
        if ((buf[i] & 128) === 0)
          i++;
        else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192)
            return !1;
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160)
            return !1;
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244)
            return !1;
          i += 4;
        } else
          return !1;
      return !0;
    }
    function isBlob(value) {
      return hasBlob && typeof value == "object" && typeof value.arrayBuffer == "function" && typeof value.type == "string" && typeof value.stream == "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8)
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    else if (!process.env.WS_NO_UTF_8_VALIDATE)
      try {
        let isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch {
      }
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream"), PerMessageDeflate2 = require_permessage_deflate(), {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants(), { concat, toArrayBuffer, unmask } = require_buffer_util(), { isValidStatusCode, isValidUTF8 } = require_validation(), FastBuffer = Buffer[Symbol.species], GET_INFO = 0, GET_PAYLOAD_LENGTH_16 = 1, GET_PAYLOAD_LENGTH_64 = 2, GET_MASK = 3, GET_DATA = 4, INFLATING = 5, DEFER_EVENT = 6, Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super(), this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : !0, this._binaryType = options.binaryType || BINARY_TYPES[0], this._extensions = options.extensions || {}, this._isServer = !!options.isServer, this._maxBufferedChunks = options.maxBufferedChunks | 0, this._maxFragments = options.maxFragments | 0, this._maxPayload = options.maxPayload | 0, this._skipUTF8Validation = !!options.skipUTF8Validation, this[kWebSocket] = void 0, this._bufferedBytes = 0, this._buffers = [], this._compressed = !1, this._payloadLength = 0, this._mask = void 0, this._fragmented = 0, this._masked = !1, this._fin = !1, this._opcode = 0, this._totalPayloadLength = 0, this._messageLength = 0, this._numFragments = 0, this._fragments = [], this._errored = !1, this._loop = !1, this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              !1,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length, this._buffers.push(chunk), this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        if (this._bufferedBytes -= n, n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          let buf = this._buffers[0];
          return this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          ), new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        let dst = Buffer.allocUnsafe(n);
        do {
          let buf = this._buffers[0], offset = dst.length - n;
          n >= buf.length ? dst.set(this._buffers.shift(), offset) : (dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset), this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          )), n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = !0;
        do
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = !1;
              return;
          }
        while (this._loop);
        this._errored || cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = !1;
          return;
        }
        let buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          let error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            !0,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        let compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          let error = this.createError(
            RangeError,
            "RSV1 must be clear",
            !0,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        if (this._fin = (buf[0] & 128) === 128, this._opcode = buf[0] & 15, this._payloadLength = buf[1] & 127, this._opcode === 0) {
          if (compressed) {
            let error = this.createError(
              RangeError,
              "RSV1 must be clear",
              !0,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            let error = this.createError(
              RangeError,
              "invalid opcode 0",
              !0,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            let error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              !0,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            let error = this.createError(
              RangeError,
              "FIN must be set",
              !0,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            let error = this.createError(
              RangeError,
              "RSV1 must be clear",
              !0,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            let error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              !0,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          let error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            !0,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented && (this._fragmented = this._opcode), this._masked = (buf[1] & 128) === 128, this._isServer) {
          if (!this._masked) {
            let error = this.createError(
              RangeError,
              "MASK must be set",
              !0,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          let error = this.createError(
            RangeError,
            "MASK must be clear",
            !0,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        this._payloadLength === 126 ? this._state = GET_PAYLOAD_LENGTH_16 : this._payloadLength === 127 ? this._state = GET_PAYLOAD_LENGTH_64 : this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = !1;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0), this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = !1;
          return;
        }
        let buf = this.consume(8), num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 21) - 1) {
          let error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            !1,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4), this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8 && (this._totalPayloadLength += this._payloadLength, this._totalPayloadLength > this._maxPayload && this._maxPayload > 0)) {
          let error = this.createError(
            RangeError,
            "Max payload size exceeded",
            !1,
            1009,
            "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
          );
          cb(error);
          return;
        }
        this._masked ? this._state = GET_MASK : this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = !1;
          return;
        }
        this._mask = this.consume(4), this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = !1;
            return;
          }
          data = this.consume(this._payloadLength), this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0 && unmask(data, this._mask);
        }
        if (this._mask = void 0, this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._maxFragments > 0 && ++this._numFragments > this._maxFragments) {
          let error = this.createError(
            RangeError,
            "Too many message fragments",
            !1,
            1008,
            "WS_ERR_TOO_MANY_BUFFERED_PARTS"
          );
          cb(error);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING, this.decompress(data, cb);
          return;
        }
        data.length && (this._messageLength = this._totalPayloadLength, this._fragments.push(data)), this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        this._extensions[PerMessageDeflate2.extensionName].decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            if (this._messageLength += buf.length, this._messageLength > this._maxPayload && this._maxPayload > 0) {
              let error = this.createError(
                RangeError,
                "Max payload size exceeded",
                !1,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb), this._state === GET_INFO && this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        let messageLength = this._messageLength, fragments = this._fragments;
        if (this._totalPayloadLength = 0, this._messageLength = 0, this._fragmented = 0, this._numFragments = 0, this._fragments = [], this._opcode === 2) {
          let data;
          this._binaryType === "nodebuffer" ? data = concat(fragments, messageLength) : this._binaryType === "arraybuffer" ? data = toArrayBuffer(concat(fragments, messageLength)) : this._binaryType === "blob" ? data = new Blob(fragments) : data = fragments, this._allowSynchronousEvents ? (this.emit("message", data, !0), this._state = GET_INFO) : (this._state = DEFER_EVENT, setImmediate(() => {
            this.emit("message", data, !0), this._state = GET_INFO, this.startLoop(cb);
          }));
        } else {
          let buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            let error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              !0,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          this._state === INFLATING || this._allowSynchronousEvents ? (this.emit("message", buf, !1), this._state = GET_INFO) : (this._state = DEFER_EVENT, setImmediate(() => {
            this.emit("message", buf, !1), this._state = GET_INFO, this.startLoop(cb);
          }));
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0)
            this._loop = !1, this.emit("conclude", 1005, EMPTY_BUFFER), this.end();
          else {
            let code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              let error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                !0,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            let buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              let error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                !0,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = !1, this.emit("conclude", code, buf), this.end();
          }
          this._state = GET_INFO;
          return;
        }
        this._allowSynchronousEvents ? (this.emit(this._opcode === 9 ? "ping" : "pong", data), this._state = GET_INFO) : (this._state = DEFER_EVENT, setImmediate(() => {
          this.emit(this._opcode === 9 ? "ping" : "pong", data), this._state = GET_INFO, this.startLoop(cb);
        }));
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = !1, this._errored = !0;
        let err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        return Error.captureStackTrace(err, this.createError), err.code = errorCode, err[kStatusCode] = statusCode, err;
      }
    };
    module.exports = Receiver2;
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex } = __require("stream"), { randomFillSync } = __require("crypto"), {
      types: { isUint8Array }
    } = __require("util"), PerMessageDeflate2 = require_permessage_deflate(), { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants(), { isBlob, isValidStatusCode } = require_validation(), { mask: applyMask, toBuffer } = require_buffer_util(), kByteLength = Symbol("kByteLength"), maskBuffer = Buffer.alloc(4), RANDOM_POOL_SIZE = 8 * 1024, randomPool, randomPoolPointer = RANDOM_POOL_SIZE, DEFAULT = 0, DEFLATING = 1, GET_BLOB_DATA = 2, Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {}, generateMask && (this._generateMask = generateMask, this._maskBuffer = Buffer.alloc(4)), this._socket = socket, this._firstFragment = !0, this._compress = !1, this._bufferedBytes = 0, this._queue = [], this._state = DEFAULT, this.onerror = NOOP, this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask, merge = !1, offset = 2, skipMasking = !1;
        options.mask && (mask = options.maskBuffer || maskBuffer, options.generateMask ? options.generateMask(mask) : (randomPoolPointer === RANDOM_POOL_SIZE && (randomPool === void 0 && (randomPool = Buffer.alloc(RANDOM_POOL_SIZE)), randomFillSync(randomPool, 0, RANDOM_POOL_SIZE), randomPoolPointer = 0), mask[0] = randomPool[randomPoolPointer++], mask[1] = randomPool[randomPoolPointer++], mask[2] = randomPool[randomPoolPointer++], mask[3] = randomPool[randomPoolPointer++]), skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0, offset = 6);
        let dataLength;
        typeof data == "string" ? (!options.mask || skipMasking) && options[kByteLength] !== void 0 ? dataLength = options[kByteLength] : (data = Buffer.from(data), dataLength = data.length) : (dataLength = data.length, merge = options.mask && options.readOnly && !skipMasking);
        let payloadLength = dataLength;
        dataLength >= 65536 ? (offset += 8, payloadLength = 127) : dataLength > 125 && (offset += 2, payloadLength = 126);
        let target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        return target[0] = options.fin ? options.opcode | 128 : options.opcode, options.rsv1 && (target[0] |= 64), target[1] = payloadLength, payloadLength === 126 ? target.writeUInt16BE(dataLength, 2) : payloadLength === 127 && (target[2] = target[3] = 0, target.writeUIntBE(dataLength, 4, 6)), options.mask ? (target[1] |= 128, target[offset - 4] = mask[0], target[offset - 3] = mask[1], target[offset - 2] = mask[2], target[offset - 1] = mask[3], dataLength ? skipMasking ? [target, data] : merge ? (applyMask(data, mask, target, offset, dataLength), [target]) : (applyMask(data, mask, data, 0, dataLength), [target, data]) : [target]) : dataLength ? [target, data] : [target];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0)
          buf = EMPTY_BUFFER;
        else {
          if (typeof code != "number" || !isValidStatusCode(code))
            throw new TypeError("First argument must be a valid error code number");
          if (data === void 0 || !data.length)
            buf = Buffer.allocUnsafe(2), buf.writeUInt16BE(code, 0);
          else {
            let length = Buffer.byteLength(data);
            if (length > 123)
              throw new RangeError("The message must not be greater than 123 bytes");
            if (buf = Buffer.allocUnsafe(2 + length), buf.writeUInt16BE(code, 0), typeof data == "string")
              buf.write(data, 2);
            else if (isUint8Array(data))
              buf.set(data, 2);
            else
              throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        let options = {
          [kByteLength]: buf.length,
          fin: !0,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: !1,
          rsv1: !1
        };
        this._state !== DEFAULT ? this.enqueue([this.dispatch, buf, !1, options, cb]) : this.sendFrame(_Sender.frame(buf, options), cb);
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength, readOnly;
        if (typeof data == "string" ? (byteLength = Buffer.byteLength(data), readOnly = !1) : isBlob(data) ? (byteLength = data.size, readOnly = !1) : (data = toBuffer(data), byteLength = data.length, readOnly = toBuffer.readOnly), byteLength > 125)
          throw new RangeError("The data size must not be greater than 125 bytes");
        let options = {
          [kByteLength]: byteLength,
          fin: !0,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: !1
        };
        isBlob(data) ? this._state !== DEFAULT ? this.enqueue([this.getBlobData, data, !1, options, cb]) : this.getBlobData(data, !1, options, cb) : this._state !== DEFAULT ? this.enqueue([this.dispatch, data, !1, options, cb]) : this.sendFrame(_Sender.frame(data, options), cb);
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength, readOnly;
        if (typeof data == "string" ? (byteLength = Buffer.byteLength(data), readOnly = !1) : isBlob(data) ? (byteLength = data.size, readOnly = !1) : (data = toBuffer(data), byteLength = data.length, readOnly = toBuffer.readOnly), byteLength > 125)
          throw new RangeError("The data size must not be greater than 125 bytes");
        let options = {
          [kByteLength]: byteLength,
          fin: !0,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: !1
        };
        isBlob(data) ? this._state !== DEFAULT ? this.enqueue([this.getBlobData, data, !1, options, cb]) : this.getBlobData(data, !1, options, cb) : this._state !== DEFAULT ? this.enqueue([this.dispatch, data, !1, options, cb]) : this.sendFrame(_Sender.frame(data, options), cb);
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        let perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName], opcode = options.binary ? 2 : 1, rsv1 = options.compress, byteLength, readOnly;
        typeof data == "string" ? (byteLength = Buffer.byteLength(data), readOnly = !1) : isBlob(data) ? (byteLength = data.size, readOnly = !1) : (data = toBuffer(data), byteLength = data.length, readOnly = toBuffer.readOnly), this._firstFragment ? (this._firstFragment = !1, rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"] && (rsv1 = byteLength >= perMessageDeflate._threshold), this._compress = rsv1) : (rsv1 = !1, opcode = 0), options.fin && (this._firstFragment = !0);
        let opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        isBlob(data) ? this._state !== DEFAULT ? this.enqueue([this.getBlobData, data, this._compress, opts, cb]) : this.getBlobData(data, this._compress, opts, cb) : this._state !== DEFAULT ? this.enqueue([this.dispatch, data, this._compress, opts, cb]) : this.dispatch(data, this._compress, opts, cb);
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength], this._state = GET_BLOB_DATA, blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            let err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          let data = toBuffer(arrayBuffer);
          compress ? this.dispatch(data, compress, options, cb) : (this._state = DEFAULT, this.sendFrame(_Sender.frame(data, options), cb), this.dequeue());
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        let perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength], this._state = DEFLATING, perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            let err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength], this._state = DEFAULT, options.readOnly = !1, this.sendFrame(_Sender.frame(buf, options), cb), this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        for (; this._state === DEFAULT && this._queue.length; ) {
          let params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength], Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength], this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        list.length === 2 ? (this._socket.cork(), this._socket.write(list[0]), this._socket.write(list[1], cb), this._socket.uncork()) : this._socket.write(list[0], cb);
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      typeof cb == "function" && cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        let params = sender._queue[i], callback = params[params.length - 1];
        typeof callback == "function" && callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb), sender.onerror(err);
    }
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants(), kCode = Symbol("kCode"), kData = Symbol("kData"), kError = Symbol("kError"), kMessage = Symbol("kMessage"), kReason = Symbol("kReason"), kTarget = Symbol("kTarget"), kType = Symbol("kType"), kWasClean = Symbol("kWasClean"), Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null, this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: !0 });
    Object.defineProperty(Event.prototype, "type", { enumerable: !0 });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type), this[kCode] = options.code === void 0 ? 0 : options.code, this[kReason] = options.reason === void 0 ? "" : options.reason, this[kWasClean] = options.wasClean === void 0 ? !1 : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: !0 });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: !0 });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: !0 });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type), this[kError] = options.error === void 0 ? null : options.error, this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: !0 });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: !0 });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type), this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: !0 });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (let listener of this.listeners(type))
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute])
            return;
        let wrapper;
        if (type === "message")
          wrapper = function(data, isBinary) {
            let event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this, callListener(handler, this, event);
          };
        else if (type === "close")
          wrapper = function(code, message) {
            let event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this, callListener(handler, this, event);
          };
        else if (type === "error")
          wrapper = function(error) {
            let event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this, callListener(handler, this, event);
          };
        else if (type === "open")
          wrapper = function() {
            let event = new Event("open");
            event[kTarget] = this, callListener(handler, this, event);
          };
        else
          return;
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute], wrapper[kListener] = handler, options.once ? this.once(type, wrapper) : this.on(type, wrapper);
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (let listener of this.listeners(type))
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      typeof listener == "object" && listener.handleEvent ? listener.handleEvent.call(listener, event) : listener.call(thisArg, event);
    }
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      dest[name] === void 0 ? dest[name] = [elem] : dest[name].push(elem);
    }
    function parse(header) {
      let offers = /* @__PURE__ */ Object.create(null), params = /* @__PURE__ */ Object.create(null), mustUnescape = !1, isEscaping = !1, inQuotes = !1, extensionName, paramName, start = -1, code = -1, end = -1, i = 0;
      for (; i < header.length; i++)
        if (code = header.charCodeAt(i), extensionName === void 0)
          if (end === -1 && tokenChars[code] === 1)
            start === -1 && (start = i);
          else if (i !== 0 && (code === 32 || code === 9))
            end === -1 && start !== -1 && (end = i);
          else if (code === 59 || code === 44) {
            if (start === -1)
              throw new SyntaxError(`Unexpected character at index ${i}`);
            end === -1 && (end = i);
            let name = header.slice(start, end);
            code === 44 ? (push(offers, name, params), params = /* @__PURE__ */ Object.create(null)) : extensionName = name, start = end = -1;
          } else
            throw new SyntaxError(`Unexpected character at index ${i}`);
        else if (paramName === void 0)
          if (end === -1 && tokenChars[code] === 1)
            start === -1 && (start = i);
          else if (code === 32 || code === 9)
            end === -1 && start !== -1 && (end = i);
          else if (code === 59 || code === 44) {
            if (start === -1)
              throw new SyntaxError(`Unexpected character at index ${i}`);
            end === -1 && (end = i), push(params, header.slice(start, end), !0), code === 44 && (push(offers, extensionName, params), params = /* @__PURE__ */ Object.create(null), extensionName = void 0), start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1)
            paramName = header.slice(start, i), start = end = -1;
          else
            throw new SyntaxError(`Unexpected character at index ${i}`);
        else if (isEscaping) {
          if (tokenChars[code] !== 1)
            throw new SyntaxError(`Unexpected character at index ${i}`);
          start === -1 ? start = i : mustUnescape || (mustUnescape = !0), isEscaping = !1;
        } else if (inQuotes)
          if (tokenChars[code] === 1)
            start === -1 && (start = i);
          else if (code === 34 && start !== -1)
            inQuotes = !1, end = i;
          else if (code === 92)
            isEscaping = !0;
          else
            throw new SyntaxError(`Unexpected character at index ${i}`);
        else if (code === 34 && header.charCodeAt(i - 1) === 61)
          inQuotes = !0;
        else if (end === -1 && tokenChars[code] === 1)
          start === -1 && (start = i);
        else if (start !== -1 && (code === 32 || code === 9))
          end === -1 && (end = i);
        else if (code === 59 || code === 44) {
          if (start === -1)
            throw new SyntaxError(`Unexpected character at index ${i}`);
          end === -1 && (end = i);
          let value = header.slice(start, end);
          mustUnescape && (value = value.replace(/\\/g, ""), mustUnescape = !1), push(params, paramName, value), code === 44 && (push(offers, extensionName, params), params = /* @__PURE__ */ Object.create(null), extensionName = void 0), paramName = void 0, start = end = -1;
        } else
          throw new SyntaxError(`Unexpected character at index ${i}`);
      if (start === -1 || inQuotes || code === 32 || code === 9)
        throw new SyntaxError("Unexpected end of input");
      end === -1 && (end = i);
      let token = header.slice(start, end);
      return extensionName === void 0 ? push(offers, token, params) : (paramName === void 0 ? push(params, token, !0) : mustUnescape ? push(params, paramName, token.replace(/\\/g, "")) : push(params, paramName, token), push(offers, extensionName, params)), offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        return Array.isArray(configurations) || (configurations = [configurations]), configurations.map((params) => [extension2].concat(
          Object.keys(params).map((k) => {
            let values = params[k];
            return Array.isArray(values) || (values = [values]), values.map((v) => v === !0 ? k : `${k}=${v}`).join("; ");
          })
        ).join("; ")).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events"), https = __require("https"), http2 = __require("http"), net = __require("net"), querystring = __require("querystring"), tls = __require("tls"), { randomBytes: randomBytes2, createHash: createHash2 } = __require("crypto"), { Duplex, Readable } = __require("stream"), { URL: URL2 } = __require("url"), PerMessageDeflate2 = require_permessage_deflate(), Receiver2 = require_receiver(), Sender2 = require_sender(), { isBlob } = require_validation(), {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants(), {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target(), { format, parse } = require_extension(), { toBuffer } = require_buffer_util(), kAborted = Symbol("kAborted"), protocolVersions = [8, 13], readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"], subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/, WebSocket2 = class _WebSocket extends EventEmitter {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super(), this._binaryType = BINARY_TYPES[0], this._closeCode = 1006, this._closeFrameReceived = !1, this._closeFrameSent = !1, this._closeMessage = EMPTY_BUFFER, this._closeTimer = null, this._errorEmitted = !1, this._extensions = {}, this._paused = !1, this._protocol = "", this._readyState = _WebSocket.CONNECTING, this._receiver = null, this._sender = null, this._socket = null, address !== null ? (this._bufferedAmount = 0, this._isServer = !1, this._redirects = 0, protocols === void 0 ? !options || options.protocols === void 0 ? protocols = [] : Array.isArray(options.protocols) ? protocols = options.protocols : protocols = [options.protocols] : Array.isArray(protocols) || (typeof protocols == "object" && protocols !== null ? (options = protocols, options.protocols === void 0 ? protocols = [] : Array.isArray(options.protocols) ? protocols = options.protocols : protocols = [options.protocols]) : protocols = [protocols]), options = initAsClient(this, address, protocols, options)) : this._isServer = !0, options.autoPong && (this._autoPong = !0, this._autoPongComplete = () => autoPongComplete(this), this._pendingAutoPongs = 0, this._maxPendingAutoPongs = options.maxPendingAutoPongs | 0), this._closeTimeout = options.closeTimeout;
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        BINARY_TYPES.includes(type) && (this._binaryType = type, this._receiver && (this._receiver._binaryType = type));
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        return this._socket ? this._socket._writableState.length + this._sender._bufferedBytes : this._bufferedAmount;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        let receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        }), sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver, this._sender = sender, this._socket = socket, receiver[kWebSocket] = this, sender[kWebSocket] = this, socket[kWebSocket] = this, receiver.on("conclude", receiverOnConclude), receiver.on("drain", receiverOnDrain), receiver.on("error", receiverOnError), receiver.on("message", receiverOnMessage), receiver.on("ping", receiverOnPing), receiver.on("pong", receiverOnPong), sender.onerror = senderOnError, socket.setTimeout && socket.setTimeout(0), socket.setNoDelay && socket.setNoDelay(), head.length > 0 && socket.unshift(head), socket.on("close", socketOnClose), socket.on("data", socketOnData), socket.on("end", socketOnEnd), socket.on("error", socketOnError), this._readyState = _WebSocket.OPEN, this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED, this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        this._extensions[PerMessageDeflate2.extensionName] && this._extensions[PerMessageDeflate2.extensionName].cleanup(), this._receiver.removeAllListeners(), this._readyState = _WebSocket.CLOSED, this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState !== _WebSocket.CLOSED) {
          if (this.readyState === _WebSocket.CONNECTING) {
            abortHandshake(this, this._req, "WebSocket was closed before the connection was established");
            return;
          }
          if (this.readyState === _WebSocket.CLOSING) {
            this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted) && this._socket.end();
            return;
          }
          this._sender.close(code, data, !this._isServer, (err) => {
            err || (this._closeFrameSent = !0, (this._closeFrameReceived || this._receiver._writableState.errorEmitted) && this._socket.end());
          }), this._readyState = _WebSocket.CLOSING, setCloseTimer(this);
        }
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED || (this._paused = !0, this._socket.pause());
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING)
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        if (typeof data == "function" ? (cb = data, data = mask = void 0) : typeof mask == "function" && (cb = mask, mask = void 0), typeof data == "number" && (data = data.toString()), this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        mask === void 0 && (mask = !this._isServer), this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING)
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        if (typeof data == "function" ? (cb = data, data = mask = void 0) : typeof mask == "function" && (cb = mask, mask = void 0), typeof data == "number" && (data = data.toString()), this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        mask === void 0 && (mask = !this._isServer), this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED || (this._paused = !1, this._receiver._writableState.needDrain || this._socket.resume());
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING)
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        if (typeof options == "function" && (cb = options, options = {}), typeof data == "number" && (data = data.toString()), this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        let opts = {
          binary: typeof data != "string",
          mask: !this._isServer,
          compress: !0,
          fin: !0,
          ...options
        };
        this._extensions[PerMessageDeflate2.extensionName] || (opts.compress = !1), this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState !== _WebSocket.CLOSED) {
          if (this.readyState === _WebSocket.CONNECTING) {
            abortHandshake(this, this._req, "WebSocket was closed before the connection was established");
            return;
          }
          this._socket && (this._readyState = _WebSocket.CLOSING, this._socket.destroy());
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: !0,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: !0,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: !0,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: !0,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: !0,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: !0,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: !0,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: !0,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: !0 });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: !0,
        get() {
          for (let listener of this.listeners(method))
            if (listener[kForOnEventAttribute]) return listener[kListener];
          return null;
        },
        set(handler) {
          for (let listener of this.listeners(method))
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          typeof handler == "function" && this.addEventListener(method, handler, {
            [kForOnEventAttribute]: !0
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      let opts = {
        allowSynchronousEvents: !0,
        autoPong: !0,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 262144,
        maxFragments: 16384,
        maxPayload: 104857600,
        maxPendingAutoPongs: 60,
        skipUTF8Validation: !1,
        perMessageDeflate: !0,
        followRedirects: !1,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        protocols: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      if (!protocolVersions.includes(opts.protocolVersion))
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      let parsedUrl;
      if (address instanceof URL2)
        parsedUrl = address;
      else
        try {
          parsedUrl = new URL2(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      (parsedUrl.protocol === "http:" || parsedUrl.protocol === "https:") && (parsedUrl = new URL2(parsedUrl), parsedUrl.protocol = parsedUrl.protocol === "http:" ? "ws:" : "wss:"), websocket._url = parsedUrl.href;
      let isSecure = parsedUrl.protocol === "wss:", isIpcUrl = parsedUrl.protocol === "ws+unix:", invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl ? invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"` : isIpcUrl && !parsedUrl.pathname ? invalidUrlMessage = "The URL's pathname is empty" : parsedUrl.hash && (invalidUrlMessage = "The URL contains a fragment identifier"), invalidUrlMessage) {
        let err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0)
          throw err;
        emitErrorAndClose(websocket, err);
        return;
      }
      let defaultPort = isSecure ? 443 : 80, key = randomBytes2(16).toString("base64"), request = isSecure ? https.request : http2.request, protocolSet = /* @__PURE__ */ new Set(), perMessageDeflate;
      if (opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect), opts.defaultPort = opts.defaultPort || defaultPort, opts.port = parsedUrl.port || defaultPort, opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname, opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      }, opts.path = parsedUrl.pathname + parsedUrl.search, opts.timeout = opts.handshakeTimeout, opts.perMessageDeflate && (perMessageDeflate = new PerMessageDeflate2({
        ...opts.perMessageDeflate,
        isServer: !1,
        maxPayload: opts.maxPayload
      }), opts.headers["Sec-WebSocket-Extensions"] = format({
        [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
      })), protocols.length) {
        for (let protocol of protocols) {
          if (typeof protocol != "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol))
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin && (opts.protocolVersion < 13 ? opts.headers["Sec-WebSocket-Origin"] = opts.origin : opts.headers.Origin = opts.origin), parsedUrl.username || parsedUrl.password) {
        let username = querystring.unescape(parsedUrl.username), password = querystring.unescape(parsedUrl.password);
        opts.auth = `${username}:${password}`;
      }
      if (isIpcUrl) {
        let i = opts.path.indexOf(":");
        i === -1 ? (opts.socketPath = opts.path, opts.path = "") : (opts.socketPath = opts.path.slice(0, i), opts.path = opts.path.slice(i + 1));
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl, websocket._originalSecure = isSecure, websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          let headers = options && options.headers;
          if (options = { ...options, headers: {} }, headers)
            for (let [key2, value] of Object.entries(headers))
              options.headers[key2.toLowerCase()] = value;
        } else if (websocket.listenerCount("redirect") === 0) {
          let isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : !1 : websocket._originalIpc ? !1 : parsedUrl.host === websocket._originalHostOrSocketPath;
          (!isSameHost || websocket._originalSecure && !isSecure) && (delete opts.headers.authorization, delete opts.headers.cookie, isSameHost || delete opts.headers.host, opts.auth = void 0);
        }
        opts.auth && !options.headers.authorization && (options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64")), req = websocket._req = request(opts), websocket._redirects && websocket.emit("redirect", websocket.url, req);
      } else
        req = websocket._req = request(opts);
      return opts.timeout && req.on("timeout", () => {
        abortHandshake(websocket, req, "Opening handshake has timed out");
      }), req.on("error", (err) => {
        req === null || req[kAborted] || (req = websocket._req = null, emitErrorAndClose(websocket, err));
      }), req.on("response", (res) => {
        let location = res.headers.location, statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL2(location, address);
          } catch {
            let err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else websocket.emit("unexpected-response", req, res) || abortHandshake(
          websocket,
          req,
          `Unexpected server response: ${res.statusCode}`
        );
      }), req.on("upgrade", (res, socket, head) => {
        if (websocket.emit("upgrade", res), websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        let upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        let digest = createHash2("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        let serverProt = res.headers["sec-websocket-protocol"], protError;
        if (serverProt !== void 0 ? protocolSet.size ? protocolSet.has(serverProt) || (protError = "Server sent an invalid subprotocol") : protError = "Server sent a subprotocol but none was requested" : protocolSet.size && (protError = "Server sent no subprotocol"), protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        serverProt && (websocket._protocol = serverProt);
        let secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            abortHandshake(websocket, socket, "Server sent a Sec-WebSocket-Extensions header but no extension was requested");
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch {
            abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Extensions header");
            return;
          }
          let extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            abortHandshake(websocket, socket, "Server indicated an extension that was not requested");
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch {
            abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Extensions header");
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      }), opts.finishRequest ? opts.finishRequest(req, websocket) : req.end(), opts;
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING, websocket._errorEmitted = !0, websocket.emit("error", err), websocket.emitClose();
    }
    function netConnect(options) {
      return options.path = options.socketPath, net.connect(options);
    }
    function tlsConnect(options) {
      return options.path = void 0, !options.servername && options.servername !== "" && (options.servername = net.isIP(options.host) ? "" : options.host), tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      let err = new Error(message);
      Error.captureStackTrace(err, abortHandshake), stream.setHeader ? (stream[kAborted] = !0, stream.abort(), stream.socket && !stream.socket.destroyed && stream.socket.destroy(), process.nextTick(emitErrorAndClose, websocket, err)) : (stream.destroy(err), stream.once("error", websocket.emit.bind(websocket, "error")), stream.once("close", websocket.emitClose.bind(websocket)));
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        let length = isBlob(data) ? data.size : toBuffer(data).length;
        websocket._socket ? websocket._sender._bufferedBytes += length : websocket._bufferedAmount += length;
      }
      if (cb) {
        let err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      let websocket = this[kWebSocket];
      websocket._closeFrameReceived = !0, websocket._closeCode = code, reason.length === 0 ? websocket._closeMessage = EMPTY_BUFFER : (websocket._closeMessage = Buffer.allocUnsafeSlow(reason.length), websocket._closeMessage.set(reason)), websocket._socket[kWebSocket] !== void 0 && (websocket._socket.removeListener("data", socketOnData), process.nextTick(resume, websocket._socket), code === 1005 ? websocket.close() : websocket.close(code, reason));
    }
    function receiverOnDrain() {
      let websocket = this[kWebSocket];
      websocket.isPaused || websocket._socket.resume();
    }
    function receiverOnError(err) {
      let websocket = this[kWebSocket];
      websocket._socket[kWebSocket] !== void 0 && (websocket._socket.removeListener("data", socketOnData), process.nextTick(resume, websocket._socket), websocket.close(err[kStatusCode])), websocket._errorEmitted || (websocket._errorEmitted = !0, websocket.emit("error", err));
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      let websocket = this[kWebSocket];
      websocket._autoPong && websocket.readyState === WebSocket2.OPEN && (websocket._maxPendingAutoPongs > 0 && websocket._pendingAutoPongs >= websocket._maxPendingAutoPongs ? websocket.terminate() : (websocket._pendingAutoPongs++, websocket.pong(data, !this._isServer, websocket._autoPongComplete))), websocket.emit("ping", data);
    }
    function autoPongComplete(websocket) {
      websocket._pendingAutoPongs--;
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      let websocket = this[kWebSocket];
      websocket.readyState !== WebSocket2.CLOSED && (websocket.readyState === WebSocket2.OPEN && (websocket._readyState = WebSocket2.CLOSING, setCloseTimer(websocket)), this._socket.end(), websocket._errorEmitted || (websocket._errorEmitted = !0, websocket.emit("error", err)));
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      let websocket = this[kWebSocket];
      if (this.removeListener("close", socketOnClose), this.removeListener("data", socketOnData), this.removeListener("end", socketOnEnd), websocket._readyState = WebSocket2.CLOSING, !this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        let chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end(), this[kWebSocket] = void 0, clearTimeout(websocket._closeTimer), websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted ? websocket.emitClose() : (websocket._receiver.on("error", receiverOnFinish), websocket._receiver.on("finish", receiverOnFinish));
    }
    function socketOnData(chunk) {
      this[kWebSocket]._receiver.write(chunk) || this.pause();
    }
    function socketOnEnd() {
      let websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING, websocket._receiver.end(), this.end();
    }
    function socketOnError() {
      let websocket = this[kWebSocket];
      this.removeListener("error", socketOnError), this.on("error", NOOP), websocket && (websocket._readyState = WebSocket2.CLOSING, this.destroy());
    }
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket(), { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      !this.destroyed && this._writableState.finished && this.destroy();
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError), this.destroy(), this.listenerCount("error") === 0 && this.emit("error", err);
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = !0, duplex = new Duplex({
        ...options,
        autoDestroy: !1,
        emitClose: !1,
        objectMode: !1,
        writableObjectMode: !1
      });
      return ws.on("message", function(msg, isBinary) {
        let data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        duplex.push(data) || ws.pause();
      }), ws.once("error", function(err) {
        duplex.destroyed || (terminateOnDestroy = !1, duplex.destroy(err));
      }), ws.once("close", function() {
        duplex.destroyed || duplex.push(null);
      }), duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err), process.nextTick(emitClose, duplex);
          return;
        }
        let called = !1;
        ws.once("error", function(err2) {
          called = !0, callback(err2);
        }), ws.once("close", function() {
          called || callback(err), process.nextTick(emitClose, duplex);
        }), terminateOnDestroy && ws.terminate();
      }, duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function() {
            duplex._final(callback);
          });
          return;
        }
        ws._socket !== null && (ws._socket._writableState.finished ? (callback(), duplex._readableState.endEmitted && duplex.destroy()) : (ws._socket.once("finish", function() {
          callback();
        }), ws.close()));
      }, duplex._read = function() {
        ws.isPaused && ws.resume();
      }, duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      }, duplex.on("end", duplexOnEnd), duplex.on("error", duplexOnError), duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      let protocols = /* @__PURE__ */ new Set(), start = -1, end = -1, i = 0;
      for (i; i < header.length; i++) {
        let code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1)
          start === -1 && (start = i);
        else if (i !== 0 && (code === 32 || code === 9))
          end === -1 && start !== -1 && (end = i);
        else if (code === 44) {
          if (start === -1)
            throw new SyntaxError(`Unexpected character at index ${i}`);
          end === -1 && (end = i);
          let protocol2 = header.slice(start, end);
          if (protocols.has(protocol2))
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          protocols.add(protocol2), start = end = -1;
        } else
          throw new SyntaxError(`Unexpected character at index ${i}`);
      }
      if (start === -1 || end !== -1)
        throw new SyntaxError("Unexpected end of input");
      let protocol = header.slice(start, i);
      if (protocols.has(protocol))
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      return protocols.add(protocol), protocols;
    }
    module.exports = { parse };
  }
});

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "node_modules/.pnpm/ws@8.23.0/node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter = __require("events"), http2 = __require("http"), { Duplex } = __require("stream"), { createHash: createHash2 } = __require("crypto"), extension2 = require_extension(), PerMessageDeflate2 = require_permessage_deflate(), subprotocol2 = require_subprotocol(), WebSocket2 = require_websocket(), { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants(), keyRegex = /^[+/0-9A-Za-z]{22}==$/, RUNNING = 0, CLOSING = 1, CLOSED = 2, WebSocketServer2 = class extends EventEmitter {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=262144] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=16384] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Number} [options.maxPendingAutoPongs=60] The maximum number of
       *     pending automatic pongs
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        if (super(), options = {
          allowSynchronousEvents: !0,
          autoPong: !0,
          maxBufferedChunks: 256 * 1024,
          maxFragments: 16 * 1024,
          maxPayload: 100 * 1024 * 1024,
          maxPendingAutoPongs: 60,
          skipUTF8Validation: !1,
          perMessageDeflate: !1,
          handleProtocols: null,
          clientTracking: !0,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: !1,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        }, options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer)
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        if (options.port != null ? (this._server = http2.createServer((req, res) => {
          let body = http2.STATUS_CODES[426];
          res.writeHead(426, {
            "Content-Length": body.length,
            "Content-Type": "text/plain"
          }), res.end(body);
        }), this._server.listen(
          options.port,
          options.host,
          options.backlog,
          callback
        )) : options.server && (this._server = options.server), this._server) {
          let emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        options.perMessageDeflate === !0 && (options.perMessageDeflate = {}), options.clientTracking && (this.clients = /* @__PURE__ */ new Set(), this._shouldEmitClose = !1), this.options = options, this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer)
          throw new Error('The server is operating in "noServer" mode');
        return this._server ? this._server.address() : null;
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          cb && this.once("close", () => {
            cb(new Error("The server is not running"));
          }), process.nextTick(emitClose, this);
          return;
        }
        if (cb && this.once("close", cb), this._state !== CLOSING)
          if (this._state = CLOSING, this.options.noServer || this.options.server)
            this._server && (this._removeListeners(), this._removeListeners = this._server = null), this.clients ? this.clients.size ? this._shouldEmitClose = !0 : process.nextTick(emitClose, this) : process.nextTick(emitClose, this);
          else {
            let server = this._server;
            this._removeListeners(), this._removeListeners = this._server = null, server.close(() => {
              emitClose(this);
            });
          }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          let index = req.url.indexOf("?");
          if ((index !== -1 ? req.url.slice(0, index) : req.url) !== this.options.path) return !1;
        }
        return !0;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        let key = req.headers["sec-websocket-key"], upgrade = req.headers.upgrade, version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, "Invalid HTTP method");
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid Upgrade header");
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Missing or invalid Sec-WebSocket-Key header");
          return;
        }
        if (version !== 13 && version !== 8) {
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Missing or invalid Sec-WebSocket-Version header", {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        let secWebSocketProtocol = req.headers["sec-websocket-protocol"], protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0)
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch {
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid Sec-WebSocket-Protocol header");
            return;
          }
        let secWebSocketExtensions = req.headers["sec-websocket-extensions"], extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          let perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: !0,
            maxPayload: this.options.maxPayload
          });
          try {
            let offers = extension2.parse(secWebSocketExtensions);
            offers[PerMessageDeflate2.extensionName] && (perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]), extensions[PerMessageDeflate2.extensionName] = perMessageDeflate);
          } catch {
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, "Invalid or unacceptable Sec-WebSocket-Extensions header");
            return;
          }
        }
        if (this.options.verifyClient) {
          let info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified)
                return abortHandshake(socket, code || 401, message, headers);
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket])
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        let headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${createHash2("sha1").update(key + GUID).digest("base64")}`
        ], ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          let protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          protocol && (headers.push(`Sec-WebSocket-Protocol: ${protocol}`), ws._protocol = protocol);
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          let params = extensions[PerMessageDeflate2.extensionName].params, value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`), ws._extensions = extensions;
        }
        this.emit("headers", headers, req), socket.write(headers.concat(`\r
`).join(`\r
`)), socket.removeListener("error", socketOnError), ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        }), this.clients && (this.clients.add(ws), ws.on("close", () => {
          this.clients.delete(ws), this._shouldEmitClose && !this.clients.size && process.nextTick(emitClose, this);
        })), cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (let event of Object.keys(map)) server.on(event, map[event]);
      return function() {
        for (let event of Object.keys(map))
          server.removeListener(event, map[event]);
      };
    }
    function emitClose(server) {
      server._state = CLOSED, server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http2.STATUS_CODES[code], headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      }, socket.once("finish", socket.destroy), socket.end(
        `HTTP/1.1 ${code} ${http2.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join(`\r
`) + `\r
\r
` + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        let err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError), server.emit("wsClientError", err, socket, req);
      } else
        abortHandshake(socket, code, message, headers);
    }
  }
});

// ../back/mundo/servidor.mjs
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { createHash, randomBytes } from "node:crypto";
import { fileURLToPath, pathToFileURL } from "node:url";
import { performance as performance2 } from "node:perf_hooks";

// node_modules/.pnpm/ws@8.23.0/node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1), import_extension = __toESM(require_extension(), 1), import_permessage_deflate = __toESM(require_permessage_deflate(), 1), import_receiver = __toESM(require_receiver(), 1), import_sender = __toESM(require_sender(), 1), import_subprotocol = __toESM(require_subprotocol(), 1), import_websocket = __toESM(require_websocket(), 1), import_websocket_server = __toESM(require_websocket_server(), 1);

// node_modules/.pnpm/three@0.180.0/node_modules/three/build/three.core.js
var NeverDepth = 0, AlwaysDepth = 1, LessDepth = 2, LessEqualDepth = 3, EqualDepth = 4, GreaterEqualDepth = 5, GreaterDepth = 6, NotEqualDepth = 7;
var UVMapping = 300;
var RepeatWrapping = 1e3, ClampToEdgeWrapping = 1001, MirroredRepeatWrapping = 1002;
var LinearFilter = 1006;
var LinearMipmapLinearFilter = 1008;
var UnsignedByteType = 1009;
var RGBAFormat = 1023;
var InterpolateDiscrete = 2300, InterpolateLinear = 2301, InterpolateSmooth = 2302, ZeroCurvatureEnding = 2400, ZeroSlopeEnding = 2401, WrapAroundEnding = 2402;
var NoColorSpace = "", SRGBColorSpace = "srgb", LinearSRGBColorSpace = "srgb-linear", LinearTransfer = "linear", SRGBTransfer = "srgb";
var WebGLCoordinateSystem = 2e3, WebGPUCoordinateSystem = 2001;
var EventDispatcher = class {
  /**
   * Adds the given event listener to the given event type.
   *
   * @param {string} type - The type of event to listen to.
   * @param {Function} listener - The function that gets called when the event is fired.
   */
  addEventListener(type, listener) {
    this._listeners === void 0 && (this._listeners = {});
    let listeners = this._listeners;
    listeners[type] === void 0 && (listeners[type] = []), listeners[type].indexOf(listener) === -1 && listeners[type].push(listener);
  }
  /**
   * Returns `true` if the given event listener has been added to the given event type.
   *
   * @param {string} type - The type of event.
   * @param {Function} listener - The listener to check.
   * @return {boolean} Whether the given event listener has been added to the given event type.
   */
  hasEventListener(type, listener) {
    let listeners = this._listeners;
    return listeners === void 0 ? !1 : listeners[type] !== void 0 && listeners[type].indexOf(listener) !== -1;
  }
  /**
   * Removes the given event listener from the given event type.
   *
   * @param {string} type - The type of event.
   * @param {Function} listener - The listener to remove.
   */
  removeEventListener(type, listener) {
    let listeners = this._listeners;
    if (listeners === void 0) return;
    let listenerArray = listeners[type];
    if (listenerArray !== void 0) {
      let index = listenerArray.indexOf(listener);
      index !== -1 && listenerArray.splice(index, 1);
    }
  }
  /**
   * Dispatches an event object.
   *
   * @param {Object} event - The event that gets fired.
   */
  dispatchEvent(event) {
    let listeners = this._listeners;
    if (listeners === void 0) return;
    let listenerArray = listeners[event.type];
    if (listenerArray !== void 0) {
      event.target = this;
      let array = listenerArray.slice(0);
      for (let i = 0, l = array.length; i < l; i++)
        array[i].call(this, event);
      event.target = null;
    }
  }
}, _lut = ["00", "01", "02", "03", "04", "05", "06", "07", "08", "09", "0a", "0b", "0c", "0d", "0e", "0f", "10", "11", "12", "13", "14", "15", "16", "17", "18", "19", "1a", "1b", "1c", "1d", "1e", "1f", "20", "21", "22", "23", "24", "25", "26", "27", "28", "29", "2a", "2b", "2c", "2d", "2e", "2f", "30", "31", "32", "33", "34", "35", "36", "37", "38", "39", "3a", "3b", "3c", "3d", "3e", "3f", "40", "41", "42", "43", "44", "45", "46", "47", "48", "49", "4a", "4b", "4c", "4d", "4e", "4f", "50", "51", "52", "53", "54", "55", "56", "57", "58", "59", "5a", "5b", "5c", "5d", "5e", "5f", "60", "61", "62", "63", "64", "65", "66", "67", "68", "69", "6a", "6b", "6c", "6d", "6e", "6f", "70", "71", "72", "73", "74", "75", "76", "77", "78", "79", "7a", "7b", "7c", "7d", "7e", "7f", "80", "81", "82", "83", "84", "85", "86", "87", "88", "89", "8a", "8b", "8c", "8d", "8e", "8f", "90", "91", "92", "93", "94", "95", "96", "97", "98", "99", "9a", "9b", "9c", "9d", "9e", "9f", "a0", "a1", "a2", "a3", "a4", "a5", "a6", "a7", "a8", "a9", "aa", "ab", "ac", "ad", "ae", "af", "b0", "b1", "b2", "b3", "b4", "b5", "b6", "b7", "b8", "b9", "ba", "bb", "bc", "bd", "be", "bf", "c0", "c1", "c2", "c3", "c4", "c5", "c6", "c7", "c8", "c9", "ca", "cb", "cc", "cd", "ce", "cf", "d0", "d1", "d2", "d3", "d4", "d5", "d6", "d7", "d8", "d9", "da", "db", "dc", "dd", "de", "df", "e0", "e1", "e2", "e3", "e4", "e5", "e6", "e7", "e8", "e9", "ea", "eb", "ec", "ed", "ee", "ef", "f0", "f1", "f2", "f3", "f4", "f5", "f6", "f7", "f8", "f9", "fa", "fb", "fc", "fd", "fe", "ff"];
var DEG2RAD = Math.PI / 180, RAD2DEG = 180 / Math.PI;
function generateUUID() {
  let d0 = Math.random() * 4294967295 | 0, d1 = Math.random() * 4294967295 | 0, d2 = Math.random() * 4294967295 | 0, d3 = Math.random() * 4294967295 | 0;
  return (_lut[d0 & 255] + _lut[d0 >> 8 & 255] + _lut[d0 >> 16 & 255] + _lut[d0 >> 24 & 255] + "-" + _lut[d1 & 255] + _lut[d1 >> 8 & 255] + "-" + _lut[d1 >> 16 & 15 | 64] + _lut[d1 >> 24 & 255] + "-" + _lut[d2 & 63 | 128] + _lut[d2 >> 8 & 255] + "-" + _lut[d2 >> 16 & 255] + _lut[d2 >> 24 & 255] + _lut[d3 & 255] + _lut[d3 >> 8 & 255] + _lut[d3 >> 16 & 255] + _lut[d3 >> 24 & 255]).toLowerCase();
}
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
function euclideanModulo(n, m) {
  return (n % m + m) % m;
}
function lerp(x, y, t) {
  return (1 - t) * x + t * y;
}
var Vector2 = class _Vector2 {
  /**
   * Constructs a new 2D vector.
   *
   * @param {number} [x=0] - The x value of this vector.
   * @param {number} [y=0] - The y value of this vector.
   */
  constructor(x = 0, y = 0) {
    _Vector2.prototype.isVector2 = !0, this.x = x, this.y = y;
  }
  /**
   * Alias for {@link Vector2#x}.
   *
   * @type {number}
   */
  get width() {
    return this.x;
  }
  set width(value) {
    this.x = value;
  }
  /**
   * Alias for {@link Vector2#y}.
   *
   * @type {number}
   */
  get height() {
    return this.y;
  }
  set height(value) {
    this.y = value;
  }
  /**
   * Sets the vector components.
   *
   * @param {number} x - The value of the x component.
   * @param {number} y - The value of the y component.
   * @return {Vector2} A reference to this vector.
   */
  set(x, y) {
    return this.x = x, this.y = y, this;
  }
  /**
   * Sets the vector components to the same value.
   *
   * @param {number} scalar - The value to set for all vector components.
   * @return {Vector2} A reference to this vector.
   */
  setScalar(scalar) {
    return this.x = scalar, this.y = scalar, this;
  }
  /**
   * Sets the vector's x component to the given value
   *
   * @param {number} x - The value to set.
   * @return {Vector2} A reference to this vector.
   */
  setX(x) {
    return this.x = x, this;
  }
  /**
   * Sets the vector's y component to the given value
   *
   * @param {number} y - The value to set.
   * @return {Vector2} A reference to this vector.
   */
  setY(y) {
    return this.y = y, this;
  }
  /**
   * Allows to set a vector component with an index.
   *
   * @param {number} index - The component index. `0` equals to x, `1` equals to y.
   * @param {number} value - The value to set.
   * @return {Vector2} A reference to this vector.
   */
  setComponent(index, value) {
    switch (index) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      default:
        throw new Error("index is out of range: " + index);
    }
    return this;
  }
  /**
   * Returns the value of the vector component which matches the given index.
   *
   * @param {number} index - The component index. `0` equals to x, `1` equals to y.
   * @return {number} A vector component value.
   */
  getComponent(index) {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      default:
        throw new Error("index is out of range: " + index);
    }
  }
  /**
   * Returns a new vector with copied values from this instance.
   *
   * @return {Vector2} A clone of this instance.
   */
  clone() {
    return new this.constructor(this.x, this.y);
  }
  /**
   * Copies the values of the given vector to this instance.
   *
   * @param {Vector2} v - The vector to copy.
   * @return {Vector2} A reference to this vector.
   */
  copy(v) {
    return this.x = v.x, this.y = v.y, this;
  }
  /**
   * Adds the given vector to this instance.
   *
   * @param {Vector2} v - The vector to add.
   * @return {Vector2} A reference to this vector.
   */
  add(v) {
    return this.x += v.x, this.y += v.y, this;
  }
  /**
   * Adds the given scalar value to all components of this instance.
   *
   * @param {number} s - The scalar to add.
   * @return {Vector2} A reference to this vector.
   */
  addScalar(s) {
    return this.x += s, this.y += s, this;
  }
  /**
   * Adds the given vectors and stores the result in this instance.
   *
   * @param {Vector2} a - The first vector.
   * @param {Vector2} b - The second vector.
   * @return {Vector2} A reference to this vector.
   */
  addVectors(a, b) {
    return this.x = a.x + b.x, this.y = a.y + b.y, this;
  }
  /**
   * Adds the given vector scaled by the given factor to this instance.
   *
   * @param {Vector2} v - The vector.
   * @param {number} s - The factor that scales `v`.
   * @return {Vector2} A reference to this vector.
   */
  addScaledVector(v, s) {
    return this.x += v.x * s, this.y += v.y * s, this;
  }
  /**
   * Subtracts the given vector from this instance.
   *
   * @param {Vector2} v - The vector to subtract.
   * @return {Vector2} A reference to this vector.
   */
  sub(v) {
    return this.x -= v.x, this.y -= v.y, this;
  }
  /**
   * Subtracts the given scalar value from all components of this instance.
   *
   * @param {number} s - The scalar to subtract.
   * @return {Vector2} A reference to this vector.
   */
  subScalar(s) {
    return this.x -= s, this.y -= s, this;
  }
  /**
   * Subtracts the given vectors and stores the result in this instance.
   *
   * @param {Vector2} a - The first vector.
   * @param {Vector2} b - The second vector.
   * @return {Vector2} A reference to this vector.
   */
  subVectors(a, b) {
    return this.x = a.x - b.x, this.y = a.y - b.y, this;
  }
  /**
   * Multiplies the given vector with this instance.
   *
   * @param {Vector2} v - The vector to multiply.
   * @return {Vector2} A reference to this vector.
   */
  multiply(v) {
    return this.x *= v.x, this.y *= v.y, this;
  }
  /**
   * Multiplies the given scalar value with all components of this instance.
   *
   * @param {number} scalar - The scalar to multiply.
   * @return {Vector2} A reference to this vector.
   */
  multiplyScalar(scalar) {
    return this.x *= scalar, this.y *= scalar, this;
  }
  /**
   * Divides this instance by the given vector.
   *
   * @param {Vector2} v - The vector to divide.
   * @return {Vector2} A reference to this vector.
   */
  divide(v) {
    return this.x /= v.x, this.y /= v.y, this;
  }
  /**
   * Divides this vector by the given scalar.
   *
   * @param {number} scalar - The scalar to divide.
   * @return {Vector2} A reference to this vector.
   */
  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }
  /**
   * Multiplies this vector (with an implicit 1 as the 3rd component) by
   * the given 3x3 matrix.
   *
   * @param {Matrix3} m - The matrix to apply.
   * @return {Vector2} A reference to this vector.
   */
  applyMatrix3(m) {
    let x = this.x, y = this.y, e = m.elements;
    return this.x = e[0] * x + e[3] * y + e[6], this.y = e[1] * x + e[4] * y + e[7], this;
  }
  /**
   * If this vector's x or y value is greater than the given vector's x or y
   * value, replace that value with the corresponding min value.
   *
   * @param {Vector2} v - The vector.
   * @return {Vector2} A reference to this vector.
   */
  min(v) {
    return this.x = Math.min(this.x, v.x), this.y = Math.min(this.y, v.y), this;
  }
  /**
   * If this vector's x or y value is less than the given vector's x or y
   * value, replace that value with the corresponding max value.
   *
   * @param {Vector2} v - The vector.
   * @return {Vector2} A reference to this vector.
   */
  max(v) {
    return this.x = Math.max(this.x, v.x), this.y = Math.max(this.y, v.y), this;
  }
  /**
   * If this vector's x or y value is greater than the max vector's x or y
   * value, it is replaced by the corresponding value.
   * If this vector's x or y value is less than the min vector's x or y value,
   * it is replaced by the corresponding value.
   *
   * @param {Vector2} min - The minimum x and y values.
   * @param {Vector2} max - The maximum x and y values in the desired range.
   * @return {Vector2} A reference to this vector.
   */
  clamp(min, max) {
    return this.x = clamp(this.x, min.x, max.x), this.y = clamp(this.y, min.y, max.y), this;
  }
  /**
   * If this vector's x or y values are greater than the max value, they are
   * replaced by the max value.
   * If this vector's x or y values are less than the min value, they are
   * replaced by the min value.
   *
   * @param {number} minVal - The minimum value the components will be clamped to.
   * @param {number} maxVal - The maximum value the components will be clamped to.
   * @return {Vector2} A reference to this vector.
   */
  clampScalar(minVal, maxVal) {
    return this.x = clamp(this.x, minVal, maxVal), this.y = clamp(this.y, minVal, maxVal), this;
  }
  /**
   * If this vector's length is greater than the max value, it is replaced by
   * the max value.
   * If this vector's length is less than the min value, it is replaced by the
   * min value.
   *
   * @param {number} min - The minimum value the vector length will be clamped to.
   * @param {number} max - The maximum value the vector length will be clamped to.
   * @return {Vector2} A reference to this vector.
   */
  clampLength(min, max) {
    let length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(clamp(length, min, max));
  }
  /**
   * The components of this vector are rounded down to the nearest integer value.
   *
   * @return {Vector2} A reference to this vector.
   */
  floor() {
    return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this;
  }
  /**
   * The components of this vector are rounded up to the nearest integer value.
   *
   * @return {Vector2} A reference to this vector.
   */
  ceil() {
    return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this;
  }
  /**
   * The components of this vector are rounded to the nearest integer value
   *
   * @return {Vector2} A reference to this vector.
   */
  round() {
    return this.x = Math.round(this.x), this.y = Math.round(this.y), this;
  }
  /**
   * The components of this vector are rounded towards zero (up if negative,
   * down if positive) to an integer value.
   *
   * @return {Vector2} A reference to this vector.
   */
  roundToZero() {
    return this.x = Math.trunc(this.x), this.y = Math.trunc(this.y), this;
  }
  /**
   * Inverts this vector - i.e. sets x = -x and y = -y.
   *
   * @return {Vector2} A reference to this vector.
   */
  negate() {
    return this.x = -this.x, this.y = -this.y, this;
  }
  /**
   * Calculates the dot product of the given vector with this instance.
   *
   * @param {Vector2} v - The vector to compute the dot product with.
   * @return {number} The result of the dot product.
   */
  dot(v) {
    return this.x * v.x + this.y * v.y;
  }
  /**
   * Calculates the cross product of the given vector with this instance.
   *
   * @param {Vector2} v - The vector to compute the cross product with.
   * @return {number} The result of the cross product.
   */
  cross(v) {
    return this.x * v.y - this.y * v.x;
  }
  /**
   * Computes the square of the Euclidean length (straight-line length) from
   * (0, 0) to (x, y). If you are comparing the lengths of vectors, you should
   * compare the length squared instead as it is slightly more efficient to calculate.
   *
   * @return {number} The square length of this vector.
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y;
  }
  /**
   * Computes the  Euclidean length (straight-line length) from (0, 0) to (x, y).
   *
   * @return {number} The length of this vector.
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y);
  }
  /**
   * Computes the Manhattan length of this vector.
   *
   * @return {number} The length of this vector.
   */
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y);
  }
  /**
   * Converts this vector to a unit vector - that is, sets it equal to a vector
   * with the same direction as this one, but with a vector length of `1`.
   *
   * @return {Vector2} A reference to this vector.
   */
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  /**
   * Computes the angle in radians of this vector with respect to the positive x-axis.
   *
   * @return {number} The angle in radians.
   */
  angle() {
    return Math.atan2(-this.y, -this.x) + Math.PI;
  }
  /**
   * Returns the angle between the given vector and this instance in radians.
   *
   * @param {Vector2} v - The vector to compute the angle with.
   * @return {number} The angle in radians.
   */
  angleTo(v) {
    let denominator = Math.sqrt(this.lengthSq() * v.lengthSq());
    if (denominator === 0) return Math.PI / 2;
    let theta = this.dot(v) / denominator;
    return Math.acos(clamp(theta, -1, 1));
  }
  /**
   * Computes the distance from the given vector to this instance.
   *
   * @param {Vector2} v - The vector to compute the distance to.
   * @return {number} The distance.
   */
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  /**
   * Computes the squared distance from the given vector to this instance.
   * If you are just comparing the distance with another distance, you should compare
   * the distance squared instead as it is slightly more efficient to calculate.
   *
   * @param {Vector2} v - The vector to compute the squared distance to.
   * @return {number} The squared distance.
   */
  distanceToSquared(v) {
    let dx = this.x - v.x, dy = this.y - v.y;
    return dx * dx + dy * dy;
  }
  /**
   * Computes the Manhattan distance from the given vector to this instance.
   *
   * @param {Vector2} v - The vector to compute the Manhattan distance to.
   * @return {number} The Manhattan distance.
   */
  manhattanDistanceTo(v) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y);
  }
  /**
   * Sets this vector to a vector with the same direction as this one, but
   * with the specified length.
   *
   * @param {number} length - The new length of this vector.
   * @return {Vector2} A reference to this vector.
   */
  setLength(length) {
    return this.normalize().multiplyScalar(length);
  }
  /**
   * Linearly interpolates between the given vector and this instance, where
   * alpha is the percent distance along the line - alpha = 0 will be this
   * vector, and alpha = 1 will be the given one.
   *
   * @param {Vector2} v - The vector to interpolate towards.
   * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
   * @return {Vector2} A reference to this vector.
   */
  lerp(v, alpha) {
    return this.x += (v.x - this.x) * alpha, this.y += (v.y - this.y) * alpha, this;
  }
  /**
   * Linearly interpolates between the given vectors, where alpha is the percent
   * distance along the line - alpha = 0 will be first vector, and alpha = 1 will
   * be the second one. The result is stored in this instance.
   *
   * @param {Vector2} v1 - The first vector.
   * @param {Vector2} v2 - The second vector.
   * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
   * @return {Vector2} A reference to this vector.
   */
  lerpVectors(v1, v22, alpha) {
    return this.x = v1.x + (v22.x - v1.x) * alpha, this.y = v1.y + (v22.y - v1.y) * alpha, this;
  }
  /**
   * Returns `true` if this vector is equal with the given one.
   *
   * @param {Vector2} v - The vector to test for equality.
   * @return {boolean} Whether this vector is equal with the given one.
   */
  equals(v) {
    return v.x === this.x && v.y === this.y;
  }
  /**
   * Sets this vector's x value to be `array[ offset ]` and y
   * value to be `array[ offset + 1 ]`.
   *
   * @param {Array<number>} array - An array holding the vector component values.
   * @param {number} [offset=0] - The offset into the array.
   * @return {Vector2} A reference to this vector.
   */
  fromArray(array, offset = 0) {
    return this.x = array[offset], this.y = array[offset + 1], this;
  }
  /**
   * Writes the components of this vector to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param {Array<number>} [array=[]] - The target array holding the vector components.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Array<number>} The vector components.
   */
  toArray(array = [], offset = 0) {
    return array[offset] = this.x, array[offset + 1] = this.y, array;
  }
  /**
   * Sets the components of this vector from the given buffer attribute.
   *
   * @param {BufferAttribute} attribute - The buffer attribute holding vector data.
   * @param {number} index - The index into the attribute.
   * @return {Vector2} A reference to this vector.
   */
  fromBufferAttribute(attribute, index) {
    return this.x = attribute.getX(index), this.y = attribute.getY(index), this;
  }
  /**
   * Rotates this vector around the given center by the given angle.
   *
   * @param {Vector2} center - The point around which to rotate.
   * @param {number} angle - The angle to rotate, in radians.
   * @return {Vector2} A reference to this vector.
   */
  rotateAround(center, angle) {
    let c = Math.cos(angle), s = Math.sin(angle), x = this.x - center.x, y = this.y - center.y;
    return this.x = x * c - y * s + center.x, this.y = x * s + y * c + center.y, this;
  }
  /**
   * Sets each component of this vector to a pseudo-random value between `0` and
   * `1`, excluding `1`.
   *
   * @return {Vector2} A reference to this vector.
   */
  random() {
    return this.x = Math.random(), this.y = Math.random(), this;
  }
  *[Symbol.iterator]() {
    yield this.x, yield this.y;
  }
}, Quaternion = class {
  /**
   * Constructs a new quaternion.
   *
   * @param {number} [x=0] - The x value of this quaternion.
   * @param {number} [y=0] - The y value of this quaternion.
   * @param {number} [z=0] - The z value of this quaternion.
   * @param {number} [w=1] - The w value of this quaternion.
   */
  constructor(x = 0, y = 0, z = 0, w = 1) {
    this.isQuaternion = !0, this._x = x, this._y = y, this._z = z, this._w = w;
  }
  /**
   * Interpolates between two quaternions via SLERP. This implementation assumes the
   * quaternion data are managed  in flat arrays.
   *
   * @param {Array<number>} dst - The destination array.
   * @param {number} dstOffset - An offset into the destination array.
   * @param {Array<number>} src0 - The source array of the first quaternion.
   * @param {number} srcOffset0 - An offset into the first source array.
   * @param {Array<number>} src1 -  The source array of the second quaternion.
   * @param {number} srcOffset1 - An offset into the second source array.
   * @param {number} t - The interpolation factor in the range `[0,1]`.
   * @see {@link Quaternion#slerp}
   */
  static slerpFlat(dst, dstOffset, src0, srcOffset0, src1, srcOffset1, t) {
    let x0 = src0[srcOffset0 + 0], y0 = src0[srcOffset0 + 1], z0 = src0[srcOffset0 + 2], w0 = src0[srcOffset0 + 3], x1 = src1[srcOffset1 + 0], y1 = src1[srcOffset1 + 1], z1 = src1[srcOffset1 + 2], w1 = src1[srcOffset1 + 3];
    if (t === 0) {
      dst[dstOffset + 0] = x0, dst[dstOffset + 1] = y0, dst[dstOffset + 2] = z0, dst[dstOffset + 3] = w0;
      return;
    }
    if (t === 1) {
      dst[dstOffset + 0] = x1, dst[dstOffset + 1] = y1, dst[dstOffset + 2] = z1, dst[dstOffset + 3] = w1;
      return;
    }
    if (w0 !== w1 || x0 !== x1 || y0 !== y1 || z0 !== z1) {
      let s = 1 - t, cos = x0 * x1 + y0 * y1 + z0 * z1 + w0 * w1, dir = cos >= 0 ? 1 : -1, sqrSin = 1 - cos * cos;
      if (sqrSin > Number.EPSILON) {
        let sin = Math.sqrt(sqrSin), len = Math.atan2(sin, cos * dir);
        s = Math.sin(s * len) / sin, t = Math.sin(t * len) / sin;
      }
      let tDir = t * dir;
      if (x0 = x0 * s + x1 * tDir, y0 = y0 * s + y1 * tDir, z0 = z0 * s + z1 * tDir, w0 = w0 * s + w1 * tDir, s === 1 - t) {
        let f = 1 / Math.sqrt(x0 * x0 + y0 * y0 + z0 * z0 + w0 * w0);
        x0 *= f, y0 *= f, z0 *= f, w0 *= f;
      }
    }
    dst[dstOffset] = x0, dst[dstOffset + 1] = y0, dst[dstOffset + 2] = z0, dst[dstOffset + 3] = w0;
  }
  /**
   * Multiplies two quaternions. This implementation assumes the quaternion data are managed
   * in flat arrays.
   *
   * @param {Array<number>} dst - The destination array.
   * @param {number} dstOffset - An offset into the destination array.
   * @param {Array<number>} src0 - The source array of the first quaternion.
   * @param {number} srcOffset0 - An offset into the first source array.
   * @param {Array<number>} src1 -  The source array of the second quaternion.
   * @param {number} srcOffset1 - An offset into the second source array.
   * @return {Array<number>} The destination array.
   * @see {@link Quaternion#multiplyQuaternions}.
   */
  static multiplyQuaternionsFlat(dst, dstOffset, src0, srcOffset0, src1, srcOffset1) {
    let x0 = src0[srcOffset0], y0 = src0[srcOffset0 + 1], z0 = src0[srcOffset0 + 2], w0 = src0[srcOffset0 + 3], x1 = src1[srcOffset1], y1 = src1[srcOffset1 + 1], z1 = src1[srcOffset1 + 2], w1 = src1[srcOffset1 + 3];
    return dst[dstOffset] = x0 * w1 + w0 * x1 + y0 * z1 - z0 * y1, dst[dstOffset + 1] = y0 * w1 + w0 * y1 + z0 * x1 - x0 * z1, dst[dstOffset + 2] = z0 * w1 + w0 * z1 + x0 * y1 - y0 * x1, dst[dstOffset + 3] = w0 * w1 - x0 * x1 - y0 * y1 - z0 * z1, dst;
  }
  /**
   * The x value of this quaternion.
   *
   * @type {number}
   * @default 0
   */
  get x() {
    return this._x;
  }
  set x(value) {
    this._x = value, this._onChangeCallback();
  }
  /**
   * The y value of this quaternion.
   *
   * @type {number}
   * @default 0
   */
  get y() {
    return this._y;
  }
  set y(value) {
    this._y = value, this._onChangeCallback();
  }
  /**
   * The z value of this quaternion.
   *
   * @type {number}
   * @default 0
   */
  get z() {
    return this._z;
  }
  set z(value) {
    this._z = value, this._onChangeCallback();
  }
  /**
   * The w value of this quaternion.
   *
   * @type {number}
   * @default 1
   */
  get w() {
    return this._w;
  }
  set w(value) {
    this._w = value, this._onChangeCallback();
  }
  /**
   * Sets the quaternion components.
   *
   * @param {number} x - The x value of this quaternion.
   * @param {number} y - The y value of this quaternion.
   * @param {number} z - The z value of this quaternion.
   * @param {number} w - The w value of this quaternion.
   * @return {Quaternion} A reference to this quaternion.
   */
  set(x, y, z, w) {
    return this._x = x, this._y = y, this._z = z, this._w = w, this._onChangeCallback(), this;
  }
  /**
   * Returns a new quaternion with copied values from this instance.
   *
   * @return {Quaternion} A clone of this instance.
   */
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._w);
  }
  /**
   * Copies the values of the given quaternion to this instance.
   *
   * @param {Quaternion} quaternion - The quaternion to copy.
   * @return {Quaternion} A reference to this quaternion.
   */
  copy(quaternion) {
    return this._x = quaternion.x, this._y = quaternion.y, this._z = quaternion.z, this._w = quaternion.w, this._onChangeCallback(), this;
  }
  /**
   * Sets this quaternion from the rotation specified by the given
   * Euler angles.
   *
   * @param {Euler} euler - The Euler angles.
   * @param {boolean} [update=true] - Whether the internal `onChange` callback should be executed or not.
   * @return {Quaternion} A reference to this quaternion.
   */
  setFromEuler(euler, update = !0) {
    let x = euler._x, y = euler._y, z = euler._z, order = euler._order, cos = Math.cos, sin = Math.sin, c1 = cos(x / 2), c2 = cos(y / 2), c3 = cos(z / 2), s1 = sin(x / 2), s2 = sin(y / 2), s3 = sin(z / 2);
    switch (order) {
      case "XYZ":
        this._x = s1 * c2 * c3 + c1 * s2 * s3, this._y = c1 * s2 * c3 - s1 * c2 * s3, this._z = c1 * c2 * s3 + s1 * s2 * c3, this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "YXZ":
        this._x = s1 * c2 * c3 + c1 * s2 * s3, this._y = c1 * s2 * c3 - s1 * c2 * s3, this._z = c1 * c2 * s3 - s1 * s2 * c3, this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "ZXY":
        this._x = s1 * c2 * c3 - c1 * s2 * s3, this._y = c1 * s2 * c3 + s1 * c2 * s3, this._z = c1 * c2 * s3 + s1 * s2 * c3, this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "ZYX":
        this._x = s1 * c2 * c3 - c1 * s2 * s3, this._y = c1 * s2 * c3 + s1 * c2 * s3, this._z = c1 * c2 * s3 - s1 * s2 * c3, this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      case "YZX":
        this._x = s1 * c2 * c3 + c1 * s2 * s3, this._y = c1 * s2 * c3 + s1 * c2 * s3, this._z = c1 * c2 * s3 - s1 * s2 * c3, this._w = c1 * c2 * c3 - s1 * s2 * s3;
        break;
      case "XZY":
        this._x = s1 * c2 * c3 - c1 * s2 * s3, this._y = c1 * s2 * c3 - s1 * c2 * s3, this._z = c1 * c2 * s3 + s1 * s2 * c3, this._w = c1 * c2 * c3 + s1 * s2 * s3;
        break;
      default:
        console.warn("THREE.Quaternion: .setFromEuler() encountered an unknown order: " + order);
    }
    return update === !0 && this._onChangeCallback(), this;
  }
  /**
   * Sets this quaternion from the given axis and angle.
   *
   * @param {Vector3} axis - The normalized axis.
   * @param {number} angle - The angle in radians.
   * @return {Quaternion} A reference to this quaternion.
   */
  setFromAxisAngle(axis, angle) {
    let halfAngle = angle / 2, s = Math.sin(halfAngle);
    return this._x = axis.x * s, this._y = axis.y * s, this._z = axis.z * s, this._w = Math.cos(halfAngle), this._onChangeCallback(), this;
  }
  /**
   * Sets this quaternion from the given rotation matrix.
   *
   * @param {Matrix4} m - A 4x4 matrix of which the upper 3x3 of matrix is a pure rotation matrix (i.e. unscaled).
   * @return {Quaternion} A reference to this quaternion.
   */
  setFromRotationMatrix(m) {
    let te = m.elements, m11 = te[0], m12 = te[4], m13 = te[8], m21 = te[1], m22 = te[5], m23 = te[9], m31 = te[2], m32 = te[6], m33 = te[10], trace = m11 + m22 + m33;
    if (trace > 0) {
      let s = 0.5 / Math.sqrt(trace + 1);
      this._w = 0.25 / s, this._x = (m32 - m23) * s, this._y = (m13 - m31) * s, this._z = (m21 - m12) * s;
    } else if (m11 > m22 && m11 > m33) {
      let s = 2 * Math.sqrt(1 + m11 - m22 - m33);
      this._w = (m32 - m23) / s, this._x = 0.25 * s, this._y = (m12 + m21) / s, this._z = (m13 + m31) / s;
    } else if (m22 > m33) {
      let s = 2 * Math.sqrt(1 + m22 - m11 - m33);
      this._w = (m13 - m31) / s, this._x = (m12 + m21) / s, this._y = 0.25 * s, this._z = (m23 + m32) / s;
    } else {
      let s = 2 * Math.sqrt(1 + m33 - m11 - m22);
      this._w = (m21 - m12) / s, this._x = (m13 + m31) / s, this._y = (m23 + m32) / s, this._z = 0.25 * s;
    }
    return this._onChangeCallback(), this;
  }
  /**
   * Sets this quaternion to the rotation required to rotate the direction vector
   * `vFrom` to the direction vector `vTo`.
   *
   * @param {Vector3} vFrom - The first (normalized) direction vector.
   * @param {Vector3} vTo - The second (normalized) direction vector.
   * @return {Quaternion} A reference to this quaternion.
   */
  setFromUnitVectors(vFrom, vTo) {
    let r = vFrom.dot(vTo) + 1;
    return r < 1e-8 ? (r = 0, Math.abs(vFrom.x) > Math.abs(vFrom.z) ? (this._x = -vFrom.y, this._y = vFrom.x, this._z = 0, this._w = r) : (this._x = 0, this._y = -vFrom.z, this._z = vFrom.y, this._w = r)) : (this._x = vFrom.y * vTo.z - vFrom.z * vTo.y, this._y = vFrom.z * vTo.x - vFrom.x * vTo.z, this._z = vFrom.x * vTo.y - vFrom.y * vTo.x, this._w = r), this.normalize();
  }
  /**
   * Returns the angle between this quaternion and the given one in radians.
   *
   * @param {Quaternion} q - The quaternion to compute the angle with.
   * @return {number} The angle in radians.
   */
  angleTo(q) {
    return 2 * Math.acos(Math.abs(clamp(this.dot(q), -1, 1)));
  }
  /**
   * Rotates this quaternion by a given angular step to the given quaternion.
   * The method ensures that the final quaternion will not overshoot `q`.
   *
   * @param {Quaternion} q - The target quaternion.
   * @param {number} step - The angular step in radians.
   * @return {Quaternion} A reference to this quaternion.
   */
  rotateTowards(q, step) {
    let angle = this.angleTo(q);
    if (angle === 0) return this;
    let t = Math.min(1, step / angle);
    return this.slerp(q, t), this;
  }
  /**
   * Sets this quaternion to the identity quaternion; that is, to the
   * quaternion that represents "no rotation".
   *
   * @return {Quaternion} A reference to this quaternion.
   */
  identity() {
    return this.set(0, 0, 0, 1);
  }
  /**
   * Inverts this quaternion via {@link Quaternion#conjugate}. The
   * quaternion is assumed to have unit length.
   *
   * @return {Quaternion} A reference to this quaternion.
   */
  invert() {
    return this.conjugate();
  }
  /**
   * Returns the rotational conjugate of this quaternion. The conjugate of a
   * quaternion represents the same rotation in the opposite direction about
   * the rotational axis.
   *
   * @return {Quaternion} A reference to this quaternion.
   */
  conjugate() {
    return this._x *= -1, this._y *= -1, this._z *= -1, this._onChangeCallback(), this;
  }
  /**
   * Calculates the dot product of this quaternion and the given one.
   *
   * @param {Quaternion} v - The quaternion to compute the dot product with.
   * @return {number} The result of the dot product.
   */
  dot(v) {
    return this._x * v._x + this._y * v._y + this._z * v._z + this._w * v._w;
  }
  /**
   * Computes the squared Euclidean length (straight-line length) of this quaternion,
   * considered as a 4 dimensional vector. This can be useful if you are comparing the
   * lengths of two quaternions, as this is a slightly more efficient calculation than
   * {@link Quaternion#length}.
   *
   * @return {number} The squared Euclidean length.
   */
  lengthSq() {
    return this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w;
  }
  /**
   * Computes the Euclidean length (straight-line length) of this quaternion,
   * considered as a 4 dimensional vector.
   *
   * @return {number} The Euclidean length.
   */
  length() {
    return Math.sqrt(this._x * this._x + this._y * this._y + this._z * this._z + this._w * this._w);
  }
  /**
   * Normalizes this quaternion - that is, calculated the quaternion that performs
   * the same rotation as this one, but has a length equal to `1`.
   *
   * @return {Quaternion} A reference to this quaternion.
   */
  normalize() {
    let l = this.length();
    return l === 0 ? (this._x = 0, this._y = 0, this._z = 0, this._w = 1) : (l = 1 / l, this._x = this._x * l, this._y = this._y * l, this._z = this._z * l, this._w = this._w * l), this._onChangeCallback(), this;
  }
  /**
   * Multiplies this quaternion by the given one.
   *
   * @param {Quaternion} q - The quaternion.
   * @return {Quaternion} A reference to this quaternion.
   */
  multiply(q) {
    return this.multiplyQuaternions(this, q);
  }
  /**
   * Pre-multiplies this quaternion by the given one.
   *
   * @param {Quaternion} q - The quaternion.
   * @return {Quaternion} A reference to this quaternion.
   */
  premultiply(q) {
    return this.multiplyQuaternions(q, this);
  }
  /**
   * Multiplies the given quaternions and stores the result in this instance.
   *
   * @param {Quaternion} a - The first quaternion.
   * @param {Quaternion} b - The second quaternion.
   * @return {Quaternion} A reference to this quaternion.
   */
  multiplyQuaternions(a, b) {
    let qax = a._x, qay = a._y, qaz = a._z, qaw = a._w, qbx = b._x, qby = b._y, qbz = b._z, qbw = b._w;
    return this._x = qax * qbw + qaw * qbx + qay * qbz - qaz * qby, this._y = qay * qbw + qaw * qby + qaz * qbx - qax * qbz, this._z = qaz * qbw + qaw * qbz + qax * qby - qay * qbx, this._w = qaw * qbw - qax * qbx - qay * qby - qaz * qbz, this._onChangeCallback(), this;
  }
  /**
   * Performs a spherical linear interpolation between quaternions.
   *
   * @param {Quaternion} qb - The target quaternion.
   * @param {number} t - The interpolation factor in the closed interval `[0, 1]`.
   * @return {Quaternion} A reference to this quaternion.
   */
  slerp(qb, t) {
    if (t === 0) return this;
    if (t === 1) return this.copy(qb);
    let x = this._x, y = this._y, z = this._z, w = this._w, cosHalfTheta = w * qb._w + x * qb._x + y * qb._y + z * qb._z;
    if (cosHalfTheta < 0 ? (this._w = -qb._w, this._x = -qb._x, this._y = -qb._y, this._z = -qb._z, cosHalfTheta = -cosHalfTheta) : this.copy(qb), cosHalfTheta >= 1)
      return this._w = w, this._x = x, this._y = y, this._z = z, this;
    let sqrSinHalfTheta = 1 - cosHalfTheta * cosHalfTheta;
    if (sqrSinHalfTheta <= Number.EPSILON) {
      let s = 1 - t;
      return this._w = s * w + t * this._w, this._x = s * x + t * this._x, this._y = s * y + t * this._y, this._z = s * z + t * this._z, this.normalize(), this;
    }
    let sinHalfTheta = Math.sqrt(sqrSinHalfTheta), halfTheta = Math.atan2(sinHalfTheta, cosHalfTheta), ratioA = Math.sin((1 - t) * halfTheta) / sinHalfTheta, ratioB = Math.sin(t * halfTheta) / sinHalfTheta;
    return this._w = w * ratioA + this._w * ratioB, this._x = x * ratioA + this._x * ratioB, this._y = y * ratioA + this._y * ratioB, this._z = z * ratioA + this._z * ratioB, this._onChangeCallback(), this;
  }
  /**
   * Performs a spherical linear interpolation between the given quaternions
   * and stores the result in this quaternion.
   *
   * @param {Quaternion} qa - The source quaternion.
   * @param {Quaternion} qb - The target quaternion.
   * @param {number} t - The interpolation factor in the closed interval `[0, 1]`.
   * @return {Quaternion} A reference to this quaternion.
   */
  slerpQuaternions(qa, qb, t) {
    return this.copy(qa).slerp(qb, t);
  }
  /**
   * Sets this quaternion to a uniformly random, normalized quaternion.
   *
   * @return {Quaternion} A reference to this quaternion.
   */
  random() {
    let theta1 = 2 * Math.PI * Math.random(), theta2 = 2 * Math.PI * Math.random(), x0 = Math.random(), r1 = Math.sqrt(1 - x0), r22 = Math.sqrt(x0);
    return this.set(
      r1 * Math.sin(theta1),
      r1 * Math.cos(theta1),
      r22 * Math.sin(theta2),
      r22 * Math.cos(theta2)
    );
  }
  /**
   * Returns `true` if this quaternion is equal with the given one.
   *
   * @param {Quaternion} quaternion - The quaternion to test for equality.
   * @return {boolean} Whether this quaternion is equal with the given one.
   */
  equals(quaternion) {
    return quaternion._x === this._x && quaternion._y === this._y && quaternion._z === this._z && quaternion._w === this._w;
  }
  /**
   * Sets this quaternion's components from the given array.
   *
   * @param {Array<number>} array - An array holding the quaternion component values.
   * @param {number} [offset=0] - The offset into the array.
   * @return {Quaternion} A reference to this quaternion.
   */
  fromArray(array, offset = 0) {
    return this._x = array[offset], this._y = array[offset + 1], this._z = array[offset + 2], this._w = array[offset + 3], this._onChangeCallback(), this;
  }
  /**
   * Writes the components of this quaternion to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param {Array<number>} [array=[]] - The target array holding the quaternion components.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Array<number>} The quaternion components.
   */
  toArray(array = [], offset = 0) {
    return array[offset] = this._x, array[offset + 1] = this._y, array[offset + 2] = this._z, array[offset + 3] = this._w, array;
  }
  /**
   * Sets the components of this quaternion from the given buffer attribute.
   *
   * @param {BufferAttribute} attribute - The buffer attribute holding quaternion data.
   * @param {number} index - The index into the attribute.
   * @return {Quaternion} A reference to this quaternion.
   */
  fromBufferAttribute(attribute, index) {
    return this._x = attribute.getX(index), this._y = attribute.getY(index), this._z = attribute.getZ(index), this._w = attribute.getW(index), this._onChangeCallback(), this;
  }
  /**
   * This methods defines the serialization result of this class. Returns the
   * numerical elements of this quaternion in an array of format `[x, y, z, w]`.
   *
   * @return {Array<number>} The serialized quaternion.
   */
  toJSON() {
    return this.toArray();
  }
  _onChange(callback) {
    return this._onChangeCallback = callback, this;
  }
  _onChangeCallback() {
  }
  *[Symbol.iterator]() {
    yield this._x, yield this._y, yield this._z, yield this._w;
  }
}, Vector3 = class _Vector3 {
  /**
   * Constructs a new 3D vector.
   *
   * @param {number} [x=0] - The x value of this vector.
   * @param {number} [y=0] - The y value of this vector.
   * @param {number} [z=0] - The z value of this vector.
   */
  constructor(x = 0, y = 0, z = 0) {
    _Vector3.prototype.isVector3 = !0, this.x = x, this.y = y, this.z = z;
  }
  /**
   * Sets the vector components.
   *
   * @param {number} x - The value of the x component.
   * @param {number} y - The value of the y component.
   * @param {number} z - The value of the z component.
   * @return {Vector3} A reference to this vector.
   */
  set(x, y, z) {
    return z === void 0 && (z = this.z), this.x = x, this.y = y, this.z = z, this;
  }
  /**
   * Sets the vector components to the same value.
   *
   * @param {number} scalar - The value to set for all vector components.
   * @return {Vector3} A reference to this vector.
   */
  setScalar(scalar) {
    return this.x = scalar, this.y = scalar, this.z = scalar, this;
  }
  /**
   * Sets the vector's x component to the given value
   *
   * @param {number} x - The value to set.
   * @return {Vector3} A reference to this vector.
   */
  setX(x) {
    return this.x = x, this;
  }
  /**
   * Sets the vector's y component to the given value
   *
   * @param {number} y - The value to set.
   * @return {Vector3} A reference to this vector.
   */
  setY(y) {
    return this.y = y, this;
  }
  /**
   * Sets the vector's z component to the given value
   *
   * @param {number} z - The value to set.
   * @return {Vector3} A reference to this vector.
   */
  setZ(z) {
    return this.z = z, this;
  }
  /**
   * Allows to set a vector component with an index.
   *
   * @param {number} index - The component index. `0` equals to x, `1` equals to y, `2` equals to z.
   * @param {number} value - The value to set.
   * @return {Vector3} A reference to this vector.
   */
  setComponent(index, value) {
    switch (index) {
      case 0:
        this.x = value;
        break;
      case 1:
        this.y = value;
        break;
      case 2:
        this.z = value;
        break;
      default:
        throw new Error("index is out of range: " + index);
    }
    return this;
  }
  /**
   * Returns the value of the vector component which matches the given index.
   *
   * @param {number} index - The component index. `0` equals to x, `1` equals to y, `2` equals to z.
   * @return {number} A vector component value.
   */
  getComponent(index) {
    switch (index) {
      case 0:
        return this.x;
      case 1:
        return this.y;
      case 2:
        return this.z;
      default:
        throw new Error("index is out of range: " + index);
    }
  }
  /**
   * Returns a new vector with copied values from this instance.
   *
   * @return {Vector3} A clone of this instance.
   */
  clone() {
    return new this.constructor(this.x, this.y, this.z);
  }
  /**
   * Copies the values of the given vector to this instance.
   *
   * @param {Vector3} v - The vector to copy.
   * @return {Vector3} A reference to this vector.
   */
  copy(v) {
    return this.x = v.x, this.y = v.y, this.z = v.z, this;
  }
  /**
   * Adds the given vector to this instance.
   *
   * @param {Vector3} v - The vector to add.
   * @return {Vector3} A reference to this vector.
   */
  add(v) {
    return this.x += v.x, this.y += v.y, this.z += v.z, this;
  }
  /**
   * Adds the given scalar value to all components of this instance.
   *
   * @param {number} s - The scalar to add.
   * @return {Vector3} A reference to this vector.
   */
  addScalar(s) {
    return this.x += s, this.y += s, this.z += s, this;
  }
  /**
   * Adds the given vectors and stores the result in this instance.
   *
   * @param {Vector3} a - The first vector.
   * @param {Vector3} b - The second vector.
   * @return {Vector3} A reference to this vector.
   */
  addVectors(a, b) {
    return this.x = a.x + b.x, this.y = a.y + b.y, this.z = a.z + b.z, this;
  }
  /**
   * Adds the given vector scaled by the given factor to this instance.
   *
   * @param {Vector3|Vector4} v - The vector.
   * @param {number} s - The factor that scales `v`.
   * @return {Vector3} A reference to this vector.
   */
  addScaledVector(v, s) {
    return this.x += v.x * s, this.y += v.y * s, this.z += v.z * s, this;
  }
  /**
   * Subtracts the given vector from this instance.
   *
   * @param {Vector3} v - The vector to subtract.
   * @return {Vector3} A reference to this vector.
   */
  sub(v) {
    return this.x -= v.x, this.y -= v.y, this.z -= v.z, this;
  }
  /**
   * Subtracts the given scalar value from all components of this instance.
   *
   * @param {number} s - The scalar to subtract.
   * @return {Vector3} A reference to this vector.
   */
  subScalar(s) {
    return this.x -= s, this.y -= s, this.z -= s, this;
  }
  /**
   * Subtracts the given vectors and stores the result in this instance.
   *
   * @param {Vector3} a - The first vector.
   * @param {Vector3} b - The second vector.
   * @return {Vector3} A reference to this vector.
   */
  subVectors(a, b) {
    return this.x = a.x - b.x, this.y = a.y - b.y, this.z = a.z - b.z, this;
  }
  /**
   * Multiplies the given vector with this instance.
   *
   * @param {Vector3} v - The vector to multiply.
   * @return {Vector3} A reference to this vector.
   */
  multiply(v) {
    return this.x *= v.x, this.y *= v.y, this.z *= v.z, this;
  }
  /**
   * Multiplies the given scalar value with all components of this instance.
   *
   * @param {number} scalar - The scalar to multiply.
   * @return {Vector3} A reference to this vector.
   */
  multiplyScalar(scalar) {
    return this.x *= scalar, this.y *= scalar, this.z *= scalar, this;
  }
  /**
   * Multiplies the given vectors and stores the result in this instance.
   *
   * @param {Vector3} a - The first vector.
   * @param {Vector3} b - The second vector.
   * @return {Vector3} A reference to this vector.
   */
  multiplyVectors(a, b) {
    return this.x = a.x * b.x, this.y = a.y * b.y, this.z = a.z * b.z, this;
  }
  /**
   * Applies the given Euler rotation to this vector.
   *
   * @param {Euler} euler - The Euler angles.
   * @return {Vector3} A reference to this vector.
   */
  applyEuler(euler) {
    return this.applyQuaternion(_quaternion$4.setFromEuler(euler));
  }
  /**
   * Applies a rotation specified by an axis and an angle to this vector.
   *
   * @param {Vector3} axis - A normalized vector representing the rotation axis.
   * @param {number} angle - The angle in radians.
   * @return {Vector3} A reference to this vector.
   */
  applyAxisAngle(axis, angle) {
    return this.applyQuaternion(_quaternion$4.setFromAxisAngle(axis, angle));
  }
  /**
   * Multiplies this vector with the given 3x3 matrix.
   *
   * @param {Matrix3} m - The 3x3 matrix.
   * @return {Vector3} A reference to this vector.
   */
  applyMatrix3(m) {
    let x = this.x, y = this.y, z = this.z, e = m.elements;
    return this.x = e[0] * x + e[3] * y + e[6] * z, this.y = e[1] * x + e[4] * y + e[7] * z, this.z = e[2] * x + e[5] * y + e[8] * z, this;
  }
  /**
   * Multiplies this vector by the given normal matrix and normalizes
   * the result.
   *
   * @param {Matrix3} m - The normal matrix.
   * @return {Vector3} A reference to this vector.
   */
  applyNormalMatrix(m) {
    return this.applyMatrix3(m).normalize();
  }
  /**
   * Multiplies this vector (with an implicit 1 in the 4th dimension) by m, and
   * divides by perspective.
   *
   * @param {Matrix4} m - The matrix to apply.
   * @return {Vector3} A reference to this vector.
   */
  applyMatrix4(m) {
    let x = this.x, y = this.y, z = this.z, e = m.elements, w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
    return this.x = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w, this.y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w, this.z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w, this;
  }
  /**
   * Applies the given Quaternion to this vector.
   *
   * @param {Quaternion} q - The Quaternion.
   * @return {Vector3} A reference to this vector.
   */
  applyQuaternion(q) {
    let vx = this.x, vy = this.y, vz = this.z, qx = q.x, qy = q.y, qz = q.z, qw = q.w, tx = 2 * (qy * vz - qz * vy), ty = 2 * (qz * vx - qx * vz), tz = 2 * (qx * vy - qy * vx);
    return this.x = vx + qw * tx + qy * tz - qz * ty, this.y = vy + qw * ty + qz * tx - qx * tz, this.z = vz + qw * tz + qx * ty - qy * tx, this;
  }
  /**
   * Projects this vector from world space into the camera's normalized
   * device coordinate (NDC) space.
   *
   * @param {Camera} camera - The camera.
   * @return {Vector3} A reference to this vector.
   */
  project(camera) {
    return this.applyMatrix4(camera.matrixWorldInverse).applyMatrix4(camera.projectionMatrix);
  }
  /**
   * Unprojects this vector from the camera's normalized device coordinate (NDC)
   * space into world space.
   *
   * @param {Camera} camera - The camera.
   * @return {Vector3} A reference to this vector.
   */
  unproject(camera) {
    return this.applyMatrix4(camera.projectionMatrixInverse).applyMatrix4(camera.matrixWorld);
  }
  /**
   * Transforms the direction of this vector by a matrix (the upper left 3 x 3
   * subset of the given 4x4 matrix and then normalizes the result.
   *
   * @param {Matrix4} m - The matrix.
   * @return {Vector3} A reference to this vector.
   */
  transformDirection(m) {
    let x = this.x, y = this.y, z = this.z, e = m.elements;
    return this.x = e[0] * x + e[4] * y + e[8] * z, this.y = e[1] * x + e[5] * y + e[9] * z, this.z = e[2] * x + e[6] * y + e[10] * z, this.normalize();
  }
  /**
   * Divides this instance by the given vector.
   *
   * @param {Vector3} v - The vector to divide.
   * @return {Vector3} A reference to this vector.
   */
  divide(v) {
    return this.x /= v.x, this.y /= v.y, this.z /= v.z, this;
  }
  /**
   * Divides this vector by the given scalar.
   *
   * @param {number} scalar - The scalar to divide.
   * @return {Vector3} A reference to this vector.
   */
  divideScalar(scalar) {
    return this.multiplyScalar(1 / scalar);
  }
  /**
   * If this vector's x, y or z value is greater than the given vector's x, y or z
   * value, replace that value with the corresponding min value.
   *
   * @param {Vector3} v - The vector.
   * @return {Vector3} A reference to this vector.
   */
  min(v) {
    return this.x = Math.min(this.x, v.x), this.y = Math.min(this.y, v.y), this.z = Math.min(this.z, v.z), this;
  }
  /**
   * If this vector's x, y or z value is less than the given vector's x, y or z
   * value, replace that value with the corresponding max value.
   *
   * @param {Vector3} v - The vector.
   * @return {Vector3} A reference to this vector.
   */
  max(v) {
    return this.x = Math.max(this.x, v.x), this.y = Math.max(this.y, v.y), this.z = Math.max(this.z, v.z), this;
  }
  /**
   * If this vector's x, y or z value is greater than the max vector's x, y or z
   * value, it is replaced by the corresponding value.
   * If this vector's x, y or z value is less than the min vector's x, y or z value,
   * it is replaced by the corresponding value.
   *
   * @param {Vector3} min - The minimum x, y and z values.
   * @param {Vector3} max - The maximum x, y and z values in the desired range.
   * @return {Vector3} A reference to this vector.
   */
  clamp(min, max) {
    return this.x = clamp(this.x, min.x, max.x), this.y = clamp(this.y, min.y, max.y), this.z = clamp(this.z, min.z, max.z), this;
  }
  /**
   * If this vector's x, y or z values are greater than the max value, they are
   * replaced by the max value.
   * If this vector's x, y or z values are less than the min value, they are
   * replaced by the min value.
   *
   * @param {number} minVal - The minimum value the components will be clamped to.
   * @param {number} maxVal - The maximum value the components will be clamped to.
   * @return {Vector3} A reference to this vector.
   */
  clampScalar(minVal, maxVal) {
    return this.x = clamp(this.x, minVal, maxVal), this.y = clamp(this.y, minVal, maxVal), this.z = clamp(this.z, minVal, maxVal), this;
  }
  /**
   * If this vector's length is greater than the max value, it is replaced by
   * the max value.
   * If this vector's length is less than the min value, it is replaced by the
   * min value.
   *
   * @param {number} min - The minimum value the vector length will be clamped to.
   * @param {number} max - The maximum value the vector length will be clamped to.
   * @return {Vector3} A reference to this vector.
   */
  clampLength(min, max) {
    let length = this.length();
    return this.divideScalar(length || 1).multiplyScalar(clamp(length, min, max));
  }
  /**
   * The components of this vector are rounded down to the nearest integer value.
   *
   * @return {Vector3} A reference to this vector.
   */
  floor() {
    return this.x = Math.floor(this.x), this.y = Math.floor(this.y), this.z = Math.floor(this.z), this;
  }
  /**
   * The components of this vector are rounded up to the nearest integer value.
   *
   * @return {Vector3} A reference to this vector.
   */
  ceil() {
    return this.x = Math.ceil(this.x), this.y = Math.ceil(this.y), this.z = Math.ceil(this.z), this;
  }
  /**
   * The components of this vector are rounded to the nearest integer value
   *
   * @return {Vector3} A reference to this vector.
   */
  round() {
    return this.x = Math.round(this.x), this.y = Math.round(this.y), this.z = Math.round(this.z), this;
  }
  /**
   * The components of this vector are rounded towards zero (up if negative,
   * down if positive) to an integer value.
   *
   * @return {Vector3} A reference to this vector.
   */
  roundToZero() {
    return this.x = Math.trunc(this.x), this.y = Math.trunc(this.y), this.z = Math.trunc(this.z), this;
  }
  /**
   * Inverts this vector - i.e. sets x = -x, y = -y and z = -z.
   *
   * @return {Vector3} A reference to this vector.
   */
  negate() {
    return this.x = -this.x, this.y = -this.y, this.z = -this.z, this;
  }
  /**
   * Calculates the dot product of the given vector with this instance.
   *
   * @param {Vector3} v - The vector to compute the dot product with.
   * @return {number} The result of the dot product.
   */
  dot(v) {
    return this.x * v.x + this.y * v.y + this.z * v.z;
  }
  // TODO lengthSquared?
  /**
   * Computes the square of the Euclidean length (straight-line length) from
   * (0, 0, 0) to (x, y, z). If you are comparing the lengths of vectors, you should
   * compare the length squared instead as it is slightly more efficient to calculate.
   *
   * @return {number} The square length of this vector.
   */
  lengthSq() {
    return this.x * this.x + this.y * this.y + this.z * this.z;
  }
  /**
   * Computes the  Euclidean length (straight-line length) from (0, 0, 0) to (x, y, z).
   *
   * @return {number} The length of this vector.
   */
  length() {
    return Math.sqrt(this.x * this.x + this.y * this.y + this.z * this.z);
  }
  /**
   * Computes the Manhattan length of this vector.
   *
   * @return {number} The length of this vector.
   */
  manhattanLength() {
    return Math.abs(this.x) + Math.abs(this.y) + Math.abs(this.z);
  }
  /**
   * Converts this vector to a unit vector - that is, sets it equal to a vector
   * with the same direction as this one, but with a vector length of `1`.
   *
   * @return {Vector3} A reference to this vector.
   */
  normalize() {
    return this.divideScalar(this.length() || 1);
  }
  /**
   * Sets this vector to a vector with the same direction as this one, but
   * with the specified length.
   *
   * @param {number} length - The new length of this vector.
   * @return {Vector3} A reference to this vector.
   */
  setLength(length) {
    return this.normalize().multiplyScalar(length);
  }
  /**
   * Linearly interpolates between the given vector and this instance, where
   * alpha is the percent distance along the line - alpha = 0 will be this
   * vector, and alpha = 1 will be the given one.
   *
   * @param {Vector3} v - The vector to interpolate towards.
   * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
   * @return {Vector3} A reference to this vector.
   */
  lerp(v, alpha) {
    return this.x += (v.x - this.x) * alpha, this.y += (v.y - this.y) * alpha, this.z += (v.z - this.z) * alpha, this;
  }
  /**
   * Linearly interpolates between the given vectors, where alpha is the percent
   * distance along the line - alpha = 0 will be first vector, and alpha = 1 will
   * be the second one. The result is stored in this instance.
   *
   * @param {Vector3} v1 - The first vector.
   * @param {Vector3} v2 - The second vector.
   * @param {number} alpha - The interpolation factor, typically in the closed interval `[0, 1]`.
   * @return {Vector3} A reference to this vector.
   */
  lerpVectors(v1, v22, alpha) {
    return this.x = v1.x + (v22.x - v1.x) * alpha, this.y = v1.y + (v22.y - v1.y) * alpha, this.z = v1.z + (v22.z - v1.z) * alpha, this;
  }
  /**
   * Calculates the cross product of the given vector with this instance.
   *
   * @param {Vector3} v - The vector to compute the cross product with.
   * @return {Vector3} The result of the cross product.
   */
  cross(v) {
    return this.crossVectors(this, v);
  }
  /**
   * Calculates the cross product of the given vectors and stores the result
   * in this instance.
   *
   * @param {Vector3} a - The first vector.
   * @param {Vector3} b - The second vector.
   * @return {Vector3} A reference to this vector.
   */
  crossVectors(a, b) {
    let ax = a.x, ay = a.y, az = a.z, bx = b.x, by = b.y, bz = b.z;
    return this.x = ay * bz - az * by, this.y = az * bx - ax * bz, this.z = ax * by - ay * bx, this;
  }
  /**
   * Projects this vector onto the given one.
   *
   * @param {Vector3} v - The vector to project to.
   * @return {Vector3} A reference to this vector.
   */
  projectOnVector(v) {
    let denominator = v.lengthSq();
    if (denominator === 0) return this.set(0, 0, 0);
    let scalar = v.dot(this) / denominator;
    return this.copy(v).multiplyScalar(scalar);
  }
  /**
   * Projects this vector onto a plane by subtracting this
   * vector projected onto the plane's normal from this vector.
   *
   * @param {Vector3} planeNormal - The plane normal.
   * @return {Vector3} A reference to this vector.
   */
  projectOnPlane(planeNormal) {
    return _vector$c.copy(this).projectOnVector(planeNormal), this.sub(_vector$c);
  }
  /**
   * Reflects this vector off a plane orthogonal to the given normal vector.
   *
   * @param {Vector3} normal - The (normalized) normal vector.
   * @return {Vector3} A reference to this vector.
   */
  reflect(normal) {
    return this.sub(_vector$c.copy(normal).multiplyScalar(2 * this.dot(normal)));
  }
  /**
   * Returns the angle between the given vector and this instance in radians.
   *
   * @param {Vector3} v - The vector to compute the angle with.
   * @return {number} The angle in radians.
   */
  angleTo(v) {
    let denominator = Math.sqrt(this.lengthSq() * v.lengthSq());
    if (denominator === 0) return Math.PI / 2;
    let theta = this.dot(v) / denominator;
    return Math.acos(clamp(theta, -1, 1));
  }
  /**
   * Computes the distance from the given vector to this instance.
   *
   * @param {Vector3} v - The vector to compute the distance to.
   * @return {number} The distance.
   */
  distanceTo(v) {
    return Math.sqrt(this.distanceToSquared(v));
  }
  /**
   * Computes the squared distance from the given vector to this instance.
   * If you are just comparing the distance with another distance, you should compare
   * the distance squared instead as it is slightly more efficient to calculate.
   *
   * @param {Vector3} v - The vector to compute the squared distance to.
   * @return {number} The squared distance.
   */
  distanceToSquared(v) {
    let dx = this.x - v.x, dy = this.y - v.y, dz = this.z - v.z;
    return dx * dx + dy * dy + dz * dz;
  }
  /**
   * Computes the Manhattan distance from the given vector to this instance.
   *
   * @param {Vector3} v - The vector to compute the Manhattan distance to.
   * @return {number} The Manhattan distance.
   */
  manhattanDistanceTo(v) {
    return Math.abs(this.x - v.x) + Math.abs(this.y - v.y) + Math.abs(this.z - v.z);
  }
  /**
   * Sets the vector components from the given spherical coordinates.
   *
   * @param {Spherical} s - The spherical coordinates.
   * @return {Vector3} A reference to this vector.
   */
  setFromSpherical(s) {
    return this.setFromSphericalCoords(s.radius, s.phi, s.theta);
  }
  /**
   * Sets the vector components from the given spherical coordinates.
   *
   * @param {number} radius - The radius.
   * @param {number} phi - The phi angle in radians.
   * @param {number} theta - The theta angle in radians.
   * @return {Vector3} A reference to this vector.
   */
  setFromSphericalCoords(radius, phi, theta) {
    let sinPhiRadius = Math.sin(phi) * radius;
    return this.x = sinPhiRadius * Math.sin(theta), this.y = Math.cos(phi) * radius, this.z = sinPhiRadius * Math.cos(theta), this;
  }
  /**
   * Sets the vector components from the given cylindrical coordinates.
   *
   * @param {Cylindrical} c - The cylindrical coordinates.
   * @return {Vector3} A reference to this vector.
   */
  setFromCylindrical(c) {
    return this.setFromCylindricalCoords(c.radius, c.theta, c.y);
  }
  /**
   * Sets the vector components from the given cylindrical coordinates.
   *
   * @param {number} radius - The radius.
   * @param {number} theta - The theta angle in radians.
   * @param {number} y - The y value.
   * @return {Vector3} A reference to this vector.
   */
  setFromCylindricalCoords(radius, theta, y) {
    return this.x = radius * Math.sin(theta), this.y = y, this.z = radius * Math.cos(theta), this;
  }
  /**
   * Sets the vector components to the position elements of the
   * given transformation matrix.
   *
   * @param {Matrix4} m - The 4x4 matrix.
   * @return {Vector3} A reference to this vector.
   */
  setFromMatrixPosition(m) {
    let e = m.elements;
    return this.x = e[12], this.y = e[13], this.z = e[14], this;
  }
  /**
   * Sets the vector components to the scale elements of the
   * given transformation matrix.
   *
   * @param {Matrix4} m - The 4x4 matrix.
   * @return {Vector3} A reference to this vector.
   */
  setFromMatrixScale(m) {
    let sx = this.setFromMatrixColumn(m, 0).length(), sy = this.setFromMatrixColumn(m, 1).length(), sz = this.setFromMatrixColumn(m, 2).length();
    return this.x = sx, this.y = sy, this.z = sz, this;
  }
  /**
   * Sets the vector components from the specified matrix column.
   *
   * @param {Matrix4} m - The 4x4 matrix.
   * @param {number} index - The column index.
   * @return {Vector3} A reference to this vector.
   */
  setFromMatrixColumn(m, index) {
    return this.fromArray(m.elements, index * 4);
  }
  /**
   * Sets the vector components from the specified matrix column.
   *
   * @param {Matrix3} m - The 3x3 matrix.
   * @param {number} index - The column index.
   * @return {Vector3} A reference to this vector.
   */
  setFromMatrix3Column(m, index) {
    return this.fromArray(m.elements, index * 3);
  }
  /**
   * Sets the vector components from the given Euler angles.
   *
   * @param {Euler} e - The Euler angles to set.
   * @return {Vector3} A reference to this vector.
   */
  setFromEuler(e) {
    return this.x = e._x, this.y = e._y, this.z = e._z, this;
  }
  /**
   * Sets the vector components from the RGB components of the
   * given color.
   *
   * @param {Color} c - The color to set.
   * @return {Vector3} A reference to this vector.
   */
  setFromColor(c) {
    return this.x = c.r, this.y = c.g, this.z = c.b, this;
  }
  /**
   * Returns `true` if this vector is equal with the given one.
   *
   * @param {Vector3} v - The vector to test for equality.
   * @return {boolean} Whether this vector is equal with the given one.
   */
  equals(v) {
    return v.x === this.x && v.y === this.y && v.z === this.z;
  }
  /**
   * Sets this vector's x value to be `array[ offset ]`, y value to be `array[ offset + 1 ]`
   * and z value to be `array[ offset + 2 ]`.
   *
   * @param {Array<number>} array - An array holding the vector component values.
   * @param {number} [offset=0] - The offset into the array.
   * @return {Vector3} A reference to this vector.
   */
  fromArray(array, offset = 0) {
    return this.x = array[offset], this.y = array[offset + 1], this.z = array[offset + 2], this;
  }
  /**
   * Writes the components of this vector to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param {Array<number>} [array=[]] - The target array holding the vector components.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Array<number>} The vector components.
   */
  toArray(array = [], offset = 0) {
    return array[offset] = this.x, array[offset + 1] = this.y, array[offset + 2] = this.z, array;
  }
  /**
   * Sets the components of this vector from the given buffer attribute.
   *
   * @param {BufferAttribute} attribute - The buffer attribute holding vector data.
   * @param {number} index - The index into the attribute.
   * @return {Vector3} A reference to this vector.
   */
  fromBufferAttribute(attribute, index) {
    return this.x = attribute.getX(index), this.y = attribute.getY(index), this.z = attribute.getZ(index), this;
  }
  /**
   * Sets each component of this vector to a pseudo-random value between `0` and
   * `1`, excluding `1`.
   *
   * @return {Vector3} A reference to this vector.
   */
  random() {
    return this.x = Math.random(), this.y = Math.random(), this.z = Math.random(), this;
  }
  /**
   * Sets this vector to a uniformly random point on a unit sphere.
   *
   * @return {Vector3} A reference to this vector.
   */
  randomDirection() {
    let theta = Math.random() * Math.PI * 2, u = Math.random() * 2 - 1, c = Math.sqrt(1 - u * u);
    return this.x = c * Math.cos(theta), this.y = u, this.z = c * Math.sin(theta), this;
  }
  *[Symbol.iterator]() {
    yield this.x, yield this.y, yield this.z;
  }
}, _vector$c = /* @__PURE__ */ new Vector3(), _quaternion$4 = /* @__PURE__ */ new Quaternion(), Matrix3 = class _Matrix3 {
  /**
   * Constructs a new 3x3 matrix. The arguments are supposed to be
   * in row-major order. If no arguments are provided, the constructor
   * initializes the matrix as an identity matrix.
   *
   * @param {number} [n11] - 1-1 matrix element.
   * @param {number} [n12] - 1-2 matrix element.
   * @param {number} [n13] - 1-3 matrix element.
   * @param {number} [n21] - 2-1 matrix element.
   * @param {number} [n22] - 2-2 matrix element.
   * @param {number} [n23] - 2-3 matrix element.
   * @param {number} [n31] - 3-1 matrix element.
   * @param {number} [n32] - 3-2 matrix element.
   * @param {number} [n33] - 3-3 matrix element.
   */
  constructor(n11, n12, n13, n21, n22, n23, n31, n32, n33) {
    _Matrix3.prototype.isMatrix3 = !0, this.elements = [
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1
    ], n11 !== void 0 && this.set(n11, n12, n13, n21, n22, n23, n31, n32, n33);
  }
  /**
   * Sets the elements of the matrix.The arguments are supposed to be
   * in row-major order.
   *
   * @param {number} [n11] - 1-1 matrix element.
   * @param {number} [n12] - 1-2 matrix element.
   * @param {number} [n13] - 1-3 matrix element.
   * @param {number} [n21] - 2-1 matrix element.
   * @param {number} [n22] - 2-2 matrix element.
   * @param {number} [n23] - 2-3 matrix element.
   * @param {number} [n31] - 3-1 matrix element.
   * @param {number} [n32] - 3-2 matrix element.
   * @param {number} [n33] - 3-3 matrix element.
   * @return {Matrix3} A reference to this matrix.
   */
  set(n11, n12, n13, n21, n22, n23, n31, n32, n33) {
    let te = this.elements;
    return te[0] = n11, te[1] = n21, te[2] = n31, te[3] = n12, te[4] = n22, te[5] = n32, te[6] = n13, te[7] = n23, te[8] = n33, this;
  }
  /**
   * Sets this matrix to the 3x3 identity matrix.
   *
   * @return {Matrix3} A reference to this matrix.
   */
  identity() {
    return this.set(
      1,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Copies the values of the given matrix to this instance.
   *
   * @param {Matrix3} m - The matrix to copy.
   * @return {Matrix3} A reference to this matrix.
   */
  copy(m) {
    let te = this.elements, me = m.elements;
    return te[0] = me[0], te[1] = me[1], te[2] = me[2], te[3] = me[3], te[4] = me[4], te[5] = me[5], te[6] = me[6], te[7] = me[7], te[8] = me[8], this;
  }
  /**
   * Extracts the basis of this matrix into the three axis vectors provided.
   *
   * @param {Vector3} xAxis - The basis's x axis.
   * @param {Vector3} yAxis - The basis's y axis.
   * @param {Vector3} zAxis - The basis's z axis.
   * @return {Matrix3} A reference to this matrix.
   */
  extractBasis(xAxis, yAxis, zAxis) {
    return xAxis.setFromMatrix3Column(this, 0), yAxis.setFromMatrix3Column(this, 1), zAxis.setFromMatrix3Column(this, 2), this;
  }
  /**
   * Set this matrix to the upper 3x3 matrix of the given 4x4 matrix.
   *
   * @param {Matrix4} m - The 4x4 matrix.
   * @return {Matrix3} A reference to this matrix.
   */
  setFromMatrix4(m) {
    let me = m.elements;
    return this.set(
      me[0],
      me[4],
      me[8],
      me[1],
      me[5],
      me[9],
      me[2],
      me[6],
      me[10]
    ), this;
  }
  /**
   * Post-multiplies this matrix by the given 3x3 matrix.
   *
   * @param {Matrix3} m - The matrix to multiply with.
   * @return {Matrix3} A reference to this matrix.
   */
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  /**
   * Pre-multiplies this matrix by the given 3x3 matrix.
   *
   * @param {Matrix3} m - The matrix to multiply with.
   * @return {Matrix3} A reference to this matrix.
   */
  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }
  /**
   * Multiples the given 3x3 matrices and stores the result
   * in this matrix.
   *
   * @param {Matrix3} a - The first matrix.
   * @param {Matrix3} b - The second matrix.
   * @return {Matrix3} A reference to this matrix.
   */
  multiplyMatrices(a, b) {
    let ae = a.elements, be = b.elements, te = this.elements, a11 = ae[0], a12 = ae[3], a13 = ae[6], a21 = ae[1], a22 = ae[4], a23 = ae[7], a31 = ae[2], a32 = ae[5], a33 = ae[8], b11 = be[0], b12 = be[3], b13 = be[6], b21 = be[1], b22 = be[4], b23 = be[7], b31 = be[2], b32 = be[5], b33 = be[8];
    return te[0] = a11 * b11 + a12 * b21 + a13 * b31, te[3] = a11 * b12 + a12 * b22 + a13 * b32, te[6] = a11 * b13 + a12 * b23 + a13 * b33, te[1] = a21 * b11 + a22 * b21 + a23 * b31, te[4] = a21 * b12 + a22 * b22 + a23 * b32, te[7] = a21 * b13 + a22 * b23 + a23 * b33, te[2] = a31 * b11 + a32 * b21 + a33 * b31, te[5] = a31 * b12 + a32 * b22 + a33 * b32, te[8] = a31 * b13 + a32 * b23 + a33 * b33, this;
  }
  /**
   * Multiplies every component of the matrix by the given scalar.
   *
   * @param {number} s - The scalar.
   * @return {Matrix3} A reference to this matrix.
   */
  multiplyScalar(s) {
    let te = this.elements;
    return te[0] *= s, te[3] *= s, te[6] *= s, te[1] *= s, te[4] *= s, te[7] *= s, te[2] *= s, te[5] *= s, te[8] *= s, this;
  }
  /**
   * Computes and returns the determinant of this matrix.
   *
   * @return {number} The determinant.
   */
  determinant() {
    let te = this.elements, a = te[0], b = te[1], c = te[2], d = te[3], e = te[4], f = te[5], g = te[6], h = te[7], i = te[8];
    return a * e * i - a * f * h - b * d * i + b * f * g + c * d * h - c * e * g;
  }
  /**
   * Inverts this matrix, using the [analytic method]{@link https://en.wikipedia.org/wiki/Invertible_matrix#Analytic_solution}.
   * You can not invert with a determinant of zero. If you attempt this, the method produces
   * a zero matrix instead.
   *
   * @return {Matrix3} A reference to this matrix.
   */
  invert() {
    let te = this.elements, n11 = te[0], n21 = te[1], n31 = te[2], n12 = te[3], n22 = te[4], n32 = te[5], n13 = te[6], n23 = te[7], n33 = te[8], t11 = n33 * n22 - n32 * n23, t12 = n32 * n13 - n33 * n12, t13 = n23 * n12 - n22 * n13, det = n11 * t11 + n21 * t12 + n31 * t13;
    if (det === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0);
    let detInv = 1 / det;
    return te[0] = t11 * detInv, te[1] = (n31 * n23 - n33 * n21) * detInv, te[2] = (n32 * n21 - n31 * n22) * detInv, te[3] = t12 * detInv, te[4] = (n33 * n11 - n31 * n13) * detInv, te[5] = (n31 * n12 - n32 * n11) * detInv, te[6] = t13 * detInv, te[7] = (n21 * n13 - n23 * n11) * detInv, te[8] = (n22 * n11 - n21 * n12) * detInv, this;
  }
  /**
   * Transposes this matrix in place.
   *
   * @return {Matrix3} A reference to this matrix.
   */
  transpose() {
    let tmp4, m = this.elements;
    return tmp4 = m[1], m[1] = m[3], m[3] = tmp4, tmp4 = m[2], m[2] = m[6], m[6] = tmp4, tmp4 = m[5], m[5] = m[7], m[7] = tmp4, this;
  }
  /**
   * Computes the normal matrix which is the inverse transpose of the upper
   * left 3x3 portion of the given 4x4 matrix.
   *
   * @param {Matrix4} matrix4 - The 4x4 matrix.
   * @return {Matrix3} A reference to this matrix.
   */
  getNormalMatrix(matrix4) {
    return this.setFromMatrix4(matrix4).invert().transpose();
  }
  /**
   * Transposes this matrix into the supplied array, and returns itself unchanged.
   *
   * @param {Array<number>} r - An array to store the transposed matrix elements.
   * @return {Matrix3} A reference to this matrix.
   */
  transposeIntoArray(r) {
    let m = this.elements;
    return r[0] = m[0], r[1] = m[3], r[2] = m[6], r[3] = m[1], r[4] = m[4], r[5] = m[7], r[6] = m[2], r[7] = m[5], r[8] = m[8], this;
  }
  /**
   * Sets the UV transform matrix from offset, repeat, rotation, and center.
   *
   * @param {number} tx - Offset x.
   * @param {number} ty - Offset y.
   * @param {number} sx - Repeat x.
   * @param {number} sy - Repeat y.
   * @param {number} rotation - Rotation, in radians. Positive values rotate counterclockwise.
   * @param {number} cx - Center x of rotation.
   * @param {number} cy - Center y of rotation
   * @return {Matrix3} A reference to this matrix.
   */
  setUvTransform(tx, ty, sx, sy, rotation, cx, cy) {
    let c = Math.cos(rotation), s = Math.sin(rotation);
    return this.set(
      sx * c,
      sx * s,
      -sx * (c * cx + s * cy) + cx + tx,
      -sy * s,
      sy * c,
      -sy * (-s * cx + c * cy) + cy + ty,
      0,
      0,
      1
    ), this;
  }
  /**
   * Scales this matrix with the given scalar values.
   *
   * @param {number} sx - The amount to scale in the X axis.
   * @param {number} sy - The amount to scale in the Y axis.
   * @return {Matrix3} A reference to this matrix.
   */
  scale(sx, sy) {
    return this.premultiply(_m3.makeScale(sx, sy)), this;
  }
  /**
   * Rotates this matrix by the given angle.
   *
   * @param {number} theta - The rotation in radians.
   * @return {Matrix3} A reference to this matrix.
   */
  rotate(theta) {
    return this.premultiply(_m3.makeRotation(-theta)), this;
  }
  /**
   * Translates this matrix by the given scalar values.
   *
   * @param {number} tx - The amount to translate in the X axis.
   * @param {number} ty - The amount to translate in the Y axis.
   * @return {Matrix3} A reference to this matrix.
   */
  translate(tx, ty) {
    return this.premultiply(_m3.makeTranslation(tx, ty)), this;
  }
  // for 2D Transforms
  /**
   * Sets this matrix as a 2D translation transform.
   *
   * @param {number|Vector2} x - The amount to translate in the X axis or alternatively a translation vector.
   * @param {number} y - The amount to translate in the Y axis.
   * @return {Matrix3} A reference to this matrix.
   */
  makeTranslation(x, y) {
    return x.isVector2 ? this.set(
      1,
      0,
      x.x,
      0,
      1,
      x.y,
      0,
      0,
      1
    ) : this.set(
      1,
      0,
      x,
      0,
      1,
      y,
      0,
      0,
      1
    ), this;
  }
  /**
   * Sets this matrix as a 2D rotational transformation.
   *
   * @param {number} theta - The rotation in radians.
   * @return {Matrix3} A reference to this matrix.
   */
  makeRotation(theta) {
    let c = Math.cos(theta), s = Math.sin(theta);
    return this.set(
      c,
      -s,
      0,
      s,
      c,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Sets this matrix as a 2D scale transform.
   *
   * @param {number} x - The amount to scale in the X axis.
   * @param {number} y - The amount to scale in the Y axis.
   * @return {Matrix3} A reference to this matrix.
   */
  makeScale(x, y) {
    return this.set(
      x,
      0,
      0,
      0,
      y,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Returns `true` if this matrix is equal with the given one.
   *
   * @param {Matrix3} matrix - The matrix to test for equality.
   * @return {boolean} Whether this matrix is equal with the given one.
   */
  equals(matrix) {
    let te = this.elements, me = matrix.elements;
    for (let i = 0; i < 9; i++)
      if (te[i] !== me[i]) return !1;
    return !0;
  }
  /**
   * Sets the elements of the matrix from the given array.
   *
   * @param {Array<number>} array - The matrix elements in column-major order.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Matrix3} A reference to this matrix.
   */
  fromArray(array, offset = 0) {
    for (let i = 0; i < 9; i++)
      this.elements[i] = array[i + offset];
    return this;
  }
  /**
   * Writes the elements of this matrix to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param {Array<number>} [array=[]] - The target array holding the matrix elements in column-major order.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Array<number>} The matrix elements in column-major order.
   */
  toArray(array = [], offset = 0) {
    let te = this.elements;
    return array[offset] = te[0], array[offset + 1] = te[1], array[offset + 2] = te[2], array[offset + 3] = te[3], array[offset + 4] = te[4], array[offset + 5] = te[5], array[offset + 6] = te[6], array[offset + 7] = te[7], array[offset + 8] = te[8], array;
  }
  /**
   * Returns a matrix with copied values from this instance.
   *
   * @return {Matrix3} A clone of this instance.
   */
  clone() {
    return new this.constructor().fromArray(this.elements);
  }
}, _m3 = /* @__PURE__ */ new Matrix3();
function createElementNS(name) {
  return document.createElementNS("http://www.w3.org/1999/xhtml", name);
}
var _cache = {};
function warnOnce(message) {
  message in _cache || (_cache[message] = !0, console.warn(message));
}
var LINEAR_REC709_TO_XYZ = /* @__PURE__ */ new Matrix3().set(
  0.4123908,
  0.3575843,
  0.1804808,
  0.212639,
  0.7151687,
  0.0721923,
  0.0193308,
  0.1191948,
  0.9505322
), XYZ_TO_LINEAR_REC709 = /* @__PURE__ */ new Matrix3().set(
  3.2409699,
  -1.5373832,
  -0.4986108,
  -0.9692436,
  1.8759675,
  0.0415551,
  0.0556301,
  -0.203977,
  1.0569715
);
function createColorManagement() {
  let ColorManagement2 = {
    enabled: !0,
    workingColorSpace: LinearSRGBColorSpace,
    /**
     * Implementations of supported color spaces.
     *
     * Required:
     *	- primaries: chromaticity coordinates [ rx ry gx gy bx by ]
     *	- whitePoint: reference white [ x y ]
     *	- transfer: transfer function (pre-defined)
     *	- toXYZ: Matrix3 RGB to XYZ transform
     *	- fromXYZ: Matrix3 XYZ to RGB transform
     *	- luminanceCoefficients: RGB luminance coefficients
     *
     * Optional:
     *  - outputColorSpaceConfig: { drawingBufferColorSpace: ColorSpace, toneMappingMode: 'extended' | 'standard' }
     *  - workingColorSpaceConfig: { unpackColorSpace: ColorSpace }
     *
     * Reference:
     * - https://www.russellcottrell.com/photo/matrixCalculator.htm
     */
    spaces: {},
    convert: function(color, sourceColorSpace, targetColorSpace) {
      return this.enabled === !1 || sourceColorSpace === targetColorSpace || !sourceColorSpace || !targetColorSpace || (this.spaces[sourceColorSpace].transfer === SRGBTransfer && (color.r = SRGBToLinear(color.r), color.g = SRGBToLinear(color.g), color.b = SRGBToLinear(color.b)), this.spaces[sourceColorSpace].primaries !== this.spaces[targetColorSpace].primaries && (color.applyMatrix3(this.spaces[sourceColorSpace].toXYZ), color.applyMatrix3(this.spaces[targetColorSpace].fromXYZ)), this.spaces[targetColorSpace].transfer === SRGBTransfer && (color.r = LinearToSRGB(color.r), color.g = LinearToSRGB(color.g), color.b = LinearToSRGB(color.b))), color;
    },
    workingToColorSpace: function(color, targetColorSpace) {
      return this.convert(color, this.workingColorSpace, targetColorSpace);
    },
    colorSpaceToWorking: function(color, sourceColorSpace) {
      return this.convert(color, sourceColorSpace, this.workingColorSpace);
    },
    getPrimaries: function(colorSpace) {
      return this.spaces[colorSpace].primaries;
    },
    getTransfer: function(colorSpace) {
      return colorSpace === NoColorSpace ? LinearTransfer : this.spaces[colorSpace].transfer;
    },
    getToneMappingMode: function(colorSpace) {
      return this.spaces[colorSpace].outputColorSpaceConfig.toneMappingMode || "standard";
    },
    getLuminanceCoefficients: function(target, colorSpace = this.workingColorSpace) {
      return target.fromArray(this.spaces[colorSpace].luminanceCoefficients);
    },
    define: function(colorSpaces) {
      Object.assign(this.spaces, colorSpaces);
    },
    // Internal APIs
    _getMatrix: function(targetMatrix, sourceColorSpace, targetColorSpace) {
      return targetMatrix.copy(this.spaces[sourceColorSpace].toXYZ).multiply(this.spaces[targetColorSpace].fromXYZ);
    },
    _getDrawingBufferColorSpace: function(colorSpace) {
      return this.spaces[colorSpace].outputColorSpaceConfig.drawingBufferColorSpace;
    },
    _getUnpackColorSpace: function(colorSpace = this.workingColorSpace) {
      return this.spaces[colorSpace].workingColorSpaceConfig.unpackColorSpace;
    },
    // Deprecated
    fromWorkingColorSpace: function(color, targetColorSpace) {
      return warnOnce("THREE.ColorManagement: .fromWorkingColorSpace() has been renamed to .workingToColorSpace()."), ColorManagement2.workingToColorSpace(color, targetColorSpace);
    },
    toWorkingColorSpace: function(color, sourceColorSpace) {
      return warnOnce("THREE.ColorManagement: .toWorkingColorSpace() has been renamed to .colorSpaceToWorking()."), ColorManagement2.colorSpaceToWorking(color, sourceColorSpace);
    }
  }, REC709_PRIMARIES = [0.64, 0.33, 0.3, 0.6, 0.15, 0.06], REC709_LUMINANCE_COEFFICIENTS = [0.2126, 0.7152, 0.0722], D65 = [0.3127, 0.329];
  return ColorManagement2.define({
    [LinearSRGBColorSpace]: {
      primaries: REC709_PRIMARIES,
      whitePoint: D65,
      transfer: LinearTransfer,
      toXYZ: LINEAR_REC709_TO_XYZ,
      fromXYZ: XYZ_TO_LINEAR_REC709,
      luminanceCoefficients: REC709_LUMINANCE_COEFFICIENTS,
      workingColorSpaceConfig: { unpackColorSpace: SRGBColorSpace },
      outputColorSpaceConfig: { drawingBufferColorSpace: SRGBColorSpace }
    },
    [SRGBColorSpace]: {
      primaries: REC709_PRIMARIES,
      whitePoint: D65,
      transfer: SRGBTransfer,
      toXYZ: LINEAR_REC709_TO_XYZ,
      fromXYZ: XYZ_TO_LINEAR_REC709,
      luminanceCoefficients: REC709_LUMINANCE_COEFFICIENTS,
      outputColorSpaceConfig: { drawingBufferColorSpace: SRGBColorSpace }
    }
  }), ColorManagement2;
}
var ColorManagement = /* @__PURE__ */ createColorManagement();
function SRGBToLinear(c) {
  return c < 0.04045 ? c * 0.0773993808 : Math.pow(c * 0.9478672986 + 0.0521327014, 2.4);
}
function LinearToSRGB(c) {
  return c < 31308e-7 ? c * 12.92 : 1.055 * Math.pow(c, 0.41666) - 0.055;
}
var _canvas, ImageUtils = class {
  /**
   * Returns a data URI containing a representation of the given image.
   *
   * @param {(HTMLImageElement|HTMLCanvasElement)} image - The image object.
   * @param {string} [type='image/png'] - Indicates the image format.
   * @return {string} The data URI.
   */
  static getDataURL(image, type = "image/png") {
    if (/^data:/i.test(image.src) || typeof HTMLCanvasElement > "u")
      return image.src;
    let canvas;
    if (image instanceof HTMLCanvasElement)
      canvas = image;
    else {
      _canvas === void 0 && (_canvas = createElementNS("canvas")), _canvas.width = image.width, _canvas.height = image.height;
      let context = _canvas.getContext("2d");
      image instanceof ImageData ? context.putImageData(image, 0, 0) : context.drawImage(image, 0, 0, image.width, image.height), canvas = _canvas;
    }
    return canvas.toDataURL(type);
  }
  /**
   * Converts the given sRGB image data to linear color space.
   *
   * @param {(HTMLImageElement|HTMLCanvasElement|ImageBitmap|Object)} image - The image object.
   * @return {HTMLCanvasElement|Object} The converted image.
   */
  static sRGBToLinear(image) {
    if (typeof HTMLImageElement < "u" && image instanceof HTMLImageElement || typeof HTMLCanvasElement < "u" && image instanceof HTMLCanvasElement || typeof ImageBitmap < "u" && image instanceof ImageBitmap) {
      let canvas = createElementNS("canvas");
      canvas.width = image.width, canvas.height = image.height;
      let context = canvas.getContext("2d");
      context.drawImage(image, 0, 0, image.width, image.height);
      let imageData = context.getImageData(0, 0, image.width, image.height), data = imageData.data;
      for (let i = 0; i < data.length; i++)
        data[i] = SRGBToLinear(data[i] / 255) * 255;
      return context.putImageData(imageData, 0, 0), canvas;
    } else if (image.data) {
      let data = image.data.slice(0);
      for (let i = 0; i < data.length; i++)
        data instanceof Uint8Array || data instanceof Uint8ClampedArray ? data[i] = Math.floor(SRGBToLinear(data[i] / 255) * 255) : data[i] = SRGBToLinear(data[i]);
      return {
        data,
        width: image.width,
        height: image.height
      };
    } else
      return console.warn("THREE.ImageUtils.sRGBToLinear(): Unsupported image type. No color space conversion applied."), image;
  }
}, _sourceId = 0, Source = class {
  /**
   * Constructs a new video texture.
   *
   * @param {any} [data=null] - The data definition of a texture.
   */
  constructor(data = null) {
    this.isSource = !0, Object.defineProperty(this, "id", { value: _sourceId++ }), this.uuid = generateUUID(), this.data = data, this.dataReady = !0, this.version = 0;
  }
  /**
   * Returns the dimensions of the source into the given target vector.
   *
   * @param {(Vector2|Vector3)} target - The target object the result is written into.
   * @return {(Vector2|Vector3)} The dimensions of the source.
   */
  getSize(target) {
    let data = this.data;
    return typeof HTMLVideoElement < "u" && data instanceof HTMLVideoElement ? target.set(data.videoWidth, data.videoHeight, 0) : data instanceof VideoFrame ? target.set(data.displayHeight, data.displayWidth, 0) : data !== null ? target.set(data.width, data.height, data.depth || 0) : target.set(0, 0, 0), target;
  }
  /**
   * When the property is set to `true`, the engine allocates the memory
   * for the texture (if necessary) and triggers the actual texture upload
   * to the GPU next time the source is used.
   *
   * @type {boolean}
   * @default false
   * @param {boolean} value
   */
  set needsUpdate(value) {
    value === !0 && this.version++;
  }
  /**
   * Serializes the source into JSON.
   *
   * @param {?(Object|string)} meta - An optional value holding meta information about the serialization.
   * @return {Object} A JSON object representing the serialized source.
   * @see {@link ObjectLoader#parse}
   */
  toJSON(meta) {
    let isRootObject = meta === void 0 || typeof meta == "string";
    if (!isRootObject && meta.images[this.uuid] !== void 0)
      return meta.images[this.uuid];
    let output = {
      uuid: this.uuid,
      url: ""
    }, data = this.data;
    if (data !== null) {
      let url;
      if (Array.isArray(data)) {
        url = [];
        for (let i = 0, l = data.length; i < l; i++)
          data[i].isDataTexture ? url.push(serializeImage(data[i].image)) : url.push(serializeImage(data[i]));
      } else
        url = serializeImage(data);
      output.url = url;
    }
    return isRootObject || (meta.images[this.uuid] = output), output;
  }
};
function serializeImage(image) {
  return typeof HTMLImageElement < "u" && image instanceof HTMLImageElement || typeof HTMLCanvasElement < "u" && image instanceof HTMLCanvasElement || typeof ImageBitmap < "u" && image instanceof ImageBitmap ? ImageUtils.getDataURL(image) : image.data ? {
    data: Array.from(image.data),
    width: image.width,
    height: image.height,
    type: image.data.constructor.name
  } : (console.warn("THREE.Texture: Unable to serialize Texture."), {});
}
var _textureId = 0, _tempVec3 = /* @__PURE__ */ new Vector3(), Texture = class _Texture extends EventDispatcher {
  /**
   * Constructs a new texture.
   *
   * @param {?Object} [image=Texture.DEFAULT_IMAGE] - The image holding the texture data.
   * @param {number} [mapping=Texture.DEFAULT_MAPPING] - The texture mapping.
   * @param {number} [wrapS=ClampToEdgeWrapping] - The wrapS value.
   * @param {number} [wrapT=ClampToEdgeWrapping] - The wrapT value.
   * @param {number} [magFilter=LinearFilter] - The mag filter value.
   * @param {number} [minFilter=LinearMipmapLinearFilter] - The min filter value.
   * @param {number} [format=RGBAFormat] - The texture format.
   * @param {number} [type=UnsignedByteType] - The texture type.
   * @param {number} [anisotropy=Texture.DEFAULT_ANISOTROPY] - The anisotropy value.
   * @param {string} [colorSpace=NoColorSpace] - The color space.
   */
  constructor(image = _Texture.DEFAULT_IMAGE, mapping = _Texture.DEFAULT_MAPPING, wrapS = ClampToEdgeWrapping, wrapT = ClampToEdgeWrapping, magFilter = LinearFilter, minFilter = LinearMipmapLinearFilter, format = RGBAFormat, type = UnsignedByteType, anisotropy = _Texture.DEFAULT_ANISOTROPY, colorSpace = NoColorSpace) {
    super(), this.isTexture = !0, Object.defineProperty(this, "id", { value: _textureId++ }), this.uuid = generateUUID(), this.name = "", this.source = new Source(image), this.mipmaps = [], this.mapping = mapping, this.channel = 0, this.wrapS = wrapS, this.wrapT = wrapT, this.magFilter = magFilter, this.minFilter = minFilter, this.anisotropy = anisotropy, this.format = format, this.internalFormat = null, this.type = type, this.offset = new Vector2(0, 0), this.repeat = new Vector2(1, 1), this.center = new Vector2(0, 0), this.rotation = 0, this.matrixAutoUpdate = !0, this.matrix = new Matrix3(), this.generateMipmaps = !0, this.premultiplyAlpha = !1, this.flipY = !0, this.unpackAlignment = 4, this.colorSpace = colorSpace, this.userData = {}, this.updateRanges = [], this.version = 0, this.onUpdate = null, this.renderTarget = null, this.isRenderTargetTexture = !1, this.isArrayTexture = !!(image && image.depth && image.depth > 1), this.pmremVersion = 0;
  }
  /**
   * The width of the texture in pixels.
   */
  get width() {
    return this.source.getSize(_tempVec3).x;
  }
  /**
   * The height of the texture in pixels.
   */
  get height() {
    return this.source.getSize(_tempVec3).y;
  }
  /**
   * The depth of the texture in pixels.
   */
  get depth() {
    return this.source.getSize(_tempVec3).z;
  }
  /**
   * The image object holding the texture data.
   *
   * @type {?Object}
   */
  get image() {
    return this.source.data;
  }
  set image(value = null) {
    this.source.data = value;
  }
  /**
   * Updates the texture transformation matrix from the from the properties {@link Texture#offset},
   * {@link Texture#repeat}, {@link Texture#rotation}, and {@link Texture#center}.
   */
  updateMatrix() {
    this.matrix.setUvTransform(this.offset.x, this.offset.y, this.repeat.x, this.repeat.y, this.rotation, this.center.x, this.center.y);
  }
  /**
   * Adds a range of data in the data texture to be updated on the GPU.
   *
   * @param {number} start - Position at which to start update.
   * @param {number} count - The number of components to update.
   */
  addUpdateRange(start, count) {
    this.updateRanges.push({ start, count });
  }
  /**
   * Clears the update ranges.
   */
  clearUpdateRanges() {
    this.updateRanges.length = 0;
  }
  /**
   * Returns a new texture with copied values from this instance.
   *
   * @return {Texture} A clone of this instance.
   */
  clone() {
    return new this.constructor().copy(this);
  }
  /**
   * Copies the values of the given texture to this instance.
   *
   * @param {Texture} source - The texture to copy.
   * @return {Texture} A reference to this instance.
   */
  copy(source) {
    return this.name = source.name, this.source = source.source, this.mipmaps = source.mipmaps.slice(0), this.mapping = source.mapping, this.channel = source.channel, this.wrapS = source.wrapS, this.wrapT = source.wrapT, this.magFilter = source.magFilter, this.minFilter = source.minFilter, this.anisotropy = source.anisotropy, this.format = source.format, this.internalFormat = source.internalFormat, this.type = source.type, this.offset.copy(source.offset), this.repeat.copy(source.repeat), this.center.copy(source.center), this.rotation = source.rotation, this.matrixAutoUpdate = source.matrixAutoUpdate, this.matrix.copy(source.matrix), this.generateMipmaps = source.generateMipmaps, this.premultiplyAlpha = source.premultiplyAlpha, this.flipY = source.flipY, this.unpackAlignment = source.unpackAlignment, this.colorSpace = source.colorSpace, this.renderTarget = source.renderTarget, this.isRenderTargetTexture = source.isRenderTargetTexture, this.isArrayTexture = source.isArrayTexture, this.userData = JSON.parse(JSON.stringify(source.userData)), this.needsUpdate = !0, this;
  }
  /**
   * Sets this texture's properties based on `values`.
   * @param {Object} values - A container with texture parameters.
   */
  setValues(values) {
    for (let key in values) {
      let newValue = values[key];
      if (newValue === void 0) {
        console.warn(`THREE.Texture.setValues(): parameter '${key}' has value of undefined.`);
        continue;
      }
      let currentValue = this[key];
      if (currentValue === void 0) {
        console.warn(`THREE.Texture.setValues(): property '${key}' does not exist.`);
        continue;
      }
      currentValue && newValue && currentValue.isVector2 && newValue.isVector2 || currentValue && newValue && currentValue.isVector3 && newValue.isVector3 || currentValue && newValue && currentValue.isMatrix3 && newValue.isMatrix3 ? currentValue.copy(newValue) : this[key] = newValue;
    }
  }
  /**
   * Serializes the texture into JSON.
   *
   * @param {?(Object|string)} meta - An optional value holding meta information about the serialization.
   * @return {Object} A JSON object representing the serialized texture.
   * @see {@link ObjectLoader#parse}
   */
  toJSON(meta) {
    let isRootObject = meta === void 0 || typeof meta == "string";
    if (!isRootObject && meta.textures[this.uuid] !== void 0)
      return meta.textures[this.uuid];
    let output = {
      metadata: {
        version: 4.7,
        type: "Texture",
        generator: "Texture.toJSON"
      },
      uuid: this.uuid,
      name: this.name,
      image: this.source.toJSON(meta).uuid,
      mapping: this.mapping,
      channel: this.channel,
      repeat: [this.repeat.x, this.repeat.y],
      offset: [this.offset.x, this.offset.y],
      center: [this.center.x, this.center.y],
      rotation: this.rotation,
      wrap: [this.wrapS, this.wrapT],
      format: this.format,
      internalFormat: this.internalFormat,
      type: this.type,
      colorSpace: this.colorSpace,
      minFilter: this.minFilter,
      magFilter: this.magFilter,
      anisotropy: this.anisotropy,
      flipY: this.flipY,
      generateMipmaps: this.generateMipmaps,
      premultiplyAlpha: this.premultiplyAlpha,
      unpackAlignment: this.unpackAlignment
    };
    return Object.keys(this.userData).length > 0 && (output.userData = this.userData), isRootObject || (meta.textures[this.uuid] = output), output;
  }
  /**
   * Frees the GPU-related resources allocated by this instance. Call this
   * method whenever this instance is no longer used in your app.
   *
   * @fires Texture#dispose
   */
  dispose() {
    this.dispatchEvent({ type: "dispose" });
  }
  /**
   * Transforms the given uv vector with the textures uv transformation matrix.
   *
   * @param {Vector2} uv - The uv vector.
   * @return {Vector2} The transformed uv vector.
   */
  transformUv(uv) {
    if (this.mapping !== UVMapping) return uv;
    if (uv.applyMatrix3(this.matrix), uv.x < 0 || uv.x > 1)
      switch (this.wrapS) {
        case RepeatWrapping:
          uv.x = uv.x - Math.floor(uv.x);
          break;
        case ClampToEdgeWrapping:
          uv.x = uv.x < 0 ? 0 : 1;
          break;
        case MirroredRepeatWrapping:
          Math.abs(Math.floor(uv.x) % 2) === 1 ? uv.x = Math.ceil(uv.x) - uv.x : uv.x = uv.x - Math.floor(uv.x);
          break;
      }
    if (uv.y < 0 || uv.y > 1)
      switch (this.wrapT) {
        case RepeatWrapping:
          uv.y = uv.y - Math.floor(uv.y);
          break;
        case ClampToEdgeWrapping:
          uv.y = uv.y < 0 ? 0 : 1;
          break;
        case MirroredRepeatWrapping:
          Math.abs(Math.floor(uv.y) % 2) === 1 ? uv.y = Math.ceil(uv.y) - uv.y : uv.y = uv.y - Math.floor(uv.y);
          break;
      }
    return this.flipY && (uv.y = 1 - uv.y), uv;
  }
  /**
   * Setting this property to `true` indicates the engine the texture
   * must be updated in the next render. This triggers a texture upload
   * to the GPU and ensures correct texture parameter configuration.
   *
   * @type {boolean}
   * @default false
   * @param {boolean} value
   */
  set needsUpdate(value) {
    value === !0 && (this.version++, this.source.needsUpdate = !0);
  }
  /**
   * Setting this property to `true` indicates the engine the PMREM
   * must be regenerated.
   *
   * @type {boolean}
   * @default false
   * @param {boolean} value
   */
  set needsPMREMUpdate(value) {
    value === !0 && this.pmremVersion++;
  }
};
Texture.DEFAULT_IMAGE = null;
Texture.DEFAULT_MAPPING = UVMapping;
Texture.DEFAULT_ANISOTROPY = 1;
var Matrix4 = class _Matrix4 {
  /**
   * Constructs a new 4x4 matrix. The arguments are supposed to be
   * in row-major order. If no arguments are provided, the constructor
   * initializes the matrix as an identity matrix.
   *
   * @param {number} [n11] - 1-1 matrix element.
   * @param {number} [n12] - 1-2 matrix element.
   * @param {number} [n13] - 1-3 matrix element.
   * @param {number} [n14] - 1-4 matrix element.
   * @param {number} [n21] - 2-1 matrix element.
   * @param {number} [n22] - 2-2 matrix element.
   * @param {number} [n23] - 2-3 matrix element.
   * @param {number} [n24] - 2-4 matrix element.
   * @param {number} [n31] - 3-1 matrix element.
   * @param {number} [n32] - 3-2 matrix element.
   * @param {number} [n33] - 3-3 matrix element.
   * @param {number} [n34] - 3-4 matrix element.
   * @param {number} [n41] - 4-1 matrix element.
   * @param {number} [n42] - 4-2 matrix element.
   * @param {number} [n43] - 4-3 matrix element.
   * @param {number} [n44] - 4-4 matrix element.
   */
  constructor(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    _Matrix4.prototype.isMatrix4 = !0, this.elements = [
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ], n11 !== void 0 && this.set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44);
  }
  /**
   * Sets the elements of the matrix.The arguments are supposed to be
   * in row-major order.
   *
   * @param {number} [n11] - 1-1 matrix element.
   * @param {number} [n12] - 1-2 matrix element.
   * @param {number} [n13] - 1-3 matrix element.
   * @param {number} [n14] - 1-4 matrix element.
   * @param {number} [n21] - 2-1 matrix element.
   * @param {number} [n22] - 2-2 matrix element.
   * @param {number} [n23] - 2-3 matrix element.
   * @param {number} [n24] - 2-4 matrix element.
   * @param {number} [n31] - 3-1 matrix element.
   * @param {number} [n32] - 3-2 matrix element.
   * @param {number} [n33] - 3-3 matrix element.
   * @param {number} [n34] - 3-4 matrix element.
   * @param {number} [n41] - 4-1 matrix element.
   * @param {number} [n42] - 4-2 matrix element.
   * @param {number} [n43] - 4-3 matrix element.
   * @param {number} [n44] - 4-4 matrix element.
   * @return {Matrix4} A reference to this matrix.
   */
  set(n11, n12, n13, n14, n21, n22, n23, n24, n31, n32, n33, n34, n41, n42, n43, n44) {
    let te = this.elements;
    return te[0] = n11, te[4] = n12, te[8] = n13, te[12] = n14, te[1] = n21, te[5] = n22, te[9] = n23, te[13] = n24, te[2] = n31, te[6] = n32, te[10] = n33, te[14] = n34, te[3] = n41, te[7] = n42, te[11] = n43, te[15] = n44, this;
  }
  /**
   * Sets this matrix to the 4x4 identity matrix.
   *
   * @return {Matrix4} A reference to this matrix.
   */
  identity() {
    return this.set(
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Returns a matrix with copied values from this instance.
   *
   * @return {Matrix4} A clone of this instance.
   */
  clone() {
    return new _Matrix4().fromArray(this.elements);
  }
  /**
   * Copies the values of the given matrix to this instance.
   *
   * @param {Matrix4} m - The matrix to copy.
   * @return {Matrix4} A reference to this matrix.
   */
  copy(m) {
    let te = this.elements, me = m.elements;
    return te[0] = me[0], te[1] = me[1], te[2] = me[2], te[3] = me[3], te[4] = me[4], te[5] = me[5], te[6] = me[6], te[7] = me[7], te[8] = me[8], te[9] = me[9], te[10] = me[10], te[11] = me[11], te[12] = me[12], te[13] = me[13], te[14] = me[14], te[15] = me[15], this;
  }
  /**
   * Copies the translation component of the given matrix
   * into this matrix's translation component.
   *
   * @param {Matrix4} m - The matrix to copy the translation component.
   * @return {Matrix4} A reference to this matrix.
   */
  copyPosition(m) {
    let te = this.elements, me = m.elements;
    return te[12] = me[12], te[13] = me[13], te[14] = me[14], this;
  }
  /**
   * Set the upper 3x3 elements of this matrix to the values of given 3x3 matrix.
   *
   * @param {Matrix3} m - The 3x3 matrix.
   * @return {Matrix4} A reference to this matrix.
   */
  setFromMatrix3(m) {
    let me = m.elements;
    return this.set(
      me[0],
      me[3],
      me[6],
      0,
      me[1],
      me[4],
      me[7],
      0,
      me[2],
      me[5],
      me[8],
      0,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Extracts the basis of this matrix into the three axis vectors provided.
   *
   * @param {Vector3} xAxis - The basis's x axis.
   * @param {Vector3} yAxis - The basis's y axis.
   * @param {Vector3} zAxis - The basis's z axis.
   * @return {Matrix4} A reference to this matrix.
   */
  extractBasis(xAxis, yAxis, zAxis) {
    return xAxis.setFromMatrixColumn(this, 0), yAxis.setFromMatrixColumn(this, 1), zAxis.setFromMatrixColumn(this, 2), this;
  }
  /**
   * Sets the given basis vectors to this matrix.
   *
   * @param {Vector3} xAxis - The basis's x axis.
   * @param {Vector3} yAxis - The basis's y axis.
   * @param {Vector3} zAxis - The basis's z axis.
   * @return {Matrix4} A reference to this matrix.
   */
  makeBasis(xAxis, yAxis, zAxis) {
    return this.set(
      xAxis.x,
      yAxis.x,
      zAxis.x,
      0,
      xAxis.y,
      yAxis.y,
      zAxis.y,
      0,
      xAxis.z,
      yAxis.z,
      zAxis.z,
      0,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Extracts the rotation component of the given matrix
   * into this matrix's rotation component.
   *
   * Note: This method does not support reflection matrices.
   *
   * @param {Matrix4} m - The matrix.
   * @return {Matrix4} A reference to this matrix.
   */
  extractRotation(m) {
    let te = this.elements, me = m.elements, scaleX = 1 / _v1$5.setFromMatrixColumn(m, 0).length(), scaleY = 1 / _v1$5.setFromMatrixColumn(m, 1).length(), scaleZ = 1 / _v1$5.setFromMatrixColumn(m, 2).length();
    return te[0] = me[0] * scaleX, te[1] = me[1] * scaleX, te[2] = me[2] * scaleX, te[3] = 0, te[4] = me[4] * scaleY, te[5] = me[5] * scaleY, te[6] = me[6] * scaleY, te[7] = 0, te[8] = me[8] * scaleZ, te[9] = me[9] * scaleZ, te[10] = me[10] * scaleZ, te[11] = 0, te[12] = 0, te[13] = 0, te[14] = 0, te[15] = 1, this;
  }
  /**
   * Sets the rotation component (the upper left 3x3 matrix) of this matrix to
   * the rotation specified by the given Euler angles. The rest of
   * the matrix is set to the identity. Depending on the {@link Euler#order},
   * there are six possible outcomes. See [this page]{@link https://en.wikipedia.org/wiki/Euler_angles#Rotation_matrix}
   * for a complete list.
   *
   * @param {Euler} euler - The Euler angles.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationFromEuler(euler) {
    let te = this.elements, x = euler.x, y = euler.y, z = euler.z, a = Math.cos(x), b = Math.sin(x), c = Math.cos(y), d = Math.sin(y), e = Math.cos(z), f = Math.sin(z);
    if (euler.order === "XYZ") {
      let ae = a * e, af = a * f, be = b * e, bf = b * f;
      te[0] = c * e, te[4] = -c * f, te[8] = d, te[1] = af + be * d, te[5] = ae - bf * d, te[9] = -b * c, te[2] = bf - ae * d, te[6] = be + af * d, te[10] = a * c;
    } else if (euler.order === "YXZ") {
      let ce = c * e, cf = c * f, de = d * e, df = d * f;
      te[0] = ce + df * b, te[4] = de * b - cf, te[8] = a * d, te[1] = a * f, te[5] = a * e, te[9] = -b, te[2] = cf * b - de, te[6] = df + ce * b, te[10] = a * c;
    } else if (euler.order === "ZXY") {
      let ce = c * e, cf = c * f, de = d * e, df = d * f;
      te[0] = ce - df * b, te[4] = -a * f, te[8] = de + cf * b, te[1] = cf + de * b, te[5] = a * e, te[9] = df - ce * b, te[2] = -a * d, te[6] = b, te[10] = a * c;
    } else if (euler.order === "ZYX") {
      let ae = a * e, af = a * f, be = b * e, bf = b * f;
      te[0] = c * e, te[4] = be * d - af, te[8] = ae * d + bf, te[1] = c * f, te[5] = bf * d + ae, te[9] = af * d - be, te[2] = -d, te[6] = b * c, te[10] = a * c;
    } else if (euler.order === "YZX") {
      let ac = a * c, ad = a * d, bc = b * c, bd = b * d;
      te[0] = c * e, te[4] = bd - ac * f, te[8] = bc * f + ad, te[1] = f, te[5] = a * e, te[9] = -b * e, te[2] = -d * e, te[6] = ad * f + bc, te[10] = ac - bd * f;
    } else if (euler.order === "XZY") {
      let ac = a * c, ad = a * d, bc = b * c, bd = b * d;
      te[0] = c * e, te[4] = -f, te[8] = d * e, te[1] = ac * f + bd, te[5] = a * e, te[9] = ad * f - bc, te[2] = bc * f - ad, te[6] = b * e, te[10] = bd * f + ac;
    }
    return te[3] = 0, te[7] = 0, te[11] = 0, te[12] = 0, te[13] = 0, te[14] = 0, te[15] = 1, this;
  }
  /**
   * Sets the rotation component of this matrix to the rotation specified by
   * the given Quaternion as outlined [here]{@link https://en.wikipedia.org/wiki/Rotation_matrix#Quaternion}
   * The rest of the matrix is set to the identity.
   *
   * @param {Quaternion} q - The Quaternion.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationFromQuaternion(q) {
    return this.compose(_zero, q, _one);
  }
  /**
   * Sets the rotation component of the transformation matrix, looking from `eye` towards
   * `target`, and oriented by the up-direction.
   *
   * @param {Vector3} eye - The eye vector.
   * @param {Vector3} target - The target vector.
   * @param {Vector3} up - The up vector.
   * @return {Matrix4} A reference to this matrix.
   */
  lookAt(eye, target, up) {
    let te = this.elements;
    return _z.subVectors(eye, target), _z.lengthSq() === 0 && (_z.z = 1), _z.normalize(), _x.crossVectors(up, _z), _x.lengthSq() === 0 && (Math.abs(up.z) === 1 ? _z.x += 1e-4 : _z.z += 1e-4, _z.normalize(), _x.crossVectors(up, _z)), _x.normalize(), _y.crossVectors(_z, _x), te[0] = _x.x, te[4] = _y.x, te[8] = _z.x, te[1] = _x.y, te[5] = _y.y, te[9] = _z.y, te[2] = _x.z, te[6] = _y.z, te[10] = _z.z, this;
  }
  /**
   * Post-multiplies this matrix by the given 4x4 matrix.
   *
   * @param {Matrix4} m - The matrix to multiply with.
   * @return {Matrix4} A reference to this matrix.
   */
  multiply(m) {
    return this.multiplyMatrices(this, m);
  }
  /**
   * Pre-multiplies this matrix by the given 4x4 matrix.
   *
   * @param {Matrix4} m - The matrix to multiply with.
   * @return {Matrix4} A reference to this matrix.
   */
  premultiply(m) {
    return this.multiplyMatrices(m, this);
  }
  /**
   * Multiples the given 4x4 matrices and stores the result
   * in this matrix.
   *
   * @param {Matrix4} a - The first matrix.
   * @param {Matrix4} b - The second matrix.
   * @return {Matrix4} A reference to this matrix.
   */
  multiplyMatrices(a, b) {
    let ae = a.elements, be = b.elements, te = this.elements, a11 = ae[0], a12 = ae[4], a13 = ae[8], a14 = ae[12], a21 = ae[1], a22 = ae[5], a23 = ae[9], a24 = ae[13], a31 = ae[2], a32 = ae[6], a33 = ae[10], a34 = ae[14], a41 = ae[3], a42 = ae[7], a43 = ae[11], a44 = ae[15], b11 = be[0], b12 = be[4], b13 = be[8], b14 = be[12], b21 = be[1], b22 = be[5], b23 = be[9], b24 = be[13], b31 = be[2], b32 = be[6], b33 = be[10], b34 = be[14], b41 = be[3], b42 = be[7], b43 = be[11], b44 = be[15];
    return te[0] = a11 * b11 + a12 * b21 + a13 * b31 + a14 * b41, te[4] = a11 * b12 + a12 * b22 + a13 * b32 + a14 * b42, te[8] = a11 * b13 + a12 * b23 + a13 * b33 + a14 * b43, te[12] = a11 * b14 + a12 * b24 + a13 * b34 + a14 * b44, te[1] = a21 * b11 + a22 * b21 + a23 * b31 + a24 * b41, te[5] = a21 * b12 + a22 * b22 + a23 * b32 + a24 * b42, te[9] = a21 * b13 + a22 * b23 + a23 * b33 + a24 * b43, te[13] = a21 * b14 + a22 * b24 + a23 * b34 + a24 * b44, te[2] = a31 * b11 + a32 * b21 + a33 * b31 + a34 * b41, te[6] = a31 * b12 + a32 * b22 + a33 * b32 + a34 * b42, te[10] = a31 * b13 + a32 * b23 + a33 * b33 + a34 * b43, te[14] = a31 * b14 + a32 * b24 + a33 * b34 + a34 * b44, te[3] = a41 * b11 + a42 * b21 + a43 * b31 + a44 * b41, te[7] = a41 * b12 + a42 * b22 + a43 * b32 + a44 * b42, te[11] = a41 * b13 + a42 * b23 + a43 * b33 + a44 * b43, te[15] = a41 * b14 + a42 * b24 + a43 * b34 + a44 * b44, this;
  }
  /**
   * Multiplies every component of the matrix by the given scalar.
   *
   * @param {number} s - The scalar.
   * @return {Matrix4} A reference to this matrix.
   */
  multiplyScalar(s) {
    let te = this.elements;
    return te[0] *= s, te[4] *= s, te[8] *= s, te[12] *= s, te[1] *= s, te[5] *= s, te[9] *= s, te[13] *= s, te[2] *= s, te[6] *= s, te[10] *= s, te[14] *= s, te[3] *= s, te[7] *= s, te[11] *= s, te[15] *= s, this;
  }
  /**
   * Computes and returns the determinant of this matrix.
   *
   * Based on the method outlined [here]{@link http://www.euclideanspace.com/maths/algebra/matrix/functions/inverse/fourD/index.html}.
   *
   * @return {number} The determinant.
   */
  determinant() {
    let te = this.elements, n11 = te[0], n12 = te[4], n13 = te[8], n14 = te[12], n21 = te[1], n22 = te[5], n23 = te[9], n24 = te[13], n31 = te[2], n32 = te[6], n33 = te[10], n34 = te[14], n41 = te[3], n42 = te[7], n43 = te[11], n44 = te[15];
    return n41 * (+n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34) + n42 * (+n11 * n23 * n34 - n11 * n24 * n33 + n14 * n21 * n33 - n13 * n21 * n34 + n13 * n24 * n31 - n14 * n23 * n31) + n43 * (+n11 * n24 * n32 - n11 * n22 * n34 - n14 * n21 * n32 + n12 * n21 * n34 + n14 * n22 * n31 - n12 * n24 * n31) + n44 * (-n13 * n22 * n31 - n11 * n23 * n32 + n11 * n22 * n33 + n13 * n21 * n32 - n12 * n21 * n33 + n12 * n23 * n31);
  }
  /**
   * Transposes this matrix in place.
   *
   * @return {Matrix4} A reference to this matrix.
   */
  transpose() {
    let te = this.elements, tmp4;
    return tmp4 = te[1], te[1] = te[4], te[4] = tmp4, tmp4 = te[2], te[2] = te[8], te[8] = tmp4, tmp4 = te[6], te[6] = te[9], te[9] = tmp4, tmp4 = te[3], te[3] = te[12], te[12] = tmp4, tmp4 = te[7], te[7] = te[13], te[13] = tmp4, tmp4 = te[11], te[11] = te[14], te[14] = tmp4, this;
  }
  /**
   * Sets the position component for this matrix from the given vector,
   * without affecting the rest of the matrix.
   *
   * @param {number|Vector3} x - The x component of the vector or alternatively the vector object.
   * @param {number} y - The y component of the vector.
   * @param {number} z - The z component of the vector.
   * @return {Matrix4} A reference to this matrix.
   */
  setPosition(x, y, z) {
    let te = this.elements;
    return x.isVector3 ? (te[12] = x.x, te[13] = x.y, te[14] = x.z) : (te[12] = x, te[13] = y, te[14] = z), this;
  }
  /**
   * Inverts this matrix, using the [analytic method]{@link https://en.wikipedia.org/wiki/Invertible_matrix#Analytic_solution}.
   * You can not invert with a determinant of zero. If you attempt this, the method produces
   * a zero matrix instead.
   *
   * @return {Matrix4} A reference to this matrix.
   */
  invert() {
    let te = this.elements, n11 = te[0], n21 = te[1], n31 = te[2], n41 = te[3], n12 = te[4], n22 = te[5], n32 = te[6], n42 = te[7], n13 = te[8], n23 = te[9], n33 = te[10], n43 = te[11], n14 = te[12], n24 = te[13], n34 = te[14], n44 = te[15], t11 = n23 * n34 * n42 - n24 * n33 * n42 + n24 * n32 * n43 - n22 * n34 * n43 - n23 * n32 * n44 + n22 * n33 * n44, t12 = n14 * n33 * n42 - n13 * n34 * n42 - n14 * n32 * n43 + n12 * n34 * n43 + n13 * n32 * n44 - n12 * n33 * n44, t13 = n13 * n24 * n42 - n14 * n23 * n42 + n14 * n22 * n43 - n12 * n24 * n43 - n13 * n22 * n44 + n12 * n23 * n44, t14 = n14 * n23 * n32 - n13 * n24 * n32 - n14 * n22 * n33 + n12 * n24 * n33 + n13 * n22 * n34 - n12 * n23 * n34, det = n11 * t11 + n21 * t12 + n31 * t13 + n41 * t14;
    if (det === 0) return this.set(0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0);
    let detInv = 1 / det;
    return te[0] = t11 * detInv, te[1] = (n24 * n33 * n41 - n23 * n34 * n41 - n24 * n31 * n43 + n21 * n34 * n43 + n23 * n31 * n44 - n21 * n33 * n44) * detInv, te[2] = (n22 * n34 * n41 - n24 * n32 * n41 + n24 * n31 * n42 - n21 * n34 * n42 - n22 * n31 * n44 + n21 * n32 * n44) * detInv, te[3] = (n23 * n32 * n41 - n22 * n33 * n41 - n23 * n31 * n42 + n21 * n33 * n42 + n22 * n31 * n43 - n21 * n32 * n43) * detInv, te[4] = t12 * detInv, te[5] = (n13 * n34 * n41 - n14 * n33 * n41 + n14 * n31 * n43 - n11 * n34 * n43 - n13 * n31 * n44 + n11 * n33 * n44) * detInv, te[6] = (n14 * n32 * n41 - n12 * n34 * n41 - n14 * n31 * n42 + n11 * n34 * n42 + n12 * n31 * n44 - n11 * n32 * n44) * detInv, te[7] = (n12 * n33 * n41 - n13 * n32 * n41 + n13 * n31 * n42 - n11 * n33 * n42 - n12 * n31 * n43 + n11 * n32 * n43) * detInv, te[8] = t13 * detInv, te[9] = (n14 * n23 * n41 - n13 * n24 * n41 - n14 * n21 * n43 + n11 * n24 * n43 + n13 * n21 * n44 - n11 * n23 * n44) * detInv, te[10] = (n12 * n24 * n41 - n14 * n22 * n41 + n14 * n21 * n42 - n11 * n24 * n42 - n12 * n21 * n44 + n11 * n22 * n44) * detInv, te[11] = (n13 * n22 * n41 - n12 * n23 * n41 - n13 * n21 * n42 + n11 * n23 * n42 + n12 * n21 * n43 - n11 * n22 * n43) * detInv, te[12] = t14 * detInv, te[13] = (n13 * n24 * n31 - n14 * n23 * n31 + n14 * n21 * n33 - n11 * n24 * n33 - n13 * n21 * n34 + n11 * n23 * n34) * detInv, te[14] = (n14 * n22 * n31 - n12 * n24 * n31 - n14 * n21 * n32 + n11 * n24 * n32 + n12 * n21 * n34 - n11 * n22 * n34) * detInv, te[15] = (n12 * n23 * n31 - n13 * n22 * n31 + n13 * n21 * n32 - n11 * n23 * n32 - n12 * n21 * n33 + n11 * n22 * n33) * detInv, this;
  }
  /**
   * Multiplies the columns of this matrix by the given vector.
   *
   * @param {Vector3} v - The scale vector.
   * @return {Matrix4} A reference to this matrix.
   */
  scale(v) {
    let te = this.elements, x = v.x, y = v.y, z = v.z;
    return te[0] *= x, te[4] *= y, te[8] *= z, te[1] *= x, te[5] *= y, te[9] *= z, te[2] *= x, te[6] *= y, te[10] *= z, te[3] *= x, te[7] *= y, te[11] *= z, this;
  }
  /**
   * Gets the maximum scale value of the three axes.
   *
   * @return {number} The maximum scale.
   */
  getMaxScaleOnAxis() {
    let te = this.elements, scaleXSq = te[0] * te[0] + te[1] * te[1] + te[2] * te[2], scaleYSq = te[4] * te[4] + te[5] * te[5] + te[6] * te[6], scaleZSq = te[8] * te[8] + te[9] * te[9] + te[10] * te[10];
    return Math.sqrt(Math.max(scaleXSq, scaleYSq, scaleZSq));
  }
  /**
   * Sets this matrix as a translation transform from the given vector.
   *
   * @param {number|Vector3} x - The amount to translate in the X axis or alternatively a translation vector.
   * @param {number} y - The amount to translate in the Y axis.
   * @param {number} z - The amount to translate in the z axis.
   * @return {Matrix4} A reference to this matrix.
   */
  makeTranslation(x, y, z) {
    return x.isVector3 ? this.set(
      1,
      0,
      0,
      x.x,
      0,
      1,
      0,
      x.y,
      0,
      0,
      1,
      x.z,
      0,
      0,
      0,
      1
    ) : this.set(
      1,
      0,
      0,
      x,
      0,
      1,
      0,
      y,
      0,
      0,
      1,
      z,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Sets this matrix as a rotational transformation around the X axis by
   * the given angle.
   *
   * @param {number} theta - The rotation in radians.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationX(theta) {
    let c = Math.cos(theta), s = Math.sin(theta);
    return this.set(
      1,
      0,
      0,
      0,
      0,
      c,
      -s,
      0,
      0,
      s,
      c,
      0,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Sets this matrix as a rotational transformation around the Y axis by
   * the given angle.
   *
   * @param {number} theta - The rotation in radians.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationY(theta) {
    let c = Math.cos(theta), s = Math.sin(theta);
    return this.set(
      c,
      0,
      s,
      0,
      0,
      1,
      0,
      0,
      -s,
      0,
      c,
      0,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Sets this matrix as a rotational transformation around the Z axis by
   * the given angle.
   *
   * @param {number} theta - The rotation in radians.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationZ(theta) {
    let c = Math.cos(theta), s = Math.sin(theta);
    return this.set(
      c,
      -s,
      0,
      0,
      s,
      c,
      0,
      0,
      0,
      0,
      1,
      0,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Sets this matrix as a rotational transformation around the given axis by
   * the given angle.
   *
   * This is a somewhat controversial but mathematically sound alternative to
   * rotating via Quaternions. See the discussion [here]{@link https://www.gamedev.net/articles/programming/math-and-physics/do-we-really-need-quaternions-r1199}.
   *
   * @param {Vector3} axis - The normalized rotation axis.
   * @param {number} angle - The rotation in radians.
   * @return {Matrix4} A reference to this matrix.
   */
  makeRotationAxis(axis, angle) {
    let c = Math.cos(angle), s = Math.sin(angle), t = 1 - c, x = axis.x, y = axis.y, z = axis.z, tx = t * x, ty = t * y;
    return this.set(
      tx * x + c,
      tx * y - s * z,
      tx * z + s * y,
      0,
      tx * y + s * z,
      ty * y + c,
      ty * z - s * x,
      0,
      tx * z - s * y,
      ty * z + s * x,
      t * z * z + c,
      0,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Sets this matrix as a scale transformation.
   *
   * @param {number} x - The amount to scale in the X axis.
   * @param {number} y - The amount to scale in the Y axis.
   * @param {number} z - The amount to scale in the Z axis.
   * @return {Matrix4} A reference to this matrix.
   */
  makeScale(x, y, z) {
    return this.set(
      x,
      0,
      0,
      0,
      0,
      y,
      0,
      0,
      0,
      0,
      z,
      0,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Sets this matrix as a shear transformation.
   *
   * @param {number} xy - The amount to shear X by Y.
   * @param {number} xz - The amount to shear X by Z.
   * @param {number} yx - The amount to shear Y by X.
   * @param {number} yz - The amount to shear Y by Z.
   * @param {number} zx - The amount to shear Z by X.
   * @param {number} zy - The amount to shear Z by Y.
   * @return {Matrix4} A reference to this matrix.
   */
  makeShear(xy, xz, yx, yz, zx, zy) {
    return this.set(
      1,
      yx,
      zx,
      0,
      xy,
      1,
      zy,
      0,
      xz,
      yz,
      1,
      0,
      0,
      0,
      0,
      1
    ), this;
  }
  /**
   * Sets this matrix to the transformation composed of the given position,
   * rotation (Quaternion) and scale.
   *
   * @param {Vector3} position - The position vector.
   * @param {Quaternion} quaternion - The rotation as a Quaternion.
   * @param {Vector3} scale - The scale vector.
   * @return {Matrix4} A reference to this matrix.
   */
  compose(position, quaternion, scale) {
    let te = this.elements, x = quaternion._x, y = quaternion._y, z = quaternion._z, w = quaternion._w, x2 = x + x, y2 = y + y, z2 = z + z, xx = x * x2, xy = x * y2, xz = x * z2, yy = y * y2, yz = y * z2, zz = z * z2, wx = w * x2, wy = w * y2, wz = w * z2, sx = scale.x, sy = scale.y, sz = scale.z;
    return te[0] = (1 - (yy + zz)) * sx, te[1] = (xy + wz) * sx, te[2] = (xz - wy) * sx, te[3] = 0, te[4] = (xy - wz) * sy, te[5] = (1 - (xx + zz)) * sy, te[6] = (yz + wx) * sy, te[7] = 0, te[8] = (xz + wy) * sz, te[9] = (yz - wx) * sz, te[10] = (1 - (xx + yy)) * sz, te[11] = 0, te[12] = position.x, te[13] = position.y, te[14] = position.z, te[15] = 1, this;
  }
  /**
   * Decomposes this matrix into its position, rotation and scale components
   * and provides the result in the given objects.
   *
   * Note: Not all matrices are decomposable in this way. For example, if an
   * object has a non-uniformly scaled parent, then the object's world matrix
   * may not be decomposable, and this method may not be appropriate.
   *
   * @param {Vector3} position - The position vector.
   * @param {Quaternion} quaternion - The rotation as a Quaternion.
   * @param {Vector3} scale - The scale vector.
   * @return {Matrix4} A reference to this matrix.
   */
  decompose(position, quaternion, scale) {
    let te = this.elements, sx = _v1$5.set(te[0], te[1], te[2]).length(), sy = _v1$5.set(te[4], te[5], te[6]).length(), sz = _v1$5.set(te[8], te[9], te[10]).length();
    this.determinant() < 0 && (sx = -sx), position.x = te[12], position.y = te[13], position.z = te[14], _m1$2.copy(this);
    let invSX = 1 / sx, invSY = 1 / sy, invSZ = 1 / sz;
    return _m1$2.elements[0] *= invSX, _m1$2.elements[1] *= invSX, _m1$2.elements[2] *= invSX, _m1$2.elements[4] *= invSY, _m1$2.elements[5] *= invSY, _m1$2.elements[6] *= invSY, _m1$2.elements[8] *= invSZ, _m1$2.elements[9] *= invSZ, _m1$2.elements[10] *= invSZ, quaternion.setFromRotationMatrix(_m1$2), scale.x = sx, scale.y = sy, scale.z = sz, this;
  }
  /**
  	 * Creates a perspective projection matrix. This is used internally by
  	 * {@link PerspectiveCamera#updateProjectionMatrix}.
  
  	 * @param {number} left - Left boundary of the viewing frustum at the near plane.
  	 * @param {number} right - Right boundary of the viewing frustum at the near plane.
  	 * @param {number} top - Top boundary of the viewing frustum at the near plane.
  	 * @param {number} bottom - Bottom boundary of the viewing frustum at the near plane.
  	 * @param {number} near - The distance from the camera to the near plane.
  	 * @param {number} far - The distance from the camera to the far plane.
  	 * @param {(WebGLCoordinateSystem|WebGPUCoordinateSystem)} [coordinateSystem=WebGLCoordinateSystem] - The coordinate system.
  	 * @param {boolean} [reversedDepth=false] - Whether to use a reversed depth.
  	 * @return {Matrix4} A reference to this matrix.
  	 */
  makePerspective(left, right, top, bottom, near, far, coordinateSystem = WebGLCoordinateSystem, reversedDepth = !1) {
    let te = this.elements, x = 2 * near / (right - left), y = 2 * near / (top - bottom), a = (right + left) / (right - left), b = (top + bottom) / (top - bottom), c, d;
    if (reversedDepth)
      c = near / (far - near), d = far * near / (far - near);
    else if (coordinateSystem === WebGLCoordinateSystem)
      c = -(far + near) / (far - near), d = -2 * far * near / (far - near);
    else if (coordinateSystem === WebGPUCoordinateSystem)
      c = -far / (far - near), d = -far * near / (far - near);
    else
      throw new Error("THREE.Matrix4.makePerspective(): Invalid coordinate system: " + coordinateSystem);
    return te[0] = x, te[4] = 0, te[8] = a, te[12] = 0, te[1] = 0, te[5] = y, te[9] = b, te[13] = 0, te[2] = 0, te[6] = 0, te[10] = c, te[14] = d, te[3] = 0, te[7] = 0, te[11] = -1, te[15] = 0, this;
  }
  /**
  	 * Creates a orthographic projection matrix. This is used internally by
  	 * {@link OrthographicCamera#updateProjectionMatrix}.
  
  	 * @param {number} left - Left boundary of the viewing frustum at the near plane.
  	 * @param {number} right - Right boundary of the viewing frustum at the near plane.
  	 * @param {number} top - Top boundary of the viewing frustum at the near plane.
  	 * @param {number} bottom - Bottom boundary of the viewing frustum at the near plane.
  	 * @param {number} near - The distance from the camera to the near plane.
  	 * @param {number} far - The distance from the camera to the far plane.
  	 * @param {(WebGLCoordinateSystem|WebGPUCoordinateSystem)} [coordinateSystem=WebGLCoordinateSystem] - The coordinate system.
  	 * @param {boolean} [reversedDepth=false] - Whether to use a reversed depth.
  	 * @return {Matrix4} A reference to this matrix.
  	 */
  makeOrthographic(left, right, top, bottom, near, far, coordinateSystem = WebGLCoordinateSystem, reversedDepth = !1) {
    let te = this.elements, x = 2 / (right - left), y = 2 / (top - bottom), a = -(right + left) / (right - left), b = -(top + bottom) / (top - bottom), c, d;
    if (reversedDepth)
      c = 1 / (far - near), d = far / (far - near);
    else if (coordinateSystem === WebGLCoordinateSystem)
      c = -2 / (far - near), d = -(far + near) / (far - near);
    else if (coordinateSystem === WebGPUCoordinateSystem)
      c = -1 / (far - near), d = -near / (far - near);
    else
      throw new Error("THREE.Matrix4.makeOrthographic(): Invalid coordinate system: " + coordinateSystem);
    return te[0] = x, te[4] = 0, te[8] = 0, te[12] = a, te[1] = 0, te[5] = y, te[9] = 0, te[13] = b, te[2] = 0, te[6] = 0, te[10] = c, te[14] = d, te[3] = 0, te[7] = 0, te[11] = 0, te[15] = 1, this;
  }
  /**
   * Returns `true` if this matrix is equal with the given one.
   *
   * @param {Matrix4} matrix - The matrix to test for equality.
   * @return {boolean} Whether this matrix is equal with the given one.
   */
  equals(matrix) {
    let te = this.elements, me = matrix.elements;
    for (let i = 0; i < 16; i++)
      if (te[i] !== me[i]) return !1;
    return !0;
  }
  /**
   * Sets the elements of the matrix from the given array.
   *
   * @param {Array<number>} array - The matrix elements in column-major order.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Matrix4} A reference to this matrix.
   */
  fromArray(array, offset = 0) {
    for (let i = 0; i < 16; i++)
      this.elements[i] = array[i + offset];
    return this;
  }
  /**
   * Writes the elements of this matrix to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param {Array<number>} [array=[]] - The target array holding the matrix elements in column-major order.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Array<number>} The matrix elements in column-major order.
   */
  toArray(array = [], offset = 0) {
    let te = this.elements;
    return array[offset] = te[0], array[offset + 1] = te[1], array[offset + 2] = te[2], array[offset + 3] = te[3], array[offset + 4] = te[4], array[offset + 5] = te[5], array[offset + 6] = te[6], array[offset + 7] = te[7], array[offset + 8] = te[8], array[offset + 9] = te[9], array[offset + 10] = te[10], array[offset + 11] = te[11], array[offset + 12] = te[12], array[offset + 13] = te[13], array[offset + 14] = te[14], array[offset + 15] = te[15], array;
  }
}, _v1$5 = /* @__PURE__ */ new Vector3(), _m1$2 = /* @__PURE__ */ new Matrix4(), _zero = /* @__PURE__ */ new Vector3(0, 0, 0), _one = /* @__PURE__ */ new Vector3(1, 1, 1), _x = /* @__PURE__ */ new Vector3(), _y = /* @__PURE__ */ new Vector3(), _z = /* @__PURE__ */ new Vector3(), _matrix$2 = /* @__PURE__ */ new Matrix4(), _quaternion$3 = /* @__PURE__ */ new Quaternion(), Euler = class _Euler {
  /**
   * Constructs a new euler instance.
   *
   * @param {number} [x=0] - The angle of the x axis in radians.
   * @param {number} [y=0] - The angle of the y axis in radians.
   * @param {number} [z=0] - The angle of the z axis in radians.
   * @param {string} [order=Euler.DEFAULT_ORDER] - A string representing the order that the rotations are applied.
   */
  constructor(x = 0, y = 0, z = 0, order = _Euler.DEFAULT_ORDER) {
    this.isEuler = !0, this._x = x, this._y = y, this._z = z, this._order = order;
  }
  /**
   * The angle of the x axis in radians.
   *
   * @type {number}
   * @default 0
   */
  get x() {
    return this._x;
  }
  set x(value) {
    this._x = value, this._onChangeCallback();
  }
  /**
   * The angle of the y axis in radians.
   *
   * @type {number}
   * @default 0
   */
  get y() {
    return this._y;
  }
  set y(value) {
    this._y = value, this._onChangeCallback();
  }
  /**
   * The angle of the z axis in radians.
   *
   * @type {number}
   * @default 0
   */
  get z() {
    return this._z;
  }
  set z(value) {
    this._z = value, this._onChangeCallback();
  }
  /**
   * A string representing the order that the rotations are applied.
   *
   * @type {string}
   * @default 'XYZ'
   */
  get order() {
    return this._order;
  }
  set order(value) {
    this._order = value, this._onChangeCallback();
  }
  /**
   * Sets the Euler components.
   *
   * @param {number} x - The angle of the x axis in radians.
   * @param {number} y - The angle of the y axis in radians.
   * @param {number} z - The angle of the z axis in radians.
   * @param {string} [order] - A string representing the order that the rotations are applied.
   * @return {Euler} A reference to this Euler instance.
   */
  set(x, y, z, order = this._order) {
    return this._x = x, this._y = y, this._z = z, this._order = order, this._onChangeCallback(), this;
  }
  /**
   * Returns a new Euler instance with copied values from this instance.
   *
   * @return {Euler} A clone of this instance.
   */
  clone() {
    return new this.constructor(this._x, this._y, this._z, this._order);
  }
  /**
   * Copies the values of the given Euler instance to this instance.
   *
   * @param {Euler} euler - The Euler instance to copy.
   * @return {Euler} A reference to this Euler instance.
   */
  copy(euler) {
    return this._x = euler._x, this._y = euler._y, this._z = euler._z, this._order = euler._order, this._onChangeCallback(), this;
  }
  /**
   * Sets the angles of this Euler instance from a pure rotation matrix.
   *
   * @param {Matrix4} m - A 4x4 matrix of which the upper 3x3 of matrix is a pure rotation matrix (i.e. unscaled).
   * @param {string} [order] - A string representing the order that the rotations are applied.
   * @param {boolean} [update=true] - Whether the internal `onChange` callback should be executed or not.
   * @return {Euler} A reference to this Euler instance.
   */
  setFromRotationMatrix(m, order = this._order, update = !0) {
    let te = m.elements, m11 = te[0], m12 = te[4], m13 = te[8], m21 = te[1], m22 = te[5], m23 = te[9], m31 = te[2], m32 = te[6], m33 = te[10];
    switch (order) {
      case "XYZ":
        this._y = Math.asin(clamp(m13, -1, 1)), Math.abs(m13) < 0.9999999 ? (this._x = Math.atan2(-m23, m33), this._z = Math.atan2(-m12, m11)) : (this._x = Math.atan2(m32, m22), this._z = 0);
        break;
      case "YXZ":
        this._x = Math.asin(-clamp(m23, -1, 1)), Math.abs(m23) < 0.9999999 ? (this._y = Math.atan2(m13, m33), this._z = Math.atan2(m21, m22)) : (this._y = Math.atan2(-m31, m11), this._z = 0);
        break;
      case "ZXY":
        this._x = Math.asin(clamp(m32, -1, 1)), Math.abs(m32) < 0.9999999 ? (this._y = Math.atan2(-m31, m33), this._z = Math.atan2(-m12, m22)) : (this._y = 0, this._z = Math.atan2(m21, m11));
        break;
      case "ZYX":
        this._y = Math.asin(-clamp(m31, -1, 1)), Math.abs(m31) < 0.9999999 ? (this._x = Math.atan2(m32, m33), this._z = Math.atan2(m21, m11)) : (this._x = 0, this._z = Math.atan2(-m12, m22));
        break;
      case "YZX":
        this._z = Math.asin(clamp(m21, -1, 1)), Math.abs(m21) < 0.9999999 ? (this._x = Math.atan2(-m23, m22), this._y = Math.atan2(-m31, m11)) : (this._x = 0, this._y = Math.atan2(m13, m33));
        break;
      case "XZY":
        this._z = Math.asin(-clamp(m12, -1, 1)), Math.abs(m12) < 0.9999999 ? (this._x = Math.atan2(m32, m22), this._y = Math.atan2(m13, m11)) : (this._x = Math.atan2(-m23, m33), this._y = 0);
        break;
      default:
        console.warn("THREE.Euler: .setFromRotationMatrix() encountered an unknown order: " + order);
    }
    return this._order = order, update === !0 && this._onChangeCallback(), this;
  }
  /**
   * Sets the angles of this Euler instance from a normalized quaternion.
   *
   * @param {Quaternion} q - A normalized Quaternion.
   * @param {string} [order] - A string representing the order that the rotations are applied.
   * @param {boolean} [update=true] - Whether the internal `onChange` callback should be executed or not.
   * @return {Euler} A reference to this Euler instance.
   */
  setFromQuaternion(q, order, update) {
    return _matrix$2.makeRotationFromQuaternion(q), this.setFromRotationMatrix(_matrix$2, order, update);
  }
  /**
   * Sets the angles of this Euler instance from the given vector.
   *
   * @param {Vector3} v - The vector.
   * @param {string} [order] - A string representing the order that the rotations are applied.
   * @return {Euler} A reference to this Euler instance.
   */
  setFromVector3(v, order = this._order) {
    return this.set(v.x, v.y, v.z, order);
  }
  /**
   * Resets the euler angle with a new order by creating a quaternion from this
   * euler angle and then setting this euler angle with the quaternion and the
   * new order.
   *
   * Warning: This discards revolution information.
   *
   * @param {string} [newOrder] - A string representing the new order that the rotations are applied.
   * @return {Euler} A reference to this Euler instance.
   */
  reorder(newOrder) {
    return _quaternion$3.setFromEuler(this), this.setFromQuaternion(_quaternion$3, newOrder);
  }
  /**
   * Returns `true` if this Euler instance is equal with the given one.
   *
   * @param {Euler} euler - The Euler instance to test for equality.
   * @return {boolean} Whether this Euler instance is equal with the given one.
   */
  equals(euler) {
    return euler._x === this._x && euler._y === this._y && euler._z === this._z && euler._order === this._order;
  }
  /**
   * Sets this Euler instance's components to values from the given array. The first three
   * entries of the array are assign to the x,y and z components. An optional fourth entry
   * defines the Euler order.
   *
   * @param {Array<number,number,number,?string>} array - An array holding the Euler component values.
   * @return {Euler} A reference to this Euler instance.
   */
  fromArray(array) {
    return this._x = array[0], this._y = array[1], this._z = array[2], array[3] !== void 0 && (this._order = array[3]), this._onChangeCallback(), this;
  }
  /**
   * Writes the components of this Euler instance to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param {Array<number,number,number,string>} [array=[]] - The target array holding the Euler components.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Array<number,number,number,string>} The Euler components.
   */
  toArray(array = [], offset = 0) {
    return array[offset] = this._x, array[offset + 1] = this._y, array[offset + 2] = this._z, array[offset + 3] = this._order, array;
  }
  _onChange(callback) {
    return this._onChangeCallback = callback, this;
  }
  _onChangeCallback() {
  }
  *[Symbol.iterator]() {
    yield this._x, yield this._y, yield this._z, yield this._order;
  }
};
Euler.DEFAULT_ORDER = "XYZ";
var Layers = class {
  /**
   * Constructs a new layers instance, with membership
   * initially set to layer `0`.
   */
  constructor() {
    this.mask = 1;
  }
  /**
   * Sets membership to the given layer, and remove membership all other layers.
   *
   * @param {number} layer - The layer to set.
   */
  set(layer) {
    this.mask = (1 << layer | 0) >>> 0;
  }
  /**
   * Adds membership of the given layer.
   *
   * @param {number} layer - The layer to enable.
   */
  enable(layer) {
    this.mask |= 1 << layer | 0;
  }
  /**
   * Adds membership to all layers.
   */
  enableAll() {
    this.mask = -1;
  }
  /**
   * Toggles the membership of the given layer.
   *
   * @param {number} layer - The layer to toggle.
   */
  toggle(layer) {
    this.mask ^= 1 << layer | 0;
  }
  /**
   * Removes membership of the given layer.
   *
   * @param {number} layer - The layer to enable.
   */
  disable(layer) {
    this.mask &= ~(1 << layer | 0);
  }
  /**
   * Removes the membership from all layers.
   */
  disableAll() {
    this.mask = 0;
  }
  /**
   * Returns `true` if this and the given layers object have at least one
   * layer in common.
   *
   * @param {Layers} layers - The layers to test.
   * @return {boolean } Whether this and the given layers object have at least one layer in common or not.
   */
  test(layers) {
    return (this.mask & layers.mask) !== 0;
  }
  /**
   * Returns `true` if the given layer is enabled.
   *
   * @param {number} layer - The layer to test.
   * @return {boolean } Whether the given layer is enabled or not.
   */
  isEnabled(layer) {
    return (this.mask & (1 << layer | 0)) !== 0;
  }
}, _object3DId = 0, _v1$4 = /* @__PURE__ */ new Vector3(), _q1 = /* @__PURE__ */ new Quaternion(), _m1$1 = /* @__PURE__ */ new Matrix4(), _target = /* @__PURE__ */ new Vector3(), _position$3 = /* @__PURE__ */ new Vector3(), _scale$2 = /* @__PURE__ */ new Vector3(), _quaternion$2 = /* @__PURE__ */ new Quaternion(), _xAxis = /* @__PURE__ */ new Vector3(1, 0, 0), _yAxis = /* @__PURE__ */ new Vector3(0, 1, 0), _zAxis = /* @__PURE__ */ new Vector3(0, 0, 1), _addedEvent = { type: "added" }, _removedEvent = { type: "removed" }, _childaddedEvent = { type: "childadded", child: null }, _childremovedEvent = { type: "childremoved", child: null }, Object3D = class _Object3D extends EventDispatcher {
  /**
   * Constructs a new 3D object.
   */
  constructor() {
    super(), this.isObject3D = !0, Object.defineProperty(this, "id", { value: _object3DId++ }), this.uuid = generateUUID(), this.name = "", this.type = "Object3D", this.parent = null, this.children = [], this.up = _Object3D.DEFAULT_UP.clone();
    let position = new Vector3(), rotation = new Euler(), quaternion = new Quaternion(), scale = new Vector3(1, 1, 1);
    function onRotationChange() {
      quaternion.setFromEuler(rotation, !1);
    }
    function onQuaternionChange() {
      rotation.setFromQuaternion(quaternion, void 0, !1);
    }
    rotation._onChange(onRotationChange), quaternion._onChange(onQuaternionChange), Object.defineProperties(this, {
      /**
       * Represents the object's local position.
       *
       * @name Object3D#position
       * @type {Vector3}
       * @default (0,0,0)
       */
      position: {
        configurable: !0,
        enumerable: !0,
        value: position
      },
      /**
       * Represents the object's local rotation as Euler angles, in radians.
       *
       * @name Object3D#rotation
       * @type {Euler}
       * @default (0,0,0)
       */
      rotation: {
        configurable: !0,
        enumerable: !0,
        value: rotation
      },
      /**
       * Represents the object's local rotation as Quaternions.
       *
       * @name Object3D#quaternion
       * @type {Quaternion}
       */
      quaternion: {
        configurable: !0,
        enumerable: !0,
        value: quaternion
      },
      /**
       * Represents the object's local scale.
       *
       * @name Object3D#scale
       * @type {Vector3}
       * @default (1,1,1)
       */
      scale: {
        configurable: !0,
        enumerable: !0,
        value: scale
      },
      /**
       * Represents the object's model-view matrix.
       *
       * @name Object3D#modelViewMatrix
       * @type {Matrix4}
       */
      modelViewMatrix: {
        value: new Matrix4()
      },
      /**
       * Represents the object's normal matrix.
       *
       * @name Object3D#normalMatrix
       * @type {Matrix3}
       */
      normalMatrix: {
        value: new Matrix3()
      }
    }), this.matrix = new Matrix4(), this.matrixWorld = new Matrix4(), this.matrixAutoUpdate = _Object3D.DEFAULT_MATRIX_AUTO_UPDATE, this.matrixWorldAutoUpdate = _Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE, this.matrixWorldNeedsUpdate = !1, this.layers = new Layers(), this.visible = !0, this.castShadow = !1, this.receiveShadow = !1, this.frustumCulled = !0, this.renderOrder = 0, this.animations = [], this.customDepthMaterial = void 0, this.customDistanceMaterial = void 0, this.userData = {};
  }
  /**
   * A callback that is executed immediately before a 3D object is rendered to a shadow map.
   *
   * @param {Renderer|WebGLRenderer} renderer - The renderer.
   * @param {Object3D} object - The 3D object.
   * @param {Camera} camera - The camera that is used to render the scene.
   * @param {Camera} shadowCamera - The shadow camera.
   * @param {BufferGeometry} geometry - The 3D object's geometry.
   * @param {Material} depthMaterial - The depth material.
   * @param {Object} group - The geometry group data.
   */
  onBeforeShadow() {
  }
  /**
   * A callback that is executed immediately after a 3D object is rendered to a shadow map.
   *
   * @param {Renderer|WebGLRenderer} renderer - The renderer.
   * @param {Object3D} object - The 3D object.
   * @param {Camera} camera - The camera that is used to render the scene.
   * @param {Camera} shadowCamera - The shadow camera.
   * @param {BufferGeometry} geometry - The 3D object's geometry.
   * @param {Material} depthMaterial - The depth material.
   * @param {Object} group - The geometry group data.
   */
  onAfterShadow() {
  }
  /**
   * A callback that is executed immediately before a 3D object is rendered.
   *
   * @param {Renderer|WebGLRenderer} renderer - The renderer.
   * @param {Object3D} object - The 3D object.
   * @param {Camera} camera - The camera that is used to render the scene.
   * @param {BufferGeometry} geometry - The 3D object's geometry.
   * @param {Material} material - The 3D object's material.
   * @param {Object} group - The geometry group data.
   */
  onBeforeRender() {
  }
  /**
   * A callback that is executed immediately after a 3D object is rendered.
   *
   * @param {Renderer|WebGLRenderer} renderer - The renderer.
   * @param {Object3D} object - The 3D object.
   * @param {Camera} camera - The camera that is used to render the scene.
   * @param {BufferGeometry} geometry - The 3D object's geometry.
   * @param {Material} material - The 3D object's material.
   * @param {Object} group - The geometry group data.
   */
  onAfterRender() {
  }
  /**
   * Applies the given transformation matrix to the object and updates the object's position,
   * rotation and scale.
   *
   * @param {Matrix4} matrix - The transformation matrix.
   */
  applyMatrix4(matrix) {
    this.matrixAutoUpdate && this.updateMatrix(), this.matrix.premultiply(matrix), this.matrix.decompose(this.position, this.quaternion, this.scale);
  }
  /**
   * Applies a rotation represented by given the quaternion to the 3D object.
   *
   * @param {Quaternion} q - The quaternion.
   * @return {Object3D} A reference to this instance.
   */
  applyQuaternion(q) {
    return this.quaternion.premultiply(q), this;
  }
  /**
   * Sets the given rotation represented as an axis/angle couple to the 3D object.
   *
   * @param {Vector3} axis - The (normalized) axis vector.
   * @param {number} angle - The angle in radians.
   */
  setRotationFromAxisAngle(axis, angle) {
    this.quaternion.setFromAxisAngle(axis, angle);
  }
  /**
   * Sets the given rotation represented as Euler angles to the 3D object.
   *
   * @param {Euler} euler - The Euler angles.
   */
  setRotationFromEuler(euler) {
    this.quaternion.setFromEuler(euler, !0);
  }
  /**
   * Sets the given rotation represented as rotation matrix to the 3D object.
   *
   * @param {Matrix4} m - Although a 4x4 matrix is expected, the upper 3x3 portion must be
   * a pure rotation matrix (i.e, unscaled).
   */
  setRotationFromMatrix(m) {
    this.quaternion.setFromRotationMatrix(m);
  }
  /**
   * Sets the given rotation represented as a Quaternion to the 3D object.
   *
   * @param {Quaternion} q - The Quaternion
   */
  setRotationFromQuaternion(q) {
    this.quaternion.copy(q);
  }
  /**
   * Rotates the 3D object along an axis in local space.
   *
   * @param {Vector3} axis - The (normalized) axis vector.
   * @param {number} angle - The angle in radians.
   * @return {Object3D} A reference to this instance.
   */
  rotateOnAxis(axis, angle) {
    return _q1.setFromAxisAngle(axis, angle), this.quaternion.multiply(_q1), this;
  }
  /**
   * Rotates the 3D object along an axis in world space.
   *
   * @param {Vector3} axis - The (normalized) axis vector.
   * @param {number} angle - The angle in radians.
   * @return {Object3D} A reference to this instance.
   */
  rotateOnWorldAxis(axis, angle) {
    return _q1.setFromAxisAngle(axis, angle), this.quaternion.premultiply(_q1), this;
  }
  /**
   * Rotates the 3D object around its X axis in local space.
   *
   * @param {number} angle - The angle in radians.
   * @return {Object3D} A reference to this instance.
   */
  rotateX(angle) {
    return this.rotateOnAxis(_xAxis, angle);
  }
  /**
   * Rotates the 3D object around its Y axis in local space.
   *
   * @param {number} angle - The angle in radians.
   * @return {Object3D} A reference to this instance.
   */
  rotateY(angle) {
    return this.rotateOnAxis(_yAxis, angle);
  }
  /**
   * Rotates the 3D object around its Z axis in local space.
   *
   * @param {number} angle - The angle in radians.
   * @return {Object3D} A reference to this instance.
   */
  rotateZ(angle) {
    return this.rotateOnAxis(_zAxis, angle);
  }
  /**
   * Translate the 3D object by a distance along the given axis in local space.
   *
   * @param {Vector3} axis - The (normalized) axis vector.
   * @param {number} distance - The distance in world units.
   * @return {Object3D} A reference to this instance.
   */
  translateOnAxis(axis, distance) {
    return _v1$4.copy(axis).applyQuaternion(this.quaternion), this.position.add(_v1$4.multiplyScalar(distance)), this;
  }
  /**
   * Translate the 3D object by a distance along its X-axis in local space.
   *
   * @param {number} distance - The distance in world units.
   * @return {Object3D} A reference to this instance.
   */
  translateX(distance) {
    return this.translateOnAxis(_xAxis, distance);
  }
  /**
   * Translate the 3D object by a distance along its Y-axis in local space.
   *
   * @param {number} distance - The distance in world units.
   * @return {Object3D} A reference to this instance.
   */
  translateY(distance) {
    return this.translateOnAxis(_yAxis, distance);
  }
  /**
   * Translate the 3D object by a distance along its Z-axis in local space.
   *
   * @param {number} distance - The distance in world units.
   * @return {Object3D} A reference to this instance.
   */
  translateZ(distance) {
    return this.translateOnAxis(_zAxis, distance);
  }
  /**
   * Converts the given vector from this 3D object's local space to world space.
   *
   * @param {Vector3} vector - The vector to convert.
   * @return {Vector3} The converted vector.
   */
  localToWorld(vector) {
    return this.updateWorldMatrix(!0, !1), vector.applyMatrix4(this.matrixWorld);
  }
  /**
   * Converts the given vector from this 3D object's word space to local space.
   *
   * @param {Vector3} vector - The vector to convert.
   * @return {Vector3} The converted vector.
   */
  worldToLocal(vector) {
    return this.updateWorldMatrix(!0, !1), vector.applyMatrix4(_m1$1.copy(this.matrixWorld).invert());
  }
  /**
   * Rotates the object to face a point in world space.
   *
   * This method does not support objects having non-uniformly-scaled parent(s).
   *
   * @param {number|Vector3} x - The x coordinate in world space. Alternatively, a vector representing a position in world space
   * @param {number} [y] - The y coordinate in world space.
   * @param {number} [z] - The z coordinate in world space.
   */
  lookAt(x, y, z) {
    x.isVector3 ? _target.copy(x) : _target.set(x, y, z);
    let parent = this.parent;
    this.updateWorldMatrix(!0, !1), _position$3.setFromMatrixPosition(this.matrixWorld), this.isCamera || this.isLight ? _m1$1.lookAt(_position$3, _target, this.up) : _m1$1.lookAt(_target, _position$3, this.up), this.quaternion.setFromRotationMatrix(_m1$1), parent && (_m1$1.extractRotation(parent.matrixWorld), _q1.setFromRotationMatrix(_m1$1), this.quaternion.premultiply(_q1.invert()));
  }
  /**
   * Adds the given 3D object as a child to this 3D object. An arbitrary number of
   * objects may be added. Any current parent on an object passed in here will be
   * removed, since an object can have at most one parent.
   *
   * @fires Object3D#added
   * @fires Object3D#childadded
   * @param {Object3D} object - The 3D object to add.
   * @return {Object3D} A reference to this instance.
   */
  add(object) {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++)
        this.add(arguments[i]);
      return this;
    }
    return object === this ? (console.error("THREE.Object3D.add: object can't be added as a child of itself.", object), this) : (object && object.isObject3D ? (object.removeFromParent(), object.parent = this, this.children.push(object), object.dispatchEvent(_addedEvent), _childaddedEvent.child = object, this.dispatchEvent(_childaddedEvent), _childaddedEvent.child = null) : console.error("THREE.Object3D.add: object not an instance of THREE.Object3D.", object), this);
  }
  /**
   * Removes the given 3D object as child from this 3D object.
   * An arbitrary number of objects may be removed.
   *
   * @fires Object3D#removed
   * @fires Object3D#childremoved
   * @param {Object3D} object - The 3D object to remove.
   * @return {Object3D} A reference to this instance.
   */
  remove(object) {
    if (arguments.length > 1) {
      for (let i = 0; i < arguments.length; i++)
        this.remove(arguments[i]);
      return this;
    }
    let index = this.children.indexOf(object);
    return index !== -1 && (object.parent = null, this.children.splice(index, 1), object.dispatchEvent(_removedEvent), _childremovedEvent.child = object, this.dispatchEvent(_childremovedEvent), _childremovedEvent.child = null), this;
  }
  /**
   * Removes this 3D object from its current parent.
   *
   * @fires Object3D#removed
   * @fires Object3D#childremoved
   * @return {Object3D} A reference to this instance.
   */
  removeFromParent() {
    let parent = this.parent;
    return parent !== null && parent.remove(this), this;
  }
  /**
   * Removes all child objects.
   *
   * @fires Object3D#removed
   * @fires Object3D#childremoved
   * @return {Object3D} A reference to this instance.
   */
  clear() {
    return this.remove(...this.children);
  }
  /**
   * Adds the given 3D object as a child of this 3D object, while maintaining the object's world
   * transform. This method does not support scene graphs having non-uniformly-scaled nodes(s).
   *
   * @fires Object3D#added
   * @fires Object3D#childadded
   * @param {Object3D} object - The 3D object to attach.
   * @return {Object3D} A reference to this instance.
   */
  attach(object) {
    return this.updateWorldMatrix(!0, !1), _m1$1.copy(this.matrixWorld).invert(), object.parent !== null && (object.parent.updateWorldMatrix(!0, !1), _m1$1.multiply(object.parent.matrixWorld)), object.applyMatrix4(_m1$1), object.removeFromParent(), object.parent = this, this.children.push(object), object.updateWorldMatrix(!1, !0), object.dispatchEvent(_addedEvent), _childaddedEvent.child = object, this.dispatchEvent(_childaddedEvent), _childaddedEvent.child = null, this;
  }
  /**
   * Searches through the 3D object and its children, starting with the 3D object
   * itself, and returns the first with a matching ID.
   *
   * @param {number} id - The id.
   * @return {Object3D|undefined} The found 3D object. Returns `undefined` if no 3D object has been found.
   */
  getObjectById(id) {
    return this.getObjectByProperty("id", id);
  }
  /**
   * Searches through the 3D object and its children, starting with the 3D object
   * itself, and returns the first with a matching name.
   *
   * @param {string} name - The name.
   * @return {Object3D|undefined} The found 3D object. Returns `undefined` if no 3D object has been found.
   */
  getObjectByName(name) {
    return this.getObjectByProperty("name", name);
  }
  /**
   * Searches through the 3D object and its children, starting with the 3D object
   * itself, and returns the first with a matching property value.
   *
   * @param {string} name - The name of the property.
   * @param {any} value - The value.
   * @return {Object3D|undefined} The found 3D object. Returns `undefined` if no 3D object has been found.
   */
  getObjectByProperty(name, value) {
    if (this[name] === value) return this;
    for (let i = 0, l = this.children.length; i < l; i++) {
      let object = this.children[i].getObjectByProperty(name, value);
      if (object !== void 0)
        return object;
    }
  }
  /**
   * Searches through the 3D object and its children, starting with the 3D object
   * itself, and returns all 3D objects with a matching property value.
   *
   * @param {string} name - The name of the property.
   * @param {any} value - The value.
   * @param {Array<Object3D>} result - The method stores the result in this array.
   * @return {Array<Object3D>} The found 3D objects.
   */
  getObjectsByProperty(name, value, result = []) {
    this[name] === value && result.push(this);
    let children = this.children;
    for (let i = 0, l = children.length; i < l; i++)
      children[i].getObjectsByProperty(name, value, result);
    return result;
  }
  /**
   * Returns a vector representing the position of the 3D object in world space.
   *
   * @param {Vector3} target - The target vector the result is stored to.
   * @return {Vector3} The 3D object's position in world space.
   */
  getWorldPosition(target) {
    return this.updateWorldMatrix(!0, !1), target.setFromMatrixPosition(this.matrixWorld);
  }
  /**
   * Returns a Quaternion representing the position of the 3D object in world space.
   *
   * @param {Quaternion} target - The target Quaternion the result is stored to.
   * @return {Quaternion} The 3D object's rotation in world space.
   */
  getWorldQuaternion(target) {
    return this.updateWorldMatrix(!0, !1), this.matrixWorld.decompose(_position$3, target, _scale$2), target;
  }
  /**
   * Returns a vector representing the scale of the 3D object in world space.
   *
   * @param {Vector3} target - The target vector the result is stored to.
   * @return {Vector3} The 3D object's scale in world space.
   */
  getWorldScale(target) {
    return this.updateWorldMatrix(!0, !1), this.matrixWorld.decompose(_position$3, _quaternion$2, target), target;
  }
  /**
   * Returns a vector representing the ("look") direction of the 3D object in world space.
   *
   * @param {Vector3} target - The target vector the result is stored to.
   * @return {Vector3} The 3D object's direction in world space.
   */
  getWorldDirection(target) {
    this.updateWorldMatrix(!0, !1);
    let e = this.matrixWorld.elements;
    return target.set(e[8], e[9], e[10]).normalize();
  }
  /**
   * Abstract method to get intersections between a casted ray and this
   * 3D object. Renderable 3D objects such as {@link Mesh}, {@link Line} or {@link Points}
   * implement this method in order to use raycasting.
   *
   * @abstract
   * @param {Raycaster} raycaster - The raycaster.
   * @param {Array<Object>} intersects - An array holding the result of the method.
   */
  raycast() {
  }
  /**
   * Executes the callback on this 3D object and all descendants.
   *
   * Note: Modifying the scene graph inside the callback is discouraged.
   *
   * @param {Function} callback - A callback function that allows to process the current 3D object.
   */
  traverse(callback) {
    callback(this);
    let children = this.children;
    for (let i = 0, l = children.length; i < l; i++)
      children[i].traverse(callback);
  }
  /**
   * Like {@link Object3D#traverse}, but the callback will only be executed for visible 3D objects.
   * Descendants of invisible 3D objects are not traversed.
   *
   * Note: Modifying the scene graph inside the callback is discouraged.
   *
   * @param {Function} callback - A callback function that allows to process the current 3D object.
   */
  traverseVisible(callback) {
    if (this.visible === !1) return;
    callback(this);
    let children = this.children;
    for (let i = 0, l = children.length; i < l; i++)
      children[i].traverseVisible(callback);
  }
  /**
   * Like {@link Object3D#traverse}, but the callback will only be executed for all ancestors.
   *
   * Note: Modifying the scene graph inside the callback is discouraged.
   *
   * @param {Function} callback - A callback function that allows to process the current 3D object.
   */
  traverseAncestors(callback) {
    let parent = this.parent;
    parent !== null && (callback(parent), parent.traverseAncestors(callback));
  }
  /**
   * Updates the transformation matrix in local space by computing it from the current
   * position, rotation and scale values.
   */
  updateMatrix() {
    this.matrix.compose(this.position, this.quaternion, this.scale), this.matrixWorldNeedsUpdate = !0;
  }
  /**
   * Updates the transformation matrix in world space of this 3D objects and its descendants.
   *
   * To ensure correct results, this method also recomputes the 3D object's transformation matrix in
   * local space. The computation of the local and world matrix can be controlled with the
   * {@link Object3D#matrixAutoUpdate} and {@link Object3D#matrixWorldAutoUpdate} flags which are both
   * `true` by default.  Set these flags to `false` if you need more control over the update matrix process.
   *
   * @param {boolean} [force=false] - When set to `true`, a recomputation of world matrices is forced even
   * when {@link Object3D#matrixWorldAutoUpdate} is set to `false`.
   */
  updateMatrixWorld(force) {
    this.matrixAutoUpdate && this.updateMatrix(), (this.matrixWorldNeedsUpdate || force) && (this.matrixWorldAutoUpdate === !0 && (this.parent === null ? this.matrixWorld.copy(this.matrix) : this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)), this.matrixWorldNeedsUpdate = !1, force = !0);
    let children = this.children;
    for (let i = 0, l = children.length; i < l; i++)
      children[i].updateMatrixWorld(force);
  }
  /**
   * An alternative version of {@link Object3D#updateMatrixWorld} with more control over the
   * update of ancestor and descendant nodes.
   *
   * @param {boolean} [updateParents=false] Whether ancestor nodes should be updated or not.
   * @param {boolean} [updateChildren=false] Whether descendant nodes should be updated or not.
   */
  updateWorldMatrix(updateParents, updateChildren) {
    let parent = this.parent;
    if (updateParents === !0 && parent !== null && parent.updateWorldMatrix(!0, !1), this.matrixAutoUpdate && this.updateMatrix(), this.matrixWorldAutoUpdate === !0 && (this.parent === null ? this.matrixWorld.copy(this.matrix) : this.matrixWorld.multiplyMatrices(this.parent.matrixWorld, this.matrix)), updateChildren === !0) {
      let children = this.children;
      for (let i = 0, l = children.length; i < l; i++)
        children[i].updateWorldMatrix(!1, !0);
    }
  }
  /**
   * Serializes the 3D object into JSON.
   *
   * @param {?(Object|string)} meta - An optional value holding meta information about the serialization.
   * @return {Object} A JSON object representing the serialized 3D object.
   * @see {@link ObjectLoader#parse}
   */
  toJSON(meta) {
    let isRootObject = meta === void 0 || typeof meta == "string", output = {};
    isRootObject && (meta = {
      geometries: {},
      materials: {},
      textures: {},
      images: {},
      shapes: {},
      skeletons: {},
      animations: {},
      nodes: {}
    }, output.metadata = {
      version: 4.7,
      type: "Object",
      generator: "Object3D.toJSON"
    });
    let object = {};
    object.uuid = this.uuid, object.type = this.type, this.name !== "" && (object.name = this.name), this.castShadow === !0 && (object.castShadow = !0), this.receiveShadow === !0 && (object.receiveShadow = !0), this.visible === !1 && (object.visible = !1), this.frustumCulled === !1 && (object.frustumCulled = !1), this.renderOrder !== 0 && (object.renderOrder = this.renderOrder), Object.keys(this.userData).length > 0 && (object.userData = this.userData), object.layers = this.layers.mask, object.matrix = this.matrix.toArray(), object.up = this.up.toArray(), this.matrixAutoUpdate === !1 && (object.matrixAutoUpdate = !1), this.isInstancedMesh && (object.type = "InstancedMesh", object.count = this.count, object.instanceMatrix = this.instanceMatrix.toJSON(), this.instanceColor !== null && (object.instanceColor = this.instanceColor.toJSON())), this.isBatchedMesh && (object.type = "BatchedMesh", object.perObjectFrustumCulled = this.perObjectFrustumCulled, object.sortObjects = this.sortObjects, object.drawRanges = this._drawRanges, object.reservedRanges = this._reservedRanges, object.geometryInfo = this._geometryInfo.map((info) => ({
      ...info,
      boundingBox: info.boundingBox ? info.boundingBox.toJSON() : void 0,
      boundingSphere: info.boundingSphere ? info.boundingSphere.toJSON() : void 0
    })), object.instanceInfo = this._instanceInfo.map((info) => ({ ...info })), object.availableInstanceIds = this._availableInstanceIds.slice(), object.availableGeometryIds = this._availableGeometryIds.slice(), object.nextIndexStart = this._nextIndexStart, object.nextVertexStart = this._nextVertexStart, object.geometryCount = this._geometryCount, object.maxInstanceCount = this._maxInstanceCount, object.maxVertexCount = this._maxVertexCount, object.maxIndexCount = this._maxIndexCount, object.geometryInitialized = this._geometryInitialized, object.matricesTexture = this._matricesTexture.toJSON(meta), object.indirectTexture = this._indirectTexture.toJSON(meta), this._colorsTexture !== null && (object.colorsTexture = this._colorsTexture.toJSON(meta)), this.boundingSphere !== null && (object.boundingSphere = this.boundingSphere.toJSON()), this.boundingBox !== null && (object.boundingBox = this.boundingBox.toJSON()));
    function serialize(library, element) {
      return library[element.uuid] === void 0 && (library[element.uuid] = element.toJSON(meta)), element.uuid;
    }
    if (this.isScene)
      this.background && (this.background.isColor ? object.background = this.background.toJSON() : this.background.isTexture && (object.background = this.background.toJSON(meta).uuid)), this.environment && this.environment.isTexture && this.environment.isRenderTargetTexture !== !0 && (object.environment = this.environment.toJSON(meta).uuid);
    else if (this.isMesh || this.isLine || this.isPoints) {
      object.geometry = serialize(meta.geometries, this.geometry);
      let parameters = this.geometry.parameters;
      if (parameters !== void 0 && parameters.shapes !== void 0) {
        let shapes = parameters.shapes;
        if (Array.isArray(shapes))
          for (let i = 0, l = shapes.length; i < l; i++) {
            let shape2 = shapes[i];
            serialize(meta.shapes, shape2);
          }
        else
          serialize(meta.shapes, shapes);
      }
    }
    if (this.isSkinnedMesh && (object.bindMode = this.bindMode, object.bindMatrix = this.bindMatrix.toArray(), this.skeleton !== void 0 && (serialize(meta.skeletons, this.skeleton), object.skeleton = this.skeleton.uuid)), this.material !== void 0)
      if (Array.isArray(this.material)) {
        let uuids = [];
        for (let i = 0, l = this.material.length; i < l; i++)
          uuids.push(serialize(meta.materials, this.material[i]));
        object.material = uuids;
      } else
        object.material = serialize(meta.materials, this.material);
    if (this.children.length > 0) {
      object.children = [];
      for (let i = 0; i < this.children.length; i++)
        object.children.push(this.children[i].toJSON(meta).object);
    }
    if (this.animations.length > 0) {
      object.animations = [];
      for (let i = 0; i < this.animations.length; i++) {
        let animation = this.animations[i];
        object.animations.push(serialize(meta.animations, animation));
      }
    }
    if (isRootObject) {
      let geometries = extractFromCache(meta.geometries), materials = extractFromCache(meta.materials), textures = extractFromCache(meta.textures), images = extractFromCache(meta.images), shapes = extractFromCache(meta.shapes), skeletons = extractFromCache(meta.skeletons), animations = extractFromCache(meta.animations), nodes = extractFromCache(meta.nodes);
      geometries.length > 0 && (output.geometries = geometries), materials.length > 0 && (output.materials = materials), textures.length > 0 && (output.textures = textures), images.length > 0 && (output.images = images), shapes.length > 0 && (output.shapes = shapes), skeletons.length > 0 && (output.skeletons = skeletons), animations.length > 0 && (output.animations = animations), nodes.length > 0 && (output.nodes = nodes);
    }
    return output.object = object, output;
    function extractFromCache(cache) {
      let values = [];
      for (let key in cache) {
        let data = cache[key];
        delete data.metadata, values.push(data);
      }
      return values;
    }
  }
  /**
   * Returns a new 3D object with copied values from this instance.
   *
   * @param {boolean} [recursive=true] - When set to `true`, descendants of the 3D object are also cloned.
   * @return {Object3D} A clone of this instance.
   */
  clone(recursive) {
    return new this.constructor().copy(this, recursive);
  }
  /**
   * Copies the values of the given 3D object to this instance.
   *
   * @param {Object3D} source - The 3D object to copy.
   * @param {boolean} [recursive=true] - When set to `true`, descendants of the 3D object are cloned.
   * @return {Object3D} A reference to this instance.
   */
  copy(source, recursive = !0) {
    if (this.name = source.name, this.up.copy(source.up), this.position.copy(source.position), this.rotation.order = source.rotation.order, this.quaternion.copy(source.quaternion), this.scale.copy(source.scale), this.matrix.copy(source.matrix), this.matrixWorld.copy(source.matrixWorld), this.matrixAutoUpdate = source.matrixAutoUpdate, this.matrixWorldAutoUpdate = source.matrixWorldAutoUpdate, this.matrixWorldNeedsUpdate = source.matrixWorldNeedsUpdate, this.layers.mask = source.layers.mask, this.visible = source.visible, this.castShadow = source.castShadow, this.receiveShadow = source.receiveShadow, this.frustumCulled = source.frustumCulled, this.renderOrder = source.renderOrder, this.animations = source.animations.slice(), this.userData = JSON.parse(JSON.stringify(source.userData)), recursive === !0)
      for (let i = 0; i < source.children.length; i++) {
        let child = source.children[i];
        this.add(child.clone());
      }
    return this;
  }
};
Object3D.DEFAULT_UP = /* @__PURE__ */ new Vector3(0, 1, 0);
Object3D.DEFAULT_MATRIX_AUTO_UPDATE = !0;
Object3D.DEFAULT_MATRIX_WORLD_AUTO_UPDATE = !0;
var _colorKeywords = {
  aliceblue: 15792383,
  antiquewhite: 16444375,
  aqua: 65535,
  aquamarine: 8388564,
  azure: 15794175,
  beige: 16119260,
  bisque: 16770244,
  black: 0,
  blanchedalmond: 16772045,
  blue: 255,
  blueviolet: 9055202,
  brown: 10824234,
  burlywood: 14596231,
  cadetblue: 6266528,
  chartreuse: 8388352,
  chocolate: 13789470,
  coral: 16744272,
  cornflowerblue: 6591981,
  cornsilk: 16775388,
  crimson: 14423100,
  cyan: 65535,
  darkblue: 139,
  darkcyan: 35723,
  darkgoldenrod: 12092939,
  darkgray: 11119017,
  darkgreen: 25600,
  darkgrey: 11119017,
  darkkhaki: 12433259,
  darkmagenta: 9109643,
  darkolivegreen: 5597999,
  darkorange: 16747520,
  darkorchid: 10040012,
  darkred: 9109504,
  darksalmon: 15308410,
  darkseagreen: 9419919,
  darkslateblue: 4734347,
  darkslategray: 3100495,
  darkslategrey: 3100495,
  darkturquoise: 52945,
  darkviolet: 9699539,
  deeppink: 16716947,
  deepskyblue: 49151,
  dimgray: 6908265,
  dimgrey: 6908265,
  dodgerblue: 2003199,
  firebrick: 11674146,
  floralwhite: 16775920,
  forestgreen: 2263842,
  fuchsia: 16711935,
  gainsboro: 14474460,
  ghostwhite: 16316671,
  gold: 16766720,
  goldenrod: 14329120,
  gray: 8421504,
  green: 32768,
  greenyellow: 11403055,
  grey: 8421504,
  honeydew: 15794160,
  hotpink: 16738740,
  indianred: 13458524,
  indigo: 4915330,
  ivory: 16777200,
  khaki: 15787660,
  lavender: 15132410,
  lavenderblush: 16773365,
  lawngreen: 8190976,
  lemonchiffon: 16775885,
  lightblue: 11393254,
  lightcoral: 15761536,
  lightcyan: 14745599,
  lightgoldenrodyellow: 16448210,
  lightgray: 13882323,
  lightgreen: 9498256,
  lightgrey: 13882323,
  lightpink: 16758465,
  lightsalmon: 16752762,
  lightseagreen: 2142890,
  lightskyblue: 8900346,
  lightslategray: 7833753,
  lightslategrey: 7833753,
  lightsteelblue: 11584734,
  lightyellow: 16777184,
  lime: 65280,
  limegreen: 3329330,
  linen: 16445670,
  magenta: 16711935,
  maroon: 8388608,
  mediumaquamarine: 6737322,
  mediumblue: 205,
  mediumorchid: 12211667,
  mediumpurple: 9662683,
  mediumseagreen: 3978097,
  mediumslateblue: 8087790,
  mediumspringgreen: 64154,
  mediumturquoise: 4772300,
  mediumvioletred: 13047173,
  midnightblue: 1644912,
  mintcream: 16121850,
  mistyrose: 16770273,
  moccasin: 16770229,
  navajowhite: 16768685,
  navy: 128,
  oldlace: 16643558,
  olive: 8421376,
  olivedrab: 7048739,
  orange: 16753920,
  orangered: 16729344,
  orchid: 14315734,
  palegoldenrod: 15657130,
  palegreen: 10025880,
  paleturquoise: 11529966,
  palevioletred: 14381203,
  papayawhip: 16773077,
  peachpuff: 16767673,
  peru: 13468991,
  pink: 16761035,
  plum: 14524637,
  powderblue: 11591910,
  purple: 8388736,
  rebeccapurple: 6697881,
  red: 16711680,
  rosybrown: 12357519,
  royalblue: 4286945,
  saddlebrown: 9127187,
  salmon: 16416882,
  sandybrown: 16032864,
  seagreen: 3050327,
  seashell: 16774638,
  sienna: 10506797,
  silver: 12632256,
  skyblue: 8900331,
  slateblue: 6970061,
  slategray: 7372944,
  slategrey: 7372944,
  snow: 16775930,
  springgreen: 65407,
  steelblue: 4620980,
  tan: 13808780,
  teal: 32896,
  thistle: 14204888,
  tomato: 16737095,
  turquoise: 4251856,
  violet: 15631086,
  wheat: 16113331,
  white: 16777215,
  whitesmoke: 16119285,
  yellow: 16776960,
  yellowgreen: 10145074
}, _hslA = { h: 0, s: 0, l: 0 }, _hslB = { h: 0, s: 0, l: 0 };
function hue2rgb(p, q, t) {
  return t < 0 && (t += 1), t > 1 && (t -= 1), t < 1 / 6 ? p + (q - p) * 6 * t : t < 1 / 2 ? q : t < 2 / 3 ? p + (q - p) * 6 * (2 / 3 - t) : p;
}
var Color = class {
  /**
   * Constructs a new color.
   *
   * Note that standard method of specifying color in three.js is with a hexadecimal triplet,
   * and that method is used throughout the rest of the documentation.
   *
   * @param {(number|string|Color)} [r] - The red component of the color. If `g` and `b` are
   * not provided, it can be hexadecimal triplet, a CSS-style string or another `Color` instance.
   * @param {number} [g] - The green component.
   * @param {number} [b] - The blue component.
   */
  constructor(r, g, b) {
    return this.isColor = !0, this.r = 1, this.g = 1, this.b = 1, this.set(r, g, b);
  }
  /**
   * Sets the colors's components from the given values.
   *
   * @param {(number|string|Color)} [r] - The red component of the color. If `g` and `b` are
   * not provided, it can be hexadecimal triplet, a CSS-style string or another `Color` instance.
   * @param {number} [g] - The green component.
   * @param {number} [b] - The blue component.
   * @return {Color} A reference to this color.
   */
  set(r, g, b) {
    if (g === void 0 && b === void 0) {
      let value = r;
      value && value.isColor ? this.copy(value) : typeof value == "number" ? this.setHex(value) : typeof value == "string" && this.setStyle(value);
    } else
      this.setRGB(r, g, b);
    return this;
  }
  /**
   * Sets the colors's components to the given scalar value.
   *
   * @param {number} scalar - The scalar value.
   * @return {Color} A reference to this color.
   */
  setScalar(scalar) {
    return this.r = scalar, this.g = scalar, this.b = scalar, this;
  }
  /**
   * Sets this color from a hexadecimal value.
   *
   * @param {number} hex - The hexadecimal value.
   * @param {string} [colorSpace=SRGBColorSpace] - The color space.
   * @return {Color} A reference to this color.
   */
  setHex(hex, colorSpace = SRGBColorSpace) {
    return hex = Math.floor(hex), this.r = (hex >> 16 & 255) / 255, this.g = (hex >> 8 & 255) / 255, this.b = (hex & 255) / 255, ColorManagement.colorSpaceToWorking(this, colorSpace), this;
  }
  /**
   * Sets this color from RGB values.
   *
   * @param {number} r - Red channel value between `0.0` and `1.0`.
   * @param {number} g - Green channel value between `0.0` and `1.0`.
   * @param {number} b - Blue channel value between `0.0` and `1.0`.
   * @param {string} [colorSpace=ColorManagement.workingColorSpace] - The color space.
   * @return {Color} A reference to this color.
   */
  setRGB(r, g, b, colorSpace = ColorManagement.workingColorSpace) {
    return this.r = r, this.g = g, this.b = b, ColorManagement.colorSpaceToWorking(this, colorSpace), this;
  }
  /**
   * Sets this color from RGB values.
   *
   * @param {number} h - Hue value between `0.0` and `1.0`.
   * @param {number} s - Saturation value between `0.0` and `1.0`.
   * @param {number} l - Lightness value between `0.0` and `1.0`.
   * @param {string} [colorSpace=ColorManagement.workingColorSpace] - The color space.
   * @return {Color} A reference to this color.
   */
  setHSL(h, s, l, colorSpace = ColorManagement.workingColorSpace) {
    if (h = euclideanModulo(h, 1), s = clamp(s, 0, 1), l = clamp(l, 0, 1), s === 0)
      this.r = this.g = this.b = l;
    else {
      let p = l <= 0.5 ? l * (1 + s) : l + s - l * s, q = 2 * l - p;
      this.r = hue2rgb(q, p, h + 1 / 3), this.g = hue2rgb(q, p, h), this.b = hue2rgb(q, p, h - 1 / 3);
    }
    return ColorManagement.colorSpaceToWorking(this, colorSpace), this;
  }
  /**
   * Sets this color from a CSS-style string. For example, `rgb(250, 0,0)`,
   * `rgb(100%, 0%, 0%)`, `hsl(0, 100%, 50%)`, `#ff0000`, `#f00`, or `red` ( or
   * any [X11 color name]{@link https://en.wikipedia.org/wiki/X11_color_names#Color_name_chart} -
   * all 140 color names are supported).
   *
   * @param {string} style - Color as a CSS-style string.
   * @param {string} [colorSpace=SRGBColorSpace] - The color space.
   * @return {Color} A reference to this color.
   */
  setStyle(style, colorSpace = SRGBColorSpace) {
    function handleAlpha(string) {
      string !== void 0 && parseFloat(string) < 1 && console.warn("THREE.Color: Alpha component of " + style + " will be ignored.");
    }
    let m;
    if (m = /^(\w+)\(([^\)]*)\)/.exec(style)) {
      let color, name = m[1], components = m[2];
      switch (name) {
        case "rgb":
        case "rgba":
          if (color = /^\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components))
            return handleAlpha(color[4]), this.setRGB(
              Math.min(255, parseInt(color[1], 10)) / 255,
              Math.min(255, parseInt(color[2], 10)) / 255,
              Math.min(255, parseInt(color[3], 10)) / 255,
              colorSpace
            );
          if (color = /^\s*(\d+)\%\s*,\s*(\d+)\%\s*,\s*(\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components))
            return handleAlpha(color[4]), this.setRGB(
              Math.min(100, parseInt(color[1], 10)) / 100,
              Math.min(100, parseInt(color[2], 10)) / 100,
              Math.min(100, parseInt(color[3], 10)) / 100,
              colorSpace
            );
          break;
        case "hsl":
        case "hsla":
          if (color = /^\s*(\d*\.?\d+)\s*,\s*(\d*\.?\d+)\%\s*,\s*(\d*\.?\d+)\%\s*(?:,\s*(\d*\.?\d+)\s*)?$/.exec(components))
            return handleAlpha(color[4]), this.setHSL(
              parseFloat(color[1]) / 360,
              parseFloat(color[2]) / 100,
              parseFloat(color[3]) / 100,
              colorSpace
            );
          break;
        default:
          console.warn("THREE.Color: Unknown color model " + style);
      }
    } else if (m = /^\#([A-Fa-f\d]+)$/.exec(style)) {
      let hex = m[1], size = hex.length;
      if (size === 3)
        return this.setRGB(
          parseInt(hex.charAt(0), 16) / 15,
          parseInt(hex.charAt(1), 16) / 15,
          parseInt(hex.charAt(2), 16) / 15,
          colorSpace
        );
      if (size === 6)
        return this.setHex(parseInt(hex, 16), colorSpace);
      console.warn("THREE.Color: Invalid hex color " + style);
    } else if (style && style.length > 0)
      return this.setColorName(style, colorSpace);
    return this;
  }
  /**
   * Sets this color from a color name. Faster than {@link Color#setStyle} if
   * you don't need the other CSS-style formats.
   *
   * For convenience, the list of names is exposed in `Color.NAMES` as a hash.
   * ```js
   * Color.NAMES.aliceblue // returns 0xF0F8FF
   * ```
   *
   * @param {string} style - The color name.
   * @param {string} [colorSpace=SRGBColorSpace] - The color space.
   * @return {Color} A reference to this color.
   */
  setColorName(style, colorSpace = SRGBColorSpace) {
    let hex = _colorKeywords[style.toLowerCase()];
    return hex !== void 0 ? this.setHex(hex, colorSpace) : console.warn("THREE.Color: Unknown color " + style), this;
  }
  /**
   * Returns a new color with copied values from this instance.
   *
   * @return {Color} A clone of this instance.
   */
  clone() {
    return new this.constructor(this.r, this.g, this.b);
  }
  /**
   * Copies the values of the given color to this instance.
   *
   * @param {Color} color - The color to copy.
   * @return {Color} A reference to this color.
   */
  copy(color) {
    return this.r = color.r, this.g = color.g, this.b = color.b, this;
  }
  /**
   * Copies the given color into this color, and then converts this color from
   * `SRGBColorSpace` to `LinearSRGBColorSpace`.
   *
   * @param {Color} color - The color to copy/convert.
   * @return {Color} A reference to this color.
   */
  copySRGBToLinear(color) {
    return this.r = SRGBToLinear(color.r), this.g = SRGBToLinear(color.g), this.b = SRGBToLinear(color.b), this;
  }
  /**
   * Copies the given color into this color, and then converts this color from
   * `LinearSRGBColorSpace` to `SRGBColorSpace`.
   *
   * @param {Color} color - The color to copy/convert.
   * @return {Color} A reference to this color.
   */
  copyLinearToSRGB(color) {
    return this.r = LinearToSRGB(color.r), this.g = LinearToSRGB(color.g), this.b = LinearToSRGB(color.b), this;
  }
  /**
   * Converts this color from `SRGBColorSpace` to `LinearSRGBColorSpace`.
   *
   * @return {Color} A reference to this color.
   */
  convertSRGBToLinear() {
    return this.copySRGBToLinear(this), this;
  }
  /**
   * Converts this color from `LinearSRGBColorSpace` to `SRGBColorSpace`.
   *
   * @return {Color} A reference to this color.
   */
  convertLinearToSRGB() {
    return this.copyLinearToSRGB(this), this;
  }
  /**
   * Returns the hexadecimal value of this color.
   *
   * @param {string} [colorSpace=SRGBColorSpace] - The color space.
   * @return {number} The hexadecimal value.
   */
  getHex(colorSpace = SRGBColorSpace) {
    return ColorManagement.workingToColorSpace(_color.copy(this), colorSpace), Math.round(clamp(_color.r * 255, 0, 255)) * 65536 + Math.round(clamp(_color.g * 255, 0, 255)) * 256 + Math.round(clamp(_color.b * 255, 0, 255));
  }
  /**
   * Returns the hexadecimal value of this color as a string (for example, 'FFFFFF').
   *
   * @param {string} [colorSpace=SRGBColorSpace] - The color space.
   * @return {string} The hexadecimal value as a string.
   */
  getHexString(colorSpace = SRGBColorSpace) {
    return ("000000" + this.getHex(colorSpace).toString(16)).slice(-6);
  }
  /**
   * Converts the colors RGB values into the HSL format and stores them into the
   * given target object.
   *
   * @param {{h:number,s:number,l:number}} target - The target object that is used to store the method's result.
   * @param {string} [colorSpace=ColorManagement.workingColorSpace] - The color space.
   * @return {{h:number,s:number,l:number}} The HSL representation of this color.
   */
  getHSL(target, colorSpace = ColorManagement.workingColorSpace) {
    ColorManagement.workingToColorSpace(_color.copy(this), colorSpace);
    let r = _color.r, g = _color.g, b = _color.b, max = Math.max(r, g, b), min = Math.min(r, g, b), hue, saturation, lightness = (min + max) / 2;
    if (min === max)
      hue = 0, saturation = 0;
    else {
      let delta = max - min;
      switch (saturation = lightness <= 0.5 ? delta / (max + min) : delta / (2 - max - min), max) {
        case r:
          hue = (g - b) / delta + (g < b ? 6 : 0);
          break;
        case g:
          hue = (b - r) / delta + 2;
          break;
        case b:
          hue = (r - g) / delta + 4;
          break;
      }
      hue /= 6;
    }
    return target.h = hue, target.s = saturation, target.l = lightness, target;
  }
  /**
   * Returns the RGB values of this color and stores them into the given target object.
   *
   * @param {Color} target - The target color that is used to store the method's result.
   * @param {string} [colorSpace=ColorManagement.workingColorSpace] - The color space.
   * @return {Color} The RGB representation of this color.
   */
  getRGB(target, colorSpace = ColorManagement.workingColorSpace) {
    return ColorManagement.workingToColorSpace(_color.copy(this), colorSpace), target.r = _color.r, target.g = _color.g, target.b = _color.b, target;
  }
  /**
   * Returns the value of this color as a CSS style string. Example: `rgb(255,0,0)`.
   *
   * @param {string} [colorSpace=SRGBColorSpace] - The color space.
   * @return {string} The CSS representation of this color.
   */
  getStyle(colorSpace = SRGBColorSpace) {
    ColorManagement.workingToColorSpace(_color.copy(this), colorSpace);
    let r = _color.r, g = _color.g, b = _color.b;
    return colorSpace !== SRGBColorSpace ? `color(${colorSpace} ${r.toFixed(3)} ${g.toFixed(3)} ${b.toFixed(3)})` : `rgb(${Math.round(r * 255)},${Math.round(g * 255)},${Math.round(b * 255)})`;
  }
  /**
   * Adds the given HSL values to this color's values.
   * Internally, this converts the color's RGB values to HSL, adds HSL
   * and then converts the color back to RGB.
   *
   * @param {number} h - Hue value between `0.0` and `1.0`.
   * @param {number} s - Saturation value between `0.0` and `1.0`.
   * @param {number} l - Lightness value between `0.0` and `1.0`.
   * @return {Color} A reference to this color.
   */
  offsetHSL(h, s, l) {
    return this.getHSL(_hslA), this.setHSL(_hslA.h + h, _hslA.s + s, _hslA.l + l);
  }
  /**
   * Adds the RGB values of the given color to the RGB values of this color.
   *
   * @param {Color} color - The color to add.
   * @return {Color} A reference to this color.
   */
  add(color) {
    return this.r += color.r, this.g += color.g, this.b += color.b, this;
  }
  /**
   * Adds the RGB values of the given colors and stores the result in this instance.
   *
   * @param {Color} color1 - The first color.
   * @param {Color} color2 - The second color.
   * @return {Color} A reference to this color.
   */
  addColors(color1, color2) {
    return this.r = color1.r + color2.r, this.g = color1.g + color2.g, this.b = color1.b + color2.b, this;
  }
  /**
   * Adds the given scalar value to the RGB values of this color.
   *
   * @param {number} s - The scalar to add.
   * @return {Color} A reference to this color.
   */
  addScalar(s) {
    return this.r += s, this.g += s, this.b += s, this;
  }
  /**
   * Subtracts the RGB values of the given color from the RGB values of this color.
   *
   * @param {Color} color - The color to subtract.
   * @return {Color} A reference to this color.
   */
  sub(color) {
    return this.r = Math.max(0, this.r - color.r), this.g = Math.max(0, this.g - color.g), this.b = Math.max(0, this.b - color.b), this;
  }
  /**
   * Multiplies the RGB values of the given color with the RGB values of this color.
   *
   * @param {Color} color - The color to multiply.
   * @return {Color} A reference to this color.
   */
  multiply(color) {
    return this.r *= color.r, this.g *= color.g, this.b *= color.b, this;
  }
  /**
   * Multiplies the given scalar value with the RGB values of this color.
   *
   * @param {number} s - The scalar to multiply.
   * @return {Color} A reference to this color.
   */
  multiplyScalar(s) {
    return this.r *= s, this.g *= s, this.b *= s, this;
  }
  /**
   * Linearly interpolates this color's RGB values toward the RGB values of the
   * given color. The alpha argument can be thought of as the ratio between
   * the two colors, where `0.0` is this color and `1.0` is the first argument.
   *
   * @param {Color} color - The color to converge on.
   * @param {number} alpha - The interpolation factor in the closed interval `[0,1]`.
   * @return {Color} A reference to this color.
   */
  lerp(color, alpha) {
    return this.r += (color.r - this.r) * alpha, this.g += (color.g - this.g) * alpha, this.b += (color.b - this.b) * alpha, this;
  }
  /**
   * Linearly interpolates between the given colors and stores the result in this instance.
   * The alpha argument can be thought of as the ratio between the two colors, where `0.0`
   * is the first and `1.0` is the second color.
   *
   * @param {Color} color1 - The first color.
   * @param {Color} color2 - The second color.
   * @param {number} alpha - The interpolation factor in the closed interval `[0,1]`.
   * @return {Color} A reference to this color.
   */
  lerpColors(color1, color2, alpha) {
    return this.r = color1.r + (color2.r - color1.r) * alpha, this.g = color1.g + (color2.g - color1.g) * alpha, this.b = color1.b + (color2.b - color1.b) * alpha, this;
  }
  /**
   * Linearly interpolates this color's HSL values toward the HSL values of the
   * given color. It differs from {@link Color#lerp} by not interpolating straight
   * from one color to the other, but instead going through all the hues in between
   * those two colors. The alpha argument can be thought of as the ratio between
   * the two colors, where 0.0 is this color and 1.0 is the first argument.
   *
   * @param {Color} color - The color to converge on.
   * @param {number} alpha - The interpolation factor in the closed interval `[0,1]`.
   * @return {Color} A reference to this color.
   */
  lerpHSL(color, alpha) {
    this.getHSL(_hslA), color.getHSL(_hslB);
    let h = lerp(_hslA.h, _hslB.h, alpha), s = lerp(_hslA.s, _hslB.s, alpha), l = lerp(_hslA.l, _hslB.l, alpha);
    return this.setHSL(h, s, l), this;
  }
  /**
   * Sets the color's RGB components from the given 3D vector.
   *
   * @param {Vector3} v - The vector to set.
   * @return {Color} A reference to this color.
   */
  setFromVector3(v) {
    return this.r = v.x, this.g = v.y, this.b = v.z, this;
  }
  /**
   * Transforms this color with the given 3x3 matrix.
   *
   * @param {Matrix3} m - The matrix.
   * @return {Color} A reference to this color.
   */
  applyMatrix3(m) {
    let r = this.r, g = this.g, b = this.b, e = m.elements;
    return this.r = e[0] * r + e[3] * g + e[6] * b, this.g = e[1] * r + e[4] * g + e[7] * b, this.b = e[2] * r + e[5] * g + e[8] * b, this;
  }
  /**
   * Returns `true` if this color is equal with the given one.
   *
   * @param {Color} c - The color to test for equality.
   * @return {boolean} Whether this bounding color is equal with the given one.
   */
  equals(c) {
    return c.r === this.r && c.g === this.g && c.b === this.b;
  }
  /**
   * Sets this color's RGB components from the given array.
   *
   * @param {Array<number>} array - An array holding the RGB values.
   * @param {number} [offset=0] - The offset into the array.
   * @return {Color} A reference to this color.
   */
  fromArray(array, offset = 0) {
    return this.r = array[offset], this.g = array[offset + 1], this.b = array[offset + 2], this;
  }
  /**
   * Writes the RGB components of this color to the given array. If no array is provided,
   * the method returns a new instance.
   *
   * @param {Array<number>} [array=[]] - The target array holding the color components.
   * @param {number} [offset=0] - Index of the first element in the array.
   * @return {Array<number>} The color components.
   */
  toArray(array = [], offset = 0) {
    return array[offset] = this.r, array[offset + 1] = this.g, array[offset + 2] = this.b, array;
  }
  /**
   * Sets the components of this color from the given buffer attribute.
   *
   * @param {BufferAttribute} attribute - The buffer attribute holding color data.
   * @param {number} index - The index into the attribute.
   * @return {Color} A reference to this color.
   */
  fromBufferAttribute(attribute, index) {
    return this.r = attribute.getX(index), this.g = attribute.getY(index), this.b = attribute.getZ(index), this;
  }
  /**
   * This methods defines the serialization result of this class. Returns the color
   * as a hexadecimal value.
   *
   * @return {number} The hexadecimal value.
   */
  toJSON() {
    return this.getHex();
  }
  *[Symbol.iterator]() {
    yield this.r, yield this.g, yield this.b;
  }
}, _color = /* @__PURE__ */ new Color();
Color.NAMES = _colorKeywords;
function cloneUniforms(src) {
  let dst = {};
  for (let u in src) {
    dst[u] = {};
    for (let p in src[u]) {
      let property = src[u][p];
      property && (property.isColor || property.isMatrix3 || property.isMatrix4 || property.isVector2 || property.isVector3 || property.isVector4 || property.isTexture || property.isQuaternion) ? property.isRenderTargetTexture ? (console.warn("UniformsUtils: Textures of render targets cannot be cloned via cloneUniforms() or mergeUniforms()."), dst[u][p] = null) : dst[u][p] = property.clone() : Array.isArray(property) ? dst[u][p] = property.slice() : dst[u][p] = property;
    }
  }
  return dst;
}
function mergeUniforms(uniforms) {
  let merged = {};
  for (let u = 0; u < uniforms.length; u++) {
    let tmp4 = cloneUniforms(uniforms[u]);
    for (let p in tmp4)
      merged[p] = tmp4[p];
  }
  return merged;
}
var Curve = class {
  /**
   * Constructs a new curve.
   */
  constructor() {
    this.type = "Curve", this.arcLengthDivisions = 200, this.needsUpdate = !1, this.cacheArcLengths = null;
  }
  /**
   * This method returns a vector in 2D or 3D space (depending on the curve definition)
   * for the given interpolation factor.
   *
   * @abstract
   * @param {number} t - A interpolation factor representing a position on the curve. Must be in the range `[0,1]`.
   * @param {(Vector2|Vector3)} [optionalTarget] - The optional target vector the result is written to.
   * @return {(Vector2|Vector3)} The position on the curve. It can be a 2D or 3D vector depending on the curve definition.
   */
  getPoint() {
    console.warn("THREE.Curve: .getPoint() not implemented.");
  }
  /**
   * This method returns a vector in 2D or 3D space (depending on the curve definition)
   * for the given interpolation factor. Unlike {@link Curve#getPoint}, this method honors the length
   * of the curve which equidistant samples.
   *
   * @param {number} u - A interpolation factor representing a position on the curve. Must be in the range `[0,1]`.
   * @param {(Vector2|Vector3)} [optionalTarget] - The optional target vector the result is written to.
   * @return {(Vector2|Vector3)} The position on the curve. It can be a 2D or 3D vector depending on the curve definition.
   */
  getPointAt(u, optionalTarget) {
    let t = this.getUtoTmapping(u);
    return this.getPoint(t, optionalTarget);
  }
  /**
   * This method samples the curve via {@link Curve#getPoint} and returns an array of points representing
   * the curve shape.
   *
   * @param {number} [divisions=5] - The number of divisions.
   * @return {Array<(Vector2|Vector3)>} An array holding the sampled curve values. The number of points is `divisions + 1`.
   */
  getPoints(divisions = 5) {
    let points = [];
    for (let d = 0; d <= divisions; d++)
      points.push(this.getPoint(d / divisions));
    return points;
  }
  // Get sequence of points using getPointAt( u )
  /**
   * This method samples the curve via {@link Curve#getPointAt} and returns an array of points representing
   * the curve shape. Unlike {@link Curve#getPoints}, this method returns equi-spaced points across the entire
   * curve.
   *
   * @param {number} [divisions=5] - The number of divisions.
   * @return {Array<(Vector2|Vector3)>} An array holding the sampled curve values. The number of points is `divisions + 1`.
   */
  getSpacedPoints(divisions = 5) {
    let points = [];
    for (let d = 0; d <= divisions; d++)
      points.push(this.getPointAt(d / divisions));
    return points;
  }
  /**
   * Returns the total arc length of the curve.
   *
   * @return {number} The length of the curve.
   */
  getLength() {
    let lengths = this.getLengths();
    return lengths[lengths.length - 1];
  }
  /**
   * Returns an array of cumulative segment lengths of the curve.
   *
   * @param {number} [divisions=this.arcLengthDivisions] - The number of divisions.
   * @return {Array<number>} An array holding the cumulative segment lengths.
   */
  getLengths(divisions = this.arcLengthDivisions) {
    if (this.cacheArcLengths && this.cacheArcLengths.length === divisions + 1 && !this.needsUpdate)
      return this.cacheArcLengths;
    this.needsUpdate = !1;
    let cache = [], current, last = this.getPoint(0), sum = 0;
    cache.push(0);
    for (let p = 1; p <= divisions; p++)
      current = this.getPoint(p / divisions), sum += current.distanceTo(last), cache.push(sum), last = current;
    return this.cacheArcLengths = cache, cache;
  }
  /**
   * Update the cumulative segment distance cache. The method must be called
   * every time curve parameters are changed. If an updated curve is part of a
   * composed curve like {@link CurvePath}, this method must be called on the
   * composed curve, too.
   */
  updateArcLengths() {
    this.needsUpdate = !0, this.getLengths();
  }
  /**
   * Given an interpolation factor in the range `[0,1]`, this method returns an updated
   * interpolation factor in the same range that can be ued to sample equidistant points
   * from a curve.
   *
   * @param {number} u - The interpolation factor.
   * @param {?number} distance - An optional distance on the curve.
   * @return {number} The updated interpolation factor.
   */
  getUtoTmapping(u, distance = null) {
    let arcLengths = this.getLengths(), i = 0, il = arcLengths.length, targetArcLength;
    distance ? targetArcLength = distance : targetArcLength = u * arcLengths[il - 1];
    let low = 0, high = il - 1, comparison;
    for (; low <= high; )
      if (i = Math.floor(low + (high - low) / 2), comparison = arcLengths[i] - targetArcLength, comparison < 0)
        low = i + 1;
      else if (comparison > 0)
        high = i - 1;
      else {
        high = i;
        break;
      }
    if (i = high, arcLengths[i] === targetArcLength)
      return i / (il - 1);
    let lengthBefore = arcLengths[i], segmentLength = arcLengths[i + 1] - lengthBefore, segmentFraction = (targetArcLength - lengthBefore) / segmentLength;
    return (i + segmentFraction) / (il - 1);
  }
  /**
   * Returns a unit vector tangent for the given interpolation factor.
   * If the derived curve does not implement its tangent derivation,
   * two points a small delta apart will be used to find its gradient
   * which seems to give a reasonable approximation.
   *
   * @param {number} t - The interpolation factor.
   * @param {(Vector2|Vector3)} [optionalTarget] - The optional target vector the result is written to.
   * @return {(Vector2|Vector3)} The tangent vector.
   */
  getTangent(t, optionalTarget) {
    let t1 = t - 1e-4, t2 = t + 1e-4;
    t1 < 0 && (t1 = 0), t2 > 1 && (t2 = 1);
    let pt1 = this.getPoint(t1), pt2 = this.getPoint(t2), tangent = optionalTarget || (pt1.isVector2 ? new Vector2() : new Vector3());
    return tangent.copy(pt2).sub(pt1).normalize(), tangent;
  }
  /**
   * Same as {@link Curve#getTangent} but with equidistant samples.
   *
   * @param {number} u - The interpolation factor.
   * @param {(Vector2|Vector3)} [optionalTarget] - The optional target vector the result is written to.
   * @return {(Vector2|Vector3)} The tangent vector.
   * @see {@link Curve#getPointAt}
   */
  getTangentAt(u, optionalTarget) {
    let t = this.getUtoTmapping(u);
    return this.getTangent(t, optionalTarget);
  }
  /**
   * Generates the Frenet Frames. Requires a curve definition in 3D space. Used
   * in geometries like {@link TubeGeometry} or {@link ExtrudeGeometry}.
   *
   * @param {number} segments - The number of segments.
   * @param {boolean} [closed=false] - Whether the curve is closed or not.
   * @return {{tangents: Array<Vector3>, normals: Array<Vector3>, binormals: Array<Vector3>}} The Frenet Frames.
   */
  computeFrenetFrames(segments, closed = !1) {
    let normal = new Vector3(), tangents = [], normals = [], binormals = [], vec = new Vector3(), mat = new Matrix4();
    for (let i = 0; i <= segments; i++) {
      let u = i / segments;
      tangents[i] = this.getTangentAt(u, new Vector3());
    }
    normals[0] = new Vector3(), binormals[0] = new Vector3();
    let min = Number.MAX_VALUE, tx = Math.abs(tangents[0].x), ty = Math.abs(tangents[0].y), tz = Math.abs(tangents[0].z);
    tx <= min && (min = tx, normal.set(1, 0, 0)), ty <= min && (min = ty, normal.set(0, 1, 0)), tz <= min && normal.set(0, 0, 1), vec.crossVectors(tangents[0], normal).normalize(), normals[0].crossVectors(tangents[0], vec), binormals[0].crossVectors(tangents[0], normals[0]);
    for (let i = 1; i <= segments; i++) {
      if (normals[i] = normals[i - 1].clone(), binormals[i] = binormals[i - 1].clone(), vec.crossVectors(tangents[i - 1], tangents[i]), vec.length() > Number.EPSILON) {
        vec.normalize();
        let theta = Math.acos(clamp(tangents[i - 1].dot(tangents[i]), -1, 1));
        normals[i].applyMatrix4(mat.makeRotationAxis(vec, theta));
      }
      binormals[i].crossVectors(tangents[i], normals[i]);
    }
    if (closed === !0) {
      let theta = Math.acos(clamp(normals[0].dot(normals[segments]), -1, 1));
      theta /= segments, tangents[0].dot(vec.crossVectors(normals[0], normals[segments])) > 0 && (theta = -theta);
      for (let i = 1; i <= segments; i++)
        normals[i].applyMatrix4(mat.makeRotationAxis(tangents[i], theta * i)), binormals[i].crossVectors(tangents[i], normals[i]);
    }
    return {
      tangents,
      normals,
      binormals
    };
  }
  /**
   * Returns a new curve with copied values from this instance.
   *
   * @return {Curve} A clone of this instance.
   */
  clone() {
    return new this.constructor().copy(this);
  }
  /**
   * Copies the values of the given curve to this instance.
   *
   * @param {Curve} source - The curve to copy.
   * @return {Curve} A reference to this curve.
   */
  copy(source) {
    return this.arcLengthDivisions = source.arcLengthDivisions, this;
  }
  /**
   * Serializes the curve into JSON.
   *
   * @return {Object} A JSON object representing the serialized curve.
   * @see {@link ObjectLoader#parse}
   */
  toJSON() {
    let data = {
      metadata: {
        version: 4.7,
        type: "Curve",
        generator: "Curve.toJSON"
      }
    };
    return data.arcLengthDivisions = this.arcLengthDivisions, data.type = this.type, data;
  }
  /**
   * Deserializes the curve from the given JSON.
   *
   * @param {Object} json - The JSON holding the serialized curve.
   * @return {Curve} A reference to this curve.
   */
  fromJSON(json) {
    return this.arcLengthDivisions = json.arcLengthDivisions, this;
  }
};
function CubicPoly() {
  let c0 = 0, c1 = 0, c2 = 0, c3 = 0;
  function init(x0, x1, t0, t1) {
    c0 = x0, c1 = t0, c2 = -3 * x0 + 3 * x1 - 2 * t0 - t1, c3 = 2 * x0 - 2 * x1 + t0 + t1;
  }
  return {
    initCatmullRom: function(x0, x1, x2, x3, tension) {
      init(x1, x2, tension * (x2 - x0), tension * (x3 - x1));
    },
    initNonuniformCatmullRom: function(x0, x1, x2, x3, dt0, dt1, dt2) {
      let t1 = (x1 - x0) / dt0 - (x2 - x0) / (dt0 + dt1) + (x2 - x1) / dt1, t2 = (x2 - x1) / dt1 - (x3 - x1) / (dt1 + dt2) + (x3 - x2) / dt2;
      t1 *= dt1, t2 *= dt1, init(x1, x2, t1, t2);
    },
    calc: function(t) {
      let t2 = t * t, t3 = t2 * t;
      return c0 + c1 * t + c2 * t2 + c3 * t3;
    }
  };
}
var tmp = /* @__PURE__ */ new Vector3(), px = /* @__PURE__ */ new CubicPoly(), py = /* @__PURE__ */ new CubicPoly(), pz = /* @__PURE__ */ new CubicPoly(), CatmullRomCurve3 = class extends Curve {
  /**
   * Constructs a new Catmull-Rom curve.
   *
   * @param {Array<Vector3>} [points] - An array of 3D points defining the curve.
   * @param {boolean} [closed=false] - Whether the curve is closed or not.
   * @param {('centripetal'|'chordal'|'catmullrom')} [curveType='centripetal'] - The curve type.
   * @param {number} [tension=0.5] - Tension of the curve.
   */
  constructor(points = [], closed = !1, curveType = "centripetal", tension = 0.5) {
    super(), this.isCatmullRomCurve3 = !0, this.type = "CatmullRomCurve3", this.points = points, this.closed = closed, this.curveType = curveType, this.tension = tension;
  }
  /**
   * Returns a point on the curve.
   *
   * @param {number} t - A interpolation factor representing a position on the curve. Must be in the range `[0,1]`.
   * @param {Vector3} [optionalTarget] - The optional target vector the result is written to.
   * @return {Vector3} The position on the curve.
   */
  getPoint(t, optionalTarget = new Vector3()) {
    let point = optionalTarget, points = this.points, l = points.length, p = (l - (this.closed ? 0 : 1)) * t, intPoint = Math.floor(p), weight = p - intPoint;
    this.closed ? intPoint += intPoint > 0 ? 0 : (Math.floor(Math.abs(intPoint) / l) + 1) * l : weight === 0 && intPoint === l - 1 && (intPoint = l - 2, weight = 1);
    let p0, p3;
    this.closed || intPoint > 0 ? p0 = points[(intPoint - 1) % l] : (tmp.subVectors(points[0], points[1]).add(points[0]), p0 = tmp);
    let p1 = points[intPoint % l], p2 = points[(intPoint + 1) % l];
    if (this.closed || intPoint + 2 < l ? p3 = points[(intPoint + 2) % l] : (tmp.subVectors(points[l - 1], points[l - 2]).add(points[l - 1]), p3 = tmp), this.curveType === "centripetal" || this.curveType === "chordal") {
      let pow = this.curveType === "chordal" ? 0.5 : 0.25, dt0 = Math.pow(p0.distanceToSquared(p1), pow), dt1 = Math.pow(p1.distanceToSquared(p2), pow), dt2 = Math.pow(p2.distanceToSquared(p3), pow);
      dt1 < 1e-4 && (dt1 = 1), dt0 < 1e-4 && (dt0 = dt1), dt2 < 1e-4 && (dt2 = dt1), px.initNonuniformCatmullRom(p0.x, p1.x, p2.x, p3.x, dt0, dt1, dt2), py.initNonuniformCatmullRom(p0.y, p1.y, p2.y, p3.y, dt0, dt1, dt2), pz.initNonuniformCatmullRom(p0.z, p1.z, p2.z, p3.z, dt0, dt1, dt2);
    } else this.curveType === "catmullrom" && (px.initCatmullRom(p0.x, p1.x, p2.x, p3.x, this.tension), py.initCatmullRom(p0.y, p1.y, p2.y, p3.y, this.tension), pz.initCatmullRom(p0.z, p1.z, p2.z, p3.z, this.tension));
    return point.set(
      px.calc(weight),
      py.calc(weight),
      pz.calc(weight)
    ), point;
  }
  copy(source) {
    super.copy(source), this.points = [];
    for (let i = 0, l = source.points.length; i < l; i++) {
      let point = source.points[i];
      this.points.push(point.clone());
    }
    return this.closed = source.closed, this.curveType = source.curveType, this.tension = source.tension, this;
  }
  toJSON() {
    let data = super.toJSON();
    data.points = [];
    for (let i = 0, l = this.points.length; i < l; i++) {
      let point = this.points[i];
      data.points.push(point.toArray());
    }
    return data.closed = this.closed, data.curveType = this.curveType, data.tension = this.tension, data;
  }
  fromJSON(json) {
    super.fromJSON(json), this.points = [];
    for (let i = 0, l = json.points.length; i < l; i++) {
      let point = json.points[i];
      this.points.push(new Vector3().fromArray(point));
    }
    return this.closed = json.closed, this.curveType = json.curveType, this.tension = json.tension, this;
  }
};
function convertArray(array, type) {
  return !array || array.constructor === type ? array : typeof type.BYTES_PER_ELEMENT == "number" ? new type(array) : Array.prototype.slice.call(array);
}
function isTypedArray(object) {
  return ArrayBuffer.isView(object) && !(object instanceof DataView);
}
var Interpolant = class {
  /**
   * Constructs a new interpolant.
   *
   * @param {TypedArray} parameterPositions - The parameter positions hold the interpolation factors.
   * @param {TypedArray} sampleValues - The sample values.
   * @param {number} sampleSize - The sample size
   * @param {TypedArray} [resultBuffer] - The result buffer.
   */
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    this.parameterPositions = parameterPositions, this._cachedIndex = 0, this.resultBuffer = resultBuffer !== void 0 ? resultBuffer : new sampleValues.constructor(sampleSize), this.sampleValues = sampleValues, this.valueSize = sampleSize, this.settings = null, this.DefaultSettings_ = {};
  }
  /**
   * Evaluate the interpolant at position `t`.
   *
   * @param {number} t - The interpolation factor.
   * @return {TypedArray} The result buffer.
   */
  evaluate(t) {
    let pp = this.parameterPositions, i1 = this._cachedIndex, t1 = pp[i1], t0 = pp[i1 - 1];
    validate_interval: {
      seek: {
        let right;
        linear_scan: {
          forward_scan: if (!(t < t1)) {
            for (let giveUpAt = i1 + 2; ; ) {
              if (t1 === void 0) {
                if (t < t0) break forward_scan;
                return i1 = pp.length, this._cachedIndex = i1, this.copySampleValue_(i1 - 1);
              }
              if (i1 === giveUpAt) break;
              if (t0 = t1, t1 = pp[++i1], t < t1)
                break seek;
            }
            right = pp.length;
            break linear_scan;
          }
          if (!(t >= t0)) {
            let t1global = pp[1];
            t < t1global && (i1 = 2, t0 = t1global);
            for (let giveUpAt = i1 - 2; ; ) {
              if (t0 === void 0)
                return this._cachedIndex = 0, this.copySampleValue_(0);
              if (i1 === giveUpAt) break;
              if (t1 = t0, t0 = pp[--i1 - 1], t >= t0)
                break seek;
            }
            right = i1, i1 = 0;
            break linear_scan;
          }
          break validate_interval;
        }
        for (; i1 < right; ) {
          let mid = i1 + right >>> 1;
          t < pp[mid] ? right = mid : i1 = mid + 1;
        }
        if (t1 = pp[i1], t0 = pp[i1 - 1], t0 === void 0)
          return this._cachedIndex = 0, this.copySampleValue_(0);
        if (t1 === void 0)
          return i1 = pp.length, this._cachedIndex = i1, this.copySampleValue_(i1 - 1);
      }
      this._cachedIndex = i1, this.intervalChanged_(i1, t0, t1);
    }
    return this.interpolate_(i1, t0, t, t1);
  }
  /**
   * Returns the interpolation settings.
   *
   * @return {Object} The interpolation settings.
   */
  getSettings_() {
    return this.settings || this.DefaultSettings_;
  }
  /**
   * Copies a sample value to the result buffer.
   *
   * @param {number} index - An index into the sample value buffer.
   * @return {TypedArray} The result buffer.
   */
  copySampleValue_(index) {
    let result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, offset = index * stride;
    for (let i = 0; i !== stride; ++i)
      result[i] = values[offset + i];
    return result;
  }
  /**
   * Copies a sample value to the result buffer.
   *
   * @abstract
   * @param {number} i1 - An index into the sample value buffer.
   * @param {number} t0 - The previous interpolation factor.
   * @param {number} t - The current interpolation factor.
   * @param {number} t1 - The next interpolation factor.
   * @return {TypedArray} The result buffer.
   */
  interpolate_() {
    throw new Error("call to abstract method");
  }
  /**
   * Optional method that is executed when the interval has changed.
   *
   * @param {number} i1 - An index into the sample value buffer.
   * @param {number} t0 - The previous interpolation factor.
   * @param {number} t - The current interpolation factor.
   */
  intervalChanged_() {
  }
}, CubicInterpolant = class extends Interpolant {
  /**
   * Constructs a new cubic interpolant.
   *
   * @param {TypedArray} parameterPositions - The parameter positions hold the interpolation factors.
   * @param {TypedArray} sampleValues - The sample values.
   * @param {number} sampleSize - The sample size
   * @param {TypedArray} [resultBuffer] - The result buffer.
   */
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer), this._weightPrev = -0, this._offsetPrev = -0, this._weightNext = -0, this._offsetNext = -0, this.DefaultSettings_ = {
      endingStart: ZeroCurvatureEnding,
      endingEnd: ZeroCurvatureEnding
    };
  }
  intervalChanged_(i1, t0, t1) {
    let pp = this.parameterPositions, iPrev = i1 - 2, iNext = i1 + 1, tPrev = pp[iPrev], tNext = pp[iNext];
    if (tPrev === void 0)
      switch (this.getSettings_().endingStart) {
        case ZeroSlopeEnding:
          iPrev = i1, tPrev = 2 * t0 - t1;
          break;
        case WrapAroundEnding:
          iPrev = pp.length - 2, tPrev = t0 + pp[iPrev] - pp[iPrev + 1];
          break;
        default:
          iPrev = i1, tPrev = t1;
      }
    if (tNext === void 0)
      switch (this.getSettings_().endingEnd) {
        case ZeroSlopeEnding:
          iNext = i1, tNext = 2 * t1 - t0;
          break;
        case WrapAroundEnding:
          iNext = 1, tNext = t1 + pp[1] - pp[0];
          break;
        default:
          iNext = i1 - 1, tNext = t0;
      }
    let halfDt = (t1 - t0) * 0.5, stride = this.valueSize;
    this._weightPrev = halfDt / (t0 - tPrev), this._weightNext = halfDt / (tNext - t1), this._offsetPrev = iPrev * stride, this._offsetNext = iNext * stride;
  }
  interpolate_(i1, t0, t, t1) {
    let result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, o1 = i1 * stride, o0 = o1 - stride, oP = this._offsetPrev, oN = this._offsetNext, wP = this._weightPrev, wN = this._weightNext, p = (t - t0) / (t1 - t0), pp = p * p, ppp = pp * p, sP = -wP * ppp + 2 * wP * pp - wP * p, s0 = (1 + wP) * ppp + (-1.5 - 2 * wP) * pp + (-0.5 + wP) * p + 1, s1 = (-1 - wN) * ppp + (1.5 + wN) * pp + 0.5 * p, sN = wN * ppp - wN * pp;
    for (let i = 0; i !== stride; ++i)
      result[i] = sP * values[oP + i] + s0 * values[o0 + i] + s1 * values[o1 + i] + sN * values[oN + i];
    return result;
  }
}, LinearInterpolant = class extends Interpolant {
  /**
   * Constructs a new linear interpolant.
   *
   * @param {TypedArray} parameterPositions - The parameter positions hold the interpolation factors.
   * @param {TypedArray} sampleValues - The sample values.
   * @param {number} sampleSize - The sample size
   * @param {TypedArray} [resultBuffer] - The result buffer.
   */
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
  }
  interpolate_(i1, t0, t, t1) {
    let result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, offset1 = i1 * stride, offset0 = offset1 - stride, weight1 = (t - t0) / (t1 - t0), weight0 = 1 - weight1;
    for (let i = 0; i !== stride; ++i)
      result[i] = values[offset0 + i] * weight0 + values[offset1 + i] * weight1;
    return result;
  }
}, DiscreteInterpolant = class extends Interpolant {
  /**
   * Constructs a new discrete interpolant.
   *
   * @param {TypedArray} parameterPositions - The parameter positions hold the interpolation factors.
   * @param {TypedArray} sampleValues - The sample values.
   * @param {number} sampleSize - The sample size
   * @param {TypedArray} [resultBuffer] - The result buffer.
   */
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
  }
  interpolate_(i1) {
    return this.copySampleValue_(i1 - 1);
  }
}, KeyframeTrack = class {
  /**
   * Constructs a new keyframe track.
   *
   * @param {string} name - The keyframe track's name.
   * @param {Array<number>} times - A list of keyframe times.
   * @param {Array<number|string|boolean>} values - A list of keyframe values.
   * @param {(InterpolateLinear|InterpolateDiscrete|InterpolateSmooth)} [interpolation] - The interpolation type.
   */
  constructor(name, times, values, interpolation) {
    if (name === void 0) throw new Error("THREE.KeyframeTrack: track name is undefined");
    if (times === void 0 || times.length === 0) throw new Error("THREE.KeyframeTrack: no keyframes in track named " + name);
    this.name = name, this.times = convertArray(times, this.TimeBufferType), this.values = convertArray(values, this.ValueBufferType), this.setInterpolation(interpolation || this.DefaultInterpolation);
  }
  /**
   * Converts the keyframe track to JSON.
   *
   * @static
   * @param {KeyframeTrack} track - The keyframe track to serialize.
   * @return {Object} The serialized keyframe track as JSON.
   */
  static toJSON(track) {
    let trackType = track.constructor, json;
    if (trackType.toJSON !== this.toJSON)
      json = trackType.toJSON(track);
    else {
      json = {
        name: track.name,
        times: convertArray(track.times, Array),
        values: convertArray(track.values, Array)
      };
      let interpolation = track.getInterpolation();
      interpolation !== track.DefaultInterpolation && (json.interpolation = interpolation);
    }
    return json.type = track.ValueTypeName, json;
  }
  /**
   * Factory method for creating a new discrete interpolant.
   *
   * @static
   * @param {TypedArray} [result] - The result buffer.
   * @return {DiscreteInterpolant} The new interpolant.
   */
  InterpolantFactoryMethodDiscrete(result) {
    return new DiscreteInterpolant(this.times, this.values, this.getValueSize(), result);
  }
  /**
   * Factory method for creating a new linear interpolant.
   *
   * @static
   * @param {TypedArray} [result] - The result buffer.
   * @return {LinearInterpolant} The new interpolant.
   */
  InterpolantFactoryMethodLinear(result) {
    return new LinearInterpolant(this.times, this.values, this.getValueSize(), result);
  }
  /**
   * Factory method for creating a new smooth interpolant.
   *
   * @static
   * @param {TypedArray} [result] - The result buffer.
   * @return {CubicInterpolant} The new interpolant.
   */
  InterpolantFactoryMethodSmooth(result) {
    return new CubicInterpolant(this.times, this.values, this.getValueSize(), result);
  }
  /**
   * Defines the interpolation factor method for this keyframe track.
   *
   * @param {(InterpolateLinear|InterpolateDiscrete|InterpolateSmooth)} interpolation - The interpolation type.
   * @return {KeyframeTrack} A reference to this keyframe track.
   */
  setInterpolation(interpolation) {
    let factoryMethod;
    switch (interpolation) {
      case InterpolateDiscrete:
        factoryMethod = this.InterpolantFactoryMethodDiscrete;
        break;
      case InterpolateLinear:
        factoryMethod = this.InterpolantFactoryMethodLinear;
        break;
      case InterpolateSmooth:
        factoryMethod = this.InterpolantFactoryMethodSmooth;
        break;
    }
    if (factoryMethod === void 0) {
      let message = "unsupported interpolation for " + this.ValueTypeName + " keyframe track named " + this.name;
      if (this.createInterpolant === void 0)
        if (interpolation !== this.DefaultInterpolation)
          this.setInterpolation(this.DefaultInterpolation);
        else
          throw new Error(message);
      return console.warn("THREE.KeyframeTrack:", message), this;
    }
    return this.createInterpolant = factoryMethod, this;
  }
  /**
   * Returns the current interpolation type.
   *
   * @return {(InterpolateLinear|InterpolateDiscrete|InterpolateSmooth)} The interpolation type.
   */
  getInterpolation() {
    switch (this.createInterpolant) {
      case this.InterpolantFactoryMethodDiscrete:
        return InterpolateDiscrete;
      case this.InterpolantFactoryMethodLinear:
        return InterpolateLinear;
      case this.InterpolantFactoryMethodSmooth:
        return InterpolateSmooth;
    }
  }
  /**
   * Returns the value size.
   *
   * @return {number} The value size.
   */
  getValueSize() {
    return this.values.length / this.times.length;
  }
  /**
   * Moves all keyframes either forward or backward in time.
   *
   * @param {number} timeOffset - The offset to move the time values.
   * @return {KeyframeTrack} A reference to this keyframe track.
   */
  shift(timeOffset) {
    if (timeOffset !== 0) {
      let times = this.times;
      for (let i = 0, n = times.length; i !== n; ++i)
        times[i] += timeOffset;
    }
    return this;
  }
  /**
   * Scale all keyframe times by a factor (useful for frame - seconds conversions).
   *
   * @param {number} timeScale - The time scale.
   * @return {KeyframeTrack} A reference to this keyframe track.
   */
  scale(timeScale) {
    if (timeScale !== 1) {
      let times = this.times;
      for (let i = 0, n = times.length; i !== n; ++i)
        times[i] *= timeScale;
    }
    return this;
  }
  /**
   * Removes keyframes before and after animation without changing any values within the defined time range.
   *
   * Note: The method does not shift around keys to the start of the track time, because for interpolated
   * keys this will change their values
   *
   * @param {number} startTime - The start time.
   * @param {number} endTime - The end time.
   * @return {KeyframeTrack} A reference to this keyframe track.
   */
  trim(startTime, endTime) {
    let times = this.times, nKeys = times.length, from = 0, to = nKeys - 1;
    for (; from !== nKeys && times[from] < startTime; )
      ++from;
    for (; to !== -1 && times[to] > endTime; )
      --to;
    if (++to, from !== 0 || to !== nKeys) {
      from >= to && (to = Math.max(to, 1), from = to - 1);
      let stride = this.getValueSize();
      this.times = times.slice(from, to), this.values = this.values.slice(from * stride, to * stride);
    }
    return this;
  }
  /**
   * Performs minimal validation on the keyframe track. Returns `true` if the values
   * are valid.
   *
   * @return {boolean} Whether the keyframes are valid or not.
   */
  validate() {
    let valid = !0, valueSize = this.getValueSize();
    valueSize - Math.floor(valueSize) !== 0 && (console.error("THREE.KeyframeTrack: Invalid value size in track.", this), valid = !1);
    let times = this.times, values = this.values, nKeys = times.length;
    nKeys === 0 && (console.error("THREE.KeyframeTrack: Track is empty.", this), valid = !1);
    let prevTime = null;
    for (let i = 0; i !== nKeys; i++) {
      let currTime = times[i];
      if (typeof currTime == "number" && isNaN(currTime)) {
        console.error("THREE.KeyframeTrack: Time is not a valid number.", this, i, currTime), valid = !1;
        break;
      }
      if (prevTime !== null && prevTime > currTime) {
        console.error("THREE.KeyframeTrack: Out of order keys.", this, i, currTime, prevTime), valid = !1;
        break;
      }
      prevTime = currTime;
    }
    if (values !== void 0 && isTypedArray(values))
      for (let i = 0, n = values.length; i !== n; ++i) {
        let value = values[i];
        if (isNaN(value)) {
          console.error("THREE.KeyframeTrack: Value is not a valid number.", this, i, value), valid = !1;
          break;
        }
      }
    return valid;
  }
  /**
   * Optimizes this keyframe track by removing equivalent sequential keys (which are
   * common in morph target sequences).
   *
   * @return {AnimationClip} A reference to this animation clip.
   */
  optimize() {
    let times = this.times.slice(), values = this.values.slice(), stride = this.getValueSize(), smoothInterpolation = this.getInterpolation() === InterpolateSmooth, lastIndex = times.length - 1, writeIndex = 1;
    for (let i = 1; i < lastIndex; ++i) {
      let keep = !1, time = times[i], timeNext = times[i + 1];
      if (time !== timeNext && (i !== 1 || time !== times[0]))
        if (smoothInterpolation)
          keep = !0;
        else {
          let offset = i * stride, offsetP = offset - stride, offsetN = offset + stride;
          for (let j = 0; j !== stride; ++j) {
            let value = values[offset + j];
            if (value !== values[offsetP + j] || value !== values[offsetN + j]) {
              keep = !0;
              break;
            }
          }
        }
      if (keep) {
        if (i !== writeIndex) {
          times[writeIndex] = times[i];
          let readOffset = i * stride, writeOffset = writeIndex * stride;
          for (let j = 0; j !== stride; ++j)
            values[writeOffset + j] = values[readOffset + j];
        }
        ++writeIndex;
      }
    }
    if (lastIndex > 0) {
      times[writeIndex] = times[lastIndex];
      for (let readOffset = lastIndex * stride, writeOffset = writeIndex * stride, j = 0; j !== stride; ++j)
        values[writeOffset + j] = values[readOffset + j];
      ++writeIndex;
    }
    return writeIndex !== times.length ? (this.times = times.slice(0, writeIndex), this.values = values.slice(0, writeIndex * stride)) : (this.times = times, this.values = values), this;
  }
  /**
   * Returns a new keyframe track with copied values from this instance.
   *
   * @return {KeyframeTrack} A clone of this instance.
   */
  clone() {
    let times = this.times.slice(), values = this.values.slice(), TypedKeyframeTrack = this.constructor, track = new TypedKeyframeTrack(this.name, times, values);
    return track.createInterpolant = this.createInterpolant, track;
  }
};
KeyframeTrack.prototype.ValueTypeName = "";
KeyframeTrack.prototype.TimeBufferType = Float32Array;
KeyframeTrack.prototype.ValueBufferType = Float32Array;
KeyframeTrack.prototype.DefaultInterpolation = InterpolateLinear;
var BooleanKeyframeTrack = class extends KeyframeTrack {
  /**
   * Constructs a new boolean keyframe track.
   *
   * This keyframe track type has no `interpolation` parameter because the
   * interpolation is always discrete.
   *
   * @param {string} name - The keyframe track's name.
   * @param {Array<number>} times - A list of keyframe times.
   * @param {Array<boolean>} values - A list of keyframe values.
   */
  constructor(name, times, values) {
    super(name, times, values);
  }
};
BooleanKeyframeTrack.prototype.ValueTypeName = "bool";
BooleanKeyframeTrack.prototype.ValueBufferType = Array;
BooleanKeyframeTrack.prototype.DefaultInterpolation = InterpolateDiscrete;
BooleanKeyframeTrack.prototype.InterpolantFactoryMethodLinear = void 0;
BooleanKeyframeTrack.prototype.InterpolantFactoryMethodSmooth = void 0;
var ColorKeyframeTrack = class extends KeyframeTrack {
  /**
   * Constructs a new color keyframe track.
   *
   * @param {string} name - The keyframe track's name.
   * @param {Array<number>} times - A list of keyframe times.
   * @param {Array<number>} values - A list of keyframe values.
   * @param {(InterpolateLinear|InterpolateDiscrete|InterpolateSmooth)} [interpolation] - The interpolation type.
   */
  constructor(name, times, values, interpolation) {
    super(name, times, values, interpolation);
  }
};
ColorKeyframeTrack.prototype.ValueTypeName = "color";
var NumberKeyframeTrack = class extends KeyframeTrack {
  /**
   * Constructs a new number keyframe track.
   *
   * @param {string} name - The keyframe track's name.
   * @param {Array<number>} times - A list of keyframe times.
   * @param {Array<number>} values - A list of keyframe values.
   * @param {(InterpolateLinear|InterpolateDiscrete|InterpolateSmooth)} [interpolation] - The interpolation type.
   */
  constructor(name, times, values, interpolation) {
    super(name, times, values, interpolation);
  }
};
NumberKeyframeTrack.prototype.ValueTypeName = "number";
var QuaternionLinearInterpolant = class extends Interpolant {
  /**
   * Constructs a new SLERP interpolant.
   *
   * @param {TypedArray} parameterPositions - The parameter positions hold the interpolation factors.
   * @param {TypedArray} sampleValues - The sample values.
   * @param {number} sampleSize - The sample size
   * @param {TypedArray} [resultBuffer] - The result buffer.
   */
  constructor(parameterPositions, sampleValues, sampleSize, resultBuffer) {
    super(parameterPositions, sampleValues, sampleSize, resultBuffer);
  }
  interpolate_(i1, t0, t, t1) {
    let result = this.resultBuffer, values = this.sampleValues, stride = this.valueSize, alpha = (t - t0) / (t1 - t0), offset = i1 * stride;
    for (let end = offset + stride; offset !== end; offset += 4)
      Quaternion.slerpFlat(result, 0, values, offset - stride, values, offset, alpha);
    return result;
  }
}, QuaternionKeyframeTrack = class extends KeyframeTrack {
  /**
   * Constructs a new Quaternion keyframe track.
   *
   * @param {string} name - The keyframe track's name.
   * @param {Array<number>} times - A list of keyframe times.
   * @param {Array<number>} values - A list of keyframe values.
   * @param {(InterpolateLinear|InterpolateDiscrete|InterpolateSmooth)} [interpolation] - The interpolation type.
   */
  constructor(name, times, values, interpolation) {
    super(name, times, values, interpolation);
  }
  /**
   * Overwritten so the method returns Quaternion based interpolant.
   *
   * @static
   * @param {TypedArray} [result] - The result buffer.
   * @return {QuaternionLinearInterpolant} The new interpolant.
   */
  InterpolantFactoryMethodLinear(result) {
    return new QuaternionLinearInterpolant(this.times, this.values, this.getValueSize(), result);
  }
};
QuaternionKeyframeTrack.prototype.ValueTypeName = "quaternion";
QuaternionKeyframeTrack.prototype.InterpolantFactoryMethodSmooth = void 0;
var StringKeyframeTrack = class extends KeyframeTrack {
  /**
   * Constructs a new string keyframe track.
   *
   * This keyframe track type has no `interpolation` parameter because the
   * interpolation is always discrete.
   *
   * @param {string} name - The keyframe track's name.
   * @param {Array<number>} times - A list of keyframe times.
   * @param {Array<string>} values - A list of keyframe values.
   */
  constructor(name, times, values) {
    super(name, times, values);
  }
};
StringKeyframeTrack.prototype.ValueTypeName = "string";
StringKeyframeTrack.prototype.ValueBufferType = Array;
StringKeyframeTrack.prototype.DefaultInterpolation = InterpolateDiscrete;
StringKeyframeTrack.prototype.InterpolantFactoryMethodLinear = void 0;
StringKeyframeTrack.prototype.InterpolantFactoryMethodSmooth = void 0;
var VectorKeyframeTrack = class extends KeyframeTrack {
  /**
   * Constructs a new vector keyframe track.
   *
   * @param {string} name - The keyframe track's name.
   * @param {Array<number>} times - A list of keyframe times.
   * @param {Array<number>} values - A list of keyframe values.
   * @param {(InterpolateLinear|InterpolateDiscrete|InterpolateSmooth)} [interpolation] - The interpolation type.
   */
  constructor(name, times, values, interpolation) {
    super(name, times, values, interpolation);
  }
};
VectorKeyframeTrack.prototype.ValueTypeName = "vector";
var LoadingManager = class {
  /**
   * Constructs a new loading manager.
   *
   * @param {Function} [onLoad] - Executes when all items have been loaded.
   * @param {Function} [onProgress] - Executes when single items have been loaded.
   * @param {Function} [onError] - Executes when an error occurs.
   */
  constructor(onLoad, onProgress, onError) {
    let scope = this, isLoading = !1, itemsLoaded = 0, itemsTotal = 0, urlModifier, handlers = [];
    this.onStart = void 0, this.onLoad = onLoad, this.onProgress = onProgress, this.onError = onError, this.abortController = new AbortController(), this.itemStart = function(url) {
      itemsTotal++, isLoading === !1 && scope.onStart !== void 0 && scope.onStart(url, itemsLoaded, itemsTotal), isLoading = !0;
    }, this.itemEnd = function(url) {
      itemsLoaded++, scope.onProgress !== void 0 && scope.onProgress(url, itemsLoaded, itemsTotal), itemsLoaded === itemsTotal && (isLoading = !1, scope.onLoad !== void 0 && scope.onLoad());
    }, this.itemError = function(url) {
      scope.onError !== void 0 && scope.onError(url);
    }, this.resolveURL = function(url) {
      return urlModifier ? urlModifier(url) : url;
    }, this.setURLModifier = function(transform) {
      return urlModifier = transform, this;
    }, this.addHandler = function(regex, loader) {
      return handlers.push(regex, loader), this;
    }, this.removeHandler = function(regex) {
      let index = handlers.indexOf(regex);
      return index !== -1 && handlers.splice(index, 2), this;
    }, this.getHandler = function(file) {
      for (let i = 0, l = handlers.length; i < l; i += 2) {
        let regex = handlers[i], loader = handlers[i + 1];
        if (regex.global && (regex.lastIndex = 0), regex.test(file))
          return loader;
      }
      return null;
    }, this.abort = function() {
      return this.abortController.abort(), this.abortController = new AbortController(), this;
    };
  }
}, DefaultLoadingManager = /* @__PURE__ */ new LoadingManager(), Loader = class {
  /**
   * Constructs a new loader.
   *
   * @param {LoadingManager} [manager] - The loading manager.
   */
  constructor(manager) {
    this.manager = manager !== void 0 ? manager : DefaultLoadingManager, this.crossOrigin = "anonymous", this.withCredentials = !1, this.path = "", this.resourcePath = "", this.requestHeader = {};
  }
  /**
   * This method needs to be implemented by all concrete loaders. It holds the
   * logic for loading assets from the backend.
   *
   * @abstract
   * @param {string} url - The path/URL of the file to be loaded.
   * @param {Function} onLoad - Executed when the loading process has been finished.
   * @param {onProgressCallback} [onProgress] - Executed while the loading is in progress.
   * @param {onErrorCallback} [onError] - Executed when errors occur.
   */
  load() {
  }
  /**
   * A async version of {@link Loader#load}.
   *
   * @param {string} url - The path/URL of the file to be loaded.
   * @param {onProgressCallback} [onProgress] - Executed while the loading is in progress.
   * @return {Promise} A Promise that resolves when the asset has been loaded.
   */
  loadAsync(url, onProgress) {
    let scope = this;
    return new Promise(function(resolve, reject) {
      scope.load(url, resolve, onProgress, reject);
    });
  }
  /**
   * This method needs to be implemented by all concrete loaders. It holds the
   * logic for parsing the asset into three.js entities.
   *
   * @abstract
   * @param {any} data - The data to parse.
   */
  parse() {
  }
  /**
   * Sets the `crossOrigin` String to implement CORS for loading the URL
   * from a different domain that allows CORS.
   *
   * @param {string} crossOrigin - The `crossOrigin` value.
   * @return {Loader} A reference to this instance.
   */
  setCrossOrigin(crossOrigin) {
    return this.crossOrigin = crossOrigin, this;
  }
  /**
   * Whether the XMLHttpRequest uses credentials such as cookies, authorization
   * headers or TLS client certificates, see [XMLHttpRequest.withCredentials]{@link https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest/withCredentials}.
   *
   * Note: This setting has no effect if you are loading files locally or from the same domain.
   *
   * @param {boolean} value - The `withCredentials` value.
   * @return {Loader} A reference to this instance.
   */
  setWithCredentials(value) {
    return this.withCredentials = value, this;
  }
  /**
   * Sets the base path for the asset.
   *
   * @param {string} path - The base path.
   * @return {Loader} A reference to this instance.
   */
  setPath(path2) {
    return this.path = path2, this;
  }
  /**
   * Sets the base path for dependent resources like textures.
   *
   * @param {string} resourcePath - The resource path.
   * @return {Loader} A reference to this instance.
   */
  setResourcePath(resourcePath) {
    return this.resourcePath = resourcePath, this;
  }
  /**
   * Sets the given request header.
   *
   * @param {Object} requestHeader - A [request header]{@link https://developer.mozilla.org/en-US/docs/Glossary/Request_header}
   * for configuring the HTTP request.
   * @return {Loader} A reference to this instance.
   */
  setRequestHeader(requestHeader) {
    return this.requestHeader = requestHeader, this;
  }
  /**
   * This method can be implemented in loaders for aborting ongoing requests.
   *
   * @abstract
   * @return {Loader} A reference to this instance.
   */
  abort() {
    return this;
  }
};
Loader.DEFAULT_MATERIAL_NAME = "__DEFAULT";
var _RESERVED_CHARS_RE = "\\[\\]\\.:\\/", _reservedRe = new RegExp("[" + _RESERVED_CHARS_RE + "]", "g"), _wordChar = "[^" + _RESERVED_CHARS_RE + "]", _wordCharOrDot = "[^" + _RESERVED_CHARS_RE.replace("\\.", "") + "]", _directoryRe = /* @__PURE__ */ /((?:WC+[\/:])*)/.source.replace("WC", _wordChar), _nodeRe = /* @__PURE__ */ /(WCOD+)?/.source.replace("WCOD", _wordCharOrDot), _objectRe = /* @__PURE__ */ /(?:\.(WC+)(?:\[(.+)\])?)?/.source.replace("WC", _wordChar), _propertyRe = /* @__PURE__ */ /\.(WC+)(?:\[(.+)\])?/.source.replace("WC", _wordChar), _trackRe = new RegExp(
  "^" + _directoryRe + _nodeRe + _objectRe + _propertyRe + "$"
), _supportedObjectNames = ["material", "materials", "bones", "map"], Composite = class {
  constructor(targetGroup, path2, optionalParsedPath) {
    let parsedPath = optionalParsedPath || PropertyBinding.parseTrackName(path2);
    this._targetGroup = targetGroup, this._bindings = targetGroup.subscribe_(path2, parsedPath);
  }
  getValue(array, offset) {
    this.bind();
    let firstValidIndex = this._targetGroup.nCachedObjects_, binding = this._bindings[firstValidIndex];
    binding !== void 0 && binding.getValue(array, offset);
  }
  setValue(array, offset) {
    let bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i)
      bindings[i].setValue(array, offset);
  }
  bind() {
    let bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i)
      bindings[i].bind();
  }
  unbind() {
    let bindings = this._bindings;
    for (let i = this._targetGroup.nCachedObjects_, n = bindings.length; i !== n; ++i)
      bindings[i].unbind();
  }
}, PropertyBinding = class _PropertyBinding {
  /**
   * Constructs a new property binding.
   *
   * @param {Object} rootNode - The root node.
   * @param {string} path - The path.
   * @param {?Object} [parsedPath] - The parsed path.
   */
  constructor(rootNode, path2, parsedPath) {
    this.path = path2, this.parsedPath = parsedPath || _PropertyBinding.parseTrackName(path2), this.node = _PropertyBinding.findNode(rootNode, this.parsedPath.nodeName), this.rootNode = rootNode, this.getValue = this._getValue_unbound, this.setValue = this._setValue_unbound;
  }
  /**
   * Factory method for creating a property binding from the given parameters.
   *
   * @static
   * @param {Object} root - The root node.
   * @param {string} path - The path.
   * @param {?Object} [parsedPath] - The parsed path.
   * @return {PropertyBinding|Composite} The created property binding or composite.
   */
  static create(root, path2, parsedPath) {
    return root && root.isAnimationObjectGroup ? new _PropertyBinding.Composite(root, path2, parsedPath) : new _PropertyBinding(root, path2, parsedPath);
  }
  /**
   * Replaces spaces with underscores and removes unsupported characters from
   * node names, to ensure compatibility with parseTrackName().
   *
   * @param {string} name - Node name to be sanitized.
   * @return {string} The sanitized node name.
   */
  static sanitizeNodeName(name) {
    return name.replace(/\s/g, "_").replace(_reservedRe, "");
  }
  /**
   * Parses the given track name (an object path to an animated property) and
   * returns an object with information about the path. Matches strings in the following forms:
   *
   * - nodeName.property
   * - nodeName.property[accessor]
   * - nodeName.material.property[accessor]
   * - uuid.property[accessor]
   * - uuid.objectName[objectIndex].propertyName[propertyIndex]
   * - parentName/nodeName.property
   * - parentName/parentName/nodeName.property[index]
   * - .bone[Armature.DEF_cog].position
   * - scene:helium_balloon_model:helium_balloon_model.position
   *
   * @static
   * @param {string} trackName - The track name to parse.
   * @return {Object} The parsed track name as an object.
   */
  static parseTrackName(trackName) {
    let matches = _trackRe.exec(trackName);
    if (matches === null)
      throw new Error("PropertyBinding: Cannot parse trackName: " + trackName);
    let results = {
      // directoryName: matches[ 1 ], // (tschw) currently unused
      nodeName: matches[2],
      objectName: matches[3],
      objectIndex: matches[4],
      propertyName: matches[5],
      // required
      propertyIndex: matches[6]
    }, lastDot = results.nodeName && results.nodeName.lastIndexOf(".");
    if (lastDot !== void 0 && lastDot !== -1) {
      let objectName = results.nodeName.substring(lastDot + 1);
      _supportedObjectNames.indexOf(objectName) !== -1 && (results.nodeName = results.nodeName.substring(0, lastDot), results.objectName = objectName);
    }
    if (results.propertyName === null || results.propertyName.length === 0)
      throw new Error("PropertyBinding: can not parse propertyName from trackName: " + trackName);
    return results;
  }
  /**
   * Searches for a node in the hierarchy of the given root object by the given
   * node name.
   *
   * @static
   * @param {Object} root - The root object.
   * @param {string|number} nodeName - The name of the node.
   * @return {?Object} The found node. Returns `null` if no object was found.
   */
  static findNode(root, nodeName) {
    if (nodeName === void 0 || nodeName === "" || nodeName === "." || nodeName === -1 || nodeName === root.name || nodeName === root.uuid)
      return root;
    if (root.skeleton) {
      let bone = root.skeleton.getBoneByName(nodeName);
      if (bone !== void 0)
        return bone;
    }
    if (root.children) {
      let searchNodeSubtree = function(children) {
        for (let i = 0; i < children.length; i++) {
          let childNode = children[i];
          if (childNode.name === nodeName || childNode.uuid === nodeName)
            return childNode;
          let result = searchNodeSubtree(childNode.children);
          if (result) return result;
        }
        return null;
      }, subTreeNode = searchNodeSubtree(root.children);
      if (subTreeNode)
        return subTreeNode;
    }
    return null;
  }
  // these are used to "bind" a nonexistent property
  _getValue_unavailable() {
  }
  _setValue_unavailable() {
  }
  // Getters
  _getValue_direct(buffer, offset) {
    buffer[offset] = this.targetObject[this.propertyName];
  }
  _getValue_array(buffer, offset) {
    let source = this.resolvedProperty;
    for (let i = 0, n = source.length; i !== n; ++i)
      buffer[offset++] = source[i];
  }
  _getValue_arrayElement(buffer, offset) {
    buffer[offset] = this.resolvedProperty[this.propertyIndex];
  }
  _getValue_toArray(buffer, offset) {
    this.resolvedProperty.toArray(buffer, offset);
  }
  // Direct
  _setValue_direct(buffer, offset) {
    this.targetObject[this.propertyName] = buffer[offset];
  }
  _setValue_direct_setNeedsUpdate(buffer, offset) {
    this.targetObject[this.propertyName] = buffer[offset], this.targetObject.needsUpdate = !0;
  }
  _setValue_direct_setMatrixWorldNeedsUpdate(buffer, offset) {
    this.targetObject[this.propertyName] = buffer[offset], this.targetObject.matrixWorldNeedsUpdate = !0;
  }
  // EntireArray
  _setValue_array(buffer, offset) {
    let dest = this.resolvedProperty;
    for (let i = 0, n = dest.length; i !== n; ++i)
      dest[i] = buffer[offset++];
  }
  _setValue_array_setNeedsUpdate(buffer, offset) {
    let dest = this.resolvedProperty;
    for (let i = 0, n = dest.length; i !== n; ++i)
      dest[i] = buffer[offset++];
    this.targetObject.needsUpdate = !0;
  }
  _setValue_array_setMatrixWorldNeedsUpdate(buffer, offset) {
    let dest = this.resolvedProperty;
    for (let i = 0, n = dest.length; i !== n; ++i)
      dest[i] = buffer[offset++];
    this.targetObject.matrixWorldNeedsUpdate = !0;
  }
  // ArrayElement
  _setValue_arrayElement(buffer, offset) {
    this.resolvedProperty[this.propertyIndex] = buffer[offset];
  }
  _setValue_arrayElement_setNeedsUpdate(buffer, offset) {
    this.resolvedProperty[this.propertyIndex] = buffer[offset], this.targetObject.needsUpdate = !0;
  }
  _setValue_arrayElement_setMatrixWorldNeedsUpdate(buffer, offset) {
    this.resolvedProperty[this.propertyIndex] = buffer[offset], this.targetObject.matrixWorldNeedsUpdate = !0;
  }
  // HasToFromArray
  _setValue_fromArray(buffer, offset) {
    this.resolvedProperty.fromArray(buffer, offset);
  }
  _setValue_fromArray_setNeedsUpdate(buffer, offset) {
    this.resolvedProperty.fromArray(buffer, offset), this.targetObject.needsUpdate = !0;
  }
  _setValue_fromArray_setMatrixWorldNeedsUpdate(buffer, offset) {
    this.resolvedProperty.fromArray(buffer, offset), this.targetObject.matrixWorldNeedsUpdate = !0;
  }
  _getValue_unbound(targetArray, offset) {
    this.bind(), this.getValue(targetArray, offset);
  }
  _setValue_unbound(sourceArray, offset) {
    this.bind(), this.setValue(sourceArray, offset);
  }
  /**
   * Creates a getter / setter pair for the property tracked by this binding.
   */
  bind() {
    let targetObject = this.node, parsedPath = this.parsedPath, objectName = parsedPath.objectName, propertyName = parsedPath.propertyName, propertyIndex = parsedPath.propertyIndex;
    if (targetObject || (targetObject = _PropertyBinding.findNode(this.rootNode, parsedPath.nodeName), this.node = targetObject), this.getValue = this._getValue_unavailable, this.setValue = this._setValue_unavailable, !targetObject) {
      console.warn("THREE.PropertyBinding: No target node found for track: " + this.path + ".");
      return;
    }
    if (objectName) {
      let objectIndex = parsedPath.objectIndex;
      switch (objectName) {
        case "materials":
          if (!targetObject.material) {
            console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.", this);
            return;
          }
          if (!targetObject.material.materials) {
            console.error("THREE.PropertyBinding: Can not bind to material.materials as node.material does not have a materials array.", this);
            return;
          }
          targetObject = targetObject.material.materials;
          break;
        case "bones":
          if (!targetObject.skeleton) {
            console.error("THREE.PropertyBinding: Can not bind to bones as node does not have a skeleton.", this);
            return;
          }
          targetObject = targetObject.skeleton.bones;
          for (let i = 0; i < targetObject.length; i++)
            if (targetObject[i].name === objectIndex) {
              objectIndex = i;
              break;
            }
          break;
        case "map":
          if ("map" in targetObject) {
            targetObject = targetObject.map;
            break;
          }
          if (!targetObject.material) {
            console.error("THREE.PropertyBinding: Can not bind to material as node does not have a material.", this);
            return;
          }
          if (!targetObject.material.map) {
            console.error("THREE.PropertyBinding: Can not bind to material.map as node.material does not have a map.", this);
            return;
          }
          targetObject = targetObject.material.map;
          break;
        default:
          if (targetObject[objectName] === void 0) {
            console.error("THREE.PropertyBinding: Can not bind to objectName of node undefined.", this);
            return;
          }
          targetObject = targetObject[objectName];
      }
      if (objectIndex !== void 0) {
        if (targetObject[objectIndex] === void 0) {
          console.error("THREE.PropertyBinding: Trying to bind to objectIndex of objectName, but is undefined.", this, targetObject);
          return;
        }
        targetObject = targetObject[objectIndex];
      }
    }
    let nodeProperty = targetObject[propertyName];
    if (nodeProperty === void 0) {
      let nodeName = parsedPath.nodeName;
      console.error("THREE.PropertyBinding: Trying to update property for track: " + nodeName + "." + propertyName + " but it wasn't found.", targetObject);
      return;
    }
    let versioning = this.Versioning.None;
    this.targetObject = targetObject, targetObject.isMaterial === !0 ? versioning = this.Versioning.NeedsUpdate : targetObject.isObject3D === !0 && (versioning = this.Versioning.MatrixWorldNeedsUpdate);
    let bindingType = this.BindingType.Direct;
    if (propertyIndex !== void 0) {
      if (propertyName === "morphTargetInfluences") {
        if (!targetObject.geometry) {
          console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.", this);
          return;
        }
        if (!targetObject.geometry.morphAttributes) {
          console.error("THREE.PropertyBinding: Can not bind to morphTargetInfluences because node does not have a geometry.morphAttributes.", this);
          return;
        }
        targetObject.morphTargetDictionary[propertyIndex] !== void 0 && (propertyIndex = targetObject.morphTargetDictionary[propertyIndex]);
      }
      bindingType = this.BindingType.ArrayElement, this.resolvedProperty = nodeProperty, this.propertyIndex = propertyIndex;
    } else nodeProperty.fromArray !== void 0 && nodeProperty.toArray !== void 0 ? (bindingType = this.BindingType.HasFromToArray, this.resolvedProperty = nodeProperty) : Array.isArray(nodeProperty) ? (bindingType = this.BindingType.EntireArray, this.resolvedProperty = nodeProperty) : this.propertyName = propertyName;
    this.getValue = this.GetterByBindingType[bindingType], this.setValue = this.SetterByBindingTypeAndVersioning[bindingType][versioning];
  }
  /**
   * Unbinds the property.
   */
  unbind() {
    this.node = null, this.getValue = this._getValue_unbound, this.setValue = this._setValue_unbound;
  }
};
PropertyBinding.Composite = Composite;
PropertyBinding.prototype.BindingType = {
  Direct: 0,
  EntireArray: 1,
  ArrayElement: 2,
  HasFromToArray: 3
};
PropertyBinding.prototype.Versioning = {
  None: 0,
  NeedsUpdate: 1,
  MatrixWorldNeedsUpdate: 2
};
PropertyBinding.prototype.GetterByBindingType = [
  PropertyBinding.prototype._getValue_direct,
  PropertyBinding.prototype._getValue_array,
  PropertyBinding.prototype._getValue_arrayElement,
  PropertyBinding.prototype._getValue_toArray
];
PropertyBinding.prototype.SetterByBindingTypeAndVersioning = [
  [
    // Direct
    PropertyBinding.prototype._setValue_direct,
    PropertyBinding.prototype._setValue_direct_setNeedsUpdate,
    PropertyBinding.prototype._setValue_direct_setMatrixWorldNeedsUpdate
  ],
  [
    // EntireArray
    PropertyBinding.prototype._setValue_array,
    PropertyBinding.prototype._setValue_array_setNeedsUpdate,
    PropertyBinding.prototype._setValue_array_setMatrixWorldNeedsUpdate
  ],
  [
    // ArrayElement
    PropertyBinding.prototype._setValue_arrayElement,
    PropertyBinding.prototype._setValue_arrayElement_setNeedsUpdate,
    PropertyBinding.prototype._setValue_arrayElement_setMatrixWorldNeedsUpdate
  ],
  [
    // HasToFromArray
    PropertyBinding.prototype._setValue_fromArray,
    PropertyBinding.prototype._setValue_fromArray_setNeedsUpdate,
    PropertyBinding.prototype._setValue_fromArray_setMatrixWorldNeedsUpdate
  ]
];
var _controlInterpolantsResultBuffer = new Float32Array(1);
typeof __THREE_DEVTOOLS__ < "u" && __THREE_DEVTOOLS__.dispatchEvent(new CustomEvent("register", { detail: {
  revision: "180"
} }));
typeof window < "u" && (window.__THREE__ ? console.warn("WARNING: Multiple instances of Three.js being imported.") : window.__THREE__ = "180");

// node_modules/.pnpm/three@0.180.0/node_modules/three/build/three.module.js
var alphahash_fragment = `#ifdef USE_ALPHAHASH
	if ( diffuseColor.a < getAlphaHashThreshold( vPosition ) ) discard;
#endif`, alphahash_pars_fragment = `#ifdef USE_ALPHAHASH
	const float ALPHA_HASH_SCALE = 0.05;
	float hash2D( vec2 value ) {
		return fract( 1.0e4 * sin( 17.0 * value.x + 0.1 * value.y ) * ( 0.1 + abs( sin( 13.0 * value.y + value.x ) ) ) );
	}
	float hash3D( vec3 value ) {
		return hash2D( vec2( hash2D( value.xy ), value.z ) );
	}
	float getAlphaHashThreshold( vec3 position ) {
		float maxDeriv = max(
			length( dFdx( position.xyz ) ),
			length( dFdy( position.xyz ) )
		);
		float pixScale = 1.0 / ( ALPHA_HASH_SCALE * maxDeriv );
		vec2 pixScales = vec2(
			exp2( floor( log2( pixScale ) ) ),
			exp2( ceil( log2( pixScale ) ) )
		);
		vec2 alpha = vec2(
			hash3D( floor( pixScales.x * position.xyz ) ),
			hash3D( floor( pixScales.y * position.xyz ) )
		);
		float lerpFactor = fract( log2( pixScale ) );
		float x = ( 1.0 - lerpFactor ) * alpha.x + lerpFactor * alpha.y;
		float a = min( lerpFactor, 1.0 - lerpFactor );
		vec3 cases = vec3(
			x * x / ( 2.0 * a * ( 1.0 - a ) ),
			( x - 0.5 * a ) / ( 1.0 - a ),
			1.0 - ( ( 1.0 - x ) * ( 1.0 - x ) / ( 2.0 * a * ( 1.0 - a ) ) )
		);
		float threshold = ( x < ( 1.0 - a ) )
			? ( ( x < a ) ? cases.x : cases.y )
			: cases.z;
		return clamp( threshold , 1.0e-6, 1.0 );
	}
#endif`, alphamap_fragment = `#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, vAlphaMapUv ).g;
#endif`, alphamap_pars_fragment = `#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`, alphatest_fragment = `#ifdef USE_ALPHATEST
	#ifdef ALPHA_TO_COVERAGE
	diffuseColor.a = smoothstep( alphaTest, alphaTest + fwidth( diffuseColor.a ), diffuseColor.a );
	if ( diffuseColor.a == 0.0 ) discard;
	#else
	if ( diffuseColor.a < alphaTest ) discard;
	#endif
#endif`, alphatest_pars_fragment = `#ifdef USE_ALPHATEST
	uniform float alphaTest;
#endif`, aomap_fragment = `#ifdef USE_AOMAP
	float ambientOcclusion = ( texture2D( aoMap, vAoMapUv ).r - 1.0 ) * aoMapIntensity + 1.0;
	reflectedLight.indirectDiffuse *= ambientOcclusion;
	#if defined( USE_CLEARCOAT ) 
		clearcoatSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_SHEEN ) 
		sheenSpecularIndirect *= ambientOcclusion;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD )
		float dotNV = saturate( dot( geometryNormal, geometryViewDir ) );
		reflectedLight.indirectSpecular *= computeSpecularOcclusion( dotNV, ambientOcclusion, material.roughness );
	#endif
#endif`, aomap_pars_fragment = `#ifdef USE_AOMAP
	uniform sampler2D aoMap;
	uniform float aoMapIntensity;
#endif`, batching_pars_vertex = `#ifdef USE_BATCHING
	#if ! defined( GL_ANGLE_multi_draw )
	#define gl_DrawID _gl_DrawID
	uniform int _gl_DrawID;
	#endif
	uniform highp sampler2D batchingTexture;
	uniform highp usampler2D batchingIdTexture;
	mat4 getBatchingMatrix( const in float i ) {
		int size = textureSize( batchingTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( batchingTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( batchingTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( batchingTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( batchingTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
	float getIndirectIndex( const in int i ) {
		int size = textureSize( batchingIdTexture, 0 ).x;
		int x = i % size;
		int y = i / size;
		return float( texelFetch( batchingIdTexture, ivec2( x, y ), 0 ).r );
	}
#endif
#ifdef USE_BATCHING_COLOR
	uniform sampler2D batchingColorTexture;
	vec3 getBatchingColor( const in float i ) {
		int size = textureSize( batchingColorTexture, 0 ).x;
		int j = int( i );
		int x = j % size;
		int y = j / size;
		return texelFetch( batchingColorTexture, ivec2( x, y ), 0 ).rgb;
	}
#endif`, batching_vertex = `#ifdef USE_BATCHING
	mat4 batchingMatrix = getBatchingMatrix( getIndirectIndex( gl_DrawID ) );
#endif`, begin_vertex = `vec3 transformed = vec3( position );
#ifdef USE_ALPHAHASH
	vPosition = vec3( position );
#endif`, beginnormal_vertex = `vec3 objectNormal = vec3( normal );
#ifdef USE_TANGENT
	vec3 objectTangent = vec3( tangent.xyz );
#endif`, bsdfs = `float G_BlinnPhong_Implicit( ) {
	return 0.25;
}
float D_BlinnPhong( const in float shininess, const in float dotNH ) {
	return RECIPROCAL_PI * ( shininess * 0.5 + 1.0 ) * pow( dotNH, shininess );
}
vec3 BRDF_BlinnPhong( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in vec3 specularColor, const in float shininess ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( specularColor, 1.0, dotVH );
	float G = G_BlinnPhong_Implicit( );
	float D = D_BlinnPhong( shininess, dotNH );
	return F * ( G * D );
} // validated`, iridescence_fragment = `#ifdef USE_IRIDESCENCE
	const mat3 XYZ_TO_REC709 = mat3(
		 3.2404542, -0.9692660,  0.0556434,
		-1.5371385,  1.8760108, -0.2040259,
		-0.4985314,  0.0415560,  1.0572252
	);
	vec3 Fresnel0ToIor( vec3 fresnel0 ) {
		vec3 sqrtF0 = sqrt( fresnel0 );
		return ( vec3( 1.0 ) + sqrtF0 ) / ( vec3( 1.0 ) - sqrtF0 );
	}
	vec3 IorToFresnel0( vec3 transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - vec3( incidentIor ) ) / ( transmittedIor + vec3( incidentIor ) ) );
	}
	float IorToFresnel0( float transmittedIor, float incidentIor ) {
		return pow2( ( transmittedIor - incidentIor ) / ( transmittedIor + incidentIor ));
	}
	vec3 evalSensitivity( float OPD, vec3 shift ) {
		float phase = 2.0 * PI * OPD * 1.0e-9;
		vec3 val = vec3( 5.4856e-13, 4.4201e-13, 5.2481e-13 );
		vec3 pos = vec3( 1.6810e+06, 1.7953e+06, 2.2084e+06 );
		vec3 var = vec3( 4.3278e+09, 9.3046e+09, 6.6121e+09 );
		vec3 xyz = val * sqrt( 2.0 * PI * var ) * cos( pos * phase + shift ) * exp( - pow2( phase ) * var );
		xyz.x += 9.7470e-14 * sqrt( 2.0 * PI * 4.5282e+09 ) * cos( 2.2399e+06 * phase + shift[ 0 ] ) * exp( - 4.5282e+09 * pow2( phase ) );
		xyz /= 1.0685e-7;
		vec3 rgb = XYZ_TO_REC709 * xyz;
		return rgb;
	}
	vec3 evalIridescence( float outsideIOR, float eta2, float cosTheta1, float thinFilmThickness, vec3 baseF0 ) {
		vec3 I;
		float iridescenceIOR = mix( outsideIOR, eta2, smoothstep( 0.0, 0.03, thinFilmThickness ) );
		float sinTheta2Sq = pow2( outsideIOR / iridescenceIOR ) * ( 1.0 - pow2( cosTheta1 ) );
		float cosTheta2Sq = 1.0 - sinTheta2Sq;
		if ( cosTheta2Sq < 0.0 ) {
			return vec3( 1.0 );
		}
		float cosTheta2 = sqrt( cosTheta2Sq );
		float R0 = IorToFresnel0( iridescenceIOR, outsideIOR );
		float R12 = F_Schlick( R0, 1.0, cosTheta1 );
		float T121 = 1.0 - R12;
		float phi12 = 0.0;
		if ( iridescenceIOR < outsideIOR ) phi12 = PI;
		float phi21 = PI - phi12;
		vec3 baseIOR = Fresnel0ToIor( clamp( baseF0, 0.0, 0.9999 ) );		vec3 R1 = IorToFresnel0( baseIOR, iridescenceIOR );
		vec3 R23 = F_Schlick( R1, 1.0, cosTheta2 );
		vec3 phi23 = vec3( 0.0 );
		if ( baseIOR[ 0 ] < iridescenceIOR ) phi23[ 0 ] = PI;
		if ( baseIOR[ 1 ] < iridescenceIOR ) phi23[ 1 ] = PI;
		if ( baseIOR[ 2 ] < iridescenceIOR ) phi23[ 2 ] = PI;
		float OPD = 2.0 * iridescenceIOR * thinFilmThickness * cosTheta2;
		vec3 phi = vec3( phi21 ) + phi23;
		vec3 R123 = clamp( R12 * R23, 1e-5, 0.9999 );
		vec3 r123 = sqrt( R123 );
		vec3 Rs = pow2( T121 ) * R23 / ( vec3( 1.0 ) - R123 );
		vec3 C0 = R12 + Rs;
		I = C0;
		vec3 Cm = Rs - T121;
		for ( int m = 1; m <= 2; ++ m ) {
			Cm *= r123;
			vec3 Sm = 2.0 * evalSensitivity( float( m ) * OPD, float( m ) * phi );
			I += Cm * Sm;
		}
		return max( I, vec3( 0.0 ) );
	}
#endif`, bumpmap_pars_fragment = `#ifdef USE_BUMPMAP
	uniform sampler2D bumpMap;
	uniform float bumpScale;
	vec2 dHdxy_fwd() {
		vec2 dSTdx = dFdx( vBumpMapUv );
		vec2 dSTdy = dFdy( vBumpMapUv );
		float Hll = bumpScale * texture2D( bumpMap, vBumpMapUv ).x;
		float dBx = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdx ).x - Hll;
		float dBy = bumpScale * texture2D( bumpMap, vBumpMapUv + dSTdy ).x - Hll;
		return vec2( dBx, dBy );
	}
	vec3 perturbNormalArb( vec3 surf_pos, vec3 surf_norm, vec2 dHdxy, float faceDirection ) {
		vec3 vSigmaX = normalize( dFdx( surf_pos.xyz ) );
		vec3 vSigmaY = normalize( dFdy( surf_pos.xyz ) );
		vec3 vN = surf_norm;
		vec3 R1 = cross( vSigmaY, vN );
		vec3 R2 = cross( vN, vSigmaX );
		float fDet = dot( vSigmaX, R1 ) * faceDirection;
		vec3 vGrad = sign( fDet ) * ( dHdxy.x * R1 + dHdxy.y * R2 );
		return normalize( abs( fDet ) * surf_norm - vGrad );
	}
#endif`, clipping_planes_fragment = `#if NUM_CLIPPING_PLANES > 0
	vec4 plane;
	#ifdef ALPHA_TO_COVERAGE
		float distanceToPlane, distanceGradient;
		float clipOpacity = 1.0;
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
			distanceGradient = fwidth( distanceToPlane ) / 2.0;
			clipOpacity *= smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			if ( clipOpacity == 0.0 ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			float unionClipOpacity = 1.0;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				distanceToPlane = - dot( vClipPosition, plane.xyz ) + plane.w;
				distanceGradient = fwidth( distanceToPlane ) / 2.0;
				unionClipOpacity *= 1.0 - smoothstep( - distanceGradient, distanceGradient, distanceToPlane );
			}
			#pragma unroll_loop_end
			clipOpacity *= 1.0 - unionClipOpacity;
		#endif
		diffuseColor.a *= clipOpacity;
		if ( diffuseColor.a == 0.0 ) discard;
	#else
		#pragma unroll_loop_start
		for ( int i = 0; i < UNION_CLIPPING_PLANES; i ++ ) {
			plane = clippingPlanes[ i ];
			if ( dot( vClipPosition, plane.xyz ) > plane.w ) discard;
		}
		#pragma unroll_loop_end
		#if UNION_CLIPPING_PLANES < NUM_CLIPPING_PLANES
			bool clipped = true;
			#pragma unroll_loop_start
			for ( int i = UNION_CLIPPING_PLANES; i < NUM_CLIPPING_PLANES; i ++ ) {
				plane = clippingPlanes[ i ];
				clipped = ( dot( vClipPosition, plane.xyz ) > plane.w ) && clipped;
			}
			#pragma unroll_loop_end
			if ( clipped ) discard;
		#endif
	#endif
#endif`, clipping_planes_pars_fragment = `#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
	uniform vec4 clippingPlanes[ NUM_CLIPPING_PLANES ];
#endif`, clipping_planes_pars_vertex = `#if NUM_CLIPPING_PLANES > 0
	varying vec3 vClipPosition;
#endif`, clipping_planes_vertex = `#if NUM_CLIPPING_PLANES > 0
	vClipPosition = - mvPosition.xyz;
#endif`, color_fragment = `#if defined( USE_COLOR_ALPHA )
	diffuseColor *= vColor;
#elif defined( USE_COLOR )
	diffuseColor.rgb *= vColor;
#endif`, color_pars_fragment = `#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR )
	varying vec3 vColor;
#endif`, color_pars_vertex = `#if defined( USE_COLOR_ALPHA )
	varying vec4 vColor;
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	varying vec3 vColor;
#endif`, color_vertex = `#if defined( USE_COLOR_ALPHA )
	vColor = vec4( 1.0 );
#elif defined( USE_COLOR ) || defined( USE_INSTANCING_COLOR ) || defined( USE_BATCHING_COLOR )
	vColor = vec3( 1.0 );
#endif
#ifdef USE_COLOR
	vColor *= color;
#endif
#ifdef USE_INSTANCING_COLOR
	vColor.xyz *= instanceColor.xyz;
#endif
#ifdef USE_BATCHING_COLOR
	vec3 batchingColor = getBatchingColor( getIndirectIndex( gl_DrawID ) );
	vColor.xyz *= batchingColor.xyz;
#endif`, common = `#define PI 3.141592653589793
#define PI2 6.283185307179586
#define PI_HALF 1.5707963267948966
#define RECIPROCAL_PI 0.3183098861837907
#define RECIPROCAL_PI2 0.15915494309189535
#define EPSILON 1e-6
#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
#define whiteComplement( a ) ( 1.0 - saturate( a ) )
float pow2( const in float x ) { return x*x; }
vec3 pow2( const in vec3 x ) { return x*x; }
float pow3( const in float x ) { return x*x*x; }
float pow4( const in float x ) { float x2 = x*x; return x2*x2; }
float max3( const in vec3 v ) { return max( max( v.x, v.y ), v.z ); }
float average( const in vec3 v ) { return dot( v, vec3( 0.3333333 ) ); }
highp float rand( const in vec2 uv ) {
	const highp float a = 12.9898, b = 78.233, c = 43758.5453;
	highp float dt = dot( uv.xy, vec2( a,b ) ), sn = mod( dt, PI );
	return fract( sin( sn ) * c );
}
#ifdef HIGH_PRECISION
	float precisionSafeLength( vec3 v ) { return length( v ); }
#else
	float precisionSafeLength( vec3 v ) {
		float maxComponent = max3( abs( v ) );
		return length( v / maxComponent ) * maxComponent;
	}
#endif
struct IncidentLight {
	vec3 color;
	vec3 direction;
	bool visible;
};
struct ReflectedLight {
	vec3 directDiffuse;
	vec3 directSpecular;
	vec3 indirectDiffuse;
	vec3 indirectSpecular;
};
#ifdef USE_ALPHAHASH
	varying vec3 vPosition;
#endif
vec3 transformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( matrix * vec4( dir, 0.0 ) ).xyz );
}
vec3 inverseTransformDirection( in vec3 dir, in mat4 matrix ) {
	return normalize( ( vec4( dir, 0.0 ) * matrix ).xyz );
}
mat3 transposeMat3( const in mat3 m ) {
	mat3 tmp;
	tmp[ 0 ] = vec3( m[ 0 ].x, m[ 1 ].x, m[ 2 ].x );
	tmp[ 1 ] = vec3( m[ 0 ].y, m[ 1 ].y, m[ 2 ].y );
	tmp[ 2 ] = vec3( m[ 0 ].z, m[ 1 ].z, m[ 2 ].z );
	return tmp;
}
bool isPerspectiveMatrix( mat4 m ) {
	return m[ 2 ][ 3 ] == - 1.0;
}
vec2 equirectUv( in vec3 dir ) {
	float u = atan( dir.z, dir.x ) * RECIPROCAL_PI2 + 0.5;
	float v = asin( clamp( dir.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
	return vec2( u, v );
}
vec3 BRDF_Lambert( const in vec3 diffuseColor ) {
	return RECIPROCAL_PI * diffuseColor;
}
vec3 F_Schlick( const in vec3 f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
}
float F_Schlick( const in float f0, const in float f90, const in float dotVH ) {
	float fresnel = exp2( ( - 5.55473 * dotVH - 6.98316 ) * dotVH );
	return f0 * ( 1.0 - fresnel ) + ( f90 * fresnel );
} // validated`, cube_uv_reflection_fragment = `#ifdef ENVMAP_TYPE_CUBE_UV
	#define cubeUV_minMipLevel 4.0
	#define cubeUV_minTileSize 16.0
	float getFace( vec3 direction ) {
		vec3 absDirection = abs( direction );
		float face = - 1.0;
		if ( absDirection.x > absDirection.z ) {
			if ( absDirection.x > absDirection.y )
				face = direction.x > 0.0 ? 0.0 : 3.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		} else {
			if ( absDirection.z > absDirection.y )
				face = direction.z > 0.0 ? 2.0 : 5.0;
			else
				face = direction.y > 0.0 ? 1.0 : 4.0;
		}
		return face;
	}
	vec2 getUV( vec3 direction, float face ) {
		vec2 uv;
		if ( face == 0.0 ) {
			uv = vec2( direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 1.0 ) {
			uv = vec2( - direction.x, - direction.z ) / abs( direction.y );
		} else if ( face == 2.0 ) {
			uv = vec2( - direction.x, direction.y ) / abs( direction.z );
		} else if ( face == 3.0 ) {
			uv = vec2( - direction.z, direction.y ) / abs( direction.x );
		} else if ( face == 4.0 ) {
			uv = vec2( - direction.x, direction.z ) / abs( direction.y );
		} else {
			uv = vec2( direction.x, direction.y ) / abs( direction.z );
		}
		return 0.5 * ( uv + 1.0 );
	}
	vec3 bilinearCubeUV( sampler2D envMap, vec3 direction, float mipInt ) {
		float face = getFace( direction );
		float filterInt = max( cubeUV_minMipLevel - mipInt, 0.0 );
		mipInt = max( mipInt, cubeUV_minMipLevel );
		float faceSize = exp2( mipInt );
		highp vec2 uv = getUV( direction, face ) * ( faceSize - 2.0 ) + 1.0;
		if ( face > 2.0 ) {
			uv.y += faceSize;
			face -= 3.0;
		}
		uv.x += face * faceSize;
		uv.x += filterInt * 3.0 * cubeUV_minTileSize;
		uv.y += 4.0 * ( exp2( CUBEUV_MAX_MIP ) - faceSize );
		uv.x *= CUBEUV_TEXEL_WIDTH;
		uv.y *= CUBEUV_TEXEL_HEIGHT;
		#ifdef texture2DGradEXT
			return texture2DGradEXT( envMap, uv, vec2( 0.0 ), vec2( 0.0 ) ).rgb;
		#else
			return texture2D( envMap, uv ).rgb;
		#endif
	}
	#define cubeUV_r0 1.0
	#define cubeUV_m0 - 2.0
	#define cubeUV_r1 0.8
	#define cubeUV_m1 - 1.0
	#define cubeUV_r4 0.4
	#define cubeUV_m4 2.0
	#define cubeUV_r5 0.305
	#define cubeUV_m5 3.0
	#define cubeUV_r6 0.21
	#define cubeUV_m6 4.0
	float roughnessToMip( float roughness ) {
		float mip = 0.0;
		if ( roughness >= cubeUV_r1 ) {
			mip = ( cubeUV_r0 - roughness ) * ( cubeUV_m1 - cubeUV_m0 ) / ( cubeUV_r0 - cubeUV_r1 ) + cubeUV_m0;
		} else if ( roughness >= cubeUV_r4 ) {
			mip = ( cubeUV_r1 - roughness ) * ( cubeUV_m4 - cubeUV_m1 ) / ( cubeUV_r1 - cubeUV_r4 ) + cubeUV_m1;
		} else if ( roughness >= cubeUV_r5 ) {
			mip = ( cubeUV_r4 - roughness ) * ( cubeUV_m5 - cubeUV_m4 ) / ( cubeUV_r4 - cubeUV_r5 ) + cubeUV_m4;
		} else if ( roughness >= cubeUV_r6 ) {
			mip = ( cubeUV_r5 - roughness ) * ( cubeUV_m6 - cubeUV_m5 ) / ( cubeUV_r5 - cubeUV_r6 ) + cubeUV_m5;
		} else {
			mip = - 2.0 * log2( 1.16 * roughness );		}
		return mip;
	}
	vec4 textureCubeUV( sampler2D envMap, vec3 sampleDir, float roughness ) {
		float mip = clamp( roughnessToMip( roughness ), cubeUV_m0, CUBEUV_MAX_MIP );
		float mipF = fract( mip );
		float mipInt = floor( mip );
		vec3 color0 = bilinearCubeUV( envMap, sampleDir, mipInt );
		if ( mipF == 0.0 ) {
			return vec4( color0, 1.0 );
		} else {
			vec3 color1 = bilinearCubeUV( envMap, sampleDir, mipInt + 1.0 );
			return vec4( mix( color0, color1, mipF ), 1.0 );
		}
	}
#endif`, defaultnormal_vertex = `vec3 transformedNormal = objectNormal;
#ifdef USE_TANGENT
	vec3 transformedTangent = objectTangent;
#endif
#ifdef USE_BATCHING
	mat3 bm = mat3( batchingMatrix );
	transformedNormal /= vec3( dot( bm[ 0 ], bm[ 0 ] ), dot( bm[ 1 ], bm[ 1 ] ), dot( bm[ 2 ], bm[ 2 ] ) );
	transformedNormal = bm * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = bm * transformedTangent;
	#endif
#endif
#ifdef USE_INSTANCING
	mat3 im = mat3( instanceMatrix );
	transformedNormal /= vec3( dot( im[ 0 ], im[ 0 ] ), dot( im[ 1 ], im[ 1 ] ), dot( im[ 2 ], im[ 2 ] ) );
	transformedNormal = im * transformedNormal;
	#ifdef USE_TANGENT
		transformedTangent = im * transformedTangent;
	#endif
#endif
transformedNormal = normalMatrix * transformedNormal;
#ifdef FLIP_SIDED
	transformedNormal = - transformedNormal;
#endif
#ifdef USE_TANGENT
	transformedTangent = ( modelViewMatrix * vec4( transformedTangent, 0.0 ) ).xyz;
	#ifdef FLIP_SIDED
		transformedTangent = - transformedTangent;
	#endif
#endif`, displacementmap_pars_vertex = `#ifdef USE_DISPLACEMENTMAP
	uniform sampler2D displacementMap;
	uniform float displacementScale;
	uniform float displacementBias;
#endif`, displacementmap_vertex = `#ifdef USE_DISPLACEMENTMAP
	transformed += normalize( objectNormal ) * ( texture2D( displacementMap, vDisplacementMapUv ).x * displacementScale + displacementBias );
#endif`, emissivemap_fragment = `#ifdef USE_EMISSIVEMAP
	vec4 emissiveColor = texture2D( emissiveMap, vEmissiveMapUv );
	#ifdef DECODE_VIDEO_TEXTURE_EMISSIVE
		emissiveColor = sRGBTransferEOTF( emissiveColor );
	#endif
	totalEmissiveRadiance *= emissiveColor.rgb;
#endif`, emissivemap_pars_fragment = `#ifdef USE_EMISSIVEMAP
	uniform sampler2D emissiveMap;
#endif`, colorspace_fragment = "gl_FragColor = linearToOutputTexel( gl_FragColor );", colorspace_pars_fragment = `vec4 LinearTransferOETF( in vec4 value ) {
	return value;
}
vec4 sRGBTransferEOTF( in vec4 value ) {
	return vec4( mix( pow( value.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), value.rgb * 0.0773993808, vec3( lessThanEqual( value.rgb, vec3( 0.04045 ) ) ) ), value.a );
}
vec4 sRGBTransferOETF( in vec4 value ) {
	return vec4( mix( pow( value.rgb, vec3( 0.41666 ) ) * 1.055 - vec3( 0.055 ), value.rgb * 12.92, vec3( lessThanEqual( value.rgb, vec3( 0.0031308 ) ) ) ), value.a );
}`, envmap_fragment = `#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vec3 cameraToFrag;
		if ( isOrthographic ) {
			cameraToFrag = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToFrag = normalize( vWorldPosition - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vec3 reflectVec = reflect( cameraToFrag, worldNormal );
		#else
			vec3 reflectVec = refract( cameraToFrag, worldNormal, refractionRatio );
		#endif
	#else
		vec3 reflectVec = vReflect;
	#endif
	#ifdef ENVMAP_TYPE_CUBE
		vec4 envColor = textureCube( envMap, envMapRotation * vec3( flipEnvMap * reflectVec.x, reflectVec.yz ) );
	#else
		vec4 envColor = vec4( 0.0 );
	#endif
	#ifdef ENVMAP_BLENDING_MULTIPLY
		outgoingLight = mix( outgoingLight, outgoingLight * envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_MIX )
		outgoingLight = mix( outgoingLight, envColor.xyz, specularStrength * reflectivity );
	#elif defined( ENVMAP_BLENDING_ADD )
		outgoingLight += envColor.xyz * specularStrength * reflectivity;
	#endif
#endif`, envmap_common_pars_fragment = `#ifdef USE_ENVMAP
	uniform float envMapIntensity;
	uniform float flipEnvMap;
	uniform mat3 envMapRotation;
	#ifdef ENVMAP_TYPE_CUBE
		uniform samplerCube envMap;
	#else
		uniform sampler2D envMap;
	#endif
	
#endif`, envmap_pars_fragment = `#ifdef USE_ENVMAP
	uniform float reflectivity;
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		varying vec3 vWorldPosition;
		uniform float refractionRatio;
	#else
		varying vec3 vReflect;
	#endif
#endif`, envmap_pars_vertex = `#ifdef USE_ENVMAP
	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( LAMBERT )
		#define ENV_WORLDPOS
	#endif
	#ifdef ENV_WORLDPOS
		
		varying vec3 vWorldPosition;
	#else
		varying vec3 vReflect;
		uniform float refractionRatio;
	#endif
#endif`, envmap_vertex = `#ifdef USE_ENVMAP
	#ifdef ENV_WORLDPOS
		vWorldPosition = worldPosition.xyz;
	#else
		vec3 cameraToVertex;
		if ( isOrthographic ) {
			cameraToVertex = normalize( vec3( - viewMatrix[ 0 ][ 2 ], - viewMatrix[ 1 ][ 2 ], - viewMatrix[ 2 ][ 2 ] ) );
		} else {
			cameraToVertex = normalize( worldPosition.xyz - cameraPosition );
		}
		vec3 worldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
		#ifdef ENVMAP_MODE_REFLECTION
			vReflect = reflect( cameraToVertex, worldNormal );
		#else
			vReflect = refract( cameraToVertex, worldNormal, refractionRatio );
		#endif
	#endif
#endif`, fog_vertex = `#ifdef USE_FOG
	vFogDepth = - mvPosition.z;
#endif`, fog_pars_vertex = `#ifdef USE_FOG
	varying float vFogDepth;
#endif`, fog_fragment = `#ifdef USE_FOG
	#ifdef FOG_EXP2
		float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
	#else
		float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
	#endif
	gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
#endif`, fog_pars_fragment = `#ifdef USE_FOG
	uniform vec3 fogColor;
	varying float vFogDepth;
	#ifdef FOG_EXP2
		uniform float fogDensity;
	#else
		uniform float fogNear;
		uniform float fogFar;
	#endif
#endif`, gradientmap_pars_fragment = `#ifdef USE_GRADIENTMAP
	uniform sampler2D gradientMap;
#endif
vec3 getGradientIrradiance( vec3 normal, vec3 lightDirection ) {
	float dotNL = dot( normal, lightDirection );
	vec2 coord = vec2( dotNL * 0.5 + 0.5, 0.0 );
	#ifdef USE_GRADIENTMAP
		return vec3( texture2D( gradientMap, coord ).r );
	#else
		vec2 fw = fwidth( coord ) * 0.5;
		return mix( vec3( 0.7 ), vec3( 1.0 ), smoothstep( 0.7 - fw.x, 0.7 + fw.x, coord.x ) );
	#endif
}`, lightmap_pars_fragment = `#ifdef USE_LIGHTMAP
	uniform sampler2D lightMap;
	uniform float lightMapIntensity;
#endif`, lights_lambert_fragment = `LambertMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularStrength = specularStrength;`, lights_lambert_pars_fragment = `varying vec3 vViewPosition;
struct LambertMaterial {
	vec3 diffuseColor;
	float specularStrength;
};
void RE_Direct_Lambert( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Lambert( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in LambertMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Lambert
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Lambert`, lights_pars_begin = `uniform bool receiveShadow;
uniform vec3 ambientLightColor;
#if defined( USE_LIGHT_PROBES )
	uniform vec3 lightProbe[ 9 ];
#endif
vec3 shGetIrradianceAt( in vec3 normal, in vec3 shCoefficients[ 9 ] ) {
	float x = normal.x, y = normal.y, z = normal.z;
	vec3 result = shCoefficients[ 0 ] * 0.886227;
	result += shCoefficients[ 1 ] * 2.0 * 0.511664 * y;
	result += shCoefficients[ 2 ] * 2.0 * 0.511664 * z;
	result += shCoefficients[ 3 ] * 2.0 * 0.511664 * x;
	result += shCoefficients[ 4 ] * 2.0 * 0.429043 * x * y;
	result += shCoefficients[ 5 ] * 2.0 * 0.429043 * y * z;
	result += shCoefficients[ 6 ] * ( 0.743125 * z * z - 0.247708 );
	result += shCoefficients[ 7 ] * 2.0 * 0.429043 * x * z;
	result += shCoefficients[ 8 ] * 0.429043 * ( x * x - y * y );
	return result;
}
vec3 getLightProbeIrradiance( const in vec3 lightProbe[ 9 ], const in vec3 normal ) {
	vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
	vec3 irradiance = shGetIrradianceAt( worldNormal, lightProbe );
	return irradiance;
}
vec3 getAmbientLightIrradiance( const in vec3 ambientLightColor ) {
	vec3 irradiance = ambientLightColor;
	return irradiance;
}
float getDistanceAttenuation( const in float lightDistance, const in float cutoffDistance, const in float decayExponent ) {
	float distanceFalloff = 1.0 / max( pow( lightDistance, decayExponent ), 0.01 );
	if ( cutoffDistance > 0.0 ) {
		distanceFalloff *= pow2( saturate( 1.0 - pow4( lightDistance / cutoffDistance ) ) );
	}
	return distanceFalloff;
}
float getSpotAttenuation( const in float coneCosine, const in float penumbraCosine, const in float angleCosine ) {
	return smoothstep( coneCosine, penumbraCosine, angleCosine );
}
#if NUM_DIR_LIGHTS > 0
	struct DirectionalLight {
		vec3 direction;
		vec3 color;
	};
	uniform DirectionalLight directionalLights[ NUM_DIR_LIGHTS ];
	void getDirectionalLightInfo( const in DirectionalLight directionalLight, out IncidentLight light ) {
		light.color = directionalLight.color;
		light.direction = directionalLight.direction;
		light.visible = true;
	}
#endif
#if NUM_POINT_LIGHTS > 0
	struct PointLight {
		vec3 position;
		vec3 color;
		float distance;
		float decay;
	};
	uniform PointLight pointLights[ NUM_POINT_LIGHTS ];
	void getPointLightInfo( const in PointLight pointLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = pointLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float lightDistance = length( lVector );
		light.color = pointLight.color;
		light.color *= getDistanceAttenuation( lightDistance, pointLight.distance, pointLight.decay );
		light.visible = ( light.color != vec3( 0.0 ) );
	}
#endif
#if NUM_SPOT_LIGHTS > 0
	struct SpotLight {
		vec3 position;
		vec3 direction;
		vec3 color;
		float distance;
		float decay;
		float coneCos;
		float penumbraCos;
	};
	uniform SpotLight spotLights[ NUM_SPOT_LIGHTS ];
	void getSpotLightInfo( const in SpotLight spotLight, const in vec3 geometryPosition, out IncidentLight light ) {
		vec3 lVector = spotLight.position - geometryPosition;
		light.direction = normalize( lVector );
		float angleCos = dot( light.direction, spotLight.direction );
		float spotAttenuation = getSpotAttenuation( spotLight.coneCos, spotLight.penumbraCos, angleCos );
		if ( spotAttenuation > 0.0 ) {
			float lightDistance = length( lVector );
			light.color = spotLight.color * spotAttenuation;
			light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );
			light.visible = ( light.color != vec3( 0.0 ) );
		} else {
			light.color = vec3( 0.0 );
			light.visible = false;
		}
	}
#endif
#if NUM_RECT_AREA_LIGHTS > 0
	struct RectAreaLight {
		vec3 color;
		vec3 position;
		vec3 halfWidth;
		vec3 halfHeight;
	};
	uniform sampler2D ltc_1;	uniform sampler2D ltc_2;
	uniform RectAreaLight rectAreaLights[ NUM_RECT_AREA_LIGHTS ];
#endif
#if NUM_HEMI_LIGHTS > 0
	struct HemisphereLight {
		vec3 direction;
		vec3 skyColor;
		vec3 groundColor;
	};
	uniform HemisphereLight hemisphereLights[ NUM_HEMI_LIGHTS ];
	vec3 getHemisphereLightIrradiance( const in HemisphereLight hemiLight, const in vec3 normal ) {
		float dotNL = dot( normal, hemiLight.direction );
		float hemiDiffuseWeight = 0.5 * dotNL + 0.5;
		vec3 irradiance = mix( hemiLight.groundColor, hemiLight.skyColor, hemiDiffuseWeight );
		return irradiance;
	}
#endif`, envmap_physical_pars_fragment = `#ifdef USE_ENVMAP
	vec3 getIBLIrradiance( const in vec3 normal ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 worldNormal = inverseTransformDirection( normal, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * worldNormal, 1.0 );
			return PI * envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	vec3 getIBLRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness ) {
		#ifdef ENVMAP_TYPE_CUBE_UV
			vec3 reflectVec = reflect( - viewDir, normal );
			reflectVec = normalize( mix( reflectVec, normal, roughness * roughness) );
			reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
			vec4 envMapColor = textureCubeUV( envMap, envMapRotation * reflectVec, roughness );
			return envMapColor.rgb * envMapIntensity;
		#else
			return vec3( 0.0 );
		#endif
	}
	#ifdef USE_ANISOTROPY
		vec3 getIBLAnisotropyRadiance( const in vec3 viewDir, const in vec3 normal, const in float roughness, const in vec3 bitangent, const in float anisotropy ) {
			#ifdef ENVMAP_TYPE_CUBE_UV
				vec3 bentNormal = cross( bitangent, viewDir );
				bentNormal = normalize( cross( bentNormal, bitangent ) );
				bentNormal = normalize( mix( bentNormal, normal, pow2( pow2( 1.0 - anisotropy * ( 1.0 - roughness ) ) ) ) );
				return getIBLRadiance( viewDir, bentNormal, roughness );
			#else
				return vec3( 0.0 );
			#endif
		}
	#endif
#endif`, lights_toon_fragment = `ToonMaterial material;
material.diffuseColor = diffuseColor.rgb;`, lights_toon_pars_fragment = `varying vec3 vViewPosition;
struct ToonMaterial {
	vec3 diffuseColor;
};
void RE_Direct_Toon( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	vec3 irradiance = getGradientIrradiance( geometryNormal, directLight.direction ) * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Toon( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in ToonMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_Toon
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Toon`, lights_phong_fragment = `BlinnPhongMaterial material;
material.diffuseColor = diffuseColor.rgb;
material.specularColor = specular;
material.specularShininess = shininess;
material.specularStrength = specularStrength;`, lights_phong_pars_fragment = `varying vec3 vViewPosition;
struct BlinnPhongMaterial {
	vec3 diffuseColor;
	vec3 specularColor;
	float specularShininess;
	float specularStrength;
};
void RE_Direct_BlinnPhong( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
	reflectedLight.directSpecular += irradiance * BRDF_BlinnPhong( directLight.direction, geometryViewDir, geometryNormal, material.specularColor, material.specularShininess ) * material.specularStrength;
}
void RE_IndirectDiffuse_BlinnPhong( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in BlinnPhongMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
#define RE_Direct				RE_Direct_BlinnPhong
#define RE_IndirectDiffuse		RE_IndirectDiffuse_BlinnPhong`, lights_physical_fragment = `PhysicalMaterial material;
material.diffuseColor = diffuseColor.rgb * ( 1.0 - metalnessFactor );
vec3 dxy = max( abs( dFdx( nonPerturbedNormal ) ), abs( dFdy( nonPerturbedNormal ) ) );
float geometryRoughness = max( max( dxy.x, dxy.y ), dxy.z );
material.roughness = max( roughnessFactor, 0.0525 );material.roughness += geometryRoughness;
material.roughness = min( material.roughness, 1.0 );
#ifdef IOR
	material.ior = ior;
	#ifdef USE_SPECULAR
		float specularIntensityFactor = specularIntensity;
		vec3 specularColorFactor = specularColor;
		#ifdef USE_SPECULAR_COLORMAP
			specularColorFactor *= texture2D( specularColorMap, vSpecularColorMapUv ).rgb;
		#endif
		#ifdef USE_SPECULAR_INTENSITYMAP
			specularIntensityFactor *= texture2D( specularIntensityMap, vSpecularIntensityMapUv ).a;
		#endif
		material.specularF90 = mix( specularIntensityFactor, 1.0, metalnessFactor );
	#else
		float specularIntensityFactor = 1.0;
		vec3 specularColorFactor = vec3( 1.0 );
		material.specularF90 = 1.0;
	#endif
	material.specularColor = mix( min( pow2( ( material.ior - 1.0 ) / ( material.ior + 1.0 ) ) * specularColorFactor, vec3( 1.0 ) ) * specularIntensityFactor, diffuseColor.rgb, metalnessFactor );
#else
	material.specularColor = mix( vec3( 0.04 ), diffuseColor.rgb, metalnessFactor );
	material.specularF90 = 1.0;
#endif
#ifdef USE_CLEARCOAT
	material.clearcoat = clearcoat;
	material.clearcoatRoughness = clearcoatRoughness;
	material.clearcoatF0 = vec3( 0.04 );
	material.clearcoatF90 = 1.0;
	#ifdef USE_CLEARCOATMAP
		material.clearcoat *= texture2D( clearcoatMap, vClearcoatMapUv ).x;
	#endif
	#ifdef USE_CLEARCOAT_ROUGHNESSMAP
		material.clearcoatRoughness *= texture2D( clearcoatRoughnessMap, vClearcoatRoughnessMapUv ).y;
	#endif
	material.clearcoat = saturate( material.clearcoat );	material.clearcoatRoughness = max( material.clearcoatRoughness, 0.0525 );
	material.clearcoatRoughness += geometryRoughness;
	material.clearcoatRoughness = min( material.clearcoatRoughness, 1.0 );
#endif
#ifdef USE_DISPERSION
	material.dispersion = dispersion;
#endif
#ifdef USE_IRIDESCENCE
	material.iridescence = iridescence;
	material.iridescenceIOR = iridescenceIOR;
	#ifdef USE_IRIDESCENCEMAP
		material.iridescence *= texture2D( iridescenceMap, vIridescenceMapUv ).r;
	#endif
	#ifdef USE_IRIDESCENCE_THICKNESSMAP
		material.iridescenceThickness = (iridescenceThicknessMaximum - iridescenceThicknessMinimum) * texture2D( iridescenceThicknessMap, vIridescenceThicknessMapUv ).g + iridescenceThicknessMinimum;
	#else
		material.iridescenceThickness = iridescenceThicknessMaximum;
	#endif
#endif
#ifdef USE_SHEEN
	material.sheenColor = sheenColor;
	#ifdef USE_SHEEN_COLORMAP
		material.sheenColor *= texture2D( sheenColorMap, vSheenColorMapUv ).rgb;
	#endif
	material.sheenRoughness = clamp( sheenRoughness, 0.07, 1.0 );
	#ifdef USE_SHEEN_ROUGHNESSMAP
		material.sheenRoughness *= texture2D( sheenRoughnessMap, vSheenRoughnessMapUv ).a;
	#endif
#endif
#ifdef USE_ANISOTROPY
	#ifdef USE_ANISOTROPYMAP
		mat2 anisotropyMat = mat2( anisotropyVector.x, anisotropyVector.y, - anisotropyVector.y, anisotropyVector.x );
		vec3 anisotropyPolar = texture2D( anisotropyMap, vAnisotropyMapUv ).rgb;
		vec2 anisotropyV = anisotropyMat * normalize( 2.0 * anisotropyPolar.rg - vec2( 1.0 ) ) * anisotropyPolar.b;
	#else
		vec2 anisotropyV = anisotropyVector;
	#endif
	material.anisotropy = length( anisotropyV );
	if( material.anisotropy == 0.0 ) {
		anisotropyV = vec2( 1.0, 0.0 );
	} else {
		anisotropyV /= material.anisotropy;
		material.anisotropy = saturate( material.anisotropy );
	}
	material.alphaT = mix( pow2( material.roughness ), 1.0, pow2( material.anisotropy ) );
	material.anisotropyT = tbn[ 0 ] * anisotropyV.x + tbn[ 1 ] * anisotropyV.y;
	material.anisotropyB = tbn[ 1 ] * anisotropyV.x - tbn[ 0 ] * anisotropyV.y;
#endif`, lights_physical_pars_fragment = `struct PhysicalMaterial {
	vec3 diffuseColor;
	float roughness;
	vec3 specularColor;
	float specularF90;
	float dispersion;
	#ifdef USE_CLEARCOAT
		float clearcoat;
		float clearcoatRoughness;
		vec3 clearcoatF0;
		float clearcoatF90;
	#endif
	#ifdef USE_IRIDESCENCE
		float iridescence;
		float iridescenceIOR;
		float iridescenceThickness;
		vec3 iridescenceFresnel;
		vec3 iridescenceF0;
	#endif
	#ifdef USE_SHEEN
		vec3 sheenColor;
		float sheenRoughness;
	#endif
	#ifdef IOR
		float ior;
	#endif
	#ifdef USE_TRANSMISSION
		float transmission;
		float transmissionAlpha;
		float thickness;
		float attenuationDistance;
		vec3 attenuationColor;
	#endif
	#ifdef USE_ANISOTROPY
		float anisotropy;
		float alphaT;
		vec3 anisotropyT;
		vec3 anisotropyB;
	#endif
};
vec3 clearcoatSpecularDirect = vec3( 0.0 );
vec3 clearcoatSpecularIndirect = vec3( 0.0 );
vec3 sheenSpecularDirect = vec3( 0.0 );
vec3 sheenSpecularIndirect = vec3(0.0 );
vec3 Schlick_to_F0( const in vec3 f, const in float f90, const in float dotVH ) {
    float x = clamp( 1.0 - dotVH, 0.0, 1.0 );
    float x2 = x * x;
    float x5 = clamp( x * x2 * x2, 0.0, 0.9999 );
    return ( f - vec3( f90 ) * x5 ) / ( 1.0 - x5 );
}
float V_GGX_SmithCorrelated( const in float alpha, const in float dotNL, const in float dotNV ) {
	float a2 = pow2( alpha );
	float gv = dotNL * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNV ) );
	float gl = dotNV * sqrt( a2 + ( 1.0 - a2 ) * pow2( dotNL ) );
	return 0.5 / max( gv + gl, EPSILON );
}
float D_GGX( const in float alpha, const in float dotNH ) {
	float a2 = pow2( alpha );
	float denom = pow2( dotNH ) * ( a2 - 1.0 ) + 1.0;
	return RECIPROCAL_PI * a2 / pow2( denom );
}
#ifdef USE_ANISOTROPY
	float V_GGX_SmithCorrelated_Anisotropic( const in float alphaT, const in float alphaB, const in float dotTV, const in float dotBV, const in float dotTL, const in float dotBL, const in float dotNV, const in float dotNL ) {
		float gv = dotNL * length( vec3( alphaT * dotTV, alphaB * dotBV, dotNV ) );
		float gl = dotNV * length( vec3( alphaT * dotTL, alphaB * dotBL, dotNL ) );
		float v = 0.5 / ( gv + gl );
		return saturate(v);
	}
	float D_GGX_Anisotropic( const in float alphaT, const in float alphaB, const in float dotNH, const in float dotTH, const in float dotBH ) {
		float a2 = alphaT * alphaB;
		highp vec3 v = vec3( alphaB * dotTH, alphaT * dotBH, a2 * dotNH );
		highp float v2 = dot( v, v );
		float w2 = a2 / v2;
		return RECIPROCAL_PI * a2 * pow2 ( w2 );
	}
#endif
#ifdef USE_CLEARCOAT
	vec3 BRDF_GGX_Clearcoat( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material) {
		vec3 f0 = material.clearcoatF0;
		float f90 = material.clearcoatF90;
		float roughness = material.clearcoatRoughness;
		float alpha = pow2( roughness );
		vec3 halfDir = normalize( lightDir + viewDir );
		float dotNL = saturate( dot( normal, lightDir ) );
		float dotNV = saturate( dot( normal, viewDir ) );
		float dotNH = saturate( dot( normal, halfDir ) );
		float dotVH = saturate( dot( viewDir, halfDir ) );
		vec3 F = F_Schlick( f0, f90, dotVH );
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
		return F * ( V * D );
	}
#endif
vec3 BRDF_GGX( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, const in PhysicalMaterial material ) {
	vec3 f0 = material.specularColor;
	float f90 = material.specularF90;
	float roughness = material.roughness;
	float alpha = pow2( roughness );
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float dotVH = saturate( dot( viewDir, halfDir ) );
	vec3 F = F_Schlick( f0, f90, dotVH );
	#ifdef USE_IRIDESCENCE
		F = mix( F, material.iridescenceFresnel, material.iridescence );
	#endif
	#ifdef USE_ANISOTROPY
		float dotTL = dot( material.anisotropyT, lightDir );
		float dotTV = dot( material.anisotropyT, viewDir );
		float dotTH = dot( material.anisotropyT, halfDir );
		float dotBL = dot( material.anisotropyB, lightDir );
		float dotBV = dot( material.anisotropyB, viewDir );
		float dotBH = dot( material.anisotropyB, halfDir );
		float V = V_GGX_SmithCorrelated_Anisotropic( material.alphaT, alpha, dotTV, dotBV, dotTL, dotBL, dotNV, dotNL );
		float D = D_GGX_Anisotropic( material.alphaT, alpha, dotNH, dotTH, dotBH );
	#else
		float V = V_GGX_SmithCorrelated( alpha, dotNL, dotNV );
		float D = D_GGX( alpha, dotNH );
	#endif
	return F * ( V * D );
}
vec2 LTC_Uv( const in vec3 N, const in vec3 V, const in float roughness ) {
	const float LUT_SIZE = 64.0;
	const float LUT_SCALE = ( LUT_SIZE - 1.0 ) / LUT_SIZE;
	const float LUT_BIAS = 0.5 / LUT_SIZE;
	float dotNV = saturate( dot( N, V ) );
	vec2 uv = vec2( roughness, sqrt( 1.0 - dotNV ) );
	uv = uv * LUT_SCALE + LUT_BIAS;
	return uv;
}
float LTC_ClippedSphereFormFactor( const in vec3 f ) {
	float l = length( f );
	return max( ( l * l + f.z ) / ( l + 1.0 ), 0.0 );
}
vec3 LTC_EdgeVectorFormFactor( const in vec3 v1, const in vec3 v2 ) {
	float x = dot( v1, v2 );
	float y = abs( x );
	float a = 0.8543985 + ( 0.4965155 + 0.0145206 * y ) * y;
	float b = 3.4175940 + ( 4.1616724 + y ) * y;
	float v = a / b;
	float theta_sintheta = ( x > 0.0 ) ? v : 0.5 * inversesqrt( max( 1.0 - x * x, 1e-7 ) ) - v;
	return cross( v1, v2 ) * theta_sintheta;
}
vec3 LTC_Evaluate( const in vec3 N, const in vec3 V, const in vec3 P, const in mat3 mInv, const in vec3 rectCoords[ 4 ] ) {
	vec3 v1 = rectCoords[ 1 ] - rectCoords[ 0 ];
	vec3 v2 = rectCoords[ 3 ] - rectCoords[ 0 ];
	vec3 lightNormal = cross( v1, v2 );
	if( dot( lightNormal, P - rectCoords[ 0 ] ) < 0.0 ) return vec3( 0.0 );
	vec3 T1, T2;
	T1 = normalize( V - N * dot( V, N ) );
	T2 = - cross( N, T1 );
	mat3 mat = mInv * transposeMat3( mat3( T1, T2, N ) );
	vec3 coords[ 4 ];
	coords[ 0 ] = mat * ( rectCoords[ 0 ] - P );
	coords[ 1 ] = mat * ( rectCoords[ 1 ] - P );
	coords[ 2 ] = mat * ( rectCoords[ 2 ] - P );
	coords[ 3 ] = mat * ( rectCoords[ 3 ] - P );
	coords[ 0 ] = normalize( coords[ 0 ] );
	coords[ 1 ] = normalize( coords[ 1 ] );
	coords[ 2 ] = normalize( coords[ 2 ] );
	coords[ 3 ] = normalize( coords[ 3 ] );
	vec3 vectorFormFactor = vec3( 0.0 );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 0 ], coords[ 1 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 1 ], coords[ 2 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 2 ], coords[ 3 ] );
	vectorFormFactor += LTC_EdgeVectorFormFactor( coords[ 3 ], coords[ 0 ] );
	float result = LTC_ClippedSphereFormFactor( vectorFormFactor );
	return vec3( result );
}
#if defined( USE_SHEEN )
float D_Charlie( float roughness, float dotNH ) {
	float alpha = pow2( roughness );
	float invAlpha = 1.0 / alpha;
	float cos2h = dotNH * dotNH;
	float sin2h = max( 1.0 - cos2h, 0.0078125 );
	return ( 2.0 + invAlpha ) * pow( sin2h, invAlpha * 0.5 ) / ( 2.0 * PI );
}
float V_Neubelt( float dotNV, float dotNL ) {
	return saturate( 1.0 / ( 4.0 * ( dotNL + dotNV - dotNL * dotNV ) ) );
}
vec3 BRDF_Sheen( const in vec3 lightDir, const in vec3 viewDir, const in vec3 normal, vec3 sheenColor, const in float sheenRoughness ) {
	vec3 halfDir = normalize( lightDir + viewDir );
	float dotNL = saturate( dot( normal, lightDir ) );
	float dotNV = saturate( dot( normal, viewDir ) );
	float dotNH = saturate( dot( normal, halfDir ) );
	float D = D_Charlie( sheenRoughness, dotNH );
	float V = V_Neubelt( dotNV, dotNL );
	return sheenColor * ( D * V );
}
#endif
float IBLSheenBRDF( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	float r2 = roughness * roughness;
	float a = roughness < 0.25 ? -339.2 * r2 + 161.4 * roughness - 25.9 : -8.48 * r2 + 14.3 * roughness - 9.95;
	float b = roughness < 0.25 ? 44.0 * r2 - 23.7 * roughness + 3.26 : 1.97 * r2 - 3.27 * roughness + 0.72;
	float DG = exp( a * dotNV + b ) + ( roughness < 0.25 ? 0.0 : 0.1 * ( roughness - 0.25 ) );
	return saturate( DG * RECIPROCAL_PI );
}
vec2 DFGApprox( const in vec3 normal, const in vec3 viewDir, const in float roughness ) {
	float dotNV = saturate( dot( normal, viewDir ) );
	const vec4 c0 = vec4( - 1, - 0.0275, - 0.572, 0.022 );
	const vec4 c1 = vec4( 1, 0.0425, 1.04, - 0.04 );
	vec4 r = roughness * c0 + c1;
	float a004 = min( r.x * r.x, exp2( - 9.28 * dotNV ) ) * r.x + r.y;
	vec2 fab = vec2( - 1.04, 1.04 ) * a004 + r.zw;
	return fab;
}
vec3 EnvironmentBRDF( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness ) {
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	return specularColor * fab.x + specularF90 * fab.y;
}
#ifdef USE_IRIDESCENCE
void computeMultiscatteringIridescence( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float iridescence, const in vec3 iridescenceF0, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#else
void computeMultiscattering( const in vec3 normal, const in vec3 viewDir, const in vec3 specularColor, const in float specularF90, const in float roughness, inout vec3 singleScatter, inout vec3 multiScatter ) {
#endif
	vec2 fab = DFGApprox( normal, viewDir, roughness );
	#ifdef USE_IRIDESCENCE
		vec3 Fr = mix( specularColor, iridescenceF0, iridescence );
	#else
		vec3 Fr = specularColor;
	#endif
	vec3 FssEss = Fr * fab.x + specularF90 * fab.y;
	float Ess = fab.x + fab.y;
	float Ems = 1.0 - Ess;
	vec3 Favg = Fr + ( 1.0 - Fr ) * 0.047619;	vec3 Fms = FssEss * Favg / ( 1.0 - Ems * Favg );
	singleScatter += FssEss;
	multiScatter += Fms * Ems;
}
#if NUM_RECT_AREA_LIGHTS > 0
	void RE_Direct_RectArea_Physical( const in RectAreaLight rectAreaLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
		vec3 normal = geometryNormal;
		vec3 viewDir = geometryViewDir;
		vec3 position = geometryPosition;
		vec3 lightPos = rectAreaLight.position;
		vec3 halfWidth = rectAreaLight.halfWidth;
		vec3 halfHeight = rectAreaLight.halfHeight;
		vec3 lightColor = rectAreaLight.color;
		float roughness = material.roughness;
		vec3 rectCoords[ 4 ];
		rectCoords[ 0 ] = lightPos + halfWidth - halfHeight;		rectCoords[ 1 ] = lightPos - halfWidth - halfHeight;
		rectCoords[ 2 ] = lightPos - halfWidth + halfHeight;
		rectCoords[ 3 ] = lightPos + halfWidth + halfHeight;
		vec2 uv = LTC_Uv( normal, viewDir, roughness );
		vec4 t1 = texture2D( ltc_1, uv );
		vec4 t2 = texture2D( ltc_2, uv );
		mat3 mInv = mat3(
			vec3( t1.x, 0, t1.y ),
			vec3(    0, 1,    0 ),
			vec3( t1.z, 0, t1.w )
		);
		vec3 fresnel = ( material.specularColor * t2.x + ( vec3( 1.0 ) - material.specularColor ) * t2.y );
		reflectedLight.directSpecular += lightColor * fresnel * LTC_Evaluate( normal, viewDir, position, mInv, rectCoords );
		reflectedLight.directDiffuse += lightColor * material.diffuseColor * LTC_Evaluate( normal, viewDir, position, mat3( 1.0 ), rectCoords );
	}
#endif
void RE_Direct_Physical( const in IncidentLight directLight, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	float dotNL = saturate( dot( geometryNormal, directLight.direction ) );
	vec3 irradiance = dotNL * directLight.color;
	#ifdef USE_CLEARCOAT
		float dotNLcc = saturate( dot( geometryClearcoatNormal, directLight.direction ) );
		vec3 ccIrradiance = dotNLcc * directLight.color;
		clearcoatSpecularDirect += ccIrradiance * BRDF_GGX_Clearcoat( directLight.direction, geometryViewDir, geometryClearcoatNormal, material );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularDirect += irradiance * BRDF_Sheen( directLight.direction, geometryViewDir, geometryNormal, material.sheenColor, material.sheenRoughness );
	#endif
	reflectedLight.directSpecular += irradiance * BRDF_GGX( directLight.direction, geometryViewDir, geometryNormal, material );
	reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectDiffuse_Physical( const in vec3 irradiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight ) {
	reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );
}
void RE_IndirectSpecular_Physical( const in vec3 radiance, const in vec3 irradiance, const in vec3 clearcoatRadiance, const in vec3 geometryPosition, const in vec3 geometryNormal, const in vec3 geometryViewDir, const in vec3 geometryClearcoatNormal, const in PhysicalMaterial material, inout ReflectedLight reflectedLight) {
	#ifdef USE_CLEARCOAT
		clearcoatSpecularIndirect += clearcoatRadiance * EnvironmentBRDF( geometryClearcoatNormal, geometryViewDir, material.clearcoatF0, material.clearcoatF90, material.clearcoatRoughness );
	#endif
	#ifdef USE_SHEEN
		sheenSpecularIndirect += irradiance * material.sheenColor * IBLSheenBRDF( geometryNormal, geometryViewDir, material.sheenRoughness );
	#endif
	vec3 singleScattering = vec3( 0.0 );
	vec3 multiScattering = vec3( 0.0 );
	vec3 cosineWeightedIrradiance = irradiance * RECIPROCAL_PI;
	#ifdef USE_IRIDESCENCE
		computeMultiscatteringIridescence( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.iridescence, material.iridescenceFresnel, material.roughness, singleScattering, multiScattering );
	#else
		computeMultiscattering( geometryNormal, geometryViewDir, material.specularColor, material.specularF90, material.roughness, singleScattering, multiScattering );
	#endif
	vec3 totalScattering = singleScattering + multiScattering;
	vec3 diffuse = material.diffuseColor * ( 1.0 - max( max( totalScattering.r, totalScattering.g ), totalScattering.b ) );
	reflectedLight.indirectSpecular += radiance * singleScattering;
	reflectedLight.indirectSpecular += multiScattering * cosineWeightedIrradiance;
	reflectedLight.indirectDiffuse += diffuse * cosineWeightedIrradiance;
}
#define RE_Direct				RE_Direct_Physical
#define RE_Direct_RectArea		RE_Direct_RectArea_Physical
#define RE_IndirectDiffuse		RE_IndirectDiffuse_Physical
#define RE_IndirectSpecular		RE_IndirectSpecular_Physical
float computeSpecularOcclusion( const in float dotNV, const in float ambientOcclusion, const in float roughness ) {
	return saturate( pow( dotNV + ambientOcclusion, exp2( - 16.0 * roughness - 1.0 ) ) - 1.0 + ambientOcclusion );
}`, lights_fragment_begin = `
vec3 geometryPosition = - vViewPosition;
vec3 geometryNormal = normal;
vec3 geometryViewDir = ( isOrthographic ) ? vec3( 0, 0, 1 ) : normalize( vViewPosition );
vec3 geometryClearcoatNormal = vec3( 0.0 );
#ifdef USE_CLEARCOAT
	geometryClearcoatNormal = clearcoatNormal;
#endif
#ifdef USE_IRIDESCENCE
	float dotNVi = saturate( dot( normal, geometryViewDir ) );
	if ( material.iridescenceThickness == 0.0 ) {
		material.iridescence = 0.0;
	} else {
		material.iridescence = saturate( material.iridescence );
	}
	if ( material.iridescence > 0.0 ) {
		material.iridescenceFresnel = evalIridescence( 1.0, material.iridescenceIOR, dotNVi, material.iridescenceThickness, material.specularColor );
		material.iridescenceF0 = Schlick_to_F0( material.iridescenceFresnel, 1.0, dotNVi );
	}
#endif
IncidentLight directLight;
#if ( NUM_POINT_LIGHTS > 0 ) && defined( RE_Direct )
	PointLight pointLight;
	#if defined( USE_SHADOWMAP ) && NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHTS; i ++ ) {
		pointLight = pointLights[ i ];
		getPointLightInfo( pointLight, geometryPosition, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_POINT_LIGHT_SHADOWS )
		pointLightShadow = pointLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getPointShadow( pointShadowMap[ i ], pointLightShadow.shadowMapSize, pointLightShadow.shadowIntensity, pointLightShadow.shadowBias, pointLightShadow.shadowRadius, vPointShadowCoord[ i ], pointLightShadow.shadowCameraNear, pointLightShadow.shadowCameraFar ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_SPOT_LIGHTS > 0 ) && defined( RE_Direct )
	SpotLight spotLight;
	vec4 spotColor;
	vec3 spotLightCoord;
	bool inSpotLightMap;
	#if defined( USE_SHADOWMAP ) && NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHTS; i ++ ) {
		spotLight = spotLights[ i ];
		getSpotLightInfo( spotLight, geometryPosition, directLight );
		#if ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#define SPOT_LIGHT_MAP_INDEX UNROLLED_LOOP_INDEX
		#elif ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		#define SPOT_LIGHT_MAP_INDEX NUM_SPOT_LIGHT_MAPS
		#else
		#define SPOT_LIGHT_MAP_INDEX ( UNROLLED_LOOP_INDEX - NUM_SPOT_LIGHT_SHADOWS + NUM_SPOT_LIGHT_SHADOWS_WITH_MAPS )
		#endif
		#if ( SPOT_LIGHT_MAP_INDEX < NUM_SPOT_LIGHT_MAPS )
			spotLightCoord = vSpotLightCoord[ i ].xyz / vSpotLightCoord[ i ].w;
			inSpotLightMap = all( lessThan( abs( spotLightCoord * 2. - 1. ), vec3( 1.0 ) ) );
			spotColor = texture2D( spotLightMap[ SPOT_LIGHT_MAP_INDEX ], spotLightCoord.xy );
			directLight.color = inSpotLightMap ? directLight.color * spotColor.rgb : directLight.color;
		#endif
		#undef SPOT_LIGHT_MAP_INDEX
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
		spotLightShadow = spotLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_DIR_LIGHTS > 0 ) && defined( RE_Direct )
	DirectionalLight directionalLight;
	#if defined( USE_SHADOWMAP ) && NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLightShadow;
	#endif
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHTS; i ++ ) {
		directionalLight = directionalLights[ i ];
		getDirectionalLightInfo( directionalLight, directLight );
		#if defined( USE_SHADOWMAP ) && ( UNROLLED_LOOP_INDEX < NUM_DIR_LIGHT_SHADOWS )
		directionalLightShadow = directionalLightShadows[ i ];
		directLight.color *= ( directLight.visible && receiveShadow ) ? getShadow( directionalShadowMap[ i ], directionalLightShadow.shadowMapSize, directionalLightShadow.shadowIntensity, directionalLightShadow.shadowBias, directionalLightShadow.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
		#endif
		RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if ( NUM_RECT_AREA_LIGHTS > 0 ) && defined( RE_Direct_RectArea )
	RectAreaLight rectAreaLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_RECT_AREA_LIGHTS; i ++ ) {
		rectAreaLight = rectAreaLights[ i ];
		RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
	}
	#pragma unroll_loop_end
#endif
#if defined( RE_IndirectDiffuse )
	vec3 iblIrradiance = vec3( 0.0 );
	vec3 irradiance = getAmbientLightIrradiance( ambientLightColor );
	#if defined( USE_LIGHT_PROBES )
		irradiance += getLightProbeIrradiance( lightProbe, geometryNormal );
	#endif
	#if ( NUM_HEMI_LIGHTS > 0 )
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_HEMI_LIGHTS; i ++ ) {
			irradiance += getHemisphereLightIrradiance( hemisphereLights[ i ], geometryNormal );
		}
		#pragma unroll_loop_end
	#endif
#endif
#if defined( RE_IndirectSpecular )
	vec3 radiance = vec3( 0.0 );
	vec3 clearcoatRadiance = vec3( 0.0 );
#endif`, lights_fragment_maps = `#if defined( RE_IndirectDiffuse )
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		vec3 lightMapIrradiance = lightMapTexel.rgb * lightMapIntensity;
		irradiance += lightMapIrradiance;
	#endif
	#if defined( USE_ENVMAP ) && defined( STANDARD ) && defined( ENVMAP_TYPE_CUBE_UV )
		iblIrradiance += getIBLIrradiance( geometryNormal );
	#endif
#endif
#if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
	#ifdef USE_ANISOTROPY
		radiance += getIBLAnisotropyRadiance( geometryViewDir, geometryNormal, material.roughness, material.anisotropyB, material.anisotropy );
	#else
		radiance += getIBLRadiance( geometryViewDir, geometryNormal, material.roughness );
	#endif
	#ifdef USE_CLEARCOAT
		clearcoatRadiance += getIBLRadiance( geometryViewDir, geometryClearcoatNormal, material.clearcoatRoughness );
	#endif
#endif`, lights_fragment_end = `#if defined( RE_IndirectDiffuse )
	RE_IndirectDiffuse( irradiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif
#if defined( RE_IndirectSpecular )
	RE_IndirectSpecular( radiance, iblIrradiance, clearcoatRadiance, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
#endif`, logdepthbuf_fragment = `#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	gl_FragDepth = vIsPerspective == 0.0 ? gl_FragCoord.z : log2( vFragDepth ) * logDepthBufFC * 0.5;
#endif`, logdepthbuf_pars_fragment = `#if defined( USE_LOGARITHMIC_DEPTH_BUFFER )
	uniform float logDepthBufFC;
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`, logdepthbuf_pars_vertex = `#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	varying float vFragDepth;
	varying float vIsPerspective;
#endif`, logdepthbuf_vertex = `#ifdef USE_LOGARITHMIC_DEPTH_BUFFER
	vFragDepth = 1.0 + gl_Position.w;
	vIsPerspective = float( isPerspectiveMatrix( projectionMatrix ) );
#endif`, map_fragment = `#ifdef USE_MAP
	vec4 sampledDiffuseColor = texture2D( map, vMapUv );
	#ifdef DECODE_VIDEO_TEXTURE
		sampledDiffuseColor = sRGBTransferEOTF( sampledDiffuseColor );
	#endif
	diffuseColor *= sampledDiffuseColor;
#endif`, map_pars_fragment = `#ifdef USE_MAP
	uniform sampler2D map;
#endif`, map_particle_fragment = `#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
	#if defined( USE_POINTS_UV )
		vec2 uv = vUv;
	#else
		vec2 uv = ( uvTransform * vec3( gl_PointCoord.x, 1.0 - gl_PointCoord.y, 1 ) ).xy;
	#endif
#endif
#ifdef USE_MAP
	diffuseColor *= texture2D( map, uv );
#endif
#ifdef USE_ALPHAMAP
	diffuseColor.a *= texture2D( alphaMap, uv ).g;
#endif`, map_particle_pars_fragment = `#if defined( USE_POINTS_UV )
	varying vec2 vUv;
#else
	#if defined( USE_MAP ) || defined( USE_ALPHAMAP )
		uniform mat3 uvTransform;
	#endif
#endif
#ifdef USE_MAP
	uniform sampler2D map;
#endif
#ifdef USE_ALPHAMAP
	uniform sampler2D alphaMap;
#endif`, metalnessmap_fragment = `float metalnessFactor = metalness;
#ifdef USE_METALNESSMAP
	vec4 texelMetalness = texture2D( metalnessMap, vMetalnessMapUv );
	metalnessFactor *= texelMetalness.b;
#endif`, metalnessmap_pars_fragment = `#ifdef USE_METALNESSMAP
	uniform sampler2D metalnessMap;
#endif`, morphinstance_vertex = `#ifdef USE_INSTANCING_MORPH
	float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	float morphTargetBaseInfluence = texelFetch( morphTexture, ivec2( 0, gl_InstanceID ), 0 ).r;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		morphTargetInfluences[i] =  texelFetch( morphTexture, ivec2( i + 1, gl_InstanceID ), 0 ).r;
	}
#endif`, morphcolor_vertex = `#if defined( USE_MORPHCOLORS )
	vColor *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		#if defined( USE_COLOR_ALPHA )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ) * morphTargetInfluences[ i ];
		#elif defined( USE_COLOR )
			if ( morphTargetInfluences[ i ] != 0.0 ) vColor += getMorph( gl_VertexID, i, 2 ).rgb * morphTargetInfluences[ i ];
		#endif
	}
#endif`, morphnormal_vertex = `#ifdef USE_MORPHNORMALS
	objectNormal *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) objectNormal += getMorph( gl_VertexID, i, 1 ).xyz * morphTargetInfluences[ i ];
	}
#endif`, morphtarget_pars_vertex = `#ifdef USE_MORPHTARGETS
	#ifndef USE_INSTANCING_MORPH
		uniform float morphTargetBaseInfluence;
		uniform float morphTargetInfluences[ MORPHTARGETS_COUNT ];
	#endif
	uniform sampler2DArray morphTargetsTexture;
	uniform ivec2 morphTargetsTextureSize;
	vec4 getMorph( const in int vertexIndex, const in int morphTargetIndex, const in int offset ) {
		int texelIndex = vertexIndex * MORPHTARGETS_TEXTURE_STRIDE + offset;
		int y = texelIndex / morphTargetsTextureSize.x;
		int x = texelIndex - y * morphTargetsTextureSize.x;
		ivec3 morphUV = ivec3( x, y, morphTargetIndex );
		return texelFetch( morphTargetsTexture, morphUV, 0 );
	}
#endif`, morphtarget_vertex = `#ifdef USE_MORPHTARGETS
	transformed *= morphTargetBaseInfluence;
	for ( int i = 0; i < MORPHTARGETS_COUNT; i ++ ) {
		if ( morphTargetInfluences[ i ] != 0.0 ) transformed += getMorph( gl_VertexID, i, 0 ).xyz * morphTargetInfluences[ i ];
	}
#endif`, normal_fragment_begin = `float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;
#ifdef FLAT_SHADED
	vec3 fdx = dFdx( vViewPosition );
	vec3 fdy = dFdy( vViewPosition );
	vec3 normal = normalize( cross( fdx, fdy ) );
#else
	vec3 normal = normalize( vNormal );
	#ifdef DOUBLE_SIDED
		normal *= faceDirection;
	#endif
#endif
#if defined( USE_NORMALMAP_TANGENTSPACE ) || defined( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY )
	#ifdef USE_TANGENT
		mat3 tbn = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn = getTangentFrame( - vViewPosition, normal,
		#if defined( USE_NORMALMAP )
			vNormalMapUv
		#elif defined( USE_CLEARCOAT_NORMALMAP )
			vClearcoatNormalMapUv
		#else
			vUv
		#endif
		);
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn[0] *= faceDirection;
		tbn[1] *= faceDirection;
	#endif
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	#ifdef USE_TANGENT
		mat3 tbn2 = mat3( normalize( vTangent ), normalize( vBitangent ), normal );
	#else
		mat3 tbn2 = getTangentFrame( - vViewPosition, normal, vClearcoatNormalMapUv );
	#endif
	#if defined( DOUBLE_SIDED ) && ! defined( FLAT_SHADED )
		tbn2[0] *= faceDirection;
		tbn2[1] *= faceDirection;
	#endif
#endif
vec3 nonPerturbedNormal = normal;`, normal_fragment_maps = `#ifdef USE_NORMALMAP_OBJECTSPACE
	normal = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	#ifdef FLIP_SIDED
		normal = - normal;
	#endif
	#ifdef DOUBLE_SIDED
		normal = normal * faceDirection;
	#endif
	normal = normalize( normalMatrix * normal );
#elif defined( USE_NORMALMAP_TANGENTSPACE )
	vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;
	mapN.xy *= normalScale;
	normal = normalize( tbn * mapN );
#elif defined( USE_BUMPMAP )
	normal = perturbNormalArb( - vViewPosition, normal, dHdxy_fwd(), faceDirection );
#endif`, normal_pars_fragment = `#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`, normal_pars_vertex = `#ifndef FLAT_SHADED
	varying vec3 vNormal;
	#ifdef USE_TANGENT
		varying vec3 vTangent;
		varying vec3 vBitangent;
	#endif
#endif`, normal_vertex = `#ifndef FLAT_SHADED
	vNormal = normalize( transformedNormal );
	#ifdef USE_TANGENT
		vTangent = normalize( transformedTangent );
		vBitangent = normalize( cross( vNormal, vTangent ) * tangent.w );
	#endif
#endif`, normalmap_pars_fragment = `#ifdef USE_NORMALMAP
	uniform sampler2D normalMap;
	uniform vec2 normalScale;
#endif
#ifdef USE_NORMALMAP_OBJECTSPACE
	uniform mat3 normalMatrix;
#endif
#if ! defined ( USE_TANGENT ) && ( defined ( USE_NORMALMAP_TANGENTSPACE ) || defined ( USE_CLEARCOAT_NORMALMAP ) || defined( USE_ANISOTROPY ) )
	mat3 getTangentFrame( vec3 eye_pos, vec3 surf_norm, vec2 uv ) {
		vec3 q0 = dFdx( eye_pos.xyz );
		vec3 q1 = dFdy( eye_pos.xyz );
		vec2 st0 = dFdx( uv.st );
		vec2 st1 = dFdy( uv.st );
		vec3 N = surf_norm;
		vec3 q1perp = cross( q1, N );
		vec3 q0perp = cross( N, q0 );
		vec3 T = q1perp * st0.x + q0perp * st1.x;
		vec3 B = q1perp * st0.y + q0perp * st1.y;
		float det = max( dot( T, T ), dot( B, B ) );
		float scale = ( det == 0.0 ) ? 0.0 : inversesqrt( det );
		return mat3( T * scale, B * scale, N );
	}
#endif`, clearcoat_normal_fragment_begin = `#ifdef USE_CLEARCOAT
	vec3 clearcoatNormal = nonPerturbedNormal;
#endif`, clearcoat_normal_fragment_maps = `#ifdef USE_CLEARCOAT_NORMALMAP
	vec3 clearcoatMapN = texture2D( clearcoatNormalMap, vClearcoatNormalMapUv ).xyz * 2.0 - 1.0;
	clearcoatMapN.xy *= clearcoatNormalScale;
	clearcoatNormal = normalize( tbn2 * clearcoatMapN );
#endif`, clearcoat_pars_fragment = `#ifdef USE_CLEARCOATMAP
	uniform sampler2D clearcoatMap;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform sampler2D clearcoatNormalMap;
	uniform vec2 clearcoatNormalScale;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform sampler2D clearcoatRoughnessMap;
#endif`, iridescence_pars_fragment = `#ifdef USE_IRIDESCENCEMAP
	uniform sampler2D iridescenceMap;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform sampler2D iridescenceThicknessMap;
#endif`, opaque_fragment = `#ifdef OPAQUE
diffuseColor.a = 1.0;
#endif
#ifdef USE_TRANSMISSION
diffuseColor.a *= material.transmissionAlpha;
#endif
gl_FragColor = vec4( outgoingLight, diffuseColor.a );`, packing = `vec3 packNormalToRGB( const in vec3 normal ) {
	return normalize( normal ) * 0.5 + 0.5;
}
vec3 unpackRGBToNormal( const in vec3 rgb ) {
	return 2.0 * rgb.xyz - 1.0;
}
const float PackUpscale = 256. / 255.;const float UnpackDownscale = 255. / 256.;const float ShiftRight8 = 1. / 256.;
const float Inv255 = 1. / 255.;
const vec4 PackFactors = vec4( 1.0, 256.0, 256.0 * 256.0, 256.0 * 256.0 * 256.0 );
const vec2 UnpackFactors2 = vec2( UnpackDownscale, 1.0 / PackFactors.g );
const vec3 UnpackFactors3 = vec3( UnpackDownscale / PackFactors.rg, 1.0 / PackFactors.b );
const vec4 UnpackFactors4 = vec4( UnpackDownscale / PackFactors.rgb, 1.0 / PackFactors.a );
vec4 packDepthToRGBA( const in float v ) {
	if( v <= 0.0 )
		return vec4( 0., 0., 0., 0. );
	if( v >= 1.0 )
		return vec4( 1., 1., 1., 1. );
	float vuf;
	float af = modf( v * PackFactors.a, vuf );
	float bf = modf( vuf * ShiftRight8, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec4( vuf * Inv255, gf * PackUpscale, bf * PackUpscale, af );
}
vec3 packDepthToRGB( const in float v ) {
	if( v <= 0.0 )
		return vec3( 0., 0., 0. );
	if( v >= 1.0 )
		return vec3( 1., 1., 1. );
	float vuf;
	float bf = modf( v * PackFactors.b, vuf );
	float gf = modf( vuf * ShiftRight8, vuf );
	return vec3( vuf * Inv255, gf * PackUpscale, bf );
}
vec2 packDepthToRG( const in float v ) {
	if( v <= 0.0 )
		return vec2( 0., 0. );
	if( v >= 1.0 )
		return vec2( 1., 1. );
	float vuf;
	float gf = modf( v * 256., vuf );
	return vec2( vuf * Inv255, gf );
}
float unpackRGBAToDepth( const in vec4 v ) {
	return dot( v, UnpackFactors4 );
}
float unpackRGBToDepth( const in vec3 v ) {
	return dot( v, UnpackFactors3 );
}
float unpackRGToDepth( const in vec2 v ) {
	return v.r * UnpackFactors2.r + v.g * UnpackFactors2.g;
}
vec4 pack2HalfToRGBA( const in vec2 v ) {
	vec4 r = vec4( v.x, fract( v.x * 255.0 ), v.y, fract( v.y * 255.0 ) );
	return vec4( r.x - r.y / 255.0, r.y, r.z - r.w / 255.0, r.w );
}
vec2 unpackRGBATo2Half( const in vec4 v ) {
	return vec2( v.x + ( v.y / 255.0 ), v.z + ( v.w / 255.0 ) );
}
float viewZToOrthographicDepth( const in float viewZ, const in float near, const in float far ) {
	return ( viewZ + near ) / ( near - far );
}
float orthographicDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return depth * ( near - far ) - near;
}
float viewZToPerspectiveDepth( const in float viewZ, const in float near, const in float far ) {
	return ( ( near + viewZ ) * far ) / ( ( far - near ) * viewZ );
}
float perspectiveDepthToViewZ( const in float depth, const in float near, const in float far ) {
	return ( near * far ) / ( ( far - near ) * depth - far );
}`, premultiplied_alpha_fragment = `#ifdef PREMULTIPLIED_ALPHA
	gl_FragColor.rgb *= gl_FragColor.a;
#endif`, project_vertex = `vec4 mvPosition = vec4( transformed, 1.0 );
#ifdef USE_BATCHING
	mvPosition = batchingMatrix * mvPosition;
#endif
#ifdef USE_INSTANCING
	mvPosition = instanceMatrix * mvPosition;
#endif
mvPosition = modelViewMatrix * mvPosition;
gl_Position = projectionMatrix * mvPosition;`, dithering_fragment = `#ifdef DITHERING
	gl_FragColor.rgb = dithering( gl_FragColor.rgb );
#endif`, dithering_pars_fragment = `#ifdef DITHERING
	vec3 dithering( vec3 color ) {
		float grid_position = rand( gl_FragCoord.xy );
		vec3 dither_shift_RGB = vec3( 0.25 / 255.0, -0.25 / 255.0, 0.25 / 255.0 );
		dither_shift_RGB = mix( 2.0 * dither_shift_RGB, -2.0 * dither_shift_RGB, grid_position );
		return color + dither_shift_RGB;
	}
#endif`, roughnessmap_fragment = `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
	vec4 texelRoughness = texture2D( roughnessMap, vRoughnessMapUv );
	roughnessFactor *= texelRoughness.g;
#endif`, roughnessmap_pars_fragment = `#ifdef USE_ROUGHNESSMAP
	uniform sampler2D roughnessMap;
#endif`, shadowmap_pars_fragment = `#if NUM_SPOT_LIGHT_COORDS > 0
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#if NUM_SPOT_LIGHT_MAPS > 0
	uniform sampler2D spotLightMap[ NUM_SPOT_LIGHT_MAPS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform sampler2D directionalShadowMap[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		uniform sampler2D spotShadowMap[ NUM_SPOT_LIGHT_SHADOWS ];
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform sampler2D pointShadowMap[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
	float texture2DCompare( sampler2D depths, vec2 uv, float compare ) {
		float depth = unpackRGBAToDepth( texture2D( depths, uv ) );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			return step( depth, compare );
		#else
			return step( compare, depth );
		#endif
	}
	vec2 texture2DDistribution( sampler2D shadow, vec2 uv ) {
		return unpackRGBATo2Half( texture2D( shadow, uv ) );
	}
	float VSMShadow( sampler2D shadow, vec2 uv, float compare ) {
		float occlusion = 1.0;
		vec2 distribution = texture2DDistribution( shadow, uv );
		#ifdef USE_REVERSED_DEPTH_BUFFER
			float hard_shadow = step( distribution.x, compare );
		#else
			float hard_shadow = step( compare, distribution.x );
		#endif
		if ( hard_shadow != 1.0 ) {
			float distance = compare - distribution.x;
			float variance = max( 0.00000, distribution.y * distribution.y );
			float softness_probability = variance / (variance + distance * distance );			softness_probability = clamp( ( softness_probability - 0.3 ) / ( 0.95 - 0.3 ), 0.0, 1.0 );			occlusion = clamp( max( hard_shadow, softness_probability ), 0.0, 1.0 );
		}
		return occlusion;
	}
	float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord ) {
		float shadow = 1.0;
		shadowCoord.xyz /= shadowCoord.w;
		shadowCoord.z += shadowBias;
		bool inFrustum = shadowCoord.x >= 0.0 && shadowCoord.x <= 1.0 && shadowCoord.y >= 0.0 && shadowCoord.y <= 1.0;
		bool frustumTest = inFrustum && shadowCoord.z <= 1.0;
		if ( frustumTest ) {
		#if defined( SHADOWMAP_TYPE_PCF )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx0 = - texelSize.x * shadowRadius;
			float dy0 = - texelSize.y * shadowRadius;
			float dx1 = + texelSize.x * shadowRadius;
			float dy1 = + texelSize.y * shadowRadius;
			float dx2 = dx0 / 2.0;
			float dy2 = dy0 / 2.0;
			float dx3 = dx1 / 2.0;
			float dy3 = dy1 / 2.0;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy2 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx2, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx3, dy3 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( 0.0, dy1 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( dx1, dy1 ), shadowCoord.z )
			) * ( 1.0 / 17.0 );
		#elif defined( SHADOWMAP_TYPE_PCF_SOFT )
			vec2 texelSize = vec2( 1.0 ) / shadowMapSize;
			float dx = texelSize.x;
			float dy = texelSize.y;
			vec2 uv = shadowCoord.xy;
			vec2 f = fract( uv * shadowMapSize + 0.5 );
			uv -= f * texelSize;
			shadow = (
				texture2DCompare( shadowMap, uv, shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( dx, 0.0 ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + vec2( 0.0, dy ), shadowCoord.z ) +
				texture2DCompare( shadowMap, uv + texelSize, shadowCoord.z ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, 0.0 ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 0.0 ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( -dx, dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, dy ), shadowCoord.z ),
					 f.x ) +
				mix( texture2DCompare( shadowMap, uv + vec2( 0.0, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( 0.0, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( texture2DCompare( shadowMap, uv + vec2( dx, -dy ), shadowCoord.z ),
					 texture2DCompare( shadowMap, uv + vec2( dx, 2.0 * dy ), shadowCoord.z ),
					 f.y ) +
				mix( mix( texture2DCompare( shadowMap, uv + vec2( -dx, -dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, -dy ), shadowCoord.z ),
						  f.x ),
					 mix( texture2DCompare( shadowMap, uv + vec2( -dx, 2.0 * dy ), shadowCoord.z ),
						  texture2DCompare( shadowMap, uv + vec2( 2.0 * dx, 2.0 * dy ), shadowCoord.z ),
						  f.x ),
					 f.y )
			) * ( 1.0 / 9.0 );
		#elif defined( SHADOWMAP_TYPE_VSM )
			shadow = VSMShadow( shadowMap, shadowCoord.xy, shadowCoord.z );
		#else
			shadow = texture2DCompare( shadowMap, shadowCoord.xy, shadowCoord.z );
		#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
	vec2 cubeToUV( vec3 v, float texelSizeY ) {
		vec3 absV = abs( v );
		float scaleToCube = 1.0 / max( absV.x, max( absV.y, absV.z ) );
		absV *= scaleToCube;
		v *= scaleToCube * ( 1.0 - 2.0 * texelSizeY );
		vec2 planar = v.xy;
		float almostATexel = 1.5 * texelSizeY;
		float almostOne = 1.0 - almostATexel;
		if ( absV.z >= almostOne ) {
			if ( v.z > 0.0 )
				planar.x = 4.0 - v.x;
		} else if ( absV.x >= almostOne ) {
			float signX = sign( v.x );
			planar.x = v.z * signX + 2.0 * signX;
		} else if ( absV.y >= almostOne ) {
			float signY = sign( v.y );
			planar.x = v.x + 2.0 * signY + 2.0;
			planar.y = v.z * signY - 2.0;
		}
		return vec2( 0.125, 0.25 ) * planar + vec2( 0.375, 0.75 );
	}
	float getPointShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowIntensity, float shadowBias, float shadowRadius, vec4 shadowCoord, float shadowCameraNear, float shadowCameraFar ) {
		float shadow = 1.0;
		vec3 lightToPosition = shadowCoord.xyz;
		
		float lightToPositionLength = length( lightToPosition );
		if ( lightToPositionLength - shadowCameraFar <= 0.0 && lightToPositionLength - shadowCameraNear >= 0.0 ) {
			float dp = ( lightToPositionLength - shadowCameraNear ) / ( shadowCameraFar - shadowCameraNear );			dp += shadowBias;
			vec3 bd3D = normalize( lightToPosition );
			vec2 texelSize = vec2( 1.0 ) / ( shadowMapSize * vec2( 4.0, 2.0 ) );
			#if defined( SHADOWMAP_TYPE_PCF ) || defined( SHADOWMAP_TYPE_PCF_SOFT ) || defined( SHADOWMAP_TYPE_VSM )
				vec2 offset = vec2( - 1, 1 ) * shadowRadius * texelSize.y;
				shadow = (
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yyx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxy, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.xxx, texelSize.y ), dp ) +
					texture2DCompare( shadowMap, cubeToUV( bd3D + offset.yxx, texelSize.y ), dp )
				) * ( 1.0 / 9.0 );
			#else
				shadow = texture2DCompare( shadowMap, cubeToUV( bd3D, texelSize.y ), dp );
			#endif
		}
		return mix( 1.0, shadow, shadowIntensity );
	}
#endif`, shadowmap_pars_vertex = `#if NUM_SPOT_LIGHT_COORDS > 0
	uniform mat4 spotLightMatrix[ NUM_SPOT_LIGHT_COORDS ];
	varying vec4 vSpotLightCoord[ NUM_SPOT_LIGHT_COORDS ];
#endif
#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
		uniform mat4 directionalShadowMatrix[ NUM_DIR_LIGHT_SHADOWS ];
		varying vec4 vDirectionalShadowCoord[ NUM_DIR_LIGHT_SHADOWS ];
		struct DirectionalLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform DirectionalLightShadow directionalLightShadows[ NUM_DIR_LIGHT_SHADOWS ];
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
		struct SpotLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
		};
		uniform SpotLightShadow spotLightShadows[ NUM_SPOT_LIGHT_SHADOWS ];
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		uniform mat4 pointShadowMatrix[ NUM_POINT_LIGHT_SHADOWS ];
		varying vec4 vPointShadowCoord[ NUM_POINT_LIGHT_SHADOWS ];
		struct PointLightShadow {
			float shadowIntensity;
			float shadowBias;
			float shadowNormalBias;
			float shadowRadius;
			vec2 shadowMapSize;
			float shadowCameraNear;
			float shadowCameraFar;
		};
		uniform PointLightShadow pointLightShadows[ NUM_POINT_LIGHT_SHADOWS ];
	#endif
#endif`, shadowmap_vertex = `#if ( defined( USE_SHADOWMAP ) && ( NUM_DIR_LIGHT_SHADOWS > 0 || NUM_POINT_LIGHT_SHADOWS > 0 ) ) || ( NUM_SPOT_LIGHT_COORDS > 0 )
	vec3 shadowWorldNormal = inverseTransformDirection( transformedNormal, viewMatrix );
	vec4 shadowWorldPosition;
#endif
#if defined( USE_SHADOWMAP )
	#if NUM_DIR_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * directionalLightShadows[ i ].shadowNormalBias, 0 );
			vDirectionalShadowCoord[ i ] = directionalShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
		#pragma unroll_loop_start
		for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
			shadowWorldPosition = worldPosition + vec4( shadowWorldNormal * pointLightShadows[ i ].shadowNormalBias, 0 );
			vPointShadowCoord[ i ] = pointShadowMatrix[ i ] * shadowWorldPosition;
		}
		#pragma unroll_loop_end
	#endif
#endif
#if NUM_SPOT_LIGHT_COORDS > 0
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_COORDS; i ++ ) {
		shadowWorldPosition = worldPosition;
		#if ( defined( USE_SHADOWMAP ) && UNROLLED_LOOP_INDEX < NUM_SPOT_LIGHT_SHADOWS )
			shadowWorldPosition.xyz += shadowWorldNormal * spotLightShadows[ i ].shadowNormalBias;
		#endif
		vSpotLightCoord[ i ] = spotLightMatrix[ i ] * shadowWorldPosition;
	}
	#pragma unroll_loop_end
#endif`, shadowmask_pars_fragment = `float getShadowMask() {
	float shadow = 1.0;
	#ifdef USE_SHADOWMAP
	#if NUM_DIR_LIGHT_SHADOWS > 0
	DirectionalLightShadow directionalLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_DIR_LIGHT_SHADOWS; i ++ ) {
		directionalLight = directionalLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( directionalShadowMap[ i ], directionalLight.shadowMapSize, directionalLight.shadowIntensity, directionalLight.shadowBias, directionalLight.shadowRadius, vDirectionalShadowCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_SPOT_LIGHT_SHADOWS > 0
	SpotLightShadow spotLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_SPOT_LIGHT_SHADOWS; i ++ ) {
		spotLight = spotLightShadows[ i ];
		shadow *= receiveShadow ? getShadow( spotShadowMap[ i ], spotLight.shadowMapSize, spotLight.shadowIntensity, spotLight.shadowBias, spotLight.shadowRadius, vSpotLightCoord[ i ] ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#if NUM_POINT_LIGHT_SHADOWS > 0
	PointLightShadow pointLight;
	#pragma unroll_loop_start
	for ( int i = 0; i < NUM_POINT_LIGHT_SHADOWS; i ++ ) {
		pointLight = pointLightShadows[ i ];
		shadow *= receiveShadow ? getPointShadow( pointShadowMap[ i ], pointLight.shadowMapSize, pointLight.shadowIntensity, pointLight.shadowBias, pointLight.shadowRadius, vPointShadowCoord[ i ], pointLight.shadowCameraNear, pointLight.shadowCameraFar ) : 1.0;
	}
	#pragma unroll_loop_end
	#endif
	#endif
	return shadow;
}`, skinbase_vertex = `#ifdef USE_SKINNING
	mat4 boneMatX = getBoneMatrix( skinIndex.x );
	mat4 boneMatY = getBoneMatrix( skinIndex.y );
	mat4 boneMatZ = getBoneMatrix( skinIndex.z );
	mat4 boneMatW = getBoneMatrix( skinIndex.w );
#endif`, skinning_pars_vertex = `#ifdef USE_SKINNING
	uniform mat4 bindMatrix;
	uniform mat4 bindMatrixInverse;
	uniform highp sampler2D boneTexture;
	mat4 getBoneMatrix( const in float i ) {
		int size = textureSize( boneTexture, 0 ).x;
		int j = int( i ) * 4;
		int x = j % size;
		int y = j / size;
		vec4 v1 = texelFetch( boneTexture, ivec2( x, y ), 0 );
		vec4 v2 = texelFetch( boneTexture, ivec2( x + 1, y ), 0 );
		vec4 v3 = texelFetch( boneTexture, ivec2( x + 2, y ), 0 );
		vec4 v4 = texelFetch( boneTexture, ivec2( x + 3, y ), 0 );
		return mat4( v1, v2, v3, v4 );
	}
#endif`, skinning_vertex = `#ifdef USE_SKINNING
	vec4 skinVertex = bindMatrix * vec4( transformed, 1.0 );
	vec4 skinned = vec4( 0.0 );
	skinned += boneMatX * skinVertex * skinWeight.x;
	skinned += boneMatY * skinVertex * skinWeight.y;
	skinned += boneMatZ * skinVertex * skinWeight.z;
	skinned += boneMatW * skinVertex * skinWeight.w;
	transformed = ( bindMatrixInverse * skinned ).xyz;
#endif`, skinnormal_vertex = `#ifdef USE_SKINNING
	mat4 skinMatrix = mat4( 0.0 );
	skinMatrix += skinWeight.x * boneMatX;
	skinMatrix += skinWeight.y * boneMatY;
	skinMatrix += skinWeight.z * boneMatZ;
	skinMatrix += skinWeight.w * boneMatW;
	skinMatrix = bindMatrixInverse * skinMatrix * bindMatrix;
	objectNormal = vec4( skinMatrix * vec4( objectNormal, 0.0 ) ).xyz;
	#ifdef USE_TANGENT
		objectTangent = vec4( skinMatrix * vec4( objectTangent, 0.0 ) ).xyz;
	#endif
#endif`, specularmap_fragment = `float specularStrength;
#ifdef USE_SPECULARMAP
	vec4 texelSpecular = texture2D( specularMap, vSpecularMapUv );
	specularStrength = texelSpecular.r;
#else
	specularStrength = 1.0;
#endif`, specularmap_pars_fragment = `#ifdef USE_SPECULARMAP
	uniform sampler2D specularMap;
#endif`, tonemapping_fragment = `#if defined( TONE_MAPPING )
	gl_FragColor.rgb = toneMapping( gl_FragColor.rgb );
#endif`, tonemapping_pars_fragment = `#ifndef saturate
#define saturate( a ) clamp( a, 0.0, 1.0 )
#endif
uniform float toneMappingExposure;
vec3 LinearToneMapping( vec3 color ) {
	return saturate( toneMappingExposure * color );
}
vec3 ReinhardToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	return saturate( color / ( vec3( 1.0 ) + color ) );
}
vec3 CineonToneMapping( vec3 color ) {
	color *= toneMappingExposure;
	color = max( vec3( 0.0 ), color - 0.004 );
	return pow( ( color * ( 6.2 * color + 0.5 ) ) / ( color * ( 6.2 * color + 1.7 ) + 0.06 ), vec3( 2.2 ) );
}
vec3 RRTAndODTFit( vec3 v ) {
	vec3 a = v * ( v + 0.0245786 ) - 0.000090537;
	vec3 b = v * ( 0.983729 * v + 0.4329510 ) + 0.238081;
	return a / b;
}
vec3 ACESFilmicToneMapping( vec3 color ) {
	const mat3 ACESInputMat = mat3(
		vec3( 0.59719, 0.07600, 0.02840 ),		vec3( 0.35458, 0.90834, 0.13383 ),
		vec3( 0.04823, 0.01566, 0.83777 )
	);
	const mat3 ACESOutputMat = mat3(
		vec3(  1.60475, -0.10208, -0.00327 ),		vec3( -0.53108,  1.10813, -0.07276 ),
		vec3( -0.07367, -0.00605,  1.07602 )
	);
	color *= toneMappingExposure / 0.6;
	color = ACESInputMat * color;
	color = RRTAndODTFit( color );
	color = ACESOutputMat * color;
	return saturate( color );
}
const mat3 LINEAR_REC2020_TO_LINEAR_SRGB = mat3(
	vec3( 1.6605, - 0.1246, - 0.0182 ),
	vec3( - 0.5876, 1.1329, - 0.1006 ),
	vec3( - 0.0728, - 0.0083, 1.1187 )
);
const mat3 LINEAR_SRGB_TO_LINEAR_REC2020 = mat3(
	vec3( 0.6274, 0.0691, 0.0164 ),
	vec3( 0.3293, 0.9195, 0.0880 ),
	vec3( 0.0433, 0.0113, 0.8956 )
);
vec3 agxDefaultContrastApprox( vec3 x ) {
	vec3 x2 = x * x;
	vec3 x4 = x2 * x2;
	return + 15.5 * x4 * x2
		- 40.14 * x4 * x
		+ 31.96 * x4
		- 6.868 * x2 * x
		+ 0.4298 * x2
		+ 0.1191 * x
		- 0.00232;
}
vec3 AgXToneMapping( vec3 color ) {
	const mat3 AgXInsetMatrix = mat3(
		vec3( 0.856627153315983, 0.137318972929847, 0.11189821299995 ),
		vec3( 0.0951212405381588, 0.761241990602591, 0.0767994186031903 ),
		vec3( 0.0482516061458583, 0.101439036467562, 0.811302368396859 )
	);
	const mat3 AgXOutsetMatrix = mat3(
		vec3( 1.1271005818144368, - 0.1413297634984383, - 0.14132976349843826 ),
		vec3( - 0.11060664309660323, 1.157823702216272, - 0.11060664309660294 ),
		vec3( - 0.016493938717834573, - 0.016493938717834257, 1.2519364065950405 )
	);
	const float AgxMinEv = - 12.47393;	const float AgxMaxEv = 4.026069;
	color *= toneMappingExposure;
	color = LINEAR_SRGB_TO_LINEAR_REC2020 * color;
	color = AgXInsetMatrix * color;
	color = max( color, 1e-10 );	color = log2( color );
	color = ( color - AgxMinEv ) / ( AgxMaxEv - AgxMinEv );
	color = clamp( color, 0.0, 1.0 );
	color = agxDefaultContrastApprox( color );
	color = AgXOutsetMatrix * color;
	color = pow( max( vec3( 0.0 ), color ), vec3( 2.2 ) );
	color = LINEAR_REC2020_TO_LINEAR_SRGB * color;
	color = clamp( color, 0.0, 1.0 );
	return color;
}
vec3 NeutralToneMapping( vec3 color ) {
	const float StartCompression = 0.8 - 0.04;
	const float Desaturation = 0.15;
	color *= toneMappingExposure;
	float x = min( color.r, min( color.g, color.b ) );
	float offset = x < 0.08 ? x - 6.25 * x * x : 0.04;
	color -= offset;
	float peak = max( color.r, max( color.g, color.b ) );
	if ( peak < StartCompression ) return color;
	float d = 1. - StartCompression;
	float newPeak = 1. - d * d / ( peak + d - StartCompression );
	color *= newPeak / peak;
	float g = 1. - 1. / ( Desaturation * ( peak - newPeak ) + 1. );
	return mix( color, vec3( newPeak ), g );
}
vec3 CustomToneMapping( vec3 color ) { return color; }`, transmission_fragment = `#ifdef USE_TRANSMISSION
	material.transmission = transmission;
	material.transmissionAlpha = 1.0;
	material.thickness = thickness;
	material.attenuationDistance = attenuationDistance;
	material.attenuationColor = attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		material.transmission *= texture2D( transmissionMap, vTransmissionMapUv ).r;
	#endif
	#ifdef USE_THICKNESSMAP
		material.thickness *= texture2D( thicknessMap, vThicknessMapUv ).g;
	#endif
	vec3 pos = vWorldPosition;
	vec3 v = normalize( cameraPosition - pos );
	vec3 n = inverseTransformDirection( normal, viewMatrix );
	vec4 transmitted = getIBLVolumeRefraction(
		n, v, material.roughness, material.diffuseColor, material.specularColor, material.specularF90,
		pos, modelMatrix, viewMatrix, projectionMatrix, material.dispersion, material.ior, material.thickness,
		material.attenuationColor, material.attenuationDistance );
	material.transmissionAlpha = mix( material.transmissionAlpha, transmitted.a, material.transmission );
	totalDiffuse = mix( totalDiffuse, transmitted.rgb, material.transmission );
#endif`, transmission_pars_fragment = `#ifdef USE_TRANSMISSION
	uniform float transmission;
	uniform float thickness;
	uniform float attenuationDistance;
	uniform vec3 attenuationColor;
	#ifdef USE_TRANSMISSIONMAP
		uniform sampler2D transmissionMap;
	#endif
	#ifdef USE_THICKNESSMAP
		uniform sampler2D thicknessMap;
	#endif
	uniform vec2 transmissionSamplerSize;
	uniform sampler2D transmissionSamplerMap;
	uniform mat4 modelMatrix;
	uniform mat4 projectionMatrix;
	varying vec3 vWorldPosition;
	float w0( float a ) {
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - a + 3.0 ) - 3.0 ) + 1.0 );
	}
	float w1( float a ) {
		return ( 1.0 / 6.0 ) * ( a *  a * ( 3.0 * a - 6.0 ) + 4.0 );
	}
	float w2( float a ){
		return ( 1.0 / 6.0 ) * ( a * ( a * ( - 3.0 * a + 3.0 ) + 3.0 ) + 1.0 );
	}
	float w3( float a ) {
		return ( 1.0 / 6.0 ) * ( a * a * a );
	}
	float g0( float a ) {
		return w0( a ) + w1( a );
	}
	float g1( float a ) {
		return w2( a ) + w3( a );
	}
	float h0( float a ) {
		return - 1.0 + w1( a ) / ( w0( a ) + w1( a ) );
	}
	float h1( float a ) {
		return 1.0 + w3( a ) / ( w2( a ) + w3( a ) );
	}
	vec4 bicubic( sampler2D tex, vec2 uv, vec4 texelSize, float lod ) {
		uv = uv * texelSize.zw + 0.5;
		vec2 iuv = floor( uv );
		vec2 fuv = fract( uv );
		float g0x = g0( fuv.x );
		float g1x = g1( fuv.x );
		float h0x = h0( fuv.x );
		float h1x = h1( fuv.x );
		float h0y = h0( fuv.y );
		float h1y = h1( fuv.y );
		vec2 p0 = ( vec2( iuv.x + h0x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p1 = ( vec2( iuv.x + h1x, iuv.y + h0y ) - 0.5 ) * texelSize.xy;
		vec2 p2 = ( vec2( iuv.x + h0x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		vec2 p3 = ( vec2( iuv.x + h1x, iuv.y + h1y ) - 0.5 ) * texelSize.xy;
		return g0( fuv.y ) * ( g0x * textureLod( tex, p0, lod ) + g1x * textureLod( tex, p1, lod ) ) +
			g1( fuv.y ) * ( g0x * textureLod( tex, p2, lod ) + g1x * textureLod( tex, p3, lod ) );
	}
	vec4 textureBicubic( sampler2D sampler, vec2 uv, float lod ) {
		vec2 fLodSize = vec2( textureSize( sampler, int( lod ) ) );
		vec2 cLodSize = vec2( textureSize( sampler, int( lod + 1.0 ) ) );
		vec2 fLodSizeInv = 1.0 / fLodSize;
		vec2 cLodSizeInv = 1.0 / cLodSize;
		vec4 fSample = bicubic( sampler, uv, vec4( fLodSizeInv, fLodSize ), floor( lod ) );
		vec4 cSample = bicubic( sampler, uv, vec4( cLodSizeInv, cLodSize ), ceil( lod ) );
		return mix( fSample, cSample, fract( lod ) );
	}
	vec3 getVolumeTransmissionRay( const in vec3 n, const in vec3 v, const in float thickness, const in float ior, const in mat4 modelMatrix ) {
		vec3 refractionVector = refract( - v, normalize( n ), 1.0 / ior );
		vec3 modelScale;
		modelScale.x = length( vec3( modelMatrix[ 0 ].xyz ) );
		modelScale.y = length( vec3( modelMatrix[ 1 ].xyz ) );
		modelScale.z = length( vec3( modelMatrix[ 2 ].xyz ) );
		return normalize( refractionVector ) * thickness * modelScale;
	}
	float applyIorToRoughness( const in float roughness, const in float ior ) {
		return roughness * clamp( ior * 2.0 - 2.0, 0.0, 1.0 );
	}
	vec4 getTransmissionSample( const in vec2 fragCoord, const in float roughness, const in float ior ) {
		float lod = log2( transmissionSamplerSize.x ) * applyIorToRoughness( roughness, ior );
		return textureBicubic( transmissionSamplerMap, fragCoord.xy, lod );
	}
	vec3 volumeAttenuation( const in float transmissionDistance, const in vec3 attenuationColor, const in float attenuationDistance ) {
		if ( isinf( attenuationDistance ) ) {
			return vec3( 1.0 );
		} else {
			vec3 attenuationCoefficient = -log( attenuationColor ) / attenuationDistance;
			vec3 transmittance = exp( - attenuationCoefficient * transmissionDistance );			return transmittance;
		}
	}
	vec4 getIBLVolumeRefraction( const in vec3 n, const in vec3 v, const in float roughness, const in vec3 diffuseColor,
		const in vec3 specularColor, const in float specularF90, const in vec3 position, const in mat4 modelMatrix,
		const in mat4 viewMatrix, const in mat4 projMatrix, const in float dispersion, const in float ior, const in float thickness,
		const in vec3 attenuationColor, const in float attenuationDistance ) {
		vec4 transmittedLight;
		vec3 transmittance;
		#ifdef USE_DISPERSION
			float halfSpread = ( ior - 1.0 ) * 0.025 * dispersion;
			vec3 iors = vec3( ior - halfSpread, ior, ior + halfSpread );
			for ( int i = 0; i < 3; i ++ ) {
				vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, iors[ i ], modelMatrix );
				vec3 refractedRayExit = position + transmissionRay;
				vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
				vec2 refractionCoords = ndcPos.xy / ndcPos.w;
				refractionCoords += 1.0;
				refractionCoords /= 2.0;
				vec4 transmissionSample = getTransmissionSample( refractionCoords, roughness, iors[ i ] );
				transmittedLight[ i ] = transmissionSample[ i ];
				transmittedLight.a += transmissionSample.a;
				transmittance[ i ] = diffuseColor[ i ] * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance )[ i ];
			}
			transmittedLight.a /= 3.0;
		#else
			vec3 transmissionRay = getVolumeTransmissionRay( n, v, thickness, ior, modelMatrix );
			vec3 refractedRayExit = position + transmissionRay;
			vec4 ndcPos = projMatrix * viewMatrix * vec4( refractedRayExit, 1.0 );
			vec2 refractionCoords = ndcPos.xy / ndcPos.w;
			refractionCoords += 1.0;
			refractionCoords /= 2.0;
			transmittedLight = getTransmissionSample( refractionCoords, roughness, ior );
			transmittance = diffuseColor * volumeAttenuation( length( transmissionRay ), attenuationColor, attenuationDistance );
		#endif
		vec3 attenuatedColor = transmittance * transmittedLight.rgb;
		vec3 F = EnvironmentBRDF( n, v, specularColor, specularF90, roughness );
		float transmittanceFactor = ( transmittance.r + transmittance.g + transmittance.b ) / 3.0;
		return vec4( ( 1.0 - F ) * attenuatedColor, 1.0 - ( 1.0 - transmittedLight.a ) * transmittanceFactor );
	}
#endif`, uv_pars_fragment = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_SPECULARMAP
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`, uv_pars_vertex = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	varying vec2 vUv;
#endif
#ifdef USE_MAP
	uniform mat3 mapTransform;
	varying vec2 vMapUv;
#endif
#ifdef USE_ALPHAMAP
	uniform mat3 alphaMapTransform;
	varying vec2 vAlphaMapUv;
#endif
#ifdef USE_LIGHTMAP
	uniform mat3 lightMapTransform;
	varying vec2 vLightMapUv;
#endif
#ifdef USE_AOMAP
	uniform mat3 aoMapTransform;
	varying vec2 vAoMapUv;
#endif
#ifdef USE_BUMPMAP
	uniform mat3 bumpMapTransform;
	varying vec2 vBumpMapUv;
#endif
#ifdef USE_NORMALMAP
	uniform mat3 normalMapTransform;
	varying vec2 vNormalMapUv;
#endif
#ifdef USE_DISPLACEMENTMAP
	uniform mat3 displacementMapTransform;
	varying vec2 vDisplacementMapUv;
#endif
#ifdef USE_EMISSIVEMAP
	uniform mat3 emissiveMapTransform;
	varying vec2 vEmissiveMapUv;
#endif
#ifdef USE_METALNESSMAP
	uniform mat3 metalnessMapTransform;
	varying vec2 vMetalnessMapUv;
#endif
#ifdef USE_ROUGHNESSMAP
	uniform mat3 roughnessMapTransform;
	varying vec2 vRoughnessMapUv;
#endif
#ifdef USE_ANISOTROPYMAP
	uniform mat3 anisotropyMapTransform;
	varying vec2 vAnisotropyMapUv;
#endif
#ifdef USE_CLEARCOATMAP
	uniform mat3 clearcoatMapTransform;
	varying vec2 vClearcoatMapUv;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	uniform mat3 clearcoatNormalMapTransform;
	varying vec2 vClearcoatNormalMapUv;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	uniform mat3 clearcoatRoughnessMapTransform;
	varying vec2 vClearcoatRoughnessMapUv;
#endif
#ifdef USE_SHEEN_COLORMAP
	uniform mat3 sheenColorMapTransform;
	varying vec2 vSheenColorMapUv;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	uniform mat3 sheenRoughnessMapTransform;
	varying vec2 vSheenRoughnessMapUv;
#endif
#ifdef USE_IRIDESCENCEMAP
	uniform mat3 iridescenceMapTransform;
	varying vec2 vIridescenceMapUv;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	uniform mat3 iridescenceThicknessMapTransform;
	varying vec2 vIridescenceThicknessMapUv;
#endif
#ifdef USE_SPECULARMAP
	uniform mat3 specularMapTransform;
	varying vec2 vSpecularMapUv;
#endif
#ifdef USE_SPECULAR_COLORMAP
	uniform mat3 specularColorMapTransform;
	varying vec2 vSpecularColorMapUv;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	uniform mat3 specularIntensityMapTransform;
	varying vec2 vSpecularIntensityMapUv;
#endif
#ifdef USE_TRANSMISSIONMAP
	uniform mat3 transmissionMapTransform;
	varying vec2 vTransmissionMapUv;
#endif
#ifdef USE_THICKNESSMAP
	uniform mat3 thicknessMapTransform;
	varying vec2 vThicknessMapUv;
#endif`, uv_vertex = `#if defined( USE_UV ) || defined( USE_ANISOTROPY )
	vUv = vec3( uv, 1 ).xy;
#endif
#ifdef USE_MAP
	vMapUv = ( mapTransform * vec3( MAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ALPHAMAP
	vAlphaMapUv = ( alphaMapTransform * vec3( ALPHAMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_LIGHTMAP
	vLightMapUv = ( lightMapTransform * vec3( LIGHTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_AOMAP
	vAoMapUv = ( aoMapTransform * vec3( AOMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_BUMPMAP
	vBumpMapUv = ( bumpMapTransform * vec3( BUMPMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_NORMALMAP
	vNormalMapUv = ( normalMapTransform * vec3( NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_DISPLACEMENTMAP
	vDisplacementMapUv = ( displacementMapTransform * vec3( DISPLACEMENTMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_EMISSIVEMAP
	vEmissiveMapUv = ( emissiveMapTransform * vec3( EMISSIVEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_METALNESSMAP
	vMetalnessMapUv = ( metalnessMapTransform * vec3( METALNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ROUGHNESSMAP
	vRoughnessMapUv = ( roughnessMapTransform * vec3( ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_ANISOTROPYMAP
	vAnisotropyMapUv = ( anisotropyMapTransform * vec3( ANISOTROPYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOATMAP
	vClearcoatMapUv = ( clearcoatMapTransform * vec3( CLEARCOATMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_NORMALMAP
	vClearcoatNormalMapUv = ( clearcoatNormalMapTransform * vec3( CLEARCOAT_NORMALMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_CLEARCOAT_ROUGHNESSMAP
	vClearcoatRoughnessMapUv = ( clearcoatRoughnessMapTransform * vec3( CLEARCOAT_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCEMAP
	vIridescenceMapUv = ( iridescenceMapTransform * vec3( IRIDESCENCEMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_IRIDESCENCE_THICKNESSMAP
	vIridescenceThicknessMapUv = ( iridescenceThicknessMapTransform * vec3( IRIDESCENCE_THICKNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_COLORMAP
	vSheenColorMapUv = ( sheenColorMapTransform * vec3( SHEEN_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SHEEN_ROUGHNESSMAP
	vSheenRoughnessMapUv = ( sheenRoughnessMapTransform * vec3( SHEEN_ROUGHNESSMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULARMAP
	vSpecularMapUv = ( specularMapTransform * vec3( SPECULARMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_COLORMAP
	vSpecularColorMapUv = ( specularColorMapTransform * vec3( SPECULAR_COLORMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_SPECULAR_INTENSITYMAP
	vSpecularIntensityMapUv = ( specularIntensityMapTransform * vec3( SPECULAR_INTENSITYMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_TRANSMISSIONMAP
	vTransmissionMapUv = ( transmissionMapTransform * vec3( TRANSMISSIONMAP_UV, 1 ) ).xy;
#endif
#ifdef USE_THICKNESSMAP
	vThicknessMapUv = ( thicknessMapTransform * vec3( THICKNESSMAP_UV, 1 ) ).xy;
#endif`, worldpos_vertex = `#if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP ) || defined ( USE_TRANSMISSION ) || NUM_SPOT_LIGHT_COORDS > 0
	vec4 worldPosition = vec4( transformed, 1.0 );
	#ifdef USE_BATCHING
		worldPosition = batchingMatrix * worldPosition;
	#endif
	#ifdef USE_INSTANCING
		worldPosition = instanceMatrix * worldPosition;
	#endif
	worldPosition = modelMatrix * worldPosition;
#endif`, vertex$h = `varying vec2 vUv;
uniform mat3 uvTransform;
void main() {
	vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	gl_Position = vec4( position.xy, 1.0, 1.0 );
}`, fragment$h = `uniform sampler2D t2D;
uniform float backgroundIntensity;
varying vec2 vUv;
void main() {
	vec4 texColor = texture2D( t2D, vUv );
	#ifdef DECODE_VIDEO_TEXTURE
		texColor = vec4( mix( pow( texColor.rgb * 0.9478672986 + vec3( 0.0521327014 ), vec3( 2.4 ) ), texColor.rgb * 0.0773993808, vec3( lessThanEqual( texColor.rgb, vec3( 0.04045 ) ) ) ), texColor.w );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`, vertex$g = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`, fragment$g = `#ifdef ENVMAP_TYPE_CUBE
	uniform samplerCube envMap;
#elif defined( ENVMAP_TYPE_CUBE_UV )
	uniform sampler2D envMap;
#endif
uniform float flipEnvMap;
uniform float backgroundBlurriness;
uniform float backgroundIntensity;
uniform mat3 backgroundRotation;
varying vec3 vWorldDirection;
#include <cube_uv_reflection_fragment>
void main() {
	#ifdef ENVMAP_TYPE_CUBE
		vec4 texColor = textureCube( envMap, backgroundRotation * vec3( flipEnvMap * vWorldDirection.x, vWorldDirection.yz ) );
	#elif defined( ENVMAP_TYPE_CUBE_UV )
		vec4 texColor = textureCubeUV( envMap, backgroundRotation * vWorldDirection, backgroundBlurriness );
	#else
		vec4 texColor = vec4( 0.0, 0.0, 0.0, 1.0 );
	#endif
	texColor.rgb *= backgroundIntensity;
	gl_FragColor = texColor;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`, vertex$f = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
	gl_Position.z = gl_Position.w;
}`, fragment$f = `uniform samplerCube tCube;
uniform float tFlip;
uniform float opacity;
varying vec3 vWorldDirection;
void main() {
	vec4 texColor = textureCube( tCube, vec3( tFlip * vWorldDirection.x, vWorldDirection.yz ) );
	gl_FragColor = texColor;
	gl_FragColor.a *= opacity;
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`, vertex$e = `#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
varying vec2 vHighPrecisionZW;
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vHighPrecisionZW = gl_Position.zw;
}`, fragment$e = `#if DEPTH_PACKING == 3200
	uniform float opacity;
#endif
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
varying vec2 vHighPrecisionZW;
void main() {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#if DEPTH_PACKING == 3200
		diffuseColor.a = opacity;
	#endif
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <logdepthbuf_fragment>
	#ifdef USE_REVERSED_DEPTH_BUFFER
		float fragCoordZ = vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ];
	#else
		float fragCoordZ = 0.5 * vHighPrecisionZW[ 0 ] / vHighPrecisionZW[ 1 ] + 0.5;
	#endif
	#if DEPTH_PACKING == 3200
		gl_FragColor = vec4( vec3( 1.0 - fragCoordZ ), opacity );
	#elif DEPTH_PACKING == 3201
		gl_FragColor = packDepthToRGBA( fragCoordZ );
	#elif DEPTH_PACKING == 3202
		gl_FragColor = vec4( packDepthToRGB( fragCoordZ ), 1.0 );
	#elif DEPTH_PACKING == 3203
		gl_FragColor = vec4( packDepthToRG( fragCoordZ ), 0.0, 1.0 );
	#endif
}`, vertex$d = `#define DISTANCE
varying vec3 vWorldPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <skinbase_vertex>
	#include <morphinstance_vertex>
	#ifdef USE_DISPLACEMENTMAP
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <worldpos_vertex>
	#include <clipping_planes_vertex>
	vWorldPosition = worldPosition.xyz;
}`, fragment$d = `#define DISTANCE
uniform vec3 referencePosition;
uniform float nearDistance;
uniform float farDistance;
varying vec3 vWorldPosition;
#include <common>
#include <packing>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <clipping_planes_pars_fragment>
void main () {
	vec4 diffuseColor = vec4( 1.0 );
	#include <clipping_planes_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	float dist = length( vWorldPosition - referencePosition );
	dist = ( dist - nearDistance ) / ( farDistance - nearDistance );
	dist = saturate( dist );
	gl_FragColor = packDepthToRGBA( dist );
}`, vertex$c = `varying vec3 vWorldDirection;
#include <common>
void main() {
	vWorldDirection = transformDirection( position, modelMatrix );
	#include <begin_vertex>
	#include <project_vertex>
}`, fragment$c = `uniform sampler2D tEquirect;
varying vec3 vWorldDirection;
#include <common>
void main() {
	vec3 direction = normalize( vWorldDirection );
	vec2 sampleUV = equirectUv( direction );
	gl_FragColor = texture2D( tEquirect, sampleUV );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
}`, vertex$b = `uniform float scale;
attribute float lineDistance;
varying float vLineDistance;
#include <common>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	vLineDistance = scale * lineDistance;
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`, fragment$b = `uniform vec3 diffuse;
uniform float opacity;
uniform float dashSize;
uniform float totalSize;
varying float vLineDistance;
#include <common>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	if ( mod( vLineDistance, totalSize ) > dashSize ) {
		discard;
	}
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`, vertex$a = `#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#if defined ( USE_ENVMAP ) || defined ( USE_SKINNING )
		#include <beginnormal_vertex>
		#include <morphnormal_vertex>
		#include <skinbase_vertex>
		#include <skinnormal_vertex>
		#include <defaultnormal_vertex>
	#endif
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <fog_vertex>
}`, fragment$a = `uniform vec3 diffuse;
uniform float opacity;
#ifndef FLAT_SHADED
	varying vec3 vNormal;
#endif
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	#ifdef USE_LIGHTMAP
		vec4 lightMapTexel = texture2D( lightMap, vLightMapUv );
		reflectedLight.indirectDiffuse += lightMapTexel.rgb * lightMapIntensity * RECIPROCAL_PI;
	#else
		reflectedLight.indirectDiffuse += vec3( 1.0 );
	#endif
	#include <aomap_fragment>
	reflectedLight.indirectDiffuse *= diffuseColor.rgb;
	vec3 outgoingLight = reflectedLight.indirectDiffuse;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`, vertex$9 = `#define LAMBERT
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`, fragment$9 = `#define LAMBERT
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_lambert_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_lambert_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`, vertex$8 = `#define MATCAP
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <color_pars_vertex>
#include <displacementmap_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
	vViewPosition = - mvPosition.xyz;
}`, fragment$8 = `#define MATCAP
uniform vec3 diffuse;
uniform float opacity;
uniform sampler2D matcap;
varying vec3 vViewPosition;
#include <common>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	vec3 viewDir = normalize( vViewPosition );
	vec3 x = normalize( vec3( viewDir.z, 0.0, - viewDir.x ) );
	vec3 y = cross( viewDir, x );
	vec2 uv = vec2( dot( x, normal ), dot( y, normal ) ) * 0.495 + 0.5;
	#ifdef USE_MATCAP
		vec4 matcapColor = texture2D( matcap, uv );
	#else
		vec4 matcapColor = vec4( vec3( mix( 0.2, 0.8, uv.y ) ), 1.0 );
	#endif
	vec3 outgoingLight = diffuseColor.rgb * matcapColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`, vertex$7 = `#define NORMAL
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	vViewPosition = - mvPosition.xyz;
#endif
}`, fragment$7 = `#define NORMAL
uniform float opacity;
#if defined( FLAT_SHADED ) || defined( USE_BUMPMAP ) || defined( USE_NORMALMAP_TANGENTSPACE )
	varying vec3 vViewPosition;
#endif
#include <packing>
#include <uv_pars_fragment>
#include <normal_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( 0.0, 0.0, 0.0, opacity );
	#include <clipping_planes_fragment>
	#include <logdepthbuf_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	gl_FragColor = vec4( packNormalToRGB( normal ), diffuseColor.a );
	#ifdef OPAQUE
		gl_FragColor.a = 1.0;
	#endif
}`, vertex$6 = `#define PHONG
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <envmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <envmap_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`, fragment$6 = `#define PHONG
uniform vec3 diffuse;
uniform vec3 emissive;
uniform vec3 specular;
uniform float shininess;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_phong_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <specularmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <specularmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_phong_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
	#include <envmap_fragment>
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`, vertex$5 = `#define STANDARD
varying vec3 vViewPosition;
#ifdef USE_TRANSMISSION
	varying vec3 vWorldPosition;
#endif
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
#ifdef USE_TRANSMISSION
	vWorldPosition = worldPosition.xyz;
#endif
}`, fragment$5 = `#define STANDARD
#ifdef PHYSICAL
	#define IOR
	#define USE_SPECULAR
#endif
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float roughness;
uniform float metalness;
uniform float opacity;
#ifdef IOR
	uniform float ior;
#endif
#ifdef USE_SPECULAR
	uniform float specularIntensity;
	uniform vec3 specularColor;
	#ifdef USE_SPECULAR_COLORMAP
		uniform sampler2D specularColorMap;
	#endif
	#ifdef USE_SPECULAR_INTENSITYMAP
		uniform sampler2D specularIntensityMap;
	#endif
#endif
#ifdef USE_CLEARCOAT
	uniform float clearcoat;
	uniform float clearcoatRoughness;
#endif
#ifdef USE_DISPERSION
	uniform float dispersion;
#endif
#ifdef USE_IRIDESCENCE
	uniform float iridescence;
	uniform float iridescenceIOR;
	uniform float iridescenceThicknessMinimum;
	uniform float iridescenceThicknessMaximum;
#endif
#ifdef USE_SHEEN
	uniform vec3 sheenColor;
	uniform float sheenRoughness;
	#ifdef USE_SHEEN_COLORMAP
		uniform sampler2D sheenColorMap;
	#endif
	#ifdef USE_SHEEN_ROUGHNESSMAP
		uniform sampler2D sheenRoughnessMap;
	#endif
#endif
#ifdef USE_ANISOTROPY
	uniform vec2 anisotropyVector;
	#ifdef USE_ANISOTROPYMAP
		uniform sampler2D anisotropyMap;
	#endif
#endif
varying vec3 vViewPosition;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <iridescence_fragment>
#include <cube_uv_reflection_fragment>
#include <envmap_common_pars_fragment>
#include <envmap_physical_pars_fragment>
#include <fog_pars_fragment>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_physical_pars_fragment>
#include <transmission_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <clearcoat_pars_fragment>
#include <iridescence_pars_fragment>
#include <roughnessmap_pars_fragment>
#include <metalnessmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <roughnessmap_fragment>
	#include <metalnessmap_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <clearcoat_normal_fragment_begin>
	#include <clearcoat_normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_physical_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 totalDiffuse = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse;
	vec3 totalSpecular = reflectedLight.directSpecular + reflectedLight.indirectSpecular;
	#include <transmission_fragment>
	vec3 outgoingLight = totalDiffuse + totalSpecular + totalEmissiveRadiance;
	#ifdef USE_SHEEN
		float sheenEnergyComp = 1.0 - 0.157 * max3( material.sheenColor );
		outgoingLight = outgoingLight * sheenEnergyComp + sheenSpecularDirect + sheenSpecularIndirect;
	#endif
	#ifdef USE_CLEARCOAT
		float dotNVcc = saturate( dot( geometryClearcoatNormal, geometryViewDir ) );
		vec3 Fcc = F_Schlick( material.clearcoatF0, material.clearcoatF90, dotNVcc );
		outgoingLight = outgoingLight * ( 1.0 - material.clearcoat * Fcc ) + ( clearcoatSpecularDirect + clearcoatSpecularIndirect ) * material.clearcoat;
	#endif
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`, vertex$4 = `#define TOON
varying vec3 vViewPosition;
#include <common>
#include <batching_pars_vertex>
#include <uv_pars_vertex>
#include <displacementmap_pars_vertex>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <normal_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <shadowmap_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <normal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <displacementmap_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	vViewPosition = - mvPosition.xyz;
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`, fragment$4 = `#define TOON
uniform vec3 diffuse;
uniform vec3 emissive;
uniform float opacity;
#include <common>
#include <packing>
#include <dithering_pars_fragment>
#include <color_pars_fragment>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <aomap_pars_fragment>
#include <lightmap_pars_fragment>
#include <emissivemap_pars_fragment>
#include <gradientmap_pars_fragment>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <normal_pars_fragment>
#include <lights_toon_pars_fragment>
#include <shadowmap_pars_fragment>
#include <bumpmap_pars_fragment>
#include <normalmap_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
	vec3 totalEmissiveRadiance = emissive;
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <color_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	#include <normal_fragment_begin>
	#include <normal_fragment_maps>
	#include <emissivemap_fragment>
	#include <lights_toon_fragment>
	#include <lights_fragment_begin>
	#include <lights_fragment_maps>
	#include <lights_fragment_end>
	#include <aomap_fragment>
	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
	#include <dithering_fragment>
}`, vertex$3 = `uniform float size;
uniform float scale;
#include <common>
#include <color_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
#ifdef USE_POINTS_UV
	varying vec2 vUv;
	uniform mat3 uvTransform;
#endif
void main() {
	#ifdef USE_POINTS_UV
		vUv = ( uvTransform * vec3( uv, 1 ) ).xy;
	#endif
	#include <color_vertex>
	#include <morphinstance_vertex>
	#include <morphcolor_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <project_vertex>
	gl_PointSize = size;
	#ifdef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) gl_PointSize *= ( scale / - mvPosition.z );
	#endif
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <worldpos_vertex>
	#include <fog_vertex>
}`, fragment$3 = `uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <color_pars_fragment>
#include <map_particle_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_particle_fragment>
	#include <color_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
	#include <premultiplied_alpha_fragment>
}`, vertex$2 = `#include <common>
#include <batching_pars_vertex>
#include <fog_pars_vertex>
#include <morphtarget_pars_vertex>
#include <skinning_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <shadowmap_pars_vertex>
void main() {
	#include <batching_vertex>
	#include <beginnormal_vertex>
	#include <morphinstance_vertex>
	#include <morphnormal_vertex>
	#include <skinbase_vertex>
	#include <skinnormal_vertex>
	#include <defaultnormal_vertex>
	#include <begin_vertex>
	#include <morphtarget_vertex>
	#include <skinning_vertex>
	#include <project_vertex>
	#include <logdepthbuf_vertex>
	#include <worldpos_vertex>
	#include <shadowmap_vertex>
	#include <fog_vertex>
}`, fragment$2 = `uniform vec3 color;
uniform float opacity;
#include <common>
#include <packing>
#include <fog_pars_fragment>
#include <bsdfs>
#include <lights_pars_begin>
#include <logdepthbuf_pars_fragment>
#include <shadowmap_pars_fragment>
#include <shadowmask_pars_fragment>
void main() {
	#include <logdepthbuf_fragment>
	gl_FragColor = vec4( color, opacity * ( 1.0 - getShadowMask() ) );
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`, vertex$1 = `uniform float rotation;
uniform vec2 center;
#include <common>
#include <uv_pars_vertex>
#include <fog_pars_vertex>
#include <logdepthbuf_pars_vertex>
#include <clipping_planes_pars_vertex>
void main() {
	#include <uv_vertex>
	vec4 mvPosition = modelViewMatrix[ 3 ];
	vec2 scale = vec2( length( modelMatrix[ 0 ].xyz ), length( modelMatrix[ 1 ].xyz ) );
	#ifndef USE_SIZEATTENUATION
		bool isPerspective = isPerspectiveMatrix( projectionMatrix );
		if ( isPerspective ) scale *= - mvPosition.z;
	#endif
	vec2 alignedPosition = ( position.xy - ( center - vec2( 0.5 ) ) ) * scale;
	vec2 rotatedPosition;
	rotatedPosition.x = cos( rotation ) * alignedPosition.x - sin( rotation ) * alignedPosition.y;
	rotatedPosition.y = sin( rotation ) * alignedPosition.x + cos( rotation ) * alignedPosition.y;
	mvPosition.xy += rotatedPosition;
	gl_Position = projectionMatrix * mvPosition;
	#include <logdepthbuf_vertex>
	#include <clipping_planes_vertex>
	#include <fog_vertex>
}`, fragment$1 = `uniform vec3 diffuse;
uniform float opacity;
#include <common>
#include <uv_pars_fragment>
#include <map_pars_fragment>
#include <alphamap_pars_fragment>
#include <alphatest_pars_fragment>
#include <alphahash_pars_fragment>
#include <fog_pars_fragment>
#include <logdepthbuf_pars_fragment>
#include <clipping_planes_pars_fragment>
void main() {
	vec4 diffuseColor = vec4( diffuse, opacity );
	#include <clipping_planes_fragment>
	vec3 outgoingLight = vec3( 0.0 );
	#include <logdepthbuf_fragment>
	#include <map_fragment>
	#include <alphamap_fragment>
	#include <alphatest_fragment>
	#include <alphahash_fragment>
	outgoingLight = diffuseColor.rgb;
	#include <opaque_fragment>
	#include <tonemapping_fragment>
	#include <colorspace_fragment>
	#include <fog_fragment>
}`, ShaderChunk = {
  alphahash_fragment,
  alphahash_pars_fragment,
  alphamap_fragment,
  alphamap_pars_fragment,
  alphatest_fragment,
  alphatest_pars_fragment,
  aomap_fragment,
  aomap_pars_fragment,
  batching_pars_vertex,
  batching_vertex,
  begin_vertex,
  beginnormal_vertex,
  bsdfs,
  iridescence_fragment,
  bumpmap_pars_fragment,
  clipping_planes_fragment,
  clipping_planes_pars_fragment,
  clipping_planes_pars_vertex,
  clipping_planes_vertex,
  color_fragment,
  color_pars_fragment,
  color_pars_vertex,
  color_vertex,
  common,
  cube_uv_reflection_fragment,
  defaultnormal_vertex,
  displacementmap_pars_vertex,
  displacementmap_vertex,
  emissivemap_fragment,
  emissivemap_pars_fragment,
  colorspace_fragment,
  colorspace_pars_fragment,
  envmap_fragment,
  envmap_common_pars_fragment,
  envmap_pars_fragment,
  envmap_pars_vertex,
  envmap_physical_pars_fragment,
  envmap_vertex,
  fog_vertex,
  fog_pars_vertex,
  fog_fragment,
  fog_pars_fragment,
  gradientmap_pars_fragment,
  lightmap_pars_fragment,
  lights_lambert_fragment,
  lights_lambert_pars_fragment,
  lights_pars_begin,
  lights_toon_fragment,
  lights_toon_pars_fragment,
  lights_phong_fragment,
  lights_phong_pars_fragment,
  lights_physical_fragment,
  lights_physical_pars_fragment,
  lights_fragment_begin,
  lights_fragment_maps,
  lights_fragment_end,
  logdepthbuf_fragment,
  logdepthbuf_pars_fragment,
  logdepthbuf_pars_vertex,
  logdepthbuf_vertex,
  map_fragment,
  map_pars_fragment,
  map_particle_fragment,
  map_particle_pars_fragment,
  metalnessmap_fragment,
  metalnessmap_pars_fragment,
  morphinstance_vertex,
  morphcolor_vertex,
  morphnormal_vertex,
  morphtarget_pars_vertex,
  morphtarget_vertex,
  normal_fragment_begin,
  normal_fragment_maps,
  normal_pars_fragment,
  normal_pars_vertex,
  normal_vertex,
  normalmap_pars_fragment,
  clearcoat_normal_fragment_begin,
  clearcoat_normal_fragment_maps,
  clearcoat_pars_fragment,
  iridescence_pars_fragment,
  opaque_fragment,
  packing,
  premultiplied_alpha_fragment,
  project_vertex,
  dithering_fragment,
  dithering_pars_fragment,
  roughnessmap_fragment,
  roughnessmap_pars_fragment,
  shadowmap_pars_fragment,
  shadowmap_pars_vertex,
  shadowmap_vertex,
  shadowmask_pars_fragment,
  skinbase_vertex,
  skinning_pars_vertex,
  skinning_vertex,
  skinnormal_vertex,
  specularmap_fragment,
  specularmap_pars_fragment,
  tonemapping_fragment,
  tonemapping_pars_fragment,
  transmission_fragment,
  transmission_pars_fragment,
  uv_pars_fragment,
  uv_pars_vertex,
  uv_vertex,
  worldpos_vertex,
  background_vert: vertex$h,
  background_frag: fragment$h,
  backgroundCube_vert: vertex$g,
  backgroundCube_frag: fragment$g,
  cube_vert: vertex$f,
  cube_frag: fragment$f,
  depth_vert: vertex$e,
  depth_frag: fragment$e,
  distanceRGBA_vert: vertex$d,
  distanceRGBA_frag: fragment$d,
  equirect_vert: vertex$c,
  equirect_frag: fragment$c,
  linedashed_vert: vertex$b,
  linedashed_frag: fragment$b,
  meshbasic_vert: vertex$a,
  meshbasic_frag: fragment$a,
  meshlambert_vert: vertex$9,
  meshlambert_frag: fragment$9,
  meshmatcap_vert: vertex$8,
  meshmatcap_frag: fragment$8,
  meshnormal_vert: vertex$7,
  meshnormal_frag: fragment$7,
  meshphong_vert: vertex$6,
  meshphong_frag: fragment$6,
  meshphysical_vert: vertex$5,
  meshphysical_frag: fragment$5,
  meshtoon_vert: vertex$4,
  meshtoon_frag: fragment$4,
  points_vert: vertex$3,
  points_frag: fragment$3,
  shadow_vert: vertex$2,
  shadow_frag: fragment$2,
  sprite_vert: vertex$1,
  sprite_frag: fragment$1
}, UniformsLib = {
  common: {
    diffuse: { value: /* @__PURE__ */ new Color(16777215) },
    opacity: { value: 1 },
    map: { value: null },
    mapTransform: { value: /* @__PURE__ */ new Matrix3() },
    alphaMap: { value: null },
    alphaMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    alphaTest: { value: 0 }
  },
  specularmap: {
    specularMap: { value: null },
    specularMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  envmap: {
    envMap: { value: null },
    envMapRotation: { value: /* @__PURE__ */ new Matrix3() },
    flipEnvMap: { value: -1 },
    reflectivity: { value: 1 },
    // basic, lambert, phong
    ior: { value: 1.5 },
    // physical
    refractionRatio: { value: 0.98 }
    // basic, lambert, phong
  },
  aomap: {
    aoMap: { value: null },
    aoMapIntensity: { value: 1 },
    aoMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  lightmap: {
    lightMap: { value: null },
    lightMapIntensity: { value: 1 },
    lightMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  bumpmap: {
    bumpMap: { value: null },
    bumpMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    bumpScale: { value: 1 }
  },
  normalmap: {
    normalMap: { value: null },
    normalMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    normalScale: { value: /* @__PURE__ */ new Vector2(1, 1) }
  },
  displacementmap: {
    displacementMap: { value: null },
    displacementMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    displacementScale: { value: 1 },
    displacementBias: { value: 0 }
  },
  emissivemap: {
    emissiveMap: { value: null },
    emissiveMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  metalnessmap: {
    metalnessMap: { value: null },
    metalnessMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  roughnessmap: {
    roughnessMap: { value: null },
    roughnessMapTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  gradientmap: {
    gradientMap: { value: null }
  },
  fog: {
    fogDensity: { value: 25e-5 },
    fogNear: { value: 1 },
    fogFar: { value: 2e3 },
    fogColor: { value: /* @__PURE__ */ new Color(16777215) }
  },
  lights: {
    ambientLightColor: { value: [] },
    lightProbe: { value: [] },
    directionalLights: { value: [], properties: {
      direction: {},
      color: {}
    } },
    directionalLightShadows: { value: [], properties: {
      shadowIntensity: 1,
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {}
    } },
    directionalShadowMap: { value: [] },
    directionalShadowMatrix: { value: [] },
    spotLights: { value: [], properties: {
      color: {},
      position: {},
      direction: {},
      distance: {},
      coneCos: {},
      penumbraCos: {},
      decay: {}
    } },
    spotLightShadows: { value: [], properties: {
      shadowIntensity: 1,
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {}
    } },
    spotLightMap: { value: [] },
    spotShadowMap: { value: [] },
    spotLightMatrix: { value: [] },
    pointLights: { value: [], properties: {
      color: {},
      position: {},
      decay: {},
      distance: {}
    } },
    pointLightShadows: { value: [], properties: {
      shadowIntensity: 1,
      shadowBias: {},
      shadowNormalBias: {},
      shadowRadius: {},
      shadowMapSize: {},
      shadowCameraNear: {},
      shadowCameraFar: {}
    } },
    pointShadowMap: { value: [] },
    pointShadowMatrix: { value: [] },
    hemisphereLights: { value: [], properties: {
      direction: {},
      skyColor: {},
      groundColor: {}
    } },
    // TODO (abelnation): RectAreaLight BRDF data needs to be moved from example to main src
    rectAreaLights: { value: [], properties: {
      color: {},
      position: {},
      width: {},
      height: {}
    } },
    ltc_1: { value: null },
    ltc_2: { value: null }
  },
  points: {
    diffuse: { value: /* @__PURE__ */ new Color(16777215) },
    opacity: { value: 1 },
    size: { value: 1 },
    scale: { value: 1 },
    map: { value: null },
    alphaMap: { value: null },
    alphaMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    alphaTest: { value: 0 },
    uvTransform: { value: /* @__PURE__ */ new Matrix3() }
  },
  sprite: {
    diffuse: { value: /* @__PURE__ */ new Color(16777215) },
    opacity: { value: 1 },
    center: { value: /* @__PURE__ */ new Vector2(0.5, 0.5) },
    rotation: { value: 0 },
    map: { value: null },
    mapTransform: { value: /* @__PURE__ */ new Matrix3() },
    alphaMap: { value: null },
    alphaMapTransform: { value: /* @__PURE__ */ new Matrix3() },
    alphaTest: { value: 0 }
  }
}, ShaderLib = {
  basic: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.meshbasic_vert,
    fragmentShader: ShaderChunk.meshbasic_frag
  },
  lambert: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) }
      }
    ]),
    vertexShader: ShaderChunk.meshlambert_vert,
    fragmentShader: ShaderChunk.meshlambert_frag
  },
  phong: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.specularmap,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) },
        specular: { value: /* @__PURE__ */ new Color(1118481) },
        shininess: { value: 30 }
      }
    ]),
    vertexShader: ShaderChunk.meshphong_vert,
    fragmentShader: ShaderChunk.meshphong_frag
  },
  standard: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.envmap,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.roughnessmap,
      UniformsLib.metalnessmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) },
        roughness: { value: 1 },
        metalness: { value: 0 },
        envMapIntensity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.meshphysical_vert,
    fragmentShader: ShaderChunk.meshphysical_frag
  },
  toon: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.aomap,
      UniformsLib.lightmap,
      UniformsLib.emissivemap,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.gradientmap,
      UniformsLib.fog,
      UniformsLib.lights,
      {
        emissive: { value: /* @__PURE__ */ new Color(0) }
      }
    ]),
    vertexShader: ShaderChunk.meshtoon_vert,
    fragmentShader: ShaderChunk.meshtoon_frag
  },
  matcap: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      UniformsLib.fog,
      {
        matcap: { value: null }
      }
    ]),
    vertexShader: ShaderChunk.meshmatcap_vert,
    fragmentShader: ShaderChunk.meshmatcap_frag
  },
  points: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.points,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.points_vert,
    fragmentShader: ShaderChunk.points_frag
  },
  dashed: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.fog,
      {
        scale: { value: 1 },
        dashSize: { value: 1 },
        totalSize: { value: 2 }
      }
    ]),
    vertexShader: ShaderChunk.linedashed_vert,
    fragmentShader: ShaderChunk.linedashed_frag
  },
  depth: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.displacementmap
    ]),
    vertexShader: ShaderChunk.depth_vert,
    fragmentShader: ShaderChunk.depth_frag
  },
  normal: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.bumpmap,
      UniformsLib.normalmap,
      UniformsLib.displacementmap,
      {
        opacity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.meshnormal_vert,
    fragmentShader: ShaderChunk.meshnormal_frag
  },
  sprite: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.sprite,
      UniformsLib.fog
    ]),
    vertexShader: ShaderChunk.sprite_vert,
    fragmentShader: ShaderChunk.sprite_frag
  },
  background: {
    uniforms: {
      uvTransform: { value: /* @__PURE__ */ new Matrix3() },
      t2D: { value: null },
      backgroundIntensity: { value: 1 }
    },
    vertexShader: ShaderChunk.background_vert,
    fragmentShader: ShaderChunk.background_frag
  },
  backgroundCube: {
    uniforms: {
      envMap: { value: null },
      flipEnvMap: { value: -1 },
      backgroundBlurriness: { value: 0 },
      backgroundIntensity: { value: 1 },
      backgroundRotation: { value: /* @__PURE__ */ new Matrix3() }
    },
    vertexShader: ShaderChunk.backgroundCube_vert,
    fragmentShader: ShaderChunk.backgroundCube_frag
  },
  cube: {
    uniforms: {
      tCube: { value: null },
      tFlip: { value: -1 },
      opacity: { value: 1 }
    },
    vertexShader: ShaderChunk.cube_vert,
    fragmentShader: ShaderChunk.cube_frag
  },
  equirect: {
    uniforms: {
      tEquirect: { value: null }
    },
    vertexShader: ShaderChunk.equirect_vert,
    fragmentShader: ShaderChunk.equirect_frag
  },
  distanceRGBA: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.common,
      UniformsLib.displacementmap,
      {
        referencePosition: { value: /* @__PURE__ */ new Vector3() },
        nearDistance: { value: 1 },
        farDistance: { value: 1e3 }
      }
    ]),
    vertexShader: ShaderChunk.distanceRGBA_vert,
    fragmentShader: ShaderChunk.distanceRGBA_frag
  },
  shadow: {
    uniforms: /* @__PURE__ */ mergeUniforms([
      UniformsLib.lights,
      UniformsLib.fog,
      {
        color: { value: /* @__PURE__ */ new Color(0) },
        opacity: { value: 1 }
      }
    ]),
    vertexShader: ShaderChunk.shadow_vert,
    fragmentShader: ShaderChunk.shadow_frag
  }
};
ShaderLib.physical = {
  uniforms: /* @__PURE__ */ mergeUniforms([
    ShaderLib.standard.uniforms,
    {
      clearcoat: { value: 0 },
      clearcoatMap: { value: null },
      clearcoatMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      clearcoatNormalMap: { value: null },
      clearcoatNormalMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      clearcoatNormalScale: { value: /* @__PURE__ */ new Vector2(1, 1) },
      clearcoatRoughness: { value: 0 },
      clearcoatRoughnessMap: { value: null },
      clearcoatRoughnessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      dispersion: { value: 0 },
      iridescence: { value: 0 },
      iridescenceMap: { value: null },
      iridescenceMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      iridescenceIOR: { value: 1.3 },
      iridescenceThicknessMinimum: { value: 100 },
      iridescenceThicknessMaximum: { value: 400 },
      iridescenceThicknessMap: { value: null },
      iridescenceThicknessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      sheen: { value: 0 },
      sheenColor: { value: /* @__PURE__ */ new Color(0) },
      sheenColorMap: { value: null },
      sheenColorMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      sheenRoughness: { value: 1 },
      sheenRoughnessMap: { value: null },
      sheenRoughnessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      transmission: { value: 0 },
      transmissionMap: { value: null },
      transmissionMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      transmissionSamplerSize: { value: /* @__PURE__ */ new Vector2() },
      transmissionSamplerMap: { value: null },
      thickness: { value: 0 },
      thicknessMap: { value: null },
      thicknessMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      attenuationDistance: { value: 0 },
      attenuationColor: { value: /* @__PURE__ */ new Color(0) },
      specularColor: { value: /* @__PURE__ */ new Color(1, 1, 1) },
      specularColorMap: { value: null },
      specularColorMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      specularIntensity: { value: 1 },
      specularIntensityMap: { value: null },
      specularIntensityMapTransform: { value: /* @__PURE__ */ new Matrix3() },
      anisotropyVector: { value: /* @__PURE__ */ new Vector2() },
      anisotropyMap: { value: null },
      anisotropyMapTransform: { value: /* @__PURE__ */ new Matrix3() }
    }
  ]),
  vertexShader: ShaderChunk.meshphysical_vert,
  fragmentShader: ShaderChunk.meshphysical_frag
};
var PHI = (1 + Math.sqrt(5)) / 2, INV_PHI = 1 / PHI, _axisDirections = [
  /* @__PURE__ */ new Vector3(-PHI, INV_PHI, 0),
  /* @__PURE__ */ new Vector3(PHI, INV_PHI, 0),
  /* @__PURE__ */ new Vector3(-INV_PHI, 0, PHI),
  /* @__PURE__ */ new Vector3(INV_PHI, 0, PHI),
  /* @__PURE__ */ new Vector3(0, PHI, -INV_PHI),
  /* @__PURE__ */ new Vector3(0, PHI, INV_PHI),
  /* @__PURE__ */ new Vector3(-1, 1, -1),
  /* @__PURE__ */ new Vector3(1, 1, -1),
  /* @__PURE__ */ new Vector3(-1, 1, 1),
  /* @__PURE__ */ new Vector3(1, 1, 1)
];
var mat4array = new Float32Array(16), mat3array = new Float32Array(9), mat2array = new Float32Array(4);
var reversedFuncs = {
  [NeverDepth]: AlwaysDepth,
  [LessDepth]: GreaterDepth,
  [EqualDepth]: NotEqualDepth,
  [LessEqualDepth]: GreaterEqualDepth,
  [AlwaysDepth]: NeverDepth,
  [GreaterDepth]: LessDepth,
  [NotEqualDepth]: EqualDepth,
  [GreaterEqualDepth]: LessEqualDepth
};

// src/Core/world.js
var WORLD_SCALE = 2.8, TUBE_SCALE = 1.8, SIZE_K = 2.8 * 1.52, ANCHO_K = 1.52, AK = ANCHO_K, TRACK_K = 4.7, TK = TRACK_K, WS = WORLD_SCALE * TK, NODE_R = 8.5 * TK, BALL_R = 0.4, MIN_GAP_K = 1.5, Y = new Vector3(0, 1, 0), X = new Vector3(1, 0, 0), TAU = Math.PI * 2;
var DIAG = { on: !1, rechazos: {} }, rej = (k) => (DIAG.on && (DIAG.rechazos[k] = (DIAG.rechazos[k] || 0) + 1), null);
function mulberry32(a) {
  return () => {
    a |= 0, a = a + 1831565813 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    return t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t, ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
var THEMES = [
  { id: "sombrio", name: "Camino Sombr\xEDo", emoji: "\u{1F311}", risk: 0.9, ecost: 1.2, pps: -0.5 },
  { id: "bosque", name: "Camino del Bosque", emoji: "\u{1F332}", risk: 0.3, ecost: 0.8, pps: 0.2 },
  { id: "mar", name: "Camino del Mar", emoji: "\u{1F30A}", risk: 0.5, ecost: 1, pps: 0.1 },
  { id: "desierto", name: "Camino del Desierto", emoji: "\u{1F335}", risk: 0.6, ecost: 1.5, pps: -0.2 },
  { id: "hielo", name: "Camino de Hielo", emoji: "\u2744\uFE0F", risk: 0.5, ecost: 0.5, pps: -0.1 },
  { id: "volcan", name: "Camino del Volc\xE1n", emoji: "\u{1F30B}", risk: 1, ecost: 1.7, pps: 0.6 },
  { id: "cristal", name: "Camino de Cristal", emoji: "\u{1F48E}", risk: 0.4, ecost: 0.9, pps: 0.4 },
  { id: "nubes", name: "Camino de las Nubes", emoji: "\u2601\uFE0F", risk: 0.2, ecost: 0.6, pps: 0 },
  { id: "neon", name: "Camino Ne\xF3n", emoji: "\u{1F303}", risk: 0.7, ecost: 1.1, pps: 0.5 },
  { id: "jardin", name: "Camino del Jard\xEDn", emoji: "\u{1F338}", risk: 0.1, ecost: 0.7, pps: 0.15 }
], scaleParam = ({ bow, arch, spread, radius, ...rest }) => ({
  ...rest,
  bow: +(bow * WORLD_SCALE * SIZE_K).toFixed(1) * TK,
  arch: +(arch * WORLD_SCALE * SIZE_K).toFixed(1) * TK,
  spread: +(spread * WORLD_SCALE).toFixed(1) * TK * AK * 1.14,
  // 1.14: routeExtent creció algo más que ANCHO_K (56.8 / 49.9)
  radius: +(radius * TUBE_SCALE).toFixed(2) * TK
}), PARAMS = {
  sombrio: scaleParam({ n: 3, bow: 36, arch: -16, spread: 21, phase: 0.4, coil: 0.8, turns: 1, radius: 1.15, fav: ["pantano", "erupcion", "caida", "embudo", "sacacorchos"] }),
  bosque: scaleParam({ n: 2, bow: 34, arch: 8, spread: 23, phase: 1.2, coil: 1.35, turns: 1, radius: 1.5, fav: ["pantano", "cascada", "espiral", "horquilla", "rampa"] }),
  mar: scaleParam({ n: 3, bow: 38, arch: 0, spread: 23, phase: 2.2, coil: 1.1, turns: 0, radius: 1.35, fav: ["cascada", "geiser", "embudo", "rizo", "trampolin"] }),
  desierto: scaleParam({ n: 2, bow: 40, arch: 18, spread: 20, phase: 0, coil: 1, turns: 0, radius: 1.4, fav: ["turbina", "caida", "espiral", "canon", "rampa"] }),
  hielo: scaleParam({ n: 3, bow: 35, arch: -9, spread: 23, phase: 3, coil: 0.9, turns: 2, radius: 1.2, fav: ["hielo_resbaloso", "cascada", "espiral", "horquilla", "sacacorchos"] }),
  volcan: scaleParam({ n: 3, bow: 34, arch: 26, spread: 20, phase: 1.6, coil: 1.2, turns: 1, radius: 1.3, fav: ["erupcion", "canon", "caida", "espiral", "rizo"] }),
  cristal: scaleParam({ n: 2, bow: 37, arch: 6, spread: 21, phase: 0.8, coil: 0.75, turns: 2, radius: 1.1, fav: ["portal", "hielo_resbaloso", "espiral", "embudo", "sacacorchos"] }),
  nubes: scaleParam({ n: 3, bow: 39, arch: 20, spread: 23, phase: 2.6, coil: 1.3, turns: 0, radius: 1.6, fav: ["geiser", "turbina", "embudo", "caida", "trampolin"] }),
  neon: scaleParam({ n: 3, bow: 34, arch: 5, spread: 21, phase: 3.6, coil: 1, turns: 1, radius: 1.25, fav: ["portal", "turbina", "caida", "cascada", "rizo"] }),
  jardin: scaleParam({ n: 2, bow: 34, arch: 11, spread: 23, phase: 1.9, coil: 1.15, turns: 0, radius: 1.45, fav: ["cascada", "geiser", "pantano", "espiral", "trampolin"] })
}, KINDS = {
  salida: { name: "Lanzadera", emoji: "\u{1F680}", boost: 14, drag: 1, speedK: 1.2, risk: 0.2 },
  llegada: { name: "Llegada", emoji: "\u{1F3C1}", boost: 0, drag: 1.5, speedK: 0.9, risk: 0 },
  rampa: { name: "Rampa", emoji: "\u{1F6DD}", w: 1, boost: 0, drag: 1, speedK: 1.05, risk: 0.1 },
  horquilla: { name: "Horquilla", emoji: "\u21A9\uFE0F", w: 1.2, boost: 0, drag: 1.2, speedK: 0.85, risk: 0.3 },
  rizo: { name: "Rizo", emoji: "\u27B0", w: 1.1, boost: 17, drag: 0.6, speedK: 1.3, risk: 0.8 },
  sacacorchos: { name: "Sacacorchos", emoji: "\u{1F9EC}", w: 1.1, boost: 11, drag: 1, speedK: 1.1, risk: 0.5 },
  trampolin: { name: "Trampol\xEDn", emoji: "\u{1F938}", w: 1.2, boost: 15, drag: 0, speedK: 1.25, risk: 0.7, air: !0 },
  canon: { name: "Ca\xF1\xF3n", emoji: "\u{1F4A5}", w: 1.6, boost: 30, drag: 0, speedK: 1.55, risk: 1, air: !0 },
  turbina: { name: "Turbina", emoji: "\u{1F4A8}", w: 1.3, boost: 21, drag: 0.5, speedK: 1.35, risk: 0.6, event: !0 },
  hielo_resbaloso: { name: "Hielo resbaloso", emoji: "\u{1F9CA}", w: 1.5, boost: 12, drag: 0.15, speedK: 1.65, risk: 0.45, event: !0 },
  pantano: { name: "Pantano", emoji: "\u{1FAE7}", w: 1.3, boost: 0, drag: 3.2, speedK: 0.52, risk: 0.2, event: !0 },
  portal: { name: "Portal", emoji: "\u{1F300}", w: 0.95, boost: 34, drag: 0, speedK: 2, risk: 0.65, air: !0, event: !0 },
  geiser: { name: "G\xE9iser", emoji: "\u26F2", w: 1.3, boost: 25, drag: 0, speedK: 1.35, risk: 0.75, air: !0, event: !0 },
  erupcion: { name: "Erupci\xF3n", emoji: "\u{1F30B}", w: 1.4, boost: 31, drag: 0, speedK: 1.45, risk: 0.95, air: !0, event: !0 },
  espiral: { name: "Espiral", emoji: "\u{1F300}", w: 0.9, boost: 0, drag: 0.8, speedK: 1, risk: 0.5, drop: 12 * WS * 1.52 },
  caida: { name: "Ca\xEDda libre", emoji: "\u{1FA82}", w: 0.75, boost: 0, drag: 0, speedK: 1.45, risk: 0.9, drop: 13 * WS * 1.52, air: !0 },
  cascada: { name: "Cascada", emoji: "\u{1FA9C}", w: 1.2, boost: 0, drag: 1.1, speedK: 1.15, risk: 0.4, drop: 10 * WS * 1.52, event: !0 },
  embudo: { name: "Embudo", emoji: "\u{1F32A}\uFE0F", w: 0.85, boost: 0, drag: 4, speedK: 0.65, risk: 0.5, drop: 9 * WS * 1.52 }
}, MECHANISMS = {
  rampa: { name: "Rampa", emoji: "\u{1F6DD}", style: "salto", dur: 0.9, risk: 0.2, fail: 0.04, reward: { p: 0.8, e: -0.3 }, boost: 1.05 },
  trampolin: { name: "Trampol\xEDn", emoji: "\u{1F938}", style: "salto", dur: 1, risk: 0.45, fail: 0.08, reward: { p: 1.8, e: -0.6 }, boost: 1.1 },
  turbina: { name: "Turbina", emoji: "\u{1F4A8}", style: "salto", dur: 1.1, risk: 0.5, fail: 0.1, reward: { p: 2, e: -0.8 }, boost: 1.15 },
  portal: { name: "Portal", emoji: "\u{1F300}", style: "portal", dur: 0.6, risk: 0.55, fail: 0.12, reward: { p: 3, e: -1 }, boost: 1.2 },
  iman: { name: "Im\xE1n", emoji: "\u{1F9F2}", style: "pared", dur: 1.2, risk: 0.15, fail: 0.03, reward: { p: 0.6, e: 0 }, boost: 1 },
  bumper: { name: "Bumper", emoji: "\u{1F534}", style: "salto", dur: 0.6, risk: 0.6, fail: 0.15, reward: { p: 2.4, e: -0.5 }, boost: 1.05 },
  resorte: { name: "Resorte", emoji: "\u{1F300}", style: "salto", dur: 0.8, risk: 0.35, fail: 0.07, reward: { p: 1.2, e: -0.3 }, boost: 1.08 },
  remolino: { name: "Remolino", emoji: "\u{1F32A}\uFE0F", style: "pared", dur: 1.5, risk: 0.4, fail: 0.08, reward: { p: 1.2, e: 0.3 }, boost: 0.95 },
  erupcion: { name: "Erupci\xF3n", emoji: "\u{1F30B}", style: "salto", dur: 1.3, risk: 0.9, fail: 0.22, reward: { p: 4, e: -1.5 }, boost: 1.25 },
  geiser: { name: "G\xE9iser", emoji: "\u26F2", style: "salto", dur: 1.1, risk: 0.7, fail: 0.16, reward: { p: 3, e: -1 }, boost: 1.18 },
  cinta: { name: "Cinta transportadora", emoji: "\u27BF", style: "pared", dur: 1.6, risk: 0.05, fail: 0.01, reward: { p: 0.3, e: 1.2 }, boost: 1 },
  tirolina: { name: "Tirolina", emoji: "\u{1FAA2}", style: "salto", dur: 1.5, risk: 0.5, fail: 0.1, reward: { p: 2.2, e: 0 }, boost: 1.1 },
  cascada: { name: "Cascada", emoji: "\u{1FA9C}", style: "pared", dur: 1.2, risk: 0.35, fail: 0.06, reward: { p: 1.2, e: 0.6 }, boost: 1.05 },
  pantano: { name: "Pantano", emoji: "\u{1FAE7}", style: "pared", dur: 2, risk: 0.15, fail: 0.04, reward: { p: 0.3, e: 1.5 }, boost: 0.85 },
  hielo_resbaloso: { name: "Hielo resbaloso", emoji: "\u{1F9CA}", style: "pared", dur: 0.9, risk: 0.45, fail: 0.1, reward: { p: 1.8, e: -0.3 }, boost: 1.12 },
  canon: { name: "Ca\xF1\xF3n", emoji: "\u{1F4A5}", style: "salto", dur: 0.9, risk: 0.95, fail: 0.2, reward: { p: 3.6, e: -1.2 }, boost: 1.25 },
  caida: { name: "Ca\xEDda", emoji: "\u{1F573}\uFE0F", style: "caida", dur: 1, risk: 0.8, fail: 0.18, reward: { p: 2.6, e: -0.5 }, boost: 1.1 },
  arbol: { name: "\xC1rbol puente", emoji: "\u{1F333}", style: "salto", dur: 1.1, risk: 0.3, fail: 0.05, reward: { p: 1.1, e: 0.2 }, boost: 1.05 },
  viento: { name: "R\xE1faga de viento", emoji: "\u{1F4A8}", style: "salto", dur: 0.9, risk: 0.4, fail: 0.08, reward: { p: 1.4, e: -0.1 }, boost: 1.1 },
  salto: { name: "Salto", emoji: "\u{1F998}", style: "arco", dur: 1, risk: 0.4, fail: 0.07, reward: { p: 1.4, e: -0.4 }, boost: 1.08 },
  botado: { name: "Botado", emoji: "\u{1F3C0}", style: "arco", dur: 1.15, risk: 0.5, fail: 0.09, reward: { p: 1.8, e: -0.3 }, boost: 1.1 },
  elevador: { name: "Elevador", emoji: "\u{1F6D7}", style: "elevador", dur: 1.8, risk: 0.1, fail: 0.02, reward: { p: 0.6, e: 0.4 }, boost: 1 },
  laberinto: { name: "Laberinto", emoji: "\u{1F300}", style: "laberinto", dur: 2.8, risk: 0.25, fail: 0.04, reward: { p: 2, e: -0.6 }, boost: 0.95 }
}, CARRILES = 5, CAMBIOS = { salto: "arco", botado: "arco", rampa: "arco", caida: "caida", portal: "portal", elevador: "elevador", laberinto: "laberinto", geiser: "arco", erupcion: "arco", tirolina: "arco" }, THEME_CAMBIOS = {
  mar: { arriba: ["geiser"] },
  volcan: { arriba: ["erupcion"] },
  jardin: { arriba: ["geiser"], abajo: ["tirolina"] },
  bosque: { abajo: ["tirolina"] },
  nubes: { abajo: ["tirolina"] },
  cristal: { nivel: ["portal"] },
  neon: { nivel: ["portal"] },
  sombrio: { nivel: ["portal"] }
}, THEME_MECHS = {
  sombrio: { iman: "Im\xE1n de sombras", remolino: "Remolino umbr\xEDo", portal: "Grieta-portal" },
  bosque: { rampa: "Tronco-rampa", tirolina: "Liana-tirolina", resorte: "Hongo-resorte", arbol: "Puente de \xE1rbol" },
  mar: { remolino: "Remolino marino", geiser: "Chorro de ballena", cinta: "Corriente marina", viento: "Viento de cola" },
  desierto: { turbina: "Tolvanera", rampa: "Duna-rampa", resorte: "Cactus-resorte", viento: "Viento del desierto" },
  hielo: { rampa: "Ventisquero", cinta: "Glaciar deslizante", bumper: "Car\xE1mbano-bumper" },
  volcan: { erupcion: "Erupci\xF3n", geiser: "Fumarola", rampa: "Colada-rampa" },
  cristal: { portal: "Prisma-portal", iman: "Im\xE1n de cuarzo", bumper: "Geoda-bumper" },
  nubes: { turbina: "R\xE1faga", trampolin: "Nube-trampol\xEDn", tirolina: "Arco\xEDris-tirolina", viento: "Corriente de aire" },
  neon: { bumper: "Bumper ne\xF3n", portal: "Portal ne\xF3n", cinta: "Cinta l\xE1ser" },
  jardin: { resorte: "Flor-resorte", tirolina: "Enredadera", trampolin: "Nen\xFAfar-trampol\xEDn", arbol: "Rama puente" }
}, LANE_NAMES = ["suelo", "pared derecha", "techo", "pared izquierda", "espiral"], FLEX = ["rampa", "horquilla", "rizo", "sacacorchos", "trampolin", "canon", "turbina", "hielo_resbaloso", "pantano", "portal", "geiser", "erupcion"], GRAV = ["espiral", "caida", "cascada", "embudo"], OBSTACLES = [...FLEX, ...GRAV], DEST_NAMES = {
  puntos: ["Arcade", "Torneo", "Mercado", "Galer\xEDa", "Concurso", "Subasta", "Carrera", "Feria"],
  energia: ["Fuente", "Siesta", "Banquete", "Spa", "Hamaca", "Hoguera", "Manantial", "Picnic"]
}, NODE_DEFS = [
  { name: "Eco", color: "#c77dff", n: 8, bias: 0.5 },
  { name: "Cima", color: "#6bcb77", n: 3, bias: 0.35 },
  { name: "Delta", color: "#4d96ff", n: 5, bias: 0.5 },
  { name: "Alba", color: "#ffb347", n: 4, bias: 0.5 },
  { name: "Brasa", color: "#ff6b6b", n: 6, bias: 0.65 }
], SPHERE_R = 52 * WS * Math.sqrt(NODE_DEFS.length) * SIZE_K;
function sphereDirs(n) {
  let d = Array.from({ length: n }, (_, i) => {
    let y = 1 - 2 * (i + 0.5) / n, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5)) + 0.7;
    return new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
  });
  for (let it = 0; it < 60; it++) {
    let f = d.map((p, i) => d.reduce((s, q, j) => i === j ? s : s.addScaledVector(p.clone().sub(q), 1 / Math.pow(p.distanceTo(q), 3)), new Vector3()));
    d.forEach((p, i) => p.addScaledVector(f[i], 0.02).normalize());
  }
  return d.map((p) => p.applyAxisAngle(X, 0.5).applyAxisAngle(Y, 0.3));
}
var ri = (rng, a, b) => Math.round(a + rng() * (b - a)), clamp2 = (x, a, b) => Math.min(b, Math.max(a, x)), shuffle = (arr, rng) => {
  for (let i = arr.length - 1; i > 0; i--) {
    let j = Math.floor(rng() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
};
function slerpDir(a, b, t, out = new Vector3()) {
  let w = a.angleTo(b);
  if (w < 1e-4) return out.copy(a);
  let s = Math.sin(w), ka = Math.sin((1 - t) * w) / s;
  return out.copy(a).multiplyScalar(ka).addScaledVector(b, Math.sin(t * w) / s);
}
function cityPath(node, a, b) {
  let path2 = [a];
  for (; a !== b; )
    a = node.hop[a][b], path2.push(a);
  return path2;
}
function angDiff(a, b) {
  let d = (b - a) % TAU;
  return d > Math.PI && (d -= TAU), d <= -Math.PI && (d += TAU), d;
}
function canonDown(T, out = new Vector3()) {
  return out.set(0, -1, 0).addScaledVector(T, T.y), out.lengthSq() < 0.02 && out.set(1, 0, 0).addScaledVector(T, -T.x), out.normalize();
}
var FRAME_TMP = new Vector3();
function sampleChain(segs, pinEnd) {
  let q = new Quaternion(), T = new Vector3(), Tprev = new Vector3(), D = new Vector3(), hasPrev = !1, total = 0, data = [];
  for (let s of segs) {
    let n = clamp2(Math.ceil(s.length / (0.25 * TK)), 24, 2e3), Ts = new Float32Array((n + 1) * 3), Ds = new Float32Array((n + 1) * 3);
    for (let i = 0; i <= n; i++) {
      let t = s.curve.getUtoTmapping(i / n);
      s.curve.getPoint(Math.max(0, t - 1e-4), FRAME_TMP), s.curve.getPoint(Math.min(1, t + 1e-4), T), T.sub(FRAME_TMP).normalize(), hasPrev ? (q.setFromUnitVectors(Tprev, T), D.applyQuaternion(q)) : (canonDown(T, D), hasPrev = !0), D.addScaledVector(T, -D.dot(T)), D.lengthSq() < 1e-8 && canonDown(T, D), D.normalize(), Ts[i * 3] = T.x, Ts[i * 3 + 1] = T.y, Ts[i * 3 + 2] = T.z, Ds[i * 3] = D.x, Ds[i * 3 + 1] = D.y, Ds[i * 3 + 2] = D.z, Tprev.copy(T);
    }
    data.push({ s, n, Ts, Ds, start: total }), total += s.length;
  }
  if (pinEnd && total > 0) {
    let C = canonDown(Tprev), phi = Math.atan2(Tprev.dot(new Vector3().crossVectors(D, C)), D.dot(C)), T2 = new Vector3(), d = new Vector3();
    for (let { s, n, Ts, Ds, start } of data)
      for (let i = 0; i <= n; i++)
        T2.fromArray(Ts, i * 3), d.fromArray(Ds, i * 3), d.applyAxisAngle(T2, phi * (start + s.length * i / n) / total), Ds[i * 3] = d.x, Ds[i * 3 + 1] = d.y, Ds[i * 3 + 2] = d.z;
  }
  for (let { s, n, Ts, Ds } of data) s._fr = { n, T: Ts, D: Ds, arcLengths: s.curve.getLengths() };
}
var ensureFrames = (seg) => {
  seg._fr || sampleChain([seg], !1);
};
function arcParamAt(fr, u) {
  let lengths = fr.arcLengths, last = lengths.length - 1;
  if (last <= 0 || !Number.isFinite(u)) return 0;
  let target = clamp2(u, 0, 1) * lengths[last], low = 0, high = last;
  for (; low <= high; ) {
    let i = Math.floor(low + (high - low) / 2);
    if (lengths[i] < target) low = i + 1;
    else if (lengths[i] > target) high = i - 1;
    else return i / last;
  }
  let before = lengths[high], after = lengths[low], fraction = after > before ? (target - before) / (after - before) : 0;
  return (high + fraction) / last;
}
function wallFrame(seg, angle, u, rho = seg.air ? 0 : seg.radius - BALL_R, out = {}) {
  ensureFrames(seg), u = Number.isFinite(u) ? clamp2(u, 0, 1) : 0;
  let fr = seg._fr, f = u * fr.n, i = Math.min(fr.n - 1, Math.floor(f)), k = f - i, A = fr.D, T = out.tangent || (out.tangent = new Vector3());
  T.fromArray(fr.T, i * 3), FRAME_TMP.fromArray(fr.T, (i + 1) * 3), T.lerp(FRAME_TMP, k).normalize();
  let w = out.dir || (out.dir = new Vector3());
  if (w.set(
    A[i * 3] + (A[i * 3 + 3] - A[i * 3]) * k,
    A[i * 3 + 1] + (A[i * 3 + 4] - A[i * 3 + 1]) * k,
    A[i * 3 + 2] + (A[i * 3 + 5] - A[i * 3 + 2]) * k
  ), w.addScaledVector(T, -w.dot(T)), w.lengthSq() < 1e-8 && canonDown(T, w), w.normalize().applyAxisAngle(T, angle), out.soloDir) return out;
  let axis = out.axis || (out.axis = new Vector3()), curveU = arcParamAt(fr, u);
  return seg.curve.getPoint(curveU, axis), out.axis = axis, out.dir = w, out.angle = angle, out.tangent = T, out.pos = (out.pos || new Vector3()).copy(axis).addScaledVector(w, rho), out.wall = (out.wall || new Vector3()).copy(axis).addScaledVector(w, seg.radius), out.up = (out.up || new Vector3()).copy(w).negate(), out.side = (out.side || new Vector3()).crossVectors(T, out.up).normalize(), out;
}
function segmentTangent(seg, u, out = new Vector3()) {
  ensureFrames(seg);
  let fr = seg._fr, f = clamp2(u, 0, 1) * fr.n, i = Math.min(fr.n - 1, Math.floor(f)), k = f - i, j = i * 3;
  return out.set(
    fr.T[j] + (fr.T[j + 3] - fr.T[j]) * k,
    fr.T[j + 1] + (fr.T[j + 4] - fr.T[j + 1]) * k,
    fr.T[j + 2] + (fr.T[j + 5] - fr.T[j + 2]) * k
  ).normalize();
}
var laneOf = (seg, id) => seg.lanes?.find((l) => l.id === id) || seg.lanes?.[0] || null, lerpArr = (arr, u) => {
  let n = arr.length - 1, f = clamp2(Number.isFinite(u) ? u : 0, 0, 1) * n, i = Math.min(n - 1, Math.floor(f));
  return arr[i] + (arr[i + 1] - arr[i]) * (f - i);
}, LANE_W = +(0.4 * 2.6).toFixed(2) * TK, CARRIL_EDGE = LANE_W / 2 - BALL_R * 0.85, carrilLat = (c, edge = CARRIL_EDGE) => (clamp2(c, 0, CARRILES - 1) / (CARRILES - 1) - 0.5) * 2 * edge, ROW_GAP = 26, BRAID_A = 52, rowGap = (n) => Math.min(ROW_GAP, 2 * BRAID_A / Math.max(1, n - 1)), ENV_PAD = 9.7 * TK * AK - BRAID_A, RIBBON_CURB = 0.17 * TK, RIBBON_TERR = 0.55 * TK, RIBBON_HALF = LANE_W / 2 + RIBBON_CURB + RIBBON_TERR, RIBBON_GAP = 0.8 * TK, RIBBON_CLEAR = 2 * RIBBON_HALF + RIBBON_GAP, ringRadius = (n) => BRAID_A * Math.sin(Math.PI / 5) / Math.sin(Math.PI / clamp2(n, 3, 5)), FILA_GAP = ROW_GAP, FILA_W = 4 * FILA_GAP + 2 * RIBBON_HALF, FILA_KINDS = /* @__PURE__ */ new Set(["rizo", "embudo", "espiral", "sacacorchos", "horquilla"]), HELI_KINDS = /* @__PURE__ */ new Set(["espiral", "sacacorchos"]), HELI_GAP = RIBBON_CLEAR + 0.6 * TK, HELI_MINR = 1.2 * TK, HELI_TURN = 0.03, BRAID_PAD = 3.7 * TK, BRAID_OPEN = 16 * TK * AK + (8.5 + 14) * TK * (AK - 1), BRAID_RAMP = 18 * TK * AK, ROLL_KINDS = ["plano", "cabeza", "lado_der", "lado_izq", "tirabuzon", "tirabuzon_inv"];
function braidEnv(seg, u, hubs = !0) {
  let L = seg.length, x = clamp2(Number.isFinite(u) ? u : 0, 0, 1) * L, [a, b] = braidDelay(seg, hubs), [ra, rb] = braidRamps(seg, hubs);
  return smooth01((x - a) / ra) * smooth01((L - b - x) / rb);
}
function braidRamps(seg, hubs = !0) {
  if (hubs && seg.fan) return [seg.fan.ra, seg.fan.rb];
  let L = seg.length, [a, b] = braidDelay(seg, hubs), r = Math.max(4 * TK, Math.min(hubs ? OPEN_RAMP : BRAID_RAMP, (L - a - b) * 0.3));
  if (!hubs || seg.kind !== "salida" && seg.kind !== "llegada") return [r, r];
  let [a0, b0] = braidDelay(seg, !1), r0 = Math.max(4 * TK, Math.min(BRAID_RAMP, (L - a0 - b0) * 0.3));
  return seg.kind === "salida" ? [r0, r] : [r, r0];
}
var NODE_OPEN = 16 * TK + 16 * TK * 1.52 + (8.5 + 14) * TK * 0.52, HUB_OPEN = 6 * TK, OPEN_RAMP = 11 * TK, FILA_TWIST = 8 * TK, FILA_TURN = 8e-3;
function braidDelay(seg, hubs = !0) {
  if (!hubs) return [seg.kind === "salida" ? GRID_LEN + 2 * TK + BRAID_OPEN : 0, seg.kind === "llegada" ? FINISH_LEN + 2 * TK + BRAID_OPEN : 0];
  let m = seg.fila ? FILA_TWIST : 0;
  return seg.fan ? [Math.max(m, seg.fan.a), Math.max(m, seg.fan.b)] : [Math.max(m, seg.kind === "salida" ? NODE_OPEN : seg.hubA ? HUB_OPEN : 0), Math.max(m, seg.kind === "llegada" ? NODE_OPEN : seg.hubB ? HUB_OPEN : 0)];
}
var braidRadius = (seg, u) => Math.max(seg.radius, BRAID_A * braidEnv(seg, u, !1) + ENV_PAD);
function rollAt(seg, lane, u) {
  if (seg._braid?.fila) return lerpArr(seg._braid.roll, u);
  if (seg._braid?.row) {
    let r = lane && seg._braid.sroll?.[lane.id];
    return r ? lerpArr(r, u) : 0;
  }
  if (!lane || lane.roll === "plano" || !seg._braid) return 0;
  let e = braidEnv(seg, u);
  if (lane.roll === "cabeza") return Math.PI * e;
  if (lane.roll === "lado_der") return Math.PI / 2 * e;
  if (lane.roll === "lado_izq") return -Math.PI / 2 * e;
  let [a, b] = seg._braid.full;
  return (lane.roll === "tirabuzon" ? 1 : -1) * TAU * smooth01((clamp2(u, 0, 1) - a) / (b - a));
}
var laneRoll = (seg, laneId, u) => rollAt(seg, laneOf(seg, laneId), u);
function laneAngle(seg, laneId, u) {
  let l = laneOf(seg, laneId);
  if (!l) return 0;
  let a = rollAt(seg, l, u), bk = seg._bank;
  if (!bk || seg._braid?.fila) return a;
  let x = lerpArr(bk.x, u), y = lerpArr(bk.y, u), m = Math.hypot(x, y);
  return m < 1e-6 ? a : a + m * Math.sin(angDiff(a, Math.atan2(y, x)));
}
function laneRelief(seg, laneId, u) {
  let arr = seg._relief?.h.get(laneOf(seg, laneId)?.id);
  return arr ? lerpArr(arr, u) : 0;
}
function reliefSlope(seg, laneId, u) {
  let r = seg._relief, arr = r?.h.get(laneOf(seg, laneId)?.id);
  if (!arr) return 0;
  let f = clamp2(Number.isFinite(u) ? u : 0, 0, 1) * r.n, i = Math.min(r.n - 1, Math.floor(f));
  return (arr[i + 1] - arr[i]) * r.n / seg.length;
}
function segmentCurvature(seg, u) {
  let c = seg._curv;
  if (!c) return { k: 0, out: 0 };
  let x = lerpArr(c.x, u), y = lerpArr(c.y, u);
  return { k: Math.hypot(x, y), out: Math.atan2(-y, -x) };
}
function roadAt(seg, laneId, u, out) {
  let br = seg._braid;
  if (!br) return out.copy(wallFrame(seg, 0, u, 0, LF_W).axis);
  let P = br.P[laneOf(seg, laneId)?.id ?? 0] || br.P[0], f = clamp2(Number.isFinite(u) ? u : 0, 0, 1) * br.N, i = Math.min(br.N - 1, Math.floor(f)), k = f - i, j = i * 3;
  return out.set(P[j] + (P[j + 3] - P[j]) * k, P[j + 1] + (P[j + 4] - P[j + 1]) * k, P[j + 2] + (P[j + 5] - P[j + 2]) * k);
}
var LF_W = {}, LF_D = { soloDir: !0 }, LF_P0 = new Vector3(), LF_P1 = new Vector3();
function surfAt(seg, laneId, u, out, up) {
  let d = wallFrame(seg, laneAngle(seg, laneId, u), u, 0, LF_D).dir;
  return up && up.copy(d).negate(), roadAt(seg, laneId, u, out), seg.air ? out : out.addScaledVector(d, -laneRelief(seg, laneId, u));
}
function laneFrame(seg, laneId, u, out = {}) {
  u = Number.isFinite(u) ? clamp2(u, 0, 1) : 0;
  let up = out.up || (out.up = new Vector3()), surface = out.surface || (out.surface = new Vector3());
  surfAt(seg, laneId, u, surface, up);
  let road = out.road || (out.road = new Vector3());
  roadAt(seg, laneId, u, road);
  let du = Math.min(0.01, 0.4 * TK / seg.length), u0 = Math.max(0, u - du), u1 = Math.min(1, u + du), T = out.tangent || (out.tangent = new Vector3());
  return T.subVectors(surfAt(seg, laneId, u1, LF_P1), surfAt(seg, laneId, u0, LF_P0)), T.lengthSq() > 1e-12 ? T.normalize() : segmentTangent(seg, u, T), up.addScaledVector(T, -up.dot(T)), up.lengthSq() < 1e-10 && canonDown(T, up).negate(), up.normalize(), out.side = (out.side || new Vector3()).crossVectors(T, up).normalize(), out.pos = (out.pos || new Vector3()).copy(surface).addScaledVector(up, BALL_R), out.axis = road, out.wall = surface, out.dir = (out.dir || new Vector3()).copy(up).negate(), out.angle = laneAngle(seg, laneId, u), out.roll = laneRoll(seg, laneId, u), out.lane = laneOf(seg, laneId), out.relief = seg.air ? 0 : laneRelief(seg, laneId, u), out;
}
function laneLength(seg, laneId) {
  let br = seg._braid;
  if (!br) return seg.length;
  let id = laneOf(seg, laneId)?.id ?? 0;
  if (br.len[id] == null) {
    let P = br.P[id], s = 0;
    for (let i = 1; i <= br.N; i++) s += Math.hypot(P[i * 3] - P[i * 3 - 3], P[i * 3 + 1] - P[i * 3 - 2], P[i * 3 + 2] - P[i * 3 - 1]);
    br.len[id] = s;
  }
  return br.len[id];
}
var ARC_A = {}, ARC_B = {};
function arcCtrl(seg, sw) {
  let A = laneFrame(seg, sw.from, sw.u, ARC_A), B = laneFrame(seg, sw.to, sw.uLand, ARC_B), p0 = A.pos.clone().addScaledVector(A.side, sw.carril != null ? carrilLat(sw.carril) : 0), d = p0.distanceTo(B.pos), h = sw.apex;
  return {
    p0,
    p3: B.pos.clone(),
    u0: A.up.clone(),
    u1: B.up.clone(),
    s0: A.side.clone(),
    t0: A.tangent.clone(),
    t1: B.tangent.clone(),
    p1: p0.clone().addScaledVector(A.up, h).addScaledVector(A.tangent, d * 0.3),
    p2: B.pos.clone().addScaledVector(B.up, h).addScaledVector(B.tangent, -d * 0.3)
  };
}
var SP_A = new Vector3(), SP_B = new Vector3(), SP_D = new Vector3(), SP_V = new Vector3();
function pathPos(c, via, t, out) {
  let D = SP_D.subVectors(c.p3, c.p0), V2 = SP_V.copy(Y).multiplyScalar(D.y);
  if (D.sub(V2), via === "caida") return out.copy(c.p0).addScaledVector(D, t).addScaledVector(V2, t * t);
  if (via === "elevador") return out.copy(c.p0).addScaledVector(V2, smooth01(t / 0.65)).addScaledVector(D, smooth01((t - 0.55) / 0.45));
  if (via === "portal") return t < 0.5 ? out.copy(c.p0).addScaledVector(c.t0, t * 2 * TK) : out.copy(c.p3).addScaledVector(c.t1, (t - 1) * 2 * TK);
  let tri = 1 - 4 * Math.abs((t * 3 + 0.25) % 1 - 0.5);
  return out.copy(c.p0).addScaledVector(D, smooth01(t)).addScaledVector(V2, smooth01(t)).addScaledVector(c.s0, tri * 1.1 * TK * Math.sin(Math.PI * t));
}
function switchPath(seg, sw, t, out = {}) {
  let via = sw.via || "arco";
  if (via === "arco")
    return switchArc(seg, sw, t, out), out.vis = 1, out;
  let c = sw._arc || (sw._arc = arcCtrl(seg, sw));
  t = Number.isFinite(t) ? clamp2(t, 0, 1) : 0;
  let pos = pathPos(c, via, t, out.pos || (out.pos = new Vector3())), T = out.tangent || (out.tangent = new Vector3());
  via === "portal" ? T.copy(t < 0.5 ? c.t0 : c.t1) : (T.subVectors(pathPos(c, via, Math.min(1, t + 0.01), SP_B), pathPos(c, via, Math.max(0, t - 0.01), SP_A)), T.lengthSq() < 1e-10 && T.copy(c.t0), T.normalize());
  let up = out.up || (out.up = new Vector3());
  return up.copy(c.u0).lerp(c.u1, via === "portal" ? t < 0.5 ? 0 : 1 : smooth01(t)).addScaledVector(T, -up.dot(T)), up.lengthSq() < 1e-8 && up.copy(c.u1), up.normalize(), out.vis = via === "portal" ? clamp2(Math.abs(t - 0.5) / 0.18, 0, 1) : 1, out;
}
var arcLift = (bote, t) => bote ? t < 0.6 ? 4 * (t / 0.6) * (1 - t / 0.6) : 1.4 * ((t - 0.6) / 0.4) * (1 - (t - 0.6) / 0.4) : 4 * t * (1 - t), arcLiftD = (bote, t) => bote ? t < 0.6 ? 4 / 0.6 * (1 - 2 * t / 0.6) : 1.4 / 0.4 * (1 - 2 * (t - 0.6) / 0.4) : 4 * (1 - 2 * t);
function switchArc(seg, sw, t, out = {}) {
  let c = sw._arc || (sw._arc = arcCtrl(seg, sw));
  t = Number.isFinite(t) ? clamp2(t, 0, 1) : 0;
  let bote = sw.kind === "botado";
  (out.pos || (out.pos = new Vector3())).copy(c.p0).lerp(c.p3, t).addScaledVector(Y, sw.apex * arcLift(bote, t));
  let T = out.tangent || (out.tangent = new Vector3());
  T.subVectors(c.p3, c.p0).addScaledVector(Y, sw.apex * arcLiftD(bote, t)), T.lengthSq() < 1e-10 && T.copy(c.t0), T.normalize();
  let up = out.up || (out.up = new Vector3());
  return up.copy(c.u0).lerp(c.u1, smooth01(t)).addScaledVector(T, -up.dot(T)), up.lengthSq() < 1e-8 && up.copy(c.u1), up.normalize(), out;
}
function nearestLane(seg, angle) {
  let best = 0, bd = 1 / 0;
  for (let l of seg.lanes || []) {
    let d = Math.abs(angDiff(angle, l.angle));
    d < bd && (bd = d, best = l.id);
  }
  return best;
}
var ROLES = ["rapida", "lenta", "media"], BANK_GAIN = { rapida: 14 * TK, lenta: 16 * TK, media: 24 * TK, shared: 10 * TK }, BANK_MAX = 0.55, BANK_RATE = 0.025 / TK, RELIEF = {
  rapida: { n: [1, 2], h: [0.1, 0.22], jumps: 0 },
  lenta: { n: [3, 5], h: [0.15, 0.4], jumps: 0 },
  media: { n: [2, 3], h: [0.15, 0.32], jumps: 2 },
  shared: { n: [1, 2], h: [0.08, 0.18], jumps: 0 }
}, RELIEF_BASE = 0.15 * TK, KICK_DROP = 0.9 * TK;
function buildBank(s) {
  if (s._curv = s._bank = null, s.air) return;
  ensureFrames(s);
  let { n, T, D } = s._fr, ds = s.length / n, kx = new Float32Array(n + 1), ky = new Float32Array(n + 1), t = new Vector3(), d = new Vector3(), k = new Vector3(), b = new Vector3(), t0 = new Vector3();
  for (let i = 0; i <= n; i++) {
    let i0 = Math.max(0, i - 1), i1 = Math.min(n, i + 1);
    t0.fromArray(T, i0 * 3), k.fromArray(T, i1 * 3).sub(t0).divideScalar((i1 - i0) * ds), t.fromArray(T, i * 3), d.fromArray(D, i * 3), b.crossVectors(t, d), kx[i] = k.dot(d), ky[i] = k.dot(b);
  }
  let box = (a, w2) => {
    let pre = new Float64Array(a.length + 1);
    for (let i = 0; i < a.length; i++) pre[i + 1] = pre[i] + a[i];
    return a.map((_, i) => {
      let lo = Math.max(0, i - w2), hi = Math.min(a.length - 1, i + w2);
      return (pre[hi + 1] - pre[lo]) / (hi - lo + 1);
    });
  }, w = Math.max(1, Math.round(2 * TK / ds)), cx = box(kx, w), cy = box(ky, w);
  s._curv = { x: cx, y: cy };
  let role = s.route >= 0 ? ROLES[s.route] : "shared", g = BANK_GAIN[role], bx = cx.map((x) => -x * g), by = cy.map((y) => -y * g), step = BANK_RATE * ds, pinMag = () => {
    let m = bx.map((x, i) => Math.min(BANK_MAX, Math.hypot(x, by[i])));
    m[0] = 0;
    for (let i = 1; i <= n; i++) m[i] = Math.min(m[i], m[i - 1] + step);
    m[n] = 0;
    for (let i = n - 1; i >= 0; i--) m[i] = Math.min(m[i], m[i + 1] + step);
    for (let i = 0; i <= n; i++) {
      let h = Math.hypot(bx[i], by[i]), f = h > 1e-9 ? m[i] / h : 0;
      bx[i] *= f, by[i] *= f;
    }
  };
  pinMag();
  for (let dir of [1, -1])
    for (let i = dir > 0 ? 1 : n - 1; dir > 0 ? i <= n : i >= 0; i += dir) {
      let dx = bx[i] - bx[i - dir], dy = by[i] - by[i - dir], l = Math.hypot(dx, dy);
      l > step && (bx[i] = bx[i - dir] + dx * step / l, by[i] = by[i - dir] + dy * step / l);
    }
  pinMag(), s._bank = { x: bx, y: by };
}
function buildSurface(s, rng) {
  if (s._relief = null, s.air) {
    s._curv = s._bank = null;
    return;
  }
  s._bank || buildBank(s);
  let role = s.route >= 0 ? ROLES[s.route] : "shared", R = RELIEF[role], L = s.length, hMax = 0.45 * (s.radius - BALL_R), nr = clamp2(Math.ceil(L / (0.5 * TK)), 32, 8e3);
  s._relief = { n: nr, h: /* @__PURE__ */ new Map() };
  for (let lane of s.lanes) {
    let feats = [], fila = !!s._braid?.fila;
    for (let j = ri(rng, R.n[0], R.n[1]); j > 0; j--)
      feats.push({ c: (0.12 + rng() * 0.76) * L, w: (4 + rng() * 5) * TK, h: (R.h[0] + rng() * (R.h[1] - R.h[0])) * TK * (rng() < 0.35 ? -1 : 1) });
    let kicks = [...new Set((s.switchesByLane?.get(lane.id) || []).filter((sw) => sw.kind === "rampa").map((sw) => sw.u))].map((u) => [u * L, 0.3 * TK, 5 * TK]);
    for (let j = 0; j < R.jumps; j++) {
      let p = (0.2 + rng() * 0.6) * L;
      for (; kicks.some(([q]) => Math.abs(q - p) < 2.5 * KICK_DROP); ) p += 2.5 * KICK_DROP;
      kicks.push([Math.min(p, L - 8 * TK), 0.5 * TK, 7 * TK]);
    }
    fila && (feats.length = 0, kicks.length = 0);
    let arr = new Float32Array(nr + 1);
    for (let i = 0; i <= nr; i++) {
      let x = i / nr * L, h = RELIEF_BASE;
      for (let f of feats) {
        let q = Math.abs(x - f.c) / f.w;
        q < 1 && (h += f.h * Math.cos(q * Math.PI / 2) ** 2);
      }
      for (let [p, kh, up] of kicks)
        x > p - up && x <= p ? h += kh * smooth01((x - p + up) / up) : x > p && x < p + KICK_DROP && (h += kh * (1 - (x - p) / KICK_DROP));
      let e = s._braid ? lerpArr(s._braid.env, x / L) : 1, liso = smooth01((e - 0.55) / 0.25);
      arr[i] = clamp2(RELIEF_BASE + (h - RELIEF_BASE) * liso, 0, hMax) * smooth01(x / (6 * TK)) * smooth01((L - x) / (6 * TK));
    }
    s._relief.h.set(lane.id, arr);
  }
}
var LANE_SELF = 25 * TK, LANE_GAP = LANE_W * (1 + MIN_GAP_K / 2), RING_MIN = (RIBBON_CLEAR + 1.5 * TK) / (2 * Math.sin(Math.PI / 5)), LANE_MARGIN = LANE_W * 0.6;
var NO_ROW_BANK = !!globalThis.process?.env?.NO_ROW_BANK;
function buildBraid(s) {
  let N = clamp2(Math.ceil(s.length / (1.5 * TK)), 48, 1200), lanes = s.lanes, P = lanes.map(() => new Float32Array((N + 1) * 3)), env = new Float32Array(N + 1), tangent = new Vector3(), ref = new Vector3(), priorRef = new Vector3(), side = new Vector3(), center = new Vector3(), C = new Float32Array((N + 1) * 3), R = new Float32Array((N + 1) * 3), S = new Float32Array((N + 1) * 3), Tn = new Float32Array((N + 1) * 3), angDiffSigned = (a, b) => {
    let d = (a - b) % TAU;
    return d > Math.PI ? d -= TAU : d < -Math.PI && (d += TAU), d;
  };
  for (let i = 0; i <= N; i++) {
    let u = i / N, f = wallFrame(s, 0, u, 0, {});
    center.copy(f.axis), segmentTangent(s, u, tangent), i ? ref.copy(priorRef).addScaledVector(tangent, -priorRef.dot(tangent)) : ref.crossVectors(tangent, Y), ref.lengthSq() < 1e-8 && ref.set(1, 0, 0).addScaledVector(tangent, -tangent.x), ref.normalize(), side.crossVectors(tangent, ref).normalize(), priorRef.copy(ref), env[i] = braidEnv(s, u), center.toArray(C, i * 3), ref.toArray(R, i * 3), side.toArray(S, i * 3), tangent.toArray(Tn, i * 3);
  }
  let step = s.length / N, rad = new Float32Array(N + 1), nl = lanes.length, ringR = ringRadius(nl), fila = FILA_KINDS.has(s.kind) && !s.air, ang = null, roll = null;
  if (fila) {
    s.fila = !0;
    for (let i = 0; i <= N; i++) env[i] = braidEnv(s, i / N);
    let V2 = (a, i) => new Vector3(a[i * 3], a[i * 3 + 1], a[i * 3 + 2]), w = Math.max(1, Math.round(6 * TK / step)), w2 = Math.max(1, Math.round(24 * TK / step)), raw = [];
    for (let i = 0; i <= N; i++) raw.push(V2(Tn, Math.max(0, i - w)).cross(V2(Tn, Math.min(N, i + w))));
    let pre = [new Vector3()];
    for (let i = 0; i <= N; i++) pre.push(pre[i].clone().add(raw[i]));
    let avg = raw.map((_, i) => {
      let lo = Math.max(0, i - w2), hi = Math.min(N, i + w2);
      return pre[hi + 1].clone().sub(pre[lo]).divideScalar(hi - lo + 1);
    }), preT = [new Vector3()];
    for (let i = 0; i <= N; i++) preT.push(preT[i].clone().add(V2(Tn, i)));
    let avgT = raw.map((_, i) => {
      let lo = Math.max(0, i - w2), hi = Math.min(N, i + w2);
      return preT[hi + 1].clone().sub(preT[lo]).divideScalar(hi - lo + 1);
    }), B = [], v = new Vector3(), tg = new Vector3(), wv = new Vector3(), mt = new Vector3(), maxStep = FILA_TURN * step, vote = 0, EPS = 0.02, SH_MAX = 0.6, fit = (x, T) => {
      let d = x.dot(T);
      return Math.abs(d) > SH_MAX && x.addScaledVector(T, -(d - Math.sign(d) * SH_MAX)), x.lengthSq() < 1e-8 ? x.copy(V2(R, 0)) : x.normalize();
    }, target = (i) => {
      let a = avg[i], m = avgT[i].length(), k = a.length() > EPS ? smooth01((0.6 - m) / 0.3) : 0;
      return mt.copy(avgT[i]), m > 1e-6 && mt.divideScalar(m), wv.copy(v).addScaledVector(mt, -v.dot(mt)), wv.lengthSq() < 1e-6 && wv.copy(V2(R, i)).addScaledVector(mt, -V2(R, i).dot(mt)), wv.normalize(), tg.copy(a), tg.lengthSq() > 1e-12 && tg.normalize(), tg.dot(v) < 0 && tg.negate(), tg.multiplyScalar(k).addScaledVector(wv, 1 - k).normalize();
    };
    if (!!globalThis.process?.env?.HELI && HELI_KINDS.has(s.kind)) {
      let A0 = V2(C, 0), c = V2(C, N).sub(A0), cl = c.length();
      cl > 1e-6 && c.divideScalar(cl);
      let rad0 = [], first = -1;
      for (let i = 0; i <= N; i++) {
        let p = V2(C, i).sub(A0);
        p.addScaledVector(c, -p.dot(c));
        let l = p.length();
        l > HELI_MINR ? (rad0.push(p.divideScalar(l)), first < 0 && (first = i)) : rad0.push(null);
      }
      if (first < 0)
        for (let i = 0; i <= N; i++) B.push(fit(V2(R, i), V2(Tn, i)));
      else {
        let lim = HELI_TURN * step, prev = rad0[first].clone(), out = new Array(N + 1);
        for (let i = first; i <= N; i++) {
          let t = rad0[i] || prev, an = Math.acos(clamp2(t.dot(prev), -1, 1));
          prev = an > lim ? prev.clone().lerp(t, lim / an).normalize() : t.clone(), out[i] = prev;
        }
        for (let i = first - 1; i >= 0; i--) out[i] = out[first];
        for (let i = 0; i <= N; i++) {
          let T = V2(Tn, i), b = fit(out[i].clone(), T);
          B.push(b), vote += v.crossVectors(b, T).y;
        }
        Math.abs(vote) < 1e-6 && (vote = 1);
      }
    } else for (let i = 0; i <= N; i++) {
      let T = V2(Tn, i);
      if (i === 0) {
        v.copy(V2(R, 0));
        let j = avg.findIndex((a, q) => a.length() > EPS && avgT[q].length() < 0.65);
        j >= 0 && v.copy(avg[j]).normalize(), v.copy(target(0));
      } else {
        target(i);
        let an = Math.acos(clamp2(tg.dot(v), -1, 1));
        an > maxStep ? v.lerp(tg, maxStep / an).normalize() : v.copy(tg);
      }
      vote += avg[i].dot(v), B.push(fit(v.clone(), T));
    }
    if (vote < 0) for (let b of B) b.negate();
    ang = new Float32Array(N + 1);
    let WF = { soloDir: !0 }, up = new Vector3(), cr = new Vector3(), row = new Vector3();
    for (let i = 0; i <= N; i++) {
      let T = V2(Tn, i), d0 = wallFrame(s, 0, i / N, 0, WF).dir;
      up.crossVectors(B[i], T).normalize().negate();
      let a = Math.atan2(T.dot(cr.crossVectors(d0, up)), d0.dot(up));
      i && (a = ang[i - 1] + angDiffSigned(a, ang[i - 1])), ang[i] = a;
    }
    roll = new Float32Array(N + 1);
    let [za, zb] = braidDelay(s), r0 = ang[0], r1 = ang[N] - TAU * Math.round(ang[N] / TAU);
    for (let i = 0; i <= N; i++) {
      let x = i / N * s.length;
      roll[i] = ang[i] - r0 * (1 - smooth01(x / za)) - r1 * (1 - smooth01((s.length - x) / zb));
    }
    let heliK = HELI_KINDS.has(s.kind), gapF = heliK ? +(globalThis.process?.env?.HELI_GAP || HELI_GAP) : FILA_GAP;
    for (let i = 0; i <= N; i++) {
      let T = V2(Tn, i), d = wallFrame(s, roll[i], i / N, 0, WF).dir;
      row.crossVectors(d, T).normalize();
      let bt = B[i].dot(T);
      (!heliK || globalThis.process?.env?.SHEAR) && row.addScaledVector(T, bt / Math.sqrt(1 - bt * bt) * env[i]), rad[i] = (nl - 1) / 2 * gapF * env[i];
      for (let j = 0; j < nl; j++) {
        let id = lanes[j].id, dst = P[id] || (P[id] = new Float32Array((N + 1) * 3)), off = (j - (nl - 1) / 2) * gapF * env[i];
        dst[i * 3] = C[i * 3] + row.x * off, dst[i * 3 + 1] = C[i * 3 + 1] + row.y * off, dst[i * 3 + 2] = C[i * 3 + 2] + row.z * off;
      }
    }
  } else {
    let gap = rowGap(nl), half = (nl - 1) / 2 * gap, WF = { soloDir: !0 }, row = new Vector3(), T = new Vector3();
    for (let i = 0; i <= N; i++) {
      rad[i] = half * env[i], T.set(Tn[i * 3], Tn[i * 3 + 1], Tn[i * 3 + 2]), row.crossVectors(wallFrame(s, NO_ROW_BANK ? 0 : laneAngle(s, lanes[0].id, i / N), i / N, 0, WF).dir, T).normalize();
      for (let j = 0; j < nl; j++) {
        let id = lanes[j].id, dst = P[id] || (P[id] = new Float32Array((N + 1) * 3)), off = (j - (nl - 1) / 2) * gap * env[i];
        dst[i * 3] = C[i * 3] + row.x * off, dst[i * 3 + 1] = C[i * 3 + 1] + row.y * off, dst[i * 3 + 2] = C[i * 3 + 2] + row.z * off;
      }
    }
  }
  let [da, db] = braidDelay(s), [qa, qb] = braidRamps(s);
  s._braid = { N, P, env, rad, fila, row: !fila, ang, roll, full: [Math.min(0.45, (da + qa) / s.length), Math.max(0.55, 1 - (db + qb) / s.length)], len: [], curves: [] };
}
function buildLanes(way) {
  let rng = mulberry32(9e4 + way.idx * 131), laneCount = 3 + Math.floor(rng() * 3), theme = way.theme.id, mechs = Object.keys(THEME_MECHS[theme]), width = LANE_W, extra = THEME_CAMBIOS[theme] || {}, mk = (s, u, from, to, kind, carril) => {
    let M = MECHANISMS[kind], sk = s.speedK ?? 1, via = CAMBIOS[kind], duration = +(M.dur / Math.sqrt(sk) * (s.drag > 2 ? 1.25 : 1)).toFixed(2), span = via === "portal" ? 0 : duration * (14 * TK * sk + (s.boost || 0) * 0.4) / s.length, uLand = +Math.min(0.96, u + Math.max(via === "portal" ? 0.05 : 0.08, span)).toFixed(4);
    return {
      u: +u.toFixed(4),
      uLand,
      uEnd: uLand,
      from,
      to,
      carril,
      kind,
      via,
      apex: +((kind === "botado" ? 5.5 : 3.5) + Math.abs(to - from) * 0.6).toFixed(2) * TK,
      name: THEME_MECHS[theme][kind] || M.name,
      emoji: M.emoji,
      style: via,
      duration,
      risk: M.risk,
      fail: M.fail,
      reward: { ...M.reward },
      boost: M.boost
    };
  }, fA = {}, fB = {}, pickKind = (s, from, to, u, pref) => {
    let a = laneFrame(s, from, u, fA).pos, b = laneFrame(s, to, u, fB).pos, dy = b.y - a.y, dist = a.distanceTo(b), opts;
    return dy < -0.45 * dist ? opts = ["caida", "caida", "salto", ...extra.abajo || []] : dy > 0.45 * dist ? opts = ["elevador", "elevador", "rampa", ...extra.arriba || []] : dist > 1.3 * ROW_GAP ? opts = ["portal"] : opts = ["salto", "rampa", "botado", "laberinto", ...extra.nivel || []], pref && opts.includes(pref) ? pref : opts[Math.floor(rng() * opts.length)];
  };
  way.segments.forEach((s) => {
    let ids = Array.from({ length: laneCount }, (_, id) => id);
    s.lanes = ids.map((id) => ({ id, roll: id === 0 ? "plano" : ROLL_KINDS[1 + (id - 1 + way.idx) % (ROLL_KINDS.length - 1)], angle: 0, offset: 0, width, name: LANE_NAMES[id] || `camino ${id + 1}` })), s._braid = null, buildBank(s), buildBraid(s), s.switches = [];
    let [fa, fb] = s._braid.full, a = fa + 0.02, b = Math.min(fb - 0.02, 0.9);
    b - a < 0.15 && (a = 0.2, b = 0.8);
    let pref = CAMBIOS[s.kind] ? s.kind : CAMBIOS[s.event] ? s.event : null;
    for (let id of ids) {
      let others = ids.filter((x) => x !== id), shift = Math.floor(rng() * others.length);
      for (let c = 0; c < CARRILES; c++) {
        let u = a + (c + 0.15 + rng() * 0.7) / CARRILES * (b - a), to = others[(c + shift) % others.length];
        s.switches.push(mk(s, u, id, to, pickKind(s, id, to, u, pref), (c * 2 + id) % CARRILES));
      }
    }
    s.switchesByLane = new Map(ids.map((id) => [id, s.switches.filter((sw) => sw.from === id).sort((x, y) => x.u - y.u)]));
  });
  let srng = mulberry32(91e3 + way.idx * 37);
  for (let s of way.segments) buildSurface(s, srng);
  for (let s of way.segments) for (let sw of s.switches) delete sw._arc;
}
var SINUOSO = { off: !!globalThis.process?.env?.NO_SINUOSO }, SIN_R = +(globalThis.process?.env?.SIN_R ?? 240), SIN_SLOPE = 0.4, SIN_WA = 24, SIN_WL = 330, SIN_CLEAR = 6 * TK + 2 * RIBBON_HALF + 0.75 + 1.5 * TK, SIN_LAT = 2 * RIBBON_HALF + 0.2, SIN_ALTO = 0.75 + 0.25, SIN_AIRE = 2 * RIBBON_HALF + 0.25, SIN_PRISMA = LANE_W / 2 + RIBBON_CURB + RIBBON_HALF + 2.5, SIN_GALIBO = 6 * TK + 0.75 + 4, SIN_ROLLD = SIN_CLEAR + 4, SIN_ALISA = +(globalThis.process?.env?.SIN_ALISA ?? 6), SIN_BLEND = 210, SIN_MIN = 260, SIN_ROLL = 0.035, SIN_FLY = 120;
function sinuarCaminos(world) {
  if (SINUOSO.off) return;
  let tt = performance.now(), TT = world.sinuosoT = { rejilla: 0, marco: 0, intenta: 0, giro: 0, eventos: 0 }, tq = tt, lap = (k) => {
    let n = performance.now();
    TT[k] += n - tq, tq = n;
  }, st = world.sinuoso = { caminos: 0, completos: 0, reducidos: 0, nulos: 0, reintentos: 0, revertidos: 0 }, segs = world.ways.flatMap((w) => w.segments.filter((s) => !s.air && s.lanes && s._braid)), wayOf = /* @__PURE__ */ new Map();
  for (let w of world.ways) for (let s of w.segments) wayOf.set(s, w);
  let CELL = SIN_CLEAR, key = (x, y, z) => ((Math.floor(x / CELL) + 512) * 1024 + (Math.floor(y / CELL) + 512)) * 1024 + (Math.floor(z / CELL) + 512), OX = [], OY = [], OZ = [], OS = [], OL = [], OI = [], OD = [], grid = /* @__PURE__ */ new Map(), rLo = 1 / 0, rHi = 0, add = (x, y, z, sg, ln, i, dyn) => {
    let k = key(x, y, z), b = grid.get(k);
    b || grid.set(k, b = []), b.push(OX.length), OX.push(x), OY.push(y), OZ.push(z), OS.push(sg), OL.push(ln), OI.push(i), OD.push(dyn);
  };
  segs.forEach((s, sg) => {
    let br = s._braid;
    for (let l of s.lanes) {
      let P = br.P[l.id];
      for (let i = 0; i <= br.N; i += 2) {
        let x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        add(x, y, z, sg, l.id, i, 0);
        let r = Math.hypot(x, y, z);
        r < rLo && (rLo = r), r > rHi && (rHi = r);
      }
    }
  });
  let tmp4 = new Vector3(), airN = -1;
  for (let w of world.ways) for (let s of w.segments) if (s.air || !s.lanes) {
    let n = Math.max(2, Math.ceil(s.length / 14));
    airN--;
    for (let i = 0; i <= n; i++)
      s.curve.getPoint(i / n, tmp4), add(tmp4.x, tmp4.y, tmp4.z, airN, 0, i, 1);
  }
  rHi += 100, lap("rejilla");
  let movido = /* @__PURE__ */ new Set(), nodes = world.nodes.map((n) => [n.pos.x, n.pos.y, n.pos.z, (NODE_R + 150) ** 2]), choca = (x, y, z, sg) => {
    let r22 = x * x + y * y + z * z;
    if (r22 < rLo * rLo || r22 > rHi * rHi) return !0;
    for (let n of nodes) if ((x - n[0]) ** 2 + (y - n[1]) ** 2 + (z - n[2]) ** 2 < n[3]) return !0;
    let C2 = SIN_CLEAR * SIN_CLEAR, x0 = Math.floor((x - SIN_CLEAR) / CELL) + 512, x1 = Math.floor((x + SIN_CLEAR) / CELL) + 512, y0 = Math.floor((y - SIN_CLEAR) / CELL) + 512, y1 = Math.floor((y + SIN_CLEAR) / CELL) + 512, z0 = Math.floor((z - SIN_CLEAR) / CELL) + 512, z1 = Math.floor((z + SIN_CLEAR) / CELL) + 512;
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) for (let cz = z0; cz <= z1; cz++) {
      let b = grid.get((cx * 1024 + cy) * 1024 + cz);
      if (b)
        for (let q = 0; q < b.length; q++) {
          let j = b[q];
          if (!((x - OX[j]) ** 2 + (y - OY[j]) ** 2 + (z - OZ[j]) ** 2 >= C2) && OS[j] !== sg && !(!OD[j] && movido.has(OS[j] * 8 + OL[j])))
            return !0;
        }
    }
    return !1;
  }, cerca = (x, y, z, r, sg, la, lb) => {
    let x0 = Math.floor((x - r) / CELL) + 512, x1 = Math.floor((x + r) / CELL) + 512, y0 = Math.floor((y - r) / CELL) + 512, y1 = Math.floor((y + r) / CELL) + 512, z0 = Math.floor((z - r) / CELL) + 512, z1 = Math.floor((z + r) / CELL) + 512, r22 = r * r;
    for (let cx = x0; cx <= x1; cx++) for (let cy = y0; cy <= y1; cy++) for (let cz = z0; cz <= z1; cz++) {
      let b = grid.get((cx * 1024 + cy) * 1024 + cz);
      if (b)
        for (let q = 0; q < b.length; q++) {
          let j = b[q];
          if (!((x - OX[j]) ** 2 + (y - OY[j]) ** 2 + (z - OZ[j]) ** 2 >= r22) && !(OS[j] === sg && (OL[j] === la || OL[j] === lb)) && !(!OD[j] && movido.has(OS[j] * 8 + OL[j])))
            return !0;
        }
    }
    return !1;
  }, WF = {}, T = new Vector3(), s0 = new Vector3(), v1 = new Vector3(), v22 = new Vector3();
  segs.forEach((s, sg) => {
    let br = s._braid;
    if (!br.row) return;
    let N = br.N, L = s.length, step = L / N, nl = s.lanes.length;
    tq = performance.now();
    let [da, db] = braidDelay(s), [qa, qb] = braidRamps(s), a0 = da + qa, b0 = L - db - qb, Lu = b0 - a0;
    if (Lu < SIN_MIN) return;
    let rng = mulberry32(77e3 + wayOf.get(s).idx * 977 + wayOf.get(s).segments.indexOf(s) * 131), rw = clamp2(Lu * 0.3, 110, 540), R = Math.min(SIN_R, 0.45 * rw), mir = rng() < 0.5 ? -1 : 1, pref = rng() < 0.5 ? -1 : 1, C = new Float32Array((N + 1) * 3), D0 = new Float32Array((N + 1) * 3), S0 = new Float32Array((N + 1) * 3), Tn = new Float32Array((N + 1) * 3), AW = new Float32Array(N + 1), ref = new Vector3(), U0 = new Float32Array((N + 1) * 3), RW = new Float32Array((N + 1) * 3), FI = new Float32Array(N + 1), l0 = s.lanes[0].id;
    br.sroll = null;
    for (let i = 0; i <= N; i++) {
      let f = wallFrame(s, 0, i / N, 0, WF);
      T.copy(f.tangent), i ? ref.addScaledVector(T, -ref.dot(T)) : ref.copy(f.dir), ref.lengthSq() < 1e-8 && ref.copy(f.dir), ref.normalize(), s0.crossVectors(T, ref).normalize(), f.axis.toArray(C, i * 3), ref.toArray(D0, i * 3), s0.toArray(S0, i * 3), T.toArray(Tn, i * 3);
      let cs = f.dir.dot(ref), sn = T.dot(v1.crossVectors(f.dir, ref)), a = Math.atan2(sn, cs);
      if (i) {
        let d = (a - AW[i - 1]) % TAU;
        d > Math.PI ? d -= TAU : d < -Math.PI && (d += TAU), a = AW[i - 1] + d;
      }
      AW[i] = a, v1.crossVectors(f.dir, T).normalize();
      let fi = Math.atan2(v1.dot(s0), v1.dot(ref));
      if (i) {
        let d = (fi - FI[i - 1]) % TAU;
        d > Math.PI ? d -= TAU : d < -Math.PI && (d += TAU), fi = FI[i - 1] + d;
      }
      FI[i] = fi, v22.copy(f.dir).applyAxisAngle(T, laneAngle(s, l0, i / N)), v1.crossVectors(v22, T).normalize(), v1.toArray(RW, i * 3), v22.negate().toArray(U0, i * 3);
    }
    lap("marco");
    let w2 = Math.max(2, Math.round(28 / step)), rho = new Float32Array(N + 1);
    for (let i = 0; i <= N; i++) {
      let p = Math.max(0, i - w2) * 3, q = Math.min(N, i + w2) * 3, an = Math.acos(clamp2(Tn[p] * Tn[q] + Tn[p + 1] * Tn[q + 1] + Tn[p + 2] * Tn[q + 2], -1, 1));
      rho[i] = an > 1e-4 ? (q - p) / 3 * step / an : 1e6;
    }
    let w = Math.max(3, Math.ceil(SIN_BLEND / step)), h = Math.max(2, Math.round(w / 3)), lo = new Float32Array(N + 1), pre = new Float64Array(N + 2), suave = (a, out) => {
      for (let i = 0; i <= N; i++) {
        let m = 1, j1 = Math.min(N, i + 2 * h);
        for (let j = Math.max(0, i - 2 * h); j <= j1; j++) a[j] < m && (m = a[j]);
        lo[i] = m;
      }
      for (let i = 0; i <= N; i++) pre[i + 1] = pre[i] + lo[i];
      for (let i = 0; i <= N; i++) {
        let p = Math.max(0, i - h), q = Math.min(N, i + h);
        out[i] = (pre[q + 1] - pre[p]) / (q - p + 1);
      }
      return out;
    }, xA = a0 + rw / 2, xB = b0 - rw / 2, iA = clamp2(Math.round(xA / step), 0, N), iB = clamp2(Math.round(xB / step), 0, N), i0 = Math.max(0, Math.ceil(a0 / step)), i1 = Math.min(N, Math.floor(b0 / step)), C2 = SIN_CLEAR * SIN_CLEAR, ks2 = [], LEJ2 = (SIN_ROLLD + 7 * step * 2) ** 2, hermano = (i, x, y, z, hechos, ki) => {
      let q = i * 3, j0 = Math.max(i0, i - 5), j1 = Math.min(i1, i + 5);
      for (let b = 0; b < hechos.length; b++) {
        let Q = hechos[b], kb = ks2[b];
        if (!((Q[q] - x) ** 2 + (Q[q + 1] - y) ** 2 + (Q[q + 2] - z) ** 2 > LEJ2))
          for (let j = j0; j <= j1; j++) {
            if (ki < 0.02 && kb[j] < 0.02) continue;
            let dx = Q[j * 3] - x, dy = Q[j * 3 + 1] - y, dz = Q[j * 3 + 2] - z;
            if (dx * dx + dy * dy + dz * dz >= C2 || Math.abs(dx * Tn[q] + dy * Tn[q + 1] + dz * Tn[q + 2]) > 0.8 * step + 1.5) continue;
            let lat = Math.abs(dx * RW[q] + dy * RW[q + 1] + dz * RW[q + 2]), alto = Math.abs(dx * U0[q] + dy * U0[q + 1] + dz * U0[q + 2]);
            if (lat < SIN_PRISMA && alto < SIN_GALIBO) return !0;
            let gx = Math.max(0, lat - SIN_LAT), gy = Math.max(0, alto - SIN_ALTO);
            if (gx * gx + gy * gy < SIN_AIRE * SIN_AIRE) return !0;
          }
      }
      return !1;
    }, intenta = (Rr) => {
      let omMax = Math.min(SIN_SLOPE / (1.2 * Rr), TAU / 500), dfi = FI[iB] - FI[iA], Dx = Math.max(1, xB - xA), om = null;
      for (let m = -3; m <= 3; m++) {
        let o = (dfi + TAU * m) / Dx;
        Math.abs(o) <= omMax && (om == null || Math.abs(o) > Math.abs(om) + 1e-9 || Math.abs(Math.abs(o) - Math.abs(om)) <= 1e-9 && o * pref > 0) && (om = o);
      }
      if (om == null) {
        for (let m = -1; m <= 1; m++) {
          let o = (dfi + TAU * m) / Dx;
          (om == null || Math.abs(o) < Math.abs(om)) && (om = o);
        }
        Rr = Math.max(0.55 * Rr, SIN_SLOPE / (1.2 * Math.abs(om))), om = clamp2(om, -SIN_SLOPE / (1.2 * Rr), SIN_SLOPE / (1.2 * Rr));
      }
      let hechos = [], res2 = [];
      ks2.length = 0;
      for (let j = 0; j < nl; j++) {
        let id = s.lanes[j].id, P = br.P[id], Rj = Rr * (0.8 + 0.45 * rng()), aj = Math.min(SIN_WA * (0.8 + 0.4 * rng()), 0.3 * rw), nu = (rng() < 0.5 ? -1 : 1) * TAU / (SIN_WL * (0.8 + 0.5 * rng())), ph = rng() * TAU, thj = FI[iA] + mir * (j & 1 ? -1 : 1) * Math.PI * (1 - (j + 0.5) / nl), O = new Float32Array((N + 1) * 3), base = new Float32Array(N + 1), th = new Float32Array(N + 1), Q = new Float32Array(P);
        for (let i = 0; i <= N; i++) {
          let x = i * step, t = thj + om * (x - xA), ps = ph + nu * x;
          th[i] = t;
          let c = Rj * Math.cos(t) + aj * Math.cos(ps), sn = Rj * Math.sin(t) + aj * Math.sin(ps), q = i * 3;
          O[q] = C[q] + D0[q] * c + S0[q] * sn - P[q], O[q + 1] = C[q + 1] + D0[q + 1] * c + S0[q + 1] * sn - P[q + 1], O[q + 2] = C[q + 2] + D0[q + 2] * c + S0[q + 2] * sn - P[q + 2], base[i] = smooth01((x - a0) / rw) * smooth01((b0 - x) / rw);
        }
        let cap = new Float32Array(N + 1);
        for (let i = 0; i <= N; i++) cap[i] = Math.min(1, 0.6 * rho[i] / (Rj + aj));
        let ks = suave(cap, new Float32Array(N + 1)), k = new Float32Array(N + 1);
        for (let i = 0; i <= N; i++) k[i] = base[i] * ks[i];
        let ok = !1, red = !1;
        for (let it = 0; it < 7 && !ok; it++) {
          ok = !0;
          for (let i = i0; i <= i1; i++) {
            let ki = k[i];
            if (ki < 0.02 && !hechos.length) continue;
            let q = i * 3, x = P[q] + O[q] * ki, y = P[q + 1] + O[q + 1] * ki, z = P[q + 2] + O[q + 2] * ki;
            if (hermano(i, x, y, z, hechos, ki) || ki >= 0.02 && !(i & 1) && choca(x, y, z, sg)) {
              if (ki < 0.02) return null;
              ok = !1, red = !0, cap[i] = it < 4 ? ks[i] * 0.5 : 0, i < N && cap[i + 1] > cap[i] && (cap[i + 1] = cap[i]), i && cap[i - 1] > cap[i] && (cap[i - 1] = cap[i]);
            }
          }
          if (!ok) {
            suave(cap, ks);
            for (let i = 0; i <= N; i++) k[i] = base[i] * ks[i];
          }
        }
        if (!ok) {
          k.fill(0);
          for (let i = i0; i <= i1; i++) if (hermano(i, P[i * 3], P[i * 3 + 1], P[i * 3 + 2], hechos, 0)) return null;
        }
        for (let i = 0; i <= N; i++) {
          let q = i * 3;
          Q[q] += O[q] * k[i], Q[q + 1] += O[q + 1] * k[i], Q[q + 2] += O[q + 2] * k[i];
        }
        for (let it = 0; it < SIN_ALISA; it++) {
          let px2 = Q[i0 * 3], py2 = Q[i0 * 3 + 1], pz2 = Q[i0 * 3 + 2];
          for (let i = i0 + 1; i < i1; i++) {
            let q = i * 3, wt = 0.5 * Math.min(1, k[i] * 8), x = Q[q], y = Q[q + 1], z = Q[q + 2];
            Q[q] += wt * ((px2 + Q[q + 3]) / 2 - x), Q[q + 1] += wt * ((py2 + Q[q + 4]) / 2 - y), Q[q + 2] += wt * ((pz2 + Q[q + 5]) / 2 - z), px2 = x, py2 = y, pz2 = z;
          }
        }
        hechos.push(Q), ks2.push(k), res2.push({ id, Q, k, base, th, ph, nu, est: ok ? red ? 1 : 2 : 0 });
      }
      return res2;
    };
    tq = performance.now();
    let res = null;
    for (let f of [1, 0.6, 0.35]) {
      if (res = intenta(R * f), res) break;
      st.reintentos++;
    }
    if (lap("intenta"), !res) {
      st.caminos += nl, st.nulos += nl, st.revertidos++;
      return;
    }
    let lim = SIN_ROLL * step;
    br.sroll = [];
    let giro = (L2) => {
      let M = new Float32Array(N + 1).fill(1e6);
      M[0] = 0, M[N] = 0;
      for (let i = i0; i <= i1; i++) {
        let q = i * 3, x = L2.Q[q], y = L2.Q[q + 1], z = L2.Q[q + 2], j0 = Math.max(i0, i - 7), j1 = Math.min(i1, i + 7);
        cerca: for (let o of res)
          if (!(o === L2 || (o.Q[q] - x) ** 2 + (o.Q[q + 1] - y) ** 2 + (o.Q[q + 2] - z) ** 2 > LEJ2)) {
            for (let j = j0; j <= j1; j++) if ((o.Q[j * 3] - x) ** 2 + (o.Q[j * 3 + 1] - y) ** 2 + (o.Q[j * 3 + 2] - z) ** 2 < SIN_ROLLD * SIN_ROLLD) {
              M[i] = 0;
              break cerca;
            }
          }
      }
      for (let i = 0; i <= N; i++) (i < i0 || i > i1) && (M[i] = 0);
      for (let i = 1; i <= N; i++) M[i] > M[i - 1] + lim && (M[i] = M[i - 1] + lim);
      for (let i = N - 1; i >= 0; i--) M[i] > M[i + 1] + lim && (M[i] = M[i + 1] + lim);
      let roll = new Float32Array(N + 1), t0 = TAU * Math.round((L2.th[iA] + AW[iA]) / TAU);
      for (let i = 0; i <= N; i++) {
        let k = L2.k[i];
        roll[i] = k > 0 ? clamp2(Math.min(1, k / Math.max(0.05, L2.base[i])) * smooth01(k * 3) * (L2.th[i] + AW[i] - t0 + 0.45 * Math.sin(L2.ph + L2.nu * i * step)), -M[i], M[i]) : 0;
      }
      for (let i = 1; i <= N; i++) roll[i] = clamp2(roll[i], roll[i - 1] - lim, roll[i - 1] + lim);
      for (let i = N - 1; i >= 0; i--) roll[i] = clamp2(roll[i], roll[i + 1] - lim, roll[i + 1] + lim);
      return roll;
    }, rolls = res.map(giro);
    res.forEach((L2, j) => {
      st.caminos++, L2.est === 2 ? st.completos++ : L2.est === 1 ? st.reducidos++ : st.nulos++, br.P[L2.id].set(L2.Q), br.sroll[L2.id] = rolls[j], movido.add(sg * 8 + L2.id);
      for (let i = 0; i <= N; i += 2) add(L2.Q[i * 3], L2.Q[i * 3 + 1], L2.Q[i * 3 + 2], sg, L2.id, i, 1);
    }), lap("giro"), !0 && (br.len = [], br.curves = [], br.sin = !0);
  }), tq = performance.now(), ajustarEventos(world, segs, wayOf, cerca), lap("eventos"), TT.total = performance.now() - tt;
  for (let k in TT) TT[k] = Math.round(TT[k]);
}
var ARCO_KINDS = ["salto", "tirolina", "geiser", "erupcion", "rampa"];
function ajustarEventos(world, segs, wayOf, cerca) {
  let EV = Math.hypot(RIBBON_HALF + 3.2, 7.5), out = {}, fA = {}, fB = {}, fC = {}, libre = (s, sw, sg) => {
    for (let q = 0; q <= 24; q++) {
      let r = switchPath(s, sw, q / 24, out);
      if (!(sw.via === "portal" && r.vis < 1) && cerca(r.pos.x, r.pos.y, r.pos.z, EV, sg, sw.from, sw.to))
        return !1;
    }
    return !0;
  }, st = world.sinuoso;
  segs.forEach((s, sg) => {
    if (!s._braid.sin || !s.switches) return;
    let theme = wayOf.get(s).theme.id, rng = mulberry32(78e3 + sg * 53), mechs = THEME_MECHS[theme] || {}, arcos = ARCO_KINDS.filter((k) => mechs[k]);
    arcos.length || arcos.push("salto");
    for (let sw of s.switches) {
      delete sw._arc;
      let a = laneFrame(s, sw.from, sw.u, fA).pos, b = laneFrame(s, sw.to, sw.uLand, fB).pos, dy0 = laneFrame(s, sw.to, sw.u, fC).pos.y - a.y, dy = b.y - a.y, dist = a.distanceTo(b), base = sw.duration, lejos = dist > 1.6 * ROW_GAP, pone = (via) => {
        let kind = via === "arco" ? arcos[Math.floor(rng() * arcos.length)] : via, M = MECHANISMS[kind];
        Object.assign(sw, { kind, via, style: via, name: mechs[kind] || M.name, emoji: M.emoji, risk: M.risk, fail: M.fail, reward: { ...M.reward }, boost: M.boost, lejos: lejos && via !== "portal", dist: +dist.toFixed(1) }), lejos && (sw.apex = +(3.5 * TK + 0.22 * dist).toFixed(2)), sw.duration = via === "portal" ? Math.min(base, M.dur) : lejos ? +clamp2(dist / SIN_FLY, 0.9, 4.5).toFixed(2) : base, delete sw._arc;
      }, cae = dy < -0.45 * dist && dy0 < -1.5 * TK, sube = dy > 0.45 * dist && dy0 > 1.5 * TK;
      if (!lejos) {
        (sw.kind === "caida" && !cae || sw.kind === "elevador" && !sube) && pone("arco"), sw.via !== "portal" && !libre(s, sw, sg) && pone("portal"), delete sw._arc;
        continue;
      }
      let vias = cae ? ["caida", "arco", "portal"] : sube ? ["elevador", "arco", "portal"] : rng() < 0.3 ? ["portal"] : ["arco", "portal"];
      for (let via of vias)
        if (pone(via), via === "portal" || libre(s, sw, sg)) break;
      delete sw._arc;
    }
    s.switchesByLane = new Map(s.lanes.map((l) => [l.id, s.switches.filter((sw) => sw.from === l.id).sort((x, y) => x.u - y.u)]));
  }), st && (st.eventos = segs.reduce((n, s) => n + (s._braid.sin ? s.switches.length : 0), 0));
}
var TERM_MIN_ANG = 0.58, PICKS = /* @__PURE__ */ new Map(), WORLD_GEN = 10, setWorldPicks = (seed, picks) => PICKS.set(seed, picks), MAX_ATTEMPTS = 6;
function buildWorld(seed = 369, onProgress = null) {
  let known = PICKS.get(seed);
  if (known) return buildWorldAttempt(seed, onProgress, known[0]?.attempt ?? 0);
  let world, failLog = [];
  for (let attempt = 0; attempt < MAX_ATTEMPTS && (world = buildWorldAttempt(seed, onProgress, attempt), world.failLog && failLog.push(...world.failLog.map((f) => ({ attempt, ...f }))), !!world.failed); attempt++)
    ;
  return world.failLog = failLog, world;
}
function buildWorldAttempt(seed, onProgress, attempt) {
  let rng = mulberry32(seed + attempt * 7919), world = { attempt, failed: !1, nodes: [], destinos: [], circuits: [], ways: [], waysFrom: [], routes: [], segments: [], picks: [] }, known = PICKS.get(seed), placeWay2 = (w, c, a, b, placed2) => {
    let way = placeWayAt(w, c, a, b, placed2, known?.[world.picks.length]);
    return world.picks.push(way.pick), onProgress?.(world.picks.length), way;
  }, dirs = sphereDirs(NODE_DEFS.length);
  NODE_DEFS.forEach((d, idx2) => world.nodes.push({ idx: idx2, name: d.name, color: d.color, pos: dirs[idx2].clone().multiplyScalar(SPHERE_R), radius: NODE_R })), world.nodes.forEach((node) => buildCity(world, node, NODE_DEFS[node.idx], rng)), world.waysFrom = world.nodes.map(() => []);
  let placed = [];
  for (let a = 0; a < world.nodes.length; a++)
    for (let b = a + 1; b < world.nodes.length; b++) {
      let c = { idx: world.circuits.length, a, b, theme: THEMES[world.circuits.length % THEMES.length], ways: [] };
      if (world.circuits.push(c), c.ways.push(placeWay2(world, c, a, b, placed), placeWay2(world, c, b, a, placed)), c.mid = c.ways[0].junctions[1].pos.clone().lerp(c.ways[1].junctions[1].pos, 0.5), world.failed && !known && attempt < MAX_ATTEMPTS - 1) return world;
    }
  return sinuarCaminos(world), indexarColisiones(world, relaxRibbons(world)), world;
}
function buildCity(world, node, def, rng) {
  let dirs = [];
  node.ports = [], node.portTo = [], node.terminals = [];
  let M = 36, rot0 = rng() * TAU, pool = [];
  for (let i = 0; i < M; i++) {
    let y = 1 - 2 * (i + 0.5) / M, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5)) + rot0;
    pool.push(new Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
  }
  let pickTerminal = (biasDir) => {
    for (let minAng of [0.82, TERM_MIN_ANG]) {
      let minDot = Math.cos(minAng), cands = pool.filter((d) => dirs.every((u) => u.dot(d) < minDot));
      if (!cands.length) continue;
      let weights = cands.map((d) => {
        let dot = d.dot(biasDir);
        return Math.pow(Math.max(0.05, (dot + 1) * 0.5), 3) * (dot > -0.25 ? 4 : 1);
      }), total = weights.reduce((s, w) => s + w, 0), r = rng() * total;
      for (let i = 0; i < cands.length; i++)
        if (r -= weights[i], r <= 0) return dirs.push(cands[i].clone()) - 1;
      return dirs.push(cands[cands.length - 1].clone()) - 1;
    }
    return dirs.push(biasDir.clone()) - 1;
  }, pendingTerms = [];
  for (let o of world.nodes) {
    if (o === node) continue;
    let up = node.pos.clone().normalize(), tan = o.pos.clone().normalize().addScaledVector(up, -o.pos.clone().normalize().dot(up)).normalize(), side = new Vector3().crossVectors(up, tan), base = tan.multiplyScalar(0.85).addScaledVector(up, 0.5), dir = base.clone().normalize(), out = pickTerminal(base.clone().addScaledVector(side, 0.45).normalize()), inn = pickTerminal(base.clone().addScaledVector(side, -0.45).normalize());
    node.portTo[o.idx] = { to: o.idx, dir, in: inn, out, wayIn: null, wayOut: null }, node.ports.push(node.portTo[o.idx]), pendingTerms.push({ vert: out, kind: "out", to: o.idx }, { vert: inn, kind: "in", to: o.idx });
  }
  let nPort = dirs.length, N = 28, rot = rng() * TAU;
  for (let i = 0; i < N; i++) {
    let y = 1 - 2 * (i + 0.5) / N, r = Math.sqrt(1 - y * y), a = i * Math.PI * (3 - Math.sqrt(5)) + rot, d = new Vector3(Math.cos(a) * r, y, Math.sin(a) * r);
    dirs.every((q) => q.dot(d) < 0.94) && dirs.push(d);
  }
  node.verts = dirs.map((dir) => ({ dir, pos: node.pos.clone().addScaledVector(dir, NODE_R) })), node.terminals = pendingTerms.map((t) => ({
    vert: t.vert,
    kind: t.kind,
    way: null,
    to: t.to,
    dir: node.verts[t.vert].dir,
    pos: node.verts[t.vert].pos
  })), node.roads = [];
  let adj = dirs.map(() => []), link = (a, b) => {
    if (a === b || adj[a].includes(b)) return;
    adj[a].push(b), adj[b].push(a);
    let ang = dirs[a].angleTo(dirs[b]), k = Math.max(2, Math.ceil(ang / 0.1)), points = [];
    for (let i = 0; i <= k; i++) points.push(slerpDir(dirs[a], dirs[b], i / k).multiplyScalar(NODE_R).add(node.pos));
    node.roads.push({ a, b, length: ang * NODE_R, points });
  };
  for (dirs.forEach((d, i) => dirs.map((q, j) => [d.dot(q), j]).filter((x) => x[1] !== i).sort((x, y) => y[0] - x[0]).slice(0, 3).forEach(([, j]) => link(i, j))); ; ) {
    let seen = /* @__PURE__ */ new Set([0]), q = [0];
    for (; q.length; ) for (let j of adj[q.pop()]) seen.has(j) || (seen.add(j), q.push(j));
    if (seen.size === dirs.length) break;
    let best = null;
    for (let i of seen) dirs.forEach((d, j) => {
      !seen.has(j) && (!best || d.dot(dirs[i]) > best[0]) && (best = [d.dot(dirs[i]), i, j]);
    });
    link(best[1], best[2]);
  }
  let dist = dirs.map((_, i) => dirs.map((_2, j) => i === j ? 0 : 1 / 0));
  node.hop = dirs.map(() => dirs.map((_, j) => j));
  for (let r of node.roads) dist[r.a][r.b] = dist[r.b][r.a] = r.length;
  for (let k = 0; k < dirs.length; k++) for (let i = 0; i < dirs.length; i++) for (let j = 0; j < dirs.length; j++)
    dist[i][k] + dist[k][j] < dist[i][j] && (dist[i][j] = dist[i][k] + dist[k][j], node.hop[i][j] = node.hop[i][k]);
  node.destinos = [];
  let spots = shuffle(dirs.map((_, i) => i).slice(nPort), rng), names = { puntos: [...DEST_NAMES.puntos], energia: [...DEST_NAMES.energia] };
  for (let j = 0; j < def.n; j++) {
    let kind = j === 0 ? "puntos" : j === 1 ? "energia" : rng() < def.bias ? "puntos" : "energia", vert = spots[j], d = {
      idx: world.destinos.length,
      node: node.idx,
      kind,
      name: names[kind].splice(Math.floor(rng() * names[kind].length), 1)[0],
      // puntos dan puntos y cuestan energía; energía al revés
      dp: kind === "puntos" ? ri(rng, 10, 25) : -ri(rng, 4, 10),
      de: kind === "energia" ? ri(rng, 14, 32) : -ri(rng, 5, 12),
      vert,
      dir: node.verts[vert].dir,
      pos: node.verts[vert].pos
    };
    node.destinos.push(d), world.destinos.push(d);
  }
}
var basis = (A, B) => {
  let C = B.clone().sub(A), L = C.length(), c = L < 1e-6 ? new Vector3(0, 0, 1) : C.clone().divideScalar(L), u = new Vector3().crossVectors(c, Math.abs(c.y) > 0.95 ? X : Y).normalize();
  return { C, L, c, u, v: new Vector3().crossVectors(u, c) };
}, at = (A, C, t, ...offs) => {
  let p = A.clone().addScaledVector(C, t);
  for (let i = 0; i < offs.length; i += 2) p.addScaledVector(offs[i], offs[i + 1]);
  return p;
}, coil = (A, B, turns, rad, A0 = A, ease2 = (t) => t, spin = !1) => {
  let { u, v } = basis(A, B), C = B.clone().sub(A0), n = Math.ceil(turns * 16), pts = [], cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + (spin ? rad((i - 0.5) / n) : 1));
  for (let i = 1; i < n; i++) {
    let t = i / n, a = cum[i] / cum[n] * turns * TAU;
    pts.push(at(A0, C, ease2(t), u, Math.cos(a) * rad(t), v, Math.sin(a) * rad(t)));
  }
  return pts;
}, PITCH = FILA_W + 2 * RIBBON_HALF + 3 * TK, smooth01 = (x) => (x = clamp2(x, 0, 1), x * x * (3 - 2 * x)), bump = (t) => smooth01(Math.min(1, 2.2 * t, 2.2 * (1 - t))), BUMP_MEAN = (() => {
  let s = 0;
  for (let i = 0; i < 64; i++) s += bump((i + 0.5) / 64);
  return s / 64;
})(), PLANS = {
  rampa: [[0, 1.4], [0.45, 1.3], [0, 0.6], [-0.45, 1.3], [0, 1.4]],
  // curva y contracurva abiertas
  horquilla: [[0, 0.7], [0.9, 0.8], [0, 0.3], [-1.8, 1.5], [0, 0.3], [0.9, 0.8], [0, 0.7]],
  // vuelta cerrada
  turbina: [[0, 2.2], [0.5, 2.4], [0, 0.4], [-0.5, 2.4], [0, 2.2]],
  // recta larga y barrido rápido
  hielo_resbaloso: [[0, 3], [0.4, 2], [0, 1], [-0.4, 2], [0, 3]],
  // rectas largas y curva peraltada
  pantano: [[0, 0.6], [0.8, 1], [0, 0.5], [-1.6, 1.6], [0, 0.5], [0.8, 1], [0, 0.6]],
  // curvas lentas
  cascada: [[0, 1], [0.6, 3], [0, 0.6], [-0.6, 3], [0, 1]]
  // gran curva en bajada
}, ROLE_TURN = { rapida: 0.7, lenta: 1.25, media: 1 }, ROLE_HILL = { rapida: 0.015, lenta: 0.05, media: 0.035 };
function trackPts(kind, A, B, Ta, Tb, opt) {
  let rng = opt.rng || Math.random, { L, c, u, v } = basis(A, B), roll = (rng() - 0.5) * 0.7, side = u.clone().multiplyScalar(Math.cos(roll)).addScaledVector(v, Math.sin(roll)), up = new Vector3().crossVectors(side, c), kT = (ROLE_TURN[opt.role] ?? 1) * (0.85 + rng() * 0.3) * (rng() < 0.5 ? -1 : 1), pieces = PLANS[kind].map(([turn, len]) => [turn * kT, len * (0.8 + rng() * 0.4)]), head = (T) => T ? clamp2(Math.atan2(T.dot(side), T.dot(c)), -1.2, 1.2) : 0, psi0 = head(Ta), psi1 = head(Tb), S = pieces.reduce((s, p) => s + p[1], 0), kappa = (s) => {
    let acc = 0;
    for (let [turn, len] of pieces) {
      if (s < acc + len) {
        let x = (s - acc) / len;
        return turn ? turn / (0.75 * len) * Math.min(1, x / 0.25, (1 - x) / 0.25) : 0;
      }
      acc += len;
    }
    return 0;
  }, M = 240, ds = S / M, xs = new Float32Array(M + 1), ys = new Float32Array(M + 1), hill = (ROLE_HILL[opt.role] ?? 0.02) * L * (rng() < 0.5 ? -1 : 1), scale = 1, kx = 1;
  for (let pass = 0; pass < 4; pass++) {
    let psiPlan = 0, x = 0, y = 0;
    for (let i = 0; i <= M; i++) {
      xs[i] = x, ys[i] = y;
      let psi = psiPlan * scale + psi0 + (psi1 - psi0) * smooth01(i / M);
      psiPlan += kappa((i + 0.5) * ds) * ds, x += Math.cos(psi) * ds, y += Math.sin(psi) * ds;
    }
    kx = L / Math.max(xs[M], 1e-3);
    let ymax = 0;
    for (let i = 0; i <= M; i++) ymax = Math.max(ymax, Math.abs((ys[i] - ys[M] * smooth01(i / M)) * kx));
    let lim = 0.12 * L;
    if (xs[M] > 0.35 * S && ymax <= lim) break;
    scale *= Math.min(0.8, lim / Math.max(ymax, 1e-3));
  }
  let TAUE = 0.18, G = (x) => x < 1 ? x - x * x / 2 : 0.5, slope = (T) => T ? clamp2(T.dot(up) / Math.max(0.2, Math.hypot(T.dot(c), T.dot(side))), -2, 2) : 0, m0 = slope(Ta), m1 = slope(Tb), n = clamp2(Math.round(L / (2.5 * TK)), 12, 120), pts = [];
  for (let j = 1; j < n; j++) {
    let i = Math.round(j / n * M), t = i / M, along = xs[i] * kx, tx = along / L, y = (ys[i] - ys[M] * smooth01(t)) * kx, z = hill * Math.sin(Math.PI * t) + L * TAUE * (m0 * G(tx / TAUE) - m1 * G((1 - tx) / TAUE) - (m0 * tx - m1 * (1 - tx)) / 2);
    pts.push(A.clone().addScaledVector(c, along).addScaledVector(side, y).addScaledVector(up, z));
  }
  return pts;
}
function bezierPts(P0, T0, P1, T1, kf = 0.42) {
  let d = P0.distanceTo(P1), k = d * kf, n = clamp2(Math.round(d / (2.5 * TK)), 4, 80), pts = [], c1 = at(P0, T0, k), c2 = at(P1, T1, -k);
  for (let i = 1; i < n; i++) {
    let t = i / n, s = 1 - t;
    pts.push(P0.clone().multiplyScalar(s * s * s).addScaledVector(c1, 3 * s * s * t).addScaledVector(c2, 3 * s * t * t).addScaledVector(P1, t * t * t));
  }
  return pts;
}
var HELI_RMIN = +(globalThis.process?.env?.HELI_RMIN ?? 60), heliR = (r0) => r0 >= HELI_RMIN ? [r0, 1] : [HELI_RMIN, r0 / HELI_RMIN], SHAPES = {
  // las vueltas guardan un paso mínimo (PITCH): entre dos vueltas caben los carriles de la trenza
  espiral: (A, B, P) => {
    let [R, k] = heliR(3.2 * WS * AK * P.coil);
    return coil(A, B, Math.max(1, k * Math.min(2 + P.turns, Math.max(1, A.distanceTo(B) * BUMP_MEAN / PITCH))), (t) => R * bump(t), A, void 0, !0);
  },
  sacacorchos: (A, B, P) => {
    let [R, k] = heliR((P.radius * 1.85 + 4.7 * TK) * AK);
    return coil(A, B, Math.max(1, k * Math.min(3 + P.turns, Math.max(1, A.distanceTo(B) * BUMP_MEAN / PITCH))), (t) => R * bump(t), A, void 0, !0);
  },
  // remolino que se cierra: empieza en el borde del cono (A) y acaba en su vértice (B)
  embudo: (A, B, P) => {
    let R = 4 * WS * AK * P.coil;
    return coil(A, B, Math.min(3, Math.max(1, A.distanceTo(B) / (2 * PITCH))), (t) => R * (1 - t), at(A, basis(A, B).u, -R), (t) => 0.5 * t + 0.5 * t * t);
  },
  // tiro horizontal: parábola de caída libre
  caida: (A, B) => {
    let { C } = basis(A, B);
    return [1, 2, 3, 4, 5, 6, 7].map((i) => new Vector3(A.x + C.x * (i / 8), A.y + C.y * (i / 8) ** 2, A.z + C.z * (i / 8)));
  },
  // un salto largo (un solo arco: sin botes alternados)
  trampolin: (A, B) => {
    let { C, L } = basis(A, B), h = 2.5 * WS + L * 0.15;
    return Array.from({ length: 11 }, (_, i) => at(A, C, (i + 1) / 12, Y, h * Math.sin((i + 1) / 12 * Math.PI)));
  },
  canon: (A, B) => {
    let { C, L } = basis(A, B);
    return Array.from({ length: 9 }, (_, i) => at(A, C, (i + 1) / 10, Y, L * 1 * ((i + 1) / 10) * (1 - (i + 1) / 10)));
  },
  portal: (A, B) => {
    let { C, v } = basis(A, B);
    return [at(A, C, 0.35, v, 0.9 * WS), at(A, C, 0.65, v, 0.9 * WS)];
  },
  geiser: (A, B) => {
    let { C, L } = basis(A, B), h = Math.min(9.5 * WS, 3.8 * WS + L * 0.22);
    return Array.from({ length: 9 }, (_, i) => {
      let t = (i + 1) / 10;
      return at(A, C, Math.pow(t, 1.15), Y, h * Math.sin(Math.PI * Math.pow(t, 0.8)));
    });
  },
  erupcion: (A, B) => {
    let { C, L, u } = basis(A, B), h = Math.min(11 * WS, 4.5 * WS + L * 0.26);
    return Array.from({ length: 9 }, (_, i) => {
      let t = (i + 1) / 10;
      return at(A, C, t, Y, h * 4 * t * (1 - t), u, Math.sin(t * Math.PI) * 1.4 * WS);
    });
  }
};
SHAPES.salida = SHAPES.llegada = () => [];
var OUT_GATES = ["arco_salida", "parrilla_semaforo", "tunel_rampa", "lanzadera_aros", "puente_banderas"], IN_GATES = ["meta_cuadros", "embudo_llegada", "portal_llegada", "arco_meta", "tunel_frenado"], ownsStart = (k) => KINDS[k].air || k === "embudo", GRID_LEN = 14 * TK, PORT_ZONE = NODE_R + GRID_LEN + BRAID_OPEN + BRAID_PAD, FINISH_LEN = 10 * TK, ONDULA = { off: !!globalThis.process?.env?.NO_ONDULA }, OND_L = +(globalThis.process?.env?.OND_L ?? 160), OND_RC = +(globalThis.process?.env?.OND_RC ?? 120), OND_PUERTO = +(globalThis.process?.env?.OND_PUERTO ?? 1.6), OND_KINDS = /* @__PURE__ */ new Set(["horquilla", "rizo", "salida", "llegada"]), OND_STEP = 12;
function ondula(curve, kind) {
  if (ONDULA.off || !OND_KINDS.has(kind)) return curve;
  let src = curve.points, Lc = 0;
  for (let i = 1; i < src.length; i++) Lc += src[i].distanceTo(src[i - 1]);
  let M = Math.max(src.length - 1, Math.ceil(Lc / OND_STEP)), pts = new Array(M + 1), s = new Float32Array(M + 1);
  for (let i = 0; i <= M; i++)
    pts[i] = curve.getPoint(i / M), i && (s[i] = s[i - 1] + pts[i].distanceTo(pts[i - 1]));
  let L = s[M], z0 = 0, z1 = L, r0 = 40, r1 = 40, rc = OND_RC;
  if (kind === "salida" || kind === "llegada") {
    let a0 = NODE_OPEN + Math.max(4 * TK, Math.min(BRAID_RAMP, (L - GRID_LEN - 2 * TK - BRAID_OPEN) * 0.3)), Lu = L - a0 - HUB_OPEN - OPEN_RAMP;
    z0 = (kind === "salida" ? GRID_LEN : FINISH_LEN) + 2 * TK, rc = OND_RC * OND_PUERTO, Lu >= SIN_MIN && (z1 = a0 + 0.35 * clamp2(Lu * 0.3, 110, 540), r1 = 120);
  }
  let Z = z1 - z0;
  if (Z < 150) return curve;
  let lam = clamp2(Z / 1.5, 110, OND_L), k = TAU / lam, amp = 1 / (k * k * rc), rev = kind === "llegada", x = (i) => rev ? L - s[i] : s[i], T = new Array(M + 1);
  for (let i = 0; i <= M; i++) T[i] = pts[Math.min(M, i + 1)].clone().sub(pts[Math.max(0, i - 1)]).normalize();
  let w0 = new Float32Array(M + 1), w = new Float32Array(M + 1);
  for (let i = 0; i <= M; i++) {
    let p = Math.max(0, i - 2), q = Math.min(M, i + 2), kap = T[p].angleTo(T[q]) / Math.max(1e-3, s[q] - s[p]);
    w0[i] = clamp2(1.3 - kap * 200, 0, 1);
  }
  let any = !1;
  for (let i = 0; i <= M; i++) {
    let m = 0, n = 0;
    for (let j = Math.max(0, i - 3); j <= Math.min(M, i + 3); j++)
      m += w0[j], n++;
    let xi = x(i);
    w[i] = m / n * smooth01((xi - z0) / r0) * smooth01((z1 - xi) / r1), w[i] > 0.05 && (any = !0);
  }
  if (!any) return curve;
  let h = Math.abs(Math.round(src[0].x * 7.3 + src[0].y * 3.1 + src[0].z * 5.7 + src[src.length - 1].x * 1.9)), ph = h % 628 / 100, sg = h & 1 ? 1 : -1, n1 = new Vector3().crossVectors(T[0], Math.abs(T[0].y) < 0.9 ? Y : X).normalize(), n2 = new Vector3();
  for (let i = 0; i <= M; i++) {
    n1.addScaledVector(T[i], -n1.dot(T[i])).normalize(), n2.crossVectors(T[i], n1);
    let a = ph + sg * k * s[i], g = w[i] * amp;
    g > 0 && pts[i].addScaledVector(n1, g * Math.cos(a)).addScaledVector(n2, g * Math.sin(a));
  }
  return new CatmullRomCurve3(pts, !1, "centripetal");
}
var LINK_K = 1 / (9 * TK), LINK_KS = [0.42, 0.62], EMPALME = { off: !!globalThis.process?.env?.NO_LINK_FIX };
function shape(kind, A, B, P, Ta, Tb, midPt = null, opt = {}) {
  let lead = Math.min(2.5 * WS, A.distanceTo(B) * 0.15), air = KINDS[kind].air, cr = (pts2) => new CatmullRomCurve3(pts2, !1, "centripetal");
  if (PLANS[kind]) return ondula(cr([A, ...trackPts(kind, A, B, Ta, Tb, opt), B]), kind);
  if (kind === "rizo") {
    let { C, L, c, u, v } = basis(A, B), r = Math.min(Math.max(3.4 * WS * AK * P.coil, 13 * TK * AK), L * 0.3), sh = Math.max(P.radius * 2.4, PITCH), loop = [];
    for (let k = 0; k <= 24; k++) {
      let a = k / 24 * TAU;
      loop.push(at(A, C, 0.5, c, r * Math.sin(a), v, r * (1 - Math.cos(a)), u, sh * (k / 24 - 0.5)));
    }
    let tIn = c.clone().addScaledVector(u, sh / (TAU * r)).normalize();
    return ondula(cr([A, ...bezierPts(A, Ta || c, loop[0], tIn), ...loop, ...bezierPts(loop[24], tIn, B, Tb || c), B]), kind);
  }
  if (kind === "salida" || kind === "llegada") {
    let out = kind === "salida", G0 = out ? at(A, Ta, GRID_LEN) : A, G1 = out ? B : at(B, Tb, -FINISH_LEN), T0 = out ? Ta : Ta.clone().normalize(), T1 = Tb.clone().normalize(), pts2 = out ? [A, at(A, Ta, GRID_LEN * 0.5), G0] : [A], P0 = G0, D0 = T0;
    for (let W of midPt ? [midPt, G1] : [G1]) {
      let D1 = W === G1 ? T1 : G1.clone().sub(P0).normalize();
      pts2.push(...bezierPts(P0, D0, W, D1)), pts2.push(W.clone()), P0 = W, D0 = D1;
    }
    return out || pts2.push(at(B, Tb, -FINISH_LEN * 0.5), B), ondula(cr(pts2), kind);
  }
  let leadA = Ta && !ownsStart(kind), leadB = Tb && !air, body = SHAPES[kind](A, B, P).filter((p) => !(leadA && p.distanceTo(A) < lead * 1.1) && !(leadB && p.distanceTo(B) < lead * 1.1)), dirOf = (p, q) => q.clone().sub(p).normalize(), kA = 0.42, kB = 0.42;
  if (!EMPALME.off && body.length >= 4) {
    let va = new Vector3(), vb = new Vector3(), curv = (seq) => {
      let m = 0;
      for (let i = 1; i < seq.length - 1; i++) {
        va.subVectors(seq[i], seq[i - 1]), vb.subVectors(seq[i + 1], seq[i]);
        let l = (va.length() + vb.length()) / 2;
        l > 1e-6 && (m = Math.max(m, va.angleTo(vb) / l));
      }
      return m;
    };
    if (leadB) {
      let max = Math.floor(body.length * 0.5), best = 1 / 0, bi = body.length - 1;
      busca: for (let c = 0; c <= max; c++) {
        let i = body.length - 1 - c;
        if (i < 2) break;
        for (let k of LINK_KS) {
          let bz = bezierPts(body[i], dirOf(body[i - 1], body[i]), B, Tb, k), v = curv([body[i - 1], body[i], ...bz, B, at(B, Tb, B.distanceTo(bz[bz.length - 1]))]);
          if (v < best && (best = v, bi = i, kB = k), v < LINK_K) break busca;
        }
      }
      body = body.slice(0, bi + 1);
    }
    if (leadA) {
      let max = Math.floor(body.length * 0.5), best = 1 / 0, bi = 0;
      busca: for (let c = 0; c <= max; c++) {
        let i = c;
        if (i > body.length - 3) break;
        for (let k of LINK_KS) {
          let bz = bezierPts(A, Ta, body[i], dirOf(body[i], body[i + 1]), k), v = curv([at(A, Ta, -A.distanceTo(bz[0])), A, ...bz, body[i], body[i + 1]]);
          if (v < best && (best = v, bi = i, kA = k), v < LINK_K) break busca;
        }
      }
      body = body.slice(bi);
    }
  }
  let pts = [A];
  midPt && pts.push(midPt), leadA && body.length >= 2 ? pts.push(...bezierPts(A, Ta, body[0], dirOf(body[0], body[1]), kA)) : leadA && pts.push(at(A, Ta, lead)), pts.push(...body);
  let nb = body.length;
  return leadB && nb >= 2 ? pts.push(...bezierPts(body[nb - 1], dirOf(body[nb - 2], body[nb - 1]), B, Tb, kB)) : leadB && pts.push(at(B, Tb, -lead)), pts.push(B), new CatmullRomCurve3(pts, !1, "centripetal");
}
function wrapMid(node, dir, target) {
  let toTarget = target.clone().sub(node.pos).normalize();
  return dir.dot(toTarget) >= 0.35 ? null : node.pos.clone().addScaledVector(slerpDir(dir, toTarget, 0.55), NODE_R + GRID_LEN + 3 * TK);
}
var routeExtent = (seg, u) => Math.max(seg.radius, BRAID_A * braidEnv(seg, u, !1) + LANE_W / 2 + 0.5 * TK), ROUTE_JOIN = 56 * TK * AK, SPREAD_K = 1.3, SPREAD_STEPS = [1, 1.4, 1.9], PERMS = { 2: [[0, 1], [1, 0]], 3: [[0, 1, 2], [2, 1, 0], [1, 0, 2], [0, 2, 1], [1, 2, 0], [2, 0, 1]] }, ROUTE_MARGIN = 1.5 * TK * AK, FAN_ANG = 0.2, FAN_D = 105 * TK * AK, inPort = (p, q) => p.zn >= 0 && (q.f === p.zn || q.t === p.zn) || q.zn >= 0 && (p.f === q.zn || p.t === q.zn), PORT_X_R0 = NODE_R + 0.5 * 14 * TK, PORT_X_LAT = 2 * RIBBON_HALF + 1.5 * TK * AK / 2, PORT_X_MIN = 1.5 * TK, PORT_X_H = 6 * TK + 0.75 + 1 * TK, PORT_X_SCORE = 0.6 * TK + 0.01, PORT_X_TRIES = 2, PORT_WF = {}, NO_PORT_X = !!globalThis.process?.env?.NO_PORT_X, NO_PORT_PODA = !!globalThis.process?.env?.NO_PORT_PODA, portCross = (a, b) => {
  let dx = b.p.x - a.p.x, dy = b.p.y - a.p.y, dz = b.p.z - a.p.z, d2 = dx * dx + dy * dy + dz * dz;
  if (d2 > PORT_X_H * PORT_X_H + PORT_X_LAT * PORT_X_LAT) return !1;
  for (let u of [a.up, b.up]) {
    let h = Math.abs(dx * u.x + dy * u.y + dz * u.z);
    if (h > PORT_X_MIN && h < PORT_X_H && d2 - h * h < PORT_X_LAT * PORT_X_LAT) return !0;
  }
  return !1;
};
function sampleWayPoints(way, steps = 14, soloPuerto = !1) {
  let pts = [];
  for (let s of way.segments) {
    if (soloPuerto && s.kind !== "salida" && s.kind !== "llegada") continue;
    let n = steps === 28 ? Math.max(12, Math.ceil(s.length / (1.5 * TK * AK))) : steps;
    for (let k = 0; k <= n; k++) {
      let u = k / n, p = s.curve.getPointAt(u), zn = way.ends.findIndex((n2) => p.distanceToSquared(n2.pos) < PORT_ZONE * PORT_ZONE), hubD2 = 1 / 0;
      for (let j of way.junctions) hubD2 = Math.min(hubD2, j.pos.distanceToSquared(p));
      let hubD = Math.sqrt(hubD2), pt = { p, r: braidRadius(s, u), kind: s.kind, zn: zn < 0 ? -1 : way.ends[zn].idx, f: way.from, t: way.to, c: way.circuit.idx, route: s.route, hubD, ext: routeExtent(s, u), tube: s.radius };
      steps === 28 && zn >= 0 && !NO_PORT_X && p.distanceToSquared(way.ends[zn].pos) > PORT_X_R0 ** 2 && (pt.up = wallFrame(s, 0, u, 0, PORT_WF).up.clone()), pts.push(pt);
    }
  }
  return pts;
}
var ROUTE_CELL = 20 * TK * AK, SELF_ARC = 40 * TK * AK, NO_FIX_PTS = !!globalThis.process?.env?.NO_FIX_PTS, NO_SELF = !!globalThis.process?.env?.NO_SELF;
function routeSlack(pts, only = -1) {
  let grid = /* @__PURE__ */ new Map(), pool = pts.filter((q) => (q.route >= 0 || q.fix) && q.hubD >= ROUTE_JOIN - 6 * TK * AK), cell = (v) => Math.floor(v / ROUTE_CELL);
  for (let q of pool) {
    let key = cellKey(cell(q.p.x), cell(q.p.y), cell(q.p.z)), b = grid.get(key);
    b || grid.set(key, b = []), b.push(q);
  }
  let min = ROUTE_CELL;
  for (let q of pool) {
    if (q.fix || only >= 0 && q.h !== only) continue;
    let x = cell(q.p.x), y = cell(q.p.y), z = cell(q.p.z);
    for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
      let bucket = grid.get(cellKey(x + dx, y + dy, z + dz));
      if (bucket)
        for (let o of bucket) {
          if (!o.fix) {
            if (o.route === q.route) {
              if (NO_SELF || only < 0 || q.g == null || o.g == null || o.m === q.m && o.h === q.h || Math.abs(o.g - q.g) < SELF_ARC) continue;
            } else if (only < 0 && o.route < q.route) continue;
          }
          let r = q.ext + o.ext + MIN_GAP_K * Math.max(q.tube, o.tube), d2 = q.p.distanceToSquared(o.p), lim = r + min;
          lim > 0 && d2 < lim * lim && (min = Math.sqrt(d2) - r);
        }
    }
  }
  return min;
}
var SPATIAL_CELL = 32 * TK * AK, CAND_ARC_DIV = 48, cellKey = (x, y, z) => ((x + 1024) * 2048 + (y + 1024)) * 2048 + (z + 1024), pointCell = (p) => cellKey(Math.floor(p.x / SPATIAL_CELL), Math.floor(p.y / SPATIAL_CELL), Math.floor(p.z / SPATIAL_CELL));
function indexPlacedWay(placed, entry) {
  placed.push(entry);
  let grid = placed.grid || (placed.grid = /* @__PURE__ */ new Map()), gridC = placed.gridC || (placed.gridC = /* @__PURE__ */ new Map());
  entry.pts.forEach((q, i) => {
    let key = pointCell(q.p);
    for (let g of i % 4 === 0 ? [grid, gridC] : [grid]) {
      let bucket = g.get(key);
      bucket || g.set(key, bucket = []), bucket.push(q);
    }
  });
}
function placeWayAt(world, circuit, from, to, placed, pick) {
  if (pick) {
    let w = buildWay(world, circuit, from, to, pick.theta, pick.bowExtra, !0, pick.salt);
    return w.pick = pick, w;
  }
  return placeWay(world, circuit, from, to, placed);
}
var TARGET = 6 * TK, HUB_MIN = 24 * TK * AK, TARGET_LOW = 3 * TK, SPINE_MAX = 1.6 * SPHERE_R, LAYER_K = 0.42;
function placeWay(world, circuit, from, to, placed) {
  let a = world.nodes[from], b = world.nodes[to], others = world.nodes.filter((o) => o !== a && o !== b), baseTheta = (circuit.idx * 0.6180339887 + (from < to ? 0 : 0.5) + (world.attempt || 0) * 0.137) % 1 * TAU, N_ANG = 12, best = null, bestScore = -1 / 0, evalCand = (cand, steps, floor = -1 / 0) => {
    let pts = sampleWayPoints(cand, steps), minNode = 1 / 0, nodeMargin = PORT_ZONE, nodeAcceptSq = (nodeMargin + BRAID_A + BRAID_PAD + 2.5 * TK) ** 2;
    for (let pt of pts) {
      for (let o of others) {
        let d2 = pt.p.distanceToSquared(o.pos);
        d2 < nodeAcceptSq && (minNode = Math.min(minNode, Math.sqrt(d2) - pt.r - nodeMargin));
      }
      if (pt.kind !== "salida" && pt.p.distanceToSquared(a.pos) <= (NODE_R + pt.r) ** 2) return rej("nulo:roza_nodo_origen:" + pt.kind);
      if (pt.kind !== "llegada" && pt.p.distanceToSquared(b.pos) <= (NODE_R + pt.r) ** 2) return rej("nulo:roza_nodo_destino:" + pt.kind);
      if (pt.kind === "salida" && pt.p.distanceToSquared(a.pos) <= (NODE_R - 5e-3 * TK) ** 2) return rej("nulo:salida_dentro_nodo");
      if (pt.kind === "llegada" && pt.p.distanceToSquared(b.pos) <= (NODE_R - 5e-3 * TK) ** 2) return rej("nulo:llegada_dentro_nodo");
    }
    minNode === 1 / 0 && (minNode = 1.5 * TK);
    let minTube = 1 / 0, minHub = 1 / 0, minAt = null;
    for (let prev of placed)
      for (let h1 of cand.junctions) for (let h2 of prev.hubs) minHub = Math.min(minHub, h1.pos.distanceTo(h2.pos));
    if ((minNode < 1.5 * TK || minHub < HUB_MIN) && Math.min(TARGET, minNode + TK, minHub * 0.2) <= floor) return { minTube: -1 / 0, minNode, minHub, minAt: null };
    let grid = steps === 14 ? placed.gridC : placed.grid, lastKey = NaN, near = null;
    if (grid) for (let pt of pts) {
      let x = Math.floor(pt.p.x / SPATIAL_CELL), y = Math.floor(pt.p.y / SPATIAL_CELL), z = Math.floor(pt.p.z / SPATIAL_CELL), ck = cellKey(x, y, z);
      if (ck !== lastKey) {
        lastKey = ck, near = [];
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          let bucket = grid.get(cellKey(x + dx, y + dy, z + dz));
          bucket && near.push(bucket);
        }
      }
      for (let bucket of near)
        for (let q of bucket) {
          if (inPort(pt, q)) {
            if (pt.up && q.up && (world.attempt || 0) < PORT_X_TRIES && minTube > PORT_X_SCORE && portCross(pt, q) && (rej("cruce_en_puerto"), minTube = PORT_X_SCORE, minAt = ["puerto:" + pt.kind, q.kind, pt.c === q.c], minTube <= floor))
              return { minTube, minNode, minHub, minAt };
            continue;
          }
          let r = pt.r + q.r + MIN_GAP_K * Math.max(pt.tube, q.tube), d2 = pt.p.distanceToSquared(q.p);
          if (d2 < (r + TARGET) ** 2 && Math.sqrt(d2) - r < minTube && (minTube = Math.sqrt(d2) - r, minAt = [pt.kind, q.kind, pt.c === q.c], (minTube < CLEAR ? minTube - 10 * TK : minTube) <= floor))
            return { minTube, minNode, minHub, minAt };
        }
    }
    return { minTube, minNode, minHub, minAt };
  }, rejRes = (fase, r) => {
    DIAG.on && rej(fase + ":" + (r.minNode < 1.5 * TK ? "nodo_ajeno" : r.minHub < HUB_MIN ? "uniones_cerca" : r.minTube < CLEAR ? "tubo<CLEAR:" + (r.minAt ? r.minAt.join("/") : "?") : r.minTube < TARGET ? "tubo<TARGET" : "peor_que_el_mejor"));
  }, CLEAR = 0.6 * TK, okRes = (r, thr) => r.minTube >= thr && r.minNode >= 1.5 * TK && r.minHub >= HUB_MIN, scoreOf = (r) => Math.min(TARGET, r.minTube < CLEAR ? r.minTube - 10 * TK : Math.min(r.minTube, r.minNode + TK, r.minHub * 0.2)), commit = (c) => {
    let w = buildWay(world, circuit, from, to, c.theta, c.bowExtra, !0, c.salt);
    return w.pick = { theta: c.theta, bowExtra: c.bowExtra, salt: c.salt, attempt: world.attempt }, indexPlacedWay(placed, { pts: sampleWayPoints(w, 28), hubs: w.junctions }), w;
  }, bestRes = null, portCrossWay = (cand) => {
    let grid = placed.grid;
    if (!grid) return !1;
    for (let pt of sampleWayPoints(cand, 28, !0)) {
      if (!pt.up) continue;
      let x = Math.floor(pt.p.x / SPATIAL_CELL), y = Math.floor(pt.p.y / SPATIAL_CELL), z = Math.floor(pt.p.z / SPATIAL_CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        let bucket = grid.get(cellKey(x + dx, y + dy, z + dz));
        if (bucket) {
          for (let q of bucket) if (q.up && inPort(pt, q) && portCross(pt, q)) return !0;
        }
      }
    }
    return !1;
  }, P = PARAMS[circuit.theme.id], hubR = Math.max(P.radius, BRAID_PAD), bounds = /* @__PURE__ */ new Map(), hubBound = (theta, bowExtra) => {
    let key = `${theta},${bowExtra}`;
    if (bounds.has(key)) return bounds.get(key);
    let { J } = waySpine(world, circuit, from, to, theta, bowExtra), hs = HUB_STOPS.map(J), minTube = 1 / 0, minNode = 1 / 0, minHub = 1 / 0;
    for (let prev of placed) for (let h2 of prev.hubs) for (let h of hs) minHub = Math.min(minHub, h.distanceTo(h2.pos));
    for (let h of hs) {
      for (let o of others) {
        let d = h.distanceTo(o.pos);
        d < PORT_ZONE + BRAID_A + BRAID_PAD + 2.5 * TK && (minNode = Math.min(minNode, d - hubR - PORT_ZONE));
      }
      if (!placed.grid) continue;
      let x = Math.floor(h.x / SPATIAL_CELL), y = Math.floor(h.y / SPATIAL_CELL), z = Math.floor(h.z / SPATIAL_CELL);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        let bucket = placed.grid.get(cellKey(x + dx, y + dy, z + dz));
        if (bucket)
          for (let q of bucket) {
            let g = h.distanceTo(q.p) - hubR - q.r - MIN_GAP_K * Math.max(P.radius, q.tube);
            g < minTube && (minTube = g);
          }
      }
    }
    let s = scoreOf({ minTube, minNode, minHub });
    return bounds.set(key, s), s;
  }, tryCand = (theta, bowExtra, salt) => {
    if (hubBound(theta, bowExtra) <= bestScore)
      return rej("poda:cota_uniones"), !1;
    let cw = buildWay(world, circuit, from, to, theta, bowExtra, !1, salt, !1), coarse = evalCand(cw, 14, bestScore);
    if (!coarse || scoreOf(coarse) <= bestScore)
      return coarse && rejRes("gruesa", coarse), !1;
    if (!NO_PORT_PODA && bestScore >= PORT_X_SCORE && (world.attempt || 0) < PORT_X_TRIES && portCrossWay(cw))
      return rej("poda:cruce_en_puerto"), !1;
    let res = evalCand(buildWay(world, circuit, from, to, theta, bowExtra, !1, salt), 28, bestScore);
    if (!res) return !1;
    let score = scoreOf(res);
    return okRes(res, TARGET) || rejRes("fina", res), score > bestScore && (bestScore = score, best = { theta, bowExtra, salt }, bestRes = res), okRes(res, TARGET);
  }, BOWS = [-12, 0, 10, 20, 32, 46, 62, 80, 100].map((x) => x * WS * SIZE_K);
  if (!(() => {
    for (let [half, salt] of [[0, 0], [0.5, 1], [0.25, 2]]) {
      for (let bowExtra of BOWS) {
        for (let k = 0; k < N_ANG; k++)
          if (tryCand((baseTheta + (k + half) / N_ANG * TAU) % TAU, bowExtra, salt)) return !0;
        if (bestRes && okRes(bestRes, TARGET_LOW)) return !0;
      }
      if (bestRes && okRes(bestRes, TARGET_LOW)) return !0;
    }
    return !1;
  })() && !(bestRes && okRes(bestRes, CLEAR))) {
    extra: for (let salt of [3, 4]) for (let bow of [-30, 0, 40, 120, 200, 300]) for (let k = 0; k < N_ANG; k += 2)
      if (tryCand((baseTheta + (k + 0.375) / N_ANG * TAU) % TAU, bow * WS * SIZE_K, salt) || bestRes && okRes(bestRes, CLEAR)) break extra;
  }
  return best && bestRes && okRes(bestRes, CLEAR) ? commit(best) : (world.failed = !0, rej("FALLO_camino"), (world.failLog ||= []).push({ way: world.ways.length, circuit: circuit.idx, ...bestRes }), commit(best || { theta: baseTheta, bowExtra: 0, salt: 0 }));
}
var FLEX_PLAIN = FLEX.filter((k) => !KINDS[k].event), GRAV_PLAIN = GRAV.filter((k) => !KINDS[k].event), EVENT_FLEX = FLEX.filter((k) => KINDS[k].event), EVENT_ALL = OBSTACLES.filter((k) => KINDS[k].event), HUB_STOPS = [0.16, 0.5, 0.84];
function waySpine(world, circuit, from, to, theta, bowExtra) {
  let a = world.nodes[from], b = world.nodes[to], P = PARAMS[circuit.theme.id], S = a.verts[a.portTo[to].out].pos, E = b.verts[b.portTo[from].in].pos, dS = S.clone().normalize(), dE = E.clone().normalize(), axis = new Vector3().crossVectors(dS, dE);
  axis.lengthSq() < 1e-6 && (axis = new Vector3().crossVectors(dS, Math.abs(dS.y) > 0.9 ? X : Y)), axis.normalize();
  let arcA = dS.angleTo(dE), rS = S.length(), rE = E.length(), radial = (s) => dS.clone().applyAxisAngle(axis, arcA * s), ct = Math.cos(theta), st = Math.sin(theta), bow = P.bow + bowExtra;
  return { J: (s) => {
    let f = Math.pow(Math.sin(Math.PI * s), 0.72), r = radial(s), lat = new Vector3().crossVectors(axis, r), p = r.clone().multiplyScalar(rS + (rE - rS) * s + SPHERE_R * LAYER_K * f * st + P.arch * f * 0.5).addScaledVector(lat, (from < to ? 1 : -1) * bow * f * ct * 0.7);
    return p.lengthSq() > SPINE_MAX ** 2 ? p.setLength(SPINE_MAX) : p;
  }, axis };
}
function buildWay(world, circuit, from, to, theta = 0, bowExtra = 0, commit = !0, salt = 0, rowSearch = !0) {
  let { nodes } = world, a = nodes[from], b = nodes[to], theme = circuit.theme, P = PARAMS[theme.id], rng = mulberry32(7e3 + circuit.idx * 31 + (from < to ? 0 : 1)), pOut = a.portTo[to], pIn = b.portTo[from], S = a.verts[pOut.out].pos, nS = a.verts[pOut.out].dir, E = b.verts[pIn.in].pos, nE = b.verts[pIn.in].dir, { J, axis } = waySpine(world, circuit, from, to, theta, bowExtra), n1 = axis.clone(), stops = HUB_STOPS, hubs = stops.map(J), hubT = stops.map((s) => J(s + 0.02).sub(J(s - 0.02)).normalize()), way = {
    idx: world.ways.length,
    id: `${from}>${to}`,
    circuit,
    from,
    to,
    ends: [a, b],
    theme,
    params: P,
    segments: [],
    routes: [],
    junctions: hubs.map((pos, i) => ({ pos, kind: ["fork", "cross", "merge"][i] })),
    length: 0
  }, seg = (kind, curve, route, tramo) => {
    let K = KINDS[kind];
    commit || (curve.arcLengthDivisions = CAND_ARC_DIV);
    let s = {
      idx: commit ? world.segments.length : -1,
      i: way.segments.length,
      way,
      route,
      kind,
      name: K.name,
      emoji: K.emoji,
      curve,
      length: curve.getLength(),
      radius: P.radius,
      air: !!K.air,
      boost: K.boost * TK,
      drag: K.drag,
      // boost en u/s: escala con el trazado
      speedK: K.speedK ?? 1,
      event: K.event ? kind : null,
      risk: K.risk,
      next: [],
      tramo
    };
    return way.segments.push(s), commit && world.segments.push(s), s;
  }, gridDir = (n, target, from2, k) => {
    let t = target.clone().sub(from2);
    return t.addScaledVector(n, -t.dot(n)), n.clone().addScaledVector(t.normalize(), k).normalize();
  }, tilt = [0.12, 0.04, 0.22][salt % 3], gOut = gridDir(nS, hubs[0], S, tilt), gIn = gridDir(nE, hubs[2], E, tilt), launch = seg("salida", shape("salida", S, hubs[0], P, gOut, hubT[0], wrapMid(a, nS, hubs[0])), -1, []), usedInWay = /* @__PURE__ */ new Set(), usedEventMixes = /* @__PURE__ */ new Set(), pickKind = (pool, role, usedInRoute, needEvent = !1, rot = 0) => {
    let cands = pool.filter((k) => !usedInRoute.has(k)), list = cands.length ? cands : pool, best = list[0], bestScore = -1 / 0;
    for (let idx2 = 0; idx2 < list.length; idx2++) {
      let k = list[(idx2 + rot) % list.length], K = KINDS[k], sk = K.speedK ?? 1, sc = (P.fav.includes(k) ? 0.9 : 0) + (usedInWay.has(k) ? -1.8 : 0.8) + rng() * 0.9;
      needEvent && K.event && (sc += 2.2), role === "rapida" ? sc += (sk - 1) * 2.5 + K.risk * 1.1 + (sk < 0.9 ? -2.5 : 0) : role === "lenta" ? sc += (1.15 - sk) * 2.6 + (0.6 - K.risk) * 1.3 + (sk > 1.45 ? -2.5 : 0) : sc += (K.event ? 0.7 : 0.4) + K.risk * 0.7 + (K.air ? 0.5 : 0), sc > bestScore && (bestScore = sc, best = k);
    }
    return usedInRoute.add(best), usedInWay.add(best), best;
  }, heads = [[], []], tails = [[], []], plans = [];
  for (let r = 0; r < P.n; r++) {
    let role = r === 0 ? "rapida" : r === 1 ? "lenta" : "media", usedInRoute = /* @__PURE__ */ new Set(), halves = [];
    for (let h = 0; h < 2; h++) {
      let evPool = h === 0 && (role === "media" || P.fav.includes("cascada")) ? EVENT_ALL : EVENT_FLEX, ev = pickKind(evPool, role, usedInRoute, !0, circuit.idx * 3 + r + h);
      if (KINDS[ev].drop) {
        let f1 = pickKind(FLEX_PLAIN, role, usedInRoute, !1, circuit.idx + r + h), f2 = pickKind(FLEX_PLAIN, role, usedInRoute, !1, circuit.idx * 2 + r + h + 1);
        halves.push([f1, ev, f2]);
      } else {
        let g = pickKind(GRAV_PLAIN, role, usedInRoute, !1, circuit.idx + r + h), f = pickKind(FLEX_PLAIN, role, usedInRoute, !1, circuit.idx * 2 + r + h);
        halves.push(rng() < 0.5 ? [g, ev, f] : [f, ev, g]);
      }
    }
    let mixKey = () => halves.map((t) => t[1]).sort().join(",");
    if (usedEventMixes.has(mixKey())) {
      let alt = EVENT_FLEX.find((k) => !usedInRoute.has(k));
      alt && (KINDS[halves[1][1]].drop && (halves[1][0] = pickKind(GRAV_PLAIN, role, usedInRoute, !1, r)), halves[1][1] = alt, usedInRoute.add(alt), usedInWay.add(alt));
    }
    usedEventMixes.add(mixKey()), plans.push({ role, halves });
  }
  let curves = plans.map(() => []), fixDrop = (Q, A, B, kinds) => {
    let [Q0, Q1] = Q, [k0, k1, k2] = kinds, gIdx = kinds.findIndex((k) => KINDS[k].drop);
    if (gIdx === 0) {
      let drop = Math.max(KINDS[k0].drop, 0.7 * Math.hypot(Q0.x - A.x, Q0.z - A.z));
      Q0.y = Math.min(Q0.y, A.y - drop);
    } else if (gIdx === 1) {
      let drop = Math.max(KINDS[k1].drop, 0.7 * Math.hypot(Q1.x - Q0.x, Q1.z - Q0.z)), midY = (Q0.y + Q1.y) * 0.5;
      Q0.y = Math.max(Q0.y, midY + drop * 0.55), Q1.y = Math.min(Q1.y, Q0.y - drop);
    } else if (gIdx === 2) {
      let drop = Math.max(KINDS[k2].drop, 0.7 * Math.hypot(Q1.x - B.x, Q1.z - B.z));
      Q1.y = Math.max(Q1.y, B.y + drop);
    }
  }, halfPts = [[], []], arcEnd = [[], []], landingCurve = shape("llegada", hubs[2], E, P, hubT[2], gIn.clone().negate(), wrapMid(b, nE, hubs[2])), fixPts = [];
  if (rowSearch && !NO_FIX_PTS) for (let [cv, kind] of [[launch.curve, "salida"], [landingCurve, "llegada"]]) {
    let L0 = 0, q0 = cv.getPoint(0);
    for (let k = 1; k <= 24; k++) {
      let q = cv.getPoint(k / 24);
      L0 += q.distanceTo(q0), q0 = q;
    }
    let n = clamp2(Math.ceil(L0 / (5 * TK * AK)), 8, 200), ps = [], accs = [], acc = 0, prev = null;
    for (let k = 0; k <= n; k++) {
      let p = cv.getPoint(k / n);
      prev && (acc += p.distanceTo(prev)), prev = p, ps.push(p), accs.push(acc);
    }
    let pseudo = { length: acc, kind, radius: P.radius };
    for (let k = 0; k <= n; k++) {
      let p = ps[k];
      fixPts.push({ p, fix: !0, route: -1, hubD: Math.min(p.distanceTo(hubs[0]), p.distanceTo(hubs[1]), p.distanceTo(hubs[2])), ext: routeExtent(pseudo, accs[k] / acc), tube: P.radius });
    }
  }
  let sampleHalf = (h) => {
    let out = [];
    plans.forEach(({ halves }, r) => curves[r][h].forEach((cv, m) => {
      let L0 = 0, q0 = cv.getPoint(0);
      for (let k = 1; k <= 24; k++) {
        let q = cv.getPoint(k / 24);
        L0 += q.distanceTo(q0), q0 = q;
      }
      let n = clamp2(Math.ceil(L0 / (5 * TK * AK)), 8, 200), ps = [], accs = [], acc = 0, prev = null;
      for (let k = 0; k <= n; k++) {
        let p = cv.getPoint(k / n);
        prev && (acc += p.distanceTo(prev)), prev = p, ps.push(p), accs.push(acc);
      }
      let pseudo = { length: acc, kind: halves[h][m], radius: P.radius }, g0 = m ? arcEnd[h][r] : h && arcEnd[0][r] || 0;
      for (let k = 0; k <= n; k++) {
        let p = ps[k], hubD = Math.min(p.distanceTo(hubs[0]), p.distanceTo(hubs[1]), p.distanceTo(hubs[2]));
        out.push({ p, h, m, g: g0 + accs[k], route: r, hubD, ext: routeExtent(pseudo, accs[k] / acc), tube: P.radius });
      }
      arcEnd[h][r] = g0 + acc;
    })), halfPts[h] = out;
  }, perms = PERMS[P.n];
  for (let h = 0; h < 2; h++) {
    if (!rowSearch) {
      buildHalf(h, SPREAD_STEPS[0], perms[0]);
      continue;
    }
    let best = null, last = null;
    search: for (let mul of SPREAD_STEPS) for (let perm of perms) {
      buildHalf(h, mul, perm), sampleHalf(h), last = { mul, perm };
      let rs = routeSlack(h ? halfPts[0].concat(halfPts[1], fixPts) : halfPts[0].concat(fixPts), h);
      if (rs >= ROUTE_MARGIN) {
        best = null;
        break search;
      }
      commit && rej("fila_rutas:intento_con_roce"), (!best || rs > best.rs) && (best = { mul, perm, rs });
    }
    best && commit && rej("fila_rutas:SIN_HUECO(mejor " + Math.round(best.rs) + ")"), best && (best.mul !== last.mul || best.perm !== last.perm) && (buildHalf(h, best.mul, best.perm), sampleHalf(h));
  }
  function buildHalf(h, mul, perm) {
    let spread = P.spread * SPREAD_K * mul, A = hubs[h], B = hubs[h + 1], chord = B.clone().sub(A), side = new Vector3().crossVectors(Y, chord);
    side.length() < 0.05 * chord.length() && side.copy(n1), side.normalize();
    let Qs = plans.map(({ halves }, r) => {
      let [k0, k1, k2] = halves[h], w0 = KINDS[k0].w, w1 = KINDS[k1].w, w2 = KINDS[k2].w, wSum = w0 + w1 + w2, f0 = Math.min(clamp2(w0 / wSum, 0.24, 0.38), FAN_D / chord.length()), f1 = Math.max(clamp2((w0 + w1) / wSum, 0.62, 0.78), 1 - FAN_D / chord.length()), off = (perm[r] - (P.n - 1) / 2) * spread;
      return [at(A, chord, f0, side, off), at(A, chord, f1, side, off)];
    });
    plans.forEach(({ halves }, r) => fixDrop(Qs[r], A, B, halves[h])), plans.forEach(({ role, halves }, r) => {
      let kinds = halves[h], [Q0, Q1] = Qs[r];
      for (let Q of [Q0, Q1]) Q.length() < SPHERE_R * 0.53 && Q.setLength(SPHERE_R * 0.53);
      let Tbase = [Q1.clone().sub(A).normalize(), B.clone().sub(Q0).normalize()], fk = perm[r] - (P.n - 1) / 2, fanT = (T, k) => {
        if (!k) return T;
        let s = side.clone().addScaledVector(T, -side.dot(T));
        if (s.lengthSq() < 1e-6) return T;
        s.normalize();
        let a2 = k * FAN_ANG * AK;
        return T.clone().multiplyScalar(Math.cos(a2)).addScaledVector(s, Math.sin(a2)).normalize();
      }, pts = [A, Q0, Q1, B], cs = [null, null, null];
      for (let pass = 0; pass < 3; pass++)
        for (let m = 0; m < 3; m++) {
          if (cs[m]) continue;
          let needPrev = m > 0 && !ownsStart(kinds[m]) && KINDS[kinds[m - 1]].air, needNext = m < 2 && ownsStart(kinds[m + 1]);
          if (needPrev && !cs[m - 1] || needNext && !cs[m + 1]) continue;
          let Ta = m === 0 ? fanT(hubT[h], fk) : ownsStart(kinds[m]) ? null : KINDS[kinds[m - 1]].air ? cs[m - 1].getTangent(1) : Tbase[m - 1], Tb = m === 2 ? fanT(hubT[h + 1], -fk) : ownsStart(kinds[m + 1]) ? cs[m + 1].getTangent(0) : Tbase[m], trk = { role, rng: mulberry32(7700 + salt * 1009 + circuit.idx * 97 + (from < to ? 0 : 53) + r * 11 + h * 5 + m) };
          cs[m] = shape(kinds[m], pts[m], pts[m + 1], P, Ta, Tb, null, trk);
        }
      curves[r][h] = cs;
    });
  }
  plans.forEach(({ role, halves }, r) => {
    let own = [];
    for (let h = 0; h < 2; h++) {
      let kinds = halves[h], cs = curves[r][h], [k0, k1, k2] = kinds, s0 = seg(k0, cs[0], r, kinds), s1 = seg(k1, cs[1], r, kinds), s2 = seg(k2, cs[2], r, kinds);
      s0.hubA = !0, s2.hubB = !0, s0.next = [s1.i], s1.next = [s2.i], heads[h].push(s0), tails[h].push(s2), own.push(s0, s1, s2);
    }
    let avgSpeedK = own.reduce((sum, s) => sum + s.speedK, 0) / own.length, avgRisk = own.reduce((sum, s) => sum + s.risk, 0) / own.length, hasAir = own.some((s) => s.air), thrill = clamp2(Number((avgRisk * 0.65 + (hasAir ? 0.18 : 0) + Math.max(0, avgSpeedK - 1) * 0.3).toFixed(2)), 0, 1), speed = role === "rapida" ? "rapida" : role === "lenta" ? "lenta" : avgSpeedK >= 1.18 ? "rapida" : avgSpeedK <= 0.96 ? "lenta" : "media", label = speed === "rapida" ? thrill >= 0.55 ? "Veloz y arriesgada" : "R\xE1pida" : speed === "lenta" ? thrill <= 0.42 ? "Lenta y segura" : "Tranquila" : thrill >= 0.45 ? "Espectacular" : "Equilibrada";
    way.routes.push({
      idx: world.routes.length + r,
      r,
      name: "ABC"[r],
      way,
      segments: own,
      kinds: own.map((s) => s.kind),
      length: 0,
      profile: { speed, thrill, label }
    });
  }), launch.hubB = !0;
  let landing = seg("llegada", landingCurve, -1, []);
  landing.hubA = !0, launch.next = heads[0].map((s) => s.i), tails[0].forEach((s) => {
    s.next = heads[1].map((x) => x.i);
  }), tails[1].forEach((s) => {
    s.next = [landing.i];
  });
  for (let rt of way.routes)
    rt.segments = [launch, ...rt.segments, landing], rt.length = rt.segments.reduce((sum, s) => sum + s.length, 0), commit && world.routes.push(rt);
  if (way.length = way.routes.reduce((sum, rt) => sum + rt.length, 0) / way.routes.length, commit) {
    sampleChain([launch], !0);
    for (let rt of way.routes) {
      let own = rt.segments.slice(1, -1);
      sampleChain(own.slice(0, 3), !0), sampleChain(own.slice(3, 6), !0);
    }
    sampleChain([landing], !1), abanicoDeRutas(way), buildLanes(way), pOut.wayOut = way, pIn.wayIn = way;
    let tOut = a.terminals.find((t) => t.kind === "out" && t.to === to), tIn = b.terminals.find((t) => t.kind === "in" && t.to === from);
    way.gates = { out: OUT_GATES[(way.idx + from) % OUT_GATES.length], in: IN_GATES[(way.idx * 2 + to) % IN_GATES.length] }, launch.gate = way.gates.out, landing.gate = way.gates.in, tOut && Object.assign(tOut, { way, gate: way.gates.out, approach: { kind: "parrilla", len: GRID_LEN, dir: gOut } }), tIn && Object.assign(tIn, { way, gate: way.gates.in, approach: { kind: "recta_meta", len: FINISH_LEN, dir: gIn } }), world.ways.push(way), world.waysFrom[from].push(way);
  }
  return way;
}
var FAN_STEP = 3 * TK, FAN_NEED = 2 * RIBBON_HALF + 2 * RIBBON_HALF + 2.5 * TK + FAN_STEP / 2, FAN_RAMPS = [1, 1.5, 2], FAN_MIN = 0.8;
function abanicoDeRutas(way) {
  if (globalThis.process?.env?.NO_FAN) return;
  let segs = way.segments.filter((s) => s.route >= 0 && !s.air), P = new Vector3(), sam = segs.map((s) => {
    let n = Math.max(4, Math.ceil(s.length / FAN_STEP)), xs = new Float64Array((n + 1) * 3);
    for (let i = 0; i <= n; i++)
      s.curve.getPointAt(i / n, P), xs[i * 3] = P.x, xs[i * 3 + 1] = P.y, xs[i * 3 + 2] = P.z;
    let cx = 0, cy = 0, cz = 0;
    for (let i = 0; i <= n; i++)
      cx += xs[i * 3], cy += xs[i * 3 + 1], cz += xs[i * 3 + 2];
    cx /= n + 1, cy /= n + 1, cz /= n + 1;
    let r = 0;
    for (let i = 0; i <= n; i++) r = Math.max(r, Math.hypot(xs[i * 3] - cx, xs[i * 3 + 1] - cy, xs[i * 3 + 2] - cz));
    return { s, n, xs, cx, cy, cz, r };
  }), FULL = FAN_NEED + 2 * BRAID_A;
  for (let A of sam) {
    let { s, n, xs } = A, cap = new Float32Array(n + 1).fill(1);
    for (let B of sam)
      if (B.s.route !== s.route && !(Math.hypot(A.cx - B.cx, A.cy - B.cy, A.cz - B.cz) > A.r + B.r + FULL))
        for (let i = 0; i <= n; i++) {
          let x = xs[i * 3], y = xs[i * 3 + 1], z = xs[i * 3 + 2], d2 = 1 / 0;
          for (let j = 0; j <= B.n; j++) {
            let e = (x - B.xs[j * 3]) ** 2 + (y - B.xs[j * 3 + 1]) ** 2 + (z - B.xs[j * 3 + 2]) ** 2;
            e < d2 && (d2 = e);
          }
          let c = (Math.sqrt(d2) - FAN_NEED) / (2 * BRAID_A);
          c < cap[i] && (cap[i] = Math.max(0, c));
        }
    let libre = !0;
    for (let i = 0; i <= n; i++) if (cap[i] < 1) {
      libre = !1;
      break;
    }
    if (libre) continue;
    let L = s.length, dx = L / n, [a0, b0] = braidDelay(s), [r0a, r0b] = braidRamps(s), fit = (e, a02, r0) => {
      let h = Math.floor(n / 2), best = null;
      for (let k of FAN_RAMPS) {
        let r = r0 * k;
        for (let a = a02; a <= L / 2 && !(best && a + r / 2 >= best.a + best.r / 2); a += FAN_STEP) {
          let ok = !0;
          for (let i = 0; i <= h; i++) {
            let q = e ? n - i : i;
            if (cap[q] < 1 && smooth01((i * dx - a) / r) > cap[q] + 0.01) {
              ok = !1;
              break;
            }
          }
          if (ok) {
            best = { a, r };
            break;
          }
        }
      }
      return best || { a: L, r: r0 };
    }, fa = fit(0, a0, r0a), fb = fit(1, b0, r0b);
    if (fa.a + fa.r + fb.a + fb.r > L) {
      let pico = 0;
      for (let i = 0; i <= n; i++) pico = Math.max(pico, smooth01((i * dx - fa.a) / fa.r) * smooth01((L - fb.a - i * dx) / fb.r));
      pico < FAN_MIN && (fa.a = L, fb.a = L);
    }
    (fa.a > a0 || fa.r > r0a || fb.a > b0 || fb.r > r0b) && (s.fan = { a: fa.a, ra: fa.r, b: fb.a, rb: fb.r });
  }
}
var VISUAL_PAD = Math.max(0, (LANE_W / 2 + RIBBON_CURB + RIBBON_TERR * 0.55) * 2.15 - RIBBON_HALF), RIB_STEP = 1.5 * TK, RIB_SELF = 12 * TK, JOINT_SEP = RIBBON_CLEAR + 0.4 * TK, JOINT_MAX = 25 * TK;
function ribbonEndKey(world, x, y, z) {
  for (let n of world.nodes) if ((x - n.pos.x) ** 2 + (y - n.pos.y) ** 2 + (z - n.pos.z) ** 2 < (NODE_R + TK) ** 2) return "n" + n.idx;
  let q = 20 / TK;
  return `${Math.round(x * q)},${Math.round(y * q)},${Math.round(z * q)}`;
}
var ribbonsOf = (world) => world.ways.flatMap((way) => way.segments.filter((s) => !s.air && s.lanes).flatMap((seg) => seg.lanes.map((l) => [way, seg, l.id])));
function ribMeta(r) {
  let k = r.n / r.seg.length, [a, b] = braidDelay(r.seg);
  return r.closed = [Math.floor(a * k), Math.floor(b * k)], r.capI = [JOINT_MAX / r.ds, JOINT_MAX / r.ds], r;
}
function packRibbons(ribs, xs, rs) {
  let N = rs.length, X2 = new Float64Array(N), Yy = new Float64Array(N), Z = new Float64Array(N);
  for (let i = 0; i < N; i++)
    X2[i] = xs[i * 3], Yy[i] = xs[i * 3 + 1], Z[i] = xs[i * 3 + 2];
  return { ribs, X: X2, Y: Yy, Z, R: Int32Array.from(rs) };
}
function braidRibbons(world) {
  let ribs = [], xs = [], rs = [], W = {};
  for (let [way, seg, id] of ribbonsOf(world)) {
    let br = seg._braid, N = br.N, P = br.P[id], O = new Float32Array((N + 1) * 3), r = { idx: ribs.length, way, seg, lane: id, start: rs.length, n: N, ds: laneLength(seg, id) / N, ends: [], P, O };
    for (let i = 0; i <= N; i++) {
      let u = i / N, d = wallFrame(seg, laneAngle(seg, id, u), u, 0, W).dir, h = -laneRelief(seg, id, u);
      O[i * 3] = d.x * h, O[i * 3 + 1] = d.y * h, O[i * 3 + 2] = d.z * h;
      let x = P[i * 3] + O[i * 3], y = P[i * 3 + 1] + O[i * 3 + 1], z = P[i * 3 + 2] + O[i * 3 + 2];
      xs.push(x, y, z), rs.push(r.idx), (i === 0 || i === N) && r.ends.push(ribbonEndKey(world, x, y, z));
    }
    ribs.push(ribMeta(r));
  }
  return packRibbons(ribs, xs, rs);
}
function testPair(S, i, j, L2, out) {
  let { ribs, X: X2, Y: Yy, Z, R } = S, ri2 = R[i], rj = R[j], A = ribs[ri2], B = ribs[rj];
  if (ri2 === rj && (j - i) * A.ds < RIB_SELF || A.seg === B.seg && (i - A.start < A.closed[0] && j - B.start < B.closed[0] || A.start + A.n - i < A.closed[1] && B.start + B.n - j < B.closed[1])) return;
  let d2 = (X2[i] - X2[j]) ** 2 + (Yy[i] - Yy[j]) ** 2 + (Z[i] - Z[j]) ** 2;
  if (d2 >= L2) return;
  let key = ri2 * 65536 + rj, l = out.get(key);
  l || out.set(key, l = []), l.push(i, j, Math.sqrt(d2));
}
function sampleGrid(S, lim, keep, ids = null) {
  let { X: X2, Y: Yy, Z } = S, N = ids ? ids.length : X2.length, inv = 1 / lim, size = 1024;
  for (; size < N; ) size <<= 1;
  size <<= 1;
  let mask = size - 1, tab = new Int32Array(size).fill(-1), of = new Int32Array(N), cx = new Int32Array(1024), cy = new Int32Array(1024), cz = new Int32Array(1024), cnt = new Int32Array(1024), n = 0, lx = 0, ly = 0, lz = 0, lc = -1;
  for (let q = 0; q < N; q++) {
    let i = ids ? ids[q] : q;
    if (keep && !keep(i)) {
      of[q] = -1;
      continue;
    }
    let x = Math.floor(X2[i] * inv), y = Math.floor(Yy[i] * inv), z = Math.floor(Z[i] * inv);
    if (lc >= 0 && x === lx && y === ly && z === lz) {
      of[q] = lc, cnt[lc]++;
      continue;
    }
    let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & mask, c;
    for (; ; ) {
      if (c = tab[h], c < 0) {
        if (n === cx.length) {
          let g = (a) => {
            let b = new Int32Array(n * 2);
            return b.set(a), b;
          };
          cx = g(cx), cy = g(cy), cz = g(cz), cnt = g(cnt);
        }
        c = n++, tab[h] = c, cx[c] = x, cy[c] = y, cz[c] = z;
        break;
      }
      if (cx[c] === x && cy[c] === y && cz[c] === z) break;
      h = h + 1 & mask;
    }
    of[q] = c, cnt[c]++, lx = x, ly = y, lz = z, lc = c;
  }
  let off = new Int32Array(n + 1);
  for (let c = 0; c < n; c++) off[c + 1] = off[c] + cnt[c];
  let items = new Int32Array(off[n]), fill = off.slice(0, n);
  for (let q = 0; q < N; q++) {
    let c = of[q];
    c >= 0 && (items[fill[c]++] = ids ? ids[q] : q);
  }
  return { lim, inv, n, off, items, cx, cy, cz, find: (x, y, z) => {
    let h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663) ^ Math.imul(z, 83492791)) & mask;
    for (; ; ) {
      let c = tab[h];
      if (c < 0) return -1;
      if (cx[c] === x && cy[c] === y && cz[c] === z) return c;
      h = h + 1 & mask;
    }
  } };
}
function nearCells(S, grid, i, fn) {
  let { inv, off, items } = grid, x = Math.floor(S.X[i] * inv), y = Math.floor(S.Y[i] * inv), z = Math.floor(S.Z[i] * inv);
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
    let c = grid.find(x + dx, y + dy, z + dz);
    if (!(c < 0))
      for (let q = off[c], e = off[c + 1]; q < e; q++) fn(items[q]);
  }
}
var FWD_CELLS = (() => {
  let o = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) (dx > 0 || dx === 0 && (dy > 0 || dy === 0 && dz > 0)) && o.push(dx, dy, dz);
  return o;
})();
function gatherPairs(S, lim, grid = null) {
  let sh = S.shadow, out = /* @__PURE__ */ new Map(), L2 = lim * lim, { ribs, X: X2, Y: Yy, Z, R } = S;
  grid ||= sampleGrid(S, lim, sh ? (i) => !sh[i] : null);
  let { off, items } = grid, par = (a, b) => {
    let d2 = (X2[a] - X2[b]) ** 2 + (Yy[a] - Yy[b]) ** 2 + (Z[a] - Z[b]) ** 2;
    if (d2 >= L2) return;
    let i = a < b ? a : b, j = a < b ? b : a, ri2 = R[i], rj = R[j], A = ribs[ri2], B = ribs[rj];
    if (ri2 === rj && (j - i) * A.ds < RIB_SELF || A.seg === B.seg && (i - A.start < A.closed[0] && j - B.start < B.closed[0] || A.start + A.n - i < A.closed[1] && B.start + B.n - j < B.closed[1])) return;
    let key = ri2 * 65536 + rj, l = out.get(key);
    l || out.set(key, l = []), l.push(i, j, Math.sqrt(d2));
  };
  for (let c = 0; c < grid.n; c++) {
    let b0 = off[c], b1 = off[c + 1];
    for (let p = b0; p < b1; p++) {
      let i = items[p];
      for (let q = p + 1; q < b1; q++) par(i, items[q]);
    }
    for (let f = 0; f < 39; f += 3) {
      let d = grid.find(grid.cx[c] + FWD_CELLS[f], grid.cy[c] + FWD_CELLS[f + 1], grid.cz[c] + FWD_CELLS[f + 2]);
      if (d < 0) continue;
      let d0 = off[d], d1 = off[d + 1];
      for (let p = b0; p < b1; p++) {
        let i = items[p];
        for (let q = d0; q < d1; q++) par(i, items[q]);
      }
    }
  }
  return out;
}
function judgePairs(S, pairs, hitD) {
  let { ribs, R } = S, hits = [], slack = 1 / 0, joint = 0, jointBy = { nodo: 0, union: 0, carril: 0 }, pre = (set, r, e, ss) => {
    let c0 = ss ? r.closed[e] : 0, c = c0;
    for (; c <= r.n && c < r.capI[e] + c0 && set.has(e ? r.n - c : c); ) c++;
    return c;
  };
  for (let l of pairs.values()) {
    let A = ribs[R[l[0]]], B = ribs[R[l[1]]], zones = null;
    if (A !== B) {
      for (let ea = 0; ea < 2; ea++) for (let eb = 0; eb < 2; eb++) A.ends[ea] === B.ends[eb] && (zones ||= []).push([ea, eb, A.seg === B.seg]);
      if (zones) {
        let inA = /* @__PURE__ */ new Set(), inB = /* @__PURE__ */ new Set();
        for (let k = 0; k < l.length; k += 3) l[k + 2] < JOINT_SEP && (inA.add(l[k] - A.start), inB.add(l[k + 1] - B.start));
        zones = zones.map(([ea, eb, ss]) => [ea, pre(inA, A, ea, ss), eb, pre(inB, B, eb, ss), ss]);
      }
    }
    for (let k = 0; k < l.length; k += 3) {
      let ia = l[k] - A.start, ib = l[k + 1] - B.start, d = l[k + 2], z = zones && zones.find(([ea, ca, eb, cb]) => (ea ? A.n - ia : ia) < ca && (eb ? B.n - ib : ib) < cb);
      if (z) {
        if (d < hitD) {
          let ja = Math.max(((z[0] ? A.n - ia : ia) - (z[4] ? A.closed[z[0]] : 0)) * A.ds, ((z[2] ? B.n - ib : ib) - (z[4] ? B.closed[z[2]] : 0)) * B.ds);
          joint = Math.max(joint, ja);
          let t = A.ends[z[0]][0] === "n" ? "nodo" : A.seg === B.seg ? "carril" : "union";
          ja > jointBy[t] && (jointBy[t] = ja);
        }
        continue;
      }
      slack = Math.min(slack, d - RIBBON_CLEAR), d < hitD && hits.push(l[k], l[k + 1], d);
    }
  }
  return { hits, slack, joint, jointBy };
}
var GALIBO_H = 6 * TK, AIRE_LAT = 2 * RIBBON_HALF, CALZADA_HALF = LANE_W / 2 + RIBBON_CURB, QUILLA = 0.75;
var FUNDIDA_Y = 0.75 * TK, CLR_STEP = 1 * TK, CLR_LIM = GALIBO_H + 2 * RIBBON_HALF + QUILLA + 2 * CLR_STEP;
var PRISMA_PAD = 3 * TK;
var PRISMA_ALCANCE = 15 * TK;
var BERMA_CELL = 6 * TK;
var RELAX_IT = 60, RELAX_MARGIN = JOINT_SEP - RIBBON_CLEAR, RELAX_DONE = 0.3 * TK, RELAX_PIN = 12 * TK, RELAX_SPRING = 4e-3, RELAX_SIG = 6, RELAX_K = 18, RELAX_PUSH = 3.5, RELAX_EPS = 0.03 * TK;
function relaxRibbons(world) {
  let t0 = performance.now(), S = braidRibbons(world), { ribs, X: X2, Y: Yy, Z, R } = S, N = X2.length, TT = { braid: performance.now() - t0, pre: 0, g0: 0, carry: 0, movgrid: 0, gather: 0, judge: 0, force: 0, push: 0 }, tq = performance.now(), lap = (k) => {
    let n = performance.now();
    TT[k] += n - tq, tq = n;
  }, segs = /* @__PURE__ */ new Map(), shadow = S.shadow = new Uint8Array(N);
  for (let r of ribs) {
    let g = segs.get(r.seg);
    if (!g)
      segs.set(r.seg, g = { ribs: [], n: r.n, ds: r.seg.length / r.n, D: new Float32Array((r.n + 1) * 3), F: new Float32Array((r.n + 1) * 3), c: new Uint16Array(r.n + 1), on: !1 });
    else for (let i = 0; i <= r.n; i++) (i < r.closed[0] || r.n - i < r.closed[1]) && (shadow[r.start + i] = 1);
    g.ribs.push(r), r.g = g;
  }
  let D = new Float32Array(N * 3), F = new Float32Array(N * 3), cnt = new Uint16Array(N), pinOf = (i, n, ds) => smooth01(Math.min(i, n - i) * ds / RELAX_PIN), G = Array.from({ length: RELAX_K + 1 }, (_, d) => Math.exp(-(d * d) / (2 * RELAX_SIG * RELAX_SIG))), push = (A, Fv, c, fo, o, n, ds) => {
    for (let j = 0; j <= n; j++) {
      let sx = 0, sy = 0, sz = 0, sw = 0;
      for (let i = Math.max(0, j - RELAX_K); i <= Math.min(n, j + RELAX_K); i++) {
        let q = fo + i;
        if (!c[q]) continue;
        let w = G[Math.abs(i - j)] / c[q];
        sw += G[Math.abs(i - j)], sx += w * Fv[q * 3], sy += w * Fv[q * 3 + 1], sz += w * Fv[q * 3 + 2];
      }
      let k = sw > 0 ? Math.min(1, sw) / sw : 0, t = (o + j) * 3, pw = pinOf(j, n, ds) * (1 - RELAX_SPRING);
      A[t] = (A[t] + sx * k) * pw, A[t + 1] = (A[t + 1] + sy * k) * pw, A[t + 2] = (A[t + 2] + sz * k) * pw;
    }
  }, hitD = RIBBON_CLEAR + RELAX_MARGIN, L2 = hitD * hitD, act = new Uint8Array(ribs.length), live = /* @__PURE__ */ new Set(), still = sampleGrid(S, hitD, (i) => !shadow[i]), moved = new Uint8Array(N), dirty = new Uint8Array(N), prev = null, LX = Float64Array.from(X2), LY = Float64Array.from(Yy), LZ = Float64Array.from(Z), E2 = RELAX_EPS * RELAX_EPS, liveIds = [], wake = (g) => {
    g.on = !0, live.add(g);
    for (let x of g.ribs) {
      act[x.idx] = 1;
      for (let i = 0; i <= x.n; i++) shadow[x.start + i] || liveIds.push(x.start + i);
    }
  }, it = 0, left = 0;
  for (; it < RELAX_IT; it++) {
    let pairs;
    if (!it)
      lap("pre"), pairs = gatherPairs(S, hitD, still), lap("g0");
    else {
      pairs = /* @__PURE__ */ new Map();
      for (let [k, l] of prev) {
        let a = null;
        for (let q = 0; q < l.length; q += 3) {
          let i = l[q], j = l[q + 1];
          if (dirty[i] || dirty[j]) continue;
          let d = l[q + 2];
          if (moved[i] || moved[j]) {
            let d2 = (X2[i] - X2[j]) ** 2 + (Yy[i] - Yy[j]) ** 2 + (Z[i] - Z[j]) ** 2;
            if (d2 >= L2) continue;
            d = Math.sqrt(d2);
          }
          (a ||= []).push(i, j, d);
        }
        a && pairs.set(k, a);
      }
      lap("carry");
      let mov = sampleGrid(S, hitD, (i) => moved[i], liveIds);
      lap("movgrid");
      for (let q = 0; q < mov.items.length; q++) {
        let i = mov.items[q];
        dirty[i] && (nearCells(S, mov, i, (j) => {
          (j > i || !dirty[j]) && testPair(S, Math.min(i, j), Math.max(i, j), L2, pairs);
        }), nearCells(S, still, i, (j) => {
          moved[j] || testPair(S, Math.min(i, j), Math.max(i, j), L2, pairs);
        }));
      }
    }
    prev = pairs, lap("gather");
    let { hits } = judgePairs(S, pairs, hitD);
    lap("judge"), left = hits.length / 3, globalThis.__RELAX_DBG && globalThis.__RELAX_DBG.push({ it, left, hits: hits.slice(0, 3e3), t: performance.now() - t0, S });
    let deep = 0;
    for (let q = 2; q < hits.length; q += 3) hits[q] < RIBBON_CLEAR + RELAX_DONE && deep++;
    if (!deep || globalThis.process?.env?.NO_RELAX) break;
    F.fill(0), cnt.fill(0);
    for (let g of live)
      g.F.fill(0), g.c.fill(0);
    for (let q = 0; q < hits.length; q += 3) {
      let a = hits[q], b = hits[q + 1], d = hits[q + 2], m = (hitD - d) * RELAX_PUSH, A = ribs[R[a]], B = ribs[R[b]], nx = X2[a] - X2[b], ny = Yy[a] - Yy[b], nz = Z[a] - Z[b];
      if (d > 1e-3)
        nx /= d, ny /= d, nz /= d;
      else {
        let o = (a - A.start) * 3;
        nx = A.O[o], ny = A.O[o + 1], nz = A.O[o + 2];
        let l = Math.hypot(nx, ny, nz);
        l > 1e-6 ? (nx /= l, ny /= l, nz /= l) : (nx = 0, ny = 1, nz = 0);
      }
      for (let [r, s, sg, o] of [[A, a, 1, b], [B, b, -1, a]])
        if (A.seg !== B.seg) {
          let g = r.g, i = s - r.start, c = g.ribs[0].start + i, ex = X2[c] - X2[o], ey = Yy[c] - Yy[o], ez = Z[c] - Z[o], el = Math.hypot(ex, ey, ez);
          el > 0.3 * TK ? (ex /= el, ey /= el, ez /= el) : (ex = sg * nx, ey = sg * ny, ez = sg * nz), g.F[i * 3] += ex * m, g.F[i * 3 + 1] += ey * m, g.F[i * 3 + 2] += ez * m, g.c[i]++, g.on || wake(g);
        } else
          F[s * 3] += sg * nx * m, F[s * 3 + 1] += sg * ny * m, F[s * 3 + 2] += sg * nz * m, cnt[s]++, r.g.on || wake(r.g);
    }
    lap("force");
    for (let g of live) {
      push(g.D, g.F, g.c, 0, 0, g.n, g.ds);
      let rep = g.ribs[0];
      for (let r of g.ribs) {
        let s0 = r.start;
        push(D, F, cnt, s0, s0, r.n, g.ds);
        for (let i = 0; i <= r.n; i++) {
          let s = s0 + i, o = i * 3;
          if (shadow[s]) {
            let t = rep.start + i;
            D[s * 3] = D[t * 3], D[s * 3 + 1] = D[t * 3 + 1], D[s * 3 + 2] = D[t * 3 + 2];
          }
          X2[s] = r.P[o] + r.O[o] + g.D[o] + D[s * 3], Yy[s] = r.P[o + 1] + r.O[o + 1] + g.D[o + 1] + D[s * 3 + 1], Z[s] = r.P[o + 2] + r.O[o + 2] + g.D[o + 2] + D[s * 3 + 2], !moved[s] && Math.abs(g.D[o]) + Math.abs(g.D[o + 1]) + Math.abs(g.D[o + 2]) + Math.abs(D[s * 3]) + Math.abs(D[s * 3 + 1]) + Math.abs(D[s * 3 + 2]) > 1e-3 && (moved[s] = 1), dirty[s] = 0, moved[s] && (X2[s] - LX[s]) ** 2 + (Yy[s] - LY[s]) ** 2 + (Z[s] - LZ[s]) ** 2 > E2 && (dirty[s] = 1, LX[s] = X2[s], LY[s] = Yy[s], LZ[s] = Z[s]);
        }
      }
    }
    lap("push");
  }
  for (let g of live) {
    for (let r of g.ribs) for (let i = 0; i <= r.n; i++) for (let k = 0; k < 3; k++) r.P[i * 3 + k] += g.D[i * 3 + k] + D[(r.start + i) * 3 + k];
    let seg = g.ribs[0].seg;
    seg._braid.len = [], seg._braid.curves = [];
    for (let sw of seg.switches || []) delete sw._arc;
  }
  return world.relax = { it, left, segs: live.size, ms: Math.round(performance.now() - t0) }, world.relaxT = Object.fromEntries(Object.entries(TT).map(([k, v]) => [k, Math.round(v)])), world.relaxT.N = N, world.relaxT.pares = [...prev.values()].reduce((a, l) => a + l.length / 3, 0), world.relaxT.listas = prev.size, S;
}
var COL_CELL = 4 * TK, COL_FAR = 24 * TK;
function indexarColisiones(world, S = braidRibbons(world)) {
  let { ribs, X: X2, Y: Yy, Z, R } = S, tubes = [], tx = [], P = new Vector3();
  for (let way of world.ways) for (let seg of way.segments) {
    if (seg.air) continue;
    let n = Math.max(4, Math.ceil(seg.length / RIB_STEP)), t = { way, seg, start: tx.length / 3, n };
    for (let i = 0; i <= n; i++)
      seg.curve.getPointAt(i / n, P), tx.push(P.x, P.y, P.z);
    tubes.push(t);
  }
  let cell = (v) => Math.floor(v / COL_CELL), grid = /* @__PURE__ */ new Map(), tgrid = /* @__PURE__ */ new Map(), add = (g, x, y, z, i) => {
    let k = cellKey(cell(x), cell(y), cell(z)), b = g.get(k);
    b || g.set(k, b = []), b.push(i);
  };
  for (let i = 0; i < R.length; i++) add(grid, X2[i], Yy[i], Z[i], i);
  let tR = new Int32Array(tx.length / 3);
  tubes.forEach((t, ti) => {
    for (let i = 0; i <= t.n; i++)
      tR[t.start + i] = ti, add(tgrid, tx[(t.start + i) * 3], tx[(t.start + i) * 3 + 1], tx[(t.start + i) * 3 + 2], t.start + i);
  });
  let same = (a, b) => b == null || a === b || a?.idx === b, near = (o, ig) => same(o.way, ig.way) && Math.abs(o.way.segments.indexOf(o.seg) - ig.si) <= 1, skip = (o, ig) => ig && (ig.si != null ? ig.lane != null && o.lane === ig.lane && near(o, ig) : (ig.way != null || ig.seg != null || ig.lane != null) && same(o.way, ig.way) && same(o.seg, ig.seg) && (ig.lane == null || o.lane === ig.lane)), segDist = (px2, py2, pz2, A, i, last) => {
    let ax = A(i, 0), ay = A(i, 1), az = A(i, 2);
    if (last) return Math.hypot(px2 - ax, py2 - ay, pz2 - az);
    let bx = A(i + 1, 0) - ax, by = A(i + 1, 1) - ay, bz = A(i + 1, 2) - az, l2 = bx * bx + by * by + bz * bz, t = l2 > 0 ? clamp2(((px2 - ax) * bx + (py2 - ay) * by + (pz2 - az) * bz) / l2, 0, 1) : 0;
    return Math.hypot(px2 - ax - bx * t, py2 - ay - by * t, pz2 - az - bz * t);
  }, RA = (i, k) => k === 0 ? X2[i] : k === 1 ? Yy[i] : Z[i], TA = (i, k) => tx[i * 3 + k], ribLast = (i) => i === ribs[R[i]].start + ribs[R[i]].n, visitRing = (g, p, ring, fn) => {
    let x = cell(p.x), y = cell(p.y), z = cell(p.z);
    for (let dx = -ring; dx <= ring; dx++) for (let dy = -ring; dy <= ring; dy++) for (let dz = -ring; dz <= ring; dz++) {
      if (Math.max(Math.abs(dx), Math.abs(dy), Math.abs(dz)) !== ring) continue;
      let b = g.get(cellKey(x + dx, y + dy, z + dz));
      if (b) for (let i of b) fn(i);
    }
  }, maxTube = Math.max(0, ...world.ways.map((w) => w.params.radius));
  function libre(p, r = 0, ignora = null) {
    let lim = r + RIBBON_HALF, rings = Math.ceil((lim + RIB_STEP) / COL_CELL);
    for (let g = 0; g <= rings; g++) {
      let hit = !1;
      if (visitRing(grid, p, g, (i) => {
        if (hit) return;
        let rb = ribs[R[i]];
        skip(rb, ignora) || (segDist(p.x, p.y, p.z, RA, i, ribLast(i)) < lim || i > rb.start && segDist(p.x, p.y, p.z, RA, i - 1, !1) < lim) && (hit = !0);
      }), hit) return !1;
    }
    let tr = Math.ceil((r + maxTube + RIB_STEP) / COL_CELL);
    for (let g = 0; g <= tr; g++) {
      let hit = !1;
      if (visitRing(tgrid, p, g, (i) => {
        if (hit) return;
        let t = tubes[tR[i]];
        if (ignora && (ignora.si != null ? near(t, ignora) : same(t.way, ignora.way) && same(t.seg, ignora.seg) && (ignora.way != null || ignora.seg != null))) return;
        let last = i === t.start + t.n;
        segDist(p.x, p.y, p.z, TA, i, last) < r + t.seg.radius && (hit = !0);
      }), hit) return !1;
    }
    return !0;
  }
  function cercano(p) {
    let best = null;
    for (let g = 0; g * COL_CELL <= COL_FAR && !(best && (g - 1) * COL_CELL > best.d + RIB_STEP); g++)
      visitRing(grid, p, g, (i) => {
        let d = segDist(p.x, p.y, p.z, RA, i, ribLast(i));
        if (!best || d < best.d) {
          let rb = ribs[R[i]];
          best = { d, way: rb.way, seg: rb.seg, lane: rb.lane };
        }
      });
    return best && best.d <= COL_FAR ? best : null;
  }
  return world.colision = { libre, cercano }, world.colision;
}

// src/Core/personality.js
var TRAIT_LABEL = {
  valentia: ["Miedosa", "Valiente"],
  curiosidad: ["Rutinaria", "Curiosa"],
  apetito: ["Asc\xE9tica", "Glotona"],
  sociabilidad: ["Solitaria", "Sociable"],
  animo: ["Gru\xF1ona", "Alegre"]
}, TONE = {
  valentia: ["Ay\u2026 ", "\xA1Sin miedo! "],
  curiosidad: ["Mmh. ", "Ooh, "],
  apetito: ["Meh. ", "\xD1am, "],
  sociabilidad: ["(a solas) ", "\xA1Amigos! "],
  animo: ["Tsk. ", "\xA1Yupi! "]
}, BASE = {
  nace: ["\xA1Hola, mundo!", "Acabo de rodar hasta aqu\xED."],
  llega: ["Llegu\xE9 a {n}.", "As\xED que esto es {n}."],
  ganaP: ["Consegu\xED puntos en {s}.", "\xA1{s} suma!"],
  ganaE: ["Recargo energ\xEDa en {s}.", "{s} me sienta de maravilla."],
  camino: ["Voy a {n} por el {c}.", "Toca el {c}."],
  hambre: ["Se me acaba la energ\xEDa\u2026", "Necesito descansar."],
  miedo: ["Me quedan pocos puntos\u2026", "Esto no pinta bien."],
  muere: ["Adi\xF3s, mundo\u2026", "Me apago\u2026"],
  // obstáculos llamativos del circuito (la clave es el `kind` del tramo)
  canon: ["\xA1Fueeego!", "\xA1Salgo disparada!"],
  trampolin: ["\xA1Boing, boing!", "\xA1Qu\xE9 bote!"],
  rizo: ["\xA1Cabeza abajo!", "\xA1Otra vuelta!"],
  caida: ["\xA1Aaaah, caigo!", "\xA1Al vac\xEDo!"],
  embudo: ["Vueltas y vueltas\u2026", "Me mareo\u2026"],
  geiser: ["\xA1Al chorro del g\xE9iser!", "\xA1Arriba voy!"],
  erupcion: ["\xA1Erupci\xF3n! \xA1A volar!", "\xA1El cr\xE1ter me lanza!"],
  turbina: ["\xA1Viento de lado!", "\xA1Qu\xE9 impulso!"],
  hielo_resbaloso: ["\xA1Qu\xE9 r\xE1pido patina!", "\xA1A toda velocidad!"],
  pantano: ["Uy, qu\xE9 pegajoso\u2026", "Me frena el pantano\u2026"],
  portal: ["\xA1Salto espacial!", "\xA1Teletransporte!"],
  cascada: ["\xA1Por la cascada!", "\xA1Agua va!"],
  carril: ["\xA1Cambio de carril por {m}!", "\xA1Por la pared gracias a {m}!"],
  falla: ["\xA1Uy, me ca\xED en {m}!", "\xA1Fall\xF3 {m}!", "\xA1Al suelo otra vez por {m}!"]
}, EMOJI = {
  nace: "\u{1F44B}",
  llega: "\u{1F4CD}",
  ganaP: "\u2B50",
  ganaE: "\u26A1",
  camino: "\u{1F9ED}",
  hambre: "\u{1F634}",
  miedo: "\u{1F61F}",
  muere: "\u{1F4A4}",
  canon: "\u{1F4A5}",
  trampolin: "\u{1F938}",
  rizo: "\u27B0",
  caida: "\u{1FA82}",
  embudo: "\u{1F32A}\uFE0F",
  geiser: "\u26F2",
  erupcion: "\u{1F30B}",
  turbina: "\u{1F4A8}",
  hielo_resbaloso: "\u{1F9CA}",
  pantano: "\u{1FAE7}",
  portal: "\u{1F7E3}",
  cascada: "\u{1F30A}",
  carril: "\u2194\uFE0F",
  falla: "\u{1F635}"
};
function archetype(genome) {
  let t = genome.traits, ranked = Object.keys(TRAIT_LABEL).sort((a, b) => Math.abs(t[b] - 0.5) - Math.abs(t[a] - 0.5)), top = ranked[0], labels = ranked.slice(0, 2).map((k) => TRAIT_LABEL[k][t[k] >= 0.5 ? 1 : 0]);
  return { key: top, hi: t[top] >= 0.5, title: labels.join(" y ") };
}
function voice(b, event, ctx, rng) {
  let lines = BASE[event], line = lines[Math.floor(rng() * lines.length)].replace(/\{(\w)\}/g, (_, k) => ctx[k] ?? ""), tone = TONE[b.arch.key][b.arch.hi ? 1 : 0];
  return { text: (rng() < 0.6 ? tone : "") + line, emoji: EMOJI[event] };
}
function moodOf(b) {
  return b.p < 18 && b.e < 18 ? "asustada" : b.p < 30 && b.e < 30 ? "mareada" : b.e < 30 ? "cansada" : b.p < 30 ? "preocupada" : b.p > 80 && b.e > 70 ? "euforica" : "feliz";
}

// src/Core/sim.js
var POP = 10, TIME_SCALE = 4.5, TRAVEL_SLOW = 2.5 / TIME_SCALE, TRAITS = ["valentia", "curiosidad", "apetito", "sociabilidad", "animo", "velocidad"], GENES = ["prefs", "ways", "routes", "kinds"], DRAIN_E = 0.22, DRAIN_P = 0.25, MAX_SIN_DECIDIR = 3, MAX_FILA = 30, MAX_NOMBRE = 16, GRACIA_DESCONEXION = 60, MAX_CONTROL_POR_ESPECTADOR = 1, MAX_FILA_POR_ESPECTADOR = 1, RUTAS_DINAMICAS = !0, MIN_SALIDAS = 2, RUTAS_FRAC_MIN = 0.4, RUTAS_FRAC_MAX = 0.6, T_SIN_USO = 90, T_APARECE = 30, limpiarNombre = (nombre) => String(nombre ?? "").replace(/[^\p{L}\p{N} _-]/gu, "").replace(/\s+/g, " ").trim().slice(0, MAX_NOMBRE).trim(), TRAVEL_E_LEN = 55e-4 / TRACK_K, PPS_K = 0.35 / 2.5, MAP_SPEED_K = SIZE_K / 2.5 * 1.42 * 1.14, TUBE_SPEED_K = 2.4, GRAV2 = 24 * TRACK_K, FRIC = 0.14, VMAX = 48 * TRACK_K * MAP_SPEED_K, LANE_EASE = 3.5, RAIL_EASE = 6, G_WALL = 24 * TRACK_K, BOUNCE = 0.35, LAT_K = 30, LAT_C = 7, LAT_EDGE = 0.4, RACE_GAP = 2.5, WOW = ["canon", "trampolin", "rizo", "caida", "embudo", "geiser", "erupcion", "turbina", "hielo_resbaloso", "pantano", "portal", "cascada"], FALLBACK_VOICES = {
  geiser: ["\xA1Al chorro del g\xE9iser!", "\xA1Arriba voy!"],
  erupcion: ["\xA1Erupci\xF3n! \xA1A volar!", "\xA1El cr\xE1ter me lanza!"],
  turbina: ["\xA1Viento de lado!", "\xA1Qu\xE9 impulso!"],
  hielo_resbaloso: ["\xA1Qu\xE9 r\xE1pido patina!", "\xA1A toda velocidad!"],
  pantano: ["Uy, qu\xE9 pegajoso\u2026", "Me frena el pantano\u2026"],
  portal: ["\xA1Salto espacial!", "\xA1Teletransporte!"],
  cascada: ["\xA1Por la cascada!", "\xA1Agua va!"],
  carril: ["\xA1Cambio de carril!", "\xA1Por la pared!", "\xA1A la otra pared!", "\xA1Al techo!"],
  falla: ["\xA1Uy, me ca\xED!", "\xA1Fall\xE9 el salto!", "\xA1Al suelo otra vez!"]
}, Y2 = new Vector3(0, 1, 0), clamp3 = (x, a, b) => Math.min(b, Math.max(a, x)), mean = (arr, f) => arr.reduce((s, x) => s + f(x), 0) / arr.length, tmp2 = new Vector3(), tmp22 = new Vector3(), tmp3 = new Vector3(), ease = (v, target, k) => (v.lerp(target, k), v.lengthSq() < 1e-6 && v.copy(target), v.normalize());
function randomGenome(world, rng) {
  let traits = {};
  return TRAITS.forEach((k) => {
    traits[k] = rng();
  }), {
    traits,
    hue: rng(),
    prefs: world.destinos.map(() => rng()),
    ways: world.ways.map(() => rng()),
    routes: world.routes.map(() => rng()),
    kinds: OBSTACLES.map(() => rng())
  };
}
function breed(a, b, rng, rate = 0.15) {
  let pick = (x, y) => rng() < 0.5 ? x : y, mut = (v) => rng() < rate ? clamp3(v + (rng() + rng() + rng() - 1.5) * 0.5, 0, 1) : v, child = { traits: {}, hue: (mut(pick(a.hue, b.hue)) + 1) % 1 };
  return TRAITS.forEach((k) => {
    child.traits[k] = mut(pick(a.traits[k], b.traits[k]));
  }), GENES.forEach((k) => {
    child[k] = a[k].map((v, i) => mut(pick(v, b[k][i])));
  }), child;
}
var SIL_INI = ["Pe", "Mo", "Ca", "Ta", "Chi", "Nu", "Go", "Bu", "Pi", "Mi", "Fre", "O", "Tru", "Ki", "Lu", "Ru", "Bi", "Ga", "Zu", "\xD1e", "Bo", "Che", "Fi", "La"], SIL_MED = ["", "", "lu", "ti", "ra", "pi", "ne", "mo", "ca", "si", "li", "ru"], SIL_FIN = ["sa", "ti", "ca", "pa", "ba", "to", "lla", "chi", "na", "jo", "ki", "\xF1a", "r\xED", "l\xEDn", "t\xF3n", "mi"];
function nombreUnico(rng, usados) {
  let p = (a) => a[Math.floor(rng() * a.length)];
  for (let i = 0; ; i++) {
    let n = p(SIL_INI) + p(SIL_MED) + p(SIL_FIN) + (i > 50 ? p(SIL_FIN) : "");
    if (!usados.has(n))
      return usados.add(n), n;
  }
}
var Sim = class {
  // rutas: false = todas activas siempre; true = constantes de arriba; objeto = las sustituye
  //   { minSalidas, fracMin, fracMax, tSinUso, tAparece }
  constructor({ rng = Math.random, pop = POP, seed, rngDialogos = Math.random, rutas = RUTAS_DINAMICAS } = {}) {
    this.rng = rng, this.rngDialogos = rngDialogos, this.world = buildWorld(seed), this.seed = seed ?? 369, this.hooks = {}, this.fila = [], this.pop = pop, this.t = 0, this.nextId = 1, this.ballitas = [], this.pool = [], this.spawnQueue = [], this.stats = { nacidas: 0, muertas: 0, mejorEdad: 0, genMax: 1 }, this.feed = [], this.nombres = /* @__PURE__ */ new Set(), this.activas = null, this.rutasRev = 0, rutas && this.iniciarRutas(rutas === !0 ? {} : rutas);
    for (let i = 0; i < pop; i++) this.spawn();
  }
  // ───────────── rutas dinámicas: qué sentidos están activos (docs/mundo_compartido.md, sección 9) ─────────────
  // Arranque determinista: MIN_SALIDAS salidas al azar por planeta (a planetas distintos) y, si falta para el centro
  // del rango objetivo, más al azar.
  iniciarRutas(cfg) {
    let W = this.world.ways, N = W.length, c = this.rutasCfg = { minSalidas: MIN_SALIDAS, fracMin: RUTAS_FRAC_MIN, fracMax: RUTAS_FRAC_MAX, tSinUso: T_SIN_USO, tAparece: T_APARECE, ...cfg };
    c.min = Math.ceil(c.fracMin * N), c.max = Math.max(c.min, Math.floor(c.fracMax * N)), this.activas = /* @__PURE__ */ new Set(), this.usoRuta = new Array(N).fill(0), this.tAparicion = 0;
    for (let salen of this.world.waysFrom) {
      let resto = [...salen], vistos = /* @__PURE__ */ new Set();
      for (; vistos.size < c.minSalidas && resto.length; ) {
        let w = resto.splice(Math.floor(this.rng() * resto.length), 1)[0];
        vistos.has(w.to) || (vistos.add(w.to), this.activas.add(w.idx));
      }
    }
    let meta = Math.round((c.min + c.max) / 2);
    for (; this.activas.size < meta && this.activas.size < N; ) {
      let ina = W.filter((w) => !this.activas.has(w.idx));
      this.activas.add(ina[Math.floor(this.rng() * ina.length)].idx);
    }
  }
  activa(way) {
    return !this.activas || this.activas.has(way.idx);
  }
  // Sentidos activos que salen de `nodo` (todos si las rutas dinámicas están apagadas).
  salidasActivas(nodo) {
    let ws = this.world.waysFrom[nodo] ?? [];
    if (!this.activas) return ws;
    let act = ws.filter((w) => this.activas.has(w.idx));
    return act.length ? act : ws;
  }
  // Planetas distintos a los que `nodo` puede SALIR por rutas activas, sin contar la ruta `sin` (las que llegan no cuentan).
  salidasDistintas(nodo, sin = -1) {
    let a = /* @__PURE__ */ new Set();
    for (let w of this.world.waysFrom[nodo]) w.idx !== sin && this.activas.has(w.idx) && a.add(w.to);
    return a.size;
  }
  // ¿Alguna ballita viva va por ella (rumbo al puerto o dentro: b.way, con su plannedRoute) o la tiene en sus
  // decisiones pendientes (ruta decidida, o planeta decidido que se alcanza por ella)?
  rutaEnUso(way) {
    for (let b of this.ballitas)
      if (!(b.phase === "dying" || b.phase === "gone")) {
        if (b.way === way) return !0;
        if (b.ctrl && (b.dec.ruta?.way === way.idx || b.dec.destino === way.to && this.origenSiguiente(b) === way.from))
          return !0;
      }
    return !1;
  }
  puedeQuitarRuta(way) {
    return !!this.activas && this.activas.has(way.idx) && !this.rutaEnUso(way) && this.salidasDistintas(way.from, way.idx) >= this.rutasCfg.minSalidas;
  }
  // Quita la ruta si las reglas lo permiten; si las activas bajan del mínimo del rango aparece otra al azar.
  quitarRuta(way, motivo) {
    return this.puedeQuitarRuta(way) ? (this.activas.delete(way.idx), this.rutasRev++, this.hooks.rutas?.({ on: [], off: [way.idx], motivo }), this.activas.size < this.rutasCfg.min && this.aparecerRuta("rango", way.idx), !0) : !1;
  }
  // Activa una inactiva al azar (rng de la sim), distinta de `sin` si hay otra.
  aparecerRuta(motivo, sin = -1) {
    let ina = this.world.ways.filter((w2) => !this.activas.has(w2.idx) && w2.idx !== sin);
    if (ina.length || (ina = this.world.ways.filter((w2) => !this.activas.has(w2.idx))), !ina.length) return null;
    let w = ina[Math.floor(this.rng() * ina.length)];
    return this.activas.add(w.idx), this.usoRuta[w.idx] = this.t, this.tAparicion = this.t, this.rutasRev++, this.hooks.rutas?.({ on: [w.idx], off: [], motivo }), w;
  }
  tickRutas() {
    let c = this.rutasCfg;
    for (let b of this.ballitas) b.way && b.phase !== "dying" && b.phase !== "gone" && (this.usoRuta[b.way.idx] = this.t);
    for (let i of this.activas)
      if (this.t - this.usoRuta[i] > c.tSinUso && this.quitarRuta(this.world.ways[i], "sin_uso")) break;
    this.t - this.tAparicion >= c.tAparece && (this.activas.size < c.max ? this.aparecerRuta("tiempo") : this.tAparicion = this.t);
  }
  genomeForNewborn() {
    let { pool, rng } = this;
    if (pool.length < 3 || rng() < 0.1) return { genome: randomGenome(this.world, rng), gen: 1, padres: [] };
    let tour = () => {
      let best = null;
      for (let i = 0; i < 3; i++) {
        let c = pool[Math.floor(rng() * pool.length)];
        (!best || c.fitness > best.fitness) && (best = c);
      }
      return best;
    }, a = tour(), b = tour();
    return { genome: breed(a.genome, b.genome, rng), gen: Math.max(a.gen, b.gen) + 1, padres: [a.id, b.id] };
  }
  spawn() {
    let { genome, gen, padres } = this.genomeForNewborn(), node = this.world.nodes[Math.floor(this.rng() * this.world.nodes.length)], vert = Math.floor(this.rng() * node.verts.length), up = node.verts[vert].dir.clone(), f = this.fila.length ? this.fila.shift() : null, name;
    if (f) {
      name = f.nombre;
      for (let i = 2; this.nombres.has(name) || this.ballitas.some((o) => o.name === name); i++) name = `${f.nombre} ${i}`;
      this.nombres.add(name);
    } else name = `${nombreUnico(this.rng, this.nombres)} ${gen > 1 ? "G" + gen : ""}`.trim();
    let b = {
      id: this.nextId++,
      gen,
      genome,
      padres,
      node: node.idx,
      vert,
      p: 60,
      e: 60,
      age: 0,
      visits: 0,
      score: 0,
      name,
      // control (mundo compartido): quién la controla, quién la formó y sus decisiones «para la siguiente»
      ctrl: f && this.controladas(f.espectador) < MAX_CONTROL_POR_ESPECTADOR ? f.espectador : null,
      formadaPor: f ? f.espectador : null,
      dec: {},
      sinDecidir: 0,
      viajeDecidido: !1,
      rutaFija: null,
      carrilFijo: null,
      phase: "born",
      timer: 0.8,
      dur: 0.8,
      bornAt: this.t,
      dest: null,
      way: null,
      route: null,
      seg: null,
      segT: 0,
      walk: null,
      visited: [node.idx],
      visitedRoutes: {},
      plannedRoute: null,
      nextDest: null,
      plan: null,
      log: [],
      flags: {},
      pos: node.pos.clone().addScaledVector(up, NODE_R + BALL_R),
      dir: new Vector3().crossVectors(up, Math.abs(up.y) > 0.9 ? new Vector3(1, 0, 0) : Y2).normalize(),
      up,
      // estado del balanceo en el tubo: `wall` va del eje a la ballita, `off` es su distancia al eje
      wall: up.clone().negate(),
      off: 0,
      rail: 0,
      roll: 0,
      snap: 0,
      lane: 0,
      carril: 0,
      ang: 0,
      sw: null,
      mechs: {},
      vis: 1,
      hy: 0,
      vy: 0,
      airborne: !1,
      flight: null,
      impact: 0,
      slope: 0,
      lat: 0,
      latV: 0,
      edge: 0,
      onLane: !0,
      thought: null,
      react: null,
      mood: "feliz",
      speed: 0,
      cause: null
    };
    return b.arch = archetype(genome), this.ballitas.push(b), this.stats.nacidas++, this.stats.genMax = Math.max(this.stats.genMax, gen), this.say(b, "nace"), this.hooks.nace?.(b), f && this.hooks.entra?.(b, f.espectador), b;
  }
  // ───────────── mundo compartido: fila, control y decisiones (docs/mundo_compartido.md, secciones 3 y 4) ─────────────
  viva(id) {
    let b = this.ballitas.find((o) => o.id === id);
    return b && b.phase !== "dying" && b.phase !== "gone" ? b : null;
  }
  controladas(espectador) {
    let n = 0;
    for (let o of this.ballitas) o.ctrl === espectador && n++;
    return n;
  }
  formar(espectador, nombre) {
    if (this.fila.filter((f) => f.espectador === espectador).length >= MAX_FILA_POR_ESPECTADOR) return { ok: !1, error: "ya_en_fila" };
    let limpio = limpiarNombre(nombre);
    return limpio ? this.fila.length >= MAX_FILA ? { ok: !1, error: "fila_llena" } : (this.fila.push({ espectador, nombre: limpio, t: this.t }), { ok: !0, puesto: this.fila.length }) : { ok: !1, error: "nombre" };
  }
  salirFila(espectador) {
    let n = this.fila.length;
    return this.fila = this.fila.filter((f) => f.espectador !== espectador), { ok: !0, quitadas: n - this.fila.length };
  }
  tomar(id, espectador) {
    let b = this.viva(id);
    return b ? b.ctrl ? { ok: !1, error: b.ctrl === espectador ? "ya_controlas" : "ocupada" } : this.controladas(espectador) >= MAX_CONTROL_POR_ESPECTADOR ? { ok: !1, error: "ya_controlas" } : (b.ctrl = espectador, b.sinDecidir = 0, b.dec = {}, this.hooks.entra?.(b, espectador), { ok: !0 }) : { ok: !1, error: "no_existe" };
  }
  dejar(id, espectador, motivo = "dejar") {
    let b = this.ballitas.find((o) => o.id === id);
    return !b || !b.ctrl || b.ctrl !== espectador ? { ok: !1, error: "no_controlas" } : (b.ctrl = null, b.dec = {}, b.sinDecidir = 0, this.hooks.libre?.(b, motivo), { ok: !0 });
  }
  // Nodo desde el que saldrá el siguiente viaje: el actual, o el de llegada si ya va de camino.
  origenSiguiente(b) {
    return (b.phase === "toPort" || b.phase === "travel") && b.way ? b.way.to : b.node;
  }
  // dec = { destino?: idx de nodo | null, ruta?: { way, r } | null, carril?: 0..4 | null }; null borra; lo ausente no cambia.
  decidir(id, espectador, dec) {
    let b = this.viva(id);
    if (!b || !b.ctrl || b.ctrl !== espectador) return { ok: !1, error: "no_controlas" };
    let ways = this.salidasActivas(this.origenSiguiente(b)), n = { ...b.dec };
    if (dec && "destino" in dec)
      if (dec.destino == null)
        delete n.destino, delete n.ruta;
      else if (ways.some((w) => w.to === dec.destino)) n.destino = dec.destino;
      else return { ok: !1, error: "destino" };
    if (dec && "ruta" in dec)
      if (dec.ruta == null) delete n.ruta;
      else {
        let w = typeof dec.ruta == "object" ? ways.find((x) => x.idx === dec.ruta.way) : null;
        if (!w || !Number.isInteger(dec.ruta.r) || !w.routes[dec.ruta.r]) return { ok: !1, error: "ruta" };
        n.ruta = { way: w.idx, r: dec.ruta.r }, n.destino = w.to;
      }
    if (dec && "carril" in dec)
      if (dec.carril == null) delete n.carril;
      else {
        if (!Number.isInteger(dec.carril) || dec.carril < 0 || dec.carril >= CARRILES) return { ok: !1, error: "carril" };
        n.carril = dec.carril;
      }
    return n.ruta && n.destino !== this.world.ways[n.ruta.way].to && delete n.ruta, b.dec = n, this.hooks.decide?.(b, n), { ok: !0, dec: { ...n } };
  }
  // Sentidos y ruta que admite el siguiente viaje desde `nodo` según las decisiones `d` (lo que no vale se ignora).
  restringir(nodo, d) {
    let ways = this.salidasActivas(nodo), ruta = null, usado = [];
    if (d.ruta) {
      let w = ways.find((x) => x.idx === d.ruta.way);
      w?.routes[d.ruta.r] && (ways = [w], ruta = w.routes[d.ruta.r], usado.push("destino", "ruta"));
    }
    if (!ruta && d.destino != null) {
      let w = ways.filter((x) => x.to === d.destino);
      w.length && (ways = w, usado.push("destino"));
    }
    return { ways, ruta, usado };
  }
  // Decisión automática que tomaría hoy la sim para el siguiente viaje, con las decisiones pendientes aplicadas.
  // Sin ruido y sin consumir la rng (como probWays): la elección real ocurre en goWay y puede diferir.
  predecir(b) {
    if (b.phase === "dying" || b.phase === "gone") return null;
    let { ways, ruta } = this.restringir(this.origenSiguiente(b), b.ctrl ? b.dec : {}), peers = this.peerCounts(b), best = null, bs = -1 / 0;
    for (let way of ways)
      for (let route of ruta ? [ruta] : way.routes)
        for (let nextDest of this.world.nodes[way.to].destinos) {
          let u = this.planUtility(b, way, route, nextDest, peers, 1, !1).total;
          u > bs && (bs = u, best = { way, route });
        }
    return best;
  }
  // Previsión de un viaje (fórmulas de planUtility): duración real en s, y cambio de energía y puntos.
  prevision(b, way, route) {
    let obs = route.segments.slice(1, -1), vel = obs.reduce((s, o) => s + (o.speedK ?? 1), 0) / Math.max(1, obs.length), eta = route.length / (this.cruise(b) * TUBE_SPEED_K * vel + 8 * TRACK_K);
    return { seg: eta / TRAVEL_SLOW, dE: -(eta * DRAIN_E + route.length * TRAVEL_E_LEN * way.theme.ecost), dP: eta * (way.theme.pps * PPS_K - DRAIN_P) };
  }
  say(b, event, ctx = {}) {
    let v;
    try {
      v = voice(b, event, ctx, this.rng);
    } catch {
      let fb = FALLBACK_VOICES[event] || ["\xA1Guau!"];
      v = { text: fb[Math.floor(this.rng() * fb.length)], emoji: KINDS[event]?.emoji || "\u2728" };
    }
    b.thought = { ...v, until: this.t + 3.5 }, b.log.unshift({ t: Math.round(b.age), ...v }), b.log.length > 30 && b.log.pop();
  }
  tick(dt) {
    this.t += dt;
    let near = this._near || (this._near = /* @__PURE__ */ new Map());
    near.clear();
    for (let b of this.ballitas) if (b.phase === "travel" && b.seg) {
      let l = near.get(b.seg);
      l || near.set(b.seg, l = []), l.push(b);
    }
    for (let b of this.ballitas) this.step(b, dt);
    for (let i = this.ballitas.length - 1; i >= 0; i--)
      this.ballitas[i].phase === "gone" && this.ballitas.splice(i, 1);
    for (; this.ballitas.length + this.spawnQueue.length < this.pop; ) this.spawnQueue.push(this.t + 1.5);
    this.spawnQueue = this.spawnQueue.filter((at2) => at2 <= this.t ? (this.spawn(), !1) : !0), this.activas && this.tickRutas();
  }
  step(b, dt) {
    if (b.phase === "dying") {
      b.timer -= dt, b.timer <= 0 && (b.phase = "gone");
      return;
    }
    b.age += dt;
    let sd = b.phase === "travel" ? dt * TRAVEL_SLOW : dt;
    switch (b.e -= DRAIN_E * sd, b.p -= DRAIN_P * sd, b.timer = Math.max(0, b.timer - dt), b.react && b.react.until < this.t && (b.react = null), b.phase) {
      case "born":
        b.timer <= 0 && this.goDest(b);
        break;
      case "toDest":
        this.walkStep(b, dt) && this.arriveDest(b);
        break;
      case "at":
        b.timer <= 0 && this.goWay(b);
        break;
      case "toPort":
        this.walkStep(b, dt) && this.enterSeg(b, b.way.segments[0]);
        break;
      case "travel":
        this.travelStep(b, sd);
        break;
    }
    b.p = clamp3(b.p, 0, 100), b.e = clamp3(b.e, 0, 100), this.watch(b);
  }
  watch(b) {
    if (b.e <= 0 || b.p <= 0) {
      b.cause = b.e <= 0 ? "energ\xEDa" : "puntos", this.say(b, "muere"), b.phase = "dying", b.timer = 1.4, b.speed = 0, b.mood = "asustada", this.pool.push({ id: b.id, genome: b.genome, gen: b.gen, fitness: b.age + b.score * 0.2 }), this.pool.sort((x, y) => y.fitness - x.fitness), this.pool.length = Math.min(this.pool.length, 24), this.stats.muertas++, b.ctrl && (b.ctrl = null, b.dec = {}, this.hooks.libre?.(b, "muerte")), this.hooks.muere?.(b), this.stats.mejorEdad = Math.max(this.stats.mejorEdad, b.age), this.feed.unshift({ t: this.t, text: `${b.name} muri\xF3 por falta de ${b.cause} (${Math.round(b.age)}s)` }), this.feed.length = Math.min(this.feed.length, 8);
      return;
    }
    b.e < 25 && !b.flags.hambre && (b.flags.hambre = !0, this.say(b, "hambre")), b.e > 40 && (b.flags.hambre = !1), b.p < 25 && !b.flags.miedo && (b.flags.miedo = !0, this.say(b, "miedo")), b.p > 40 && (b.flags.miedo = !1), b.mood = b.react ? b.react.mood : moodOf(b);
  }
  // Coloca la ballita. Tras un cambio de fase (`snap`) la posición se funde en vez de saltar.
  place(b, P, T, U, dt) {
    b.snap > 0 && (b.snap -= dt), b.snap > 0 ? b.pos.lerp(P, Math.min(1, dt * 12)) : b.pos.copy(P);
    let k = Math.min(1, dt * 10);
    ease(b.dir, T, k), ease(b.up, U, k);
  }
  // ───────────── ciudad: caminar por las carreteras de la esfera ─────────────
  cruise(b) {
    return (4 + b.genome.traits.velocidad * 3) * TRACK_K * MAP_SPEED_K;
  }
  walkTo(b, vert, phase) {
    let node = this.world.nodes[b.node], path2 = cityPath(node, b.vert, vert), len = 0;
    for (let i = 1; i < path2.length; i++) len += node.verts[path2[i - 1]].dir.angleTo(node.verts[path2[i]].dir) * NODE_R;
    b.walk = { path: path2, i: 0, t: 0 }, b.phase = phase, b.speed = this.cruise(b), b.snap = 0.3, b.dur = b.timer = len / b.speed;
  }
  // Avanza por el camino; devuelve true al llegar al último vértice.
  walkStep(b, dt) {
    let node = this.world.nodes[b.node], w = b.walk, last = w.path.length - 1, d = b.speed * dt;
    for (; w.i < last; ) {
      let len = node.verts[w.path[w.i]].dir.angleTo(node.verts[w.path[w.i + 1]].dir) * NODE_R, left = (1 - w.t) * len;
      if (d < left) {
        w.t += d / len;
        break;
      }
      d -= left, w.i++, w.t = 0;
    }
    if (w.i >= last) {
      let v = node.verts[b.vert = w.path[last]];
      return b.pos.copy(node.pos).addScaledVector(v.dir, NODE_R + BALL_R), b.up.copy(v.dir), b.speed = 0, !0;
    }
    let A = node.verts[w.path[w.i]].dir, B = node.verts[w.path[w.i + 1]].dir, n = slerpDir(A, B, w.t, tmp2).normalize(), T = tmp22.copy(B).addScaledVector(n, -B.dot(n)).normalize();
    return b.vert = w.path[w.i], this.place(b, new Vector3().copy(node.pos).addScaledVector(n, NODE_R + BALL_R), T, n, dt), !1;
  }
  goDest(b) {
    let g = b.genome, t = g.traits, destinos = this.world.nodes[b.node].destinos, viable = destinos.filter((s) => {
      let path2 = cityPath(this.world.nodes[b.node], b.vert, s.vert), distance = 0;
      for (let i = 1; i < path2.length; i++)
        distance += this.world.nodes[b.node].verts[path2[i - 1]].dir.angleTo(this.world.nodes[b.node].verts[path2[i]].dir) * NODE_R;
      let time = distance / this.cruise(b);
      return b.e - DRAIN_E * time + s.de > 0 && b.p - DRAIN_P * time + s.dp > 0;
    }), options = viable.length ? viable : destinos, best = null, bs = -1 / 0;
    for (let s of options) {
      let gain = (s.dp * (1 - b.p / 100) + s.de * (1 - b.e / 100)) / 20, sc = g.prefs[s.idx] * 0.8 + t.apetito * gain * 3 + this.rng() * (0.2 + t.curiosidad) * 0.9;
      sc > bs && (bs = sc, best = s);
    }
    b.dest = best, b.way = b.route = b.seg = b.plannedRoute = null, b.plan = {
      destino: best.name,
      ruta: this.world.nodes[b.node].name,
      razon: best.kind === "energia" && b.e < 55 ? "busco energ\xEDa" : "quiero puntos"
    }, this.walkTo(b, best.vert, "toDest");
  }
  arriveDest(b) {
    let s = b.dest;
    b.p += s.dp, b.e += s.de, b.score += Math.max(0, s.dp), b.visits++;
    let win = s.kind === "puntos";
    b.react = { mood: win ? "euforica" : "feliz", until: this.t + 1.2 }, this.say(b, win ? "ganaP" : "ganaE", { s: s.name }), b.phase = "at", b.dur = b.timer = 1.5 + (1 - b.genome.traits.apetito) * 1.5;
  }
  // Conteo de compañeras por way, ruta y nodo para evaluar sociabilidad.
  peerCounts(self2) {
    let byWay = /* @__PURE__ */ new Map(), byRoute = /* @__PURE__ */ new Map(), byNode = /* @__PURE__ */ new Map();
    for (let o of this.ballitas) {
      if (o === self2 || o.phase === "dying" || o.phase === "gone") continue;
      o.way && byWay.set(o.way.idx, (byWay.get(o.way.idx) || 0) + 1), o.route && byRoute.set(o.route.idx, (byRoute.get(o.route.idx) || 0) + 1);
      let n = o.phase === "travel" && o.way ? o.way.to : o.node;
      byNode.set(n, (byNode.get(n) || 0) + 1);
    }
    return { byWay, byRoute, byNode };
  }
  // Utilidad anticipada de recorrer `route` de `way` y visitar `nextDest` al llegar.
  // `ruido` false: el término aleatorio se sustituye por su media y NO consume la RNG (solo para predecir, ver probWays).
  planUtility(b, way, route, nextDest, peers, halfFactor = 1, ruido = !0) {
    let g = b.genome, t = g.traits, obs = route.segments.slice(1, -1), avgSpeedK = obs.reduce((s, o) => s + (o.speedK ?? 1), 0) / Math.max(1, obs.length), len = route.length * halfFactor, eta = len / (this.cruise(b) * TUBE_SPEED_K * avgSpeedK + 8 * TRACK_K), costE = eta * DRAIN_E + len * TRAVEL_E_LEN * way.theme.ecost, circuitP = eta * way.theme.pps * PPS_K / 10, remE = b.e - costE, hunger = clamp3((55 - b.e) / 55, 0, 1), needP = clamp3((65 - b.p) / 65, 0, 1), destE = nextDest ? nextDest.de * (0.35 + hunger * 1.6) * (0.4 + t.apetito) / 22 : 0, destP = nextDest ? nextDest.dp * (0.45 + needP * 1.3) / 22 : 0, survival = remE < 8 ? -4.5 : remE < 18 ? -1.5 : 0, riskLevel = (way.theme.risk + (route.profile?.thrill ?? 0.5)) * 0.5, riskScore = (t.valentia - 0.45) * riskLevel * 1.8 - (b.p < 28 ? riskLevel * 0.8 : 0), seenRoute = Math.max(0, (b.visitedRoutes[route.idx] || 0) - (halfFactor < 1 && b.route === route ? 1 : 0)), noveltyNode = b.visited.includes(way.to) ? 0 : 0.45, curiosityScore = t.curiosidad * (1 / (1 + seenRoute) * 1.15 + noveltyNode), peerCount = (peers.byWay.get(way.idx) || 0) * 0.5 + (peers.byRoute.get(route.idx) || 0) + (peers.byNode.get(way.to) || 0) * 0.4, socialScore = (t.sociabilidad - 0.45) * Math.min(3, peerCount) * 0.7, sp = route.profile?.speed, moodScore = (t.animo - 0.5) * (sp === "rapida" ? 0.65 : sp === "lenta" ? -0.4 : 0.35), geneScore = g.ways[way.idx] * 0.45 + g.routes[route.idx] * 0.45 + (nextDest ? g.prefs[nextDest.idx] * 0.45 : 0), noise = (ruido ? this.rng() : 0.5) * (0.16 + t.curiosidad * 0.28), total = circuitP + destE + destP + survival + riskScore + curiosityScore + socialScore + moodScore + geneScore + noise, razon = "explorar circuito";
    return destE >= 0.75 && hunger > 0.35 ? razon = "busco energ\xEDa" : curiosityScore >= 0.7 && seenRoute === 0 ? razon = "ruta inexplorada" : socialScore >= 0.4 ? razon = "seguir al grupo" : socialScore <= -0.35 && peerCount === 0 ? razon = "evitar multitudes" : riskScore >= 0.45 ? razon = "busco adrenalina" : riskLevel < 0.42 && t.valentia < 0.45 ? razon = "camino seguro" : destP >= 0.55 ? razon = "quiero puntos" : sp === "rapida" && (razon = "me apetece velocidad"), { total, razon };
  }
  // Caminos que salen de `node` ordenados de más a menos probable para `b` (misma utilidad que goWay con el ruido en
  // su media). No consume la RNG ni toca a la ballita: la elección real sigue ocurriendo en goWay, al salir del nodo,
  // y puede diferir (energía, puntos y compañeras cambian hasta ese instante). Solo sirve para precargar en orden.
  probWays(b, node = b.node) {
    let ways = this.salidasActivas(node);
    if (ways.length < 2) return ways.map((w) => w.idx);
    let peers = this.peerCounts(b), sc = /* @__PURE__ */ new Map();
    for (let way of ways) {
      let best = -1 / 0;
      for (let route of way.routes)
        for (let nextDest of this.world.nodes[way.to].destinos) {
          let u = this.planUtility(b, way, route, nextDest, peers, 1, !1).total;
          u > best && (best = u);
        }
      sc.set(way.idx, best);
    }
    return ways.map((w) => w.idx).sort((x, y) => sc.get(y) - sc.get(x));
  }
  goWay(b) {
    let d = b.ctrl ? b.dec : {}, { ways, ruta, usado } = this.restringir(b.node, d), peers = this.peerCounts(b), best = null, bs = -1 / 0;
    for (let way of ways) {
      let dests = this.world.nodes[way.to].destinos;
      for (let route of ruta ? [ruta] : way.routes)
        for (let nextDest of dests) {
          let u = this.planUtility(b, way, route, nextDest, peers, 1);
          u.total > bs && (bs = u.total, best = { way, route, nextDest, razon: u.razon });
        }
    }
    b.way = best.way, b.plannedRoute = best.route, b.nextDest = best.nextDest, b.rutaFija = ruta, b.carrilFijo = d.carril ?? null, d.carril != null && usado.push("carril"), b.viajeDecidido = usado.length > 0, b.ctrl && (b.dec = {});
    let destNode = this.world.nodes[best.way.to];
    b.plan = {
      destino: `${destNode.name} \xB7 ${best.nextDest.name}`,
      ruta: `${best.way.theme.name} \xB7 Ruta ${best.route.name}`,
      razon: usado.length ? "lo decidi\xF3 quien me controla" : best.razon
    }, usado.length && (b.plan.manual = usado);
    let invalidas = [];
    d.ruta && !usado.includes("ruta") && invalidas.push("ruta"), d.destino != null && !usado.includes("destino") && invalidas.push("destino"), invalidas.length && (b.plan.aviso = "la ruta decidida ya no est\xE1 disponible: eligi\xF3 sola", this.hooks.invalida?.(b, invalidas)), this.walkTo(b, this.world.nodes[b.node].portTo[best.way.to].out, "toPort"), this.say(b, "camino", { c: best.way.theme.name, n: destNode.name });
  }
  // ───────────── circuito: rodar por los tubos ─────────────
  eta(b, way) {
    return way.length / (this.cruise(b) * TUBE_SPEED_K + 8 * TRACK_K);
  }
  enterSeg(b, seg) {
    let prev = b.phase === "travel" ? b.seg : null;
    prev ? segmentTangent(prev, 1, tmp2).angleTo(segmentTangent(seg, 0, tmp22)) > 0.35 && b.rail > 0.3 * TRACK_K && (b.snap = Math.max(b.snap, 0.2)) : (b.phase = "travel", b.dur = b.timer = this.eta(b, b.way) / TRAVEL_SLOW, b.snap = 0.3, b.lane = 0, b.ang = laneAngle(seg, 0, 0), b.sw = null, b.off = b.rail = 0, this.resetSurface(b));
    let prevRoute = b.route;
    prev && (b.sw || b.flight) && (b.lane = seg.lanes?.some((l) => l.id === b.lane) ? b.lane : nearestLane(seg, b.ang), b.sw = null, b.flight = null, b.vis = 1, b.rail = b.off, this.resetSurface(b)), (!prev || seg.route !== prev.route) && (b.carril = Math.floor(this.rng() * CARRILES), b.carrilFijo != null && (b.carril = b.carrilFijo)), b.seg = seg, b.segT = 0, !b.sw && !seg.lanes?.some((l) => l.id === b.lane) && (b.lane = nearestLane(seg, b.ang)), seg.route >= 0 && (b.route = b.way.routes[seg.route], b.route !== prevRoute && (b.visitedRoutes[b.route.idx] = (b.visitedRoutes[b.route.idx] || 0) + 1)), b.speed = Math.max(b.speed, seg.boost * 1.35 * MAP_SPEED_K, this.cruise(b) * TUBE_SPEED_K * (seg.speedK ?? 1)), WOW.includes(seg.kind) && this.say(b, seg.kind);
  }
  // En cada bifurcación (fork/cross): evalúa la utilidad del tramo restante hasta llegar al destino planeado.
  pickNext(b) {
    if (b.seg.next.length === 1) return b.way.segments[b.seg.next[0]];
    if (b.rutaFija) {
      let i = b.seg.next.find((j) => b.way.segments[j].route === b.rutaFija.r);
      if (i != null) return b.way.segments[i];
    }
    let g = b.genome, way = b.way, peers = this.peerCounts(b), halfFactor = b.seg.kind === "salida" ? 1 : 0.5, best = null, bestRoute = null, bestRazon = null, bs = -1 / 0;
    for (let i of b.seg.next) {
      let o = way.segments[i];
      if (o.route < 0) {
        0 > bs && (bs = 0, best = o);
        continue;
      }
      let rt = way.routes[o.route], u = this.planUtility(b, way, rt, b.nextDest, peers, halfFactor), kindPref = mean(o.tramo, (k) => g.kinds[OBSTACLES.indexOf(k)]) * 0.5, planBonus = b.plannedRoute === rt ? 0.35 : 0, sc = u.total + kindPref + planBonus;
      sc > bs && (bs = sc, best = o, bestRoute = rt, bestRazon = u.razon);
    }
    return bestRoute && bestRoute !== b.plannedRoute && (b.plannedRoute = bestRoute, b.plan && (b.plan.ruta = `${way.theme.name} \xB7 Ruta ${bestRoute.name}`, b.plan.razon = bestRazon)), best;
  }
  travelStep(b, dt) {
    let L = b.way, s = b.seg;
    if (b.e -= TRAVEL_E_LEN * L.theme.ecost * b.speed * dt, b.p += L.theme.pps * PPS_K * dt, b.flight) return this.flightStep(b, s, dt);
    let t0 = b.segT;
    for (b.segT += b.speed * dt / laneLength(s, b.lane); b.segT >= 1; ) {
      if (b.sw || this.checkSwitches(b, s, t0, 1), !s.next.length) return this.arrive(b);
      let over = (b.segT - 1) * laneLength(s, b.lane);
      this.enterSeg(b, this.pickNext(b)), s = b.seg, b.segT = over / laneLength(s, b.lane), t0 = 0;
    }
    b.sw || this.checkSwitches(b, s, t0, b.segT);
    let T = laneFrame(s, b.lane, b.segT, b._frame || (b._frame = {})).tangent, rs = s.air || b.sw || b.airborne ? 0 : reliefSlope(s, b.lane, b.segT);
    b.slope = (T.y - b.wall.y * rs) / Math.hypot(1, rs), b.speed += (-GRAV2 * b.slope - FRIC * s.drag * b.speed) * dt;
    let minV = (1 - 0.45 * clamp3(b.slope * 4, 0, 1)) * this.cruise(b) * TUBE_SPEED_K * clamp3(s.kind === "embudo" ? 0.6 : s.speedK ?? 1, 0.45, 1.8), maxV = VMAX * (s.kind === "portal" ? 1.35 : s.kind === "hielo_resbaloso" ? 1.2 : 1);
    b.sw && !b.sw.failed && (maxV *= 1.15), b.speed = clamp3(b.speed, minV, maxV), this.laneStep(b, s, dt);
    let F = laneFrame(s, b.lane, b.segT, b._frame || (b._frame = {}));
    b.wall.copy(F.dir), b.roll = F.roll;
    let pos = tmp2.copy(F.pos).addScaledVector(F.side, b.lat).addScaledVector(F.up, b.hy);
    this.place(b, pos, F.tangent, F.up, dt);
  }
  // Recorre la trayectoria del evento en curso (switchPath: arco, caída, elevador, portal o laberinto). El avance segT
  // va de sw.u a sw.uLand con el vuelo; al terminar queda en el camino destino, en un carril al azar.
  flightStep(b, s, dt) {
    let f = b.flight;
    f.t = Math.min(1, f.t + dt / f.dur);
    let F = switchPath(s, f.sw, f.t, b._flightFrame || (b._flightFrame = {}));
    b.segT = f.sw.u + (f.sw.uLand - f.sw.u) * f.t, b.airborne = !0, b.off = 0, b.wall.copy(F.up).negate(), b.roll = 0, b.vis = F.vis, this.place(b, F.pos, F.tangent, F.up, dt), !(f.t < 1) && (b.lane = f.sw.to, b.segT = f.sw.uLand, b.flight = null, b.sw = null, b.impact = 1, b.vis = 1, b.carril = Math.floor(this.rng() * CARRILES), b.carrilFijo = null, b.lastSwitch = { kind: f.sw.kind, name: f.sw.name, lane: b.seg.lanes?.find((l) => l.id === f.sw.to)?.name ?? "carril", carril: b.carril, until: this.t + 8 }, f.failed ? (b.speed *= 0.7, b.p -= 1 + f.sw.risk * 3, b.react = { mood: "asustada", until: this.t + 1.2 }, this.say(b, "falla", { m: f.sw.name })) : (b.p += f.sw.reward.p, b.e += f.sw.reward.e, b.score += Math.max(0, f.sw.reward.p)), this.resetSurface(b), b.ang = laneAngle(s, b.lane, b.segT), b.rail = b.off = s.air ? 0 : s.radius - BALL_R);
  }
  // Sigue su carril. Mantiene ang/off continuos y off <= radio útil.
  laneStep(b, s, dt) {
    let R = s.air ? 0 : s.radius - BALL_R;
    b.rail += (R - b.rail) * Math.min(1, dt * RAIL_EASE), b.impact = Math.max(0, b.impact - dt * 3), this.surfaceStep(b, s, dt);
    let target = laneAngle(s, b.lane, b.segT) + (R > 0 ? b.lat / R : 0), d = angDiff(b.ang, target);
    b.onLane = Math.abs(d) < 0.05, b.ang += b.onLane ? d : d * Math.min(1, dt * LANE_EASE), b.off = Math.max(0, b.rail - b.hy);
  }
  resetSurface(b) {
    b.hy = 0, b.vy = 0, b.airborne = !1, b.lat = 0, b.latV = 0, b.edge = 0;
  }
  // Línea de carrera en la calzada (u laterales, |x| <= edge): va por su carril (b.carril, carrilLat);
  // en curva fuerte se va al interior (contra el empuje) y, si una vecina del mismo carril va a menos de RACE_GAP de avance
  // con solape lateral, se aparta por el lado libre (la que viene detrás y más rápida, con más decisión: adelanta).
  // El muelle lateral (LAT_K, LAT_C) la lleva suave hacia esta línea.
  raceLine(b, s, push, edge) {
    let x = carrilLat(b.carril ?? 2, edge);
    Math.abs(push) > 0.5 * TRACK_K && (x -= Math.sign(push) * (edge / CARRILES) * clamp3(Math.abs(push) / (6 * TRACK_K), 0, 1));
    let L = laneLength(s, b.lane);
    for (let o of this._near?.get(s) || []) {
      if (o === b || o.lane !== b.lane || o.flight) continue;
      let ds = (o.segT - b.segT) * L;
      if (Math.abs(ds) > RACE_GAP) continue;
      let dl = b.lat - o.lat, side = Math.abs(dl) > 0.05 ? Math.sign(dl) : b.id > o.id ? 1 : -1, room = 2.2 * BALL_R - Math.abs(dl);
      room > 0 && (x += side * room * (ds > 0 && b.speed > o.speed ? 1.6 : 1));
    }
    return clamp3(x, -edge, edge);
  }
  // Contacto con la pista: relieve (sube/baja, despega en crestas, cae y rebota) y bordes del carril.
  // b.hy: altura sobre la pared (hacia el eje); b.vy su velocidad; b.lat: desvío lateral (u) dentro del carril.
  surfaceStep(b, s, dt) {
    if (s.air || b.rail < 1e-3) {
      b.hy = 0, b.vy = 0, b.airborne = !!s.air, b.lat *= 0.9, b.latV = 0, b.edge = 0;
      return;
    }
    let h = laneRelief(s, b.lane, b.segT), vs = b.speed * reliefSlope(s, b.lane, b.segT), ceil = 0.85 * b.rail;
    if (b.airborne) {
      if (b.vy -= G_WALL * dt, b.hy += b.vy * dt, b.hy > ceil && (b.hy = ceil, b.vy > 0 && (b.vy *= -BOUNCE, b.impact = Math.max(b.impact, 0.3))), b.hy <= h) {
        let hit = vs - b.vy;
        b.hy = h, b.impact = Math.max(b.impact, clamp3(hit / (6 * TRACK_K), 0, 1)), b.speed *= 1 - 0.05 * clamp3(hit / (6 * TRACK_K), 0, 1), hit > 2.5 * TRACK_K ? b.vy = vs + hit * BOUNCE : (b.airborne = !1, b.vy = vs);
      }
    } else vs - b.vy < -G_WALL * dt * 1.5 && b.speed > 3 * TRACK_K ? (b.airborne = !0, b.vy -= G_WALL * dt, b.hy = Math.max(h, b.hy + b.vy * dt)) : (b.hy = h, b.vy = vs);
    let { k, out } = segmentCurvature(s, b.segT), push = 0.5 * b.speed * b.speed * k * Math.sin(angDiff(b.ang, out)), lane = s.lanes?.find((l) => l.id === b.lane), edge = Math.max(0.05, (lane?.width ?? LANE_W) / 2 - BALL_R * 0.85);
    if (b.latV += (push - LAT_K * (b.lat - this.raceLine(b, s, push, edge)) - LAT_C * b.latV) * dt, b.lat += b.latV * dt, b.edge = 0, Math.abs(b.lat) > edge) {
      let sg = Math.sign(b.lat);
      b.lat = sg * edge, b.edge = sg, b.latV * sg > 0 && (b.impact = Math.max(b.impact, clamp3(Math.abs(b.latV) / (8 * TRACK_K), 0, 0.6)), b.latV *= -LAT_EDGE, b.speed *= 0.995);
    }
  }
  // Utilidad de usar un mecanismo (misma lógica que planUtility: riesgo, curiosidad, hambre, grupo, genes).
  laneUtility(b, s, sw, peers) {
    let g = b.genome, t = g.traits, hunger = clamp3((55 - b.e) / 55, 0, 1), needP = clamp3((65 - b.p) / 65, 0, 1), riskScore = (t.valentia - 0.45) * sw.risk * 2 - (b.p < 28 ? sw.risk * 0.6 : 0), curiosity = t.curiosidad * 0.9 / (1 + (b.mechs[sw.kind] || 0)), food = sw.reward.e / 3 * (0.2 + hunger * 1.6) * (0.4 + t.apetito), pts = sw.reward.p / 6 * (0.3 + needP), onLane = peers.filter((o) => o.lane === sw.to).length, social = (t.sociabilidad - 0.45) * Math.min(2, onLane) * 0.5, gi = OBSTACLES.indexOf(sw.kind), gene = gi >= 0 ? g.kinds[gi] * 0.4 : 0.2, failCost = -sw.fail * (1.5 - t.valentia), noise = this.rng() * (0.2 + t.curiosidad * 0.3);
    return riskScore + curiosity + food + pts + social + gene + failCost + noise;
  }
  // ¿Cruzó una estación de mecanismos en (t0, t1] estando en el carril de origen? Decide si la usa.
  checkSwitches(b, s, t0, t1) {
    if (!s.switches?.length) return;
    let cands = s.switchesByLane?.get(b.lane) || s.switches, first = null;
    for (let sw of cands)
      sw.from !== b.lane || sw.carril !== b.carril || sw.u <= t0 || sw.u > t1 || (!first || sw.u < first.u) && (first = sw);
    if (!first) return;
    let u = first.u, t = b.genome.traits, peers = this.ballitas.filter((o) => o !== b && o.phase === "travel" && o.seg === s), best = null, bs = 0.1 + (0.45 - t.valentia) * 0.5 + this.rng() * 0.3;
    for (let sw of cands) {
      if (sw.from !== b.lane || sw.carril !== b.carril || Math.abs(sw.u - u) > 1e-6) continue;
      let sc = this.laneUtility(b, s, sw, peers);
      sc > bs && (bs = sc, best = sw);
    }
    best && this.startSwitch(b, s, best);
  }
  startSwitch(b, s, sw) {
    let fail = this.rng() < sw.fail * (1.25 - b.genome.traits.valentia * 0.5);
    b.sw = { s: sw, t: 0, dur: sw.duration, style: sw.style, fail, failed: fail };
    let roll = (sw.uLand - sw.u) * laneLength(s, sw.from) / Math.max(1, b.speed * sw.boost), dur = sw.via === "laberinto" ? clamp3(roll * 1.5, 0.6 * sw.duration, sw.duration) : clamp3(roll / 2.5, 0.35 * sw.duration, sw.duration);
    b.flight = { sw, t: 0, dur, from: b.lane, to: sw.to, failed: fail }, b.airborne = !0, b.vy = 0, b.lat = 0, b.latV = 0, b.speed *= sw.boost, b.mechs[sw.kind] = (b.mechs[sw.kind] || 0) + 1, b.plan && (b.plan.carril = `${sw.emoji} ${sw.name}`), (!b.thought || b.thought.until < this.t) && this.say(b, "carril", { m: sw.name });
  }
  arrive(b) {
    let L = b.way, node = this.world.nodes[L.to];
    b.ctrl && (b.viajeDecidido || Object.keys(b.dec).length > 0 ? b.sinDecidir = 0 : ++b.sinDecidir >= MAX_SIN_DECIDIR && this.dejar(b.id, b.ctrl, "inactivo")), b.viajeDecidido = !1, b.rutaFija = null, b.carrilFijo = null, b.node = L.to, b.vert = node.portTo[L.from].in, b.visited = [L.to, ...b.visited].slice(0, 3), b.speed = 0, b.roll = b.off = b.rail = 0, this.resetSurface(b), b.slope = 0, b.onLane = !0, b.sw = null, b.lane = 0, b.ang = 0, this.say(b, "llega", { n: node.name }), this.goDest(b), this.activas && this.quitarRuta(L, "terminada");
  }
  // Para el panel: lo que más le gusta (genes más altos).
  favorites(b) {
    let top = (arr) => arr.reduce((bi, v, i) => v > arr[bi] ? i : bi, 0), g = b.genome, w = this.world;
    return { destino: w.destinos[top(g.prefs)], way: w.ways[top(g.ways)], route: w.routes[top(g.routes)], kind: KINDS[OBSTACLES[top(g.kinds)]] };
  }
  // Para el panel: dónde está y a dónde va, en una frase.
  where(b) {
    let w = this.world, n = w.nodes[b.node].name;
    if (b.phase === "travel") {
      let lane = b.seg.lanes?.find((l) => l.id === b.lane)?.name, camino = `Camino: ${b.way.theme.name} \xB7 carril ${b.carril + 1}/${CARRILES}`, cambio = b.sw ? `\u2934 ${b.sw.s.name} al camino ${lane ?? "siguiente"}, carril aleatorio` : b.lastSwitch?.until > this.t ? `\u2934 ${b.lastSwitch.name} al camino ${b.lastSwitch.lane}, carril ${b.lastSwitch.carril + 1}` : "", via = cambio ? ` \xB7 ${cambio}` : "";
      return `De ${n} a ${w.nodes[b.way.to].name} por ${b.way.theme.emoji} ${b.way.theme.name}${b.route ? `, ruta ${b.route.name}` : ""}: ${b.seg.emoji} ${b.seg.name} \xB7 ${camino}${via}`;
    }
    return b.phase === "toPort" ? `En ${n}, hacia el puerto de ${w.nodes[b.way.to].name}` : b.dest ? `En ${n}: ${b.phase === "toDest" ? "va a " : ""}${b.dest.name}` : `En ${n}`;
  }
};

// src/Core/protocolo.js
var FASES = ["born", "toDest", "at", "toPort", "travel", "dying"], CLIENTE = ["hola", "formar", "salirFila", "tomar", "dejar", "decidir", "ping"];
var B_AIRBORNE = 1, B_ONLANE = 2, B_VUELO = 4, B_FALLIDO = 8, r2 = (x) => Math.round(x * 100) / 100 || 0, r3 = (x) => Math.round(x * 1e3) / 1e3 || 0, r5 = (x) => Math.round(x * 1e5) / 1e5 || 0, v2 = (v) => [r2(v.x), r2(v.y), r2(v.z)], v3 = (v) => [r3(v.x), r3(v.y), r3(v.z)];
function rapida(b) {
  let f = b.flight;
  return [
    b.id,
    Math.max(0, FASES.indexOf(b.phase)),
    r2(b.p),
    r2(b.e),
    r2(b.speed),
    r2(b.timer),
    v2(b.pos),
    v3(b.dir),
    v3(b.up),
    b.seg ? b.seg.i : -1,
    r5(b.segT),
    b.lane,
    b.carril,
    r3(b.lat),
    r3(b.hy),
    r3(b.off),
    r3(b.ang),
    r3(b.roll),
    r3(b.slope),
    r2(b.impact),
    r2(b.vis),
    (b.airborne ? B_AIRBORNE : 0) | (b.onLane ? B_ONLANE : 0) | (f ? B_VUELO : 0) | (f?.failed ? B_FALLIDO : 0),
    f && b.seg ? b.seg.switches.indexOf(f.sw) : -1,
    f ? r3(f.t) : 0,
    b.walk ? b.walk.i : -1,
    b.walk ? r3(b.walk.t) : 0
  ];
}
var idx = (o) => o ? o.idx : null, corto = (cortoDe, e) => e == null ? null : cortoDe ? cortoDe(e) : e;
function lenta(b, { cortoDe = null, auto = null } = {}) {
  return {
    id: b.id,
    name: b.name,
    gen: b.gen,
    padres: b.padres,
    arch: b.arch,
    genome: b.genome,
    bornAt: r2(b.bornAt),
    node: b.node,
    vert: b.vert,
    dest: idx(b.dest),
    way: idx(b.way),
    route: idx(b.route),
    plannedRoute: idx(b.plannedRoute),
    nextDest: idx(b.nextDest),
    walk: b.walk ? b.walk.path : null,
    dur: r2(b.dur),
    plan: b.plan,
    mood: b.mood,
    thought: b.thought ? { text: b.thought.text, emoji: b.thought.emoji, until: r2(b.thought.until) } : null,
    react: b.react ? { mood: b.react.mood, until: r2(b.react.until) } : null,
    age: Math.floor(b.age),
    score: Math.round(b.score),
    visits: b.visits,
    cause: b.cause,
    visited: b.visited,
    mechs: b.mechs,
    lastSwitch: b.lastSwitch ? { ...b.lastSwitch, until: r2(b.lastSwitch.until) } : null,
    log: b.log.slice(0, 8),
    ctrl: corto(cortoDe, b.ctrl),
    formadaPor: corto(cortoDe, b.formadaPor),
    dec: b.dec ?? {},
    sinDecidir: b.sinDecidir ?? 0,
    auto: auto ? { way: auto.way.idx, r: auto.route.r } : null
  };
}
function difLenta(textos, ahora) {
  let d = null;
  for (let k in ahora) {
    if (k === "id") continue;
    let s = JSON.stringify(ahora[k]);
    textos[k] !== s && (textos[k] = s, (d || (d = { id: ahora.id }))[k] = ahora[k]);
  }
  return d;
}
var filaPublica = (fila, cortoDe) => fila.map((f) => ({ nombre: f.nombre, de: cortoDe(f.espectador), t: r2(f.t) })), instantanea = (n, t, ballitas) => ({ k: "i", n, t: r3(t), b: ballitas.map(rapida) }), rutasActivas = (sim) => sim.activas ? [...sim.activas].sort((a, b) => a - b) : null;
function acumularRutas(acc, cambio) {
  let a = acc || { on: [], off: [] };
  for (let i of cambio.on || []) {
    let k = a.off.indexOf(i);
    k >= 0 ? a.off.splice(k, 1) : a.on.includes(i) || a.on.push(i);
  }
  for (let i of cambio.off || []) {
    let k = a.on.indexOf(i);
    k >= 0 ? a.on.splice(k, 1) : a.off.includes(i) || a.off.push(i);
  }
  return a;
}
var UUID = /^[0-9a-zA-Z_-]{8,64}$/, entero = (x) => Number.isInteger(x);
function validar(texto) {
  if (typeof texto != "string" || texto.length > 512) return { error: "tamano" };
  let m;
  try {
    m = JSON.parse(texto);
  } catch {
    return { error: "formato" };
  }
  if (!m || typeof m != "object" || Array.isArray(m) || !CLIENTE.includes(m.k)) return { error: "formato" };
  let q = entero(m.q) ? m.q : void 0, mal = (error = "formato") => ({ error, q });
  switch (m.k) {
    case "hola":
      return m.v !== 1 ? mal("version") : typeof m.id != "string" || !UUID.test(m.id) ? mal() : { m: { k: "hola", q, v: 1, id: m.id, epoca: typeof m.epoca == "string" ? m.epoca.slice(0, 40) : void 0, n: entero(m.n) ? m.n : void 0 } };
    case "formar":
      return typeof m.nombre != "string" || m.nombre.length > 64 ? mal("nombre") : { m: { k: "formar", q, nombre: m.nombre } };
    case "salirFila":
      return { m: { k: "salirFila", q } };
    case "tomar":
    case "dejar":
      return entero(m.b) ? { m: { k: m.k, q, b: m.b } } : mal("no_existe");
    case "decidir": {
      if (!entero(m.b)) return mal("no_controlas");
      let dec = {};
      if ("destino" in m) {
        if (m.destino !== null && !entero(m.destino)) return mal("destino");
        dec.destino = m.destino;
      }
      if ("ruta" in m) {
        if (m.ruta !== null && !(m.ruta && typeof m.ruta == "object" && entero(m.ruta.way) && entero(m.ruta.r))) return mal("ruta");
        dec.ruta = m.ruta === null ? null : { way: m.ruta.way, r: m.ruta.r };
      }
      if ("carril" in m) {
        if (m.carril !== null && !entero(m.carril)) return mal("carril");
        dec.carril = m.carril;
      }
      return { m: { k: "decidir", q, b: m.b, dec } };
    }
    case "ping":
      return { m: { k: "ping", q, c: Number.isFinite(m.c) ? m.c : 0 } };
  }
  return mal();
}

// ../back/mundo/servidor.mjs
var AQUI = path.dirname(fileURLToPath(import.meta.url)), ESTATICOS = /* @__PURE__ */ new Set(["name", "gen", "padres", "arch", "genome", "bornAt", "formadaPor"]), pct = (xs, q) => {
  let s = Float64Array.from(xs).sort();
  return s.length ? s[Math.min(s.length - 1, Math.floor(q * s.length))] : 0;
};
async function crearServidor(o = {}) {
  let env = process.env, cfg = {
    puerto: Number(o.puerto ?? env.MUNDO_PUERTO ?? 8379),
    host: o.host ?? env.MUNDO_HOST ?? "127.0.0.1",
    semilla: Number(o.semilla ?? env.MUNDO_SEMILLA ?? 369),
    semillaRng: Number(o.semillaRng ?? env.MUNDO_SEMILLA_RNG ?? randomBytes(4).readUInt32LE(0)),
    datos: o.datos ?? env.MUNDO_DATOS ?? path.join(AQUI, "..", "data"),
    api: o.api ?? env.MUNDO_API ?? "http://127.0.0.1:8000/api",
    gracia: Number(o.gracia ?? env.MUNDO_GRACIA_S ?? GRACIA_DESCONEXION),
    velocidad: Math.max(1, Math.round(Number(o.velocidad ?? env.MUNDO_VELOCIDAD ?? 1))),
    maxConexiones: Number(o.maxConexiones ?? env.MUNDO_MAX_CONEXIONES ?? 500),
    prueba: !!(o.prueba ?? env.MUNDO_PRUEBA === "1"),
    // ganchos HTTP de prueba (matar, velocidad); nunca en producción
    log: o.log ?? ((...a) => console.log((/* @__PURE__ */ new Date()).toISOString(), ...a))
  }, t0 = performance2.now(), archivoPicks = path.join(cfg.datos, `picks_${WORLD_GEN}_${cfg.semilla}.json`), conPicks = !1;
  try {
    let picks = JSON.parse(fs.readFileSync(archivoPicks, "utf8"));
    Array.isArray(picks) && picks.length && (setWorldPicks(cfg.semilla, picks), conPicks = !0);
  } catch {
  }
  let sim = new Sim({ rng: mulberry32(cfg.semillaRng), seed: cfg.semilla });
  if (!conPicks)
    try {
      fs.mkdirSync(cfg.datos, { recursive: !0 }), fs.writeFileSync(archivoPicks, JSON.stringify(sim.world.picks));
    } catch (e) {
      cfg.log("no se pudieron guardar las elecciones:", e.message);
    }
  let epoca = `${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`, arranqueMs = Math.round(performance2.now() - t0);
  cfg.log(`mundo listo en ${arranqueMs} ms (elecciones ${conPicks ? "guardadas" : "calculadas"}) semilla=${cfg.semilla} rng=${cfg.semillaRng} epoca=${epoca}`);
  let cortos = /* @__PURE__ */ new Map(), cortoDe = (id) => {
    let c = cortos.get(id);
    return c || (cortos.size > 5e3 && cortos.clear(), cortos.set(id, c = createHash("sha1").update(id).digest("hex").slice(0, 8))), c;
  }, espectadores = /* @__PURE__ */ new Map(), conectado = (id) => (espectadores.get(id)?.conexiones.size ?? 0) > 0, nConectados = () => {
    let n2 = 0;
    for (let e of espectadores.values()) e.conexiones.size && n2++;
    return n2;
  }, n = 0, cuadro = 0, textos = /* @__PURE__ */ new Map(), autos = /* @__PURE__ */ new Map(), eventos = [], ultimo = { fila: "[]", stats: "", feed: "", espectadores: -1 }, reglas = { maxSinDecidir: MAX_SIN_DECIDIR, maxFila: MAX_FILA, maxNombre: MAX_NOMBRE }, lentaDe = (b) => lenta(b, { cortoDe, auto: autos.get(b.id) ?? null }), refrescarAuto = (b) => {
    b.ctrl ? autos.set(b.id, sim.predecir(b)) : autos.delete(b.id);
  }, feedPublico = () => sim.feed.map((f) => ({ t: Math.round(f.t * 100) / 100, text: f.text }));
  sim.hooks.entra = (b, esp) => {
    if (b.ctrl === esp && !conectado(esp)) {
      sim.dejar(b.id, esp, "desconectado");
      return;
    }
    b.ctrl === esp && eventos.push({ k: "entra", b: b.id, de: cortoDe(esp) });
  }, sim.hooks.libre = (b, motivo) => {
    eventos.push({ k: "libre", b: b.id, motivo }), autos.delete(b.id);
  };
  let rutasPend = null;
  sim.hooks.rutas = (c) => {
    rutasPend = acumularRutas(rutasPend, c);
  }, sim.hooks.invalida = (b, que) => {
    eventos.push({ k: "invalida", b: b.id, que });
  };
  let caidoHasta = 0, mundoBack = null;
  async function pedir(metodo, ruta, cuerpo) {
    if (!cfg.api || Date.now() < caidoHasta) return null;
    try {
      let r = await fetch(cfg.api + ruta, { method: metodo, signal: AbortSignal.timeout(4e3), headers: { "Content-Type": "application/json" }, body: JSON.stringify(cuerpo) });
      return r.ok ? await r.json() : null;
    } catch {
      return caidoHasta = Date.now() + 3e4, null;
    }
  }
  let idMundo = async () => {
    if (!mundoBack) {
      let p = pedir("POST", "/mundos", { semilla: cfg.semilla, params: { pop: sim.pop, compartido: !0, epoca, rng: cfg.semillaRng } });
      mundoBack = p, !await p && mundoBack === p && (mundoBack = null);
    }
    return (await mundoBack)?.id ?? null;
  }, idsBack = /* @__PURE__ */ new Map();
  if (cfg.api) {
    sim.hooks.nace = (b) => {
      let datos = { ref: b.id, nombre: b.name, genoma: b.genome, arquetipo: b.arch, padres: b.padres ?? [], generacion: b.gen };
      idsBack.set(b.id, idMundo().then(async (m) => m ? (await pedir("POST", "/ballitas", { mundo_id: m, ...datos }))?.id ?? null : null));
    }, sim.hooks.muere = (b) => {
      let cambio = { estado: "muerta", puntos: Math.round(b.score * 100) / 100, edad: Math.round(b.age * 10) / 10, causa: b.cause };
      idsBack.get(b.id)?.then((id) => id && pedir("PATCH", `/ballitas/${id}`, cambio)), idsBack.delete(b.id);
    };
    for (let b of sim.ballitas) sim.hooks.nace(b);
  }
  let conexiones = /* @__PURE__ */ new Set(), httpServer = http.createServer((req, res) => {
    if (req.url === "/salud") {
      res.writeHead(200, { "Content-Type": "application/json" }), res.end(JSON.stringify(salud()));
      return;
    }
    if (cfg.prueba && req.url.startsWith("/prueba/")) {
      let u = new URL(req.url, "http://x"), r = { ok: !1 };
      if (u.pathname === "/prueba/matar") {
        let b = sim.viva(Number(u.searchParams.get("b")));
        b && (b.e = 0, r = { ok: !0, b: b.id, name: b.name });
      }
      u.pathname === "/prueba/velocidad" && (cfg.velocidad = Math.max(1, Math.min(60, Math.round(Number(u.searchParams.get("x")) || 1))), r = { ok: !0, velocidad: cfg.velocidad }), res.writeHead(200, { "Content-Type": "application/json" }), res.end(JSON.stringify(r));
      return;
    }
    res.writeHead(426, { "Content-Type": "text/plain" }), res.end("WebSocket");
  }), wss = new import_websocket_server.default({
    server: httpServer,
    maxPayload: 4096,
    // el relevo de FastAPI no la negocia (salto local); un cliente directo sí
    perMessageDeflate: { threshold: 256, zlibDeflateOptions: { level: 3 }, concurrencyLimit: 8 }
  }), enviar = (ws, m) => {
    ws.readyState === 1 && ws.send(typeof m == "string" ? m : JSON.stringify(m));
  }, bytesDifundidos = 0, mensajesDifundidos = 0, difundir = (txt) => {
    for (let ws of conexiones)
      if (ws.readyState === 1) {
        if (ws.bufferedAmount > 1 << 20) {
          ws.terminate();
          continue;
        }
        ws.send(txt);
      }
    bytesDifundidos += txt.length, mensajesDifundidos++;
  };
  function bienvenida(c, q) {
    return {
      k: "hola",
      q,
      v: 1,
      epoca,
      semilla: cfg.semilla,
      worldGen: WORLD_GEN,
      picks: sim.world.picks,
      hz: 30,
      cada: 3,
      n,
      t: Math.round(sim.t * 1e3) / 1e3,
      yo: { corto: c.corto },
      b: sim.ballitas.map((b) => ({ ...lentaDe(b), r: rapida(b) })),
      fila: filaPublica(sim.fila, cortoDe),
      stats: sim.stats,
      feed: feedPublico(),
      espectadores: nConectados(),
      reglas,
      activas: rutasActivas(sim)
    };
  }
  function alHola(ws, c, m) {
    if (c.id) return enviar(ws, { k: "error", q: m.q, error: "hola" });
    clearTimeout(c.plazo), c.id = m.id, c.corto = cortoDe(m.id);
    let e = espectadores.get(c.id);
    e || espectadores.set(c.id, e = { corto: c.corto, conexiones: /* @__PURE__ */ new Set(), gracia: null }), clearTimeout(e.gracia), e.gracia = null, e.conexiones.add(ws), conexiones.add(ws), enviar(ws, bienvenida(c, m.q));
  }
  function alMensaje(ws, c, datos, binario) {
    let ahora = performance2.now();
    if (c.fichas = Math.min(5, c.fichas + (ahora - c.visto) / 1e3 * 5), c.visto = ahora, c.fichas < 1)
      return ahora - c.ultimoExceso > 1e4 && (c.excesos = 0), c.ultimoExceso = ahora, ++c.excesos > 10 ? ws.close(1008, "ritmo") : enviar(ws, { k: "error", error: "ritmo" });
    if (c.fichas -= 1, binario) return enviar(ws, { k: "error", error: "formato" });
    let v = validar(datos.toString("utf8"));
    if (v.error) return enviar(ws, { k: "error", q: v.q, error: v.error });
    let m = v.m;
    if (m.k === "hola") return alHola(ws, c, m);
    if (!c.id) return enviar(ws, { k: "error", q: m.q, error: "hola" });
    let r;
    switch (m.k) {
      case "ping":
        return enviar(ws, { k: "pong", q: m.q, c: m.c, n, t: Math.round(sim.t * 1e3) / 1e3 });
      case "formar":
        r = sim.formar(c.id, m.nombre);
        break;
      case "salirFila":
        r = { ok: sim.salirFila(c.id).ok };
        break;
      case "tomar":
        r = sim.tomar(m.b, c.id);
        {
          let b = r.ok && sim.viva(m.b);
          b && refrescarAuto(b);
        }
        break;
      case "dejar":
        r = sim.dejar(m.b, c.id);
        break;
      case "decidir":
        r = sim.decidir(m.b, c.id, m.dec);
        {
          let b = r.ok && sim.viva(m.b);
          b && refrescarAuto(b);
        }
        break;
      default:
        r = { ok: !1, error: "desconocido" };
    }
    if (r.ok) {
      let { ok, ...resto } = r;
      enviar(ws, { k: "ok", q: m.q, ...resto });
    } else enviar(ws, { k: "error", q: m.q, error: r.error });
  }
  function alCerrar(ws, c) {
    clearTimeout(c.plazo), conexiones.delete(ws);
    let e = c.id && espectadores.get(c.id);
    if (!e || (e.conexiones.delete(ws), e.conexiones.size)) return;
    let soltar = () => {
      for (let b of sim.ballitas) b.ctrl === c.id && sim.dejar(b.id, c.id, "desconectado");
      e.conexiones.size || espectadores.delete(c.id);
    };
    sim.controladas(c.id) ? e.gracia = setTimeout(soltar, cfg.gracia * 1e3) : espectadores.delete(c.id);
  }
  wss.on("connection", (ws) => {
    if (wss.clients.size > cfg.maxConexiones) return ws.close(1013, "lleno");
    let c = { id: null, corto: null, fichas: 5, visto: performance2.now(), excesos: 0, ultimoExceso: 0, plazo: null };
    c.plazo = setTimeout(() => ws.close(1008, "hola"), 5e3), ws.on("message", (d, bin) => {
      try {
        alMensaje(ws, c, d, bin);
      } catch (e) {
        cfg.log("error en mensaje:", e.stack || e), enviar(ws, { k: "error", error: "desconocido" });
      }
    }), ws.on("close", () => alCerrar(ws, c)), ws.on("error", () => ws.terminate());
  });
  let msTick = new Float32Array(18e3), iTick = 0, nTick = 0, maxTick = 0, msDif = new Float32Array(6e3), iDif = 0, nDif = 0;
  function cambiosLentos() {
    let d = { k: "d", n }, hay = !1;
    if (cuadro % 30 === 0) for (let b of sim.ballitas) refrescarAuto(b);
    let vivos = /* @__PURE__ */ new Set();
    for (let b of sim.ballitas) {
      vivos.add(b.id);
      let tx = textos.get(b.id);
      if (!tx) {
        textos.set(b.id, tx = {});
        let l2 = lentaDe(b);
        difLenta(tx, l2), (d.nace || (d.nace = [])).push({ ...l2, r: rapida(b) }), hay = !0;
        continue;
      }
      let l = lentaDe(b);
      for (let k of ESTATICOS) delete l[k];
      let dif = difLenta(tx, l);
      dif && ((d.b || (d.b = [])).push(dif), hay = !0);
    }
    if (textos.size > vivos.size) for (let id of textos.keys()) vivos.has(id) || (textos.delete(id), autos.delete(id));
    let fila = JSON.stringify(filaPublica(sim.fila, cortoDe));
    fila !== ultimo.fila && (ultimo.fila = fila, d.fila = JSON.parse(fila), hay = !0);
    let stats = JSON.stringify(sim.stats);
    stats !== ultimo.stats && (ultimo.stats = stats, d.stats = sim.stats, hay = !0);
    let feed = JSON.stringify(feedPublico());
    feed !== ultimo.feed && (ultimo.feed = feed, d.feed = JSON.parse(feed), hay = !0);
    let esp = nConectados();
    return esp !== ultimo.espectadores && (ultimo.espectadores = esp, d.espectadores = esp, hay = !0), eventos.length && (d.ev = eventos, eventos = [], hay = !0), rutasPend && ((rutasPend.on.length || rutasPend.off.length) && (d.rutas = rutasPend, hay = !0), rutasPend = null), hay ? d : null;
  }
  for (let b of sim.ballitas) {
    let tx = {};
    difLenta(tx, lentaDe(b)), textos.set(b.id, tx);
  }
  ultimo.stats = JSON.stringify(sim.stats), ultimo.feed = JSON.stringify(feedPublico()), ultimo.espectadores = 0;
  function tickReal() {
    for (let k = 0; k < cfg.velocidad; k++) {
      let a2 = performance2.now();
      sim.tick(1 / 30);
      let ms = performance2.now() - a2;
      msTick[iTick] = ms, iTick = (iTick + 1) % msTick.length, nTick++, ms > maxTick && (maxTick = ms), n++;
    }
    if (cuadro++, cuadro % 3) return;
    let a = performance2.now(), d = cambiosLentos();
    conexiones.size && (d && difundir(JSON.stringify(d)), difundir(JSON.stringify(instantanea(n, sim.t, sim.ballitas)))), msDif[iDif] = performance2.now() - a, iDif = (iDif + 1) % msDif.length, nDif++;
  }
  let inicio = performance2.now(), hechos = 0, reloj = setInterval(() => {
    let debidos = Math.floor((performance2.now() - inicio) * 30 / 1e3) - hechos;
    for (debidos > 5 && (hechos += debidos - 5, debidos = 5); debidos > 0; debidos--) {
      hechos++;
      try {
        tickReal();
      } catch (e) {
        cfg.log("error en tick:", e.stack || e);
      }
    }
  }, 1e3 / 30 / 2), cpu0 = process.cpuUsage(), reloj0 = performance2.now();
  function salud() {
    let cpu = process.cpuUsage(cpu0), m = process.memoryUsage(), ts = msTick.subarray(0, Math.min(nTick, msTick.length)), ds = msDif.subarray(0, Math.min(nDif, msDif.length));
    return {
      ok: !0,
      epoca,
      semilla: cfg.semilla,
      worldGen: WORLD_GEN,
      n,
      t: Math.round(sim.t),
      arranqueMs,
      conPicks,
      velocidad: cfg.velocidad,
      conexiones: conexiones.size,
      espectadores: nConectados(),
      ballitas: sim.ballitas.length,
      rutasActivas: sim.activas ? sim.activas.size : sim.world.ways.length,
      rutas: sim.world.ways.length,
      fila: sim.fila.length,
      stats: sim.stats,
      tickMs: { n: nTick, media: +(ts.reduce((a, b) => a + b, 0) / Math.max(1, ts.length)).toFixed(4), p50: +pct(ts, 0.5).toFixed(4), p99: +pct(ts, 0.99).toFixed(4), max: +maxTick.toFixed(3) },
      difusionMs: { n: nDif, media: +(ds.reduce((a, b) => a + b, 0) / Math.max(1, ds.length)).toFixed(4), p99: +pct(ds, 0.99).toFixed(4) },
      cpuPct: +((cpu.user + cpu.system) / 1e3 / (performance2.now() - reloj0) * 100).toFixed(2),
      cpuMs: Math.round((cpu.user + cpu.system) / 1e3),
      vivoS: Math.round((performance2.now() - reloj0) / 1e3),
      rssMB: +(m.rss / 1048576).toFixed(1),
      heapMB: +(m.heapUsed / 1048576).toFixed(1),
      difundido: { mensajes: mensajesDifundidos, bytes: bytesDifundidos }
    };
  }
  await new Promise((ok, mal) => {
    httpServer.once("error", mal), httpServer.listen(cfg.puerto, cfg.host, ok);
  });
  let puerto = httpServer.address().port;
  return cfg.log(`escuchando ws://${cfg.host}:${puerto} (velocidad ${cfg.velocidad}x, gracia ${cfg.gracia} s, api ${cfg.api || "sin registro"})`), { sim, cfg, puerto, epoca, salud, bienvenida, cerrar: () => new Promise((ok) => {
    clearInterval(reloj);
    for (let e of espectadores.values()) clearTimeout(e.gracia);
    for (let ws of wss.clients) ws.terminate();
    wss.close(() => httpServer.close(() => ok()));
  }), arranqueMs };
}
if (process.argv[1] && import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href) {
  let s = await crearServidor(), fin = () => s.cerrar().then(() => process.exit(0));
  process.on("SIGTERM", fin), process.on("SIGINT", fin);
}
export {
  crearServidor
};
