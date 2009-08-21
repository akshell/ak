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
  include('base.js');
  include('utils.js');
  include('iter.js');
  include('io.js');
  include('unittest.js');

  // with statement is used here in order to make sure all names in
  // ak submodules are unique, this is essential because in applications
  // ak functions could be placed on global object for convenience.
  with(ak.base.update({},
                      ak, ak.types,
                      ak.base, ak.unittest, ak.utils, ak.iter, ak.io))
{
  var $ = module('ak.tests');


  //////////////////////////////////////////////////////////////////////////////
  // unittest tests
  //////////////////////////////////////////////////////////////////////////////

  unittestSuite = loadTests(
    {
      name: 'unittest',

      testAssertionError: function () {
        assertSame(new AssertionError('hi') + '',
                   'ak.unittest.AssertionError: hi',
                   'AssertionError');
      },

      testTestResult: function () {
        var tr = new TestResult();
        assert(tr.wasSuccessful, 'TestResult wasSuccessful 1');
        tr.startTest(1);
        tr.addSuccess(1);
        assert(tr.wasSuccessful, 'TestResult wasSuccessful 2');
        tr.startTest(2);
        tr.addError(2, 'error');
        tr.startTest(3);
        tr.addFailure(3, 'failure');
        assertSame(tr.testsRun, 3, 'TestResult testsRun');
        assertEqual(tr.errors, [[2, 'error']], 'TestResult errors');
        assertEqual(tr.failures, [[3, 'failure']], 'TestResult failures');
        assert(!tr.wasSuccessful, 'TestResult wasSuccessful 3');
      },

      testTestCase: function () {
        var tested = false, setUp = false, tearedDown = false;
        var started = 0, stopped = 0;
        var tr = new TestResult();
        tr.startTest = function () { ++started; };
        tr.stopTest = function () { ++stopped; };
        function run(t) {
          (new TestCase(t, 'f')).run(tr);
        }

        var test = {
          setUp: function () {
            setUp = true;
          },
          tearDown: function () {
            tearedDown = true;
          },
          f: function () {
            tested = true;
          }};

        var tc = new TestCase(test, 'f');
        assertSame(tc.count, 1, 'TestCase count');
        assertSame(tc + '', 'f', 'TestCase toString');
        test.name = 'test';
        assertSame(repr(tc), '<TestCase f(test)>', 'TestCase repr');

        run(test);
        assert(tested && setUp && tearedDown, 'TestCase run test');
        tested = setUp = tearedDown = false;

        var testBadSetUp = {
          __proto__: test,
          setUp: thrower(1)
        };
        run(testBadSetUp);
        assert(!tested && !setUp && !tearedDown, 'TestCase run testBadSetUp');

        var testError = {
          __proto__: test,
          f: thrower(2)
        };
        run(testError);
        assert(!tested && setUp && tearedDown, 'TestCase run testError');
        setUp = tearedDown = false;

        var assertionError = new AssertionError(3);
        var testFailure = {
          __proto__: test,
          f: thrower(assertionError)
        };
        run(testFailure);
        assert(!tested && setUp && tearedDown, 'TestCase run testFailure');
        setUp = tearedDown = false;

        var testBadTearDown = {
          __proto__: test,
          tearDown: thrower(4)
        };
        run(testBadTearDown);
        assert(tested && setUp && !tearedDown, 'TestCase run testBadTearDown');

        assertEqual(tr.errors.map(itemGetter(1)), [1, 2, 4], 'TestCase errors');
        assertEqual(tr.failures.map(itemGetter(1)), [assertionError],
                    'TestCase failures');
        assertSame(started, stopped, 'TestCase started stopped');
        assertSame(started, 5, 'TestCase started');
      },

      testTestSuite: function () {
        var test = {f: function () {}, g: function () {}};
        var ts = new TestSuite([new TestCase(test, 'f'),
                                new TestCase(test, 'g')]);
        ts.addTest(new TestCase(test, 'f'));
        assertSame(ts.count, 3, 'TestSuite count');
        assertSame(repr(ts),
                   'TestSuite([<TestCase f>, <TestCase g>, <TestCase f>])',
                   'TestSuite repr');
        assertSame(ts + '', 'f, g, f', 'TestSuite toString');
        var tr = new TestResult();
        ts.run(tr);
        assertSame(tr.testsRun, 3, 'TestSuite run');
      },

      testTextTestResult: function () {
        var stream = new Stream();
        var ttr = new TextTestResult(stream);
        ttr.startTest('hi');
        ttr.addError();
        ttr.addFailure();
        ttr.addSuccess();
        assertSame(stream.read(), 'hi ERROR\n FAIL\n ok\n', 'TextTestResult');
      },

      testTextTestRunner: function () {
        var test = {
          name: 'test',

          testOk: function () {},
          testError: thrower(1),
          testAssert: partial(assert, false, 'msg1'),
          testAssertEqual: partial(assertEqual, 1, 2, 'msg2'),
          testAssertThrow: partial(assertThrow, Error, thrower(1), 'msg3')
        };
        var stream = new Stream();
        (new TextTestRunner(stream)).run(loadTests(test));
        assertSame(stream.read(),
                   'testAssert(test) FAIL\n' +
                   'testAssertEqual(test) FAIL\n' +
                   'testAssertThrow(test) FAIL\n' +
                   'testError(test) ERROR\n' +
                   'testOk(test) ok\n' +
                   '=====\n' +
                   'ERROR: testError(test)\n' +
                   '1\n' +
                   '=====\n' +
                   'FAIL: testAssert(test)\n' +
                   'assert failed: msg1\n' +
                   '=====\n' +
                   'FAIL: testAssertEqual(test)\n' +
                   'msg2: 1 <> 2\n' +
                   '=====\n' +
                   'FAIL: testAssertThrow(test)\n' +
                   'Expected Error exception, got Number (1)\n' +
                   '-----\n' +
                   'Ran 5 tests\n' +
                   'FAILED (failures=3, errors=1)',
                   'TextTestRunner');
      },

      testLoadTests: function () {
        assertSame(loadTests({
                               name: 'n',
                               test1: function () {},
                               test2: function () {},
                               test3: 42
                             }) + '',
                   'test1(n), test2(n)',
                   'loadTests without methodNames');
        assertSame(loadTests({f: 1, g: 2}, ['f', 'g']) + '',
                   'f, g',
                   'loadTests with methodNames');
      },

      testMain: function () {
        var suite = loadTests({test: function () {}});
        var stream = new Stream();
        assert(main(suite, stream), 'main');;
      },

      testAssert: function () {
        assert(true, 'assert(true)');
        assertThrow(AssertionError, function () { assert(false); },
                    'assert(false)');
      },

      testAssertEqual: function () {
        assertEqual(null, undefined, 'assertEqual equal');
        assertThrow(AssertionError, function () { assertEqual(1, 2); },
                    'assertEqual not equal');
      },

      testAssertSame: function () {
        assertEqual(1, 1, 'assertSame same');
        assertThrow(AssertionError,
                    function () { assertSame(null, undefined); },
                    'assertSame not same');
      },

      testAssertThrow: function () {
        assertThrow(Number, thrower(1), 'assertThrow');
        assertThrow(AssertionError,
                    function () { assertThrow(Error, thrower(1)); },
                    'assertThrow throw wrong');
        assertThrow(AssertionError,
                    function () { assertThrow(Error, function () {}); },
                    'assertThrow was not thrown');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // main tests
  //////////////////////////////////////////////////////////////////////////////

  mainSuite = loadTests(
    {
      name: 'main',

      setUp: function () {
        this._clean();
        db.createRel('R', {'s': string, 'n': number});
        rels.R.insert({s: 'a', n: 1});
        rels.R.insert({s: 'b', n: 2});
        rels.R.insert({s: 'c', n: 3});
      },

      tearDown: function () {
        this._clean();
      },

      _clean: function () {
        fs.list('').forEach(fs.remove);
        db.dropRels(keys(rels));
      },

      testRemove: function () {
        fs.makeDir('dir');
        fs.makeDir('dir/subdir');
        fs.write('file', 'hello');
        fs.write('dir/subdir/f', 'hi');
        fs.remove('dir');
        fs.remove('file');
        assertEqual(fs.list(''), [], 'fs.remove');
      },

      testWhose: function () {
        assertSame(rels.R.whose('s == "a"').s, 'a', 'Query whose ok');
        assertThrow(Error, function () { rels.R.whose('true'); },
                    'Query whose 3 tuples');
      },

      testField: function () {
        assertEqual(rels.R.by('n').field('n'), [1, 2, 3], 'Query field');
      },

      testSet: function () {
        rels.R.where('n == 1 || s == "c"').set({s: '!'});
        assertEqual(rels.R.by('n').field('s'), ['!', 'b', '!'], 'SubRel set');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // base tests
  //////////////////////////////////////////////////////////////////////////////

  baseSuite = loadTests(
    {
      name: 'base',

      testModule: function () {
        assertSame(repr(ak), '<ak ' + ak.__version__ + '>', 'ak module');
        var m = module('test.module');
        assert(m instanceof Module, 'module instanceof');
        assertEqual(repr(m), '<test.module>');
        assertSame(m.__name__, 'test.module');
        assertSame(m.__version__, undefined);
        assertSame(m, test.module);
        var sm = module('test.module.sub.module', '0.1');
        assertSame(sm.__version__, '0.1');
        assertEqual(repr(sm), '<test.module.sub.module 0.1>');
        assertThrow(Error, function () { module(''); });
        assertThrow(Error, function () { module('test.dont_create..pish'); });
        assertSame(test.dont_create, undefined);
        delete test;
      },

      testUpdateWithMode: function () {
        var o = updateWithMode({}, ak.DONT_ENUM, {a: 1});
        assertSame(o.a, 1, 'updateWithMode set');
        assertSame(repr(o), '{}', 'updateWithMode not enumerable');
      },

      testUpdate: function () {
        var obj1 = {a: 1, b: 1};
        var obj2 = {b: 2, c: 2};
        var obj3 = {c: 3, d: 3};
        var obj = update(obj1, obj2, obj3);
        assertSame(obj, obj1);
        assertSame(obj.a, obj1.a);
        assertSame(obj.b, obj2.b);
        assertSame(obj.c, obj3.c);
      },

      testUpdateTree: function () {
        var a = {'foo': {'bar': 12, 'wibble': 13}};
        var b = {'foo': {'baz': 4, 'bar': 16}, 'bar': 4};
        updateTree(a, b);
        var expect = [['bar', 16], ['baz', 4], ['wibble', 13]];
        var got = items(a.foo);
        got.sort(cmp);
        assertEqual(got, expect, 'updateTree merge');
        assertSame(a.bar, 4, 'updateTree insert');

        var aa = {'foo': {'bar': 12, 'wibble': 13}};
        var bb = {'foo': {'baz': 4, 'bar': 16}, 'bar': 4};

        var cc = updateTree({}, aa, bb);
        got = items(cc.foo);
        got.sort(cmp);
        assertEqual(got, expect, 'updateTree merge (self is null)');
        assertSame(cc.bar, 4, 'updateTree insert (self is null)');

        cc = updateTree({}, aa, bb);
        got = items(cc.foo);
        got.sort(cmp);
        assertEqual(got, expect, 'updateTree merge (self is undefined)');
        assertSame(cc.bar, 4, 'updateTree insert (self is undefined)');
      },

      testClone: function () {
        var O = function (value) {
          this.value = value;
        };
        O.prototype.func = function () {
          return this.value;
        };

        var o = new O('boring');
        var p = clone(o);
        assert(p instanceof O, 'cloned correct inheritance');
        var q = clone(p);
        assert(q instanceof O, 'clone-cloned correct inheritance');
        q.foo = 'bar';
        assertSame(p.foo, undefined, 'clone-clone is copy-on-write');
        p.bar = 'foo';
        assertSame(o.bar, undefined, 'clone is copy-on-write');
        assertSame(q.bar, 'foo', 'clone-clone has proper delegation');
        assertSame(p.func(), 'boring', 'clone function calls correct');
        q.value = 'awesome';
        assertSame(q.func(), 'awesome', 'clone really does work');
      },

      testRepr: function () {
        assertSame(repr(undefined), 'undefined', 'undefined repr');
        assertSame(repr(null), 'null', 'null repr');
        var o = {__repr__: function () { return 'hi'; }};
        assertSame(repr(o), 'hi', 'custom __repr__');
        o.__repr__ = undefined;
        assertSame(repr(o), '[object Object]', 'Object without __repr__');
      },

      testItems: function () {
        var o = {a: 1, b: 2};
        var expect = [['a', 1], ['b', 2]];
        var o_items = items(o);
        o_items.sort();
        assertEqual(o_items, expect, 'items');
      },

      testCmp: function () {
        assertSame(cmp(1, 1), 0, 'cmp(1, 1)');
        assertSame(cmp(Number(1), 1), 0, 'cmp Number');
        assertSame(cmp(String('hi'), 'hi'), 0, 'cmp String');
        assertSame(cmp(true, Boolean(true)), 0, 'cmp Boolean');
        assertSame(cmp(null, undefined), 0, 'cmp(null, undefined)');
        assertSame(cmp(null, 1), -1, 'cmp(null, non null)');
        assertSame(cmp('a', undefined), 1, 'cmp(non null, null)');
        assertSame(cmp(1, 2), -1, 'cmp(1, 2)');
        assertSame(cmp(true, "0"), 1, 'cmp(true, "0")');
        var o = {__cmp__: function (other) { return 1; }};
        assertSame(cmp(o, 1), 1, 'custom __cmp__ in first arg');
        assertSame(cmp(1, o), -1, 'custom cmp in second arg');
        assertThrow(TypeError, function () {
                      cmp({}, 1);
                    });
      },

      testEqual: function () {
        assertSame(equal(1, 1), true, 'equal');
        assertSame(equal(1, 2), false, 'not equal');
      },

      testSetDefault: function () {
        var a = setDefault({'foo': 'bar'}, {'foo': 'unf'}, {'bar': 'web taco'});
        assertSame(a.foo, 'bar', 'setDefault worked (skipped existing)');
        assertSame(a.bar, 'web taco', 'setDefault worked (set non-existing)');
      },

      testKeys: function () {
        var a = keys({a: 1, b: 2, c: 3});
        a.sort();
        assertEqual(a, ['a', 'b', 'c'], 'keys');
      },

      testValues: function () {
        var o = {a: 1, b: 2, c: 4, d: -1};
        var got = values(o);
        got.sort();
        assertEqual(got, [-1, 1, 2, 4], 'values');
      },

      testIndicators: function () {
        assert(indicators.null_(null), 'indicators.null_');
        assert(indicators.undefined_(undefined), 'indicators.undefined_');
        assert(indicators.undefinedOrNull(undefined),
               'indicators.undefinedOrNull undefined');
        assert(indicators.undefinedOrNull(null),
               'indicators.undefinedOrNull null');
        assert(indicators.empty([]), 'indicators.empty');
        assert(indicators.arrayLike({length: null}),
               'indicators.arrayLike {length: null}');
        assert(!indicators.arrayLike(1),
               'indicators.arrayLike 1');
      },

      testCompose: function () {
        assertSame(compose()(1, 2, 3), 1, 'empty compose');
        assertSame(compose(function (x) { return x * x; },
                           function (x) { return x + 1; })(2),
                   9,
                   'compose');
      },

      testBind: function () {
        var not_self = {'toString': function () { return 'not self'; }};
        var self = {'toString': function () { return 'self'; }};
        var func = function (arg) { return this.toString() + ' ' + arg; };
        var boundFunc = bind(func, self);
        not_self.boundFunc = boundFunc;

        assertSame(boundFunc('foo'), 'self foo',
                   'boundFunc bound to self properly');
        assertSame(not_self.boundFunc('foo'), 'self foo',
                   'boundFunc bound to self on another obj');
      },

      testPartial: function () {
        var p = partial(function (a, b, c, d) { return [a, b, c, d]; }, 1, 2);
        assertEqual(p(3, 4), [1, 2, 3, 4], 'partial');
        assertEqual(p(5, 6), [1, 2, 5, 6], 'partial again');
      },

      testMethod: function () {
        var o = {f: method(function (self) { return self.x; }), x: 42};
        assertSame(o.f(), 42);
      },

      testFactory: function () {
        var C = makeClass(function (x) { this.x = x; });
        var c = factory(C)(1);
        assert(c instanceof C, 'factory instanceof');
        assertSame(c.x, 1, 'factory property');
      },

      testNameFunctions: function () {
        assertSame(repr(nameFunctions), 'ak.base.nameFunctions',
                   'nameFunctions');
      },

      testMakeClass: function () {
        var C = makeClass(function (x) { this.x = x; },
                          undefined,
                          {f: function (x) { this.x = x; }});
        var c = new C(42);
        assertSame(c.constructor, C, 'makeClass constructor property');
        assert(c instanceof C, 'makeClass instanceof');
        assert(c instanceof Object, 'makeClass instanceof Object');
        assertSame(c.x, 42, 'makeClass initialization');
        var D = makeClass(undefined, C, {get y() { return this.x; }});
        var d = new D(111);
        assertSame(d.x, 111, 'makeClass derived parent property');
        assertSame(d.y, 111, 'makeClass derived getter');
        assert(d instanceof D, 'makeClass derived instanceof');
        assert(d instanceof C, 'makeClass derived instanceof parent');
        d.f(15);
        assertSame(d.x, 15, 'makeClass derived parent method');
        assert(repr(new makeClass()), '{}', 'makeClass()');
      },

      testMakeErrorClass: function () {
        var E = makeErrorClass();
        E.__name__ = 'E';
        var e = new E('yo');
        assert(e instanceof Error, 'makeErrorClass instanceof Error');
        assertSame(e.name, 'E', 'makeErrorClass name');
        var D = makeErrorClass(E);
        var d = new D(['hello', 'world']);
        assert(d instanceof E, 'makeErrorClass derived instanceof parent');
        assertSame(d.message, 'hello,world', 'makeErrorClass message');
        assertSame(d.name, 'E', 'makeErorClass derived name');
        var TE = makeErrorClass(TypeError);
        assertSame((new TE()).name, 'TypeError', 'makeErrorClass default name');
      },

      //////////////////////////////////////////////////////////////////////////
      // Object methods tests
      //////////////////////////////////////////////////////////////////////////

      testSetProp: function () {
        var o = {};
        o.setProp('x', ak.DONT_DELETE, 42);
        delete o.x;
        assertSame(o.x, 42, 'setProp');
      },

      testSetNonEnumerable: function () {
        var o = {};
        o.setNonEnumerable('a', 42);
        assertSame(o.a, 42, 'setNonEnumerable set');
        assertEqual(items(o), [], 'setNonEnumerable non enumerable');
      },

      //////////////////////////////////////////////////////////////////////////
      // Array methods tests
      //////////////////////////////////////////////////////////////////////////

      testArrayCmp: function () {
        assertEqual([], [], 'empty array cmp');
        assertEqual([1, 2, 3], [1, 2, 3], 0, 'equal array cmp');
        assertSame(cmp([1, 2], [1, 2, 3]), -1, 'less len array cmp');
        assertSame(cmp([1, 2], [1]), 1, 'more len array cmp');
        assertSame(cmp([1, 2, 3], [1, 2, '4']), -1, 'less item array cmp');

      },

      testFlatten: function () {
        var flat = [1, '2', 3, [4, [5, [6, 7], 8, [], 9]]].flatten();
        var expect = [1, '2', 3, 4, 5, 6, 7, 8, 9];
        assertEqual(flat, expect, 'flatten');
      },

      testIndex: function () {
        assertSame([1, 2, 3].index(4), -1, 'index returns -1 on not found');
        assertSame([1, 2, 3].index(1), 0, 'index returns correct index');
        assertSame([1, 2, 3].index(1, 1), -1, 'index honors start');
        assertSame([{__cmp__: function () { return 0; }}].index(1), 0,
                   'index with custom __cmp__');
      },

      testExtend: function () {
        var a = [];
        var b = [];
        var three = [1, 2, 3];

        a.extend(three, 1);
        assert(equal(a, [2, 3]), 'extend to an empty array');
        a.extend(three, 1);
        assert(equal(a, [2, 3, 2, 3]), 'extend to a non-empty array');
        b.extend(three);
        assert(equal(b, three), 'extend of an empty array');
      },

      testDateCmp: function () {
        var str1 = 'Mon, 03 Aug 2009 14:49:29 GMT';
        var str2 = 'Mon, 03 Aug 2009 14:49:30 GMT';
        assertEqual(new Date(str1), new Date(str1), 'Date equal');
        assertSame(cmp(new Date(str1), new Date(str2)), -1, 'Date less');
      },

      testObjectRepr: function () {
        assertSame(repr({}), '{}', '{} repr');
        assertSame(repr({a: 1, b: "c"}), '{a: 1, b: "c"}',
                   'complex object repr');
      },

      testArrayRepr: function () {
        assertSame(repr([]), '[]', '[] repr', 'empty array cmp');
        assertSame(repr([1, "a", [2, 3]]), '[1, "a", [2, 3]]',
                   'complex array repr');
      },

      testDateRepr: function () {
        var str = 'Mon, 03 Aug 2009 14:49:29 GMT';
        assertSame(repr(new Date(str)), str, 'Date repr');
      },

      testFunctionRepr: function () {
        function f(a, b) {}
        assertSame(repr(f), 'function f(a, b) {...}', 'function repr');
        assertSame(repr(function () { return 42; }), 'function () {...}',
                   'anonymous function repr');
      },

      testStringRepr: function () {
        assertSame(repr(""), '""', 'empty string repr');
        assertSame(repr('foo"\f\b\n\t\v\r'),
                   '"foo\\"\\f\\b\\n\\t\\v\\r"',
                   'string repr');
      },

      testNumberRepr: function () {
        assertSame(repr(42), '42', 'number repr');
      },

      testBooleanRepr: function () {
        assertSame(repr(true), 'true', 'true repr');
        assertSame(repr(false), 'false', 'false repr');
      },

      testErrorRepr: function () {
        assertSame(repr(new Error()), 'Error()',
                   'Error repr without message');
        assertSame(repr(new Error('hello')), 'Error("hello")',
                   'Error repr with message');
        assertEqual(repr(new TypeError([1, 2])), 'TypeError("1,2")',
                    'Error repr with strange message');
      },

      testRegExpRepr: function () {
        assertSame(repr(/hi/g), '/hi/g');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // utils tests
  //////////////////////////////////////////////////////////////////////////////

  utilsSuite = loadTests(
    {
      name: 'utils',

      testRange: function () {
        assertEqual(range(), [], 'range without arguments');
        assertEqual(range(3), [0, 1, 2], 'range with stop');
        assertEqual(range(4, 7), [4, 5, 6], 'range with start and stop');
        assertEqual(range(4, 7, 2), [4, 6], 'range with start, stop and step');
        assertEqual(range(7, 4, -1), [7, 6, 5], 'range with negative step');
        assertThrow(TypeError, function () { range(2, 3, 0); },
                    'range with step=0');
      },

      testCamelize: function () {
        assertSame(camelize('one'), 'one', 'one word');
        assertSame(camelize('one-two'), 'oneTwo', 'two words');
        assertSame(camelize('one-two-three'), 'oneTwoThree', 'three words');
        assertSame(camelize('1-one'), '1One', 'letter and word');
        assertSame(camelize('one-'), 'one', 'trailing hyphen');
        assertSame(camelize('-one'), 'One', 'starting hyphen');
        assertSame(camelize('o-two'), 'oTwo', 'one character and word');
      },

      testCounter: function () {
        var c = counter();
        assertSame(c(), 0, 'counter starts at 0');
        assertSame(c(), 1, 'counter increases');
        c = counter(2);
        assertSame(c(), 2, 'counter starts at 2');
        assertSame(c(), 3, 'counter increases');
      },

      testFlattenArguments: function () {
        var flat = flattenArguments(1, '2', 3, [4, [5, [6, 7], 8, [], 9]]);
        var expect = [1, '2', 3, 4, 5, 6, 7, 8, 9];
        assertEqual(flat, expect, 'flattenArguments');
      },

      testItemGetter: function () {
        var g = itemGetter('a');
        assertSame(g({a: 1}), 1, 'itemGetter');
      },

      testTypeMatcher: function () {
        var tm = typeMatcher('number', 'object');
        assert(tm([], {}, 1), 'typeMatcher Array, Object, number');
        assert(!tm(function () {}), 'typeMatcher Function');
        assert(!tm('hi'), 'typeMatcher string');
      },

      testMethodCaller: function () {
        assertEqual(methodCaller(function () {
                                   return [this, Array.apply(null, arguments)];
                                 },
                                 2, 3)(1),
                    [1, [2, 3]],
                    'methodCaller function');
        var o = {x: 1, f: function (y) { return this.x + y; }};
        assertSame(methodCaller('f', 2)(o), 3, 'methodCaller name');
      },

      testKeyComparator: function () {
        var a1 = {'a': 1, 'b': 2, 'c': 2};
        var a2 = {'a': 2, 'b': 1, 'c': 2};
        assertSame(keyComparator('a')(a1, a2), -1, 'keyComparator 1 lt');
        assertSame(keyComparator('c')(a1, a2), 0, 'keyComparator 1 eq');
        assertSame(keyComparator('c', 'b')(a1, a2), 1, 'keyComparator 2 eq gt');
        assertSame(keyComparator('c', 'a')(a1, a2), -1, 'keyComparator 2 eq lt');
      },

      testThrower: function () {
        assertThrow(TypeError, thrower(new TypeError('hi')),
                    'thrower TypeError');
        assertThrow(Number, thrower(1),
                    'thrower number');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // iter tests
  //////////////////////////////////////////////////////////////////////////////

  iterSuite = loadTests(
    {
      name: 'iter',

      testIter: function () {
        var itr = iter([]);
        assertSame(iter(itr), itr, 'iter from Iterator');
      },

      testList: function () {
        var array = [1, 2, 3];
        assertEqual(list(iter(array)), array, 'list on iterator');
        assertEqual(list(array), array, 'list on Array');
      },

      testIterator: function () {
        var itr = new Iterator();
        assertThrow(ReferenceError, function () { itr.valid; },
                    'Iterator valid');
        assertThrow(ReferenceError, bind(itr.next, itr), 'Iterator next');
        itr.valid = true;
        assertSame(repr(itr), '<valid ak.iter.Iterator>');
      },

      testInvalidIterator: function () {
        assert(!(new InvalidIterator()).valid, 'InvalidIterator');
      },

      testAdvance: function () {
        var itr = iter([1, 2, 3, 4]);
        advance(itr, 3);
        assertSame(itr.next(), 4, 'advance');
      },

      testMin: function () {
        assertSame(min([2, 3, 1, 4]), 1, 'min');
        assertSame(min([1, 2, 3, 4]), 1, 'min with first');
        assertThrow(Error, function () { min([]); }, 'min on empty');
      },

      testMax: function () {
        assertSame(max([2, 3, 1, 4, 0]), 4, 'max');
      },

      testReduce: function () {
        assertSame(reduce(operators.add, [1, 2, 3, 4, 5]), 15,
                   'reduce(operators.add)');
        assertThrow(Error, function () { reduce(operators.add, []); },
                    'reduce has thrown Error correctly');
        assertSame(reduce(operators.add, [], 10), 10,
                   'reduce initial value OK empty');
        assertSame(reduce(operators.add, [1, 2, 3], 10), 16,
                   'reduce initial value OK populated');
      },

      testSum: function () {
        assertEqual(sum(range(10)), 45, 'sum');
        assertEqual(sum([]), 0, 'sum on empty without start');
        assertEqual(sum([], 4), 4, 'sum on empty with start');
        assertEqual(sum([1, 2], 4), 7, 'sum with start');
      },

      testExhaust: function () {
        var itr = iter([1, 2, 3]);
        exhaust(itr);
        assert(!itr.valid, 'exhaust');
        exhaust(itr);
        assert(!itr.valid, 'exhaust again');
        itr = iter([]);
        exhaust(itr);
        assert(!itr.valid, 'exhaust on empty');
      },

      testForEach: function () {
        var s = 0;
        function f(x) { s += x; }
        forEach([1, 2, 3], f);
        assertSame(s, 6, 'forEach');
        forEach([], f);
        assertSame(s, 6, 'forEach on empty');
      },

      testEvery: function () {
        function f (x) { return x < 5; }
        assert(!every([1, 2, 3, 4, 5, 4], f), 'every false');
        assert(every([1, 2, 3, 4, 4], f), 'every true');
        assert(every([], f), 'every on empty');
      },

      testSome: function () {
        function f (x) { return x < 5; }
        assert(some([10, 2, 3, 4, 4], f), 'some true');
        assert(!some([5, 6, 7, 8, 9], f), 'some false');
        assert(some([5, 6, 7, 8, 4], f), 'some true again');
        assert(!some([], f), 'some on empty');
      },

      testSorted: function () {
        assertEqual(sorted([3, 2, 1]), [1, 2, 3], 'sorted default');
        var a = sorted(['aaa', 'bb', 'c'], keyComparator('length'));
        assertEqual(a, ['c', 'bb', 'aaa'], 0, 'sorted custom');
      },

      testReversed: function () {
        assertEqual(reversed(range(4)), [3, 2, 1, 0], 'reversed iterator');
        assertEqual(reversed([5, 6, 7]), [7, 6, 5], 'reversed list');
      },

      testISlice: function () {
        var array = [1, 2, 3, 4, 5, 6];
        assertEqual(list(islice(array)), array, 'islice without borders');
        assertEqual(list(islice(array, 4)), [5, 6],
                    'islice with start');
        assertEqual(list(islice(array, undefined, 3)), [1, 2, 3],
                    'islice with stop');
        assertEqual(list(islice(array, 2, 4)), [3, 4],
                    'islice with start and stop');
        assertEqual(list(islice(array, 4, 10)), [5, 6],
                    'islice with start and big stop');
      },

      testCount: function () {
        assertEqual(list(islice(count(), 0, 3)), [0, 1, 2],
                   'count without argument');
        assertEqual(list(islice(count(2), 0, 2)), [2, 3],
                   'count without argument');
      },

      testCycle: function () {
        assertEqual(list(islice(cycle([1, 2, 3]), 0, 8)),
                    [1, 2, 3, 1, 2, 3, 1, 2],
                    'cycle');
        assert(!cycle([]).valid, 'cycle on empty');
      },

      testRepeat: function () {
        assertEqual(list(repeat(1, 3)), [1, 1, 1], 'repeat');
        assertEqual(list(islice(repeat(1), 0, 3)), [1, 1, 1],
                    'infinite repeat');
      },

      testIZip: function () {
        assertEqual(list(izip([1, 2, 3], [4, 5], [6, 7, 8])),
                    [[1, 4, 6], [2, 5, 7]],
                    'izip');
        assert(!izip([1], []).valid, 'izip on empty');
      },

      testIFilter: function () {
        function isEven(x) { return x % 2 == 0; };
        assertEqual(list(ifilter([1, 2, 3, 4, 5, 6], isEven)),
                    [2, 4, 6],
                    'ifilter');
        assert(!ifilter([1, 3, 5], isEven).valid, 'invalid ifilter');
        assert(!ifilter([], isEven).valid, 'ifilter on empty');
        assertEqual(list(ifilter([2, 3, 4, 5, 6, 7], isEven)),
                    [2, 4, 6],
                    'another ifilter');
      },

      testIMap: function () {
        function square(x) { return x * x; }
        assertEqual(list(imap([1, 2, 3], square)), [1, 4, 9], 'imap');
        assert(!imap([], square).valid, 'imap on empty');
      },

      testChain: function () {
        assertEqual(list(chain([1, 2], [], [3, 4], [], [])), [1, 2, 3, 4],
                    'chain');
        assert(!chain([], []).valid, 'chain on empties');
        assert(!chain().valid, 'chain without arguments');
      },

      testTakeWhile: function () {
        function isPositive(x) { return x > 0; }
        assertEqual(list(takeWhile([1, 2, 0], isPositive)), [1, 2],
                    'takeWhile');
        assertEqual(list(takeWhile([1, 2, 3], isPositive)), [1, 2, 3],
                    'takeWhile always true');
        assertEqual(list(takeWhile([-1, 2, 3], isPositive)), [],
                    'takeWhile false at once');
        assertEqual(list(takeWhile([], isPositive)), [],
                    'takeWhile on empty');
      },

      testDropWhile: function () {
        function isPositive(x) { return x > 0; }
        assertEqual(list(dropWhile([1, 2, 0, 3], isPositive)), [0, 3],
                    'dropWhile');
        assertEqual(list(dropWhile([0, 3], isPositive)), [0, 3],
                    'dropWhile from first');
        assertEqual(list(dropWhile([3, 0], isPositive)), [0],
                    'dropWhile from last');
        assertEqual(list(dropWhile([1, 2, 3], isPositive)), [],
                    'dropWhile always false');
        assertEqual(list(dropWhile([], isPositive)), [],
                    'dropWhile on empty');
      },

      testTee: function () {
        var array = [0, 1, 2, 3, 4];
        var c = tee(array, 3);
        assertEqual(list(c[0]), list(c[1]), 'tee(..., 3) p0 == p1');
        assertEqual(list(c[2]), array, 'tee(..., 3) p2 == fixed');
      },

      testGroupBy: function () {
        assertEqual(list(groupBy([0, 0, 0, 1, 2, 2, 3])),
                    [[0, [0, 0, 0]], [1, [1]], [2, [2, 2]], [3, [3]]],
                    'groupBy on Array');
        assertEqual(list(groupBy('aabb')),
                    [['a', ['a', 'a']], ['b', ['b', 'b']]],
                    'groupBy on string');
        assertEqual(list(groupBy([])), [], 'groupBy on empty');
      },

      testObjectIterator: function () {
        var o = {a: 1, b: 2};
        var lst = list(iter(o));
        lst.sort();
        var expect = items(o);
        expect.sort();
        assertEqual(lst, expect, 'ObjectIterator');
      },

      testArrayIterator: function () {
        var itr = iter([1, 2]);
        assertSame(itr.valid && itr.next(), 1, 'array iteration first');
        assertSame(itr.valid && itr.next(), 2, 'array iteration second');
        assertSame(repr(itr), '<invalid ak.iter.ArrayIterator>');
        assert(!itr.valid, 'array iteration stop');
        assertEqual(list(iter('abc')), ['a', 'b', 'c'],
                    'ArrayIterator for String');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // io tests
  //////////////////////////////////////////////////////////////////////////////

  ioSuite = loadTests(
    {
      name: 'io',

      testStream: function () {
        var s = new Stream();
        s.write('hello');
        assertSame(s.read(4), 'hell', 'Stream read 1');
        assertSame(s.read(), 'o', 'Stream read 2');
        assertSame(s.read(), undefined, 'Stream read 3');
        s.write('there');
        s.write('are');
        s.write('some');
        s.write('words');
        assertSame(s.read(6), 'therea', 'Stream read 4');
        assertSame(s.read(2), 're', 'Stream read 5');
        assertSame(s.read(), 'somewords', 'Stream read 5');
        s.writeLine('line');
        s.writeLine('another');
        s.writeLine('splited\nline');
        assertSame(s.readLine(), 'line', 'Stream readLine 1');
        assertSame(s.read(10), 'another\nsp', 'Stream readLine read');
        assertSame(s.readLine(), 'lited', 'Stream readLine 2');
        assertSame(s.readLine(), 'line', 'Stream readLine 3');
        assertSame(s.readLine(), undefined, 'Stream readLine 4');
        s.writeLine('1\n2');
        s.write(3);
        assertEqual(list(s), ['1', '2', '3'], 'Stream list');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // suite and main
  //////////////////////////////////////////////////////////////////////////////

  $.suite = new TestSuite([
                            unittestSuite,
                            mainSuite,
                            baseSuite,
                            utilsSuite,
                            iterSuite,
                            ioSuite
                          ]);

  $.main = partial(main, $.suite);

  nameFunctions($);

}})();
