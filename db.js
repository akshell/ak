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

(function ()
{
  ak.include('base.js');
  ak.include('debug.js');


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
    while ((match = ak.nextMatch(re, string, ak.UsageError))) {
      var i = 1;
      while (!match[i])
        ++i;
      if (i < 5) {
        if (type)
          throw new ak.UsageError(
            'Type specified more than once in ' + ak.repr(string));
        type = [ak.number, ak.string, ak.bool, ak.date][i - 1];
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
        ak.assertSame(i, 11);
        if (defaulted)
          throw new ak.UsageError(
            'Default specified more than once in ' + ak.repr(string));
        default_ = eval(match[11]);
        defaulted = true;
      }
    }
    if (!type) {
      if (integer || serial)
        type = ak.number;
      else
        throw new ak.UsageError('Type is not specified in ' + ak.repr(string));
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


  var fieldListString = '\\s*((?:\\w+\\s*,\\s*)*\\w+)\\s*';
  var multiFieldString = '\\[' + fieldListString + '\\]';
  var constrRegExp = RegExp(
    '^\\s*(?:' +
    'check\\s+(.*?)|' +
    'unique\\s*(?:\\s' + fieldListString + '|' + multiFieldString + ')|' +
    multiFieldString + '\\s*(?:foreign\\s|->)\\s*(\\w+)\\s*' +
    multiFieldString +
    ')\\s*$');
  var sepRegExp = /\s*,\s*/;

  function compileConstr(constrs, string) {
    var match = constrRegExp.exec(string);
    if (!match)
      throw new ak.UsageError('Invalid constraint format: ' + ak.repr(string));
    if (match[1])
      constrs.check.push(match[1]);
    else if (match[2])
      constrs.unique.push(match[2].split(sepRegExp));
    else if (match[3])
      constrs.unique.push(match[3].split(sepRegExp));
    else
      constrs.foreign.push([
                             match[4].split(sepRegExp),
                             match[5],
                             match[6].split(sepRegExp)
                           ]);
  }


  var doCreate = ak.db.create;

  ak.db.create = function (name, header/*, constrs... */) {
    header = ak.clone(header);
    for (var attrName in header) {
      if (typeof(header[attrName]) == 'string')
        header[attrName] = compileType(header[attrName]);
    }
    var constrs;
    if (arguments.length == 3 && typeof(arguments[2]) == 'object') {
      constrs = arguments[2];
    } else {
      constrs = {unique: [], foreign: [], check: []};
      Array.slice(arguments, 2).forEach(
        function (string) {
          compileConstr(constrs, string);
        });
    }
    return doCreate(name, header, constrs);
  };

})();
