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
var socket = require('socket');
var Binary = require('binary').Binary;
var HttpParser = require('http-parser').HttpParser;
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
      cookie += '; path=' + (options && options.path || '/');
      if (options) {
        if (options.domain)
          cookie += '; domain=' + options.domain;
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

function decodeURIPlus(string) {
  return decodeURIComponent(string.replace(/\+/g, ' '));
}


function parseURLEncodedData(data) {
  var result = {};
  data.split(/[&;]/).forEach(
    function (part) {
      var nv = part.split('=');
      if (nv.length == 2)
        addProp(result, decodeURIPlus(nv[0]), decodeURIPlus(nv[1]));
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
  if (request._cookies &&
      (request.method == 'get' || request.method == 'head')) {
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


var contentTypes = {
  'a'      : 'application/octet-stream',
  'ai'     : 'application/postscript',
  'aif'    : 'audio/x-aiff',
  'aifc'   : 'audio/x-aiff',
  'aiff'   : 'audio/x-aiff',
  'au'     : 'audio/basic',
  'avi'    : 'video/x-msvideo',
  'bat'    : 'text/plain',
  'bcpio'  : 'application/x-bcpio',
  'bin'    : 'application/octet-stream',
  'bmp'    : 'image/x-ms-bmp',
  'c'      : 'text/plain',
  'cdf'    : 'application/x-cdf',
  'cpio'   : 'application/x-cpio',
  'csh'    : 'application/x-csh',
  'css'    : 'text/css',
  'dll'    : 'application/octet-stream',
  'doc'    : 'application/msword',
  'dot'    : 'application/msword',
  'dvi'    : 'application/x-dvi',
  'eml'    : 'message/rfc822',
  'eps'    : 'application/postscript',
  'etx'    : 'text/x-setext',
  'exe'    : 'application/octet-stream',
  'gif'    : 'image/gif',
  'gtar'   : 'application/x-gtar',
  'h'      : 'text/plain',
  'hdf'    : 'application/x-hdf',
  'htm'    : 'text/html',
  'html'   : 'text/html',
  'ief'    : 'image/ief',
  'jpe'    : 'image/jpeg',
  'jpeg'   : 'image/jpeg',
  'jpg'    : 'image/jpeg',
  'js'     : 'application/x-javascript',
  'ksh'    : 'text/plain',
  'latex'  : 'application/x-latex',
  'm1v'    : 'video/mpeg',
  'man'    : 'application/x-troff-man',
  'me'     : 'application/x-troff-me',
  'mht'    : 'message/rfc822',
  'mhtml'  : 'message/rfc822',
  'mif'    : 'application/x-mif',
  'mov'    : 'video/quicktime',
  'movie'  : 'video/x-sgi-movie',
  'mp2'    : 'audio/mpeg',
  'mp3'    : 'audio/mpeg',
  'mp4'    : 'video/mp4',
  'mpa'    : 'video/mpeg',
  'mpe'    : 'video/mpeg',
  'mpeg'   : 'video/mpeg',
  'mpg'    : 'video/mpeg',
  'ms'     : 'application/x-troff-ms',
  'nc'     : 'application/x-netcdf',
  'nws'    : 'message/rfc822',
  'o'      : 'application/octet-stream',
  'obj'    : 'application/octet-stream',
  'oda'    : 'application/oda',
  'p12'    : 'application/x-pkcs12',
  'p7c'    : 'application/pkcs7-mime',
  'pbm'    : 'image/x-portable-bitmap',
  'pdf'    : 'application/pdf',
  'pfx'    : 'application/x-pkcs12',
  'pgm'    : 'image/x-portable-graymap',
  'pl'     : 'text/plain',
  'png'    : 'image/png',
  'pnm'    : 'image/x-portable-anymap',
  'pot'    : 'application/vnd.ms-powerpoint',
  'ppa'    : 'application/vnd.ms-powerpoint',
  'ppm'    : 'image/x-portable-pixmap',
  'pps'    : 'application/vnd.ms-powerpoint',
  'ppt'    : 'application/vnd.ms-powerpoint',
  'ps'     : 'application/postscript',
  'pwz'    : 'application/vnd.ms-powerpoint',
  'py'     : 'text/x-python',
  'pyc'    : 'application/x-python-code',
  'pyo'    : 'application/x-python-code',
  'qt'     : 'video/quicktime',
  'ra'     : 'audio/x-pn-realaudio',
  'ram'    : 'application/x-pn-realaudio',
  'ras'    : 'image/x-cmu-raster',
  'rdf'    : 'application/xml',
  'rgb'    : 'image/x-rgb',
  'roff'   : 'application/x-troff',
  'rtx'    : 'text/richtext',
  'sgm'    : 'text/x-sgml',
  'sgml'   : 'text/x-sgml',
  'sh'     : 'application/x-sh',
  'shar'   : 'application/x-shar',
  'snd'    : 'audio/basic',
  'so'     : 'application/octet-stream',
  'src'    : 'application/x-wais-source',
  'sv4cpio': 'application/x-sv4cpio',
  'sv4crc' : 'application/x-sv4crc',
  'swf'    : 'application/x-shockwave-flash',
  't'      : 'application/x-troff',
  'tar'    : 'application/x-tar',
  'tcl'    : 'application/x-tcl',
  'tex'    : 'application/x-tex',
  'texi'   : 'application/x-texinfo',
  'texinfo': 'application/x-texinfo',
  'tif'    : 'image/tiff',
  'tiff'   : 'image/tiff',
  'tr'     : 'application/x-troff',
  'tsv'    : 'text/tab-separated-values',
  'txt'    : 'text/plain',
  'ustar'  : 'application/x-ustar',
  'vcf'    : 'text/x-vcard',
  'wav'    : 'audio/x-wav',
  'wiz'    : 'application/msword',
  'wsdl'   : 'application/xml',
  'xbm'    : 'image/x-xbitmap',
  'xlb'    : 'application/vnd.ms-excel',
  'xls'    : 'application/vnd.ms-excel',
  'xml'    : 'text/xml',
  'xpdl'   : 'application/xml',
  'xpm'    : 'image/x-xpixmap',
  'xsl'    : 'application/xml',
  'xwd'    : 'image/x-xwindowdump',
  'zip'    : 'application/zip'
}

exports.servingStaticFiles = function (func) {
  return function (request) {
    if (!request.path.startsWith(template.staticURLPrefix))
      return func(request);
    var descr = request.path.substring(template.staticURLPrefix.length);
    var storage = require.main.storage;
    var content;
    var cacheControl;
    if (storage.repo) {
      var slashIndex = descr.indexOf('/');
      if (slashIndex == -1)
        throw http.NotFound();
      var commit = descr.substring(0, slashIndex);
      var path = descr.substring(slashIndex + 1);
      try {
        content = storage.repo.getStorage(commit).read(
          template.staticPathPrefix + path);
      } catch (_) {
        throw http.NotFound();
      }
      cacheControl = 'max-age=315360000';
    } else {
      try {
        content = storage.read(template.staticPathPrefix + descr);
      } catch (_) {
        throw http.NotFound();
      }
      cacheControl = 'no-cache';
    }
    var contentType = 'application/octet-stream';
    var dotIndex = descr.lastIndexOf('.');
    if (dotIndex != -1) {
      var extension = descr.substring(dotIndex + 1).toLowerCase();
      if (contentTypes.hasOwnProperty(extension))
        contentType = contentTypes[extension];
    }
    return new exports.Response(
      content,
      http.OK,
      {
        'Cache-Control': cacheControl,
        'Content-Type': contentType
      });
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
  exports.servingStaticFiles,
  exports.catchingTupleDoesNotExist,
  exports.appendingSlash,
  exports.rollbacking
);

//////////////////////////////////////////////////////////////////////////////
// requestHost
//////////////////////////////////////////////////////////////////////////////

function encodeParams(params) {
  var parts = [];
  for (var name in params) {
    var values = params[name];
    if (!(values instanceof Array))
      values = [values];
    values.forEach(
      function (value) {
        parts.push(
          encodeURIComponent(name) + '=' + encodeURIComponent(value));
      });
  }
  return parts.join('&');
}

exports.requestHost = function (host, request) {
  if (request.data && request.post)
    throw core.ValueError('data and post cannot be specified together');
  var sock = socket.connect(host, 80);

  var requestHeaders = {
    'Connection': 'close',
    'Accept-Charset': 'utf-8',
    'Accept-Encoding': 'identity',
    'Host': host
  };
  var data;
  if (request.data) {
    data =
      request.data instanceof Binary
      ? request.data
      : new Binary(request.data);
  } else if (request.post) {
    data = new Binary(encodeParams(request.post));
    requestHeaders['Content-Type'] = 'application/x-www-form-urlencoded';
  }
  if (data)
    requestHeaders['Content-Length'] = data.length;
  if (request.headers)
    for (var name in request.headers)
      requestHeaders[name] = request.headers[name];
  var path = request.path || '/';
  if (request.get)
    path += '?' + encodeParams(request.get);
  var method = request.method ? request.method.toUpperCase() : 'GET';
  var parts = [method + ' ' + path + ' HTTP/1.1'];
  for (var name in requestHeaders) {
    var values = requestHeaders[name];
    if (!(values instanceof Array))
      values = [values];
    values.forEach(function (value) { parts.push(name + ': ' + value); });
  }
  parts.push('\r\n');

  sock.write(parts.join('\r\n'));
  if (data)
    sock.write(data);

  var name = '';
  var value;
  var status;
  var responseHeaders = {};
  var contentParts = [];
  var complete = false;

  function addHeader() {
    name = name.toLowerCase();
    if (responseHeaders.hasOwnProperty(name))
      responseHeaders[name] += ',' + value;
    else
      responseHeaders[name] = value;
  }

  var parser = new HttpParser(
    'response',
    {
      onHeaderField: function (part) {
        if (value === undefined) {
          name += part;
        } else {
          addHeader();
          name = part + '';
          value = undefined;
        }
      },

      onHeaderValue: function (part) {
        value = (value || '') + part;
      },

      onHeadersComplete: function (info) {
        if (value !== undefined)
          addHeader();
        status = info.status;
      },
      
      onBody: function (part) {
        contentParts.push(part);
      },
      
      onMessageComplete: function () {
        complete = true;
      }
    });
    
  do {
    parser.exec(sock.receive(8192));
  } while (!complete);
  
  return new exports.Response(
    core.construct(Binary, contentParts),
    status,
    responseHeaders);
};
