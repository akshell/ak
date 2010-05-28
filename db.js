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

var inner = require('inner');
var core = inner.core;
var base = require('base');

////////////////////////////////////////////////////////////////////////////////
// RelVar
////////////////////////////////////////////////////////////////////////////////

var typeRegExp = RegExp(
  ('\\s*(?:' +
   '(number)|(string)|(bool)|(date)|' +
   '(integer)|(serial)|(unique)|' +
   '(?:foreign\\s|->)\\s*(\\w+)\\.(\\w+)|' +
   'check\\s+(\\(.*\\)|\\S+)|' +
   'default\\s+(\"([^\"\\\\]|\\\\.)*\"|\'(?:[^\'\\\\]|\\\\.)*\'|\\S+)' +
   ')\\s*'),
  'g');

function compileType(string) {
  var re = new RegExp(typeRegExp);
  var type;
  var integer, serial, unique, defaulted;
  var foreigns = [];
  var check;
  var default_;
  var match;
  while ((match = inner.nextMatch(re, string, core.UsageError))) {
    var i = 1;
    while (!match[i])
      ++i;
    if (i < 5) {
      if (type)
        throw core.UsageError(
          'Type specified more than once in ' + base.repr(string));
      type = [
        core.db.number,
        core.db.string,
        core.db.bool,
        core.db.date
      ][i - 1];
    } else if (i == 5) {
      integer = true;
    } else if (i == 6) {
      serial = true;
    } else if (i == 7) {
      unique = true;
    } else if (i == 8) {
      foreigns.push([match[8], match[9]]);
    } else if (i == 10) {
      check = match[10];
    } else {
      base.assertSame(i, 11);
      if (defaulted)
        throw core.UsageError(
          'Default specified more than once in ' + base.repr(string));
      default_ = eval(match[11]);
      defaulted = true;
    }
  }
  if (!type) {
    if (integer || serial)
      type = core.db.number;
    else
      throw core.UsageError('Type is not specified in ' + base.repr(string));
  }
  if (integer)
    type = type.integer();
  if (serial)
    type = type.serial();
  if (unique)
    type = type.unique();
  if (check)
    type = type.check(check);
  if (defaulted)
    type = type.default_(default_);
  foreigns.forEach(
    function (foreign) {
      type = type.foreign(foreign[0], foreign[1]);
    });
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

function compileConstr(constrs, string) {
  var match = constrRegExp.exec(string);
  if (!match)
    throw core.UsageError('Invalid constraint format: ' + base.repr(string));
  if (match[1])
    constrs.check.push(match[1]);
  else if (match[2])
  constrs.unique.push(match[2].split(sepRegExp));
  else
    constrs.foreign.push([
                           match[3].split(sepRegExp),
                           match[4],
                           match[5].split(sepRegExp)
                         ]);
}


exports.RelVar = Object.subclass(
  function (name) {
    throw core.UsageError(
      'RelVar instances should be obtained through the rv object');
  },
  {
    exists: function () {
      return core.db.list().indexOf(this.name) != -1;
    },

    create: function (header/*, constrs... */) {
      var rawHeader = {};
      for (var name in header)
        rawHeader[name] = compileType(header[name]);
      var constrs = {unique: [], foreign: [], check: []};
      for (var i = 1; i < arguments.length; ++i)
        compileConstr(constrs, arguments[i]);
      return core.db.create(this.name, rawHeader, constrs);
    },

    drop: function () {
      core.db.drop([this.name]);
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
      return core.db.insert(this.name, values);
    },

    addAttrs: function (attrs) {
      var rawAttrs = {};
      for (var name in attrs) {
        var string = attrs[name];
        var index = string.indexOf(' ');
        if (index == 0)
          throw core.UsageError(
            'Attribute description must have format "type value"');
        var typeString = string.substr(0, index);
        var type = {
          'number': core.db.number,
          'string': core.db.string,
          'bool': core.db.bool,
          'date': core.db.date,
          'integer': core.db.number.integer()
        }[typeString];
        if (!type)
          throw core.UsageError('Unknown type: ' + typeString);
        rawAttrs[name] = [type, eval(string.substr(index + 1))];
      }
      core.db.addAttrs(this.name, rawAttrs);
    },

    dropAttrs: function (/* names... */) {
      core.db.dropAttrs(this.name, Array.slice(arguments));
    }
  });


[
  'getHeader',
  'getInteger',
  'getSerial',
  'getUnique',
  'getForeign',
  'getDefault'
].forEach(
  function (name) {
    var func = core.db[name];
    exports.RelVar.prototype[name] = function () {
      return func(this.name);
    };
  });

////////////////////////////////////////////////////////////////////////////////
// rv
////////////////////////////////////////////////////////////////////////////////

exports.rv = new core.Proxy(
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
      return core.db.list().indexOf(name) != -1;
    },

    list: function () {
      return core.db.list().sort();
    }
  });

////////////////////////////////////////////////////////////////////////////////
// TupleDoesNotExist and MultipleTuplesReturned
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
      var tuples = core.db.query(
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
      return core.db.count(this.name + ' where ' + this.expr, this.params);
    },

    del: function () {
      return core.db.del(this.name, this.expr, this.params);
    },

    update: function (exprs/*, params... */) {
      return core.db.update(
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
