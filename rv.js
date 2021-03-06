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
var db = require('db');
var Proxy = require('proxy').Proxy;
var base = require('base');
var utils = require('utils');

////////////////////////////////////////////////////////////////////////////////
// RelVar
////////////////////////////////////////////////////////////////////////////////

var attrRegExp = RegExp(
  ('\\s*(?:' +
   '(number)|(string)|(boolean)|(date)|(integer)|(serial)|(json)|(binary)|' +
   '(unique)|->\\s*(\\w+)\\.(\\w+)|check\\s+(\\(.*\\)|\\S+)' +
   ')\\s*'),
  'g');

function compileAttr(name, descr, constrs) {
  var re = new RegExp(attrRegExp);
  var type;
  var match;
  while ((match = utils.nextMatch(re, descr, core.ValueError))) {
    var i = 1;
    while (!match[i])
      ++i;
    if (i < 9) {
      if (type)
        throw core.ValueError(
          'Type specified more than once in ' + base.repr(descr));
      type = match[i];
    } else if (i == 9) {
      constrs.unique.push([name]);
    } else if (i == 10) {
      constrs.foreign.push([[name], match[i], [match[i + 1]]]);
    } else {
      base.assertSame(i, 12);
      constrs.check.push(match[i])
    }
  }
  if (!type)
      throw core.ValueError('Type is not specified in ' + base.repr(descr));
  return type;
}


var multiAttrString = '\\[\\s*((?:\\w+\\s*,\\s*)*\\w+)\\s*\\]';

var constrRegExp = RegExp(
  '^\\s*(?:' +
  'check\\s+(.*?)|' +
  'unique\\s*' + multiAttrString + '|' +
  multiAttrString + '\\s*->\\s*(\\w+)\\s*' + multiAttrString +
  ')\\s*$');

var sepRegExp = /\s*,\s*/;

function compileConstr(descr, constrs) {
  var match = constrRegExp.exec(descr);
  if (!match)
    throw core.ValueError('Invalid constraint format: ' + base.repr(descr));
  if (match[1])
    constrs.check.push(match[1]);
  else if (match[2])
    constrs.unique.push(match[2].split(sepRegExp));
  else
    constrs.foreign.push(
      [match[3].split(sepRegExp), match[4], match[5].split(sepRegExp)]);
}


exports.RelVar = Object.subclass(
  function () {
    throw Error('RelVar instances should be obtained through the rv object');
  },
  {
    exists: function () {
      return db.list().indexOf(this.name) != -1;
    },

    create: function (header/*, constrs... */) {
      var rawHeader = {};
      var constrs = {unique: [], foreign: [], check: []};
      for (var name in header) {
        var descr = header[name];
        rawHeader[name] = (descr instanceof Array 
                           ? [compileAttr(name, descr[0], constrs), descr[1]] 
                           : compileAttr(name, descr, constrs));
      }
      for (var i = 1; i < arguments.length; ++i)
        compileConstr(arguments[i], constrs);
      return db.create(
        this.name, rawHeader, constrs.unique, constrs.foreign, constrs.check);
    },

    drop: function () {
      db.drop([this.name]);
    },

    where: function (expr/*, params */) {
      if (typeof(expr) != 'object')
        return new exports.Selection(
          this.name, expr, Array.slice(arguments, 1));
      var index = 0;
      var parts = [];
      var params = [];
      for (var attr in expr) {
        parts.push(attr + '==$' + (++index));
        params.push(expr[attr]);
      }
      return new exports.Selection(this.name, parts.join('&&'), params);
    },

    all: function () {
      return this.where('true');
    },

    insert: function (values) {
      return db.insert(this.name, values);
    },

    addAttrs: function (attrs) {
      db.addAttrs(this.name, attrs);
    },

    dropAttrs: function (/* names... */) {
      db.dropAttrs(this.name, Array.slice(arguments));
    },

    addDefault: function (values) {
      db.addDefault(this.name, values);
    },

    dropDefault: function (/* names... */) {
      db.dropDefault(this.name, Array.slice(arguments));
    },

    addConstrs: function (/* constrs... */) {
      var constrs = {unique: [], foreign: [], check: []};
      for (var i = 0; i < arguments.length; ++i)
        compileConstr(arguments[i], constrs);
      db.addConstrs(
        this.name, constrs.unique, constrs.foreign, constrs.check);
    },

    dropAllConstrs: function () {
      db.dropAllConstrs(this.name);
    }
  });


[
  'getHeader',
  'getUnique',
  'getForeign',
  'getDefault'
].forEach(
  function (name) {
    var func = db[name];
    exports.RelVar.prototype[name] = function () {
      return func(this.name);
    };
  });

////////////////////////////////////////////////////////////////////////////////
// rv
////////////////////////////////////////////////////////////////////////////////

exports.rv = new Proxy(
  {
    cache: {},

    get: function (name) {
      if (!this.cache.hasOwnProperty(name))
        this.cache[name] = {__proto__: exports.RelVar.prototype, name: name};
      return this.cache[name];
    },

    set: function (name, value) {},

    del: function (name) {
      return false;
    },

    query: function (name) {
      return db.list().indexOf(name) != -1;
    },

    list: function () {
      return db.list();
    }
  });

////////////////////////////////////////////////////////////////////////////////
// TupleDoesNotExist and TupleIsAmbiguous
////////////////////////////////////////////////////////////////////////////////

exports.TupleDoesNotExist = Error.subclass(
  function (message) {
    this.message = message || 'Tuple does not exist';
  },
  {name: 'TupleDoesNotExist'});


exports.TupleIsAmbiguous = Error.subclass(
  function (message) {
    this.message = message || 'Tuple is ambiguous';
  },
  {name: 'TupleIsAmbiguous'});


[
  ['DoesNotExist', exports.TupleDoesNotExist, 'does not exist'],
  ['IsAmbiguous', exports.TupleIsAmbiguous, 'is ambiguous']
].forEach(
  function (pair) {
    var propName = pair[0];
    var cachedPropName = '_' + propName;
    var baseClass = pair[1];
    var suffix = ' ' + pair[2];
    exports.RelVar.prototype.__defineGetter__(
      propName,
      function () {
        if (!this[cachedPropName]) {
          var name = this.name;
          this[cachedPropName] = baseClass.subclass(
            function () {
              baseClass.call(this, name + suffix);
            },
            {name: ['rv', name, propName].join('.')});
        }
        return this[cachedPropName];;
      });
  });

////////////////////////////////////////////////////////////////////////////////
// Selection
////////////////////////////////////////////////////////////////////////////////

exports.Selection = Object.subclass(
  function (name, expr, params/* = [] */) {
    this.name = name;
    this.expr = expr;
    this.params = params || [];
  },
  {
    get relVar() {
      return exports.rv[this.name];
    },

    get: function (options/* = {}, byParams... */) {
      options = options || {};
      var attrs = '';
      if (options.attr)
        attrs = '.' + options.attr;
      if (options.only)
        attrs = '[' + options.only.join(',') + ']';
      var tuples = db.query(
        this.name + attrs + ' where ' + this.expr,
        this.params,
        options.by,
        Array.slice(arguments, 1),
        options.start,
        options.length);
      return (options.attr
              ? tuples.map(function (tuple) { return tuple[options.attr]; })
              : tuples);
    },

    getOne: function () {
      var tuples = this.get.apply(this, arguments);
      if (!tuples.length)
        throw this.relVar.DoesNotExist();
      if (tuples.length > 1)
        throw this.relVar.IsAmbiguous();
      return tuples[0];
    },

    count: function () {
      return db.count(this.name + ' where ' + this.expr, this.params);
    },

    del: function () {
      return db.del(this.name, this.expr, this.params);
    },

    update: function (exprs/*, params... */) {
      return db.update(
        this.name, this.expr, this.params, exprs, Array.slice(arguments, 1));
    },

    set: function (values) {
      var index = 1;
      var exprs = {};
      var args = [exprs];
      for (var name in values) {
        exprs[name] = '$' + index++;
        args.push(values[name]);
      }
      return this.update.apply(this, args);
    }
  });
