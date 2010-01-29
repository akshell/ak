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

  //////////////////////////////////////////////////////////////////////////////
  // Object methods
  //////////////////////////////////////////////////////////////////////////////

  ak.setObjectProp(
    Object.prototype, 'setProp', ak.DONT_ENUM,
    function (name, attrs, value) {
      return ak.setObjectProp(this, name, attrs, value);
    });


  Object.prototype.setProp(
    'setNonEnumerable', ak.DONT_ENUM,
    function (name, value) {
      this.setProp(name, ak.DONT_ENUM, value);
    });


  Object.prototype.setNonEnumerable(
    'instances',
    function (constructor) {
      this.__proto__ = constructor.prototype;
      return this;
    });

  //////////////////////////////////////////////////////////////////////////////
  // Free functions
  //////////////////////////////////////////////////////////////////////////////

  ak.updateWithMode = function (self, mode, obj/*, ...  */) {
    for (var i = 2; i < arguments.length; ++i) {
      var o = arguments[i];
      for (var key in o)
        ak.setObjectProp(self, key, mode, o[key]);
    }
    return self;
  };


  ak.global = this;


  ak.Module = function (name, version) {
    this.setNonEnumerable('__name__', name);
    if (version)
      this.setNonEnumerable('__version__', version);
  };


  ak.updateWithMode(
    ak.Module.prototype, ak.DONT_ENUM,
    {
      __repr__: function () {
        return ('<' + this.__name__ +
                (this.__version__ ? ' ' + this.__version__ : '') +
                ' module>');
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
  ak.db.__name__ = 'ak.db';
  ak.fs.__name__ = 'ak.fs';


  ak.update = function (self, obj/*, ... */) {
    Array.prototype.splice.call(arguments, 0, 1, self, ak.NONE);
    return ak.updateWithMode.apply(this, arguments);
  };


  ak.updateTree = function (self, obj/*, ...*/) {
    for (var i = 1; i < arguments.length; ++i) {
      var o = arguments[i];
      for (var key in o) {
        var value = o[key];
        if (typeof(self[key]) == 'object' &&
            typeof(value) == 'object')
          arguments.callee(self[key], value);
        else
          self[key] = value;
      }
    }
    return self;
  };


  ak.clone = function (obj) {
    return {__proto__: obj};
  };


  ak.repr = function (x) {
    if (x === undefined)
      return 'undefined';
    if (x === null)
      return 'null';
    if (typeof(x.__repr__) == 'function')
      return x.__repr__();
    return x + '';
  };


  ak.items = function (obj) {
    var result = [];
    for (var key in obj)
      result.push([key, obj[key]]);
    return result;
  };


  function removeWrapper(x) {
    if (typeof(x) != 'object')
      return x;
    if (x instanceof Number)
      return +x;
    if (x instanceof String)
      return x + '';
    if (x instanceof Boolean)
      return !!x;
    return x;
  }


  function doCmp(a, b) {
    if (typeof(a.__cmp__) == 'function')
      return a.__cmp__(b);
    if (typeof(b.__cmp__) == 'function')
      return -b.__cmp__(a);
    if (typeof(a) in  {'boolean': 1, 'string': 1, 'number': 1} &&
        typeof(b) == typeof(a))
      return a < b ? -1 : 1;
    return undefined;
  }


  ak.cmp = function (a, b) {
    a = removeWrapper(a);
    b = removeWrapper(b);
    if (a === b)
      return 0;
    if (a !== null && a !== undefined && b !== null && b !== undefined) {
      var c = doCmp(a, b);
      if (c !== undefined)
        return c;
    }
    throw TypeError(ak.repr(a) + ' and ' + ak.repr(b) +
                    ' can not be compared');
  };


  ak.equal = function (a, b) {
    a = removeWrapper(a);
    b = removeWrapper(b);
    if (a === b)
      return true;
    if (a !== null && a !== undefined && b !== null && b !== undefined) {
      if (typeof(a.__eq__) == 'function')
        return a.__eq__(b);
      if (typeof(b.__eq__) == 'function')
        return b.__eq__(a);
      var c = doCmp(a, b);
      if (c !== undefined)
        return c == 0;
    }
    throw TypeError(ak.repr(a) + ' and ' + ak.repr(b) +
                    ' can not be compared for equality');
  };


  ak.setDefault = function (self, obj/*, ...*/) {
    for (var i = 1; i < arguments.length; ++i) {
      var o = arguments[i];
      for (var key in o)
        if (!(key in self))
          self[key] = o[key];
    }
    return self;
  };


  ak.keys = function (obj) {
    var result = [];
    for (var key in obj)
      result.push(key);
    return result;
  };


  ak.values = function (obj) {
    var result = [];
    for (var key in obj)
      result.push(obj[key]);
    return result;
  };


  ak.operators = {
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
  };


  ak.indicators = {
    null_: function (a) {
      return a === null;
    },

    undefined_: function (a) {
      return a === undefined;
    },

    undefinedOrNull: function (a) {
      return a === null || a === undefined;
    },

    empty: function (a) {
      return !a.length;
    },

    arrayLike: function (a) {
      return typeof(a) == 'object' && 'length' in a;
    }
  };


  ak.compose = function (f1, f2/*, f3, ... fN */) {
    var funcs = Array.slice(arguments);
    return function () {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; --i)
        args = [funcs[i].apply(this, args)];
      return args[0];
    };
  };


  ak.bind = function (func, self) {
    return function () {
      return func.apply(self, arguments);
    };
  };


  ak.partial = function (func/*, args... */) {
    var args = Array.slice(arguments, 1);
    return function () {
      Array.prototype.unshift.apply(arguments, args);
      return func.apply(this, arguments);
    };
  };


  ak.method = function (func) {
    return function (self/*, args... */) {
      Array.unshift(arguments, this);
      return func.apply(this, arguments);
    };
  };


  ak.factory = function (constructor) {
    return function () {
      return ak.construct(constructor, arguments);
    };
  };


  ak.nameFunctions = function (ns) {
    var prefix = ns.__name__ ? ns.__name__ + '.' : '';
    for (var key in ns) {
      var x = ns[key];
      if (typeof(x) == 'function' && !('__name__' in x)) {
        x.setNonEnumerable('__name__', prefix + key);
        arguments.callee(x);
      }
    }
  };

  //////////////////////////////////////////////////////////////////////////////
  // Function methods
  //////////////////////////////////////////////////////////////////////////////

  ak.updateWithMode(
    Function.prototype, ak.DONT_ENUM,
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
        this.prototype.setNonEnumerable('constructor', this);
        this.__proto__ = func.__proto__;
        if ('__name__' in func)
          this.__name__ = func.__name__;
        return this;
      },

      subclass: function (/* [constructor,] prototype */) {
        var self = this;
        var constructor = (typeof(arguments[0]) == 'function'
                           ? Array.shift(arguments)
                           : (this === Object
                              ? function () {}
                              : function () { self.apply(this, arguments); }));
        if (arguments[0])
          constructor.prototype = arguments[0];
        constructor.prototype.setNonEnumerable('constructor', constructor);
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
  // Error definitions
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


  ak.abstract = function () {
    throw ak.NotImplementedError();
  };

  //////////////////////////////////////////////////////////////////////////////
  // Array methods
  //////////////////////////////////////////////////////////////////////////////

  function flattenArray(result, lst) {
    for (var i = 0; i < lst.length; ++i) {
      var item = lst[i];
      if (item instanceof Array)
        arguments.callee(result, item);
      else
        result.push(item);
    }
    return result;
  }


  ak.updateWithMode(
    Array.prototype, ak.DONT_ENUM,
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
      },

      flatten: function () {
        return flattenArray([], this);
      },

      index: function (value, start/* = 0 */) {
        for (var i = start || 0; i < this.length; ++i)
          if (ak.equal(this[i], value))
            return i;
        return -1;
      }
    });


  [
    'concat',
    'every',
    'filter',
    'flatten',
    'index',
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
      Array.setNonEnumerable(
        name,
        function (self/*, args... */) {
          var args = Array.prototype.slice.call(arguments, 1);
          return func.apply(self, args);
        });
    });

  //////////////////////////////////////////////////////////////////////////////
  // String methods
  //////////////////////////////////////////////////////////////////////////////

  ak.updateWithMode(
    String.prototype, ak.DONT_ENUM,
    {
      startsWith: function (prefix, /* optional */ start, /* optional */ end) {
        if (arguments.length < 2)
          start = 0;
        else if (arguments.length > 2 && start + prefix.length > end)
          return false;
        return this.substr(start, prefix.length) == prefix;
      },

      trim: function () {
        return /^\s*((?:.|\s)*?)\s*$/.exec(this)[1];
      },

      trimLeft: function () {
        return /^\s*((?:.|\s)*)$/.exec(this)[1];
      },

      trimRight: function () {
        return /^((?:.|\s)*?)\s*$/.exec(this)[1];
      },

      ljust: function (width, c/* = ' ' */) {
        c = c || ' ';
        var parts = [this];
        for (var i = this.length; i < width; ++i)
          parts.push(c);
        return parts.join('');
      },

      rjust: function (width, c/* = ' ' */) {
        c = c || ' ';
        var parts = [];
        for (var i = this.length; i < width; ++i)
          parts.push(c);
        parts.push(this);
        return parts.join('');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // Date comparison
  //////////////////////////////////////////////////////////////////////////////

  Date.prototype.setNonEnumerable(
    '__cmp__',
    function (other) {
      if (!(other instanceof Date))
        throw TypeError('Date object could be compared only to Date object');
      return ak.cmp(this.getTime(), other.getTime());
    });

  //////////////////////////////////////////////////////////////////////////////
  // RegExp escaping
  //////////////////////////////////////////////////////////////////////////////

  var specialsRegExp = new RegExp('[.*+?|()\\[\\]{}\\\\]', 'g');

  RegExp.escape = function (string) {
    return string.replace(specialsRegExp, '\\$&');
  };

  //////////////////////////////////////////////////////////////////////////////
  // Reprs
  //////////////////////////////////////////////////////////////////////////////

  function setRepr(constructor, func) {
    constructor.prototype.setNonEnumerable('__repr__', func);
  }


  setRepr(Object, function () {
            var keys = ak.keys(this);
            keys.sort();
            return ('{' +
                    keys.map(function (key) {
                               return key + ': ' + ak.repr(this[key]);
                             },
                             this).join(', ') +
                    '}');
          });


  setRepr(Array, function () {
            return '[' + this.map(ak.repr).join(', ') + ']';
          });


  setRepr(Date, function () {
            return this + '';
          });


  setRepr(Function, function () {
            if (this.__name__)
              return this.__name__;
            var string = this + '';
            string = string.replace(/^\s+/, '').replace(/\s+/g, ' ');
            string = string.replace(/,(\S)/, ', $1');
            var idx = string.indexOf('{');
            if (idx != -1)
              string = string.substr(0, idx) + '{...}';
            return string;
          });


  setRepr(String, function () {
            return ('"' + this.replace(/([\"\\])/g, '\\$1') + '"'
              ).replace(/[\f]/g, '\\f'
              ).replace(/[\b]/g, '\\b'
              ).replace(/[\n]/g, '\\n'
              ).replace(/[\t]/g, '\\t'
              ).replace(/[\v]/g, '\\v'
              ).replace(/[\r]/g, '\\r');
          });


  setRepr(Number, function () {
            return this + '';
          });


  setRepr(Boolean, function () {
            return this + '';
          });


  setRepr(Error, function () {
            return (this.name + '(' +
                    (this.message ? ak.repr(this.message) : '') + ')');
          });


  setRepr(RegExp, function () {
            return this + '';
          });

})();
