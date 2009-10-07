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
  ak.include('base.js');


  ak.AssertionError = ak.BaseError.subclass();


  function prefix(msg) {
    return msg ? msg + ': ' : '';
  }


  ak.assert = function (expr, /* optional */msg) {
    if (!expr)
      throw new ak.AssertionError('Assertion failed' +
                                  (msg ? ': ' + msg : ''));
  };


  ak.assertEqual = function (first, second, /* optional */msg) {
    if (!ak.equal(first, second))
      throw new ak.AssertionError(prefix(msg) +
                                  ak.repr(first) + ' <> ' +
                                  ak.repr(second));
  };


  ak.assertSame = function (first, second, /* optional */msg) {
    if (first !== second)
      throw new ak.AssertionError(prefix(msg) +
                                  ak.repr(first) + ' !== ' +
                                  ak.repr(second));
  };


  ak.assertThrow = function (constructor, func, /* optional */msg) {
    var args = [];
    for (var i = 2; i < arguments.length; ++i)
      args.push(arguments[i]);
    try {
      func.apply(ak.global, args);
    } catch (err) {
      if (typeof(err) != 'object')
        err = Object(err);
      if (!(err instanceof constructor)) {
        var expected = constructor.__name__ || constructor.name;
        var got = err.constructor.__name__ || err.constructor.name;
        throw new ak.AssertionError(prefix(msg) +
                                    'Expected ' +
                                    expected +
                                    ' exception, got ' +
                                    got + ' (' + err + ')');
      }
      return;
    }
    throw new ak.AssertionError(prefix(msg) + 'Exception was not thrown');
  };

})();