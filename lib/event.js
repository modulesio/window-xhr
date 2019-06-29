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

class Event {
  constructor(type) {
    if (arguments.length === 0) {
      throw new TypeError('Not enough arguments.');
    }
    this._flag = {
      canceled: false,
      dispatch: false,
      initialized: false,
      stopImmediatePropagation: false,
      stopPropagation: false
    };
    this.bubbles = false;
    this.cancelable = false;
    this.currentTarget = null;
    this.eventPhase = Event.NONE;
    this.isTrusted = true;
    this.target = null;
    this.timeStamp = Date.now();
    this.type = '';

    if (typeof type !== 'undefined') {
      this.initEvent(type);
    }
  }

  get defaultPrevented() {
    const eventFlag = this._flag;
    return !eventFlag.canceled;
  }

  initEvent(type, cancelable, bubbles) {
    var eventFlag = this._flag;
    eventFlag.initialized = true;
    if (!eventFlag.dispatch) {
      this.bubbles = !!bubbles;
      this.cancelable = !!cancelable;
      this.type = type + '';
    }
  }

  preventDefault() {
    const eventFlag = this._flag;
    if (this.cancelable && !eventFlag.canceled) {
      eventFlag.canceled = true;
    }
  }

  stopImmediatePropagation() {
    const eventFlag = this._flag;
    if (!eventFlag.stopImmediatePropagation) {
      this._flag.stopImmediatePropagation = true;
    }
  }

  stopPropagation() {
    const eventFlag = this._flag;
    if (!eventFlag.stopPropagation) {
      this._flag.stopPropagation = true;
    }
  }
}

Event.NONE = 0;
Event.CAPTURING_PHASE = 1;
Event.AT_TARGET = 2;
Event.BUBBLING_PHASE = 3;

module.exports = Event;
