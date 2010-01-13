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


var suite = ak.include('tests.js');

function test() {
  ak.runTestSuite(suite);
  return ak.out.read();
}


var HelloController = ak.Controller.subclass(
  function (request, name) {
    ak.Controller.call(this, request);
    this._name = name;
  },
  {
    get: function () {
      return ak.renderToResponse('hello.html', {name: this._name});
    }
  });


var MainController = ak.Controller.subclass(
  {
    handleTestPage: function () {
      return ak.renderToResponse('test.html', {request: this.request});
    },

    getErrorPage: function () {
      throw Error('Test error');
    }
  });


ak.defineRoutes('',
                [
                  ['hello/', [[HelloController]]],
                  ['test/', MainController.page('Test')],
                  ['error/', MainController.page('Error')]
                ]);


__main__ = ak.defaultServe;


ak.nameFunctions(this);
