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

var core = require('core');
var base = require('base');
var http = require('http');


exports.ResolveError = http.NotFound.subclass();
exports.ReverseError = Error.subclass();


var defaultPattern = /([^\/]+)\//;


exports.URLMap = Object.subclass(
  function (/* [handler, [name,]] children... */) {
    var i;
    if (typeof(arguments[0]) == 'function') {
      this._handler = arguments[0];
      if (typeof(arguments[1]) == 'string') {
        this._name = arguments[1];
        i = 2;
      } else {
        i = 1;
      }
    } else {
      i = 0;
    }
    this._children = [];
    for (; i < arguments.length; ++i) {
      var child = arguments[i];
      if (!(child instanceof Array))
        throw TypeError('URLMap children must be defined as Array objects');
      if (!(typeof(child[0]) == 'string' || child[0] instanceof RegExp))
        throw TypeError('URLMap pattern must be string or RegExp');
      var submap = (child[1] instanceof arguments.callee
                    ? child[1]
                    : core.construct(arguments.callee, child.slice(1)));
      this._children.push([child[0] || defaultPattern, submap]);
    }
  },
  {
    _resolve: function (path) {
      if (!path)
        return this._handler ? [this._handler, []] : undefined;
      for (var i = 0; i < this._children.length; ++i) {
        var child = this._children[i];
        var pattern = child[0];
        var submap = child[1];
        if (typeof(pattern) == 'string') {
          if (path.startsWith(pattern)) {
            var result = submap._resolve(path.substr(pattern.length));
            if (result)
              return result;
          }
        } else {
          var match = pattern.exec(path);
          if (match && match.index == 0) {
            var result = submap._resolve(path.substr(match[0].length));
            if (result) {
              result[1].unshift(match.length == 1 ? match[0] : match[1]);
              return result;
            }
          }
        }
      }
      return undefined;
    },

    resolve: function (path) {
      var result = this._resolve(path);
      if (!result)
        throw exports.ResolveError('Can not resolve path ' + base.repr(path));
      return result;
    },

    _populateReverseMap: function (reverseMap, parts) {
      if (this._name) {
        if (reverseMap.hasOwnProperty(this._name))
          throw core.ValueError(
            'Multiple URL patterns with name ' + base.repr(this._name));
        reverseMap[this._name] = parts;
      }
      this._children.forEach(
        function (child) {
          var childParts = parts.slice();
          var pattern = child[0];
          if (typeof(pattern) == 'string') {
            childParts[childParts.length - 1] += pattern;
          } else if (pattern === defaultPattern) {
            childParts.push('/');
          } else {
            var source = pattern.source.replace(/\\(.)/g, '$1');
            var start = source.indexOf('(');
            var stop = source.lastIndexOf(')');
            if (start == -1 || stop == -1 || start > stop) {
              childParts.push('');
            } else {
              childParts[childParts.length - 1] += source.substr(0, start);
              childParts.push(source.substr(stop + 1));
            }
          }
          child[1]._populateReverseMap(reverseMap, childParts);
        });
    },

    reverse: function (name/*, args... */) {
      if (!this._reverseMap) {
        this._reverseMap = {};
        this._populateReverseMap(this._reverseMap, ['']);
      }
      if (!this._reverseMap.hasOwnProperty(name))
        throw exports.ReverseError(
          'URL pattern with name ' + base.repr(name) + ' does not exist');
      var parts = this._reverseMap[name];
      if (parts.length != arguments.length)
        throw exports.ReverseError(
          'URL pattern ' + base.repr(name) +
            ' takes ' + (parts.length - 1) + ' arguments');
      var resultParts = [parts[0]];
      for (var i = 1; i < parts.length; ++i)
        resultParts.push(arguments[i], parts[i]);
      return encodeURI(resultParts.join(''));
    }
  });


exports.resolve = function (path) {
  if (!path.startsWith('/'))
    throw core.ValueError('resolve() requires absolute path');
  return require.main.exports.root.resolve(path.substr(1));
};


exports.reverse = function (name/*, args... */) {
  var root = require.main.exports.root;
  return '/' + root.reverse.apply(root, arguments);
};
