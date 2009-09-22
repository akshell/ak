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
  var $ = ak;


  function publish(constructor, name) {
    constructor.prototype[name] = constructor.prototype['_' + name];
  }

  publish($.AK, 'setObjectProp');
  publish($.AK, 'compile');
  publish($.AK, 'readCode');
  publish($.AK, 'hash');
  publish($.Script, 'run');
  publish($.App, 'call');
  publish($.Type, 'int');
  publish($.Type, 'serial');
  publish($.Type, 'default');
  publish($.Type, 'unique');
  publish($.Type, 'foreign');
  publish($.Type, 'check');
  publish($.Query, 'perform');
  publish($.Query, 'only');
  publish($.Query, 'where');
  publish($.Query, 'by');
  publish($.SubRel, 'update');
  publish($.SubRel, 'del');
  publish($.Constrs, 'unique');
  publish($.Constrs, 'foreign');
  publish($.Constrs, 'check');
  publish($.DB, 'query');
  publish($.DB, 'createRel');
  publish($.DB, 'dropRels');
  publish($.Rel, 'insert');
  publish($.Rel, 'drop');
  publish($.Rel, 'all');
  publish($.Rel, 'getInts');
  publish($.Rel, 'getSerials');
  publish($.Rel, 'getDefaults');
  publish($.Rel, 'getUniques');
  publish($.Rel, 'getForeigns');
  publish($.Data, 'toString');
  publish($.FS, 'read');
  publish($.FS, 'list');
  publish($.FS, 'exists');
  publish($.FS, 'isDir');
  publish($.FS, 'isFile');
  publish($.FS, 'makeDir');
  publish($.FS, 'write');
  publish($.FS, 'rename');
  publish($.FS, 'copyFile');


  ak.appName = ak._appName;


  // Property access modes for ak.setObjectProp
  // Could be combined using '|' operator.
  $.NONE        = 0;
  $.READ_ONLY   = 1 << 0;
  $.DONT_ENUM   = 1 << 1;
  $.DONT_DELETE = 1 << 2;


  // SubRel is inherited from Query
  $.SubRel.prototype.__proto__ = $.Query.prototype;


  // Dates should be in UTC on the server
  Date.prototype.toString = Date.prototype.toUTCString;


  $.fs.remove = function (path) {
    if ($.fs.isDir(path)) {
      var children = $.fs.list(path);
      for (var i = 0; i < children.length; ++i)
        arguments.callee(path + '/' + children[i]);
    }
    $.fs._remove(path);
  };


  $.setObjectProp(
    $.Query.prototype, 'whose', $.DONT_ENUM,
    function () {
      var query = this.where.apply(this, arguments);
      if (query.length != 1)
        throw Error('whose() query got ' + query.length + ' tuples');
      return query[0];
    });


  $.setObjectProp(
    $.Query.prototype, 'field', $.DONT_ENUM,
    function (name) {
      var query = this.only(name);
      var result = [];
      for (var i = 0; i < query.length; ++i)
        result.push(query[i][name]);
      return result;
    });


  $.setObjectProp(
    $.SubRel.prototype, 'set', $.DONT_ENUM,
    function (obj) {
      var args = [{}];
      var index = 0;
      for (var field in obj) {
        args[0][field] = '$' + (++index);
        args.push(obj[field]);
      }
      return this.update.apply(this, args);
    });


  function makeRelDelegation(func_name) {
    $.Rel.prototype[func_name] = function () {
      return $.SubRel.prototype[func_name].apply(this.all(), arguments);
    };
  }

  makeRelDelegation('where');
  makeRelDelegation('whose');
  makeRelDelegation('only');
  makeRelDelegation('by');
  makeRelDelegation('field');
  makeRelDelegation('update');
  makeRelDelegation('updateByValues');
  makeRelDelegation('delete');


  $.TmpFile.prototype.read = function () {
    return $.fs.read(this);
  };


  $.defaultHeaders = {'Content-Type': 'text/html; charser=utf-8'};


  $.Response = function (content/* = '' */,
                         status/* = 200 */,
                         headers/* = $.defaultHeaders */) {
    this.content = content || '';
    this.status = status || 200;
    this.headers = headers || $.defaultHeaders;
  };


  $._main = function (data) {
    var request = eval('(' + data + ')');
    request.data = ak._data;
    request.files = {};
    // request.fileNames.length and ak._files.length are guaranteed to be equal
    for (var i = 0; i < ak._files.length; ++i)
      request.files[request.fileNames[i]] = ak._files[i];
    delete request.fileNames;
    request.requester = ak._requesterAppName;

    var response = __main__(request);
    var headerLines = [];
    for (var name in response.headers)
      headerLines.push(name + ': ' + response.headers[name]);
    return (response.status + '\n' +
            headerLines.join('\n') +
            '\n\n' + response.content);
  };


  return $;
})();

