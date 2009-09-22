// Copyright (c) 2009, Anton Korenyushkin
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
  // Free functions
  //////////////////////////////////////////////////////////////////////////////

  var global = this;

  function Module(name, version) {
    var components = name.split('.');
    var package = global;
    if (components.indexOf('') != -1)
      throw new Error('Empty module name component');
    for (var i = 0; i < components.length - 1; ++i) {
      var component = components[i];
      if (!(component in package))
        package[component] = {};
      package = package[component];
    }
    package[components[components.length - 1]] = this;
    this.__name__ = name;
    if (version)
      this.__version__ = version;
  }

  Module.prototype = {
    __repr__: function () {
      return ('<' + this.__name__ +
              (this.__version__ ? ' ' + this.__version__ : '') +
              '>');
    },

    toString: function () {
      return this.__repr__();
    }
  };


  var $ = new Module('ak.base');

  $.global = global;
  $.Module = Module;

  $.module = function (name, version) {
    return new $.Module(name, version);
  };


  $.updateWithMode = function (self, mode, obj/*, ...  */) {
    for (var i = 2; i < arguments.length; ++i) {
      var o = arguments[i];
      for (var key in o)
        ak.setObjectProp(self, key, mode, o[key]);
    }
    return self;
  };


  $.update = function (self, obj/*, ... */) {
    Array.prototype.splice.call(arguments, 0, 1, self, ak.NONE);
    return $.updateWithMode.apply(this, arguments);
  };


  ak.__name__ = 'ak';
  ak.__version__ = '0.1';
  $.update(ak, Module.prototype);


  $.updateTree = function (self, obj/*, ...*/) {
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


  $.clone = function (obj) {
    return {__proto__: obj};
  };


  $.repr = function (x) {
    if (x === undefined)
      return 'undefined';
    if (x === null)
      return 'null';
        if (typeof(x.__repr__) == 'function')
      return x.__repr__();
    return x + '';
  };


  $.items = function (obj) {
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


  $.cmp = function (a, b) {
    a = removeWrapper(a);
    b = removeWrapper(b);
    if (a === b)
      return 0;
    if (a !== null && a !== undefined && b !== null && b !== undefined) {
      var c = doCmp(a, b);
      if (c !== undefined)
        return c;
    }
    throw new TypeError($.repr(a) + ' and ' + $.repr(b) +
                        ' can not be compared');
  };


  $.equal = function (a, b) {
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
    throw new TypeError($.repr(a) + ' and ' + $.repr(b) +
                        ' can not be compared for equality');
  };


  $.setDefault = function (self, obj/*, ...*/) {
    for (var i = 1; i < arguments.length; ++i) {
      var o = arguments[i];
      for (var key in o)
        if (!(key in self))
          self[key] = o[key];
    }
    return self;
  };


  $.keys = function (obj) {
    var result = [];
    for (var key in obj)
      result.push(key);
    return result;
  };


  $.values = function (obj) {
    var result = [];
    for (var key in obj)
      result.push(obj[key]);
    return result;
  };


  $.operators = {
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

    ceq: function (a, b) { return $.cmp(a, b) === 0; },
    cne: function (a, b) { return $.cmp(a, b) !== 0; },
    cgt: function (a, b) { return $.cmp(a, b) == 1; },
    cge: function (a, b) { return $.cmp(a, b) != -1; },
    clt: function (a, b) { return $.cmp(a, b) == -1; },
    cle: function (a, b) { return $.cmp(a, b) != 1; },

    and: function (a, b) { return a && b; },
    or: function (a, b) { return a || b; },
    contains: function (a, b) { return b in a; }
  };


  $.indicators = {
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


  $.compose = function (f1, f2/*, f3, ... fN */) {
    var funcs = Array.slice(arguments);
    return function () {
      var args = arguments;
      for (var i = funcs.length - 1; i >= 0; --i)
        args = [funcs[i].apply(this, args)];
      return args[0];
    };
  };


  $.bind = function (func, self) {
    return function () {
      return func.apply(self, arguments);
    };
  };


  $.partial = function (func/*, args... */) {
    var args = Array.slice(arguments, 1);
    return function () {
      return func.apply(this, args.slice().extend(arguments));
    };
  };


  $.method = function (func) {
    return function (self/*, args... */) {
      return func.apply(this, [this].extend(arguments));
    };
  };


  $.factory = function (constructor) {
    return function () {
      var result = {};
      result.__proto__ = constructor.prototype;
      constructor.apply(result, arguments);
      return result;
    };
  };


  $.nameFunctions = function (ns) {
    for (var key in ns) {
      var x = ns[key];
      if (typeof(x) == 'function' && x.__name__ === undefined)
        x.__name__ = ns.__name__ + '.' + key;
    }
  };


  $.makeClass = function(/* optional */constructor,
                         /* optional */prototype) {
    constructor = constructor || function () {};
    if (prototype)
      constructor.prototype = prototype;
    constructor.prototype.constructor = constructor;
    return constructor;
  };


  $.makeSubclass = function(parent,
                            /* optional */constructor,
                            /* optional */prototype) {
    constructor = (constructor ||
                   function () { parent.apply(this, arguments); });
    constructor = $.makeClass(constructor, prototype);
    constructor.prototype.__proto__ = parent.prototype;
    return constructor;
  };


  Error.stackTraceLimit = 1000;


  $.makeErrorClass = function (parent) {
    // Error.apply doesn't work for unknown reasons
    // so using $.makeClass is impossible
    var result = (parent
                  ? function (message) { parent.call(this, message); }
                  : function (message) {
                    Error.captureStackTrace(this);
                    this.message = message + '';
                  });
    result.prototype.__defineGetter__(
      'name',
      function () {
        return this.constructor.__name__ || this.__proto__.name;
      });
    result.prototype.__proto__ = (parent || Error).prototype;
    return result;
  };


  $.NotImplementedError = $.makeErrorClass();
  $.ValueError = $.makeErrorClass();


  $.abstract = function () {
    throw new $.NotImplementedError();
  };


  $.isSubclass = function (cls, base) {
    if (typeof(cls) != 'function' || typeof(base) != 'function')
      return false;
    if (base === Object)
      return true;
    for (var prototype = cls.prototype;
         prototype !== Object.prototype;
         prototype = prototype.__proto__)
      if (prototype === base.prototype)
        return true;
    return false;
  };

  //////////////////////////////////////////////////////////////////////////////
  // Object methods
  //////////////////////////////////////////////////////////////////////////////

  ak.setObjectProp(Object.prototype, 'setProp', ak.DONT_ENUM,
                   function (name, attrs, value) {
                     return ak.setObjectProp(this, name, attrs, value);
                   });


  Object.prototype.setProp('setNonEnumerable', ak.DONT_ENUM,
                           function (name, value) {
                             this.setProp(name, ak.DONT_ENUM, value);
                           });

  //////////////////////////////////////////////////////////////////////////////
  // Array methods
  //////////////////////////////////////////////////////////////////////////////

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
  ].forEach(function (name) {
              var func = Array.prototype[name];
              Array.setNonEnumerable(name,
                function (self/*, args... */) {
                  var args = Array.prototype.slice.call(arguments, 1);
                  return func.apply(self, args);
                });
            });


  $.map = Array.map;
  $.filter = Array.filter;


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

  $.updateWithMode(
    Array.prototype, ak.DONT_ENUM,
    {
      __cmp__: function (other) {
        var lenCmp = $.cmp(this.length, other.length);
        var count = lenCmp == -1 ? this.length : other.length;
        for (var i = 0; i < count; ++i) {
          var itemCmp = $.cmp(this[i], other[i]);
          if (itemCmp)
            return itemCmp;
        }
        return lenCmp;
      },

      __eq__: function (other) {
        if (!$.equal(this.length, other.length))
          return false;
        for (var i = 0; i < this.length; ++i)
          if (!$.equal(this[i], other[i]))
            return false;
        return true;
      },

      flatten: function () {
        return flattenArray([], this);
      },

      index: function (value, start/* = 0 */) {
        for (var i = start || 0; i < this.length; ++i)
          if ($.equal(this[i], value))
            return i;
        return -1;
      },

      extend: function (lst, skip) {
        for (var i = skip || 0; i < lst.length; ++i)
          this.push(lst[i]);
        return this;
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // String methods
  //////////////////////////////////////////////////////////////////////////////

  $.updateWithMode(
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
      return $.cmp(this.getTime(), other.getTime());
    });

  //////////////////////////////////////////////////////////////////////////////
  // RegExp escaping
  //////////////////////////////////////////////////////////////////////////////

  var specialsRegExp = new RegExp('[.*+?|()\\[\\]{}\\\\]', 'g');

  RegExp.escape = function (string) {
    return string.replace(specialsRegExp, '\\$&');
  };

  //////////////////////////////////////////////////////////////////////////////
  // Function decorating
  //////////////////////////////////////////////////////////////////////////////

  Function.prototype.setNonEnumerable(
    'decorated',
    function (/* decorators... */) {
      var result = this;
      for (var i = arguments.length - 1; i >= 0; --i) {
        var decorator = arguments[i];
        result = decorator(result);
      }
      return result;
    });

  //////////////////////////////////////////////////////////////////////////////
  // Reprs
  //////////////////////////////////////////////////////////////////////////////

  function setRepr(constructor, func) {
    constructor.prototype.setNonEnumerable('__repr__', func);
  }


  setRepr(Object, function () {
            var keys = $.keys(this);
            keys.sort();
            return ('{' +
                    keys.map(function (key) {
                               return key + ': ' + $.repr(this[key]);
                             },
                             this).join(', ') +
                    '}');
          });


  setRepr(Array, function () {
            return '[' + this.map($.repr).join(', ') + ']';
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
                    (this.message ? $.repr(this.message) : '') + ')');
          });


  setRepr(RegExp, function () {
            return this + '';
          });

  //////////////////////////////////////////////////////////////////////////////
  // Epilogue
  //////////////////////////////////////////////////////////////////////////////

  $.nameFunctions(ak);
  $.nameFunctions($);
  return $;
})();
