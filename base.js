// Copyright (c) 2009-2011, Anton Korenyushkin
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

var core = require('core');
var db = require('db');
var fs = require('fs');
var Binary = require('binary').Binary;

////////////////////////////////////////////////////////////////////////////////
// The global object
////////////////////////////////////////////////////////////////////////////////

exports.global = this;

////////////////////////////////////////////////////////////////////////////////
// Object functions and methods
////////////////////////////////////////////////////////////////////////////////

exports.update = function (self/*[, attrs], objects... */) {
  var attrs;
  var i;
  if (typeof(arguments[1]) == 'number') {
    attrs = arguments[1];
    i = 2;
  } else {
    attrs = core.COMMON;
    i = 1;
  }
  for (; i < arguments.length; ++i) {
    var object = arguments[i];
    for (var key in object)
      core.set(self, key, attrs, object[key]);
  }
  return self;
};


exports.items = function (object) {
  var result = [];
  for (var key in object)
    result.push([key, object[key]]);
  return result;
};


exports.keys = function (object) {
  var result = [];
  for (var key in object)
    result.push(key);
  return result;
};


exports.values = function (object) {
  var result = [];
  for (var key in object)
    result.push(object[key]);
  return result;
};

////////////////////////////////////////////////////////////////////////////////
// Function methods
////////////////////////////////////////////////////////////////////////////////

exports.update(
  Function.prototype, core.HIDDEN,
  {
    decorated: function (/* decorators... */) {
      var result = this;
      for (var i = arguments.length - 1; i >= 0; --i) {
        var decorator = arguments[i];
        result = decorator(result);
      }
      return result;
    },

    wraps: function (func) {
      this.prototype = func.prototype;
      core.set(this.prototype, 'constructor', core.HIDDEN, this);
      this.__proto__ = func.__proto__;
      return this;
    },

    subclass: function (/* [constructor] [, prototype] */) {
      var self = this;
      var constructor = (typeof(arguments[0]) == 'function'
                         ? Array.prototype.shift.call(arguments)
                         : (this === Object
                            ? function () {}
                            : function () { self.apply(this, arguments); }));
      if (arguments[0])
        constructor.prototype = arguments[0];
      core.set(constructor.prototype, 'constructor', core.HIDDEN, constructor);
      constructor.prototype.__proto__ = this.prototype;
      constructor.__proto__ = this.__proto__;
      return constructor;
    },

    subclassOf: function (base) {
      for (var prototype = this.prototype;
           prototype;
           prototype = prototype.__proto__)
        if (prototype === base.prototype)
          return true;
      return false;
    }
  });

////////////////////////////////////////////////////////////////////////////////
// Errors
////////////////////////////////////////////////////////////////////////////////

var ErrorMeta = Function.subclass(
  {
    subclass: function () {
      var constructor = Function.prototype.subclass.apply(this, arguments);
      return function () {
        if (!(this instanceof arguments.callee))
          return core.construct(arguments.callee, Array.slice(arguments));
        Error.captureStackTrace(this);
        constructor.apply(this, arguments);
        if (arguments.length && !this.message)
          this.message = arguments[0] + '';
        return undefined;
      }.wraps(constructor);
    }
  });


[
  Error,
  EvalError,
  RangeError,
  ReferenceError,
  SyntaxError,
  TypeError,
  URIError,
  core.RequireError,
  core.ValueError,
  core.NotImplementedError,
  core.QuotaError,
  db.DBError,
  fs.FSError
].forEach(
  function (constructor) {
    constructor.__proto__ = ErrorMeta.prototype;
  });

////////////////////////////////////////////////////////////////////////////////
// repr()
////////////////////////////////////////////////////////////////////////////////

exports.repr = function (value) {
  if (value === undefined)
    return 'undefined';
  if (value === null)
    return 'null';
  if (typeof(value.__repr__) == 'function')
    return value.__repr__();
  return value + '';
};


[
  [Object, function () {
     var parts = [];
     for (var key in this)
       parts.push(key + ': ' + exports.repr(this[key]));
     return '{' + parts.join(', ') + '}';
   }],
  [Array, function () {
     return '[' + this.map(exports.repr).join(', ') + ']';
   }],
  [Date, function () {
     return this.toUTCString();
   }],
  [Function, function () {
     var string = this + '';
     string = string.replace(/^\s+/, '').replace(/\s+/g, ' ');
     string = string.replace(/,(\S)/, ', $1');
     var idx = string.indexOf('{');
     if (idx != -1)
       string = string.substr(0, idx) + '{...}';
     return string;
   }],
  [String, function () {
     return (('"' + this.replace(/([\"\\])/g, '\\$1') + '"')
             .replace(/[\f]/g, '\\f')
             .replace(/[\b]/g, '\\b')
             .replace(/[\n]/g, '\\n')
             .replace(/[\t]/g, '\\t')
             .replace(/[\v]/g, '\\v')
             .replace(/[\r]/g, '\\r'));
   }],
  [Number, function () {
     return this + '';
   }],
  [Boolean, function () {
     return this + '';
   }],
  [Error, function () {
     return this + '';
   }],
  [RegExp, function () {
     return this + '';
   }]
].forEach(
  function (pair) {
    core.set(pair[0].prototype, '__repr__', core.HIDDEN, pair[1]);
  });

////////////////////////////////////////////////////////////////////////////////
// cmp() and equal()
////////////////////////////////////////////////////////////////////////////////

exports.CmpError = Error.subclass(
  function (lhs, rhs) {
    this.message = (
      exports.repr(lhs) + ' and ' + exports.repr(rhs) + ' are incomparable');
  },
  {name: 'CmpError'});


function hasMethod(value, name) {
  return (value !== undefined && value !== null &&
          typeof(value[name]) == 'function');
}


exports.cmp = function (lhs, rhs) {
  if (lhs === rhs)
    return 0;
  if (hasMethod(lhs, '__cmp__'))
    return lhs.__cmp__(rhs);
  if (hasMethod(rhs, '__cmp__'))
    return -rhs.__cmp__(lhs);
  throw exports.CmpError(lhs, rhs);
};


exports.equal = function (lhs, rhs) {
  if (lhs === rhs)
    return true;
  if (hasMethod(lhs, '__eq__'))
    return lhs.__eq__(rhs);
  if (hasMethod(rhs, '__eq__'))
    return rhs.__eq__(lhs);
  try {
    return exports.cmp(lhs, rhs) == 0;
  } catch (error) {
    if (!(error instanceof exports.CmpError)) throw error;
    return false;
  }
};


[
  ['number', Number],
  ['string', String],
  ['boolean', Boolean]
].forEach(
  function (pair) {
    exports.update(
      pair[1].prototype, core.HIDDEN,
      {
        __cmp__: function (other) {
          if (!(typeof(other) == pair[0] || other instanceof pair[1]))
            throw exports.CmpError(this, other);
          return (this == other
                  ? 0
                  : this < other ? -1 : 1);
        },

        __eq__: function (other) {
          return ((typeof(other) == pair[0] || other instanceof pair[1]) &&
                  this == other);
        }
      });
  });


exports.update(
  Array.prototype, core.HIDDEN,
  {
    __cmp__: function (other) {
      if (!(other instanceof Array))
        throw exports.CmpError(this, other);
      var lenCmp = exports.cmp(this.length, other.length);
      var count = lenCmp == -1 ? this.length : other.length;
      for (var i = 0; i < count; ++i) {
        var itemCmp = exports.cmp(this[i], other[i]);
        if (itemCmp)
          return itemCmp;
      }
      return lenCmp;
    },

    __eq__: function (other) {
      if (!(other instanceof Array && this.length == other.length))
        return false;
      for (var i = 0; i < this.length; ++i)
        if (!exports.equal(this[i], other[i]))
          return false;
      return true;
    }
  });


core.set(
  Date.prototype, '__cmp__', core.HIDDEN,
  function (other) {
    if (!(other instanceof Date))
      throw exports.CmpError(this, other);
    return exports.cmp(this.getTime(), other.getTime());
  });


exports.update(
  Binary.prototype, core.HIDDEN,
  {
    __cmp__: function (other) {
      if (!(other instanceof Binary))
        throw exports.CmpError(this, other);
      return this.compare(other);
    },

    __eq__: function (other) {
      return (other instanceof Binary &&
              this.length == other.length &&
              this.compare(other) == 0);
    }
  });

////////////////////////////////////////////////////////////////////////////////
// Debug tools
////////////////////////////////////////////////////////////////////////////////

exports.AssertionError = Error.subclass({name: 'AssertionError'});


function prefix(message) {
  return message ? message + ': ' : '';
}


exports.assert = function (value, /* optional */message) {
  if (!value)
    throw exports.AssertionError(
      'Assertion failed' + (message ? ': ' + message : ''));
};


exports.assertEqual = function (lhs, rhs, /* optional */message) {
  if (!exports.equal(lhs, rhs))
    throw exports.AssertionError(
      prefix(message) + exports.repr(lhs) + ' <> ' + exports.repr(rhs));
};


exports.assertSame = function (lhs, rhs, /* optional */message) {
  if (lhs !== rhs)
    throw exports.AssertionError(
      prefix(message) + exports.repr(lhs) + ' !== ' + exports.repr(rhs));
};


exports.assertThrow = function (errorClass, func/* args... */) {
  try {
    func.apply(exports.global, Array.slice(arguments, 2));
  } catch (error) {
    if (typeof(error) != 'object')
      error = Object(error);
    if (!(error instanceof errorClass)) {
      throw exports.AssertionError(
        'Expected ' + errorClass.name + ' exception, got ' + error);
    }
    return;
  }
  throw exports.AssertionError('Exception was not thrown');
};

////////////////////////////////////////////////////////////////////////////////
// Array functions
////////////////////////////////////////////////////////////////////////////////

[
  'every',
  'filter',
  'indexOf',
  'forEach',
  'join',
  'lastIndexOf',
  'map',
  'pop',
  'push',
  'reverse',
  'shift',
  'slice',
  'some',
  'sort',
  'splice',
  'unshift'
].forEach(
  function (name) {
    var func = Array.prototype[name];
    core.set(
      Array, name, core.HIDDEN,
      function (self/*, args... */) {
        var args = Array.prototype.slice.call(arguments, 1);
        return func.apply(self, args);
      });
  });

////////////////////////////////////////////////////////////////////////////////
// String methods
////////////////////////////////////////////////////////////////////////////////

exports.update(
  String.prototype, core.HIDDEN,
  {
    startsWith: function (prefix) {
      return this.substr(0, prefix.length) == prefix;
    },

    endsWith: function(suffix) {
      return this.substr(this.length - suffix.length) == suffix;
    }
  });

////////////////////////////////////////////////////////////////////////////////
// RegExp Escaping
////////////////////////////////////////////////////////////////////////////////

var specialsRegExp = new RegExp('[.*+?|()\\[\\]{}\\\\]', 'g');

RegExp.escape = function (string) {
  return string.replace(specialsRegExp, '\\$&');
};
