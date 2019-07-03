/**
 * The MIT License (MIT)
 *
 * Copyright (c) 2012-2016 Yamagishi Kazutoshi
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

const DOMException = require('./domexception');
const Event = require('./event');

const _globalListenerList = [];
const _globalTargetList = [];

function _prepareListener(listener) {
  if (typeof listener !== 'function') {
    const object = listener;
    const handleEvent = object.handleEvent;
    if (typeof handleEvent === 'function') {
      listener = function() {
        handleEvent.apply(object, arguments);
      };
    }
  }
  return listener;
}

function _getEventListeners(type) {
  var target = this;
  var listenerList = _globalListenerList;
  var targetList = _globalTargetList;
  var index = targetList.lastIndexOf(target);
  var eachTypeListeners = listenerList[index] || {};
  var listeners = eachTypeListeners[type] || [];
  return listeners;
}

function _addEventListener(type, listener/* , capture */) {
  listener = _prepareListener(listener);
  if (typeof listener !== 'function') {
    return;
  }
  const listeners = _getEventListeners.call(this, type);
  if (listeners.length === 0) {
    let index = _globalTargetList.indexOf(this);
    if (index < 0) {
      index = _globalTargetList.push(this) - 1;
    }
    _globalListenerList[index] = _globalListenerList[index] || {};
    _globalListenerList[index][type] = listeners;
  }
  listeners.push(listener);
}

function _bubbling(event) {
  // todo: Reverse the order of event path.
  event.eventPhase = Event.BUBBLING_PHASE;
  // todo: For each object in the event path invoke its event listeners,
  // with event event as long as event's stop propagation flag is unset.
}

function _invoke(event) {
  var args = Array.prototype.slice.call(arguments);
  var target = event.target;
  var type = event.type;
  var listeners = _getEventListeners.call(target, type);
  return listeners.some(function handleListener(listener) {
    if (!event.cancelable) {
      return listener.apply(target, args);
    }
    return event.defaultPrevented || listener.apply(target, args) === false;
  });
}

function _dispatch(event) {
  const eventFlag = event._flag;
  eventFlag.dispatch = true;
  event.target = this;
  // todo: If event's target attribute value is participating in a tree, let
  // event path be a static ordered list of all its ancestors in tree order,
  // or let event path be the empty list otherwise.
  event.eventPhase = Event.CAPTURING_PHASE;
  // todo: For each object in the event path invoke its event listeners with
  // event event, as long as event's stop propagation flag is unset.
  event.eventPhase = Event.AT_TARGET;
  if (!eventFlag.stopPropagation) {
    _invoke.apply(this, arguments);
  }
  if (event.bubbles) {
    _bubbling.apply(this, arguments);
  }
  eventFlag.dispatch = false;
  event.eventPhase = Event.NONE;
  event.currentTarget = null;
  return !eventFlag.canceled;
}

function _removeEventListener(type, listener/* , capture */) {
  var listeners = _getEventListeners.call(this, type);
  var index = listeners.lastIndexOf(listener);
  if (index < 0) {
    return;
  }
  listeners.splice(index, 1);
}

class EventTarget {
  constructor() {
    if (!(this instanceof EventTarget)) {
      throw new TypeError(
        'DOM object constructor cannot be called as a function.');
    }

    this.addEventListener = this.addEventListener;
    this.dispatchEvent = this.dispatchEvent;
    this.removeEventListener = this.removeEventListener;
  }

  addEventListener(type, listener/* , capture */) {
    if (listener !== null && typeof listener !== 'undefined') {
      return _addEventListener.apply(this, arguments);
    }
  }

  dispatchEvent(event) {
    const eventFlag = event instanceof Event && event._flag;
    if (!eventFlag || eventFlag.dispatch || !eventFlag.initialized) {
      const error = new DOMException(
        'Failed to execute \'dispatchEvent\' on \'EventTarget\': ' +
        'The event provided is null.');
      error.code = DOMException.INVALID_STATE_ERROR;
      throw error;
    }
    return _dispatch.apply(this, arguments);
  }

  removeEventListener(/* type, listener, capture */) {
    return _removeEventListener.apply(this, arguments);
  }
}

module.exports = EventTarget;
