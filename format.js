/**
 * String.format for JavaScript
 * Copyright (c) Daniel Mester Pirttijärvi 2009
 * 
 * This software is provided 'as-is', without any express or implied
 * warranty.  In no event will the authors be held liable for any damages
 * arising from the use of this software.
 * 
 * Permission is granted to anyone to use this software for any purpose,
 * including commercial applications, and to alter it and redistribute it
 * freely, subject to the following restrictions:
 * 
 * 1. The origin of this software must not be misrepresented; you must not
 *    claim that you wrote the original software. If you use this software
 *    in a product, an acknowledgment in the product documentation would be
 *    appreciated but is not required.
 * 
 * 2. Altered source versions must be plainly marked as such, and must not be
 *    misrepresented as being the original software.
 * 
 * 3. This notice may not be removed or altered from any source distribution.
 * 
 * -- END OF LICENSE --
 * 
 */

var msf = {};

(function() {

    // ***** Private Methods *****
    
    // Converts a number to a string and ensures the number has at 
    // least two digits.
    function numberPair(n) {
        return (n < 10 ? "0" : "") + n;
    }

    // This method generates a culture object from a specified IETF language code
    function getCulture(lcid) {
        lcid = lcid.toLowerCase();
        
        // Common format strings
        var t = {
            name: "en-GB",
            d: "dd/MM/yyyy",
            D: "dd MMMM yyyy",
            t: "HH:mm",
            T: "HH:mm:ss",
            M: "d MMMM",
            Y: "MMMM yyyy",
            s: "yyyy-MM-ddTHH:mm:ss",
            _m: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
            _d: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
            _r: ".", // Radix point
            _t: ",", // Thounsands separator
            _c: "£#,0.00", // Currency format string
            _ct: ",", // Currency thounsands separator
            _cr: "."  // Currency radix point
        };
        
        // Culture specific strings
        if (lcid.substr(0, 2) == "sv") {
            t.name = "sv-SE";
            t.d = "yyyy-MM-dd";
            t.D = "den dd MMMM yyyy";
            t._m = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
            t._d = ["söndag", "måndag", "tisdag", "onsdag", "torsdag", "fredag", "lördag"];
            t._r = ",";
            t._t = " ";
            t._ct = ".";
            t._cr = ",";
            t._c = "#,0.00 kr";
        } else if (lcid != "en-gb") {
            t.name = "en-US";
            t.t = "hh:mm tt";
            t.T = "hh:mm:ss tt";
            t.d = "MM/dd/yyyy";
            t.D = "MMMM dd, yyyy";
            t.Y = "MMMM, yyyy";
            t._c = "$#,0.00";
        }
        
        // Composite formats
        t.f = t.D + " " + t.t;
        t.F = t.D + " " + t.T;
        t.g = t.d + " " + t.t;
        t.G = t.d + " " + t.T;
        
        return t;
    }

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

        // Groups a string of digits by thousands and appends them to the string writer.
        function append(value) {
            for (var i = 0; i < value.length; i++) {
                // Write number
                out.push(value.charAt(i));

                // Begin a new group?
                if (groupCounter > 1 && groupCounter-- % 3 == 1) {
                    out.push(format.t);
                }
            }
        }

        // Analyse format string
        for (i = 0; i < format.f.length; i++) {
            c = format.f.charAt(i);
            decimals += atDecimals;
            if (c == "0") {
                if (atDecimals) {
                    forcedDecimals = decimals;
                } else if (forcedDigits < 0) {
                    forcedDigits = digits;
                }
            }
            digits += !atDecimals && (c == "0" || c == "#");
            atDecimals = atDecimals || c == ".";
        }
        forcedDigits = forcedDigits < 0 ? 1 : digits - forcedDigits;

        // Negative value? Begin string with a dash
        if (input < 0) {
            out.push("-");
        }

        // Round the input value to a specified number of decimals            
        input = (Math.round(Math.abs(input) * Math.pow(10, decimals)) / Math.pow(10, decimals)).toString();

        // Get integral length
        integralDigits = input.indexOf(".");
        integralDigits = integralDigits < 0 ? input.length : integralDigits;

        // Set initial input cursor position
        i = integralDigits - digits;

        // Group thousands?
        if (format.f.match(/^[^\.]*[0#],[0#]/)) {
            groupCounter = Math.max(integralDigits, forcedDigits);
        }

        for (var f = 0; f < format.f.length; f++) {
            c = format.f.charAt(f);
            
            // Digit placeholder
            if (c == "#" || c == "0") {
                if (i < integralDigits) {
                    // In the integral part
                    if (i >= 0) {
                        if (unused) {
                            append(input.substr(0, i));
                        }
                        append(input.charAt(i));

                        // Not yet inside the input number, force a zero?
                    } else if (i >= integralDigits - forcedDigits) {
                        append("0");
                    }

                    unused = false;

                } else if (forcedDecimals-- > 0 || i < input.length) {
                    // In the fractional part
                    append(i >= input.length ? "0" : input.charAt(i));
                }

                i++;

            // Radix point character according to current culture.
            } else if (c == ".") {
                if (input.length > ++i || forcedDecimals > 0) {
                    out.push(format.r);
                }

            // Other characters are written as they are, except from commas
            } else if (c !== ",") {
                out.push(c);
            }
        }
        
        return out.join("");
    }

    // ***** Number Formatting *****
    Number.prototype.__Format = function(format) {
        /// <summary>
        ///     Formats this number according the specified format string.
        /// </summary>
        /// <param name="format">The formatting string used to format this number.</param>

        var number = Number(this);

        if (format == "X") {
            return Math.round(number).toString(16).toUpperCase();
        } else if (format == "x") {
            return Math.round(number).toString(16);
        } else {
            // Write number as currency formatted string
            var formatting = {
                t: msf.LC._t,
                r: msf.LC._r
            };

            var g = "0.################",
                lowerFormat = format ? format.toLowerCase() : null;
                
            if (lowerFormat === null || lowerFormat == "g") {
                format = g;
            } else if (lowerFormat == "n") {
                format = "#," + g;
            } else if (lowerFormat == "c") {
                format = msf.LC._c;
                formatting.r = msf.LC._cr;
                formatting.t = msf.LC._ct;
            } else if (lowerFormat == "f") {
                format = "0.00";
            }

            // Thousands
            if (format.indexOf(",.") !== -1) {
                number /= 1000;
            }

            // Percent
            if (format.indexOf("%") !== -1) {
                number *= 100;
            }

            // Split groups ( positive; negative; zero, where the two last ones are optional)
            var groups = format.split(";");
            if (number < 0 && groups.length > 1) {
                number *= -1;
                formatting.f = groups[1];
            } else {
                formatting.f = groups[!number && groups.length > 2 ? 2 : 0];
            }
            
            return processNumber(number, formatting);
        }
    };

    // ***** Date Formatting *****
    Date.prototype.__Format = function(format) {
        var date = this;
		var output = "";
		var i;
        if (format.length == 1) {
            format = msf.LC[format];
        }
		
		return format.replace(/(d{1,4}|M{1,4}|yyyy|yy|HH|H|hh|h|mm|m|ss|s|tt)/g, 
			function () { switch (arguments[0]) {
					case "dddd": return msf.LC._d[date.getDay()];
					case "ddd": return msf.LC._d[date.getDay()].substr(0, 3);
					case "dd": return numberPair(date.getDate());
					case "d": return date.getDate();
					case "MMMM": return msf.LC._m[date.getMonth()];
					case "MMM": return msf.LC._m[date.getMonth()].substr(0, 3);
					case "MM": return numberPair(date.getMonth() + 1);
					case "M": return date.getMonth() + 1;
					case "yyyy": return date.getFullYear();
					case "yy": return date.getFullYear().toString().substr(2);
					case "HH": return numberPair(date.getHours());
					case "hh": return numberPair((date.getHours() - 1) % 12 + 1);
					case "H": return date.getHours();
					case "h": return (date.getHours() - 1) % 12 + 1;
					case "mm": return numberPair(date.getMinutes());
					case "m": return date.getMinutes();
					case "ss": return numberPair(date.getSeconds());
					case "s": return date.getSeconds();
					case "tt": return date.getHours() < 12 ? "AM" : "PM";
					default: return "";
				}
			});
    };

    String.__Format = function(str, obj0, obj1, obj2) {
        /// <summary>
        ///     Formats a string according to a specified formatting string.
        /// </summary>
        /// <param name="str">The formatting string used to format the additional arguments.</param>
        /// <param name="obj0">Object 1</param>
        /// <param name="obj1">Object 2 [optional]</param>
        /// <param name="obj2">Object 3 [optional]</param>

        var outerArgs = arguments, arg;
        
        return str.replace(/(\{*)\{((\d+)(\,(-?\d*))?(\:([^\}]*))?)\}/g, function () {
            var innerArgs = arguments;
            if (innerArgs[1] && innerArgs[1].length % 2 == 1) {
                return innerArgs[0];
            }
            
            // Throw exception if argument is missing
            if ((arg = outerArgs[parseInt(innerArgs[3], 10) + 1]) === undefined) {
                throw "Missing argument";
            }
            
            // If the object has a custom format method, use it,
            // otherwise use toString to create a string
            var formatted = arg.__Format ? 
                    arg.__Format(innerArgs[7]) : 
                    arg.toString();
                    
            var align = parseInt(innerArgs[5], 10) || 0;
            var paddingLength = Math.abs(align) - formatted.length;

            if (paddingLength > 0) {
                // Build padding string
                var padding = " ";
                while (padding.length < paddingLength) {
                    padding += " ";
                }

                // Add padding string at right side
                formatted = align > 0 ? formatted + padding : padding + formatted;
            }
            
            return innerArgs[1] + formatted;
        }).replace(/\{\{/g, "{");
    };

    
    // ***** Initialize msf object *****

    /// <summary>
    ///     The current culture used for culture specific formatting.
    /// </summary>
    msf.LC = null;

    msf.setCulture = function(languageCode) {
        /// <summary>
        ///     Sets the current culture, used for culture specific formatting.
        /// </summary>
        /// <param name="LCID">The IETF language code of the culture, e.g. en-US or en.</param>
        msf.LC = getCulture(languageCode) || getCulture(languageCode.substr(0, 2)) || getCulture();
    };
    
    // Initiate culture
    /*global navigator */// <- for JSLint, just ignore
    msf.setCulture(navigator.systemLanguage || navigator.language || "en-US");
    

    // Set Format methods
    var pr = Date.prototype;
    pr.format = pr.format || pr.__Format;
    pr = Number.prototype;
    pr.format = pr.format || pr.__Format;
    String.format = String.format || String.__Format;

//#IF DEBUG
        
    msf.doBenchmark = function (format, arg) {
        // <summary>
        //     Tests the performance of the String.format script.
        // </summary>
        // <param name="str">The format string to test</param>
        // <param name="arg">The value {0} to be used as an argument to
        // the String.format method.</param>
        // <returns>Returns the time in milliseconds to complete 
        // one format operation for the specified format string.</returns>
        
        // Number of variables in the test format string
        var num = 5000;
        
        // Construct a long format string
        var longformat = "";
        for (var i = 0; i < num; i++) {
            longformat += format;
        }
        
        // Perform test
        var start, end;
        start = new Date().valueOf();
        String.__Format(longformat, arg);
        end = new Date().valueOf();
        
        return (end - start) / num;
    };
    
//#END IF
 
})();

