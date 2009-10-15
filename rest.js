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
  ak.include('template.js');

  //////////////////////////////////////////////////////////////////////////////
  // Utils
  //////////////////////////////////////////////////////////////////////////////

  ak.renderToResponse = function (name,
                                  context/* = {} */,
                                  status/* = 200 */,
                                  headers/* = ak.defaultHeaders */) {
    return new ak.Response(ak.getTemplate(name).render(context),
                           status,
                           headers);
  };


  ak.redirect = function (to /* ... */) {
    return new ak.Response(
      '',
      ak.http.FOUND,
      {
        Location: (typeof(to) == 'string'
                   ? to
                   : ak.reverse.apply(this, arguments))
      });
  };

  //////////////////////////////////////////////////////////////////////////////
  // Rel, Selection and RelVar get() method
  //////////////////////////////////////////////////////////////////////////////

  ak.TupleNotFoundError = ak.NotFoundError.subclass();
  ak.MultipleTuplesError = ak.BaseError.subclass();


  function getUnitupleRel(rel, whereArgs) {
    var result = rel.where.apply(rel, whereArgs.length ? whereArgs : ['true']);
    if (!result.length)
      throw new ak.TupleNotFoundError();
    if (result.length > 1)
      throw new ak.MultipleTuplesError();
    return result;
  }


  ak.Rel.prototype.setNonEnumerable(
    'get',
    function (/* arguments... */) {
      return getUnitupleRel(this, arguments)[0];
    });


  var tupleMixin = {};

  [
    'update',
    'set',
    'del'
  ].forEach(
    function (name) {
      var func = ak.Selection.prototype[name];
      tupleMixin[name] = function (/* arguments */) {
        return func.apply(this.$, arguments);
      };
    });


  ak.Selection.prototype.setNonEnumerable(
    'get',
    function (/* arguments... */) {
      var selection = getUnitupleRel(this, arguments);
      result = selection[0];
      ak.setObjectProp(result, '$', ak.DONT_ENUM, selection);
      for (var name in tupleMixin)
        if (!(name in result))
          ak.setObjectProp(result, name, ak.DONT_ENUM, tupleMixin[name]);
      return result;
    });


  ak.RelVar.prototype.get = function (/* arguments... */) {
    return ak.Selection.prototype.get.apply(this.all(), arguments);
  };

  //////////////////////////////////////////////////////////////////////////////
  // Controller
  //////////////////////////////////////////////////////////////////////////////

  ak.Controller = Object.subclass(
    {
      respond: function (pageName/* = '' */) {
        pageName = pageName || '';
        var methodProp = this.request.method + pageName;
        if (this.__proto__.hasOwnProperty(methodProp))
          return this[methodProp].apply(this, this.args);
        var handleProp = 'handle' + pageName;
        if (this.__proto__.hasOwnProperty(handleProp))
          return this[handleProp].apply(this, this.args);
        throw new ak.HttpError(
          'Method ' + this.request.method + ' is not allowed',
          ak.http.METHOD_NOT_ALLOWED);
      }
    });


  ak.Controller.instances(
    ak.ControllerMeta = Function.subclass(
      {
        page: function (name) {
          if (!name)
            return this;
          this._pages = this._pages || {};
          if (name in this._pages)
            return this._pages[name];
          var controller = this;
          var result = function (/* arguments... */) {
            return ak.construct(controller, arguments).respond(name);
          };
          result.__defineGetter__(
            '__name__',
            function () {
              return controller.__name__ + '#' + name;
            });
          this._pages[name] = result;
          return result;
        },

        subclass: function (/* arguments... */) {
          var constructor = Function.prototype.subclass.apply(this, arguments);
          return function (request /* ... */) {
            if (!(this instanceof arguments.callee))
              return ak.construct(arguments.callee, arguments).respond();
            this.request = request;
            constructor.apply(this, arguments);
            this.args = this.args || [request];
            return undefined;
          }.wraps(constructor);
        }
      }));

  //////////////////////////////////////////////////////////////////////////////
  // serve() and defaultServe()
  //////////////////////////////////////////////////////////////////////////////

  ak.serve = function (request, root/* = ak.rootRoute */) {
    root = root || ak.getRootRoute();
    var resolveInfo = root.resolve(request.path);
    var controller = resolveInfo[0];
    var args = [request].concat(resolveInfo[1]);
    return controller.apply(ak.global, args);
  };


  ak.update(
    ak.serve,
    {
      catchingHttpErrors: function (serve) {
        return function (/* arguments... */) {
          try {
            return serve.apply(this, arguments);
          } catch (error) {
            if (!(error instanceof ak.HttpError))
              throw error;
            var template;
            try {
              template = ak.getTemplate('error.html');
            } catch (_) {
              template = new ak.Template('{{ error.message }}');
            }
            return new ak.Response(template.render({error: error}),
                                   error.status);
          }
        };
      },

      appendingSlash: function (serve) {
        return function (request, root) {
          try {
            return serve.apply(this, arguments);
          } catch (error) {
            if (!(error instanceof ak.ResolveError))
              throw error;
            try {
              (root || ak.rootRoute).resolve(request.path + '/');
            } catch (_) {
              throw error;
            }
            return new ak.Response(
              '',
              ak.http.MOVED_PERMANENTLY,
              {Location: ak.rootPrefix + request.path + '/'});
          }
        };
      }
    });


  ak.defaultServe = ak.serve.decorated(
    ak.serve.catchingHttpErrors,
    ak.serve.appendingSlash
  );

})();
