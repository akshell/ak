// Copyright (c) 2009-2010, Anton Korenyushkin
// All rights reserved.

// Redistribution and use in source and binary forms, with or without
// modification, are permitted provided that the following conditions are met:
//     * Redistributions of source code must retain the above copyright
//       notice, this list of conditions and the following disclaimer.
//     * Redistributions in binary form must reproduce the above copyright
//       notice, this list of conditions and the following disclaimer in the
//       documentation and/or other materials provided with the distribution.
//     * Neither the name of the author nor the names of contributors may be
//       used to endorse or promote products derived from this software
//       without specific prior written permission.

// THIS SOFTWARE IS PROVIDED BY THE AUTHOR AND CONTRIBUTORS "AS IS" AND ANY
// EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
// WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
// DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE
// LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
// CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
// SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
// INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
// CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
// ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
// POSSIBILITY OF SUCH DAMAGE.

// This code is based on MochiKit.Base by Bob Ippolito http://mochikit.com/

var core = require('inner').core;
var base = require('base');


exports.bind = function (func, self) {
  if (typeof(func) == 'string')
    func = self[func];
  return function () {
    return func.apply(self, arguments);
  };
};


exports.partial = function (func/*, args... */) {
  var args = Array.slice(arguments, 1);
  return function () {
    Array.prototype.unshift.apply(arguments, args);
    return func.apply(this, arguments);
  };
};


exports.abstract = function () {
  throw core.NotImplementedError();
};


exports.sum = function (list, start/* = 0 */) {
  var result = arguments.length > 1 ? start : 0;
  for (var i = 0; i < list.length; ++i)
    result += list[i];
  return result;
};


exports.range = function (/* [start,] stop[, step] */) {
  var start = 0;
  var stop = 0;
  var step = 1;
  if (arguments.length == 1) {
    stop = arguments[0];
  } else if (arguments.length == 2) {
    start = arguments[0];
    stop = arguments[1];
  } else {
    start = arguments[0];
    stop = arguments[1];
    step = arguments[2];
  }
  if (step == 0)
    throw core.ValueError('range() step must not be 0');
  var result = [];
  for (var i = start; step > 0 ? i < stop : i > stop; i += step)
    result.push(i);
  return result;
};


exports.zip = function (/* lists... */) {
  if (arguments.length == 0)
    return [];
  var length = arguments[0].length;
  for (var i = 1; i < arguments.length; ++i)
    if (arguments[i].length < length)
      length = arguments[i].length;
  var result = [];
  for (var k = 0; k < length; ++k) {
    var item = [];
    for (var j = 0; j < arguments.length; ++j)
      item.push(arguments[j][k]);
    result.push(item);
  }
  return result;
};


exports.timeSince = function (date, now/* = new Date() */) {
  var chunks = [
    [60 * 24 * 365, 'year'],
    [60 * 24 * 30, 'month'],
    [60 * 24 * 7, 'week'],
    [60 * 24, 'day'],
    [60, 'hour'],
    [1, 'minute']
  ];
  now = now || new Date();
  var minutes = (now - date) / 60000;
  if (isNaN(minutes) || minutes <= 0)
    return '0 minutes';
  var count1;
  for (var i = 0; i < chunks.length; ++i) {
    count1 = Math.floor(minutes / chunks[i][0]);
    if (count1)
      break;
  }
  if (!count1)
    return '0 minutes';
  var result = count1 + ' ' + chunks[i][1];
  if (count1 != 1)
    result += 's';
  if (i + 1 < chunks.length) {
    var count2 = Math.floor((minutes - count1 * chunks[i][0]) /
                            chunks[i + 1][0]);
    if (count2) {
      result += ', ' + count2 + ' ' + chunks[i + 1][1];
      if (count2 != 1)
        result += 's';
    }
  }
  return result;
};


exports.timeUntil = function (date, now/* = new Date() */) {
  return exports.timeSince(now || new Date(), date);
};


exports.MemTextStream = Object.subclass(
  function () {
    this._strings = [];
  },
  {
    writable: true,
    readable: false,
    positionable: false,

    write: function (value) {
      this._strings.push(value + '');
    },

    get: function () {
      var result = this._strings.join('');
      this._strings = [result];
      return result;
    },

    reset: function () {
      this._strings = [];
    }
  });


exports.out = new exports.MemTextStream();


exports.dump = function (/* values... */) {
  exports.out.write('\n');
  for (var i = 0; i < arguments.length; ++i)
    exports.out.write(base.repr(arguments[i]) + '\n');
};


exports.Dict = Object.subclass(
  function () {
    this._table = {};
  },
  {
    clear: function () {
      this._table = {};
    },

    _getLoc: function (key) {
      var hash = core.hash(key);
      var array = this._table[hash];
      if (!array)
        return {hash: hash};
      for (var i = 0; i < array.length; ++i)
        if (array[i][0] === key)
          return {hash: hash, array: array, index: i};
      return {hash: hash, array: array};
    },

    set: function (key, value) {
      var loc = this._getLoc(key);
      if (!loc.array)
        this._table[loc.hash] = [[key, value]];
      else if (loc.index === undefined)
      loc.array.push([key, value]);
      else
        loc.array[loc.index][1] = value;
    },

    get: function (key, default_/* = undefined */) {
      var loc = this._getLoc(key);
      return loc.index === undefined ? default_ : loc.array[loc.index][1];
    },

    has: function (key) {
      return this._getLoc(key).index !== undefined;
    },

    setDefault: function (key, default_/* = undefined */) {
      var loc = this._getLoc(key);
      if (loc.index !== undefined)
        return loc.array[loc.index][1];
      if (loc.array)
        loc.array.push([key, default_]);
      else
        this._table[loc.hash] = [[key, default_]];
      return default_;
    },

    pop: function (key, default_/* = undefined */) {
      var loc = this._getLoc(key);
      if (loc.index === undefined)
        return default_;
      var result = loc.array[loc.index][1];
      if (loc.array.length == 1)
        delete this._table[loc.hash];
      else
        loc.array.splice(loc.index);
      return result;
    },

    popItem: function () {
      var hash;
      for (hash in this._table)
        break;
      if (hash === undefined)
        return undefined;
      var array = this._table[hash];
      var result = array[0];
      if (array.length == 1)
        delete this._table[hash];
      else
        array.shift();
      return result;
    },

    map: function (func, self/* = core.global */) {
      self = self || core.global;
      var result = [];
      for (var hash in this._table) {
        var array = this._table[hash];
        for (var i = 0; i < array.length; ++i)
          result.push(func.call(self, array[i][0], array[i][1]));
      }
      return result;
    },

    items: function () {
      return this.map(function (key, value) { return [key, value]; });
    },

    keys: function () {
      return this.map(function (key, value) { return key; });
    },

    values: function () {
      return this.map(function (key, value) { return value; });
    },

    __eq__: function (other) {
      if (!(other instanceof exports.Dict &&
            base.keys(this._table).length == base.keys(other._table).length))
        return false;
      for (var hash in this._table) {
        var thisArray = this._table[hash];
        var otherArray = other._table[hash];
        if (!otherArray || thisArray.length != otherArray.length)
          return false;
        for (var i = 0; i < thisArray.length; ++i) {
          for (var j = 0;; ++j) {
            if (j == otherArray.length)
              return false;
            if (otherArray[j][0] === thisArray[i][0]) {
              if (base.equal(otherArray[j][1], thisArray[i][1]))
                break;
              else
                return false;
            }
          }
        }
      }
      return true;
    },

    __repr__: function () {
      return ('{' +
              this.map(
                function (key, value) {
                  return base.repr(key) + ': ' + base.repr(value);
                }).join(', ') +
              '}');
    }
  });


exports.escapeHTML = function (string) {
  return (string
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/\"/g, '&quot;')
          .replace(/\'/g, '&#39;'));
};
