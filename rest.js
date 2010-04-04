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
  ak.include('template.js');

  //////////////////////////////////////////////////////////////////////////////
  // Handler
  //////////////////////////////////////////////////////////////////////////////

  ak.Handler = Object.subclass(
    {
      handle: function (request/*, args... */) {
        if (['get', 'post', 'head', 'put', 'delete']
            .indexOf(request.method) != -1) {
          var name = request.method == 'delete' ? 'del' : request.method;
          if (this.__proto__.hasOwnProperty(name) &&
              typeof(this[name]) == 'function')
            return this[name].apply(this, arguments);
        }
        if (this.__proto__.hasOwnProperty('perform') &&
            typeof(this.perform) == 'function')
          return this.perform.apply(this, arguments);
        throw ak.HttpError(
          'Method ' + request.method + ' is not allowed',
          ak.http.METHOD_NOT_ALLOWED);
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // Handler decorators
  //////////////////////////////////////////////////////////////////////////////

  function makeHandlerDecorator(decorator) {
    return function (handler) {
      if (!handler.subclassOf(ak.Handler))
        return decorator(handler).wraps(handler);
      var func = handler.prototype.handle;
      handler.prototype.handle = decorator(func).wraps(func);
      return handler;
    };
  }


  ak.loggingIn = makeHandlerDecorator(
    function (func) {
      return function (request/*, args... */) {
        return (request.user
                ? func.apply(this, arguments)
                : ak.redirect(ak.reverse('login', request.fullPath)));
      };
    });


  ak.obtainingSession = makeHandlerDecorator(
    function (func) {
      return function (request/*, args... */) {
        return (request.session !== ''
                ? func.apply(this, arguments)
                : ak.redirect(ak.reverse('session', request.fullPath)));
      };
    });

  //////////////////////////////////////////////////////////////////////////////
  // serve(), middleware, and defaultServe()
  //////////////////////////////////////////////////////////////////////////////

  ak.serve = function (request) {
    var pair = ak.resolve(request.path);
    var handler = pair[0];
    var args = [request].concat(pair[1]);
    if (handler.subclassOf(ak.Handler)) {
      handler = ak.construct(handler, args);
      return handler.handle.apply(handler, args);
    } else {
      return handler.apply(ak.global, args);
    }
  };


  ak.serve.update(
    {
      protectingFromICAR: function (func) {
        return function (request) {
          return (!request.issuer || request.legal
                  ? func(request)
                  : new ak.Response('Illegal cross-application request',
                                    ak.http.FORBIDDEN));
        };
      },

      protectingFromCSRF: function (func) {
        return function (request) {
          if (request.method == 'post' &&
              request.csrfToken &&
              request.post.csrfToken != request.csrfToken)
            return new ak.Response(
              'Cross-site request forgery detected. Request aborted.',
              ak.http.FORBIDDEN);
          ak.template.csrfToken = request.csrfToken;
          return func(request);
        };
      },

      catchingHttpError: function (func) {
        return function (request) {
          try {
            return func(request);
          } catch (error) {
            if (!(error instanceof ak.HttpError)) throw error;
            var template;
            try {
              template = ak.getTemplate('error.html');
            } catch (_) {
              template = new ak.Template('{{ error.message }}');
            }
            return new ak.Response(
              template.render({error: error, request: request}),
              error.status);
          }
        };
      },

      catchingTupleDoesNotExist: function (func) {
        return function (request) {
          try {
            return func(request);
          } catch (error) {
            if (!(error instanceof ak.TupleDoesNotExist)) throw error;
            throw ak.NotFound(error.message);
          }
        };
      },

      appendingSlash: function (func) {
        return function (request) {
          try {
            return func(request);
          } catch (error) {
            if (!(error instanceof ak.ResolveError)) throw error;
            try {
              ak.resolve(request.path + '/');
            } catch (_) {
              throw error;
            }
            return new ak.Response(
              '',
              ak.http.MOVED_PERMANENTLY,
              {Location: request.path + '/'});
          }
        };
      },

      rollbacking: function (func) {
        return function (request) {
          try {
            return func(request);
          } catch (error) {
            ak.db.rollback();
            throw error;
          }
        };
      }
    });


  ak.defaultServe = ak.serve.decorated(
    ak.serve.protectingFromICAR,
    ak.serve.protectingFromCSRF,
    ak.serve.catchingHttpError,
    ak.serve.catchingTupleDoesNotExist,
    ak.serve.appendingSlash,
    ak.serve.rollbacking
  );

})();
