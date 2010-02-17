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


  ak.Handler = Object.subclass(
    {
      handle: function (request/*, args... */) {
        if (['get', 'post', 'head', 'put', 'delete']
            .indexOf(request.method) != -1) {
          var name = request.method == 'delete' ? 'del' : request.method;
          if (this.__proto__.hasOwnProperty(name))
            return this[name].apply(this, arguments);
        }
        if (this.__proto__.hasOwnProperty('perform'))
          return this.perform.apply(this, arguments);
        throw ak.HttpError(
          'Method ' + request.method + ' is not allowed',
          ak.http.METHOD_NOT_ALLOWED);
      }
    });


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
      protectingFromCSRF: function (func) {
        return function (request) {
          if (request.method == 'post' &&
              request.csrfToken &&
              request.post.csrfToken != request.csrfToken)
            return new ak.Response(
              'Cross Site Request Forgery detected. Request aborted.',
              ak.http.FORBIDDEN);
          ak.template.env.tags.csrfToken.value = request.csrfToken;
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
            return new ak.Response(template.render({error: error}),
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
            throw ak.NotFoundError(error.message);
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
      }
    });


  ak.defaultServe = ak.serve.decorated(
    ak.serve.protectingFromCSRF,
    ak.serve.catchingHttpError,
    ak.serve.catchingTupleDoesNotExist,
    ak.serve.appendingSlash
  );

})();
