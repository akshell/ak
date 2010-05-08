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

// Django template engine port
// http://docs.djangoproject.com/en/dev/topics/templates/

var inner = require('inner');
var core = inner.core;
var base = require('base');
var url = require('url');
var utils = require('utils');
require('format');


var TemplateSyntaxError = exports.TemplateSyntaxError = Error.subclass();

////////////////////////////////////////////////////////////////////////////////
// Wrap
////////////////////////////////////////////////////////////////////////////////

var Wrap = exports.Wrap = Object.subclass(
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
      if (this.raw === undefined)
        return '';
      var string = this.raw + '';
      return this.safe ? string : utils.escapeHTML(string);
    }
  });

////////////////////////////////////////////////////////////////////////////////
// Filter
////////////////////////////////////////////////////////////////////////////////

var Filter = exports.Filter = Object.subclass(
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
      return (result instanceof Wrap
              ? result
              : new Wrap(result,
                         {always: true,
                          value: value.safe,
                          arg: !arg || arg.safe,
                          both: value.safe && (!arg || arg.safe)
                         }[this._traits.safety] || false));
    }
  });

////////////////////////////////////////////////////////////////////////////////
// Exprs
////////////////////////////////////////////////////////////////////////////////

[Boolean, Number, Date].forEach(
  function (constructor) { constructor.prototype.toString.safe = true; });


var Variable = Object.subclass(
  function (lookups) {
    this._lookups = lookups;
  },
  {
    resolve: function (context) {
      var current = context;
      for (var i = 0; i < this._lookups.length; ++i) {
        var bit = this._lookups[i];
        if (current instanceof Wrap)
          current = current.raw;
        var field = (typeof(current.getTemplateVariable) == 'function'
                     ? current.getTemplateVariable(bit)
                     : current[bit]);
        current = typeof(field) == 'function' ? field.call(current) : field;
        if (current === undefined || current === null)
          break;
      }
      return (current instanceof Wrap
              ? current
              : new Wrap(current,
                         (current === undefined ||
                          current === null ||
                          (typeof(current.toString) == 'function' &&
                           current.toString.safe))));
    }
  });


var Constant = Object.subclass(
  function (value) {
    this._value = new Wrap(value, true);
  },
  {
    resolve: function () { return this._value; }
  });


var FilterExpr = Object.subclass(
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
    throw base.AssertionError();
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
    throw TemplateSyntaxError(
      'Expr does not start with primary: ' + base.repr(string));
  var i = findSignificant(match);
  base.assert(i != -1);
  var result = makePrimaryExpr(match[i], i - 1);

  var re = new RegExp(filterRegExp);
  re.lastIndex = match[0].length;
  while ((match = inner.nextMatch(re, string, TemplateSyntaxError))) {
    var filter = filters[match[1]];
    if (!filter)
      throw TemplateSyntaxError('Invalid filter: ' + base.repr(match[1]));
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

var smartSplit = exports.smartSplit = function (text) {
  return text.match(smartSplitRegExp) || [];
};

////////////////////////////////////////////////////////////////////////////////
// Nodes
////////////////////////////////////////////////////////////////////////////////

var GroupNode = Object.subclass(
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


var TextNode = Object.subclass(
  function (string) {
    this._string = string;
  },
  {
    render: function () { return this._string; }
  });


var ExprNode = Object.subclass(
  function (expr) {
    this._expr = expr;
  },
  {
    render: function (context) {
      return this._expr.resolve(context) + '';
    }
  });

////////////////////////////////////////////////////////////////////////////////
// Token
////////////////////////////////////////////////////////////////////////////////

var Token = Object.subclass(
  function (kind, content) {
    this.kind = kind;
    this.content = content;
  });

var TEXT    = 0;
var EXPR    = 1;
var BLOCK   = 2;
var COMMENT = 3;


function tokenize(string) {
  var re = /{%.*?%}|{{.*?}}|{#.*?#}/g;
  var result = [];
  var textStart = 0;
  var match;
  while ((match = re.exec(string))) {
    var tag = match[0];
    var tagStart = re.lastIndex - tag.length;
    if (tagStart > textStart)
      result.push(new Token(TEXT, string.substring(textStart, tagStart)));
    if (tag.startsWith('{#'))
      result.push(new Token(COMMENT, ''));
    else
      result.push(new Token(tag.startsWith('{%') ? BLOCK : EXPR,
                            tag.substring(2, tag.length - 2).trim()));
    textStart = re.lastIndex;
  }
  if (string.length > textStart)
    result.push(new Token(TEXT, string.substring(textStart)));
  return result;
}

////////////////////////////////////////////////////////////////////////////////
// Parser
////////////////////////////////////////////////////////////////////////////////

exports.Parser = Object.subclass(
  function (string, store, env) {
    this._tokens = tokenize(string);
    this.store = store;
    this.env = env;
    this._token = undefined;
    this.parsedNonText = false;
  },
  {
    get content() {
      return this._token.content;
    },

    parse: function (until/* = [] */) {
      until = until || [];
      var nodes = [];
      while (this._tokens.length) {
        this._token = this._tokens.shift();
        if (this._token.kind == TEXT) {
          nodes.push(new TextNode(this.content));
        } else if (this._token.kind == EXPR) {
          nodes.push(new ExprNode(this.makeExpr(this.content)));
          this.parsedNonText = true;
        } else if (this._token.kind == BLOCK) {
          if (until.indexOf(this.content) != -1)
            return new GroupNode(nodes);
          var command = this.content.split(/\s/, 1)[0];
          if (!command)
            throw TemplateSyntaxError('Empty block tag');
          var compile = this.env.tags[command];
          if (!compile)
            throw TemplateSyntaxError(
              'Invalid block tag: ' + base.repr(command));
          nodes.push(compile(this, this.content));
          this.parsedNonText = true;
        }
      }
      if (until.length)
        throw TemplateSyntaxError('Unclosed tags: ' + until.join(', '));
      return new GroupNode(nodes);
    },

    skip: function (end) {
      while (this._tokens.length) {
        this._token = this._tokens.shift();
        if (this._token.kind == BLOCK && this.content == end)
          return;
      }
      throw TemplateSyntaxError('Unclosed tag: ' + end);
    },

    makeExpr: function (string) {
      return makeExpr(string, this.env.filters);
    },

    makeExprs: function (strings) {
      return strings.map(this.makeExpr, this);
    }
  });

////////////////////////////////////////////////////////////////////////////////
// API
////////////////////////////////////////////////////////////////////////////////

exports.Template = Object.subclass(
  function (string, env/* = exports.env */) {
    this.store = {};
    this._root = new exports.Parser(string,
                                    this.store,
                                    env || exports.env).parse();
  },
  {
    render: function (context/* = {} */) {
      return this._root.render(context || {});
    }
  });


exports.getTemplate = function (name, env/* = exports.env */) {
  env = env || exports.env;
  env.cache = env.cache || {};
  if (!env.cache.hasOwnProperty(name))
    env.cache[name] = new exports.Template(env.load(name), env);
  return env.cache[name];
};


exports.safe = function (value) {
  return new Wrap(value instanceof Wrap ? value.raw : value, true);
};

////////////////////////////////////////////////////////////////////////////////
// defaultFilters
////////////////////////////////////////////////////////////////////////////////

function sortObjects(list, key) {
  var result = Array.slice(list);
  return result.sort(
    function (a, b) {
      return base.cmp(a[key], b[key]);
    });
}


var jsEscapes = [
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
  utils.range(32).map(
    function (i) {
      return [RegExp(String.fromCharCode(i), 'g'),
              '\\x' + (i < 16 ? '0' : '') + i.toString(16)];
    }));


var defaultFilters = {
  add: new Filter(
    function (value, arg) {
      var result = (+value.raw) + (+arg.raw);
      return isNaN(result) ? value : result;
    },
    {safety: 'always', accept: 'wrap'}),

  addSlashes: new Filter(
    function (value) {
      return (value
              .replace(/\\/g, '\\\\')
              .replace(/\"/g, '\\"')
              .replace(/\'/g, "\\'"));
    },
    {safety: 'value', accept: 'string'}),

  breakLines: new Filter(
    function (value) {
      return (value + '').replace(/\n/g, '<br>');
    },
    {safety: 'always', accept: 'wrap'}),

  capFirst: new Filter(
    function (value) {
      return value && value[0].toUpperCase() + value.substr(1);
    },
    {safety: 'value', accept: 'string'}),

  countWords: new Filter(
    function (value) {
      var words = value.trim().split(/\s+/);
      return (words.length == 1 && !words[0]
              ? 0
              : words.length);
    },
    {safety: 'always', accept: 'string'}),

  cut: new Filter(
    function (value, arg) {
      return value.replace(RegExp(RegExp.escape(arg), 'g'), '');
    },
    {accept: 'string'}),

  'default': new Filter(
    function (value, arg) {
      return value.raw ? value : arg;
    },
    {accept: 'wrap'}),

  defaultIfNull: new Filter(
    function (value, arg) {
      return value.raw === null ? arg : value;
    },
    {accept: 'wrap'}),

  defaultIfUndefined: new Filter(
    function (value, arg) {
      return value.raw === undefined ? arg : value;
    },
    {accept: 'wrap'}),

  divisibleBy: new Filter(
    function (value, arg) {
      return value % arg === 0;
    },
    {safety: 'always'}),

  encodeURI: new Filter(
    function (value) {
      return encodeURI(value);
    },
    {safe: 'always', accept: 'string'}),

  encodeURIComponent: new Filter(
    function (value) {
      return encodeURIComponent(value);
    },
    {safe: 'always', accept: 'string'}),

  escape: new Filter(
    function (value) { return value; }),

  escapeJS: new Filter(
    function (value) {
      jsEscapes.forEach(
        function (replacement) {
          value = value.replace(replacement[0], replacement[1]);
        });
      return value;
    },
    {accept: 'string'}),

  first: new Filter(
    function (value) {
      return value ? value[0] : value;
    },
    {safety: 'value'}),

  forceEscape: new Filter(
    function (value) {
      return new Wrap(value) + '';
    },
    {safety: 'always', accept: 'wrap'}),

  formatFileSize: new Filter(
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

  getDigit: new Filter(
    function (value, arg) {
      var num = +value;
      arg = +arg;
      if (isNaN(num) || isNaN(arg) || arg % 1 != 0)
        return value;
      var d = 1;
      for (var i = 1; i < arg; ++i)
        d *= 10;
      return new Wrap(Math.floor(num / d) % 10, true);
    },
    {safety: 'value'}),

  hyphen: new Filter(
    function (value) {
      return (value
              .trim()
              .replace(/[^\w\s-]/g, '')
              .replace(/[-\s]+/g, '-'));
    },
    {safety: 'always', accept: 'string'}),

  items: new Filter(
    function (value) {
      return base.keys(value).map(
        function (key) { return [key, value[key]]; });
    },
    {safety: 'value'}),

  join: new Filter(
    function (value, arg/* = '' */) {
      try {
        return value.raw.join(arg ? arg.raw : '');
      } catch (error) {
        return value;
      }
    },
    {safety: 'both', accept: 'wrap'}),

  last: new Filter(
    function (value) {
      return value ? value[value.length - 1] : value;
    },
    {safety: 'value'}),

  numberLines: new Filter(
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

  paragraph: new Filter(
    function (value) {
      value = (value + '').trim();
      if (!value)
        return '';
      return value.split(/\n{2,}/).map(
        function (paragraph) {
          return '<p>' + paragraph.replace(/\n/g, '<br>') + '</p>';
        }).join('\n\n');
    },
    {safety: 'always', accept: 'wrap'}),

  pluralize: new Filter(
    function (value, arg/* = 's' */) {
      var suffixes = arg ? arg.split(/,/g) : ['', 's'];
      if (suffixes.length > 2)
        return '';
      if (suffixes.length < 2)
        suffixes.shift('');
      return suffixes[value == 1 ? 0 : 1];
    },
    {safety: 'arg'}),

  removeTags: new Filter(
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

  safe: new Filter(
    function (value) { return value; },
    {safety: 'always'}),

  slice: new Filter(
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

  sortObjects: new Filter(
    function (value, arg) {
      return sortObjects(value, arg);
    },
    {safety: 'value'}),

  sortObjectsReversed: new Filter(
    function (value, arg) {
      return sortObjects(value, arg).reverse();
    },
    {safety: 'value'}),

  stripTags: new Filter(
    function (value) {
      return value.replace(/<[^>]*?>/g, '');
    },
    {safety: 'value', accept: 'string'}),

  timeSince: new Filter(
    function (value, arg) {
      return utils.timeSince(value, arg);
    },
    {safety: 'always'}),

  timeUntil: new Filter(
    function (value, arg) {
      return utils.timeUntil(value, arg);
    },
    {safety: 'always'}),

  toLowerCase: new Filter(
    function (value) {
      return value.toLowerCase();
    },
    {safety: 'value', accept: 'string'}),

  toString: new Filter(
    function (value, arg) {
      if (value === undefined)
        return new Wrap('', true);
      if (value === null)
        return new Wrap('null', true);
      return arg ? value.toString(arg) : value.toString();
    },
    {safety: 'both'}),

  toTitleCase: new Filter(
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

  toUpperCase: new Filter(
    function (value) {
      return value.toUpperCase();
    },
    {safety: 'value', accept: 'string'}),

  truncateWords: new Filter(
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

  yesno: new Filter(
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

////////////////////////////////////////////////////////////////////////////////
// defaultTags
////////////////////////////////////////////////////////////////////////////////

var defaultTags = {};


var CommentNode = Object.subclass(
  {
    render: function () {
      return '';
    }
  });

defaultTags.comment = function(parser) {
  parser.skip('endcomment');
  return new CommentNode();
};

var ForNode = Object.subclass(
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
      if (!sequence || !sequence.length)
        return this._emptyNode ? this._emptyNode.render(context) : '';
      if (this._reversed) {
        if (typeof(sequence) == 'string' || sequence instanceof String)
          sequence = sequence.split('');
        Array.reverse(sequence);
      }
      var bits = [];
      for (var i = 0; i < sequence.length; ++i) {
        var subcontext = {__proto__: context};
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

defaultTags['for'] = function (parser) {
  var match = (/^for\s+(\w+)\s+in\s+(.*?)(\s+reversed)?$/
               .exec(parser.content));
  if (!match)
    throw TemplateSyntaxError(
      '"for" tag should use the format ' +
        '"for <letters, digits or underscores> in <expr> [reversed]": ' +
        base.repr(parser.content));
  var bodyNode = parser.parse(['empty', 'endfor']);
  var emptyNode;
  if (parser.content == 'empty')
    emptyNode = parser.parse(['endfor']);
  return new ForNode(match[1], parser.makeExpr(match[2]), !!match[3],
                     bodyNode, emptyNode);
};


var ExtendsNode = Object.subclass(
  function (expr, store, env) {
    this._expr = expr;
    this._store = store;
    this._env = env;
  },
  {
    _getTemplate: function (context) {
      if (this._template)
        return this._template;
      var template = exports.getTemplate(this._expr.resolve(context).raw + '',
                                         this._env);
      if (this._expr instanceof Constant)
        this._template = template;
      return template;
    },

    render: function (context) {
      var template = this._getTemplate(context);
      template.store.child = this._store;
      try {
        return template.render(context);
      } finally {
        delete template.store.child;
      }
    }
  });

defaultTags.extends = function (parser) {
  if (parser.parsedNonText)
    throw TemplateSyntaxError(
      '"extends" should be the first tag in the template');
  var expr = parser.makeExpr(parser.content.substr(8).trim());
  parser.store.blocks = {};
  parser.parse();
  return new ExtendsNode(expr, parser.store, parser.env);
};


var BlockNode = Object.subclass(
  function (name, node, store) {
    this._name = name;
    this._node = node;
    this._store = store;
  },
  {
    render: function (context) {
      var node = this._node;
      for (var store = this._store.child; store; store = store.child) {
        if (store.blocks.hasOwnProperty(this._name))
          return store.blocks[this._name].render(
            {
              __proto__: context,
              'super': function () {
                return exports.safe(node.render(context));
              }
            });
      }
      return node.render(context);
    }
  });

defaultTags.block = function (parser) {
  var args = parser.content.split(/\s+/);
  if (args.length != 2)
    throw TemplateSyntaxError('"block" tag takes one argument');
  var name = args[1];
  parser.store.blocks = parser.store.blocks || {};
  if (parser.store.blocks.hasOwnProperty(name))
    throw TemplateSyntaxError(
      'Block with name ' + base.repr(name) + ' appears more than once');
  return parser.store.blocks[name] = new BlockNode(
    name, parser.parse(['endblock', 'endblock ' + name]), parser.store);
};


var CycleNode = Object.subclass(
  function (exprs) {
    this._exprs = exprs;
    this._index = 0;
  },
  {
    render: function (context) {
      var value = this._exprs[this._index].resolve(context);
      this._index = (this._index + 1) % this._exprs.length;
      return value + '';
    }
  });

defaultTags.cycle = function (parser) {
  var args = smartSplit(parser.content);
  if (args.length < 2)
    throw TemplateSyntaxError(
      '"cycle" tag requires at least one argument');
  var name;
  if (args.length == 2) {
    if (!parser.store.cycles)
      throw TemplateSyntaxError(
        'No named cycles defined in template');
    name = args[1];
    var node = parser.store.cycles[name];
    if (!node)
      throw TemplateSyntaxError(
        'Named cycle ' + base.repr(name) + ' is not defined');
    return node;
  }
  var exprStrings;
  if (args.length > 4 && args[args.length - 2] == 'as') {
    name = args[args.length - 1];
    exprStrings = args.slice(1, args.length - 2);
  } else {
    exprStrings = args.slice(1);
  }
  var result = new CycleNode(parser.makeExprs(exprStrings));
  if (name) {
    parser.store.cycles = parser.store.cycles || {};
    parser.store.cycles[name] = result;
  }
  return result;
};


var FilterNode = Object.subclass(
  function (expr, node) {
    this._expr = expr;
    this._node = node;
  },
  {
    render: function (context) {
      var subcontext = {__proto__: context};
      subcontext.content = this._node.render(context);
      return this._expr.resolve(subcontext) + '';
    }
  });

defaultTags.filter = function (parser) {
  var expr = parser.makeExpr('content|safe|' +
                             parser.content.substr(7).trim());
  return new FilterNode(expr, parser.parse(['endfilter']));
};


var FirstOfNode = Object.subclass(
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

defaultTags.firstOf = function (parser) {
  var args = smartSplit(parser.content);
  if (args.length < 2)
    throw TemplateSyntaxError(
      '"firstOf" tag requires at least one argument');
  return new FirstOfNode(parser.makeExprs(args.slice(1)));
};


var IfChangedNode = Object.subclass(
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
      if (this.hasOwnProperty('_prev') &&
          (this._exprs
           ? (curr.length == this._prev.length &&
              utils.zip(curr, this._prev).every(function (pair) {
                                                  return pair[0] == pair[1];
                                                }))
           : curr == this._prev))
        return this._elseNode ? this._elseNode.render(context) : '';
      this._prev = curr;
      return this._exprs ? this._thenNode.render(context) : curr;
    }
  });

defaultTags.ifchanged = function (parser) {
  var args = smartSplit(parser.content);
  var exprs;
  if (args.length > 1)
    exprs = parser.makeExprs(args.slice(1));
  var thenNode = parser.parse(['else', 'endifchanged']);
  var elseNode;
  if (parser.content == 'else')
    elseNode = parser.parse(['endifchanged']);
  return new IfChangedNode(exprs, thenNode, elseNode);
};


var IncludeNode = Object.subclass(
  function (expr, env) {
    this._expr = expr;
    this._env = env;
  },
  {
    _getTemplate: function (context) {
      if (this._template)
        return this._template;
      var name = this._expr.resolve(context).raw;
      var template = exports.getTemplate(name, this._env);
      if (this._expr instanceof Constant)
        this._template = template;
      return template;
    },

    render: function (context) {
      return this._getTemplate(context).render(context);
    }
  });

defaultTags.include = function (parser) {
  return new IncludeNode(parser.makeExpr(parser.content.substr(8)),
                         parser.env);
};


var SpacelessNode = Object.subclass(
  function (node) {
    this._node = node;
  },
  {
    render: function (context) {
      return (this._node.render(context) + '').replace(/>\s+</g, '><');
    }
  });

defaultTags.spaceless = function (parser) {
  return new SpacelessNode(parser.parse(['endspaceless']));
};


var templateTagMapping = {
  openBlock: '{%',
  closeBlock: '%}',
  openExpr: '{{',
  closeExpr: '}}',
  openBrace: '{',
  closeBrace: '}',
  openComment: '{#',
  closeComment: '#}'
};

defaultTags.templateTag = function (parser) {
  var args = parser.content.split(/\s+/);
  if (args.length != 2)
    throw TemplateSyntaxError(
      '"templateTag" takes one argument');
  var value = templateTagMapping[args[1]];
  if (!value)
    throw TemplateSyntaxError(
      'Invalid "templateTag" argument: ' + base.repr(args[1]) +
        '. Must be one of: ' + base.keys(templateTagMapping).join(', '));
  return new TextNode(value);
};


var WidthRatioNode = Object.subclass(
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

defaultTags.widthRatio = function (parser) {
  var args = smartSplit(parser.content);
  if (args.length != 4)
    throw TemplateSyntaxError(
      '"widthRatio" tag takes three arguments');
  return new WidthRatioNode(parser.makeExpr(args[1]),
                            parser.makeExpr(args[2]),
                            parser.makeExpr(args[3]));
};


var WithNode = Object.subclass(
  function (expr, name, node) {
    this._expr = expr;
    this._name = name;
    this._node = node;
  },
  {
    render: function (context) {
      var subcontext = {__proto__: context};
      subcontext[this._name] = this._expr.resolve(context);
      return this._node.render(subcontext);
    }
  });

defaultTags['with'] = function (parser) {
  var args = smartSplit(parser.content);
  if (args.length != 4)
    throw TemplateSyntaxError(
      '"with" tag takes three arguments');
  if (args[2] != 'as')
    throw TemplateSyntaxError(
      'Second argument to "with" must be "as"');
  return new WithNode(parser.makeExpr(args[1]),
                      args[3],
                      parser.parse(['endwith']));
};


var URLNode = Object.subclass(
  function (exprs, as) {
    this._exprs = exprs;
    this._as = as;
  },
  {
    render: function (context) {
      var path;
      try {
        path = url.reverse.apply(
          core.global,
          this._exprs.map(function (expr) {
                            return expr.resolve(context).raw;
                          }));
      } catch (error) {
        if (this._as && error instanceof url.ReverseError)
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

defaultTags.url = function (parser) {
  var args = smartSplit(parser.content);
  if (args.length < 2)
    throw TemplateSyntaxError(
      '"url" tag takes at least one argument');
  var exprStrings;
  var as;
  if (args.length > 3 && args[args.length - 2] == 'as') {
    as = args[args.length - 1];
    exprStrings = args.slice(1, args.length - 2);
  } else {
    exprStrings = args.slice(1);
  }
  return new URLNode(parser.makeExprs(exprStrings), as);
};


var CSRFTokenNode = Object.subclass(
  {
    render: function (context) {
      return ('<div style="display:none;">' +
              '<input type="hidden" name="csrfToken" value="' +
              (exports.csrfToken || '') +
              '"></div>');
    }
  });

defaultTags.csrfToken = function (parser) {
  if (parser.content.trim() != 'csrfToken')
    throw TemplateSyntaxError('"csrfToken" tag takes no arguments');
  return new CSRFTokenNode();
};


var StaticNode = Object.subclass(
  function (name, tsFunc, pathExpr, tsFlag) {
    var parts = ['http://static.akshell.com', name];
    var main = require.main;
    if (main.spot)
      parts.push('spots',
                 main.app,
                 main.owner.replace(/ /g, '-'),
                 main.spot);
    else
      parts.push('release', main.app);
    this._prefix = parts.join('/') + '/';
    this._tsFunc = tsFunc;
    this._pathExpr = pathExpr;
    this._tsFlag = tsFlag;
  },
  {
    render: function (context) {
      var path = this._pathExpr.resolve(context) + '';
      var url = this._prefix + path;
      if (this._tsFlag ||
          (this._tsFlag === undefined &&
           (path.endsWith('.css') || path.endsWith('.js')))) {
        try {
          return url + '?' + (this._tsFunc(path) / 1000);
        } catch (_) {}
      }
      return url;
    }
  });

[
  ['code', core.getCodeModDate],
  ['media', core.fs.getModDate]
].forEach(
  function (pair) {
    defaultTags[pair[0]] = function (parser) {
      var args = smartSplit(parser.content);
      var tsFlag;
      if (args.length == 3) {
        if (args[2] == 'timestamp')
          tsFlag = true;
        else if (args[2] == 'no-timestamp')
        tsFlag = false;
        else
          throw TemplateSyntaxError(
            'Unknow option of ' + base.repr(args[0]) +
              ' tag: ' + base.repr(args[2]));
      } else if (args.length != 2) {
        throw TemplateSyntaxError(
          base.repr(args[0]) + ' tag takes one or two arguments');
      }
      return new StaticNode(
        pair[0], pair[1], parser.makeExpr(args[1]), tsFlag);
    };
  });


var NowNode = Object.subclass(
  function (expr) {
    this._expr = expr;
  },
  {
    render: function (context) {
      if (!this._expr)
        return new Date().toString();
      var wrap = this._expr.resolve(context);
      var string = new Date().toString(wrap.raw);
      return wrap.safe ? string : utils.escapeHTML(string);
    }
  });


defaultTags.now = function (parser) {
  var args = smartSplit(parser.content);
  if (args.length > 2)
    throw TemplateSyntaxError(
      '"now" tag takes one optional argument');
  return new NowNode(args[1] && parser.makeExpr(args[1]));
};

////////////////////////////////////////////////////////////////////////////////
// if tag
////////////////////////////////////////////////////////////////////////////////

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
        throw TemplateSyntaxError(
          'Unexpected token ' + base.repr(this.value) +
            ' in expr ' + base.repr(this.string) +
            ' position ' + this.pos);
    }
  });

ExprToken.PAREN   = 0;
ExprToken.OP      = 1;
ExprToken.PRIMARY = 2;


var parenString = '(\\(|\\))';
var opString = '(\\|\\||&&|===|==|!==|!=|<=|>=|<|>|!)';

var exprTokenRegExp = RegExp(('\\s*(' +
                              parenString + '|' +
                              opString + '|' +
                              primaryString + ')\\s*'),
                             'g');

function tokenizeExpr(string) {
  var re = new RegExp(exprTokenRegExp);
  var result = [];
  var match;
  while ((match = inner.nextMatch(re, string, TemplateSyntaxError))) {
    var kind;
    var expr = undefined;
    if (match[2]) {
      kind = ExprToken.PAREN;
    } else if (match[3]) {
      kind = ExprToken.OP;
    } else {
      kind = ExprToken.PRIMARY;
      var i = findSignificant(match, 4);
      base.assert(i != -1);
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


var Binary = Object.subclass(
  function (left, right, func) {
    this._left = left;
    this._right = right;
    this._func = func;
  },
  {
    resolve: function (context) {
      return new Wrap(this._func(this._left.resolve(context).raw,
                                 this._right.resolve(context).raw));
    }
  });


var Unary = Object.subclass(
  function (arg, func) {
    this._arg = arg;
    this._func = func;
  },
  {
    resolve: function (context) {
      return new Wrap(this._func(this._arg.resolve(context).raw));
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
  '<': {
    arity: 2,
    precedence: 3,
    func: function (left, right) { return left < right; }
  },
  '>': {
    arity: 2,
    precedence: 3,
    func: function (left, right) { return left > right; }
  },
  '<=': {
    arity: 2,
    precedence: 3,
    func: function (left, right) { return left <= right; }
  },
  '>=': {
    arity: 2,
    precedence: 3,
    func: function (left, right) { return left >= right; }
  },
  '!': {
    arity: 1,
    precedence: 4,
    func: function (arg) { return !arg; }
  },
  '(': {
    arity: 0
  }
};


function parseExpr(string) {
  function require(cond) {
    if (!cond)
      throw TemplateSyntaxError(
        'Expr ' + base.repr(string) + ' is incomplete');
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
      base.assert(token.expr);
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
          throw TemplateSyntaxError(
            'Excess close paren in expr ' + base.repr(string) +
              ' position ' + token.pos);
        base.assert(ops[ops.length - 1].arity == 0);
        ops.pop();
      }
      break;
    }
  }
  fold();
  if (ops.length) {
    base.assert(ops[ops.length - 1].arity == 0);
    throw TemplateSyntaxError(
      'Close paren is missing in expr ' + base.repr(string));
  }
  require(exprs.length == 1);
  return exprs[0];
}


var IfNode = Object.subclass(
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

defaultTags['if'] = function (parser) {
  var expr = parseExpr(parser.content.substring(3));
  var thenNode = parser.parse(['else', 'endif']);
  var elseNode;
  if (parser.content == 'else')
    elseNode = parser.parse(['endif']);
  return new IfNode(expr, thenNode, elseNode);
};

////////////////////////////////////////////////////////////////////////////////
// Default environment
////////////////////////////////////////////////////////////////////////////////

var templateCache = {};

exports.env = {
  tags: defaultTags,
  filters: defaultFilters,
  load: function (name) {
    var i = name.indexOf(':');
    return (i == -1
            ? core.readCode('templates/' + name)
            : i == 0
            ? core.readCode(name)
            : core.readCode(name.substr(0, i), name.substr(i + 1)));
  }
};
