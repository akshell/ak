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
  ak.include('utils.js');
  ak.include('stream.js');
  ak.include('debug.js');

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

      addError: function (test, err) {
        this.errors.push([test, err]);
      },

      addFailure: function (test, err) {
        this.failures.push([test, err]);
      },

      addSuccess: function (test) {}
    });


  ak.TestCase = Object.subclass(
    function (proto, methodName) {
      if (!(methodName in proto))
        throw new Error(proto + ' does not have method ' + methodName);
      this._proto = proto;
      this._methodName = methodName;
    },
    {
      count: 1,

      run: function (result) {
        result.startTest(this);
        var obj = ak.clone(this._proto);
        try {
          if (typeof(this._proto.setUp) == 'function') {
            try {
              obj.setUp();
            } catch (err) {
              result.addError(this, err);
              return;
            }
          }
          var ok = false;
          try {
            obj[this._methodName]();
            ok = true;
          } catch (err) {
            if (err instanceof ak.AssertionError)
              result.addFailure(this, err);
            else
              result.addError(this, err);
          }
          if (typeof(this._proto.tearDown) == 'function') {
            try {
              obj.tearDown();
            } catch (err) {
              result.addError(this, err);
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
        if (this._proto.name)
          result += '(' + this._proto.name + ')';
        return result;
      },

      __repr__: function () {
        return '<TestCase ' + this.toString() + '>';
      }
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
        return ak.sum(this._tests.map(ak.attrGetter('count')));
      },

      toString: function () {
        return this._tests.join(', ');
      },

      __repr__: function () {
        return 'TestSuite([' + this._tests.map(ak.repr).join(', ') + '])';
      }
    });


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

      addError: function (test, err) {
        ak.TestResult.prototype.addError.call(this, test, err);
        this._stream.writeLine(' ERROR');
      },

      addFailure: function (test, err) {
        ak.TestResult.prototype.addFailure.call(this, test, err);
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

  ak.loadTests = function (proto, methodNames) {
    if (methodNames === undefined) {
      methodNames = [];
      for (var name in proto)
        if (name.substr(0, 4) == 'test' && typeof(proto[name]) == 'function')
          methodNames.push(name);
      methodNames.sort();
    }
    var suite = new ak.TestSuite();
    methodNames.forEach(function (methodName) {
                          suite.addTest(new ak.TestCase(proto, methodName));
                        });
    return suite;
  };


  ak.test = function (suite, stream/* = ak.out */) {
    var runner = new ak.TextTestRunner(stream || ak.out);
    return runner.run(suite);
  };

})();
