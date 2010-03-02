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
  ak.include('utils.js');
  ak.include('aspect.js');

  //////////////////////////////////////////////////////////////////////////////
  // Classes
  //////////////////////////////////////////////////////////////////////////////

  ak.TestResult = Object.subclass(
    function () {
      this.errors = [];
      this.failures = [];
      this.testsRun = 0;
    },
    {
      wasSuccessful: function () {
        return this.errors.length == 0 && this.failures.length == 0;
      },

      startTest: function (test) {
        ++this.testsRun;
      },

      stopTest: function (test) {},

      addError: function (test, error) {
        this.errors.push([test, error]);
      },

      addFailure: function (test, failure) {
        this.failures.push([test, failure]);
      },

      addSuccess: function (test) {}
    });


  ak.TestSuite = Object.subclass(
    function (tests/* = [] */) {
      this._tests = tests || [];
    },
    {
      run: function (result) {
        this._tests.map(function (test) { test.run(result); });
      },

      addTest: function (test) {
        this._tests.push(test);
      },

      countTestCases: function () {
        return ak.sum(
          this._tests.map(function (test) { return test.countTestCases(); }));
      },

      toString: function () {
        var strings = [];
        this._tests.forEach(
          function (test) {
            var string = test + '';
            if (string)
              strings.push(string);
          });
        return strings.join(', ');
      },

      __repr__: function () {
        return '<TestSuite ' + this + '>';
      }
    });


  ak.TestCase = Object.subclass(
    function (methodName) {
      if (typeof(this[methodName]) != 'function')
        throw ak.UsageError(
          'Test method ' + ak.repr(methodName) + ' not found');
      this._methodName = methodName;
    },
    {
      countTestCases: function () {
        return 1;
      },

      setUp: function () {},

      tearDown: function () {},

      run: function (result) {
        result.startTest(this);
        try {
          try {
            this.setUp();
          } catch (error) {
            result.addError(this, error);
            return;
          }
          var ok = false;
          try {
            this[this._methodName]();
            ok = true;
          } catch (error) {
            if (error instanceof ak.AssertionError)
              result.addFailure(this, error);
            else
              result.addError(this, error);
          }
          try {
            this.tearDown();
          } catch (error) {
            result.addError(this, error);
            ok = false;
          }
          if (ok)
            result.addSuccess(this);
        } finally {
          result.stopTest(this);
        }
      },

      toString: function () {
        var result = this._methodName;
        var name = this.name || this.constructor.__name__;
        if (name)
          result += '(' + name + ')';
        return result;
      },

      __repr__: function () {
        return ('<' + (this.constructor.__name__ || 'TestCase') +
                ' ' + this._methodName + '>');
      }
    });


  ak.StreamTestResult = ak.TestResult.subclass(
    function (stream) {
      ak.TestResult.call(this);
      this._stream = stream;
    },
    {
      startTest: function (test) {
        ak.TestResult.prototype.startTest.call(this, test);
        this._stream.write(test);
      },

      addError: function (test, error) {
        ak.TestResult.prototype.addError.call(this, test, error);
        this._stream.write(' ERROR\n');
      },

      addFailure: function (test, error) {
        ak.TestResult.prototype.addFailure.call(this, test, error);
        this._stream.write(' FAIL\n');
      },

      addSuccess: function (test) {
        ak.TestResult.prototype.addSuccess.call(this, test);
        this._stream.write(' ok\n');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // Functions
  //////////////////////////////////////////////////////////////////////////////

  function doLoadTestSuite(source) {
    if (source instanceof ak.TestSuite)
      return source;
    if (source instanceof ak.TestCase)
      return new ak.TestSuite([source]);
    if (typeof(source) == 'function' && source.subclassOf(ak.TestCase)) {
      var testMethodNames = [];
      for (var name in source.prototype) {
        if (name.startsWith('test') &&
            typeof(source.prototype[name]) == 'function')
          testMethodNames.push(name);
      }
      return new ak.TestSuite(
        testMethodNames.sort().map(
          function (name) { return new source(name); }));
    }
    return null;
  }


  ak.loadTestSuite = function (source) {
    var result = doLoadTestSuite(source);
    if (result)
      return result;
    if (source instanceof ak.Module) {
      result = new ak.TestSuite();
      ak.keys(source).sort().forEach(
        function (name) {
          var suite = doLoadTestSuite(source[name]);
          if (suite)
            result.addTest(suite);
        });
      return result;
    }
    if (ak.isList(source))
      return new ak.TestSuite(Array.map(source, arguments.callee));
    throw TypeError('Can not load TestSuite from ' + ak.repr(source));
  };


  function getErrorDescription(error) {
    return (error && error.stack
            ? error.stack
            : error);
  }


  ak.runTestViaStream = function (test, stream/* = ak.out */) {
    stream = stream || ak.out;
    var result = new ak.StreamTestResult(stream);
    test.run(result);
    result.errors.forEach(
      function (error) {
        stream.write('=====\nERROR: ' + error[0] + '\n' +
                     getErrorDescription(error[1]) + '\n');
      });
    result.failures.forEach(
      function (failure) {
        stream.write('=====\nFAIL: ' + failure[0] + '\n' +
                     getErrorDescription(failure[1]) + '\n');
      });
    stream.write('-----\n' + 'Ran ' + test.countTestCases() + ' tests\n');
    if (result.wasSuccessful()) {
      stream.write('OK');
    } else {
      stream.write('FAILED (');
      if (result.failures.length)
        stream.write('failures=' + result.failures.length);
      if (result.errors.length) {
        if (result.failures.length)
          stream.write(', ');
        stream.write('errors=' + result.errors.length);
      }
      stream.write(')');
    }
    return result;
  };


  ak.test = function (source/* = ak.global */, stream/* = ak.out */) {
    stream = stream || ak.out;
    ak.runTestViaStream(ak.loadTestSuite(source || ak.global), stream);
    return stream.read();
  };

  //////////////////////////////////////////////////////////////////////////////
  // TestClient
  //////////////////////////////////////////////////////////////////////////////

  function weaveAliases(aspectClass, method, advice) {
    var holders = [ak];
    if (ak.global[method] === ak[method])
      holders.push(ak.global);
    return holders.map(
      function (holder) {
        return ak.weave(aspectClass, holder, method, advice);
      });
  }


  function makeRequester(method) {
    return function (request) {
      request = {__proto__: request};
      request.method = method;
      return this.request(request);
    };
  }


  ak.TestClient = Object.subclass(
    function (users/* = [] */, apps/* = {} */) {
      this.users = users || [];
      this.apps = apps || {};
      for (var name in this.apps) {
        var app = this.apps[name];
        app.name = name;
        app.developers = app.developers || [];
        app.developers.unshift(app.admin);
      }
      this._user = '';
    },
    {
      _describeApp: function (name) {
        var result = this.apps[name];
        if (!result)
          throw ak.NoSuchAppError('No such test app: ' + ak.repr(name));
        return result;
      },

      _checkUserExists: function (user) {
        if (this.users.indexOf(user) == -1)
          throw ak.NoSuchUserError('No such test user: ' + ak.repr(user));
      },

      _getAdminedApps: function (user) {
        this._checkUserExists(user);
        var result = [];
        for (var name in this.apps)
          if (this.apps[name].admin == user)
            result.push(name);
        return result;
      },

      _getDevelopedApps: function (user) {
        this._checkUserExists(user);
        var result = [];
        for (var name in this.apps)
          if (this.apps[name].developers.indexOf(user) > 0)
            result.push(name);
        return result;
      },

      _substitute: function (name) {
        return weaveAliases(ak.InsteadOf, name,
                            ak.bind('_' + name, this));
      },

      login: function (user) {
        this._checkUserExists(user);
        this._user = user;
      },

      logout: function () {
        this._user = '';
      },

      request: function (request) {
        request = {__proto__: request};
        ak.update(
          request,
          {
            user: request.user || this._user,
            method: request.method || 'get',
            path: request.path || '/',
            get: request.get || {},
            post: request.post || {},
            headers: request.headers || {},
            files: request.files || {}
          });
        var contexts = {};
        var aspects = [].concat(
          this._substitute('describeApp'),
          this._substitute('getAdminedApps'),
          this._substitute('getDevelopedApps'),
          ak.weave(ak.After, ak.Template, 'render',
                   function (result, args) {
                     contexts[result] = args[0];
                     return result;
                   }),
          weaveAliases(ak.After, 'Response',
                       function () {
                         this.context = contexts[this.content];
                       }),
          ak.weave(ak.After, ak.Handler, 'handle',
                   function (result) {
                     result.handler = this.constructor;
                     return result;
                   })
        ).instances(ak.AspectArray);
        try {
          return __main__(request);
        } finally {
          aspects.unweave();
        }
      },

      get: makeRequester('get'),
      post: makeRequester('post'),
      put: makeRequester('put'),
      del: makeRequester('delete')
    });

})();
