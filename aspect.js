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

// Inspired by jQuery AOP http://jquery-aop.googlecode.com/

(function ()
{
  ak.include('base.js');


  ak.Aspect = Function.subclass(
    function (holder, method, advice) {
      if (typeof(this._apply) != 'function')
        throw new ak.NotImplementedError(
          'Aspect subclasses must implement "_apply" method');
      this._holder = holder;
      this._method = method;
      this._advice = advice;
      var source = holder[method];
      if (typeof(source) != 'function')
        throw new ak.UsageError(
          'Attempt to advice non-function ' + ak.repr(source));
      if (holder.hasOwnProperty(method)) {
        this._source = source;
        this._setSourceOwner(this);
      }
      if ('__name__' in source)
        this.__name__ = source.__name__;
      this.prototype = source.prototype;
      holder[method] = this;
    },
    {
      enabled: true,

      _setSourceOwner: function (next) {
        if (this._source instanceof ak.Aspect)
          this._source._owner = next;
      },

      _getSource: function () {
        return this._source || this._holder.__proto__[this._method];
      },

      applySource: function (self, args) {
        return this._getSource().apply(self, args);
      },

      callSource: function (self /* ... */) {
        return this.applySource(self, Array.slice(arguments, 1));
      },

      apply: function (self, args) {
        return (this.enabled
                ? this._apply(self, args)
                : this.applySource(self, args));
      },

      unweave: function () {
        if (this._owner) {
          this._owner._source = this._source;
          this._setSourceOwner(this._owner);
        } else if (this._source) {
          this._setSourceOwner(undefined);
          this._holder[this._method] = this._source;
        } else {
          delete this._holder[this._method];
        }
        return this._holder[this._method];
      }
    });


  ak.Before = ak.Aspect.subclass(
    {
      _apply: function (self, args) {
        this._advice.call(self, args, this._method);
        return this.applySource(self, args);
      }
    });


  ak.After = ak.Aspect.subclass(
    {
      _apply: function (self, args) {
        var result = this.applySource(self, args);
        return this._advice.call(self, result, args, this._method);
      }
    });


  ak.AfterCatch = ak.Aspect.subclass(
    {
      _apply: function (self, args) {
        try {
          return this.applySource(self, args);
        } catch (error) {
          return this._advice.call(self, error, args, this._method);
        }
      }
    });


  ak.AfterFinally = ak.Aspect.subclass(
    {
      _apply: function (self, args) {
        try {
          return this.applySource(self, args);
        } finally {
          this._advice.call(self, args, this._method);
        }
      }
    });


  ak.Around = ak.Aspect.subclass(
    {
      _apply: function (self, args) {
        return this._advice.call(self, this._getSource(), args, this._method);
      }
    });


  ak.InsteadOf = ak.Aspect.subclass(
    {
      _apply: function (self, args) {
        return this._advice.apply(self, args);
      }
    });


  ak.AspectArray = Array.subclass();

  ak.AspectArray.prototype.setNonEnumerable(
    'unweave',
    function () {
      return this.map(function (aspect) { return aspect.unweave(); });
    });


  function weaveOne(AspectClass, holder, method, advice) {
    var result = function (/* arguments */) {
      return arguments.callee.apply(this, arguments);
    }.instances(AspectClass);
    AspectClass.call(result, holder, method, advice);
    return result;
  };


  ak.weave = function (AspectClass, holder, method, advice,
                       directly/* = false */) {
    if (!directly && typeof(holder) == 'function')
      holder = holder.prototype;
    var methods;
    if (method instanceof Array)
      methods = method;
    else if (method instanceof RegExp)
      methods = ak.keys(holder).filter(
        function (name) { return method.test(name); });
    return (methods
            ? methods.map(
              function (method) {
                return weaveOne(AspectClass, holder, method, advice);
              }).instances(ak.AspectArray)
            : weaveOne(AspectClass, holder, method, advice));
  };

})();
