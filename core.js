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


  // Selection is inherited from Rel
  ak.Selection.prototype.__proto__ = ak.Rel.prototype;


  function publishMethod(constructor, name, mode/* = ak.NONE */) {
    ak._setObjectProp(constructor.prototype,
                      name,
                      mode || ak.NONE,
                      constructor.prototype['_' + name]);
  }

  publishMethod(ak.Script, 'run');
  publishMethod(ak.Type, 'integer');
  publishMethod(ak.Type, 'serial');
  publishMethod(ak.Type, 'default');
  publishMethod(ak.Type, 'unique');
  publishMethod(ak.Type, 'foreign');
  publishMethod(ak.Type, 'check');
  publishMethod(ak.Rel, 'perform', ak.DONT_ENUM);
  publishMethod(ak.Rel, 'only', ak.DONT_ENUM);
  publishMethod(ak.Rel, 'by', ak.DONT_ENUM);
  publishMethod(ak.Selection, 'update', ak.DONT_ENUM);
  publishMethod(ak.Selection, 'del', ak.DONT_ENUM);
  publishMethod(ak.RelVar, 'create');
  publishMethod(ak.RelVar, 'insert');
  publishMethod(ak.RelVar, 'drop');
  publishMethod(ak.RelVar, 'all');
  publishMethod(ak.RelVar, 'getInts');
  publishMethod(ak.RelVar, 'getSerials');
  publishMethod(ak.RelVar, 'getDefaults');
  publishMethod(ak.RelVar, 'getUniques');
  publishMethod(ak.RelVar, 'getForeigns');
  publishMethod(ak.Data, 'toString');


  function publishFunction(object,
                           name,
                           owner/* = object */) {
    var func = object['_' + name];
    (owner || object)[name] = function (/* arguments... */) {
      return func.apply(object, arguments);
    };
  }

  publishFunction(ak, 'setObjectProp');
  publishFunction(ak, 'readCode');
  publishFunction(ak, 'request');
  publishFunction(ak, 'hash');
  publishFunction(ak, 'construct');
  publishFunction(ak.fs, 'read');
  publishFunction(ak.fs, 'list');
  publishFunction(ak.fs, 'exists');
  publishFunction(ak.fs, 'isDir');
  publishFunction(ak.fs, 'isFile');
  publishFunction(ak.fs, 'makeDir');
  publishFunction(ak.fs, 'write');
  publishFunction(ak.fs, 'rename');
  publishFunction(ak.fs, 'copyFile');
  publishFunction(ak._dbMediator, 'query', ak);
  publishFunction(ak._dbMediator, 'dropRelVars', ak);
  publishFunction(ak._dbMediator, 'unique', ak);
  publishFunction(ak._dbMediator, 'foreign', ak);
  publishFunction(ak._dbMediator, 'check', ak);


  ak.number = ak._dbMediator.number;
  ak.string = ak._dbMediator.string;
  ak.bool = ak._dbMediator.bool;
  ak.boolean_ = ak.bool;
  ak.date = ak._dbMediator.date;


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
    ak.Rel.prototype, 'where', ak.DONT_ENUM,
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
    ak.Rel.prototype, 'field', ak.DONT_ENUM,
    function (name) {
      var query = this.only(name);
      var result = [];
      for (var i = 0; i < query.length; ++i)
        result.push(query[i][name]);
      return result;
    });


  ak.setObjectProp(
    ak.Selection.prototype, 'set', ak.DONT_ENUM,
    function (obj) {
      var args = [{}];
      var index = 0;
      for (var field in obj) {
        args[0][field] = '$' + (++index);
        args.push(obj[field]);
      }
      return this.update.apply(this, args);
    });


  function makeRelVarDelegation(func_name) {
    ak.RelVar.prototype[func_name] = function (/* arguments... */) {
      return ak.Selection.prototype[func_name].apply(this.all(), arguments);
    };
  }

  makeRelVarDelegation('only');
  makeRelVarDelegation('by');
  makeRelVarDelegation('update');
  makeRelVarDelegation('del');
  makeRelVarDelegation('where');
  makeRelVarDelegation('field');
  makeRelVarDelegation('set');


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
    request.user = ak._user;
    request.fullPath = '/' + ak.appName + '/' + request.path;
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