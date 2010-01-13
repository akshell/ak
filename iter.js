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

// This code is based on MochiKit.Iter by Bob Ippolito http://mochikit.com/

(function ()
{
  ak.include('base.js');

  //////////////////////////////////////////////////////////////////////////////
  // Iterator
  //////////////////////////////////////////////////////////////////////////////

  ak.Iterator = Object.subclass(
    function () {},
    {
      __repr__: function () {
        return ('<' + (this.valid ? 'valid' : 'invalid') + ' ' +
                this.constructor.__name__ + '>');
      },

      next: function () {
        if (!('valid' in this))
          throw new ak.NotImplementedError(
            'valid must be defined by Iterator subclass');
        if (!this.valid)
          throw new Error('Iteration on invalid iterator');
        return this._next();
      },

      _next: function () {
        throw new ak.NotImplementedError(
          '_next must be defined by Iterator subclass');
      }
    });


  ak.InvalidIterator = ak.Iterator.subclass({valid: false});


  //////////////////////////////////////////////////////////////////////////////
  // Free functions
  //////////////////////////////////////////////////////////////////////////////

  ak.iter = function (obj) {
    return (obj instanceof ak.Iterator ?
            obj
            : ((obj !== undefined && obj !== null &&
                typeof(obj.__iter__) == 'function')
               ? obj.__iter__()
               : new ak.InvalidIterator()));
  };


  ak.array = function (iterable) {
    var itr = ak.iter(iterable);
    var result = [];
    while (itr.valid)
      result.push(itr.next());
    return result;
  };


  ak.advance = function (itr, n) {
    for (var i = 0; i < n && itr.valid; ++i)
      itr.next();
  };


  function findMinOrMax(cmpValue, iterable) {
    var itr = ak.iter(iterable);
    if (!itr.valid)
      throw Error((cmpValue == 1 ? 'min' : 'max') + ' argument is empty');
    var result = itr.next();
    while (itr.valid) {
      var value = itr.next();
      if (ak.cmp(result, value) == cmpValue)
        result = value;
    }
    return result;
  };


  ak.min = ak.partial(findMinOrMax, 1);
  ak.max = ak.partial(findMinOrMax, -1);


  ak.reduce = function (func, iterable, /* optional */initial) {
    var itr = ak.iter(iterable);
    var result;
    if (arguments.length < 3) {
      if (!itr.valid)
        throw new Error('reduce() of empty sequence with no initial value');
      result = itr.next();
    } else {
      result = initial;
    }
    while (itr.valid)
      result = func(result, itr.next());
    return result;
  };


  ak.sum = function (iterable, start/* = 0 */) {
    return ak.reduce(ak.operators.add, iterable, start || 0);
  };


  ak.exhaust = function (iterable) {
    ak.advance(iterable, Infinity);
  };


  ak.forEach = function (iterable, func, self/* = ak.global */) {
    self = self || ak.global;
    var itr = ak.iter(iterable);
    while (itr.valid)
      func.call(self, itr.next());
  };


  ak.every = function (iterable, pred, self/* = ak.global */) {
    // alternative impl:
//     var itr = ak.ifilter(iterable, ak.compose(ak.operators.not, pred), self);
//     return !itr.valid;
    self = self || ak.global;
    var itr = ak.iter(iterable);
    while (itr.valid)
      if (!pred.call(self, itr.next()))
        return false;
    return true;
  };


  ak.some = function (iterable, pred, self/* = ak.global */) {
    // alternative impl:
//     var itr = ak.ifilter(iterable, pred, self);
//     return itr.valid;
    self = self || ak.global;
    var itr = ak.iter(iterable);
    while (itr.valid)
      if (pred.call(self, itr.next()))
        return true;
    return false;
  };


  ak.sorted = function (iterable, cmp/* = ak.cmp */) {
    var result = ak.array(iterable);
    result.sort(cmp || ak.cmp);
    return result;
  };


  ak.reversed = function (iterable) {
    var result = ak.array(iterable);
    result.reverse();
    return result;
  };

  //////////////////////////////////////////////////////////////////////////////
  // Utility iterators
  //////////////////////////////////////////////////////////////////////////////

  ak.SliceIterator = ak.Iterator.subclass(
    function (iterable,
              start/* = 0 */,
              stop /* = Infinity */) {
      this._itr = ak.iter(iterable);
      start = start || 0;
      stop = stop || Infinity;
      ak.advance(this._itr, start);
      this._count = stop - start;
    },
    {
      get valid() {
        return this._itr.valid && this._count > 0;
      },

      _next: function () {
        --this._count;
        return this._itr.next();
      }
    });

  ak.islice = ak.factory(ak.SliceIterator);


  ak.CountIterator = ak.Iterator.subclass(
    function (n) {
      this._n = n || 0;
    },
    {
      __repr__: function () {
        return this.constructor.__name__ + '(' + this._n + ')';
      },

      valid: true,

      _next: function () {
        return this._n++;
      }
    });

  ak.count = ak.factory(ak.CountIterator);


  ak.CycleIterator = ak.Iterator.subclass(
    function (iterable) {
      this._itr = ak.iter(iterable);
      this.valid = this._itr.valid;
      this._saved = [];
    },
    {
      _next: function () {
        if ('_i' in this || !this._itr.valid) {
          if (!('_i' in this && this._i < this._saved.length))
            this._i = 0;
          return this._saved[this._i++];
        }
        var result = this._itr.next();
        this._saved.push(result);
        return result;
      }
    });

  ak.cycle = ak.factory(ak.CycleIterator);


  ak.RepeatIterator = ak.Iterator.subclass(
    function (obj, n/* = Infinity */) {
      this._obj = obj;
      this._i = n === undefined ? Infinity : n;
    },
    {
      get valid() {
        return this._i > 0;
      },

      _next: function () {
        --this._i;
        return this._obj;
      }
    });

  ak.repeat = ak.factory(ak.RepeatIterator);


  ak.ZipIterator = ak.Iterator.subclass(
    function (/* iterables... */) {
      this._itrs = Array.map(arguments, ak.iter);
    },
    {
      get valid() {
        return this._itrs.every(function (itr) { return itr.valid; });
      },

      _next: function () {
        return this._itrs.map(function (itr) { return itr.next(); });
      }
    });

  ak.izip = ak.factory(ak.ZipIterator);


  ak.FilterIterator = ak.Iterator.subclass(
    function (iterable, pred, self/* = ak.global */) {
      this._itr = ak.iter(iterable);
      this._pred = pred || ak.operators.truth;
      this._self = self || ak.global;
      this.valid = true;
      this._findNextItem();
    },
    {
      _findNextItem: function () {
        do {
          if (!this._itr.valid) {
            this.valid = false;
            return;
          }
          this._nextItem = this._itr.next();
        } while (!this._pred.call(this._self, this._nextItem));
      },

      _next: function () {
        var result = this._nextItem;
        this._findNextItem();
        return result;
      }
    });

  ak.filter = ak.factory(ak.FilterIterator);


  ak.MapIterator = ak.Iterator.subclass(
    function (iterable, func, self/* = ak.global */) {
      this._itr = ak.iter(iterable);
      this._func = func;
      this._self = self || ak.global;
    },
    {
      get valid() {
        return this._itr.valid;
      },

      _next: function () {
        return this._func.call(this._self, this._itr.next());
      }
    });

  ak.map = ak.factory(ak.MapIterator);


  ak.ChainIterator = ak.Iterator.subclass(
    function (/* iterables... */) {
      this._itrs = Array.map(arguments, ak.iter);
      this._findValid();
    },
    {
      _findValid: function () {
        while (this._itrs.length && !this._itrs[0].valid)
          this._itrs.shift();
      },

      get valid() {
        return !!this._itrs.length;
      },

      _next: function () {
        var result = this._itrs[0].next();
        this._findValid();
        return result;
      }
    });

  ak.chain = ak.factory(ak.ChainIterator);


  ak.TakeWhileIterator = ak.Iterator.subclass(
    function (iterable, pred) {
      this._itr = ak.iter(iterable);
      this._pred = pred;
      this.valid = true;
      this._findNextItem();
    },
    {
      _findNextItem: function () {
        if (!this._itr.valid) {
          this.valid = false;
          return;
        }
        this._nextItem = this._itr.next();
        if (!this._pred(this._nextItem))
          this.valid = false;
      },

      _next: function () {
        var result = this._nextItem;
        this._findNextItem();
        return result;
      }
    });

  ak.takeWhile = ak.factory(ak.TakeWhileIterator);


  ak.DropWhileIterator = ak.Iterator.subclass(
    function (iterable, pred) {
      this._itr = ak.iter(iterable);
      while (this._itr.valid) {
        var item = this._itr.next();
        if (!pred(item)) {
          this._first = item;
          break;
        }
      }
    },
    {
      get valid() {
        return '_first' in this || this._itr.valid;
      },

      _next: function () {
        if ('_first' in this) {
          var result = this._first;
          delete this._first;
          return result;
        }
        return this._itr.next();
      }
    });

  ak.dropWhile = ak.factory(ak.DropWhileIterator);


  ak.TeeIterator = ak.Iterator.subclass(
    function (ident, sync) {
      sync.pos[ident] = -1;
      this._ident = ident;
      this._sync = sync;
    },
    {
      get valid() {
        return (this._sync.pos[this._ident] != this._sync.max ||
                this._sync.itr.valid);
      },

      _next: function () {
        var sync = this._sync;
        var ident = this._ident;
        var i = sync.pos[ident];
        var result;
        if (i == sync.max) {
          result = sync.itr.next();
          sync.deque.push(result);
          ++sync.max;
        } else {
          result = sync.deque[i - sync.min];
        }
        ++sync.pos[ident];
        if (i == sync.min && ak.min(sync.pos) != sync.min) {
          ++sync.min;
          sync.deque.shift();
        }
        return result;
      }
    });


  ak.tee = function (iterable, n/* = 2 */) {
    var sync = {
      itr: ak.iter(iterable),
      pos: [],
      deque: [],
      max: -1,
      min: -1
    };
    var result = [];
    for (var i = 0; i < (n || 2); ++i)
      result.push(new ak.TeeIterator(i, sync));
    return result;
  };


  ak.GroupByIterator = ak.Iterator.subclass(
    function (iterable, keyFunc/* = ak.operators.identity */) {
      this._itr = ak.iter(iterable);
      this._keyFunc = keyFunc || ak.operators.identity;
    },
    {
      get valid() {
        return '_value' in this || this._itr.valid;
      },

      _next: function () {
        if (!('_value' in this)) {
          this._value = this._itr.next();
          this._key = this._keyFunc(this._value);
        }
        var values = [this._value];
        while (this._itr.valid) {
          var value = this._itr.next();
          var key = this._keyFunc(value);
          if (ak.cmp(key, this._key)) {
            var result = [this._key, values];
            this._value = value;
            this._key = key;
            return result;
          }
          values.push(value);
        }
        delete this._value;
        return [this._key, values];
      }
    });

  ak.groupBy = ak.factory(ak.GroupByIterator);

  //////////////////////////////////////////////////////////////////////////////
  // ObjectIterator
  //////////////////////////////////////////////////////////////////////////////

  ak.ObjectIterator = ak.Iterator.subclass(
    function (obj) {
      this._keyItr = ak.iter(ak.keys(obj));
      this._obj = obj;
    },
    {
      get valid() {
        return this._keyItr.valid;
      },

      _next: function () {
        var key = this._keyItr.next();
        return [key, this._obj[key]];
      }
    });


  Object.prototype.setNonEnumerable('__iter__', function () {
                                      return new ak.ObjectIterator(this);
                                    });

  //////////////////////////////////////////////////////////////////////////////
  // ArrayIterator
  //////////////////////////////////////////////////////////////////////////////

  ak.ArrayIterator = ak.Iterator.subclass(
    function (array) {
      this._array = array;
      this._i = 0;
    },
    {
      get valid() {
        return this._i < this._array.length;
      },

      _next: function () {
        return this._array[this._i++];
      }
    });


  function makeArrayIterator() { return new ak.ArrayIterator(this); };
  Array.prototype.setNonEnumerable('__iter__', makeArrayIterator);
  String.prototype.setNonEnumerable('__iter__', makeArrayIterator);
  ak.Rel.prototype.setNonEnumerable('__iter__', makeArrayIterator);

})();
