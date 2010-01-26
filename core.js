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
  //////////////////////////////////////////////////////////////////////////////
  // Publishing
  //////////////////////////////////////////////////////////////////////////////

  // Property access modes for ak._setObjectProp
  // Could be combined using '|' operator.
  ak.NONE        = 0;
  ak.READ_ONLY   = 1 << 0;
  ak.DONT_ENUM   = 1 << 1;
  ak.DONT_DELETE = 1 << 2;


  ak.Script.prototype.run = ak.Script.prototype._run;
  ak.Type.prototype.default_ = ak.Type.prototype._default;


  ['integer', 'serial', 'unique', 'foreign', 'check', 'default'].forEach(
    function (name) {
      ak.Type.prototype[name] = ak.Type.prototype['_' + name];
    });


  [
    [ak, 'setObjectProp'],
    [ak, 'readCode'],
    [ak, 'hash'],
    [ak, 'construct'],
    [ak.fs, 'read'],
    [ak.fs, 'list'],
    [ak.fs, 'exists'],
    [ak.fs, 'isDir'],
    [ak.fs, 'isFile'],
    [ak.fs, 'makeDir'],
    [ak.fs, 'write'],
    [ak.fs, 'rename'],
    [ak.fs, 'copyFile'],
    [ak.db, 'getAdminedApps', ak],
    [ak.db, 'getDevelopedApps', ak],
    [ak.db, 'getAppsByLabel', ak]
  ].forEach(
    function (args) {
      var owner = args[0];
      var name = args[1];
      var func = owner['_' + name];
      (args[2] || owner)[name] = function () {
        return func.apply(owner, arguments);
      };
    });


  ak.number = ak.db._number;
  ak.string = ak.db._string;
  ak.bool = ak.boolean_ = ak['boolean'] = ak.db._boolean;
  ak.date = ak.db._date;

  //////////////////////////////////////////////////////////////////////////////
  // DB
  //////////////////////////////////////////////////////////////////////////////

  ak.isList = function (x) {
    return (x &&
            typeof(x) == 'object' &&
            typeof(x.length) == 'number' &&
            x.length % 1 == 0 &&
            x.length >= 0);
  };


  function getArrayLike(args, index) {
    if (args.length != index + 1)
      return Array.prototype.slice.call(args, index);
    var arg = args[index];
    return ak.isList(arg) ? arg : [arg];
  }


  ak.db.query = function (query, options/* = {} */) {
    options = options || {};
    return ak.db._query(
      query,
      options.params || [],
      typeof(options.by) == 'string' ? [options.by] : options.by || [],
      options.byParams || [],
      options.start || 0,
      options.length);
  };


  ak.db.count = function(query/*, params... */) {
    return ak.db._count(query, getArrayLike(arguments, 1));
  };


  ak.db.create = function (name, header, constrs/* = {} */) {
    constrs = constrs || {};
    ak.db._create(name,
                  header,
                  constrs.unique || [],
                  constrs.foreign || [],
                  constrs.check || []);
    ak.rv[name] = {name: name, __proto__: ak.RelVar.prototype};
  };


  ak.db.drop = function (/* names... */) {
    var names = getArrayLike(arguments, 0);
    ak.db._drop(names);
    for (var i = 0; i < names.length; ++i)
      delete ak.rv[names[i]];
  };


  ak.Selection = function (name, expr/*, params... */) {
    this.name = name;
    this.expr = expr;
    this.params = getArrayLike(arguments, 2);
  };

  ak.Selection.prototype = {
    get rv() {
      return ak.rv[this.name];
    },

    get: function (options/* = {}, byParams... */) {
      options = options || {};
      var attrs = '';
      if (options.attr)
        attrs = '.' + options.attr;
      if (options.only)
        attrs = '[' + options.only.join(',') + ']';
      var tuples =  ak.db.query(this.name + attrs + ' where ' + this.expr,
                                {
                                  params: this.params,
                                  by: options.by,
                                  byParams: getArrayLike(arguments, 1),
                                  start: options.start,
                                  length: options.length
                                });
      return (options.attr
              ? tuples.map(function (tuple) { return tuple[options.attr]; })
              : tuples);
    },

    count: function () {
      return ak.db.count(this.name + ' where ' + this.expr, this.params);
    },

    del: function () {
      return ak.db._del(this.name, this.expr, this.params);
    },

    update: function (exprs/*, exprParams... */) {
      return ak.db._update(
        this.name, this.expr, this.params, exprs, getArrayLike(arguments, 1));
    },

    set: function (values) {
      var index = 0;
      var exprs = {};
      var exprParams = [];
      for (var name in values) {
        exprs[name] = '$' + (++index);
        exprParams.push(values[name]);
      }
      return this.update(exprs, exprParams);
    }
  };


  ak.RelVar = function () {
    throw new ak.UsageError('RelVar objects should be obtained through ak.rv');
  };

  ak.RelVar.prototype = {
    drop: function () {
      ak.db.drop(this.name);
    },

    where: function (expr/*, params */) {
      if (typeof(expr) != 'object' || arguments.length > 1)
        return new ak.Selection(this.name, expr, getArrayLike(arguments, 1));
      var index = 0;
      var parts = [];
      var params = [];
      for (var attr in expr) {
        parts.push(attr + '==$' + (++index));
        params.push(expr[attr]);
      }
      return new ak.Selection(this.name, parts.join('&&'), params);
    },

    all: function () {
      return this.where('true');
    },

    insert: function (values) {
      return ak.db._insert(this.name, values);
    },

    get default_() {
      return this['default'];
    }
  };

  ['header', 'integer', 'serial', 'unique', 'foreign', 'default'].forEach(
    function (propName) {
      var cachedName = '_' + propName;
      var funcName = '_get' + propName[0].toUpperCase() + propName.substr(1);
      ak.RelVar.prototype.__defineGetter__(
        propName,
        function () {
          if (!this[cachedName]) {
            this[cachedName] = ak.db[funcName](this.name);
            if (this[cachedName] instanceof Array)
              this[cachedName].sort();
          }
          return this[cachedName];
        });
    });


  ak.rv = {};

  ak.db._list().forEach(
    function (name) {
      ak.rv[name] = {name: name, __proto__: ak.RelVar.prototype};
    });

  //////////////////////////////////////////////////////////////////////////////
  // Misc
  //////////////////////////////////////////////////////////////////////////////

  // Dates should be in UTC on the server
  Date.prototype.toString = Date.prototype.toUTCString;


  ak.Data.prototype.toString = function (encoding) {
    return this._toString(encoding || 'UTF-8');
  };


  ak.describeApp = function (name) {
    var result = ak.db._describeApp(name);
    result.name = name;
    result.developers.unshift(result.admin);
    return result;
  };


  ak.fs.remove = function (path) {
    if (ak.fs.isDir(path)) {
      var children = ak.fs.list(path);
      for (var i = 0; i < children.length; ++i)
        arguments.callee(path + '/' + children[i]);
    }
    ak.fs._remove(path);
  };


  ak.TempFile.prototype.read = function () {
    return ak.fs.read(this);
  };


  ak.requestApp = function (appName, request) {
    var realRequest = {
      method: request.method || 'GET',
      path: request.path || '',
      get: request.get || {},
      post: request.post || {},
      headers: request.headers || {},
      fileNames: []
    };
    var filePathes = [];
    var files = request.files || {};
    for (var fileName in files) {
      realRequest.fileNames.push(fileName);
      filePathes.push(files[fileName]);
    }
    var responseString = ak._requestApp(appName,
                                        JSON.stringify(realRequest),
                                        filePathes,
                                        request.data || '');
    var head = responseString.split('\n\n', 1)[0];
    if (head.length == responseString.length)
      throw new ak.AppRequestError('Response without a head');
    var content = responseString.substr(head.length + 2);
    var statusString = head.split('\n', 1)[0];
    var status = +statusString;
    if (!status)
      throw new ak.AppRequestError('Invalid status: "' + statusString + '"');
    var headersString = head.substr(statusString.length + 1);
    var headers = {};
    if (headersString)
      headersString.split('\n').forEach(
        function (headerLine) {
          var name = headerLine.split(': ', 1)[0];
          if (name.length == headerLine.length)
            throw new ak.AppRequestError(
              'Invalid header line: "' + headerLine + '"');
          headers[name] = headerLine.substr(name.length + 2);
        });
    return new ak.Response(content, status, headers);
  };

  //////////////////////////////////////////////////////////////////////////////
  // Request handling
  //////////////////////////////////////////////////////////////////////////////

  ak.defaultHeaders = {'Content-Type': 'text/html; charset=utf-8'};


  ak.Response = function (content/* = '' */,
                          status/* = 200 */,
                          headers/* = ak.defaultHeaders */) {
    this.content = content || '';
    this.status = status || 200;
    this.headers = headers || ak.defaultHeaders;
  };


  ak.Request = function (object) {
    for (var key in object)
      this[key] = object[key];
  };

  ak.Request.prototype = {
    get uri() {
      return 'http://' + this.headers.Host + '/' + this.fullPath;
    }
  };


  ak._main = function (data) {
    var request = eval('(' + data + ')');
    request.__proto__ = ak.Request.prototype;
    request.method = request.method.toLowerCase();
    request.data = ak._data;
    request.user = ak._user;
    request.files = {};
    // request.fileNames.length and ak._files.length are guaranteed to be equal
    for (var i = 0; i < ak._files.length; ++i)
      request.files[request.fileNames[i]] = ak._files[i];
    delete request.fileNames;
    request.issuer = ak._issuer;

    var response = __main__(request);
    var headerLines = [];
    for (var name in response.headers)
      headerLines.push(name + ': ' + response.headers[name]);
    return (response.status + '\n' +
            headerLines.join('\n') +
            '\n\n' + response.content);
  };

})();
