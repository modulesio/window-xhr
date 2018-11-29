/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2011-2016 Yamagishi Kazutoshi
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the 'Software'), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED 'AS IS', WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

'use strict';

const http = require('http');
const Event = require('./event');
const FormData = require('form-data');
const ProgressEvent = require('./progressevent');
const utils = require('./utils');
const XMLHttpRequestEventTarget = require('./xmlhttprequesteventtarget');
const XMLHttpRequestUpload = require('./xmlhttprequestupload');
const symbols = require('./symbols');

const HTTP_STATUS_CODES = http.STATUS_CODES;
const FORBIDDEN_REQUEST_HEADERS = [
  'Accept-Charset',
  'Accept-Encoding',
  'Access-Control-Request-Headers',
  'Access-Control-Request-Method',
  'Connection',
  'Content-Length',
  'Cookie',
  'Cookie2',
  'Date',
  'DNT',
  'Expect',
  'Host',
  'Keep-Alive',
  'Origin',
  'Referer',
  'TE',
  'Trailer',
  'Transfer-Encoding',
  'Upgrade',
  'User-Agent',
  'Via',
  'Sec-.*',
  'Proxy-.*'
];
const FORBIDDEN_REQUEST_HEADERS_PATTERN = new RegExp(
  `^(${FORBIDDEN_REQUEST_HEADERS.join('|')})$`);

const XMLHttpRequestResponseType = [
  '',
  'arraybuffer',
  'blob',
  'document',
  'json',
  'text'
];

function slice(a, b) {
  return (' ' + String.prototype.slice.call(this, a, b)).slice(1);
}

const _listify = x => Array.isArray(x) ? x : (x == null) ? [] : [x];

function dispatch(op, ...args) {
  const props = Object.assign({op, whence: 'window-xhr/XMLHttpRequest'}, ...args);
  for (const f of _listify(XMLHttpRequest[symbols.dispatch])) {
    f(props);
  }
}

function onResponse(url, data, ...args) {
  dispatch('response', {url, data}, ...args);
  return data;
}

function _readyStateChange(readyState) {
  const readyStateChangeEvent = new Event('');
  readyStateChangeEvent.initEvent('readystatechange', false, false);
  this.readyState = readyState;
  this.dispatchEvent(readyStateChangeEvent);
}

function _receiveResponse(response) {
  const _properties = this._properties;
  const statusCode = response.statusCode;
  this.status = statusCode;
  this.statusText = HTTP_STATUS_CODES[statusCode];
  _properties.responseHeaders = response.headers;
  const contentLength = response.headers['content-length'] || '0';
  const bufferLength = parseInt(contentLength, 10);
  if (bufferLength !== 0) {
    _properties.lengthComputable = true;
    _properties.loaded = 0;
    _properties.total = bufferLength;
  }
  _properties.responseBuffers = [];
  _properties.responseText = new String();
  _readyStateChange.call(this, XMLHttpRequest.LOADING);
  const textResponseType = !~['arraybuffer', 'blob'].indexOf(_properties.responseType);
  if (textResponseType) {
    response.setEncoding('utf8');
  }
  response.addListener('data', (chunk) => {
    if (!textResponseType) {
      _properties.responseBuffers.push(chunk);
    } else {
      _properties.responseText = new String(_properties.responseText + chunk);
      _properties.responseText.slice = slice;
      _properties.responseText.substring = slice;
      _properties.responseText.substr = slice;
    }
    this.loaded += chunk.length;
    if (this.readyState !== XMLHttpRequest.LOADING) {
      _readyStateChange.call(this, XMLHttpRequest.LOADING);
    }
  });
  response.addListener('end', () => {
    _readyStateChange.call(this, XMLHttpRequest.DONE);
    _properties.client = null;
  });
}

function _setDispatchProgressEvents(stream) {
  const _properties = this._properties || {};
  const loadStartEvent = new ProgressEvent('loadstart');
  this.dispatchEvent(loadStartEvent);
  stream.on('data', () => {
    const progressEvent = new ProgressEvent('progress', {
      lengthComputable: _properties.lengthComputable || 0,
      loaded: _properties.loaded || 0,
      total: _properties.total || 0
    });
    this.dispatchEvent(progressEvent);
  });
  stream.on('end', () => {
    const progressEvent = new ProgressEvent('progress', {
      lengthComputable: _properties.lengthComputable || 0,
      loaded: _properties.loaded || 0,
      total: _properties.total || 0
    });
    this.dispatchEvent(progressEvent);
    
    const loadEvent = new ProgressEvent('load');
    const loadEndEvent = new ProgressEvent('loadend');
    this.dispatchEvent(loadEvent);
    this.dispatchEvent(loadEndEvent);
    
    process.nextTick(() => {
      _properties.responseBuffers = null;
      _properties.responseText = new String();
    });
  });
}

class XMLHttpRequest extends XMLHttpRequestEventTarget {
  constructor(options) {
    super();
    options = options || {};

    this._flag = {
      anonymous: !!options.anon,
      synchronous: false,
      uploadComplete: false,
      uploadEvents: false,
    };
    this.readyState = XMLHttpRequest.UNSENT;
    this.responseXML = null;
    this.status = 0;
    this.statusText = '';
    this.timeout = 0;
    this.upload = null;
    this.withCredentials = false;
    this.upload = new XMLHttpRequestUpload();
    this._properties = {
      auth: '',
      client: null,
      lengthComputable: false,
      loaded: 0,
      method: 'get',
      responseHeaders: {},
      responseBuffers: [],
      responseText: new String(),
      responseType: '',
      requestHeaders: {},
      total: {},
      uri: '',
    };
  }

  get responseType() {
    const responseType = this._properties.responseType;
    if (XMLHttpRequestResponseType.indexOf(responseType) < 0) {
      return '';
    }
    return responseType;
  }

  set responseType(responseType) {
    if (XMLHttpRequestResponseType.indexOf(responseType) < 0) {
      throw new Error(''); // todo
    }
    this._properties.responseType = responseType;
    return responseType;
  }

  get response() {
    const _response = (() => {
      switch (this.responseType) {
        case '':
          return this.responseText;
        case 'arraybuffer':
        case 'blob':
          return (new Uint8Array(Buffer.concat(this._properties.responseBuffers))).buffer;
        case 'document':
          return null; // todo
        case 'json':
          return JSON.parse(this.responseText);
        case 'text':
          return this.responseText;
        default:
          return '';
      }
    })();
    if (!this[symbols.DISTURBED]) {
      this[symbols.DISTURBED] = true;
      const url = this._properties.uri;
      onResponse(url, _response, {responseType: this.responseType});
    }
    return _response;
  }

  get responseText() {
    return this._properties.responseText;
  }

  abort() {
    const client = this._properties.client;
    if (client && typeof client.abort === 'function') {
      client.abort();
    }
    this.dispatchEvent(new ProgressEvent('abort'));
    this.upload.dispatchEvent(new ProgressEvent('abort'));
  }

  getAllResponseHeaders() {
    const readyState = this.readyState;
    if ([XMLHttpRequest.UNSENT, XMLHttpRequest.OPENED].indexOf(readyState) >= 0) {
      throw new Error(''); // todo
    }
    const responseHeaders = this._properties.responseHeaders;
    return Object.keys(responseHeaders).map((key) => {
      const value = responseHeaders[key];
      return [key, value].join(': ');
    }).join('\n');
  }

  getResponseHeader(header) {
    const readyState = this.readyState;
    if ([XMLHttpRequest.UNSENT, XMLHttpRequest.OPENED].indexOf(readyState) >= 0) {
      throw new Error(''); // todo;
    }
    const key = header.toLowerCase();
    const value = this._properties.responseHeaders[key];
    return typeof value !== 'undefined' ? '' + value : null;
  }

  open(method, uri, async, user, password) {
    const argumentCount = arguments.length;
    if (argumentCount < 2) {
      throw new TypeError('Not enought arguments');
    }
    this._properties.method = method;
    this._properties.uri = uri;
    this._flag.synchronous = !!async;
    if (argumentCount >= 4) {
      this._properties.auth = [
        user || '',
        password || ''
      ].join(':');
    }
    _readyStateChange.call(this, XMLHttpRequest.OPENED);
  }

  overrideMimeType(/* mime */) {
    // todo
  }

  send(body) {
    const _properties = this._properties;
    if (this.readyState !== XMLHttpRequest.OPENED) {
      throw new Error(); // todo
    }
    const async = this._flag.synchronous;
    const client = utils.createClient(this._properties, async, (response) => {
      _setDispatchProgressEvents.call(this, response);
      _receiveResponse.call(this, response);
    });
    _properties.client = client;
    Object.keys(_properties.requestHeaders).forEach(function(key) {
      var value = _properties.requestHeaders[key];
      client.setHeader(key, value);
    });
    _readyStateChange.call(this, XMLHttpRequest.HEADERS_RECEIVED);
    if (typeof body === 'string') {
      client.on('socket', _setDispatchProgressEvents.bind(this.upload));
      client.end(body);
    } else if (body instanceof FormData) {
      client.on('socket', _setDispatchProgressEvents.bind(this.upload));
      body.pipe(client);
    } else {
      client.end();
    }
    client.on('error', err => {
      const errorEvent = new Event('error');
      errorEvent.error = err;
      this.dispatchEvent(errorEvent);
    });
  }

  setRequestHeader(header, value) {
    if (this.readyState === XMLHttpRequest.UNSENT) {
      throw new Error(''); // todo
    }
    if (FORBIDDEN_REQUEST_HEADERS_PATTERN.test(header)) {
      return;
    }
    this._properties.requestHeaders[header] = value;
  }
}

XMLHttpRequest.UNSENT = 0;
XMLHttpRequest.OPENED = 1;
XMLHttpRequest.HEADERS_RECEIVED = 2;
XMLHttpRequest.LOADING = 3;
XMLHttpRequest.DONE = 4;

XMLHttpRequest.prototype.UNSENT = 0;
XMLHttpRequest.prototype.OPENED = 1;
XMLHttpRequest.prototype.HEADERS_RECEIVED = 2;
XMLHttpRequest.prototype.LOADING = 3;
XMLHttpRequest.prototype.DONE = 4;

module.exports = XMLHttpRequest;
