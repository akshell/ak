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
  // Property access modes for ak._setObjectProp
  // Could be combined using '|' operator.
  ak.NONE        = 0;
  ak.READ_ONLY   = 1 << 0;
  ak.DONT_ENUM   = 1 << 1;
  ak.DONT_DELETE = 1 << 2;


  // SubRel is inherited from Query
  ak.SubRel.prototype.__proto__ = ak.Query.prototype;


  function publish(constructor, name, mode/* = ak.NONE */) {
    ak._setObjectProp(constructor.prototype,
                      name,
                      mode || ak.NONE,
                      constructor.prototype['_' + name]);
  }

  publish(ak.AK, 'setObjectProp');
  publish(ak.AK, 'compile');
  publish(ak.AK, 'readCode');
  publish(ak.AK, 'hash');
  publish(ak.Script, 'run');
  publish(ak.App, 'call');
  publish(ak.Type, 'int');
  publish(ak.Type, 'serial');
  publish(ak.Type, 'default');
  publish(ak.Type, 'unique');
  publish(ak.Type, 'foreign');
  publish(ak.Type, 'check');
  publish(ak.Query, 'perform', ak.DONT_ENUM);
  publish(ak.Query, 'only', ak.DONT_ENUM);
  publish(ak.Query, 'by', ak.DONT_ENUM);
  publish(ak.SubRel, 'update', ak.DONT_ENUM);
  publish(ak.SubRel, 'del', ak.DONT_ENUM);
  publish(ak.Constrs, 'unique');
  publish(ak.Constrs, 'foreign');
  publish(ak.Constrs, 'check');
  publish(ak.DB, 'query');
  publish(ak.DB, 'createRel');
  publish(ak.DB, 'dropRels');
  publish(ak.Rel, 'insert');
  publish(ak.Rel, 'drop');
  publish(ak.Rel, 'all');
  publish(ak.Rel, 'getInts');
  publish(ak.Rel, 'getSerials');
  publish(ak.Rel, 'getDefaults');
  publish(ak.Rel, 'getUniques');
  publish(ak.Rel, 'getForeigns');
  publish(ak.Data, 'toString');
  publish(ak.FS, 'read');
  publish(ak.FS, 'list');
  publish(ak.FS, 'exists');
  publish(ak.FS, 'isDir');
  publish(ak.FS, 'isFile');
  publish(ak.FS, 'makeDir');
  publish(ak.FS, 'write');
  publish(ak.FS, 'rename');
  publish(ak.FS, 'copyFile');


  ak.appName = ak._appName;


  // Dates should be in UTC on the server
  Date.prototype.toString = Date.prototype.toUTCString;


  ak.fs.remove = function (path) {
    if (ak.fs.isDir(path)) {
      var children = ak.fs.list(path);
      for (var i = 0; i < children.length; ++i)
        arguments.callee(path + '/' + children[i]);
    }
    ak.fs._remove(path);
  };


  ak.setObjectProp(
    ak.Query.prototype, 'where', ak.DONT_ENUM,
    function (/* arguments... */) {
      if (typeof(arguments[0]) != 'object')
        return this._where.apply(this, arguments);
      var obj = arguments[0];
      var index = 0;
      var params = [];
      var parts = [];
      for (var field in obj) {
        parts.push(field + '==$' + (++index));
        params.push(obj[field]);
      }
      return this._where.apply(this, [parts.join('&&')].concat(params));
    });


  ak.setObjectProp(
    ak.Query.prototype, 'field', ak.DONT_ENUM,
    function (name) {
      var query = this.only(name);
      var result = [];
      for (var i = 0; i < query.length; ++i)
        result.push(query[i][name]);
      return result;
    });


  ak.setObjectProp(
    ak.SubRel.prototype, 'set', ak.DONT_ENUM,
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
    ak.Rel.prototype[func_name] = function (/* arguments... */) {
      return ak.SubRel.prototype[func_name].apply(this.all(), arguments);
    };
  }

  makeRelDelegation('only');
  makeRelDelegation('by');
  makeRelDelegation('update');
  makeRelDelegation('del');
  makeRelDelegation('where');
  makeRelDelegation('field');
  makeRelDelegation('set');


  ak.TempFile.prototype.read = function () {
    return ak.fs.read(this);
  };


  ak.defaultHeaders = {'Content-Type': 'text/html; charser=utf-8'};


  ak.Response = function (content/* = '' */,
                          status/* = 200 */,
                          headers/* = ak.defaultHeaders */) {
    this.content = content || '';
    this.status = status || 200;
    this.headers = headers || ak.defaultHeaders;
  };


  ak._main = function (data) {
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

})();
