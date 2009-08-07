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

(function ()
{
  include('base.js');

  var base = ak.base;
  var $ = base.module('ak.utils');


  $.range = function (/* [start,] stop[, step] */) {
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


  $.camelize = function (selector) {
    var arr = selector.split('-');
    for (var i = 1; i < arr.length; ++i)
      arr[i] = arr[i].charAt(0).toUpperCase() + arr[i].substring(1);
    return arr.join('');
  };


  $.counter = function (n/* = 0 */) {
    n = n || 0;
    return function () {
      return n++;
    };
  };


  $.flattenArguments = function (/* ... */) {
    var result = [];
    var args = Array.slice(arguments);
    while (args.length) {
      var x = args.shift();
      if (base.indicators.arrayLike(x))
        for (var i = x.length - 1; i >= 0; --i)
          args.unshift(x[i]);
      else
        result.push(x);
    }
    return result;
  };


  $.itemGetter = function (key) {
    return function (obj) {
      return obj[key];
    };
  };


  $.typeMatcher = function (type/*, ... */) {
    var types = {};
    Array.map(arguments, function (arg) { types[arg] = true; });
    return function () {
      return Array.every(arguments, function (arg) {
                           return typeof(arg) in types;
                         });
    };
  };


  $.methodCaller = function (f/*, args... */) {
    var args = Array.slice(arguments, 1);
    return (typeof(f) == 'function'
            ? function (obj) {
              return f.apply(obj, args);
            }
            : function (obj) {
              return obj[f].apply(obj, args);
            });
  };


  $.keyComparator = function (key/* ... */) {
    // fast-path for single key comparisons
    if (arguments.length == 1)
      return function (a, b) {
        return base.cmp(a[key], b[key]);
      };
    var keys = Array.slice(arguments);
    return function (a, b) {
      for (var i = 0; i < keys.length; ++i) {
        var key = keys[i];
        var c = base.cmp(a[key], b[key]);
        if (c)
          return c;
      }
      return 0;
    };
  };


  $.thrower = function (err) {
    return function () {
      throw err;
    };
  };


  base.nameFunctions($);

})();
