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

(function ()
{
  ak.include('core.js');

  ak.global = this;

  //////////////////////////////////////////////////////////////////////////////
  // Object functions and methods
  //////////////////////////////////////////////////////////////////////////////

  ak.update = function (self/*[, attrs], objects... */) {
    var attrs;
    var i;
    if (typeof(arguments[1]) == 'number') {
      attrs = arguments[1];
      i = 2;
    } else {
      attrs = ak.COMMON;
      i = 1;
    }
    for (; i < arguments.length; ++i) {
      var object = arguments[i];
      for (var key in object)
        ak.set(self, key, attrs, object[key]);
    }
    return self;
  };


  ak.items = function (object) {
    var result = [];
    for (var key in object)
      result.push([key, object[key]]);
    return result;
  };


  ak.keys = function (object) {
    var result = [];
    for (var key in object)
      result.push(key);
    return result;
  };


  ak.values = function (object) {
    var result = [];
    for (var key in object)
      result.push(object[key]);
    return result;
  };


  ak.update(
    Object.prototype, ak.HIDDEN,
    {
      set: function (name, attrs, value) {
        return ak.set(this, name, attrs, value);
      },

      setHidden: function (name, value) {
        return this.set(name, ak.HIDDEN, value);
      },

      instances: function (constructor) {
        this.__proto__ = constructor.prototype;
        return this;
      },

      update: function(/*[attrs,] objects... */) {
        Array.prototype.unshift.call(arguments, this);
        return ak.update.apply(ak.global, arguments);
      },

      items: function () {
        return ak.items(this);
      },

      keys: function () {
        return ak.keys(this);
      },

      values: function () {
        return ak.values(this);
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // Function methods
  //////////////////////////////////////////////////////////////////////////////

  Function.prototype.update(
    ak.HIDDEN,
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
        ak.set(this.prototype, 'constructor', ak.HIDDEN, this);
        this.__proto__ = func.__proto__;
        if ('__name__' in func)
          this.__name__ = func.__name__;
        return this;
      },

      subclass: function (/* [constructor] [, prototype] */) {
        var self = this;
        var constructor = (typeof(arguments[0]) == 'function'
                           ? Array.shift(arguments)
                           : (this === Object
                              ? function () {}
                              : function () { self.apply(this, arguments); }));
        if (arguments[0])
          constructor.prototype = arguments[0];
        ak.set(constructor.prototype, 'constructor', ak.HIDDEN, constructor);
        constructor.prototype.instances(this);
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

  //////////////////////////////////////////////////////////////////////////////
  // repr()
  //////////////////////////////////////////////////////////////////////////////

  ak.repr = function (value) {
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
       var keys = ak.keys(this);
       keys.sort();
       return ('{' +
               keys.map(function (key) {
                          return key + ': ' + ak.repr(this[key]);
                        },
                        this).join(', ') +
               '}');
     }],
    [Array, function () {
       return '[' + this.map(ak.repr).join(', ') + ']';
     }],
    [Date, function () {
       return this + '';
     }],
    [Function, function () {
       if (this.__name__)
         return '<function ' + this.__name__ + '>';
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
       return (this.name + '(' +
               (this.message ? ak.repr(this.message) : '') + ')');
     }],
    [RegExp, function () {
       return this + '';
     }]
  ].forEach(
    function (pair) {
      ak.set(pair[0].prototype, '__repr__', ak.HIDDEN, pair[1]);
    });

  //////////////////////////////////////////////////////////////////////////////
  // cmp() and equal()
  //////////////////////////////////////////////////////////////////////////////

  function removeWrapper(value) {
    if (typeof(value) != 'object')
      return value;
    if (value instanceof Number)
      return +value;
    if (value instanceof String)
      return value + '';
    if (value instanceof Boolean)
      return !!value;
    return value;
  }


  function doCmp(lhs, rhs) {
    if (typeof(lhs.__cmp__) == 'function')
      return lhs.__cmp__(rhs);
    if (typeof(rhs.__cmp__) == 'function')
      return -rhs.__cmp__(lhs);
    if (['boolean', 'string', 'number'].indexOf(typeof(lhs)) != -1 &&
        typeof(rhs) == typeof(lhs))
      return lhs < rhs ? -1 : 1;
    return undefined;
  }


  ak.cmp = function (lhs, rhs) {
    lhs = removeWrapper(lhs);
    rhs = removeWrapper(rhs);
    if (lhs === rhs)
      return 0;
    if (lhs !== null && lhs !== undefined &&
        rhs !== null && rhs !== undefined) {
      var c = doCmp(lhs, rhs);
      if (c !== undefined)
        return c;
    }
    throw TypeError(ak.repr(lhs) + ' and ' + ak.repr(rhs) +
                    ' can not be compared');
  };


  ak.equal = function (lhs, rhs) {
    lhs = removeWrapper(lhs);
    rhs = removeWrapper(rhs);
    if (lhs === rhs)
      return true;
    if (lhs !== null && lhs !== undefined &&
        rhs !== null && rhs !== undefined) {
      if (typeof(lhs.__eq__) == 'function')
        return lhs.__eq__(rhs);
      if (typeof(rhs.__eq__) == 'function')
        return rhs.__eq__(lhs);
      var c = doCmp(lhs, rhs);
      if (c !== undefined)
        return c == 0;
    }
    return false;
  };


  Array.prototype.update(
    ak.HIDDEN,
    {
      __cmp__: function (other) {
        var lenCmp = ak.cmp(this.length, other.length);
        var count = lenCmp == -1 ? this.length : other.length;
        for (var i = 0; i < count; ++i) {
          var itemCmp = ak.cmp(this[i], other[i]);
          if (itemCmp)
            return itemCmp;
        }
        return lenCmp;
      },

      __eq__: function (other) {
        if (this.length != other.length)
          return false;
        for (var i = 0; i < this.length; ++i)
          if (!ak.equal(this[i], other[i]))
            return false;
        return true;
      }
    });


  Date.prototype.setHidden(
    '__cmp__',
    function (other) {
      if (!(other instanceof Date))
        throw TypeError('Date object could be compared only to Date object');
      return ak.cmp(this.getTime(), other.getTime());
    });

  //////////////////////////////////////////////////////////////////////////////
  // Module
  //////////////////////////////////////////////////////////////////////////////

  ak.Module = function (name, version) {
    if (name)
      this.setHidden('__name__', name);
    if (version)
      this.setHidden('__version__', version);
  };


  ak.Module.prototype.update(
    ak.HIDDEN,
    {
      __repr__: function () {
        return ('<module ' + this.__name__ +
                (this.__version__ ? ' ' + this.__version__ : '') +
                '>');
      },

      toString: function () {
        return this.__repr__();
      }
    });


  (ak.AK.prototype.__proto__ =
   ak.DB.prototype.__proto__ =
   ak.FS.prototype.__proto__ = ak.Module.prototype);
  ak.__version__ = '0.1';
  ak.__name__ = 'ak';

  //////////////////////////////////////////////////////////////////////////////
  // Misc
  //////////////////////////////////////////////////////////////////////////////

  ak.ErrorMeta = Function.subclass(
    {
      subclass: function (/* arguments */) {
        var constructor = Function.prototype.subclass.apply(this, arguments);
        var result = function (message) {
          if (!(this instanceof arguments.callee))
            return ak.construct(arguments.callee, arguments);
          Error.captureStackTrace(this);
          if (arguments.length && !this.message)
            this.message = message + '';
          constructor.apply(this, arguments);
          return undefined;
        }.wraps(constructor);
        result.prototype.__defineGetter__(
          'name',
          function () {
            return this.constructor.__name__ || this.__proto__.name;
          });
        return result;
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
    ak.BaseError,
    ak.UsageError
  ].forEach(function (constructor) { constructor.instances(ak.ErrorMeta); });


  ak.NotImplementedError = ak.BaseError.subclass();
  ak.ValueError = ak.BaseError.subclass();
  

  [
    'concat',
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
    'toString',
    'unshift'
  ].forEach(
    function (name) {
      var func = Array.prototype[name];
      Array.setHidden(
        name,
        function (self/*, args... */) {
          var args = Array.prototype.slice.call(arguments, 1);
          return func.apply(self, args);
        });
    });


  String.prototype.update(
    ak.HIDDEN,
    {
      startsWith: function (prefix) {
        return this.substr(0, prefix.length) == prefix;
      },

      endsWith: function(suffix) {
        return this.substr(this.length - suffix.length) == suffix;
      }
    });


  var specialsRegExp = new RegExp('[.*+?|()\\[\\]{}\\\\]', 'g');

  RegExp.escape = function (string) {
    return string.replace(specialsRegExp, '\\$&');
  };

  //////////////////////////////////////////////////////////////////////////////
  // ak.operators
  //////////////////////////////////////////////////////////////////////////////

  ak.operators = new ak.Module();

  ak.operators.update(
    {
      truth: function (a) { return !!a; },
      not: function (a) { return !a; },
      identity: function (a) { return a; },

      bitnot: function (a) { return ~a; },
      neg: function (a) { return -a; },

      add: function (a, b) { return a + b; },
      sub: function (a, b) { return a - b; },
      div: function (a, b) { return a / b; },
      mod: function (a, b) { return a % b; },
      mul: function (a, b) { return a * b; },

      bitand: function (a, b) { return a & b; },
      bitor: function (a, b) { return a | b; },
      xor: function (a, b) { return a ^ b; },
      lshift: function (a, b) { return a << b; },
      rshift: function (a, b) { return a >> b; },
      zrshift: function (a, b) { return a >>> b; },

      eq: function (a, b) { return a == b; },
      ne: function (a, b) { return a != b; },
      gt: function (a, b) { return a > b; },
      ge: function (a, b) { return a >= b; },
      lt: function (a, b) { return a < b; },
      le: function (a, b) { return a <= b; },

      seq: function (a, b) { return a === b; },
      sne: function (a, b) { return a !== b; },

      ceq: function (a, b) { return ak.cmp(a, b) === 0; },
      cne: function (a, b) { return ak.cmp(a, b) !== 0; },
      cgt: function (a, b) { return ak.cmp(a, b) == 1; },
      cge: function (a, b) { return ak.cmp(a, b) != -1; },
      clt: function (a, b) { return ak.cmp(a, b) == -1; },
      cle: function (a, b) { return ak.cmp(a, b) != 1; },

      and: function (a, b) { return a && b; },
      or: function (a, b) { return a || b; },
      contains: function (a, b) { return b in a; }
    });

})();
