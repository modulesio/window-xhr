/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2013-2016 Yamagishi Kazutoshi
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT.  IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
 * THE SOFTWARE.
 */

'use strict';

const { http, https } = require('window-follow-redirects');
const url = require('url');
const stream = require('stream');

const utils = {};
const defaultOptions = {
  agent: http.globalAgent,
  auth: '',
  host: 'localhost',
  method: 'GET',
  path: '/',
  port: '',
  protocol: 'http:'
};

function optionsParse(options) {
  const newOptions = {};
  const parsedUriObj = url.parse(options.uri || '', false, true);
  for (const key in defaultOptions) {
    if (defaultOptions.hasOwnProperty(key)) {
      const value = parsedUriObj[key];
      newOptions[key] = value || defaultOptions[key];
    }
  }
  if (typeof options.method !== 'undefined') {
    newOptions.method = options.method;
  }
  if (newOptions.protocol === 'http:') {
    if (!newOptions.port) {
      newOptions.port = 80 + '';
    }
  } else if (newOptions.protocol === 'https:') {
    newOptions.agent = https.globalAgent;
    if (!newOptions.port) {
      newOptions.port = 443 + '';
    }
  }
  if (typeof parsedUriObj.hostname !== 'undefined') {
    newOptions.host = parsedUriObj.hostname;
  }
  return newOptions;
}
function createClient(options, callback) {
  const match = options.uri.match(/^data:(.+?)(;base64)?,/);
  if (match) {
    const all = match[0];
    const type = match[1];
    const isBase64 = Boolean(match[2]);
    const dataString = options.uri.slice(all.length);
    const dataBuffer = Buffer.from(dataString, isBase64 ? 'base64' : 'utf8');

    const req = new stream.PassThrough();
    req.resume();
    req.once('end', () => {
      const res = new stream.PassThrough();
      res.end(dataBuffer);
      res.headers = {
        'content-type': type,
        'content-length': dataBuffer.length + ''
      };
      callback(res);
    });
    return req;
  } else {
    options = optionsParse(options || {});
    return (options.protocol === 'https:' ? https : http).request(options, callback);
  }
}
utils.createClient = createClient;

module.exports = utils;
