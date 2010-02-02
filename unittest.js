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
  ak.include('stream.js');
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
      get wasSuccessful () {
        return this.errors.length == 0 && this.failures.length == 0;
      },

      startTest: function (test) {
        ++this.testsRun;
      },

      stopTest: function (test) {},

      addError: function (test, error) {
        this.errors.push([test, error]);
      },

      addFailure: function (test, error) {
        this.failures.push([test, error]);
      },

      addSuccess: function (test) {}
    });


  ak.TestSuite = Object.subclass(
    function (tests) {
      this._tests = tests || [];
    },
    {
      run: function (result) {
        this._tests.map(function (test) { test.run(result); });
      },

      addTest: function (test) {
        this._tests.push(test);
      },

      get count () {
        return ak.sum(this._tests.map(function (test) { return test.count; }));
      },

      toString: function () {
        return this._tests.join(', ');
      },

      __repr__: function () {
        return 'TestSuite([' + this._tests.map(ak.repr).join(', ') + '])';
      }
    });


  ak.TestCase = Object.subclass(
    function (methodName) {
      if (typeof(this[methodName]) != 'function')
        throw ak.UsageError(ak.repr(this) + ' does not have method ' +
                            ak.repr(methodName));
      this._methodName = methodName;
    },
    {
      count: 1,

      run: function (result) {
        result.startTest(this);
        try {
          if (typeof(this.setUp) == 'function') {
            try {
              this.setUp();
            } catch (error) {
              result.addError(this, error);
              return;
            }
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
          if (typeof(this.tearDown) == 'function') {
            try {
              this.tearDown();
            } catch (error) {
              result.addError(this, error);
              ok = false;
            }
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
        return '<TestCase ' + this.toString() + '>';
      }
    });


  ak.TestCase.instances(
    ak.TestCaseMeta = Function.subclass(
      {
        loadSuite: function (/* optional */methodNames) {
          if (!methodNames) {
            methodNames = [];
            for (var name in this.prototype)
              if (name.substr(0, 4) == 'test' &&
                  typeof(this.prototype[name]) == 'function')
                methodNames.push(name);
            methodNames.sort();
          }
          var result = new ak.TestSuite();
          methodNames.forEach(
            function (methodName) {
              result.addTest(new this(methodName));
            },
            this);
          return result;
        }
      }));


  ak.TextTestResult = ak.TestResult.subclass(
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
        this._stream.writeLine(' ERROR');
      },

      addFailure: function (test, error) {
        ak.TestResult.prototype.addFailure.call(this, test, error);
        this._stream.writeLine(' FAIL');
      },

      addSuccess: function (test) {
        ak.TestResult.prototype.addSuccess.call(this, test);
        this._stream.writeLine(' ok');
      }
    });


  function getErrorDescription(error) {
    return (error && error.stack
            ? error.stack
            : error);
  }


  ak.TextTestRunner = Object.subclass(
    function (stream) {
      this._stream = stream;
    },
    {
      run: function (test) {
        var result = new ak.TextTestResult(this._stream);
        var stream = this._stream;
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
        stream.write('-----\n' + 'Ran ' + test.count + ' tests\n');
        if (result.wasSuccessful) {
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
        return result.wasSuccessful;
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // Free functions
  //////////////////////////////////////////////////////////////////////////////

  ak.loadSuite = function (TestCases) {
    return new ak.TestSuite(
      TestCases.map(
        function (TC) {
          return TC.loadSuite();
        }));
  };


  ak.runTestSuite = function (suite, stream/* = ak.out */) {
    var runner = new ak.TextTestRunner(stream || ak.out);
    return runner.run(suite);
  };

  //////////////////////////////////////////////////////////////////////////////
  // TestClient
  //////////////////////////////////////////////////////////////////////////////

  function weaveAliases(AspectClass, method, advice) {
    var holders = [ak];
    if (ak.global[method] === ak[method])
      holders.push(ak.global);
    return holders.map(
      function (holder) {
        return ak.weave(AspectClass, holder, method, advice);
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
        delete this._user;
      },

      request: function (request) {
        if (this._user && !('user' in request)) {
          request = {__proto__: request};
          request.user = this._user;
        }
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
          ak.weave(ak.After, ak.Controller, 'respond',
                   function (result, args) {
                     result.controller = this.constructor.page(args[0]);
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
