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

let fetch = require('window-fetch');
const http = require('http');

const Event = require('./event');
const FormData = require('window-form-data');
const ProgressEvent = require('./progressevent');
const XMLHttpRequestEventTarget = require('./xmlhttprequesteventtarget');
const XMLHttpRequestUpload = require('./xmlhttprequestupload');


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
const FORBIDDEN_REQUEST_HEADERS_PATTERN = new RegExp(`^(${FORBIDDEN_REQUEST_HEADERS.join('|')})$`);

const XMLHttpRequestResponseType = [
  '',
  'arraybuffer',
  'blob',
  'document',
  'json',
  'text'
];

function _readyStateChange(readyState) {
  const readyStateChangeEvent = new Event('');
  readyStateChangeEvent.initEvent('readystatechange', false, false);
  this.readyState = readyState;
  this.dispatchEvent(readyStateChangeEvent);
}

function _receiveResponse(response) {
  const _properties = this._properties;
  const statusCode = response.status;
  this.status = statusCode;
  this.statusText = HTTP_STATUS_CODES[statusCode];
  const headers = {};
  for (let key of response.headers.keys()) {
    headers[key] = response.headers.get(key);
  }
  _properties.responseHeaders = headers;
  const contentLength = headers['content-length'] || '0';
  const bufferLength = parseInt(contentLength, 10);
  if (bufferLength !== 0) {
    _properties.lengthComputable = true;
    _properties.loaded = 0;
    _properties.total = bufferLength;
  }
  _properties.responseBuffers = [];
  _properties.responseText = '';
  _readyStateChange.call(this, XMLHttpRequest.LOADING);
  const textResponseType = !['arraybuffer', 'blob'].includes(_properties.responseType);

  _readyStateChange.call(this, XMLHttpRequest.HEADERS_RECEIVED);

  const isStream = (typeof response.body.pipe) === 'function';

  if (!isStream) {
    if (this.readyState !== XMLHttpRequest.LOADING) {
      _readyStateChange.call(this, XMLHttpRequest.LOADING);
    }
    return response.arraybuffer().then((data) => {
      if (textResponseType) {
        _properties.responseText = data.toString('utf8');
      } else {
        _properties.responseBuffers.push(Buffer.from(data));
      }
      _readyStateChange.call(this, XMLHttpRequest.DONE);
    });
  }

  return new Promise((resolve, reject) => {
    const stream = response.body;
    if (textResponseType) {
      stream.setEncoding('utf8');
    }
    stream.addListener('data', chunk => {
      if (!textResponseType) {
        _properties.responseBuffers.push(chunk);
      } else {
        _properties.responseText = _properties.responseText + chunk;
      }
      this.loaded += chunk.length;
      if (this.readyState !== XMLHttpRequest.LOADING) {
        _readyStateChange.call(this, XMLHttpRequest.LOADING);
      }
    });

    stream.addListener('error', (err) => {
      reject(err);
    });

    stream.addListener('end', () => {
      _readyStateChange.call(this, XMLHttpRequest.DONE);
      _properties.client = null;
      resolve();
    });

    _setDispatchProgressEvents.call(this, stream);
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

    setTimeout(() => {
      _properties.responseBuffers = null;
      _properties.responseText = '';
    });
  });
}

class XMLHttpRequest extends XMLHttpRequestEventTarget {
  constructor(options) {
    super();
    options = options || {};

    this._flag = {
      anonymous: !!options.anon,
      // synchronous: false,
      uploadComplete: false,
      uploadEvents: false
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
      responseText: '',
      responseType: '',
      requestHeaders: {
        'X-Requested-With': 'XMLHttpRequest'
      },
      total: {},
      uri: ''
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
    switch (this.responseType) {
      case '':
        return this.responseText;
      case 'arraybuffer':
        return (new Uint8Array(Buffer.concat(this._properties.responseBuffers))).buffer;
      case 'blob':
        return this._properties.responseBuffers;
      case 'document':
        return null; // todo
      case 'json':
        return JSON.parse(this.responseText);
      case 'text':
        return this.responseText;
      default:
        return '';
    }
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

  open(method = 'GET', uri = '', async = true, user, password) {
    if (!uri) {
      throw new TypeError('XMLHttpRequest with no url');
    }
    if (!async) {
      throw new Error('XMLHttpRequest synchronous not supported');
    }
    this._properties.method = method;
    this._properties.uri = uri;
    // this._flag.synchronous = !!async;
    if (typeof user === 'string') {
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
    const {uri, method, headers} = _properties;

      // Convert body to something fetch can consume
    const toSendBody = body;
    if (body instanceof FormData) {
      toSendBody = {};
      for (let key of body.keys()) {
        const value = body.get(key);
        toSendBody[key] = value;
      }
    }

    fetch(uri, {
      method,
      headers,
      body: toSendBody
    }).then((response) => {
      return _receiveResponse.call(this, response);
    }).catch((err) => {
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

XMLHttpRequest.setFetchImplementation = (impl) => fetch = impl;

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
