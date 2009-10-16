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

// Django template engine port
// http://docs.djangoproject.com/en/dev/topics/templates/

(function ()
{
  ak.include('utils.js');
  ak.include('url.js');

  var $ = new ak.Module('ak.template', '0.1');

  //////////////////////////////////////////////////////////////////////////////
  // Errors
  //////////////////////////////////////////////////////////////////////////////

  ak.TemplateSyntaxError = ak.BaseError.subclass();
  ak.TemplateDoesNotExist = ak.BaseError.subclass();

  //////////////////////////////////////////////////////////////////////////////
  // Wrap
  //////////////////////////////////////////////////////////////////////////////

  $.Wrap = Object.subclass(
    function (raw, safe/* = false */) {
      this.raw = raw;
      this.safe = safe || false;
    },
    {
      prepare: function (accept) {
        if (accept == 'wrap')
          return this;
        if (accept == 'string')
          return this.raw + '';
        return this.raw;
      },

      toString: function () {
        var string = this.raw + '';
        return (this.safe
                ? string
                : (string
                   .replace(/&/g, '&amp;')
                   .replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;')
                   .replace(/\"/g, '&quot;')
                   .replace(/\'/g, '&#39;')));
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // Filter
  //////////////////////////////////////////////////////////////////////////////

  $.Filter = Object.subclass(
    function (func, traits/* = {} */) {
      this._func = func;
      this._traits = traits || {};
    },
    {
      filter: function (value, /* optional */arg) {
        var accept = this._traits.accept;
        var result = (arg
                      ? this._func(value.prepare(accept), arg.prepare(accept))
                      : this._func(value.prepare(accept)));
        return (result instanceof $.Wrap
                ? result
                : new $.Wrap(result,
                             {always: true,
                              value: value.safe,
                              arg: !arg || arg.safe,
                              both: value.safe && (!arg || arg.safe)
                             }[this._traits.safety] || false));
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // Exprs
  //////////////////////////////////////////////////////////////////////////////

  $.Expr = Object.subclass(
    {
      resolve: ak.abstract
    });


  var Variable = $.Expr.subclass(
    function (lookups) {
      this._lookups = lookups;
    },
    {
      resolve: function (context) {
        var current = context;
        var safe = false;
        for (var i = 0; i < this._lookups.length; ++i) {
          var bit = this._lookups[i];
          if (current instanceof $.Wrap) {
            safe = current.safe;
            current = current.raw;
          }
          var field = current[bit];
          current = typeof(field) == 'function' ? field.call(current) : field;
          if (current === undefined || current === null)
            break;
        }
        return current instanceof $.Wrap ? current : new $.Wrap(current, safe);
      }
    });


  var Constant = $.Expr.subclass(
    function (value) {
      this._value = new $.Wrap(value, true);
    },
    {
      resolve: ak.getter('_value')
    });


  var FilterExpr = $.Expr.subclass(
    function (filter, expr, arg) {
      this._filter = filter;
      this._expr = expr;
      this._arg = arg;
    },
    {
      resolve: function (context) {
        var value = this._expr.resolve(context);
        return (this._arg
                ? this._filter.filter(value, this._arg.resolve(context))
                : this._filter.filter(value));
      }
    });


  var PRIMARY_STRING_LITERAL = 0;
  var PRIMARY_NUMBER_LITERAL = 1;
  var PRIMARY_TRUE_LITERAL = 2;
  var PRIMARY_FALSE_LITERAL = 3;
  var PRIMARY_UNDEFINED_LITERAL = 4;
  var PRIMARY_NULL_LITERAL = 5;
  var PRIMARY_VARIABLE = 6;

  function makePrimaryExpr(string, kind) {
    switch (kind) {
    case PRIMARY_STRING_LITERAL:
      return new Constant(string
                          .substring(1, string.length - 1)
                          .replace(string[0] == '"' ? /\\\"/g : /\\\'/g,
                                   string[0])
                          .replace(/\\\\/g, '\\'));
    case PRIMARY_NUMBER_LITERAL:
      return new Constant(+string);
    case PRIMARY_TRUE_LITERAL:
      return new Constant(true);
    case PRIMARY_FALSE_LITERAL:
      return new Constant(false);
    case PRIMARY_UNDEFINED_LITERAL:
      return new Constant(undefined);
    case PRIMARY_NULL_LITERAL:
      return new Constant(null);
    case PRIMARY_VARIABLE:
      return new Variable(string.split('.'));
    default:
      throw new ak.AssertionError();
    }
  }


  function findSignificant(match, start/* = 1 */) {
    if (arguments.length < 2)
      start = 1;
    for (var i = start; i < match.length; ++i)
      if (match[i])
        return i;
    return -1;
  }


  var stringLiteralString = ('("[^"\\\\]*(?:\\\\.[^"\\\\]*)*"|' +
                             "'[^'\\\\]*(?:\\\\.[^'\\\\]*)*')");

  var numberLiteralString = ('([-+]?(?:\\d*\\.?\\d+(?:[eE][-+]?\\d+)?|' +
                             'Infinity\\b|NaN\\b))');

  var variableString = '([\\w\\.]+)';

  var primaryString = ('(?:' + stringLiteralString + '|' +
                       numberLiteralString + '|' +
                       '(?:(true)|(false)|(undefined)|(null)\\b)|' +
                       variableString + ')');

  var exprStartRegExp = RegExp('^' + primaryString);

  var filterRegExp = RegExp('\\|(\\w+)(?::' + primaryString + ')?',
                            'g');

  function makeExpr(string, filters) {
    var match = exprStartRegExp.exec(string);
    if (!match)
      throw new ak.TemplateSyntaxError(
        'Expr does not start with primary: ' + ak.repr(string));
    var i = findSignificant(match);
    ak.assert(i != -1);
    var result = makePrimaryExpr(match[i], i - 1);

    var re = new RegExp(filterRegExp);
    re.lastIndex = match[0].length;
    while ((match = ak.nextMatch(re, string, ak.TemplateSyntaxError))) {
      var filter = filters[match[1]];
      if (!filter)
        throw new ak.TemplateSyntaxError(
          'Invalid filter: ' + ak.repr(match[1]));
      var arg = undefined;
      i = findSignificant(match, 2);
      if (i != -1)
        arg = makePrimaryExpr(match[i], i - 2);
      result = new FilterExpr(filter, result, arg);
      doneIndex = re.lastIndex;
    }
    return result;
  }


  var smartSplitRegExp = RegExp(('(?:' +
                                 '"(?:[^"\\\\]|\\\\.)*"|' +
                                 "'(?:[^'\\\\]|\\\\.)*'|" +
                                 '[^\\s"\']+' +
                                 ')+[^\\s]*|[^\\s]+'),
                                'g');

  $.smartSplit = function (text) {
    return text.match(smartSplitRegExp) || [];
  };

  //////////////////////////////////////////////////////////////////////////////
  // Nodes
  //////////////////////////////////////////////////////////////////////////////

  $.Node = Object.subclass(
    {
      render: ak.abstract
    });


  var GroupNode = $.Node.subclass(
    function (subnodes) {
      this._subnodes = subnodes;
    },
    {
      render: function (context) {
        return (this._subnodes.map(
                  function (node) {
                    return node.render(context);
                  }).join(''));
      }
    });


  var TextNode = $.Node.subclass(
    function (string) {
      this._string = string;
    },
    {
      render: ak.getter('_string')
    });


  var ExprNode = $.Node.subclass(
    function (expr, env) {
      this._expr = expr;
      this._env = env;
    },
    {
      render: function (context) {
        var value = this._expr.resolve(context);
        return (value.raw === undefined || value.raw === null
                ? this._env.invalid
                : value + '');
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // Token
  //////////////////////////////////////////////////////////////////////////////

  $.Token = Object.subclass(
    function (kind, contents) {
      this.kind = kind;
      this.contents = contents;
    });

  $.Token.TEXT    = 0;
  $.Token.EXPR    = 1;
  $.Token.BLOCK   = 2;
  $.Token.COMMENT = 3;


  function tokenize(string) {
    var re = /{%.*?%}|{{.*?}}|{#.*?#}/g;
    var result = [];
    var textStart = 0;
    var match;
    while ((match = re.exec(string))) {
      var tag = match[0];
      var tagStart = re.lastIndex - tag.length;
      if (tagStart > textStart)
        result.push(new $.Token($.Token.TEXT,
                                string.substring(textStart, tagStart)));
      if (tag.startsWith('{#'))
        result.push(new $.Token($.Token.COMMENT, ''));
      else
        result.push(new $.Token((tag.startsWith('{%')
                                 ? $.Token.BLOCK
                                 : $.Token.EXPR),
                                tag.substring(2, tag.length - 2).trim()));
      textStart = re.lastIndex;
    }
    if (string.length > textStart)
      result.push(new $.Token($.Token.TEXT, string.substring(textStart)));
    return result;
  }

  //////////////////////////////////////////////////////////////////////////////
  // Parser
  //////////////////////////////////////////////////////////////////////////////

  $.Parser = Object.subclass(
    function (string, store, env/* = ak.template.defaultEnv */) {
      this._tokens = tokenize(string);
      this.store = store;
      this.env = env || $.defaultEnv;
      this.token = undefined;
      this.parsedNonText = false;
    },
    {
      parse: function (until/* = [] */) {
        until = until || [];
        var nodes = [];
        while (this._tokens.length) {
          this.token = this._tokens.shift();
          if (this.token.kind == $.Token.TEXT) {
            nodes.push(new TextNode(this.token.contents));
          } else if (this.token.kind == $.Token.EXPR) {
            nodes.push(new ExprNode(this.makeExpr(this.token.contents),
                                    this.env));
            this.parsedNonText = true;
          } else if (this.token.kind == $.Token.BLOCK) {
            if (until.indexOf(this.token.contents) != -1)
              return new GroupNode(nodes);
            var command = this.token.contents.split(/\s/, 1)[0];
            if (!command)
              throw new ak.TemplateSyntaxError('Empty block tag');
            var compile = this.env.tags[command];
            if (!compile)
              throw new ak.TemplateSyntaxError(
                'Invalid block tag: ' + ak.repr(command));
            nodes.push(compile(this));
            this.parsedNonText = true;
          }
        }
        if (until.length)
          throw new ak.TemplateSyntaxError('Unclosed tags: ' + until.join(', '));
        return new GroupNode(nodes);
      },

      skip: function (end) {
        while (this._tokens.length) {
          this.token = this._tokens.shift();
          if (this.token.kind == $.Token.BLOCK && this.token.contents == end)
            return;
        }
        throw new ak.TemplateSyntaxError('Unclosed tag: ' + endTag);
      },

      makeExpr: function (string) {
        return makeExpr(string, this.env.filters);
      },

      makeExprs: function (strings) {
        return strings.map(this.makeExpr, this);
      }
    });

  //////////////////////////////////////////////////////////////////////////////
  // Template and getTemplate
  //////////////////////////////////////////////////////////////////////////////

  ak.Template = Object.subclass(
    function (string,
              name/* = '<Unknown Template>' */,
              env/* = ak.template.defaultEnv */) {
      this.store = {};
      this._root = (new $.Parser(string, this.store, env)).parse();
      this._name = name || '<Unknown Template>';
    },
    {
      render: function (context/* = {} */) {
        return this._root.render(context || {});
      }
    });


  ak.getTemplate = function (name, env/* = ak.template.defaultEnv */) {
    env = env || $.defaultEnv;
    return new ak.Template(env.load(name), name, env);
  };

  //////////////////////////////////////////////////////////////////////////////
  // defaultFilters
  //////////////////////////////////////////////////////////////////////////////

  function doDictSort(iterable, key) {
    return ak.sorted(iterable,
                     function (a, b) {
                       return ak.cmp(a[key], b[key]);
                     });
  }


  jsEscapes = [
    [/\\/g, '\\x5c'],
    [/\'/g, '\\x27'],
    [/\"/g, '\\x22'],
    [/>/g, '\\x3e'],
    [/</g, '\\x3c'],
    [/&/g, '\\x26'],
    [/=/g, '\\x3d'],
    [/-/g, '\\x2d'],
    [/;/g, '\\x3b'],
    [/\u2028/g, '\\u2028'],
    [/\u2029/g, '\\u2029']
  ].concat(
    ak.range(32).map(
      function (i) {
        return [RegExp(String.fromCharCode(i), 'g'),
                '\\x' + (i < 16 ? '0' : '') + i.toString(16)];
      }));


  $.defaultFilters = {
    add: new $.Filter(
      function (value, arg) {
        var vNum = +value.raw;
        var aNum = +arg.raw;
        if (isNaN(vNum) || isNaN(aNum))
          return value;
        return vNum + aNum;
      },
      {safety: 'always', accept: 'wrap'}),

    addslashes: new $.Filter(
      function (value) {
        return (value
                .replace(/\\/g, '\\\\')
                .replace(/\"/g, '\\"')
                .replace(/\'/g, "\\'"));
      },
      {safety: 'value', accept: 'string'}),

    capfirst: new $.Filter(
      function (value) {
        return value && value[0].toUpperCase() + value.substr(1);
      },
      {safety: 'value', accept: 'string'}),

    cut: new $.Filter(
      function (value, arg) {
        return value.replace(RegExp(RegExp.escape(arg), 'g'), '');
      },
      {accept: 'string'}),

    'default': new $.Filter(
      function (value, arg) {
        return value.raw ? value : arg;
      },
      {accept: 'wrap'}),

    default_if_null: new $.Filter(
      function (value, arg) {
        return value.raw === null ? arg : value;
      },
      {accept: 'wrap'}),

    default_if_undefined: new $.Filter(
      function (value, arg) {
        return value.raw === undefined ? arg : value;
      },
      {accept: 'wrap'}),

    dictsort: new $.Filter(
      function (value, arg) {
        return doDictSort(value, arg);
      },
      {safety: 'value'}),

    dictsortreversed: new $.Filter(
      function (value, arg) {
        return doDictSort(value, arg).reverse();
      },
      {safety: 'value'}),

    divisibleby: new $.Filter(
      function (value, arg) {
        return value % arg === 0;
      },
      {safety: 'always'}),

    encode_uri: new $.Filter(
      function (value) {
        return encodeURI(value);
      },
      {safe: 'always', accept: 'string'}),

    encode_uri_component: new $.Filter(
      function (value) {
        return encodeURIComponent(value);
      },
      {safe: 'always', accept: 'string'}),

    escape: new $.Filter(
      function (value) { return value; }),

    escapejs: new $.Filter(
      function (value) {
        return ak.reduce(
          function (string, replacement) {
            return string.replace(replacement[0], replacement[1]);
          },
          jsEscapes,
          value);
      },
      {accept: 'string'}),

    filesizeformat: new $.Filter(
      function (value) {
        value = +value;
        if (isNaN(value))
          return '0 bytes';
        if (value == 1)
          return '1 byte';
        if (value < 1024)
          return value.toFixed(0) + ' bytes';
        if (value < 1024 * 1024)
          return (value / 1024).toFixed(1) + ' KB';
        if (value < 1024 *1024 * 1024)
          return (value / (1024 * 1024)).toFixed(1) + ' MB';
        return (value / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
      },
      {safety: 'always'}),

    first: new $.Filter(
      function (value) {
        return (value === undefined || value === null
                ? value
                : value[0]);
      },
      {safety: 'value'}),

    floatformat: new $.Filter(
      function (value, arg/* = -1 */) {
        value = +value;
        if (isNaN(value))
          return '';
        if (arguments.length < 2)
          arg = -1;
        arg = +arg;
        if (isNaN(arg) || arg % 1 != 0)
          return value;
        if (arg < 0 && value % 1 == 0)
          return value.toFixed();
        return value.toFixed(Math.abs(arg));
      },
      {safety: 'always'}),

    force_escape: new $.Filter(
      function (value) {
        return (new $.Wrap(value)) + '';
      },
      {safety: 'always', accept: 'wrap'}),

    get_digit: new $.Filter(
      function (value, arg) {
        var num = +value;
        arg = +arg;
        if (isNaN(num) || isNaN(arg) || arg % 1 != 0)
          return value;
        var d = 1;
        for (var i = 1; i < arg; ++i)
          d *= 10;
        return new $.Wrap(Math.floor(num / d) % 10, true);
      },
      {safety: 'value'}),

    join: new $.Filter(
      function (value, arg/* = '' */) {
        try {
          return value.raw.join(arg ? arg.raw : '');
        } catch (error) {
          return value;
        }
      },
      {safety: 'both', accept: 'wrap'}),

    last: new $.Filter(
      function (value) {
        return (value === undefined || value === null
                ? value
                : value[value.length - 1]);
      },
      {safety: 'value'}),

    linebreaks: new $.Filter(
      function (value) {
        value = (value + '').trim();
        if (!value)
          return '';
        return value.split(/\n{2,}/).map(
          function (paragraph) {
            return '<p>' + paragraph.replace(/\n/g, '<br />') + '</p>';
          }).join('\n\n');
      },
      {safety: 'always', accept: 'wrap'}),

    linebreaksbr: new $.Filter(
      function (value) {
        return (value + '').replace(/\n/g, '<br />');
      },
      {safety: 'always', accept: 'wrap'}),

    linenumbers: new $.Filter(
      function (value) {
        var lines = (value + '').split('\n');
        var width = (lines.length + '').length;
        for (var i = 0; i < lines.length; ++i) {
          var num = (i + 1) + '';
          while (num.length < width)
            num = ' ' + num;
          lines[i] = num + ' ' + lines[i];
        }
        return lines.join('\n');
      },
      {safety: 'always', accept: 'wrap'}),

    ljust: new $.Filter(
      function (value, arg) {
        arg = +arg;
        return isNaN(arg) ? value : value.ljust(arg);
      },
      {safety: 'value', accept: 'string'}),

    lower: new $.Filter(
      function (value) {
        return value.toLowerCase();
      },
      {safety: 'value', accept: 'string'}),

    pluralize: new $.Filter(
      function (value, arg/* = 's' */) {
        var suffixes = arg ? arg.split(/,/g) : ['', 's'];
        if (suffixes.length > 2)
          return '';
        if (suffixes.length < 2)
          suffixes.shift('');
        return suffixes[value == 1 ? 0 : 1];
      },
      {safety: 'arg'}),

    removetags: new $.Filter(
      function (value, arg) {
        if (!arg || !arg.raw)
          return value;
        var tags = (arg.raw + '').trim().split(/\s+/).map(RegExp.escape);
        if (tags.length == 1 && !tags[0])
          return value;
        var group = '(' + tags.join('|') + ')';
        var re = RegExp('<' + group + '(/?>|\s+[^>]*>)|</' + group + '>', 'g');
        return (value.raw + '').replace(re, '');
      },
      {safety: 'both', accept: 'wrap'}),

    rjust: new $.Filter(
      function (value, arg) {
        arg = +arg;
        return isNaN(arg) ? value : value.rjust(arg);
      },
      {safety: 'value', accept: 'string'}),

    safe: new $.Filter(
      function (value) { return value; },
      {safety: 'always'}),

    slice: new $.Filter(
      function (value, arg) {
        if (!arg || !value)
          return value;
        var func;
        if (typeof(value) == 'string' || value instanceof String)
          func = String.prototype.substring;
        else if (value instanceof Array)
          func = Array.prototype.slice;
        else
          return value;
        var bits = (arg + '').split(',');
        if (bits.length > 2)
          return value;
        var begin = +bits[0];
        if (isNaN(begin))
          return value;
        var args = [begin];
        if (bits.length == 2) {
          var end = +bits[1];
          if (isNaN(end))
            return value;
          args.push(end);
        }
        return func.apply(value, args);
      },
      {safety: 'value'}),

    slugify: new $.Filter(
      function (value) {
        return (value
                .trim()
                .replace(/[^\w\s-]/g, '')
                .replace(/[-\s]+/g, '-')
                .toLowerCase());
      },
      {safety: 'always', accept: 'string'}),

    striptags: new $.Filter(
      function (value) {
        return value.replace(/<[^>]*?>/g, '');
      },
      {safety: 'value', accept: 'string'}),

    title: new $.Filter(
      function (value) {
        return (value
                .toLowerCase()
                .replace(/(\s)(\S)/g,
                         function (string, p1, p2) {
                           return p1 + p2.toUpperCase();
                         })
                .replace(/^\S/,
                         function (string) {
                           return string.toUpperCase();
                         }));
      },
      {safety: 'value', accept: 'string'}),

    truncatewords: new $.Filter(
      function (value, arg) {
        var length = +arg;
        if (isNaN(length))
          return value;
        var words = (value + '').trim().split(/\s+/);
        if (words.length > length)
          words = words.slice(0, length).concat('...');
        return words.join(' ');
      },
      {safety: 'value'}),

    upper: new $.Filter(
      function (value) {
        return value.toUpperCase();
      },
      {safety: 'value', accept: 'string'}),

    wordcount: new $.Filter(
      function (value) {
        var words = value.trim().split(/\s+/);
        return (words.length == 1 && !words[0]
                ? 0
                : words.length);
      },
      {safety: 'always', accept: 'string'}),

    yesno: new $.Filter(
      function (value, arg) {
        var answers = (arg
                       ? (arg.raw + '').split(',')
                       : ['yes', 'no']);
        return (answers.length == 2
                ? answers[value.raw ? 0 : 1]
                : value);
      },
      {safety: 'arg', accept: 'wrap'})
  };

  //////////////////////////////////////////////////////////////////////////////
  // defaultTags
  //////////////////////////////////////////////////////////////////////////////

  $.defaultTags = {};


  var CommentNode = $.Node.subclass(
    {
      render: function (context) {
        return '';
      }
    });

  $.defaultTags.comment = function(parser) {
    parser.skip('endcomment');
    return new CommentNode();
  };


  var ForNode = $.Node.subclass(
    function (name, expr, reversed, bodyNode, emptyNode) {
      this._name = name;
      this._expr = expr;
      this._reversed = reversed;
      this._bodyNode = bodyNode;
      this._emptyNode = emptyNode;
    },
    {
      render: function (context) {
        var sequence = this._expr.resolve(context).raw;
        if (!(sequence instanceof Array))
          sequence = ak.array(sequence);
        if (!sequence.length)
          return this._emptyNode ? this._emptyNode.render(context) : '';
        if (this._reversed)
          sequence.reverse();
        var bits = [];
        for (var i = 0; i < sequence.length; ++i) {
          var subcontext = ak.clone(context);
          subcontext[this._name] = sequence[i];
          subcontext.forloop = {
            parentloop: context.forloop,
            counter: i + 1,
            counter0: i,
            revcounter: sequence.length - i,
            revcounter0: sequence.length - i - 1,
            first: i == 0,
            last: i == sequence.length - 1
          };
          bits.push(this._bodyNode.render(subcontext));
        }
        return bits.join('');
      }
    });

  $.defaultTags['for'] = function (parser) {
    var match = (/^for\s+(\w+)\s+in\s+(.*?)(\s+reversed)?$/
                 .exec(parser.token.contents));
    if (!match)
      throw new ak.TemplateSyntaxError(
        '"for" tag should use the format ' +
          '"for <letters, digits or underscores> in <expr> [reversed]": ' +
          ak.repr(parser.token.contents));
    var bodyNode = parser.parse(['empty', 'endfor']);
    var emptyNode;
    if (parser.token.contents == 'empty')
      emptyNode = parser.parse(['endfor']);
    return new ForNode(match[1], parser.makeExpr(match[2]), !!match[3],
                       bodyNode, emptyNode);
  };


  var ExtendsNode = $.Node.subclass(
    function (expr, blocks, env) {
      this._expr = expr;
      this._blocks = blocks;
      this._env = env;
    },
    {
      _getTemplate: function (context) {
        if (this._template)
          return this._template;
        var template = ak.getTemplate(this._expr.resolve(context).raw + '',
                                      this._env);
        template.store.blocks = ak.update(template.store.blocks || {},
                                            this._blocks);
        if (this._expr instanceof Constant)
          this._template = template;
        return template;
      },

      render: function (context) {
        return this._getTemplate(context).render(context);
      }
    });

  $.defaultTags.extends = function (parser) {
    if (parser.parsedNonText)
      throw new ak.TemplateSyntaxError(
        '"extend" should be the first tag in the template');
    var expr = parser.makeExpr(parser.token.contents.substr(8).trim());
    parser.store.extends = true;
    parser.parse();
    return new ExtendsNode(expr, parser.store.blocks || {}, parser.env);
  };


  var BlockNode = $.Node.subclass(
    function (name, node, store) {
      store.blocks[name] = this;
      this._name = name;
      this._node = node;
      this._store = store;
    },
    {
      render: function (context) {
        return (this._store.extends
                ? ''
                : this._store.blocks[this._name].doRender(context));
      },

      doRender: function (context) {
        return this._node.render(context);
      }
    });

  $.defaultTags.block = function (parser) {
    var args = parser.token.contents.split(/\s+/);
    if (args.length != 2)
      throw new ak.TemplateSyntaxError('"block" tag takes one argument');
    var name = args[1];
    parser.store.blocks = parser.store.blocks || {};
    if (name in parser.store.blocks)
      throw new ak.TemplateSyntaxError('Block with name ' + ak.repr(name) +
                                       ' appears more than once');
    return new BlockNode(name,
                         parser.parse(['endblock', 'endblock ' + name]),
                         parser.store);
  };


  var CycleNode = $.Node.subclass(
    function (exprs, env) {
      this._itr = ak.cycle(exprs);
      this._env = env;
    },
    {
      render: function (context) {
        ak.assert(this._itr.valid);
        var value = this._itr.next().resolve(context);
        return (value.raw === undefined || value.raw === null
                ? this._env.invalid
                : value + '');
      }
    });

  $.defaultTags.cycle = function (parser) {
    var args = $.smartSplit(parser.token.contents);
    if (args.length < 2)
      throw new ak.TemplateSyntaxError(
        '"cycle" tag requires at least one argument');
    var name;
    if (args.length == 2) {
      if (!parser.store.cycles)
        throw new ak.TemplateSyntaxError(
          'No named cycles defined in template');
      name = args[1];
      var node = parser.store.cycles[name];
      if (!node)
        throw new ak.TemplateSyntaxError(
          'Named cycle ' + ak.repr(name) + ' is not defined');
      return node;
    }
    var exprStrings;
    if (args.length > 4 && args[args.length - 2] == 'as') {
      name = args[args.length - 1];
      exprStrings = args.slice(1, args.length - 2);
    } else {
      exprStrings = args.slice(1);
    }
    var result = new CycleNode(parser.makeExprs(exprStrings, parser.env));
    if (name) {
      parser.store.cycles = parser.store.cycles || {};
      parser.store.cycles[name] = result;
    }
    return result;
  };


  var DebugNode = $.Node.subclass(
    {
      render: function (context) {
        return (new $.Wrap(ak.repr(context))) + '';
      }
    });

  $.defaultTags.debug = function (parser) {
    return new DebugNode();
  };


  var FilterNode = $.Node.subclass(
    function (expr, node, env) {
      this._expr = expr;
      this._node = node;
    },
    {
      render: function (context) {
        var subcontext = ak.clone(context);
        subcontext.contents = this._node.render(context);
        return this._expr.resolve(subcontext) + '';
      }
    });

  $.defaultTags.filter = function (parser) {
    var expr = parser.makeExpr('contents|safe|' +
                               parser.token.contents.substr(7).trim());
    return new FilterNode(expr, parser.parse(['endfilter']));
  };


  var FirstOfNode = $.Node.subclass(
    function (exprs) {
      this._exprs = exprs;
    },
    {
      render: function (context) {
        for (var i = 0; i < this._exprs.length; ++i) {
          var value = this._exprs[i].resolve(context);
          if (value.raw)
            return value + '';
        }
        return '';
      }
    });

  $.defaultTags.firstof = function (parser) {
    var args = $.smartSplit(parser.token.contents);
    if (args.length < 2)
      throw new ak.TemplateSyntaxError(
        '"firstof" tag requires at least one argument');
    return new FirstOfNode(parser.makeExprs(args.slice(1)));
  };


  var IfChangedNode = $.Node.subclass(
    function (exprs, thenNode, elseNode) {
      this._exprs = exprs;
      this._thenNode = thenNode;
      this._elseNode = elseNode;
    },
    {
      render: function (context) {
        var curr = (this._exprs
                    ? this._exprs.map(function (expr) {
                                        return expr.resolve(context).raw;
                                      })
                    : this._thenNode.render(context));
        if ('_prev' in this &&
            (this._exprs
             ? (curr.length == this._prev.length &&
                ak.zip(curr, this._prev).every(function (pair) {
                                                 return pair[0] == pair[1];
                                               }))
             : curr == this._prev))
          return this._elseNode ? this._elseNode.render(context) : '';
        this._prev = curr;
        return this._exprs ? this._thenNode.render(context) : curr;
      }
    });

  $.defaultTags.ifchanged = function (parser) {
    var args = $.smartSplit(parser.token.contents);
    var exprs;
    if (args.length > 1)
      exprs = parser.makeExprs(args.slice(1));
    var thenNode = parser.parse(['else', 'endifchanged']);
    var elseNode;
    if (parser.token.contents == 'else')
      elseNode = parser.parse(['endifchanged']);
    return new IfChangedNode(exprs, thenNode, elseNode);
  };


  var IncludeNode = $.Node.subclass(
    function (expr, env) {
      this._expr = expr;
      this._env = env;
    },
    {
      _getTemplate: function (context) {
        if (this._template)
          return this._template;
        var name = this._expr.resolve(context).raw;
        var template;
        try {
          template = ak.getTemplate(name, this._env);
        } catch (error) {
          if (this._env.debug && error instanceof ak.TemplateSyntaxError)
            throw error;
          template = new ak.Template('', '', this._env);
        }
        if (this._expr instanceof Constant)
          this._template = template;
        return template;
      },

      render: function (context) {
        return this._getTemplate(context).render(context);
      }
    });

  $.defaultTags.include = function (parser) {
    return new IncludeNode(parser.makeExpr(parser.token.contents.substr(8)),
                           parser.env);
  };


  var RegroupNode = $.Node.subclass(
    function (targetExpr, keyExpr, name) {
      this._targetExpr = targetExpr;
      this._keyExpr = keyExpr;
      this._name = name;
    },
    {
      render: function (context) {
        var target = this._targetExpr.resolve(context).raw;
        var itr = ak.iter(target);
        var keyExpr = this._keyExpr;
        context[this._name] = (
          itr.valid
          ? (ak.array(
               ak.map(
                 ak.groupBy(
                   itr,
                   function (v) {
                     return keyExpr.resolve(v).raw;
                   }),
                 function (pair) {
                   return {grouper: pair[0], list: pair[1]};
                 })))
          : []);
        return '';
      }
    });

  $.defaultTags.regroup = function (parser) {
    var args = $.smartSplit(parser.token.contents);
    if (args.length != 6)
      throw new ak.TemplateSyntaxError(
        '"regroup" tag takes five arguments');
    if (args[2] != 'by')
      throw new ak.TemplateSyntaxError(
        'Second argument to "regroup" must be "by"');
    if (args[4] != 'as')
      throw new ak.TemplateSyntaxError(
        'Next to last argument to "regroup" must be "as"');
    return new RegroupNode(parser.makeExpr(args[1]),
                           parser.makeExpr(args[3]),
                           args[5]);
  };


  var SpacelessNode = $.Node.subclass(
    function (node) {
      this._node = node;
    },
    {
      render: function (context) {
        return (this._node.render(context) + '').replace(/>\s+</g, '><');
      }
    });

  $.defaultTags.spaceless = function (parser) {
    return new SpacelessNode(parser.parse(['endspaceless']));
  };


  var templateTagMapping = {
    openblock: '{%',
    closeblock: '%}',
    openvariable: '{{',
    closevariable: '}}',
    openbrace: '{',
    closebrace: '}',
    opencomment: '{#',
    closecomment: '#}'
  };

  $.defaultTags.templatetag = function (parser) {
    var args = parser.token.contents.split(/\s+/);
    if (args.length != 2)
      throw new ak.TemplateSyntaxError(
        '"templatetag" takes one argument');
    var value = templateTagMapping[args[1]];
    if (!value)
      throw new ak.TemplateSyntaxError(
        'Invalid "templatetag" argument: ' + ak.repr(args[1]) +
        '. Must be one of: ' + ak.keys(templateTagMapping).join(', '));
    return new TextNode(value);
  };


  var WidthRatioNode = $.Node.subclass(
    function (currExpr, maxExpr, maxWidthExpr) {
      this._currExpr = currExpr;
      this._maxExpr = maxExpr;
      this._maxWidthExpr = maxWidthExpr;
    },
    {
      render: function (context) {
        var curr = this._currExpr.resolve(context).raw;
        var max = this._maxExpr.resolve(context).raw;
        var maxWidth = this._maxWidthExpr.resolve(context).raw;
        var ratio = (curr / max) * maxWidth;
        return isNaN(ratio) ? '' : Math.round(ratio) + '';
      }
    });

  $.defaultTags.widthratio = function (parser) {
    var args = $.smartSplit(parser.token.contents);
    if (args.length != 4)
      throw new ak.TemplateSyntaxError(
        '"widthratio" tag takes three arguments');
    return new WidthRatioNode(parser.makeExpr(args[1]),
                              parser.makeExpr(args[2]),
                              parser.makeExpr(args[3]));
  };


  var WithNode = $.Node.subclass(
    function (expr, name, node) {
      this._expr = expr;
      this._name = name;
      this._node = node;
    },
    {
      render: function (context) {
        var subcontext = ak.clone(context);
        subcontext[this._name] = this._expr.resolve(context);
        return this._node.render(subcontext);
      }
    });

  $.defaultTags['with'] = function (parser) {
    var args = $.smartSplit(parser.token.contents);
    if (args.length != 4)
      throw new ak.TemplateSyntaxError(
        '"with" tag takes three arguments');
    if (args[2] != 'as')
      throw new ak.TemplateSyntaxError(
        'Second argument to "with" must be "as"');
    return new WithNode(parser.makeExpr(args[1]),
                        args[3],
                        parser.parse(['endwith']));
  };


  var URLNode = $.Node.subclass(
    function (controller, argExprs, as) {
      this._controller = controller;
      this._argExprs = argExprs;
      this._as = as;
    },
    {
      render: function (context) {
        var path;
        try {
          path = ak.reverse.apply(
            ak.global,
            [this._controller].concat(
              this._argExprs.map(function (expr) {
                                   return expr.resolve(context).raw;
                                 })));
        } catch (error) {
          if (this._as && error instanceof ak.ReverseError)
            return '';
          throw error;
        }
        if (this._as) {
          context[this._as] = path;
          return '';
        } else {
          return path;
        }
      }
    });

  $.defaultTags.url = function (parser) {
    var args = $.smartSplit(parser.token.contents);
    if (args.length < 2)
      throw new ak.TemplateSyntaxError(
        '"url" takes at least two arguments');
    var exprStrings;
    var as;
    if (args.length > 3 && args[args.length - 2] == 'as') {
      as = args[args.length - 1];
      exprStrings = args.slice(2, args.length - 2);
    } else {
      exprStrings = args.slice(2);
    }
    var controllerAndPage = args[1].split('#', 2);
    var bits = controllerAndPage[0].split('.');
    var object = ak.global;
    for (var i = 0; i < bits.length; ++i) {
      object = object[bits[i]];
      if (!object)
        throw new ak.TemplateSyntaxError(
          'Controller ' + args[1] + ' does not exist');
    }
    if (controllerAndPage[1])
      object = object.page(controllerAndPage[1]);
    return new URLNode(object, parser.makeExprs(exprStrings), as);
  };

  //////////////////////////////////////////////////////////////////////////////
  // if tag
  //////////////////////////////////////////////////////////////////////////////

  var ExprToken = Object.subclass(
    function (kind, value, string, pos, /* optional */expr) {
      this.kind = kind;
      this.value = value;
      this.string = string;
      this.pos = pos;
      this.expr = expr;
    },
    {
      check: function (cond) {
        if (!cond)
          throw new ak.TemplateSyntaxError(
            'Unexpected token ' + ak.repr(this.value) +
            ' in expr ' + ak.repr(this.string) +
            ' position ' + this.pos);
      }
    });

  ExprToken.PAREN   = 0;
  ExprToken.OP      = 1;
  ExprToken.PRIMARY = 2;


  var parenString = '(\\(|\\))';
  var opString = '(\\|\\||&&|===|==|!==|!=|!)';

  var exprTokenRegExp = RegExp(('\\s*(' +
                                parenString + '|' +
                                opString + '|' +
                                primaryString + ')\\s*'),
                               'g');

  function tokenizeExpr(string) {
    var re = new RegExp(exprTokenRegExp);
    var result = [];
    var match;
    while ((match = ak.nextMatch(re, string, ak.TemplateSyntaxError))) {
      var kind;
      var expr = undefined;
      if (match[2]) {
        kind = ExprToken.PAREN;
      } else if (match[3]) {
        kind = ExprToken.OP;
      } else {
        kind = ExprToken.PRIMARY;
        var i = findSignificant(match, 4);
        ak.assert(i != -1);
        expr = makePrimaryExpr(match[i], i - 4);
      }
      result.push(new ExprToken(kind,
                                match[1],
                                string,
                                re.lastIndex - match[0].length,
                                expr));
    }
    return result;
  }


  var Binary = $.Expr.subclass(
    function (left, right, func) {
      this._left = left;
      this._right = right;
      this._func = func;
    },
    {
      resolve: function (context) {
        return new $.Wrap(this._func(this._left.resolve(context).raw,
                                     this._right.resolve(context).raw));
      }
    });


  var Unary = $.Expr.subclass(
    function (arg, func) {
      this._arg = arg;
      this._func = func;
    },
    {
      resolve: function (context) {
        return new $.Wrap(this._func(this._arg.resolve(context).raw));
      }
    });


  var opCatalog = {
    '||': {
      arity: 2,
      precedence: 0,
      func: function (left, right) { return left || right; }
    },
    '&&': {
      arity: 2,
      precedence: 1,
      func: function (left, right) { return left && right; }
    },
    '==': {
      arity: 2,
      precedence: 2,
      func: function (left, right) { return left == right; }
    },
    '!=': {
      arity: 2,
      precedence: 2,
      func: function (left, right) { return left != right; }
    },
    '===': {
      arity: 2,
      precedence: 2,
      func: function (left, right) { return left === right; }
    },
    '!==': {
      arity: 2,
      precedence: 2,
      func: function (left, right) { return left !== right; }
    },
    '!': {
      arity: 1,
      precedence: 3,
      func: function (arg) { return !arg; }
    },
    '(': {
      arity: 0
    }
  };


  function parseExpr(string) {
    function require(cond) {
      if (!cond)
        throw new ak.TemplateSyntaxError(
          'Expr ' + ak.repr(string) + ' is incomplete');
    }

    var tokens = tokenizeExpr(string);
    var ops = [];
    var exprs = [];
    var binaryExpected = false;

    function fold(precedence) {
      precedence = precedence || 0;
      while (ops.length) {
        var op = ops[ops.length - 1];
        if (op.arity == 1) {
          require(exprs.length);
          exprs.push(new Unary(exprs.pop(), ops.pop().func));
        } else if (op.arity == 2 && op.precedence >= precedence) {
          require(exprs.length >= 2);
          var right = exprs.pop();
          var left = exprs.pop();
          exprs.push(new Binary(left, right, ops.pop().func));
        } else {
          break;
        }
      }
    }

    while (tokens.length) {
      var token = tokens.shift();
      switch (token.kind) {
      case ExprToken.PRIMARY:
        token.check(!binaryExpected);
        ak.assert(token.expr);
        exprs.push(token.expr);
        binaryExpected = true;
        break;
      case ExprToken.OP:
        var op = opCatalog[token.value];
        if (op.arity == 1) {
          token.check(!binaryExpected);
          ops.push(op);
        } else {
          token.check(binaryExpected);
          fold(op.precedence);
          ops.push(op);
          binaryExpected = false;
        }
        break;
      case ExprToken.PAREN:
        token.check(token.value != '.');
        if (token.value == '(') {
          token.check(!binaryExpected);
          ops.push(opCatalog['(']);
        } else {
          token.check(binaryExpected);
          fold();
          if (!ops.length)
            throw new ak.TemplateSyntaxError(
              'Excess close paren in expr ' + ak.repr(string) +
              ' position ' + token.pos);
          ak.assert(ops[ops.length - 1].arity == 0);
          ops.pop();
        }
        break;
      }
    }
    fold();
    if (ops.length) {
      ak.assert(ops[ops.length - 1].arity == 0);
      throw new ak.TemplateSyntaxError(
        'Close paren is missing in expr ' + ak.repr(string));
    }
    require(exprs.length == 1);
    return exprs[0];
  }


  var IfNode = $.Node.subclass(
    function (expr, thenNode, /* optional */elseNode) {
      this._expr = expr;
      this._thenNode = thenNode;
      this._elseNode = elseNode;
    },
    {
      render: function (context) {
        return (this._expr.resolve(context).raw
                ? this._thenNode.render(context)
                : (this._elseNode
                   ? this._elseNode.render(context)
                   : ''));
      }
    });

  $.defaultTags['if'] = function (parser) {
    var expr = parseExpr(parser.token.contents.substring(3));
    var thenNode = parser.parse(['else', 'endif']);
    var elseNode;
    if (parser.token.contents == 'else')
      elseNode = parser.parse(['endif']);
    return new IfNode(expr, thenNode, elseNode);
  };

  //////////////////////////////////////////////////////////////////////////////
  // defaultEnv
  //////////////////////////////////////////////////////////////////////////////

  $.makeLoadFromCode = function (dir) {
    var cache = {};
    return function (name) {
      return (name in cache
              ? cache[name]
              : ak.readCode(dir + '/' + name));
    };
  };


  $.defaultEnv = {
    debug: false,
    invalid: '',
    tags: $.defaultTags,
    filters: $.defaultFilters,
    load: $.makeLoadFromCode('/templates')
  };

  //////////////////////////////////////////////////////////////////////////////
  // Epilogue
  //////////////////////////////////////////////////////////////////////////////

  ak.nameFunctions($);

})();
