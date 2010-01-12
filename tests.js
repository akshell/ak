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

// 'with' is used here in order to ensure that ak namespace is used correctly
(function () { with (ak.use('ak'))
{
  //////////////////////////////////////////////////////////////////////////////
  // debug tests
  //////////////////////////////////////////////////////////////////////////////

  var DebugTestCase = TestCase.subclass(
    {
      name: 'debug',

      testAssertionError: function () {
        assertSame(new AssertionError('hi') + '',
                   'ak.AssertionError: hi',
                   'AssertionError');
      },

      testAssert: function () {
        assert(true, 'assert(true)');
        assertThrow(AssertionError, function () { assert(false); },
                    'assert(false)');
      },

      testAssertEqual: function () {
        assertEqual(42, {__eq__: function (other) { return other === 42; }},
                    'assertEqual equal');
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
  // unittest tests
  //////////////////////////////////////////////////////////////////////////////

  var UnittestTestCase = TestCase.subclass(
    {
      name: 'unittest',

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

        var TC = TestCase.subclass(
          {
            setUp: function () {
              setUp = true;
            },
            tearDown: function () {
              tearedDown = true;
            },
            f: function () {
              tested = true;
            }
          });

        function run(TC) {
          (new TC('f')).run(tr);
        }


        var tc = new TC('f');
        assertSame(tc.count, 1, 'TestCase count');
        assertSame(tc + '', 'f', 'TestCase toString');
        tc.name = 'test';
        assertSame(repr(tc), '<TestCase f(test)>', 'TestCase repr');

        run(TC);
        assert(tested && setUp && tearedDown, 'TestCase run TC');
        tested = setUp = tearedDown = false;

        var BadSetUpTC = TC.subclass({setUp: thrower(1)});
        run(BadSetUpTC);
        assert(!tested && !setUp && !tearedDown, 'TestCase run BadSetUpTC');

        var ErrorTC = TC.subclass({f: thrower(2)});
        run(ErrorTC);
        assert(!tested && setUp && tearedDown, 'TestCase run ErrorTC');
        setUp = tearedDown = false;

        var assertionError = new AssertionError(3);
        var FailureTC = TC.subclass({f: thrower(assertionError)});
        run(FailureTC);
        assert(!tested && setUp && tearedDown, 'TestCase run FailureTC');
        setUp = tearedDown = false;

        var BadTearDownTC = TC.subclass({tearDown: thrower(4)});
        run(BadTearDownTC);
        assert(tested && setUp && !tearedDown, 'TestCase run BadTearDownTC');

        assertEqual(tr.errors.map(attrGetter(1)), [1, 2, 4], 'TestCase errors');
        assertEqual(tr.failures.map(attrGetter(1)), [assertionError],
                    'TestCase failures');
        assertSame(started, stopped, 'TestCase started stopped');
        assertSame(started, 5, 'TestCase started');
      },

      testTestSuite: function () {
        var TC = TestCase.subclass({f: function () {}, g: function () {}});
        var ts = new TestSuite([new TC('f'), new TC('g')]);
        ts.addTest(new TC('f'));
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
        var TC = TestCase.subclass(
          {
            testOk: function () {},
            testError: thrower(1),
            testAssert: partial(assert, false, 'msg1'),
            testAssertEqual: partial(assertEqual, 1, 2, 'msg2'),
            testAssertThrow: partial(assertThrow, Error, thrower(1), 'msg3')
          });
        TC.__name__ = 'test';
        var stream = new Stream();
        (new TextTestRunner(stream)).run(TC.loadSuite());
        assert(stream.read().startsWith(
                 'testAssert(test) FAIL\n' +
                 'testAssertEqual(test) FAIL\n' +
                 'testAssertThrow(test) FAIL\n' +
                 'testError(test) ERROR\n' +
                 'testOk(test) ok\n' +
                 '=====\n'),
                 'TextTestRunner');
      },

      testLoadSuite: function () {
        assertSame(TestCase.subclass(
                     {
                       name: 'n',
                       test1: function () {},
                       test2: function () {},
                       test3: 42
                     }).loadSuite() + '',
                   'test1(n), test2(n)');
        assertSame(TestCase.subclass(
                     {
                       name: 'n',
                       f: function () {},
                       g: function () {}
                     }).loadSuite(['f', 'g']) + '',
                   'f(n), g(n)');
        assertSame(loadSuite([TestCase.subclass({test1: function () {}}),
                              TestCase.subclass({test2: function () {}})]) + '',
                   'test1, test2');
      },

      testRunTestSuite: function () {
        var suite = TestCase.subclass({test: function () {}}).loadSuite();
        var stream = new Stream();
        assert(runTestSuite(suite, stream), 'test');;
      },

      testTestClient: function () {
        var client = new TestClient(
          ['user1', 'user2'],
          {
            app1: {
              admin: 'user1'
            },
            app2: {
              admin: 'user2',
              developers: ['user1']
            },
            app3: {
              admin: 'user1'
            },
            app4: {
              admin: 'user2',
              developers: ['user1']
            }
          });
        var aspect = weave(InsteadOf, global, '__main__',
                           function (request) { return eval(request.data); });
        function request(data) {
          return client.request({data: data});
        }

        assertThrow(NoSuchUserError,
                    function () { client.login('no_such_user'); });
        client.login('user1');
        assertSame(request('request.user'), 'user1');
        assertSame(client.request({user: 'user2', data: 'request.user'}),
                   'user2');
        client.logout();
        assertSame(request('request.user'), undefined);

        assertSame(client.get({data: 'request.method'}), 'get');
        assertSame(client.put({data: 'request.method'}), 'put');
        assertSame(client.post({data: 'request.method'}), 'post');
        assertSame(client.del({data: 'request.method'}), 'delete');

        assertSame(request('ak.describeApp("app1")'), client.apps.app1);
        assertEqual(request('ak.getAdminedApps("user1")'), ['app1', 'app3']);
        assertEqual(request('ak.getDevelopedApps("user1")'), ['app2', 'app4']);
        assertEqual(request('ak.getDevelopedApps("user2")'), []);
        assertThrow(
          NoSuchUserError,
          function () { request('ak.getAdminedApps("no_such_user")'); });
        assertThrow(
          NoSuchUserError,
          function () { request('ak.getDevelopedApps("no_such_user")'); });

        var context = {};
        assertSame(
          request(
            'new ak.Response((new ak.Template("")).render(context))').context,
          context);

        var C = Controller.subclass(
          {
            get: function () { return {}; },
            getXPage: function () { return {}; }
          });
        assertSame(request('C({method: "get"})').controller, C);
        assertSame(request('C.page("x")({method: "get"})').controller,
                   C.page('x'));

        aspect.unweave();
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // core tests
  //////////////////////////////////////////////////////////////////////////////

  function testRequest(appName, request, files, data) {
    return ([data, ak.repr(JSON.parse(request)[appName])].concat(files)
            .join('\n'));
  }


  var CoreTestCase = TestCase.subclass(
    {
      name: 'core',

      setUp: function () {
        this._clean();
        db.RV.create({s: string, n: number});
        db.RV.insert({s: 'a', n: 1});
        db.RV.insert({s: 'b', n: 2});
        db.RV.insert({s: 'c', n: 3});
      },

      tearDown: function () {
        this._clean();
      },

      _clean: function () {
        fs.list('').forEach(fs.remove);
        dropRelVars(keys(db));
      },

      testDescribeApp: function () {
        var description = describeApp('ak');
        assertSame(description.name, 'ak');
        assertSame(description.admin, description.developers[0]);
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

      testWhere: function () {
        var q = db.RV.where('n % 2 == 1').by('n');
        assertEqual(q, [{s: 'a', n: 1}, {n: 3, s: 'c'}]);
        assertEqual(q, q);
        assert(!equal(q, [null, 42]));
        assert(!equal(q, [{s: 'a', n: 1}, {n: 4, s: 'c'}]));
        assert(!equal(q, [{s: 'a', n: 1}]));
        assertEqual(db.RV.where({n: 2}), [{s: 'b', n: 2}]);
        assertSame(db.RV.where({n: 1, s: 'a'})[0].n, 1);
      },

      testField: function () {
        assertEqual(db.RV.by('n').field('n'), [1, 2, 3]);
      },

      testSet: function () {
        db.RV.where('n == 1 || s == "c"').set({s: '!'});
        assertEqual(db.RV.by('n').field('s'), ['!', 'b', '!']);
      },

      testRequest: function() {
        var oldRequest = ak._request;
        ak._request = testRequest;
        var response = request('method', {data: '201\n'});
        assertSame(response.status, 201);
        assertSame(response.content, '"GET"');
        assertEqual(items(response.headers), []);
        response = request('post', {data: '200\n', post: 'hi'});
        assertSame(response.content, '"hi"');
        response = request('get', {data: '200\n'});
        assertSame(response.content, '{}');
        response = request('fileNames',
                           {data: '200\n',
                            files: {f1: 'file1', f2: 'file2'}});
        assertSame(response.content, '["f1", "f2"]\nfile1\nfile2');
        response = request('headers', {data: '200\na: b\nc:  d\n'});
        assertEqual(items(response.headers), [['a', 'b'], ['c', ' d']]);
        assertThrow(RequestError, function () { request('', {}); });
        assertThrow(RequestError, function () { request('', {data: '!\n'}); });
        assertThrow(RequestError,
                    function () { request('', {data: '200\na:b\n'}); });
        ak._request = oldRequest;
      },

      testURI: function () {
        var request = new Request({
                                    fullPath: 'a/b',
                                    headers: {Host: 'ak.akshell.com'}
                                  });
        assertSame(request.uri, 'http://ak.akshell.com/a/b');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // base tests
  //////////////////////////////////////////////////////////////////////////////

  var BaseTestCase = TestCase.subclass(
    {
      name: 'base',

      //////////////////////////////////////////////////////////////////////////
      // Object methods tests
      //////////////////////////////////////////////////////////////////////////

      testObjectSetProp: function () {
        var o = {};
        o.setProp('x', DONT_DELETE, 42);
        delete o.x;
        assertSame(o.x, 42, 'setProp');
      },

      testObjectSetNonEnumerable: function () {
        var o = {};
        o.setNonEnumerable('a', 42);
        assertSame(o.a, 42, 'setNonEnumerable set');
        assertEqual(items(o), [], 'setNonEnumerable non enumerable');
      },

      testObjectInstances: function () {
        assertSame({}.instances(Object.subclass({x: 42})).x, 42);
      },

      //////////////////////////////////////////////////////////////////////////
      // Free functions tests
      //////////////////////////////////////////////////////////////////////////

      testModule: function () {
        assertSame(repr(ak), '<ak ' + ak.__version__ + '>', 'ak module');
        var m = new Module('TeSt.module');
        assert(m instanceof Module, 'module instanceof');
        assertEqual(repr(m), '<TeSt.module>');
        assertSame(m.__name__, 'TeSt.module');
        assertSame(m.__version__, undefined);
        assertSame(m, TeSt.module);
        var sm = new Module('TeSt.module.sub.module', '0.1');
        assertSame(sm.__version__, '0.1');
        assertEqual(repr(sm), '<TeSt.module.sub.module 0.1>');
        assertThrow(Error, function () { module(''); });
        assertThrow(Error, function () { module('TeSt.dont_create..pish'); });
        assertSame(TeSt.dont_create, undefined);
        delete TeSt;
      },

      testUpdateWithMode: function () {
        var o = updateWithMode({}, DONT_ENUM, {a: 1});
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
        o_items.sort(cmp);
        assertEqual(o_items, expect, 'items');
      },

      testCmp: function () {
        assertSame(cmp(1, 1), 0, 'cmp(1, 1)');
        assertSame(cmp(Number(1), 1), 0, 'cmp Number');
        assertSame(cmp(String('hi'), 'hi'), 0, 'cmp String');
        assertSame(cmp(true, Boolean(true)), 0, 'cmp Boolean');
        assertSame(cmp(1, 2), -1, 'cmp(1, 2)');
        var o = {__cmp__: function (other) { return 1; }};
        assertSame(cmp(o, 1), 1, 'custom __cmp__ in first arg');
        assertSame(cmp(1, o), -1, 'custom cmp in second arg');

        assertThrow(TypeError, function () { cmp(null, undefined); },
                    'cmp(null, undefined)');
        assertThrow(TypeError, function () { cmp(null, 1); },
                    'cmp(null, non null)');
        assertThrow(TypeError, function () { cmp('a', undefined); },
                    'cmp(non undefined, undefined)');
        assertThrow(TypeError, function () { cmp(true, "0"); },
                    'cmp(true, "0")');
        assertThrow(TypeError, function () { cmp({}, 1); });
        assertThrow(TypeError, function () { cmp({__cmp__: 42}, 1); });
      },

      testEqual: function () {
        assert(equal(1, 1), 'equal');
        assert(!equal(1, 2), 'not equal');
        assert(equal(1, {__eq__: function () { return true; }}),
               'equal __eq__ true');
        assert(!equal({__eq__: function () { return false; }}, 1),
               'equal __eq__ false');
        assert(equal({__cmp__: function () { return 1; }},
                     {__eq__: function () { return true; }}),
               'equal __cmp__ __eq__');
      },

      testSetDefault: function () {
        var a = setDefault({'foo': 'bar'}, {'foo': 'unf'}, {'bar': 'web taco'});
        assertSame(a.foo, 'bar', 'setDefault worked (skipped existing)');
        assertSame(a.bar, 'web taco', 'setDefault worked (set non-existing)');
      },

      testKeys: function () {
        var a = keys({a: 1, b: 2, c: 3});
        a.sort(cmp);
        assertEqual(a, ['a', 'b', 'c'], 'keys');
      },

      testValues: function () {
        var o = {a: 1, b: 2, c: 4, d: -1};
        var got = values(o);
        got.sort(cmp);
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
        var C = Object.subclass(function (x) { this.x = x; });
        var c = factory(C)(1);
        assert(c instanceof C, 'factory instanceof');
        assertSame(c.x, 1, 'factory property');
      },

      testNameFunctions: function () {
        assertSame(repr(nameFunctions), 'ak.nameFunctions',
                   'nameFunctions');
        assertSame(repr(template.Filter), 'ak.template.Filter');
        assertSame(repr(Dict.ItemIterator), 'ak.Dict.ItemIterator');
      },

      //////////////////////////////////////////////////////////////////////////
      // Function methods tests
      //////////////////////////////////////////////////////////////////////////

      testFunctionDecorated: function () {
        function f() { return 42; }
        function g(func) { return function () { return func() + 1; }; }
        function h(func) { return function () { return func() * 2; }; }
        assertSame(f.decorated(g, h)(), 85);
        assertSame(f.decorated()(), 42);
      },

      testFunctionWraps: function () {
        var e = Error.subclass();
        var f = function () {}.wraps(e);
        assertSame(f.prototype, e.prototype);
        assertSame(f.prototype.constructor, f);
        assertSame(f.__proto__, e.__proto__);
        assert(!('__name__' in f));
        f.__name__ = 'f';
        assertSame(function () {}.wraps(f).__name__, 'f');
      },

      testFunctionSubclass: function () {
        var C = function () {};
        var p = {};
        Object.subclass(C, p);
        assertSame(C.prototype, p);
        assertSame(p.constructor, C);
        assertSame(p.__proto__, Object.prototype);
        assertSame(C.__proto__, Function.prototype);
        var P = Function.subclass();
        C.instances(P);
        var D = C.subclass();
        assertSame(D.__proto__, P.prototype);
      },

      testFunctionSubclassOf: function () {
        assert(Array.subclassOf(Object));
        assert(!Object.subclassOf(Array));
        assert(!Array.subclassOf(42));
        assert(TypeError.subclass().subclassOf(Error));
      },

      //////////////////////////////////////////////////////////////////////////
      // Error definitions tests
      //////////////////////////////////////////////////////////////////////////

      testErrorMeta: function () {
        var E = TypeError.subclass(function () { this.x = 42; }, {y: 15});
        var e = new E(1);
        assertSame(e.message, '1');
        assertSame(e.x, 42);
        assertSame(e.y, 15);
        assertSame(e.name, 'TypeError');
        E.__name__ = 'E';
        assertSame(e.name, 'E');
        assert(SyntaxError() instanceof SyntaxError);
        assert(E() instanceof E);
        assertSame(E('hi').message, 'hi');
      },

      testAbstract: function () {
        assertThrow(NotImplementedError, abstract, 'abstract');
      },

      //////////////////////////////////////////////////////////////////////////
      // Array methods tests
      //////////////////////////////////////////////////////////////////////////

      testArrayCmp: function () {
        assertSame(cmp([], []), 0, 'empty array cmp');
        assertSame(cmp([1, 2, 3], [1, 2, 3]), 0, 'equal array cmp');
        assertSame(cmp([1, 2], [1, 2, 3]), -1, 'less len array cmp');
        assertSame(cmp([1, 2], [1]), 1, 'more len array cmp');
        assertSame(cmp([1, 2, 3], [1, 2, 4]), -1, 'less item array cmp');
      },

      testArrayEq: function () {
        assertEqual([], []);
        assertEqual([1, 2, 3], [1, 2, 3]);
        assert(!equal([1, 2, 3], [1, 2]));
        assert(!equal([1, 2, 3], [1, 2, 4]));
        assertThrow(TypeError, function () { equal([], null); });
        assertThrow(TypeError, function () { equal([], undefined); });
      },

      testArrayFlatten: function () {
        var flat = [1, '2', 3, [4, [5, [6, 7], 8, [], 9]]].flatten();
        var expect = [1, '2', 3, 4, 5, 6, 7, 8, 9];
        assertEqual(flat, expect, 'flatten');
      },

      testArrayIndex: function () {
        assertSame([1, 2, 3].index(4), -1, 'index returns -1 on not found');
        assertSame([1, 2, 3].index(1), 0, 'index returns correct index');
        assertSame([1, 2, 3].index(1, 1), -1, 'index honors start');
        assertSame([{__cmp__: function () { return 0; }}].index(1), 0,
                   'index with custom __cmp__');
      },

      testArrayRelMethods: function () {
        dropRelVars(keys(db));
        db.RV.create({n: 'number'});
        db.RV.insert({n: 0});
        db.RV.insert({n: 1});
        db.RV.insert({n: 2});
        var rel = db.RV.all();
        assert(rel.every(function (tuple) { return tuple.n < 3; }));
        assert(rel.some(function (tuple) { return tuple.n == 1; }));
        assertEqual((rel
                     .filter(function (tuple) { return tuple.n % 2 == 0; })
                     .map(function (tuple) { return tuple.n; })),
                    [0, 2]);
        var s = 0;
        rel.forEach(function (tuple) { s += tuple.n; });
        assertSame(s, 3);
        assertSame(repr(rel), '[{n: 0}, {n: 1}, {n: 2}]');
        db.RV.drop();
      },

      ////////////////////////////////////////////////////////////////////////////
      // String methods tests
      ////////////////////////////////////////////////////////////////////////////

      testStringStartsWith: function () {
        var str = 'string';
        assert(str.startsWith('str'), 'startsWith');
        assert(!str.startsWith('str1'), 'startsWith false');
        assert(str.startsWith('tr', 1), 'startsWith start');
        assert(str.startsWith('tr', 1, 3), 'startsWith start end');
        assert(!str.startsWith('tr', 1, 2), 'startsWith start close end');
      },

      testStringTrim: function () {
        assertSame(' hi   '.trim(), 'hi', 'trim hi');
        assertSame('\n \thello\nthere\t'.trim(), 'hello\nthere',
                   'trim hello there');
      },

      testStringTrimLeft: function () {
        assertSame(' \t\n hi\n '.trimLeft(), 'hi\n ', 'trimLeft');
      },

      testStringTrimRight: function () {
        assertSame(' \t\n yo\n\nwuzzup \t '.trimRight(), ' \t\n yo\n\nwuzzup',
                   'trimRight');
      },

      testStringLJust: function () {
        assertSame('abc'.ljust(2), 'abc', 'ljust on bigger');
        assertSame('abc'.ljust(5), 'abc  ', 'ljust on smaller');
        assertSame('abc'.ljust(5, '\t'), 'abc\t\t', 'ljust with tab character');
      },

      testStringRJust: function () {
        assertSame('abc'.rjust(2), 'abc', 'rjust on bigger');
        assertSame('abc'.rjust(5), '  abc', 'rjust on smaller');
        assertSame('abc'.rjust(5, '\t'), '\t\tabc', 'rjust with tab character');
      },

      ////////////////////////////////////////////////////////////////////////////
      // Other tests
      ////////////////////////////////////////////////////////////////////////////

      testDateCmp: function () {
        var str1 = 'Mon, 03 Aug 2009 14:49:29 GMT';
        var str2 = 'Mon, 03 Aug 2009 14:49:30 GMT';
        assertEqual(new Date(str1), new Date(str1), 'Date equal');
        assertSame(cmp(new Date(str1), new Date(str2)), -1, 'Date less');
      },

      testRegExpEscape: function () {
        assertSame(RegExp.escape('[].ab?c|de\\('),
                   '\\[\\]\\.ab\\?c\\|de\\\\\\(',
                   'RegExp.escape');
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

  var UtilsTestCase = TestCase.subclass(
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

      testZip: function () {
        assertEqual(zip(), [], 'zip without arguments');
        assertEqual(zip([1, 2, 3]), [[1], [2], [3]], 'zip on one array');
        assertEqual(zip([1, 2, 3], [4, 5]), [[1, 4], [2, 5]], 'zip on two array');
        assertEqual(zip([1, 2], 'abc'), [[1, 'a'], [2, 'b']],
                    'zip on array and string');
        assertEqual(zip([1, 2, 3], [], [4, 5]), [],
                    'zip on three arrays, one of them empty');
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

      testGetter: function () {
        assertSame({x: 42, f: getter('x')}.f(), 42, 'getter');
      },

      testAttrGetter: function () {
        assertSame(attrGetter('x')({x: 42}), 42, 'attrGetter');
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
      },

      testNextMatch: function () {
        var re = new RegExp(/x/g);
        var string = 'x';
        assertSame(nextMatch(re, string)[0], 'x');
        assertSame(nextMatch(re, string), null);
        assertThrow(SyntaxError, function () { nextMatch(/a/g, 'b'); });
        assertThrow(SyntaxError, function () { nextMatch(/a/g, 'ba'); });
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // iter tests
  //////////////////////////////////////////////////////////////////////////////

  var IterTestCase = TestCase.subclass(
    {
      name: 'iter',

      testIter: function () {
        var itr = iter([]);
        assertSame(iter(itr), itr, 'iter from Iterator');
        assert(iter({__iter__: 42}) instanceof InvalidIterator,
               'iter from non iterable object');
        assert(iter(undefined)  instanceof InvalidIterator,
               'iter from undefined');
        assert(iter(null)  instanceof InvalidIterator,
               'iter from null');
      },

      testArray: function () {
        var a = [1, 2, 3];
        assertEqual(array(iter(a)), a, 'array on iterator');
        assertEqual(array(a), a, 'array on Array');
      },

      testIterator: function () {
        var itr = new Iterator();
        assertThrow(NotImplementedError, bind(itr.next, itr), 'Iterator next');
        itr.valid = true;
        assertSame(repr(itr), '<valid ak.Iterator>');
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
        var object = {s: 0};
        forEach([1, 2, 3], function (x) { this.s += x; }, object);
        assertSame(object.s, 6);
      },

      testEvery: function () {
        function f (x) { return x < 5; }
        assert(!every([1, 2, 3, 4, 5, 4], f), 'every false');
        assert(every([1, 2, 3, 4, 4], f), 'every true');
        assert(every([], f), 'every on empty');
        assert(every([1, 2, 3], function (x) { return x < this.m; }, {m: 5}));
      },

      testSome: function () {
        function f (x) { return x < 5; }
        assert(some([10, 2, 3, 4, 4], f), 'some true');
        assert(!some([5, 6, 7, 8, 9], f), 'some false');
        assert(some([5, 6, 7, 8, 4], f), 'some true again');
        assert(!some([], f), 'some on empty');
        assert(some([1, 2, 3], function (x) { return x % this.d; }, {d: 2}));
      },

      testSorted: function () {
        assertEqual(sorted([3, 2, 1]), [1, 2, 3], 'sorted default');
        var a = sorted(['aaa', 'bb', 'c'], keyComparator('length'));
        assertEqual(a, ['c', 'bb', 'aaa'], 0, 'sorted custom');
      },

      testReversed: function () {
        assertEqual(reversed(range(4)), [3, 2, 1, 0], 'reversed iterator');
        assertEqual(reversed([5, 6, 7]), [7, 6, 5], 'reversed array');
      },

      testISlice: function () {
        var a = [1, 2, 3, 4, 5, 6];
        assertEqual(array(islice(a)), a, 'islice without borders');
        assertEqual(array(islice(a, 4)), [5, 6],
                    'islice with start');
        assertEqual(array(islice(a, undefined, 3)), [1, 2, 3],
                    'islice with stop');
        assertEqual(array(islice(a, 2, 4)), [3, 4],
                    'islice with start and stop');
        assertEqual(array(islice(a, 4, 10)), [5, 6],
                    'islice with start and big stop');
      },

      testCount: function () {
        assertEqual(array(islice(count(), 0, 3)), [0, 1, 2],
                   'count without argument');
        assertEqual(array(islice(count(2), 0, 2)), [2, 3],
                   'count without argument');
      },

      testCycle: function () {
        assertEqual(array(islice(cycle([1, 2, 3]), 0, 8)),
                    [1, 2, 3, 1, 2, 3, 1, 2],
                    'cycle');
        assert(!cycle([]).valid, 'cycle on empty');
      },

      testRepeat: function () {
        assertEqual(array(repeat(1, 3)), [1, 1, 1], 'repeat');
        assertEqual(array(islice(repeat(1), 0, 3)), [1, 1, 1],
                    'infinite repeat');
      },

      testIZip: function () {
        assertEqual(array(izip([1, 2, 3], [4, 5], [6, 7, 8])),
                    [[1, 4, 6], [2, 5, 7]],
                    'izip');
        assert(!izip([1], []).valid, 'izip on empty');
      },

      testFilter: function () {
        function isEven(x) { return x % 2 == 0; };
        assertEqual(array(filter([1, 2, 3, 4, 5, 6], isEven)),
                    [2, 4, 6],
                    'filter');
        assert(!filter([1, 3, 5], isEven).valid, 'invalid filter');
        assert(!filter([], isEven).valid, 'filter on empty');
        assertEqual(array(filter([2, 3, 4, 5, 6, 7], isEven)),
                    [2, 4, 6],
                    'another filter');
        assertEqual(array(filter([1, 3, 6, 7],
                                 function (x) { return x % this.d; },
                                 {d: 3})),
                    [1, 7]);
      },

      testMap: function () {
        function square(x) { return x * x; }
        assertEqual(array(map([1, 2, 3], square)), [1, 4, 9], 'map');
        assert(!map([], square).valid, 'map on empty');
        assertEqual(array(map([1, 2, 3],
                              function (x) { return x * this.m; },
                              {m: 2})),
                    [2, 4, 6]);
      },

      testChain: function () {
        assertEqual(array(chain([1, 2], [], [3, 4], [], [])), [1, 2, 3, 4],
                    'chain');
        assert(!chain([], []).valid, 'chain on empties');
        assert(!chain().valid, 'chain without arguments');
      },

      testTakeWhile: function () {
        function isPositive(x) { return x > 0; }
        assertEqual(array(takeWhile([1, 2, 0], isPositive)), [1, 2],
                    'takeWhile');
        assertEqual(array(takeWhile([1, 2, 3], isPositive)), [1, 2, 3],
                    'takeWhile always true');
        assertEqual(array(takeWhile([-1, 2, 3], isPositive)), [],
                    'takeWhile false at once');
        assertEqual(array(takeWhile([], isPositive)), [],
                    'takeWhile on empty');
      },

      testDropWhile: function () {
        function isPositive(x) { return x > 0; }
        assertEqual(array(dropWhile([1, 2, 0, 3], isPositive)), [0, 3],
                    'dropWhile');
        assertEqual(array(dropWhile([0, 3], isPositive)), [0, 3],
                    'dropWhile from first');
        assertEqual(array(dropWhile([3, 0], isPositive)), [0],
                    'dropWhile from last');
        assertEqual(array(dropWhile([1, 2, 3], isPositive)), [],
                    'dropWhile always false');
        assertEqual(array(dropWhile([], isPositive)), [],
                    'dropWhile on empty');
      },

      testTee: function () {
        var a = [0, 1, 2, 3, 4];
        var c = tee(a, 3);
        assertEqual(array(c[0]), array(c[1]), 'tee(..., 3) p0 == p1');
        assertEqual(array(c[2]), a, 'tee(..., 3) p2 == fixed');
      },

      testGroupBy: function () {
        assertEqual(array(groupBy([0, 0, 0, 1, 2, 2, 3])),
                    [[0, [0, 0, 0]], [1, [1]], [2, [2, 2]], [3, [3]]],
                    'groupBy on Array');
        assertEqual(array(groupBy('aabb')),
                    [['a', ['a', 'a']], ['b', ['b', 'b']]],
                    'groupBy on string');
        assertEqual(array(groupBy([])), [], 'groupBy on empty');
      },

      testObjectIterator: function () {
        var o = {a: 1, b: 2};
        var lst = array(iter(o));
        lst.sort(cmp);
        var expect = items(o);
        expect.sort(cmp);
        assertEqual(lst, expect, 'ObjectIterator');
      },

      testArrayIterator: function () {
        var itr = iter([1, 2]);
        assertSame(itr.valid && itr.next(), 1, 'array iteration first');
        assertSame(itr.valid && itr.next(), 2, 'array iteration second');
        assertSame(repr(itr), '<invalid ak.ArrayIterator>');
        assert(!itr.valid, 'array iteration stop');
        assertEqual(array(iter('abc')), ['a', 'b', 'c'],
                    'ArrayIterator for String');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // stream tests
  //////////////////////////////////////////////////////////////////////////////

  var StreamTestCase = TestCase.subclass(
    {
      name: 'stream',

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
        assertEqual(array(s), ['1', '2', '3'], 'Stream array');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // template tests
  //////////////////////////////////////////////////////////////////////////////

  var baseTemplates = {
    hello: 'hello world',
    foo: '{% block foo %}foo{% endblock %}',
    parent: ('{% block 1 %}parent1{% endblock%} ' +
             '{% block 2 %}parent2{% endblock %}'),
    child: '{% extends "parent" %}{% block 1 %}child1{% endblock %}'
  };

  var normalEnv = clone(template.defaultEnv);
  normalEnv.load = function (name) {
    var result = baseTemplates[name];
    if (result === undefined)
      throw new TemplateDoesNotExist(name);
    return result;
  };


  var invalidEnv = clone(normalEnv);
  invalidEnv.invalid = 'INVALID';


  ak._TestController = Controller.subclass();


  var renderingTests = [
    ['hello world', {}, 'hello world'],
    ['{{ Infinity }}', {}, 'Infinity'],
    ['{{ -Infinity }}', {}, '-Infinity'],
    ['{{ x\t }}', {x: 42}, '42'],
    ['{{ a }} --- {{ b }}', {a: 1, b: 'hi'}, '1 --- hi'],
    ['{{ o.f }}', {o: {f: function () { return 42; }}}, '42'],
    ['{{ o1.o2.f }}', {o1: {o2: {f: function () { return 'hi'; }}}}, 'hi'],
    ['a {{ moo %} b', {}, 'a {{ moo %} b'],
    ['{{ moo #}', {}, '{{ moo #}'],
    ['{{ moo\n }}', {}, '{{ moo\n }}'],
    ['{{ "fred" }}', {}, 'fred'],
    ['{{ "\\"fred\\"" }}', {}, '"fred"'],
    ['{{ x.1 }}', {x: ['first', 'second']}, 'second'],
    ['{# this is hidden #}hello', {}, 'hello'],
    ['{# this is hidden #}hello{# foo #}', {}, 'hello'],
    ['foo{#  {% if %}  #}', {}, 'foo'],
    ['foo{#  {% endblock %}  #}', {}, 'foo'],
    ['foo{#  {% somerandomtag %}  #}', {}, 'foo'],
    ['foo{# {% #}', {}, 'foo'],
    ['foo{# %} #}', {}, 'foo'],
    ['foo{# %} #}bar', {}, 'foobar'],
    ['foo{# {{ #}', {}, 'foo'],
    ['foo{# }} #}', {}, 'foo'],
    ['foo{# { #}', {}, 'foo'],
    ['foo{# } #}', {}, 'foo'],
    ['{{ x|upper }}', {x: 'Hi'}, 'HI'],
    ['{{ "hello"|upper }}', {}, 'HELLO'],
    ['{{ x|upper }}', {x: 15}, '15'],
    ['{{ x|upper|lower }}', {x: 'Hi'}, 'hi'],
    ['{{ x|removeTags:"b i"|upper|lower }}',
     {x: '<b><i>Yes</i></b>'},
     'yes'],
    ['{{ "<>"|removeTags }}', {}, '<>'],
    ['{{ "<>"|removeTags:x }}', {}, '<>'],
    ['{{ "<>"|removeTags:x }}', {x: ' \t'}, '<>'],
    ['{{ x|safe }}', {x: '<>&"'}, '<>&"'],
    ['{{ x|default:"<>" }}', {}, '<>'],
    ['{{ x|default:"hi" }}', {x: '<>'}, '&lt;&gt;'],
    ['{{ x|default:a.b.c }}', {a: {b: {c: '<>'}}}, '&lt;&gt;'],
    ['{{ 0|default:.1 }}', {}, '0.1'],
    ['{{ ""|yesno }}', {}, 'no'],
    ['{{ ""|yesno:"yes,<>" }}', {}, '<>'],
    ['{{ ""|yesno:x }}', {x: 'yes,<>'}, '&lt;&gt;'],
    ['{{ "<>"|yesno:",,," }}', {}, '<>'],
    ['{{ x|join:"" }}', {x: ['<', '>']}, '&lt;&gt;'],
    ['{{ x|join }}', {x: ['<', '>']}, '&lt;&gt;'],
    ['{{ x|safe|join:"<" }}', {x: ['a', 'b']}, 'a<b'],
    ['{{ x|safe|join:y }}', {x: ['a', 'b'], y: ['<']}, 'a&lt;b'],
    ['{{ "<>"|join:x }}', {}, '<>'],
    ['{{ "<>"|escape }}', {}, '&lt;&gt;'],
    ['{{ "<>"|escape|safe|escape }}', {}, '&lt;&gt;'],
    ['{{ "<>"|escape|safe }}', {}, '<>'],
    ['{{ "  hello world "|truncateWords:1 }}', {}, 'hello ...'],
    ['{{ "hello world"|truncateWords:"asdf" }}', {}, 'hello world'],
    ['{{ "hello world"|truncateWords }}', {}, 'hello world'],
    ['{{ "hello world"|truncateWords:2 }}', {}, 'hello world'],
    ['{{ "hello world"|truncateWords:x }}', {x: null}, '...'],
    ['{{ "hello world"|truncateWords:0 }}', {x: null}, '...'],
    ['{{ 1|add:"3" }}', {}, '4'],
    ['{{ "<>"|add:2 }}', {}, '<>'],
    ['{{ x|add:2 }}', {x: '<>'}, '&lt;&gt;'],
    ['{{ 2|add:"yo" }}', {}, '2'],
    ['{{ x|safe|addSlashes }}', {x: '\\\'"\\"\''}, '\\\\\\\'\\"\\\\\\"\\\''],
    ['{{ "hello"|capFirst }}', {}, 'Hello'],
    ['{{ ""|capFirst }}', {}, ''],
    ['{{ 42|capFirst }}', {}, '42'],
    ['{{ "<hi there>"|cut:"e" }}', {}, '&lt;hi thr&gt;'],
    ['{{ "<hi there>"|cut:"e"|safe }}', {}, '<hi thr>'],
    ['{{ "a|b|c"|cut:"|" }}', {}, 'abc'],
    ['{{ x|defaultIfUndefined:42 }}', {}, '42'],
    ['{{ undefined|defaultIfUndefined:42 }}', {'undefined': 1}, '42'],
    ['{{ null|defaultIfUndefined:42 }}', {}, ''],
    ['{{ null|defaultIfNull:42 }}', {}, '42'],
    ['{{ x|defaultIfNull:42 }}', {}, ''],
    ['{{ "hi"|defaultIfNull:42 }}', {}, 'hi'],
    ['{% for item in items|sortObjects:"n" %}{{ item.s }}{% endfor %}',
     {items: [{n: 4, s: 'a'},
              {n: 1, s: 'b'},
              {n: 3, s: 'c'},
              {n: 2, s: 'd'}]},
     'bdca'],
    ['{{ x|sortObjects:"f" }}', {x: null}, ''],
    ['{{ x|sortObjects:"f" }}', {}, ''],
    ['{% for item in items|sortObjectsReversed:"n" %}{{ item.s }}{% endfor %}',
     {items: [{n: 4, s: 'a'},
              {n: 1, s: 'b'},
              {n: 3, s: 'c'},
              {n: 2, s: 'd'}]},
     'acdb'],
    ['{{ 42|divisibleBy:2 }}', {}, 'true'],
    ['{{ "42"|divisibleBy:"2" }}', {}, 'true'],
    ['{{ "42"|divisibleBy:"4" }}', {}, 'false'],
    ['{{ "yo!"|divisibleBy:"4" }}', {}, 'false'],
    ['{{ a|escapeJavaScript }}',
     {'a': 'testing\r\njavascript \'string" <b>escaping</b>\u2028'},
     ('testing\\x0d\\x0ajavascript \\x27string\\x22 ' +
      '\\x3cb\\x3eescaping\\x3c/b\\x3e\\u2028')],
    ['{{ "foo"|formatFileSize }}', {}, '0 bytes'],
    ['{{ 1|formatFileSize }}', {}, '1 byte'],
    ['{{ "42"|formatFileSize }}', {}, '42 bytes'],
    ['{{ 1500|formatFileSize }}', {}, '1.5 KB'],
    ['{{ 1500000|formatFileSize }}', {}, '1.4 MB'],
    ['{{ 1500000000|formatFileSize }}', {}, '1.4 GB'],
    ['{{ null|first }}', {}, ''],
    ['{{ undefined|first }}', {}, ''],
    ['{{ "abc"|first }}', {}, 'a'],
    ['{{ x|first }}', {x: [1, 2, 3]}, '1'],
    ['{{ "foo"|formatFloat }}', {}, ''],
    ['{{ "42"|formatFloat }}', {}, '42'],
    ['{{ 42|formatFloat:2 }}', {}, '42.00'],
    ['{{ 42|formatFloat:"foo" }}', {}, '42'],
    ['{{ 42|formatFloat:1.4 }}', {}, '42'],
    ['{{ 42.3|formatFloat:-3 }}', {}, '42.300'],
    ['{{ "<>"|forceEscape|safe }}', {}, '&lt;&gt;'],
    ['{{ 12345|getDigit:4 }}', {}, '2'],
    ['{{ "<>"|getDigit:1 }}', {}, '<>'],
    ['{{ x|getDigit:1 }}', {x: '<>'}, '&lt;&gt;'],
    ['{{ 12345|getDigit:42 }}', {}, '0'],
    ['{{ 42|getDigit:2.1 }}', {}, '42'],
    ['{{ 42|getDigit:"foo" }}', {}, '42'],
    ['{{ "<>;&?;/"|encodeURI }}', {}, '%3C%3E;&amp;?;/'],
    ['{{ "<>;&?;/"|encodeURIComponent }}', {}, '%3C%3E%3B%26%3F%3B%2F'],
    ['{{ "abc"|last }}', {}, 'c'],
    ['{{ x|last }}', {x: [1, 2, 3]}, '3'],
    ['{{ true|last }}', {}, ''],
    ['{{ 42|last }}', {}, ''],
    ['{{ x|paragraph }}', {x: 'x&\ny'}, '<p>x&amp;<br />y</p>'],
    ['{{ x|safe|paragraph }}', {x: 'x&\ny'}, '<p>x&<br />y</p>'],
    ['{{ x|paragraph }}', {x: '\n\na\nb\n\nc\n'},
     '<p>a<br />b</p>\n\n<p>c</p>'],
    ['{{ x|paragraph }}', {x: '\n \t\n'}, ''],
    ['{{ x|breakLines }}', {x: '\n\na\nb\n\nc\n'},
     '<br /><br />a<br />b<br /><br />c<br />'],
    ['{{ x|numberLines }}', {x: '\n\na\n\n\nb\n\nc\nd\n\ne\n\nf'},
     ' 1 \n 2 \n 3 a\n 4 \n 5 \n 6 b\n 7 \n 8 c\n 9 d\n10 \n11 e\n12 \n13 f'],
    ['{{ "<>"|ljust:5 }}', {}, '<>   '],
    ['{{ x|ljust:5 }}', {x: '<>'}, '&lt;&gt;   '],
    ['{{ "<>"|ljust:"foo" }}', {}, '<>'],
    ['{{ "<>"|rjust:5 }}', {}, '   <>'],
    ['{{ x|rjust:5 }}', {x: '<>'}, '   &lt;&gt;'],
    ['{{ "<>"|rjust:"foo" }}', {}, '<>'],
    ['{{ 1|pluralize }}', {}, ''],
    ['{{ 2|pluralize }}', {}, 's'],
    ['{{ 2|pluralize:"a,b,c" }}', {}, ''],
    ['{{ 2|pluralize:"a,b" }}', {}, 'b'],
    ['{{ "1"|pluralize:"a,b" }}', {}, 'a'],
    ['{{ "abcde"|slice:"1,4" }}', {}, 'bcd'],
    ['{{ "abcde"|slice:"3" }}', {}, 'de'],
    ['{{ "abcde"|slice }}', {}, 'abcde'],
    ['{{ 42|slice }}', {}, '42'],
    ['{{ "abcde"|slice:"x" }}', {}, 'abcde'],
    ['{{ "abcde"|slice:"1,x" }}', {}, 'abcde'],
    ['{{ "abcde"|slice:"1,2,3" }}', {}, 'abcde'],
    ['{{ x|slice:"1,4"|join }}', {x: [1, 2, 3, 4, 5]}, '234'],
    ['{{ x|slice:3|join }}', {x: [1, 2, 3, 4, 5]}, '45'],
    ['{{ " \ta b&!-C -- d"|slugify }}', {}, 'a-b-c-d'],
    ['{{ "<p>a<br />b</p>"|stripTags }}', {}, 'ab'],
    ['{{ "hello world"|title }}', {}, 'Hello World'],
    ['{{ " everything\'s ok "|title }}', {}, ' Everything\'s Ok '],
    ['{{ "\thello  world  "|countWords }}', {}, '2'],
    ['{{ "\t "|countWords }}', {}, '0'],


    ['{% comment %} hi {% endcomment %}hello', {}, 'hello'],
    ['{% comment %} hi {% endcomment %}hello' +
     '{% comment %} yo {% endcomment %}',
     {}, 'hello'],
    ['{% comment %} {% if %} {% endcomment %}', {}, ''],
    ['{% comment %} {% comment %} {% endcomment %}', {}, ''],
    ['{% if \t  true %}foo{% endif %}', {}, 'foo'],
    ['{% if undefined == null %}foo{% endif %}', {}, 'foo'],
    ['{% if 1 !== 1 %}foo{% else %}bar{% endif %}', {}, 'bar'],
    ['{% if 1 != 2 %}foo{% else %}bar{% endif %}', {}, 'foo'],
    ['{% if true && 1 %}foo{% endif %}', {}, 'foo'],
    ['{% if undefined || 42  %}foo{% endif %}', {}, 'foo'],
    ['{% if true === (1 && true) %}foo{% endif %}', {}, 'foo'],
    ['{% if 1==1 && 0 || 1 %}foo{% endif %}', {}, 'foo'],
    ['{% if !(false || null === undefined) %}foo{% endif %}', {}, 'foo'],
    ['{% if . %}foo{% endif %}', {'': {'': true}}, 'foo'],
    ['{% if a.b %}foo{% endif %}', {a: {b: true}}, 'foo'],
    ['{% if x === undefined %}foo{% endif %}', {}, 'foo'],
    ['{% if x.y.z %}foo{% endif %}', {}, ''],
    ['{% for x in y %}{{ x }}{% endfor %}', {y: [1, 2, 3]}, '123'],
    ['{% for x in "" %}{% empty %}empty{% endfor %}', {}, 'empty'],
    ['{% for x in y %}foo{% endfor %}', {}, ''],
    ['{% for x in "abc" %}{{ forloop.counter }}{% endfor %}', {}, '123'],
    ['{% for x in "abc" %}{{ forloop.counter0 }}{% endfor %}', {}, '012'],
    ['{% for x in "abc" %}{{ forloop.revcounter }}{% endfor %}', {}, '321'],
    ['{% for x in "abc" %}{{ forloop.revcounter0 }}{% endfor %}', {}, '210'],
    ['{% for x in "abc" %}{{ forloop.first }} {% endfor %}', {},
     'true false false '],
    ['{% for x in "abc" %}{{ forloop.last }} {% endfor %}', {},
     'false false true '],
    [('{% for x in "abc" %}' +
      '{% for y in "123" %}{{ forloop.parentloop.counter }}{% endfor %}' +
      '{% endfor %}'),
      {},
      '111222333'],
    ['{% for x in y %}{{ x }}{% endfor %}',
     {y: {__iter__: function () { return iter([1, 2, 3]);}}},
     '123'],
    ['{% for n in "123" reversed %}{{ n }}{% endfor %}', {}, '321'],
    ['{% extends "hello" %}', {}, 'hello world'],
    ['{% extends x %}', {x: 'hello'}, 'hello world'],
    ['say {% extends "hello" %} yo!', {}, 'say hello world'],
    ['{% extends  "foo" %}', {}, 'foo'],
    ['{% extends "foo" %}{% block foo %}bar{% endblock %}', {}, 'bar'],
    ['{% extends "foo" %}{% block foo %}bar{% endblock foo  %}', {}, 'bar'],
    ['{% extends "child" %}', {}, 'child1 parent2'],
    ['{% extends "child" %}{% block 2 %}yo!{% endblock %}', {}, 'child1 yo!'],
    ['{% for i in "12345" %}{% cycle "a" "b" %}{% endfor %}', {}, 'ababa'],
    ['{% for i in "abcd" %}{% cycle 1 2 3 as x %}{% cycle x %}{% endfor %}', {},
     '12312312'],
    ['{% cycle 1 2 as x %}{% cycle "a" "b" as x %}{% cycle x %}', {}, '1ab'],
    ['{% debug %}', {}, '{}'],
    ['{% debug %}', {x: 42, a: [1, "yo!"]}, '{a: [1, &quot;yo!&quot;], x: 42}'],
    ['{% filter escape %}<>{% endfilter %}', {}, '&lt;&gt;'],
    ['{% filter truncateWords:3 %}foo & bar baz{% endfilter %}', {},
     'foo & bar ...'],
    ['{% filter removeTags:"i"|escape %}<i>&</i>{% endfilter %}', {},
     '&amp;'],
    ['{% firstof "" a "<>" %}', {}, '<>'],
    ['{% firstof ""|default:"hello world" 42 %}', {}, 'hello world'],
    ['{% firstof a b c %}', {}, ''],
    ['{% firstof x %}', {x: '<>'}, '&lt;&gt;'],
    ['{% for x in "aaabbcdddd" %}' +
     '{% ifchanged %}{{ x }}{% endifchanged %}' +
     '{% endfor %}',
     {},
     'abcd'],
    ['{% for x in "aaabbcdddd" %}' +
     '{% ifchanged %}{{ x }}{% else %}*{% endifchanged %}' +
     '{% endfor %}',
     {},
     'a**b*cd***'],
    ['{% for x in "aaabbcdddd" %}' +
     '{% ifchanged x %}!{% else %}*{% endifchanged %}' +
     '{% endfor %}',
     {},
     '!**!*!!***'],
    ['{% for x in "aaabbcdddd" %}' +
     '{% for y in "121" %}' +
     '{% ifchanged x y %}!{% else %}*{% endifchanged %}' +
     '{% endfor %}' +
     '{% endfor %}',
     {},
     '!!!*!!*!!!!!*!!!!!!!!*!!*!!*!!'],
    ['{% include "hello" %}', {}, 'hello world'],
    ['{% include "no_such_template" %}', {}, ''],
    ['{% for x in "12" %}{% include "hello" %}{% endfor %}', {},
     'hello worldhello world'],
    ['{% include x %}', {x: 'hello'}, 'hello world'],
    [('{% regroup data by bar as grouped %}' +
      '{% for group in grouped %}' +
      '{{ group.grouper }}:' +
      '{% for item in group.list %}' +
      '{{ item.foo }}' +
      '{% endfor %},' +
      '{% endfor %}'),
     {data: [{foo:'c', bar:1},
             {foo:'d', bar:1},
             {foo:'a', bar:2},
             {foo:'b', bar:2},
             {foo:'x', bar:3}]},
     '1:cd,2:ab,3:x,'],
    [('{% regroup data by bar as grouped %}' +
      '{% for group in grouped %}' +
      '{{ group.grouper }}:' +
      '{% for item in group.list %}' +
      '{{ item.foo }}' +
      '{% endfor %},' +
      '{% endfor %}'),
     {},
     ''],
    ['{% spaceless %}<b> <i> hi  </i>\t </b>\t{% endspaceless %}', {},
     '<b><i> hi  </i></b>\t'],
    ['{% templatetag openblock %}', {}, '{%'],
    ['{% widthratio a b 0 %}', {a: 50, b: 100}, '0'],
    ['{% widthratio a b 100 %}', {a: 0, b: 0}, ''],
    ['{% widthratio a b 100 %}', {a: 0, b: 100}, '0'],
    ['{% widthratio a b 100 %}', {a: 50, b: 100}, '50'],
    ['{% widthratio a b 100 %}', {a: 100, b: 100}, '100'],
    ['{% widthratio a b 100 %}', {a: 50, b: 80}, '63'],
    ['{% widthratio a b 100 %}', {a: 50, b: 70}, '71'],
    ['{% widthratio a b 100.0 %}', {a: 50, b: 100}, '50'],
    ['{% widthratio a b c %}', {a: 50, b: 100, c: 100}, '50'],
    ['{% with "<>" as x %}{{ x }}{% endwith %}', {}, '<>'],
    ['{% with "<>"|escape as x %}{{ x }}{% endwith %}', {}, '&lt;&gt;'],
    ['{% with y as x %}{{ x }}{% endwith %}', {y: '<>'}, '&lt;&gt;'],
    ['{% with "a>b" as x %}{{ x.toUpperCase }}{% endwith %}', {}, 'A>B'],
    ['{% url ak._TestController x y %}', {x: '&', y: '"'}, '/%3C%3E/&/%22/'],
    ['{% url ak._TestController 1 2 as x %}{{ x }}', {}, '/%3C%3E/1/2/'],
    ['{% url ak._TestController as x %}{{ x }}', {}, ''],
    ['{% url ak._TestController#page "a" "b" %}', {}, '/%3C%3E/a/b/page/'],
    ['{% csrfToken %}', {},
     ('<div style=\"display:none;\">' +
      '<input type=\"hidden\" name=\"csrfToken\" value=\"42\" />' +
      '</div>')]
  ];


  var invalidRenderingTests = [
    ['as{{ missing }}df', {}, 'asdf', 'asINVALIDdf'],
    ['{{ x.y }}', {x: {}}],
    ['{{ x.y }}', {x: null}],
    ['{{ x }}', {x: undefined}],
    ['{{ x }}', {x: null}],
    ['{{ x }}', {x: function () { return null; }}],
    ['{{ x.1 }}', {x: null}],
    ['{{ x.5 }}', {x: [1, 2, 3]}],
    ['{{ x|default }}', {}]
  ];


  var errorTests = [
    '{{ multi word variable }}',
    '{{   \t }}',
    '{{ va>r }}',
    '{{ (var.r) }}',
    '{{ sp%am }}',
    '{{ eggs! }}',
    '{{ moo? }}',
    '{{ moo #} {{ cow }}',
    '{{ x|does_not_exist }}',
    '{{ x|upper(xxx) }}',
    '{{ x |upper }}',
    '{{ x| upper }}',
    '{{ x|default: 1 }}',
    '{% does_not_exist %}',
    '{%  %}',
    '{% if && %}{% endif %}',
    '{% if > %}{% endif %}',
    '{% if & %}{% endif %}',
    '{% if &| %}{% endif %}',
    '{% if a && %}{% endif %}',
    '{% if ! %}{% endif %}',
    '{% if a b %}{% endif %}',
    '{% if a !b %}{% endif %}',
    '{% if a &&|| b %}{% endif %}',
    '{% if a (b) %}{% endif %}',
    '{% if (a&&) %}{% endif %}',
    '{% if (a)) %}{% endif %}',
    '{% if (a %}{% endif %}',
    '{% if %}{% endif %}',
    '{{ x }} {% extends "hello" %}',
    '{% if x %}{% endif %}{% extends "hello" %}',
    '{% block %}{% endblock %}',
    '{% block 1 2 %}{% endblock %}',
    '{% block 1 %}{% endblock %}{% block 1 %}{% endblock %}',
    '{% cycle %}',
    '{% cycle x %}',
    '{% cycle 1 2 as x %}{% cycle y %}',
    '{% firstof %}',
    '{% include  %}',
    '{% regroup %}',
    '{% regroup a yo! b as c %}',
    '{% regroup a by b yo! c %}',
    '{% templatetag fdsa %}',
    '{% templatetag %}',
    '{% widthratio %}',
    '{% with %}{% endwith %}',
    '{% with 1 1 1 %}{% endwith %}',
    '{% url %}',
    '{% url does_not_exist %}',
    '{% url does_not_exist as x %}',


    '{% for a in b %}',
    '{% for a in b %}{% empty %}',
    '{% for %}{% endfor %}',
    '{% for x y z %}{% endfor %}',
    '{% for a.b in c %}{% endfor %}'
  ];


  var TemplateTestCase = TestCase.subclass(
    {
      name: 'template',

      testRendering: function () {
        var oldRootRoute = ak.rootRoute;
        defineRoutes('<>/', [[[[ak._TestController,
                                [['page/', ak._TestController.page('page')]]
                               ]]]]);
        template.defaultTags.csrfToken.value = '42';
        renderingTests.forEach(
          function (test) {
            assertSame((new Template(test[0],
                                     test[0],
                                     normalEnv)).render(test[1]),
                       test[2],
                       'Rendering ' + repr(test[0]));
          });
        ak.rootRoute = oldRootRoute;
      },

      testInvalidRendering: function () {
        invalidRenderingTests.forEach(
          function (test) {
            assertSame((new Template(test[0],
                                     test[0],
                                     normalEnv)).render(test[1]),
                       test[2] || '',
                       'Rendering with empty invalid ' + repr(test[0]));
            assertSame((new Template(test[0],
                                     test[0],
                                     invalidEnv)).render(test[1]),
                       test[3] || 'INVALID',
                       'Rendering with "INVALID" ' + repr(test[0]));
          });
      },

      testErrors: function () {
        errorTests.forEach(
          function (test) {
            assertThrow(TemplateSyntaxError,
                        function () {
                          new Template(test, test, normalEnv);
                        },
                        'TemplateSyntaxError in ' + repr(test));
          });
        assertThrow(NotImplementedError,
                    function () {
                      new Template('{{ x }}').render({x: abstract});
                    },
                    'Exception propagation');
      },

      testSmartSplit: function () {
        var smartSplit = template.smartSplit;
        assertEqual(smartSplit('This is "a person\'s" test.'),
                    ['This', 'is', '"a person\'s"', 'test.'],
                    'smartSplit 1');
        assertEqual(smartSplit("Another 'person\\'s' test."),
                    ['Another', "'person\\'s'", 'test.'],
                    'smartSplit 2');
        assertEqual(smartSplit('A "\\"funky\\" style" test.'),
                    ['A', '"\\"funky\\" style"', 'test.'],
                    'smartSplit 3');
        assertEqual(smartSplit('""|default:"hello world" 42'),
                    ['""|default:"hello world"', '42'],
                    'smartSplit 4');
        assertEqual(smartSplit('"'),
                    ['"'],
                    'smartSplit 5');
        assertEqual(smartSplit('hi'),
                    ['hi'],
                    'smartSplit 6');
        assertEqual(smartSplit(' \t'),
                    [],
                    'smartSplit 7');
      },

      testMakeLoadFromCode: function () {
        var env = clone(template.defaultEnv);
        env.load = template.makeLoadFromCode('/test_data/templates');
        assertSame(getTemplate('child.txt', env).render({x: 42}),
                   '\n42\n\n\n\nfoo\n\n',
                   'loadFromCode');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // dict tests
  //////////////////////////////////////////////////////////////////////////////

  var DictTestCase = TestCase.subclass(
    {
      name: 'dict',

      testDict: function () {
        var oldHash = ak.hash;
        ak.hash = function (object) {
          return object ? object.hash || 0 : 0;
        };

        var m = new Dict({1: 'one', 'undefined': 2, 'true': 3, 'null': 4});
        assertSame(m.get('1'), 'one');
        assertSame(m.get('undefined'), 2);
        assertSame(m.get('true'), 3);
        assertSame(m.get(1), undefined);
        assertSame(m.get(undefined, 42), 42);
        assertSame(m.get(true), undefined);
        assertSame(m.get(null), undefined);
        assertSame(m.get({}, 42), 42);
        m.set(undefined, 5);
        assertSame(m.get(undefined), 5);
        m.set(null, 6);
        assertSame(m.get(null), 6);
        var o1 = {hash: 1};
        m.set(o1, 6);
        m.set(o1, 7);
        assertSame(m.get(o1), 7);
        assertSame(m.get({}, 42), 42);
        var o2 = {hash: 1};
        m.set(o2, 8);
        assertSame(m.get(o2), 8);
        assertSame(m.get({hash: 1}), undefined);
        var o3 = {hash: 2};
        m.set(o3, 9);
        assertSame(m.get(o3), 9);
        m.set(1, 1);
        assertSame(m.get(1), 1);
        m.set(true, 1);
        assertSame(m.get(true), 1);
        assertSame(repr(m),
                   ('{undefined: 5, null: 6, {hash: 1}: 7, {hash: 1}: 8, ' +
                    '{hash: 2}: 9, true: 1, 1: 1, "1": "one", ' +
                    '"undefined": 2, "true": 3, "null": 4}'));
        assertSame(m + '',
                   ('undefined 5,null 6,[object Object] 7,' +
                    '[object Object] 8,[object Object] 9,true 1,' +
                    '1 1,1 one,undefined 2,true 3,null 4'));
        assertEqual(m.items(),
                    [
                      [undefined, 5],
                      [null, 6],
                      [o1, 7],
                      [o2, 8],
                      [o3, 9],
                      [true, 1],
                      [1, 1],
                      ["1", "one"],
                      ["undefined", 2],
                      ["true", 3],
                      ["null", 4]
                    ]);
        assertEqual(m.keys(),
                    [undefined, null, o1, o2, o3,
                     true, 1, "1", "undefined", "true", "null"]);
        assertEqual(m.values(), [5, 6, 7, 8, 9, 1, 1, "one", 2, 3, 4]);
        var m1 = m.copy();
        var m2 = new Dict(m1);
        assertEqual(m, m2);
        assertSame(m1.pop(o2), 8);
        assertSame(m2.pop(o2), 8);
        assert(!equal(m, m1));
        assertEqual(m1, m2);
        assertSame(m1.pop(undefined), 5);
        assertSame(m1.pop(undefined, 42), 42);
        assertSame(m1.pop(o3), 9);
        assertSame(m1.get(o3, 42), 42);
        m1.update(m2);
        assertEqual(m1, m2);
        m.update(m2);
        assert(!equal(m, m2));
        assertEqual(m.popItem(), [undefined, 5]);
        assertEqual(m.popItem(), [null, 6]);
        assertEqual(m.popItem(), [o1, 7]);
        assertEqual(m.popItem(), [o2, 8]);
        assertEqual(m.popItem(), [o3, 9]);
        assertEqual(m.popItem(), [true, 1]);
        assertEqual(m.popItem(), [1, 1]);
        assertEqual(m.popItem(), ['1', 'one']);
        assertEqual(m.popItem(), ['undefined', 2]);
        m.clear();
        assertSame(m.popItem(), undefined);
        assertEqual(m.items(), []);
        assertSame(m.setDefault(undefined, 1), 1);
        assertSame(m.setDefault(undefined, 42), 1);
        assertSame(m.setDefault(1, 2), 2);
        assertSame(m.setDefault(1, 42), 2);
        assertSame(m.setDefault(o1, 3), 3);
        assertSame(m.setDefault(o1, 42), 3);
        assertSame(m.setDefault(o2, 4), 4);
        assertSame(m.setDefault(o2, 42), 4);
        assertSame(repr(m.iterValues()), '<valid ak.Dict.ValueIterator>');

        ak.hash = oldHash;
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // http tests
  //////////////////////////////////////////////////////////////////////////////

  var HttpTestCase = TestCase.subclass(
    {
      name: 'http',

      testErrors: function () {
        assertSame((new HttpError()).status, http.BAD_REQUEST);
        assertSame((new NotFoundError()).message, 'Not found');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // url tests
  //////////////////////////////////////////////////////////////////////////////

  var UrlTestCase = TestCase.subclass(
    {
      name: 'url',

      testRoute: function () {
        function f () {}
        function g() {}
        function h() {}
        function m() {}
        assertEqual((new Route([new Route([new Route(f)])])).resolve('a/b/c/'),
                    [f, ['a', 'b', 'c']]);
        var route = new Route(
          '',
          [
            ['abc/', [[f]]],
            [/123/, g],
            [
              g,
              [
                [/a(.)c/, h],
                [
                  /./,
                  m
                ],
                [
                  /(.)(.)/,
                  f,
                  function (args) {
                    return args[0] + '' + args[1];
                  }
                ]
              ]
            ]
          ]);
        assertEqual(route.resolve('abc/xyz/'), [f, ['xyz']]);
        assertEqual(route.resolve('xyz/'), [g, ['xyz']]);
        assertThrow(ResolveError, function () { route.resolve(''); });
        assertThrow(ResolveError, function () { route.resolve('xyz/abd'); });
        assertThrow(ResolveError, function () { route.resolve('xyz/xabc'); });
        assertEqual(route.resolve('xyz/abc'), [h, ['xyz', 'b']]);
        assertEqual(route.resolve('xyz/a'), [m, ['xyz', 'a']]);
        assertEqual(route.resolve('xyz/ab'), [f, ['xyz', ['a', 'b']]]);
        assertEqual(route.reverse(h, 'xyz', 0), 'xyz/a0c');
        assertEqual(route.reverse(f, '123'), 'abc/123/');
        assertEqual(route.reverse(f, '123', [4, 5]), '123/45');
        assertThrow(ReverseError,
                    function () { route.reverse(function () {}); });
        assertThrow(ReverseError, function () { route.reverse(g, 42); });
        assertThrow(ReverseError, function () { route.reverse(g, 1, 2, 3); });
        assertThrow(Error, function () { new Route(42); });
        assertThrow(Error, function () { new Route([f]); });
      },

      testRoot: function () {
        var oldRootRoute = ak.rootRoute;
        delete ak.rootRoute;
        assertThrow(Error, resolve);
        assertThrow(Error, reverse);
        function f() {};
        defineRoutes('abc', f);
        assertSame(reverse(f), '/abc');
        assertEqual(resolve('/abc'), [f, []]);
        ak.rootRoute = oldRootRoute;
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // rest tests
  //////////////////////////////////////////////////////////////////////////////

  var TestController = Controller.subclass(
    function (request, string) {
      Controller.call(this, request);
      this._string = string;
      this.args = [string];
    },
    {
      get: function () {
        return new Response(this._string);
      },

      getUpperPage: function (string) {
        return new Response(string.toUpperCase());
      },

      handleMethodPage: function () {
        return new Response(this.request.method);
      }
    });


  var LengthController = TestController.subclass(
    {
      put: function () {
        return new Response(this._string.length);
      }
    });


  function controlError(request, string) {
    throw new Error(string);
  }


  var RestTestCase = TestCase.subclass(
    {
      name: 'rest',

      testRenderToResponse: function () {
        template.defaultEnv = clone(template.defaultEnv);
        template.defaultEnv.load = function (name) {
          return '{{' + name + '}}';
        };
        var headers = {};
        var response = renderToResponse('x', {x: 42}, 1, headers);
        assertSame(response.content, '42');
        assertSame(response.status, 1);
        assertSame(response.headers, headers);
        template.defaultEnv = template.defaultEnv.__proto__;
      },

      testRedirect: function () {
        var oldRootRoute = ak.rootRoute;
        function f () {}
        defineRoutes(f);
        var response = redirect('xyz');
        assertSame(response.content, '');
        assertSame(response.status, http.FOUND);
        assertSame(response.headers.Location, 'xyz');
        assertSame(redirect(f, 'abc').headers.Location, '/abc/');
        ak.rootRoute = oldRootRoute;
      },

      testGet: function () {
        dropRelVars(keys(db));
        db.RV.create({x: number});
        db.RV.insert({x: 1});
        db.RV.insert({x: 2});
        db.RV.insert({x: 3});
        assertThrow(MultipleTuplesError,
                    function () { db.RV.get('x % 2 == 1'); });
        assertThrow(TupleNotFoundError,
                    function () { db.RV.get({x: 4}); });
        assertSame(db.RV.get('x % 2 == 0').x, 2);
        assertSame(query('RV').get('x > 2').x, 3);
        db.RV.get({x: 1}).del();
        assertEqual(db.RV.by('x').field('x'), [2, 3]);
        db.RV.get({x: 3}).set({x: 4});
        assertEqual(db.RV.by('x').field('x'), [2, 4]);
        db.RV.get({x: 2}).update({x: '$'}, 42);
        assertEqual(db.RV.by('x').field('x'), [4, 42]);
        db.RV.get({x: 4}).del();
        assertSame(db.RV.get().x, 42);
        db.RV.drop();
      },

      testController: function () {
        var C = Controller.subclass();
        var P = C.page('page');
        C.__name__ = 'C';
        assertSame(P.__name__, 'C#Page');
      },

      testRequiringLogin: function () {
        var C = Controller.subclass(
          {
            handleXPage: function () {
              return new Response(42);
            }
          }).decorated(Controller.requiringLogin);
        assertSame(C.page('x')({user: 'x'}).content, 42);
        assertThrow(LoginRequiredError, function () { C.page('P')({}); });
        assertThrow(LoginRequiredError, function () { C({}); });
        var f = function () {}.decorated(Controller.requiringLogin);
        assertThrow(LoginRequiredError, function () { f({}); });
        var route = new Route(f);
        var request = new Request({
                                    path: 'x/',
                                    fullPath: 'x/',
                                    headers: {
                                      Host: 'ak.akshell.com'
                                    }
                                  });
        var response = defaultServe(request, route);
        assertSame(response.status, http.FOUND);
        assertSame(response.headers.Location,
                   ('http://www.akshell.com/login/?next=' +
                    'http%3A%2F%2Fak.akshell.com%2Fx%2F'));
      },

      testServe: function () {
        var root = new Route(TestController.page(''),
                             [
                               ['method', TestController.page('Method')],
                               ['upper', TestController.page('Upper')],
                               ['error', controlError],
                               ['length', LengthController]
                             ]);
        assertSame(defaultServe({path: '/a/b'}, root).status, http.NOT_FOUND);
        var response = defaultServe({path: '/abc'}, root);
        assertSame(response.status, http.MOVED_PERMANENTLY);
        assertSame(response.headers.Location, '/abc/');
        assertThrow(ResolveError, function () { serve({path: '/abc'}, root); });
        assertSame(serve({path: '/abc/', method: 'get'}, root).content, 'abc');
        assertSame(defaultServe({path: '/abc/', method: 'put'}, root).status,
                   http.METHOD_NOT_ALLOWED);
        assertThrow(Error,
                    function () { defaultServe({path: '/abc/error'}, root); });
        assertSame(serve({path: '/abc/method', method: 'PUT'}, root).content,
                   'PUT');
        assertSame(serve({path: '/abc/upper', method: 'get'}, root).content,
                   'ABC');
        assertSame(serve({path: '/abc/length', method: 'put'}, root).content,
                   3);
        assertSame(defaultServe({path: '/a/length', method: 'get'}, root).status,
                   http.METHOD_NOT_ALLOWED);
        assertSame(defaultServe({
                                  method: 'post',
                                  path: '/abc/method',
                                  post: {},
                                  csrfToken: 'x'
                                },
                                root).status,
                   http.FORBIDDEN);
        assertSame(defaultServe({
                                  method: 'post',
                                  path: '/abc/method',
                                  post: {csrfToken: 'x'},
                                  csrfToken: 'x'
                                },
                                root).status,
                   http.OK);
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // db tests
  //////////////////////////////////////////////////////////////////////////////

  var DbTestCase = TestCase.subclass(
    {
      name: 'db',

      tearDown: function () {
        dropRelVars(keys(db));
      },

      testType: function () {
        assertThrow(UsageError,
                    function () { db.RV.create({x: 'unparseble'}); });
        assertThrow(UsageError,
                    function () { db.RV.create({x: 'number string'}); });
        assertThrow(UsageError,
                    function () { db.RV.create({x: 'number string'}); });
        assertThrow(UsageError,
                    function () { db.RV.create({x: 'unique default 1'}); });
        assertThrow(UsageError,
                    function () {
                      db.RV.create({x: 'number default 1 default 2'});
                    });
        db.Check.create({n: 'number check (n != 42)'});
        db.X.create({i: 'int default "15" number unique'});
        db.Y.create(
          {
            i: 'unique default -1  int',
            s: ' \t\nserial\t foreign Y.i ->X.i ',
            n: 'number->Check.n default \'42\''
          });
        assertSame(db.Y.header.i, 'integer');
        assertSame(db.Y.header.s, 'serial');
        assertEqual(db.Y.getForeigns().map(items).sort(cmp),
                    [[["keyFields", ["n"]],
                      ["refRelVar", "Check"],
                      ["refFields", ["n"]]],
                     [["keyFields", ["s"]],
                      ["refRelVar", "X"],
                      ["refFields", ["i"]]],
                     [["keyFields", ["s"]],
                      ["refRelVar", "Y"],
                      ["refFields", ["i"]]]]);
        assertEqual(items(db.X.getDefaults()), [['i', 15]]);
        assertEqual(items(db.Y.getDefaults()).sort(cmp),
                    [["i", -1], ["n", 42]]);
        assertThrow(ConstraintError,
                    function () { db.Check.insert({n: 42}); });
      },

      testConstr: function () {
        assertThrow(UsageError, function () { db.X.create({}, 'invalid'); });
        db.X.create({i: 'int', n: 'number', s: 'string'},
                    'unique i , n',
                    ' \tunique[n,s  ]\t',
                    ' check i != 42     ');
        db.Y.create({ii: 'int', nn: 'number', ss: 'string'},
                    ' [ ii , nn ]foreign X[i,n]',
                    '[ss,nn]   ->X  [s  ,n ] ');
        assertThrow(ConstraintError,
                    function () { db.X.insert({i: 42, n: 0, s: ''}); });
        assertEqual(db.Y.getForeigns().map(items).sort(cmp),
                    [[["keyFields", ["ii", "nn"]],
                      ["refRelVar", "X"],
                      ["refFields", ["i", "n"]]],
                     [["keyFields", ["ss", "nn"]],
                      ["refRelVar", "X"],
                      ["refFields", ["s", "n"]]]]);
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // aspect tests
  //////////////////////////////////////////////////////////////////////////////

  var AspectTestCase = TestCase.subclass(
    {
      name: 'aspect',

      testAspects: function () {
        var f = function (x) { return x; };
        var g = function (x) { throw x; };
        var C = Object.subclass({f: f, g: g, n: 42});
        var c = new C();

        var aspect0 = weave(Before, C, 'f', function (args) { ++args[0]; });
        assert(aspect0 instanceof Before);
        assertSame(aspect0, C.prototype.f);
        assertSame(c.f(0), 1);
        aspect0.enabled = false;
        assertSame(c.f(0), 0);
        aspect0.enabled = true;
        assertSame(c.f(0), 1);
        var aspect1 = weave(
          Before, c, 'f',
          function (args, method) { Array.push(args, method.length); });
        assertSame(c.f(), 2);
        var aspect2 = weave(Before, C, 'f', function (args) { args[0] += 2;});
        assertSame(c.f(), 4);
        assertSame(aspect0.unweave(), aspect2);
        assertSame(aspect1.unweave(), aspect2);
        assertSame(c.f(15), 17);
        assertSame(C.prototype.f.callSource(c, 0), 0);
        assertSame(aspect2.unweave(), f);

        var aspect3 = weave(After, C, 'f',
                            function (result) { return result + 1; });
        assertSame(c.f(0), 1);
        var aspect4 = weave(
          After, C, 'f',
          function (result, args, method) {
            return method + result + args[0];
          });
        assertSame(c.f(0), 'f10');
        aspect3.enabled = false;
        assertSame(c.f(0), 'f00');
        aspect3.unweave();
        aspect4.unweave();

        var aspect5 = weave(AfterCatch, C, 'f', function () { return 42; });
        assertSame(c.f(0), 0);
        var aspect6 = weave(
          AfterCatch, C, 'g',
          function (error, args, method) {
            return [method, Array.apply(null, args), error].join(' ');
          });
        assertSame(c.g(1,2,3), 'g 1,2,3 1');
        aspect5.unweave();
        aspect6.unweave();

        var buf;
        function save(args, method) {
          buf = method + ' ' + Array.apply(null, args);
        }
        var aspect7 = weave(AfterFinally, C, 'f', save);
        c.f(1, 2, 3);
        assertSame(buf, 'f 1,2,3');
        var aspect8 = weave(AfterFinally, C, 'g', save);
        var aspect9 = weave(AfterCatch, C, 'g', function () {});
        c.g(4, 5, 6);
        assertSame(buf, 'g 4,5,6');
        aspect7.unweave();
        aspect8.unweave();
        aspect9.unweave();

        var aspect10 = weave(
          Around, C, 'g',
          function (source, args, method) {
            try {
              return source.apply(this, args);
            } catch (error) {
              return [method, error, args[1]].join(' ');
            }
          });
        assertSame(c.g(1, 2), 'g 1 2');
        var aspect11 = weave(InsteadOf, C, 'g', function (x) { return -x; });
        assertSame(c.g(1, 2), -1);
        aspect10.unweave();
        aspect11.unweave();

        assertThrow(UsageError,
                    function () { weave(Before, C, 'n', function () {}); });
        assertThrow(NotImplementedError,
                    function () { weave(Aspect, C, 'f', function () {}); });
      },

      testWeave: function () {
        var f = function () {};
        var f1 = f.f1 = function () { return 1; };
        var f2 = f.f2 = function () { return 2; };
        var f3 = f.f3 = function () { return 3; };
        var aspects = weave(After, f, /[12]/,
                            function (result) { return -result; },
                            true);
        assertSame(f.f1(), -1);
        assertSame(f.f2(), -2);
        assertSame(f.f3(), 3);
        aspects.disable();
        assertSame(f.f1(), 1);
        aspects.enable();
        assertSame(f.f1(), -1);
        assertEqual(aspects.unweave(), [f1, f2]);
        assertSame(f.f1(), 1);
        assertSame(f.f2(), 2);
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // suite
  //////////////////////////////////////////////////////////////////////////////

  return loadSuite(
    [
      DebugTestCase,
      UnittestTestCase,
      CoreTestCase,
      BaseTestCase,
      UtilsTestCase,
      IterTestCase,
      StreamTestCase,
      TemplateTestCase,
      DictTestCase,
      HttpTestCase,
      UrlTestCase,
      RestTestCase,
      DbTestCase,
      AspectTestCase
    ]);

}})();
