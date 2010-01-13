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
  ak.include('iter.js');


  ak.Stream = ak.Iterator.subclass(
    function () {
      this._strs = [];
    },
    {
      get valid() {
        return !!this._strs.length;
      },

      read: function (size/* = Infinity */) {
        if (!this._strs.length)
          return undefined;
        if (size === undefined) {
          var result = this._strs.join('');
          this._strs = [];
          return result;
        }
        var total = 0;
        for (var i = 0; i < this._strs.length && total < size; ++i)
          total += this._strs[i].length;
        var resultStrs = this._strs.splice(0, i);
        if (total > size) {
          var lastStr = resultStrs[i - 1];
          var splitIdx = lastStr.length - (total - size);
          this._strs.unshift(lastStr.substring(splitIdx));
          resultStrs[i - 1] = lastStr.substring(0, splitIdx);
        }
        return resultStrs.join('');
      },

      readLine: function () {
        if (!this._strs.length)
          return undefined;
        for (var i = 0, idx = -1; i < this._strs.length && idx == -1; ++i)
          idx = this._strs[i].indexOf('\n');
        var resultStrs = this._strs.splice(0, i);
        if (idx != -1) {
          var lastStr = resultStrs[i - 1];
          if (idx != lastStr.length - 1)
            this._strs.unshift(lastStr.substring(idx + 1));
          resultStrs[i - 1] = lastStr.substring(0, idx);
        }
        return resultStrs.join('');
      },

      _next: function () {
        return this.readLine();
      },

      write: function (str) {
        if (str)
          this._strs.push(str + '');
      },

      writeLine: function (str) {
        if (str)
          this._strs.push(str + '', '\n');
        else
          this._strs.push('\n');
      }
    });


  ak.out = new ak.Stream();


  ak.dump = function (/* arguments */) {
    ak.out.writeLine();
    Array.forEach(arguments,
                  function (arg) {
                    ak.out.writeLine(ak.repr(arg));
                  });
  };

})();
