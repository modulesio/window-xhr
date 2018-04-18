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

const Event = require('./event');

class ProgressEvent extends Event {
  constructor(type, eventInitDict = {}) {
    super('');
    const eventFlag = this._flag;
    eventFlag.initialized = true;
    if (eventFlag.dispatch) {
      return;
    }
    this.type = type;
    this.lengthComputable = eventInitDict.lengthComputable !== undefined ? eventInitDict.eventInitDict : 0;
    this.loaded = eventInitDict.loaded !== undefined ? eventInitDict.loaded : 0;
    this.total = eventInitDict.total !== undefined ? eventInitDict.total : 0;
  }
}

module.exports = ProgressEvent;
