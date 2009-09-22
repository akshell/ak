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
  ak.include('iter.js');


  // actions for Map method _handle
  var DELETE = 1;
  var SET = 2;


  var itemRestorers = {
    'boolean': function (pair) {
      return [pair[0] == 'true', pair[1]];
    },

    'number': function (pair) {
      return [+pair[0], pair[1]];
    },

    'string': ak.operators.identity
  };


  ak.Map = ak.makeClass(
    function (other) {
      this.clear();
      if (other)
        this.update(other);
    },
    {
      clear: function () {
        delete this._undefined;
        this._dicts = {
          'boolean': {},
          'number': {},
          'string': {}
        };
        this._table = {};
      },

      copy: function () {
        return new this.constructor(this);
      },

      set: function (key, value) {
        if (key === undefined) {
          this._undefined = value;
        } else if (typeof(key) in this._dicts) {
          this._dicts[typeof(key)][key] = value;
        } else {
          var hash = ak.hash(key);
          var neighbours = this._table[hash];
          if (!neighbours)
            this._table[hash] = neighbours = [];
          for (var i = 0; i < neighbours.length; ++i) {
            var neighbour = neighbours[i];
            if (neighbour[0] === key) {
              neighbour[1] = value;
              return;
            }
          }
          neighbours.push([key, value]);
        }
      },

      _handle: function (key,
                         default_/* = undefined */,
                         action/* = undefined */) {
        var result;
        if (key === undefined) {
          result = ['_undefined' in this, this._undefined];
          if (action == DELETE)
            delete this._undefined;
          else if (action == SET && !result[0])
            this._undefined = default_;
        } else if (typeof(key) in this._dicts) {
          var dict = this._dicts[typeof(key)];
          result = [key in dict, dict[key]];
          if (action == DELETE)
            delete dict[key];
          else if (action == SET && !result[0])
            dict[key] = default_;
        } else {
          var hash = ak.hash(key);
          var neighbours = this._table[hash];
          if (neighbours) {
            for (var i = 0; i < neighbours.length; ++i) {
              var neighbour = neighbours[i];
              if (neighbour[0] === key) {
                result = [true, neighbour[1]];
                if (action == DELETE) {
                  if (neighbours.length > 1)
                    neighbours.splice(i, 1);
                  else
                    delete this._table[hash];
                }
                break;
              }
            }
            if (action == SET && !result)
              neighbours.push([key, default_]);
          } else if (action == SET) {
            this._table[hash] = [[key, default_]];
          }
        }
        return (result && result[0]
                ? result
                : [false, default_]);
      },

      get: function (key, default_/* = undefined */) {
        return this._handle(key, default_)[1];
      },

      has: function (key) {
        return this._handle(key)[0];
      },

      setDefault: function (key, default_/* = undefined */) {
        return this._handle(key, default_, SET)[1];
      },

      pop: function (key, default_/* = undefined */) {
        return this._handle(key, default_, DELETE)[1];
      },

      popItem: function () {
        var result;
        if ('_undefined' in this) {
          result = [undefined, this._undefined];
          delete this._undefined;
          return result;
        }
        for (var hash in this._table) {
          var neighbours = this._table[hash];
          result = neighbours.shift();
          if (!neighbours.length)
            delete this._table[hash];
          return result;
        }
        for (var type in this._dicts) {
          var dict = this._dicts[type];
          for (var key in dict) {
            result = itemRestorers[type]([key, dict[key]]);
            delete dict[key];
            return result;
          }
        }
        return undefined;
      },

      iterItems: function () {
        return new this.constructor.ItemIterator(this);
      },

      __iter__: function () {
        return this.iterItems();
      },

      iterKeys: function () {
        return new this.constructor.KeyIterator(this);
      },

      iterValues: function () {
        return new this.constructor.ValueIterator(this);
      },

      items: function () {
        return ak.array(this.iterItems());
      },

      keys: function () {
        return ak.array(this.iterKeys());
      },

      values: function () {
        return ak.array(this.iterValues());
      },

      update: function (other) {
        ak.forEach(other,
                   function (item) {
                     this.set(item[0], item[1]);
                   },
                   this);
      },

      __eq__: function (other) {
        if (!(other instanceof this.constructor))
          return false;
        if (('_undefined' in this) != ('_undefined' in other) ||
            !ak.equal(this._undefined, other._undefined))
          return false;
        for (var type in this._dicts)
          if (!ak.equal(ak.items(this._dicts[type]),
                        ak.items(other._dicts[type])))
            return false;
        return ak.equal(ak.items(this._table), ak.items(other._table));
      },

      __repr__: function () {
        return ('{' +
                this.items().map(
                  function (item) {
                    return ak.repr(item[0]) + ': ' + ak.repr(item[1]);
                  }).join(', ') +
                '}');
      },

      toString: function () {
        return (this.items().map(
                  function (item) {
                    return item[0] + ' ' + item[1];
                  }).join(','));
      }
    });


  ak.Map.ItemIterator = ak.makeSubclass(
    ak.Iterator,
    function (map) {
      this._map = map;
      this.valid = true;
      this._findNextItem();
    },
    {
      _getNextItem: function () {
        // With "yield" this code could much prettier
        // Object are iterated at first because they are the main Map use case
        if (!('_nextItem' in this) && '_undefined' in this._map)
          return [undefined, this._map._undefined];
        if (!this._tableItr)
          this._tableItr = ak.iter(this._map._table);
        if (this._tableItr.valid &&
            (!this._neighbourItr || !this._neighbourItr.valid))
          this._neighbourItr = ak.iter(this._tableItr.next()[1]);
        if (this._neighbourItr && this._neighbourItr.valid)
          return this._neighbourItr.next();
        if (!this._dictItr)
          this._dictItr = ak.iter(this._map._dicts);
        while (this._dictItr.valid &&
               (!this._pairItr || !this._pairItr.valid)) {
          var typeAndDict = this._dictItr.next();
          this._itemRestorer = itemRestorers[typeAndDict[0]];
          this._pairItr = ak.iter(typeAndDict[1]);
        }
        if (this._pairItr.valid)
          return this._itemRestorer.call(ak.global, this._pairItr.next());
        this.valid = false;
        return undefined;
      },

      _findNextItem: function () {
        this._nextItem = this._getNextItem();
      },

      _next: function () {
        var result = this._nextItem;
        this._findNextItem();
        return result;
      }
    });


  ak.Map.KeyIterator = ak.makeSubclass(
    ak.Iterator,
    function (map) {
      this._itemItr = new map.constructor.ItemIterator(map);
    },
    {
      get valid() {
        return this._itemItr.valid;
      },

      _next: function () {
        return this._itemItr.next()[0];
      }
    });


  ak.Map.ValueIterator = ak.makeSubclass(
    ak.Iterator,
    function (map) {
      this._itemItr = new map.constructor.ItemIterator(map);
    },
    {
      get valid() {
        return this._itemItr.valid;
      },

      _next: function () {
        return this._itemItr.next()[1];
      }
    });

})();
