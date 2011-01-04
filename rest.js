// Copyright (c) 2009-2011, Anton Korenyushkin
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

require('jsgi');
var core = require('core');
var db = require('db');
var Binary = require('binary').Binary;
var base = require('base');
var rv = require('rv');
var http = require('http');
var url = require('url');
var template = require('template');

//////////////////////////////////////////////////////////////////////////////
// Request, Response, redirect() and render()
//////////////////////////////////////////////////////////////////////////////

exports.Request = Object.subclass(
  {
    get cookies() {
      if (!this._cookies) {
        this._cookies = {};
        if (this.headers.cookie) {
          this.headers.cookie.split(/[;,] */).forEach(
            function (part) {
              var nv = part.split('=');
              if (nv.length == 2)
                this._cookies[decodeURIComponent(nv[0])] =
                  decodeURIComponent(nv[1]);
            },
            this);
        }
      }
      return this._cookies;
    }
  });


function addProp(object, name, value) {
  if (!object.hasOwnProperty(name))
    object[name] = value;
  else if (object[name] instanceof Array)
    object[name].push(value);
  else
    object[name] = [object[name], value];
}


exports.Response = Object.subclass(
  function (content/* = '' */,
            status/* = http.OK */,
            headers/* optional */) {
    this.content = content || '';
    this.status = status || http.OK;
    this.headers = headers || {'Content-Type': 'text/html; charset=utf-8'};
  },
  {
    setCookie: function (name, value/* = '' */, options/* = {} */) {
      var cookie = encodeURIComponent(name) + '=';
      if (value)
        cookie += encodeURIComponent(value);
      if (options) {
        if (options.domain)
          cookie += '; domain=' + options.domain;
        if (options.path)
          cookie += '; path=' + options.path;
        if (options.expires)
          cookie += 
            '; expires=' +
            options.expires.toString('ddd, dd-MMM-yyyy HH:mm:ss') + ' GMT';
        if (options.secure)
          cookie += '; secure';
        if (options.httpOnly)
          cookie += '; HttpOnly';
      }
      addProp(this.headers, 'Set-Cookie', cookie);
    }
  });


exports.redirect = function (location) {
  return new exports.Response('', http.FOUND, {Location: location});
};


exports.render = function (name,
                           context/* = {} */,
                           status/* = http.OK */,
                           headers/* optional */) {
  return new exports.Response(template.getTemplate(name).render(context),
                              status,
                              headers);
};

//////////////////////////////////////////////////////////////////////////////
// Handler
//////////////////////////////////////////////////////////////////////////////

exports.Handler = Object.subclass(
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
      throw http.Failure(
        'Method ' + request.method + ' is not allowed',
        http.METHOD_NOT_ALLOWED);
    }
  });

//////////////////////////////////////////////////////////////////////////////
// main.app(), serve(), middleware, and main.main()
//////////////////////////////////////////////////////////////////////////////

function parseURLEncodedData(data) {
  var result = {};
  data.split(/[&;]/).forEach(
    function (part) {
      var nv = part.split('=');
      if (nv.length == 2)
        addProp(result, decodeURIComponent(nv[0]), decodeURIComponent(nv[1]));
    });
  return result;
}


require.main.exports.app = function (jsgi) {
  var fullPath = 
    jsgi.queryString ? jsgi.pathInfo + '?' + jsgi.queryString : jsgi.pathInfo;
  var request = {
    __proto__: exports.Request.prototype,
    method: jsgi.method.toLowerCase(),
    path: jsgi.pathInfo,
    fullPath: fullPath,
    uri: 'http://' + jsgi.host + fullPath,
    get: jsgi.queryString ? parseURLEncodedData(jsgi.queryString) : {},
    post:
      jsgi.headers['content-type'] == 'application/x-www-form-urlencoded'
      ? parseURLEncodedData(jsgi.input + '')
      : {},
    headers: jsgi.headers,
    data: jsgi.input,
  };
  var response = require.main.exports.main(request);
  response.body = [response.content];
  if (request._cookies) {
    if (!response.headers.Vary)
      response.headers.Vary = 'Cookie';
    else if (response.headers.Vary.indexOf('Cookie') == -1)
      response.headers.Vary += ', Cookie';
  }
  return response;
};


exports.serve = function (request) {
  var pair = url.resolve(request.path);
  var handler = pair[0];
  var args = [request].concat(pair[1]);
  if (handler.subclassOf(exports.Handler)) {
    handler = core.construct(handler, args);
    return handler.handle.apply(handler, args);
  } else {
    return handler.apply(base.global, args);
  }
};


exports.protectingFromCSRF = function (func) {
  return function (request) {
    if (request.method == 'post' &&
        request.headers['x-requested-with'] != 'XMLHttpRequest' &&
        request.post.csrfToken != request.cookies.csrfToken)
      return new exports.Response(
        ('<p>Please use the <code>{% csrfToken %}</code> ' +
         'tag in POST forms like this:</p>' +
         '<pre>&lt;form method="post" ...&gt;\n' +
         '  {% csrfToken %}\n  ...\n&lt;/form&gt;</pre>'),
        http.FORBIDDEN);
    var csrfToken;
    template.getCsrfToken = function () {
      if (request.cookies.csrfToken)
        return request.cookies.csrfToken;
      if (!csrfToken)
        csrfToken = new Binary(Math.random() + '').md5();
      return csrfToken;
    };
    var response = func(request);
    if (csrfToken)
      response.setCookie(
        'csrfToken', csrfToken, {expires: new Date(2e12)});
    return response;
  };
};


exports.catchingFailure = function (func) {
  return function (request) {
    try {
      return func(request);
    } catch (error) {
      if (!(error instanceof http.Failure)) throw error;
      var t;
      try {
        t = template.getTemplate('error.html');
      } catch (_) {
        t = new template.Template('{{ error.message }}');
      }
      return new exports.Response(
        t.render({error: error, request: request}),
        error.status);
    }
  };
};


exports.catchingTupleDoesNotExist = function (func) {
  return function (request) {
    try {
      return func(request);
    } catch (error) {
      if (!(error instanceof rv.TupleDoesNotExist)) throw error;
      throw http.NotFound(error.message);
    }
  };
};


exports.appendingSlash = function (func) {
  return function (request) {
    try {
      return func(request);
    } catch (error) {
      if (!(error instanceof url.ResolveError)) throw error;
      try {
        url.resolve(request.path + '/');
      } catch (_) {
        throw error;
      }
      return new exports.Response(
        '',
        http.MOVED_PERMANENTLY,
        {Location: request.path + '/'});
    }
  };
};


exports.rollbacking = function (func) {
  return function (request) {
    try {
      return func(request);
    } catch (error) {
      db.rollback();
      throw error;
    }
  };
};


require.main.exports.main = exports.defaultServe = exports.serve.decorated(
  exports.protectingFromCSRF,
  exports.catchingFailure,
  exports.catchingTupleDoesNotExist,
  exports.appendingSlash,
  exports.rollbacking
);
