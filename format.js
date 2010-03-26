// String.format for JavaScript
// Copyright (c) Daniel Mester Pirttijärvi 2009
// Altered by Anton Korenyushkin 2010
//
// This software is provided 'as-is', without any express or implied
// warranty.  In no event will the authors be held liable for any damages
// arising from the use of this software.
//
// Permission is granted to anyone to use this software for any purpose,
// including commercial applications, and to alter it and redistribute it
// freely, subject to the following restrictions:
//
// 1. The origin of this software must not be misrepresented; you must not
//    claim that you wrote the original software. If you use this software
//    in a product, an acknowledgment in the product documentation would be
//    appreciated but is not required.
//
// 2. Altered source versions must be plainly marked as such, and must not be
//    misrepresented as being the original software.
//
// 3. This notice may not be removed or altered from any source distribution.


(function()
{
  // Converts a number to a string and ensures the number has at
  // least two digits.
  function numberPair(n) {
    return (n < 10 ? '0' : '') + n;
  }


  ak.culture = {
    d: 'MM/dd/yyyy',
    D: 'MMMM dd, yyyy',
    t: 'hh:mm tt',
    T: 'hh:mm:ss tt',
    M: 'd MMMM',
    Y: 'MMMM, yyyy',
    s: 'yyyy-MM-ddTHH:mm:ss',
    months: [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December'
    ],
    days: [
      'Sunday',
      'Monday',
      'Tuesday',
      'Wednesday',
      'Thursday',
      'Friday',
      'Saturday'
    ],
    decimalSeparator: '.',
    thousandsSeparator: ',',
    currencyFormat: '$#,0.00',
    currencyDecimalSeparator: '.',
    currencyThousandsSeparator: ','
  };


  var c = ak.culture;
  c.f = c.D + ' ' + c.t;
  c.F = c.D + ' ' + c.T;
  c.g = c.d + ' ' + c.t;
  c.G = c.d + ' ' + c.T;


  // Handles the internal format processing of a number
  function processNumber(input, format) {
    var digits = 0,
    forcedDigits = -1,
    integralDigits = -1,
    groupCounter = 0,
    decimals = 0,
    forcedDecimals = -1,
    atDecimals = false,
    unused = true, // True until a digit has been written to the output
    out = [], // Used as a StringBuilder
    c, i;

    // Groups a string of digits by thousands and
    // appends them to the string writer.
    function append(value) {
      for (var i = 0; i < value.length; i++) {
        // Write number
        out.push(value.charAt(i));

        // Begin a new group?
        if (groupCounter > 1 && groupCounter-- % 3 == 1)
          out.push(format.t);
      }
    }

    // Analyse format string
    for (i = 0; i < format.f.length; i++) {
      c = format.f.charAt(i);
      decimals += atDecimals;
      if (c == '0') {
        if (atDecimals)
          forcedDecimals = decimals;
        else if (forcedDigits < 0)
          forcedDigits = digits;
      }
      digits += !atDecimals && (c == '0' || c == '#');
      atDecimals = atDecimals || c == '.';
    }
    forcedDigits = forcedDigits < 0 ? 1 : digits - forcedDigits;

    // Negative value? Begin string with a dash
    if (input < 0)
      out.push('-');

    // Round the input value to a specified number of decimals
    input = (Math.round(Math.abs(input) * Math.pow(10, decimals)) /
             Math.pow(10, decimals)).toString();

    // Get integral length
    integralDigits = input.indexOf('.');
    integralDigits = integralDigits < 0 ? input.length : integralDigits;

    // Set initial input cursor position
    i = integralDigits - digits;

    // Group thousands?
    if (format.f.match(/^[^\.]*[0#],[0#]/))
      groupCounter = Math.max(integralDigits, forcedDigits);

    for (var f = 0; f < format.f.length; f++) {
      c = format.f.charAt(f);

      // Digit placeholder
      if (c == '#' || c == '0') {
        if (i < integralDigits) {
          // In the integral part
          if (i >= 0) {
            if (unused)
              append(input.substr(0, i));
            append(input.charAt(i));

            // Not yet inside the input number, force a zero?
          } else if (i >= integralDigits - forcedDigits) {
            append('0');
          }

          unused = false;

        } else if (forcedDecimals-- > 0 || i < input.length) {
          // In the fractional part
          append(i >= input.length ? '0' : input.charAt(i));
        }

        i++;

        // Radix point character according to current culture.
      } else if (c == '.') {
        if (input.length > ++i || forcedDecimals > 0)
          out.push(format.r);

        // Other characters are written as they are, except from commas
      } else if (c !== ',') {
        out.push(c);
      }
    }

    return out.join('');
  }


  var original = Number.prototype.toString;


  // Number Formatting
  Number.prototype.setHidden(
    'toString',
    function (format) {
      if (!format)
        return original.call(this);
      if (typeof(format) == 'number' || format instanceof Number)
        return original.call(this, format);

      format += '';

      var number = Number(this);

      if (format == 'X') {
        return original.call(Math.round(number), 16).toUpperCase();
      } else if (format == 'x') {
        return original.call(Math.round(number), 16);
      } else {
        // Write number as currency formatted string
        var formatting = {
          t: ak.culture.thousandsSeparator,
          r: ak.culture.decimalSeparator
        };

        var g = '0.################';
        var lowerFormat = format.toLowerCase();

        if (lowerFormat === null || lowerFormat == 'g') {
          format = g;
        } else if (lowerFormat == 'n') {
          format = '#,' + g;
        } else if (lowerFormat == 'c') {
          format = ak.culture.currencyFormat;
          formatting.r = ak.culture.currencyDecimalSeparator;
          formatting.t = ak.culture.currencyThousandsSeparator;
        } else if (lowerFormat == 'f') {
          format = '0.00';
        }

        // Thousands
        if (format.indexOf(',.') !== -1)
          number /= 1000;

        // Percent
        if (format.indexOf('%') !== -1)
          number *= 100;

        // Split groups
        // positive; negative; zero, where the two last ones are optional
        var groups = format.split(';');
        if (number < 0 && groups.length > 1) {
          number *= -1;
          formatting.f = groups[1];
        } else {
          formatting.f = groups[!number && groups.length > 2 ? 2 : 0];
        }

        return processNumber(number, formatting);
      }
    });


  // Date Formatting
  Date.prototype.setHidden(
    'toString',
    function (format) {
      format = format || 'ddd MMM dd yyyy HH:mm:ss';
      format += '';
      if (format.length == 1 && ak.culture.hasOwnProperty(format))
        format = ak.culture[format];
      var self = this;
	  return format.replace(
          /(d{1,4}|M{1,4}|yyyy|yy|HH|H|hh|h|mm|m|ss|s|tt)/g,
		  function () {
            switch (arguments[0]) {
			case 'dddd': return ak.culture.days[self.getDay()];
			case 'ddd': return ak.culture.days[self.getDay()].substr(0, 3);
			case 'dd': return numberPair(self.getDate());
			case 'd': return self.getDate();
			case 'MMMM': return ak.culture.months[self.getMonth()];
			case 'MMM': return ak.culture.months[self.getMonth()].substr(0, 3);
			case 'MM': return numberPair(self.getMonth() + 1);
			case 'M': return self.getMonth() + 1;
			case 'yyyy': return self.getFullYear();
			case 'yy': return self.getFullYear().toString().substr(2);
			case 'HH': return numberPair(self.getHours());
			case 'hh': return numberPair((self.getHours() - 1) % 12 + 1);
			case 'H': return self.getHours();
			case 'h': return (self.getHours() - 1) % 12 + 1;
			case 'mm': return numberPair(self.getMinutes());
			case 'm': return self.getMinutes();
			case 'ss': return numberPair(self.getSeconds());
			case 's': return self.getSeconds();
			case 'tt': return self.getHours() < 12 ? 'AM' : 'PM';
			default: return '';
			}
		  });
    });


  String.prototype.setHidden(
    'format',
    function(/* ... */) {
      var outerArgs = arguments;

      return this.replace(
        /(\{*)\{((\d+)(\,(-?\d*))?(\:([^\}]*))?)\}/g,
        function () {
          var innerArgs = arguments;
          if (innerArgs[1] && innerArgs[1].length % 2 == 1)
            return innerArgs[0];

          var arg = outerArgs[parseInt(innerArgs[3], 10)];
          var formatted = (arg === undefined ? 'undefined'
                           : arg === null ? 'null'
                           : arg.toString(innerArgs[7]));
          var align = +innerArgs[5] || 0;
          var paddingLength = Math.abs(align) - formatted.length;

          if (paddingLength > 0) {
            // Build padding string
            var padding = ' ';
            while (padding.length < paddingLength)
              padding += ' ';

            // Add padding string at right side
            formatted = align > 0 ? padding + formatted : formatted + padding;
          }

          return innerArgs[1] + formatted;
        }).replace(/\{\{/g, '{').replace(/\}\}/g, '}');
    });

})();
