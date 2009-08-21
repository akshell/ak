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
  function publish(constructor, name) {
    constructor.prototype[name] = constructor.prototype['_' + name];
  }

  publish(ak.AK, 'setObjectProp');
  publish(ak.App, 'call');
  publish(ak.Type, 'int');
  publish(ak.Type, 'serial');
  publish(ak.Type, 'default');
  publish(ak.Type, 'unique');
  publish(ak.Type, 'foreign');
  publish(ak.Type, 'check');
  publish(ak.Query, 'perform');
  publish(ak.Query, 'only');
  publish(ak.Query, 'where');
  publish(ak.Query, 'by');
  publish(ak.SubRel, 'update');
  publish(ak.SubRel, 'del');
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


  // Property access modes for ak.setObjectProp
  // Could be combined using '|' operator.
  ak.NONE        = 0;
  ak.READ_ONLY   = 1 << 0;
  ak.DONT_ENUM   = 1 << 1;
  ak.DONT_DELETE = 1 << 2;


  // SubRel is inherited from Query
  ak.SubRel.prototype.__proto__ = ak.Query.prototype;


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
    ak.Query.prototype, 'whose', ak.DONT_ENUM,
    function () {
      var query = this.where.apply(this, arguments);
      if (query.length != 1)
        throw Error('whose() query got ' + query.length + ' tuples');
      return query[0];
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
    ak.Rel.prototype[func_name] = function () {
      return ak.SubRel.prototype[func_name].apply(this.all(), arguments);
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


  ak._main = function () {
    // TODO
  };

})();

