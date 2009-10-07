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
  ak.include('base.js');


  ak.range = function (/* [start,] stop[, step] */) {
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
      throw new TypeError('range() step must not be 0');
    var result = [];
    for (var i = start; step > 0 ? i < stop : i > stop; i += step)
      result.push(i);
    return result;
  };


  ak.zip = function (/* arrays */) {
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


  ak.camelize = function (selector) {
    var arr = selector.split('-');
    for (var i = 1; i < arr.length; ++i)
      arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].substring(1);
    return arr.join('');
  };


  ak.counter = function (n/* = 0 */) {
    n = n || 0;
    return function () {
      return n++;
    };
  };


  ak.flattenArguments = function (/* ... */) {
    var result = [];
    var args = Array.slice(arguments);
    while (args.length) {
      var x = args.shift();
      if (ak.indicators.arrayLike(x))
        for (var i = x.length - 1; i >= 0; --i)
          args.unshift(x[i]);
      else
        result.push(x);
    }
    return result;
  };


  ak.getter = function (key) {
    return function () {
      return this[key];
    };
  };


  ak.attrGetter = function (key) {
    return function (obj) {
      return obj[key];
    };
  };


  ak.typeMatcher = function (type/*, ... */) {
    var types = {};
    Array.map(arguments, function (arg) { types[arg] = true; });
    return function () {
      return Array.every(arguments, function (arg) {
                           return typeof(arg) in types;
                         });
    };
  };


  ak.methodCaller = function (f/*, args... */) {
    var args = Array.slice(arguments, 1);
    return (typeof(f) == 'function'
            ? function (obj) {
              return f.apply(obj, args);
            }
            : function (obj) {
              return obj[f].apply(obj, args);
            });
  };


  ak.keyComparator = function (key/* ... */) {
    // fast-path for single key comparisons
    if (arguments.length == 1)
      return function (a, b) {
        return ak.cmp(a[key], b[key]);
      };
    var keys = Array.slice(arguments);
    return function (a, b) {
      for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        var c = ak.cmp(a[key], b[key]);
        if (c)
          return c;
      }
      return 0;
    };
  };


  ak.thrower = function (err) {
    return function () {
      throw err;
    };
  };

})();