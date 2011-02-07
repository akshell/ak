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

var core = require('core');
var Binary = require('binary').Binary;
var base = require('base');
var utils = require('utils');
var aspect = require('aspect');
var template = require('template');
var rest = require('rest');

////////////////////////////////////////////////////////////////////////////////
// Classes
////////////////////////////////////////////////////////////////////////////////

exports.TestResult = Object.subclass(
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


exports.TestSuite = Object.subclass(
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
      return utils.sum(
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


exports.TestCase = Object.subclass(
  function (methodName) {
    if (typeof(this[methodName]) != 'function')
      throw core.ValueError(
        'Test method ' + base.repr(methodName) + ' not found');
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
          if (error instanceof base.AssertionError)
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
      if (this.name)
        result += '(' + this.name + ')';
      return result;
    },

    __repr__: function () {
      return '<TestCase ' + this + '>';
    }
  });


exports.StreamTestResult = exports.TestResult.subclass(
  function (stream) {
    exports.TestResult.call(this);
    this._stream = stream;
  },
  {
    startTest: function (test) {
      exports.TestResult.prototype.startTest.call(this, test);
      this._stream.write(test);
    },

    addError: function (test, error) {
      exports.TestResult.prototype.addError.call(this, test, error);
      this._stream.write(' ERROR\n');
    },

    addFailure: function (test, error) {
      exports.TestResult.prototype.addFailure.call(this, test, error);
      this._stream.write(' FAIL\n');
    },

    addSuccess: function (test) {
      exports.TestResult.prototype.addSuccess.call(this, test);
      this._stream.write(' ok\n');
    }
  });

////////////////////////////////////////////////////////////////////////////////
// Functions
////////////////////////////////////////////////////////////////////////////////

function doLoadTestSuite(source) {
  if (source instanceof exports.TestSuite)
    return source;
  if (source instanceof exports.TestCase)
    return new exports.TestSuite([source]);
  if (typeof(source) == 'function' && source.subclassOf(exports.TestCase)) {
    var testMethodNames = [];
    for (var name in source.prototype) {
      if (name.startsWith('test') &&
          typeof(source.prototype[name]) == 'function')
        testMethodNames.push(name);
    }
    return new exports.TestSuite(
      testMethodNames.map(function (name) { return new source(name); }));
  }
  return null;
}


exports.loadTestSuite = function (source) {
  var result = doLoadTestSuite(source);
  if (result)
    return result;
  if (typeof(source) != 'object')
    throw TypeError('Can not load TestSuite from ' + base.repr(source));
  if (source instanceof Array)
    return new exports.TestSuite(Array.map(source, arguments.callee));
  result = new exports.TestSuite();
  for (var name in source) {
    var suite = doLoadTestSuite(source[name]);
    if (suite)
      result.addTest(suite);
  };
  return result;
};


function getErrorDescription(error) {
  return (error && error.stack
          ? error.stack
          : error);
}


exports.runTestViaStream = function (test, stream/* = utils.out */) {
  stream = stream || utils.out;
  var result = new exports.StreamTestResult(stream);
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


exports.test = function (source/* = require.main.exports.tests */,
                         stream/* = utils.out */) {
  stream = stream || utils.out;
  exports.runTestViaStream(
    exports.loadTestSuite(source || require.main.exports.tests),
    stream);
  var result = stream.get();
  stream.reset();
  return result;
};

////////////////////////////////////////////////////////////////////////////////
// TestClient
////////////////////////////////////////////////////////////////////////////////

function makeRequester(method) {
  return function (request) {
    request = {__proto__: request};
    request.method = method;
    return this.request(request);
  };
}


exports.TestClient = Object.subclass(
  {
    request: function (request/* = {} */) {
      request = request ? {__proto__: request} : {};
      base.update(
        request,
        {
          method: request.method || 'GET',
          path: request.path || '/',
          get: request.get || {},
          post: request.post || {},
          headers: request.headers || {},
          data: 
            request.data instanceof Binary
            ? request.data
            : new Binary(request.data || '')
        });
      var contexts = {};
      var aspects = new aspect.AspectArray();
      aspects.push(
        aspect.weave(
          aspect.After, template.Template, 'render',
          function (result, args) {
            contexts[result] = args[0];
            return result;
          }),
        aspect.weave(
          aspect.After, require.main.exports, 'main',
          function (result) {
            if (result &&
                typeof(result) == 'object' &&
                contexts.hasOwnProperty(result.content))
              result.context = contexts[result.content];
            return result;
          }),
        aspect.weave(
          aspect.After, rest.Handler, 'handle',
          function (result) {
            result.handler = this.constructor;
            return result;
          }));
      try {
        return require.main.exports.main(request);
      } finally {
        aspects.unweave();
      }
    },
    
    get: makeRequester('GET'),
    post: makeRequester('POST'),
    head: makeRequester('HEAD'),
    put: makeRequester('PUT'),
    del: makeRequester('DELETE')
  });
