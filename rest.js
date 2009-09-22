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
  var base = ak.include('base.js');
  var iter = ak.include('iter.js');
  var url = ak.include('url.js');
  var http = ak.include('http.js');
  var template = ak.include('template.js');

  var $ = base.module('ak.rest');


  $.Controller = base.makeClass(
    function (request) {
      this.request = request;
    },
    {
      respond: function () {
        var func = this[this.request.method.toLowerCase()];
        if (typeof(func) == 'function')
          return func.call(this);
        if (typeof(this.handle) == 'function')
          return this.handle();
        return new ak.Response('', http.METHOD_NOT_ALLOWED);
      }
    });


  $.serve = function (request, root/* = url.root */) {
    root = root || url.getRoot();
    var resolveInfo = root.resolve(request.path);
    var controller = resolveInfo[0];
    var args = [request].concat(resolveInfo[1]);
    return (typeof(controller.prototype.respond) == 'function'
            ? base.factory(controller).apply(base.global, args).respond()
            : controller.apply(base.global, args));
  };


  $.middleware = {
    appendSlash: function (serve) {
      return function (request, root) {
        try {
          return serve.apply(this, arguments);
        } catch (error) {
          if (!(error instanceof url.ResolveError))
            throw error;
          try {
            (root || url.root).resolve(request.path + '/');
          } catch (_) {
            throw error;
          }
          return new ak.Response('',
                                 http.MOVED_PERMANENTLY,
                                 {'Location': url.prefix + request.path + '/'});
        }
      };
    },

    notFound: function (serve) {
      return function (/* arguments... */) {
        try {
          return serve.apply(this, arguments);
        } catch (error) {
          if (!(error instanceof http.NotFoundError))
            throw error;
          var t;
          try {
            t = template.getTemplate('404.html');
          } catch (_) {
            t = new template.Template('Not found');
          }
          return new ak.Response(t.render({error: error}),
                                 http.NOT_FOUND);
        }
      };
    }
  };


  $.defaultServe = $.serve.decorated(
    $.middleware.notFound,
    $.middleware.appendSlash);


  base.nameFunctions($);
  return $;
})();
