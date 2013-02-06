(function(){var require = function (file, cwd) {
    var resolved = require.resolve(file, cwd || '/');
    var mod = require.modules[resolved];
    if (!mod) throw new Error(
        'Failed to resolve module ' + file + ', tried ' + resolved
    );
    var cached = require.cache[resolved];
    var res = cached? cached.exports : mod();
    return res;
};

require.paths = [];
require.modules = {};
require.cache = {};
require.extensions = [".js",".coffee",".json"];

require._core = {
    'assert': true,
    'events': true,
    'fs': true,
    'path': true,
    'vm': true
};

require.resolve = (function () {
    return function (x, cwd) {
        if (!cwd) cwd = '/';
        
        if (require._core[x]) return x;
        var path = require.modules.path();
        cwd = path.resolve('/', cwd);
        var y = cwd || '/';
        
        if (x.match(/^(?:\.\.?\/|\/)/)) {
            var m = loadAsFileSync(path.resolve(y, x))
                || loadAsDirectorySync(path.resolve(y, x));
            if (m) return m;
        }
        
        var n = loadNodeModulesSync(x, y);
        if (n) return n;
        
        throw new Error("Cannot find module '" + x + "'");
        
        function loadAsFileSync (x) {
            x = path.normalize(x);
            if (require.modules[x]) {
                return x;
            }
            
            for (var i = 0; i < require.extensions.length; i++) {
                var ext = require.extensions[i];
                if (require.modules[x + ext]) return x + ext;
            }
        }
        
        function loadAsDirectorySync (x) {
            x = x.replace(/\/+$/, '');
            var pkgfile = path.normalize(x + '/package.json');
            if (require.modules[pkgfile]) {
                var pkg = require.modules[pkgfile]();
                var b = pkg.browserify;
                if (typeof b === 'object' && b.main) {
                    var m = loadAsFileSync(path.resolve(x, b.main));
                    if (m) return m;
                }
                else if (typeof b === 'string') {
                    var m = loadAsFileSync(path.resolve(x, b));
                    if (m) return m;
                }
                else if (pkg.main) {
                    var m = loadAsFileSync(path.resolve(x, pkg.main));
                    if (m) return m;
                }
            }
            
            return loadAsFileSync(x + '/index');
        }
        
        function loadNodeModulesSync (x, start) {
            var dirs = nodeModulesPathsSync(start);
            for (var i = 0; i < dirs.length; i++) {
                var dir = dirs[i];
                var m = loadAsFileSync(dir + '/' + x);
                if (m) return m;
                var n = loadAsDirectorySync(dir + '/' + x);
                if (n) return n;
            }
            
            var m = loadAsFileSync(x);
            if (m) return m;
        }
        
        function nodeModulesPathsSync (start) {
            var parts;
            if (start === '/') parts = [ '' ];
            else parts = path.normalize(start).split('/');
            
            var dirs = [];
            for (var i = parts.length - 1; i >= 0; i--) {
                if (parts[i] === 'node_modules') continue;
                var dir = parts.slice(0, i + 1).join('/') + '/node_modules';
                dirs.push(dir);
            }
            
            return dirs;
        }
    };
})();

require.alias = function (from, to) {
    var path = require.modules.path();
    var res = null;
    try {
        res = require.resolve(from + '/package.json', '/');
    }
    catch (err) {
        res = require.resolve(from, '/');
    }
    var basedir = path.dirname(res);
    
    var keys = (Object.keys || function (obj) {
        var res = [];
        for (var key in obj) res.push(key);
        return res;
    })(require.modules);
    
    for (var i = 0; i < keys.length; i++) {
        var key = keys[i];
        if (key.slice(0, basedir.length + 1) === basedir + '/') {
            var f = key.slice(basedir.length);
            require.modules[to + f] = require.modules[basedir + f];
        }
        else if (key === basedir) {
            require.modules[to] = require.modules[basedir];
        }
    }
};

(function () {
    var process = {};
    var global = typeof window !== 'undefined' ? window : {};
    var definedProcess = false;
    
    require.define = function (filename, fn) {
        if (!definedProcess && require.modules.__browserify_process) {
            process = require.modules.__browserify_process();
            definedProcess = true;
        }
        
        var dirname = require._core[filename]
            ? ''
            : require.modules.path().dirname(filename)
        ;
        
        var require_ = function (file) {
            var requiredModule = require(file, dirname);
            var cached = require.cache[require.resolve(file, dirname)];

            if (cached && cached.parent === null) {
                cached.parent = module_;
            }

            return requiredModule;
        };
        require_.resolve = function (name) {
            return require.resolve(name, dirname);
        };
        require_.modules = require.modules;
        require_.define = require.define;
        require_.cache = require.cache;
        var module_ = {
            id : filename,
            filename: filename,
            exports : {},
            loaded : false,
            parent: null
        };
        
        require.modules[filename] = function () {
            require.cache[filename] = module_;
            fn.call(
                module_.exports,
                require_,
                module_,
                module_.exports,
                dirname,
                filename,
                process,
                global
            );
            module_.loaded = true;
            return module_.exports;
        };
    };
})();


require.define("path",function(require,module,exports,__dirname,__filename,process,global){function filter (xs, fn) {
    var res = [];
    for (var i = 0; i < xs.length; i++) {
        if (fn(xs[i], i, xs)) res.push(xs[i]);
    }
    return res;
}

// resolves . and .. elements in a path array with directory names there
// must be no slashes, empty elements, or device names (c:\) in the array
// (so also no leading and trailing slashes - it does not distinguish
// relative and absolute paths)
function normalizeArray(parts, allowAboveRoot) {
  // if the path tries to go above the root, `up` ends up > 0
  var up = 0;
  for (var i = parts.length; i >= 0; i--) {
    var last = parts[i];
    if (last == '.') {
      parts.splice(i, 1);
    } else if (last === '..') {
      parts.splice(i, 1);
      up++;
    } else if (up) {
      parts.splice(i, 1);
      up--;
    }
  }

  // if the path is allowed to go above the root, restore leading ..s
  if (allowAboveRoot) {
    for (; up--; up) {
      parts.unshift('..');
    }
  }

  return parts;
}

// Regex to split a filename into [*, dir, basename, ext]
// posix version
var splitPathRe = /^(.+\/(?!$)|\/)?((?:.+?)?(\.[^.]*)?)$/;

// path.resolve([from ...], to)
// posix version
exports.resolve = function() {
var resolvedPath = '',
    resolvedAbsolute = false;

for (var i = arguments.length; i >= -1 && !resolvedAbsolute; i--) {
  var path = (i >= 0)
      ? arguments[i]
      : process.cwd();

  // Skip empty and invalid entries
  if (typeof path !== 'string' || !path) {
    continue;
  }

  resolvedPath = path + '/' + resolvedPath;
  resolvedAbsolute = path.charAt(0) === '/';
}

// At this point the path should be resolved to a full absolute path, but
// handle relative paths to be safe (might happen when process.cwd() fails)

// Normalize the path
resolvedPath = normalizeArray(filter(resolvedPath.split('/'), function(p) {
    return !!p;
  }), !resolvedAbsolute).join('/');

  return ((resolvedAbsolute ? '/' : '') + resolvedPath) || '.';
};

// path.normalize(path)
// posix version
exports.normalize = function(path) {
var isAbsolute = path.charAt(0) === '/',
    trailingSlash = path.slice(-1) === '/';

// Normalize the path
path = normalizeArray(filter(path.split('/'), function(p) {
    return !!p;
  }), !isAbsolute).join('/');

  if (!path && !isAbsolute) {
    path = '.';
  }
  if (path && trailingSlash) {
    path += '/';
  }
  
  return (isAbsolute ? '/' : '') + path;
};


// posix version
exports.join = function() {
  var paths = Array.prototype.slice.call(arguments, 0);
  return exports.normalize(filter(paths, function(p, index) {
    return p && typeof p === 'string';
  }).join('/'));
};


exports.dirname = function(path) {
  var dir = splitPathRe.exec(path)[1] || '';
  var isWindows = false;
  if (!dir) {
    // No dirname
    return '.';
  } else if (dir.length === 1 ||
      (isWindows && dir.length <= 3 && dir.charAt(1) === ':')) {
    // It is just a slash or a drive letter with a slash
    return dir;
  } else {
    // It is a full dirname, strip trailing slash
    return dir.substring(0, dir.length - 1);
  }
};


exports.basename = function(path, ext) {
  var f = splitPathRe.exec(path)[2] || '';
  // TODO: make this comparison case-insensitive on windows?
  if (ext && f.substr(-1 * ext.length) === ext) {
    f = f.substr(0, f.length - ext.length);
  }
  return f;
};


exports.extname = function(path) {
  return splitPathRe.exec(path)[3] || '';
};

});

require.define("__browserify_process",function(require,module,exports,__dirname,__filename,process,global){var process = module.exports = {};

process.nextTick = (function () {
    var canSetImmediate = typeof window !== 'undefined'
        && window.setImmediate;
    var canPost = typeof window !== 'undefined'
        && window.postMessage && window.addEventListener
    ;

    if (canSetImmediate) {
        return function (f) { return window.setImmediate(f) };
    }

    if (canPost) {
        var queue = [];
        window.addEventListener('message', function (ev) {
            if (ev.source === window && ev.data === 'browserify-tick') {
                ev.stopPropagation();
                if (queue.length > 0) {
                    var fn = queue.shift();
                    fn();
                }
            }
        }, true);

        return function nextTick(fn) {
            queue.push(fn);
            window.postMessage('browserify-tick', '*');
        };
    }

    return function nextTick(fn) {
        setTimeout(fn, 0);
    };
})();

process.title = 'browser';
process.browser = true;
process.env = {};
process.argv = [];

process.binding = function (name) {
    if (name === 'evals') return (require)('vm')
    else throw new Error('No such module. (Possibly not yet loaded)')
};

(function () {
    var cwd = '/';
    var path;
    process.cwd = function () { return cwd };
    process.chdir = function (dir) {
        if (!path) path = require('path');
        cwd = path.resolve(dir, cwd);
    };
})();

});

require.define("/code/coffee/directives/ocAutosize.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var __slice = [].slice;

  app.directive("ocAutosize", function($parse) {
    return {
      require: "?ngModel",
      restrict: "A",
      link: function(scope, element, attrs, controller) {
        var prev, render;
        render = function(value) {
          return element.autosize();
        };
        if (controller != null) {
          prev = controller.$render;
          return controller.$render = function() {
            prev.apply.apply(prev, [controller].concat(__slice.call(arguments)));
            render(controller.$viewValue);
            return controller.$viewValue;
          };
        }
      }
    };
  });

}).call(this);

});

require.define("/code/coffee/lib/inspector.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {

  $(function() {
    if (typeof forge !== "undefined" && forge !== null) {
      forge.internal.call("inspector.list", {}, (function(methods) {
        var apimethod, method, module, modules, parts;
        modules = {};
        for (method in methods) {
          parts = method.split(".");
          apimethod = parts.pop();
          module = parts.join(".");
          if (!modules[module]) {
            modules[module] = {};
          }
          modules[module][apimethod] = methods[method];
        }
        for (module in modules) {
          $("#_module").append("<option>" + module + "</option>");
        }
        $("#_module").change(function() {
          methods = modules[$(this).val()];
          $("#_method").html("");
          for (method in methods) {
            $("#_method").append("<option>" + method + "</option>");
          }
          return $("#_method").change();
        });
        $("#_module").change();
        $("#_method").change(function() {
          var param, params, _results;
          module = $("#_module").val();
          method = $(this).val();
          params = modules[module][method];
          $(".api_input").detach();
          _results = [];
          for (param in params) {
            _results.push($("#_actions").before("<div class=\"control-group api_input\"><label class=\"control-label\" for=\"" + param + "\">" + param + "</label><div class=\"controls\"><input type=\"text\" class=\"input-xlarge\" id=\"" + param + "\"></div></div>"));
          }
          return _results;
        });
        $("#_method").change();
        return $("#_run").click(function() {
          var params;
          module = $("#_module").val();
          method = $("#_method").val();
          params = {};
          $(".api_input input").each(function(i, x) {
            var convert;
            convert = +$(x).val();
            if (isNaN(convert)) {
              return params[$(x).attr("id")] = $(x).val();
            } else {
              return params[$(x).attr("id")] = convert;
            }
          });
          $("#_output").prepend("<pre class=\"alert alert-info\">Called \"" + module + "." + method + "\" with \"" + JSON.stringify(params, null, "") + "\"</pre>");
          return typeof forge !== "undefined" && forge !== null ? forge.internal.call(module + "." + method, params, (function() {
            return $("#_output").prepend("<pre class=\"alert alert-success\">Success for \"" + module + "." + method + "\" with \"" + JSON.stringify(arguments[0], null, "") + "\"</pre>");
          }), function() {
            return $("#_output").prepend("<pre class=\"alert alert-error\">Error for \"" + module + "." + method + "\" with \"" + JSON.stringify(arguments[0], null, "") + "\"</pre>");
          }) : void 0;
        });
      }), function() {
        return alert("Error");
      });
    }
    return typeof forge !== "undefined" && forge !== null ? forge.internal.addEventListener("*", function(event, e) {
      if (event === "inspector.eventTriggered") {
        return $("#_output").prepend("<pre class=\"alert alert-warning\">Native event triggered \"" + e.name + "\"</pre>");
      } else if (event === "inspector.eventInvoked") {
        if (e["class"] === "ForgeEventListener") {
          return $("#_output").prepend("<pre class=\"alert alert-warning\">Default event listener for \"" + e.name + "\" called</pre>");
        } else {
          return $("#_output").prepend("<pre class=\"alert alert-warning\">Calling event listener \"" + e.name + "\" in class \"" + e["class"] + "\"</pre>");
        }
      } else {
        return $("#_output").prepend("<pre class=\"alert alert-warning\">Javascript event \"" + event + "\" triggered with data \"" + JSON.stringify(e) + "\"</pre>");
      }
    }) : void 0;
  });

}).call(this);

});

require.define("/code/coffee/controller/home.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var HomeCtrl, Kinvey, StarIO, async, itemCol, itemFormat, priceCol, qtyCol, sprintf;

  Kinvey = require("../lib/kinvey");

  StarIO = require("../forge/stario");

  async = require("async");

  sprintf = require("sprintf");

  sprintf = sprintf.vsprintf;

  itemCol = 21;

  qtyCol = 4;

  priceCol = 7;

  itemFormat = "%-" + itemCol + "s %" + qtyCol + "s %" + priceCol + "s";

  HomeCtrl = (function() {

    HomeCtrl.prototype.commit = function(entity, cb) {
      entity.set("printed", "yes");
      return entity.save({
        success: function() {
          return typeof cb === "function" ? cb() : void 0;
        },
        error: function(e) {
          return typeof cb === "function" ? cb(e) : void 0;
        }
      });
    };

    HomeCtrl.prototype.getItemInfo = function(item, qty, price) {
      var i, info, itemLine, items, len, nl, nline, numlines, priceLine, qtyLine, string, string2, words, _i, _j, _k, _l, _len, _len1;
      items = item.split(",");
      item = "";
      for (nline = _i = 0, _len = items.length; _i < _len; nline = ++_i) {
        string = items[nline];
        words = string.split(":");
        for (_j = 0, _len1 = words.length; _j < _len1; _j++) {
          string2 = words[_j];
          len = string2.length;
          nl = Math.ceil(len / itemCol);
          for (i = _k = 0; 0 <= nl ? _k < nl : _k > nl; i = 0 <= nl ? ++_k : --_k) {
            if (nline === 0) {
              item += sprintf("%-" + itemCol + "s", [string2.substr(i * itemCol, itemCol)]);
            } else {
              item += sprintf("%-" + itemCol + "s", [string2.substr(i * itemCol, itemCol)]);
            }
          }
        }
      }
      info = "";
      numlines = Math.ceil(Math.max(item.length / itemCol, qty.length / qtyCol, price.length / priceCol));
      for (i = _l = 0; 0 <= numlines ? _l < numlines : _l > numlines; i = 0 <= numlines ? ++_l : --_l) {
        itemLine = item.substr(i * itemCol, itemCol);
        qtyLine = qty.substr(i * qtyCol, qtyCol);
        priceLine = price.substr(i * priceCol, priceCol);
        info += sprintf(itemFormat, [itemLine, qtyLine, priceLine]);
        if (i !== numlines - 1) {
          info += "\n";
        }
      }
      return info;
    };

    HomeCtrl.prototype.getItemsInfo = function(items) {
      var info, item, _i, _len;
      info = "";
      for (_i = 0, _len = items.length; _i < _len; _i++) {
        item = items[_i];
        info += this.getItemInfo("" + item.name + ", " + item.desc, "" + item.qty, "" + ((+item.price).toFixed(2)));
      }
      return info;
    };

    HomeCtrl.prototype.constructReceipt = function(entity) {
      var fund, itemHead, itemInfo, subtotalLine, taxLine, text, totalLine;
      if (entity.paid === "yes") {
        fund = "" + entity.fundSourceType + " " + entity.lastFourDigits;
      } else {
        fund = "Not Paid";
      }
      itemHead = sprintf(itemFormat, ["Items", "Qty", "Price"]);
      itemInfo = this.getItemsInfo(entity.items);
      subtotalLine = sprintf(itemFormat, ["Subtotal", "", "" + ((+entity.subtotal).toFixed(2))]);
      taxLine = sprintf(itemFormat, ["Tax", "", "" + ((+entity.tax).toFixed(2))]);
      totalLine = sprintf(itemFormat, ["Total", "", "" + ((+entity.total).toFixed(2))]);
      text = "" + entity.to.name + "\n" + entity.to.streetAddress + ", " + entity.to.city + ", " + entity.to.state + ", " + entity.to.zipcode + "\n\nID: " + entity._id + "\nOrdered: " + entity.orderedAt + "\n----------------------------------\n" + itemHead + "\n----------------------------------\n" + itemInfo + "\n----------------------------------\n" + subtotalLine + "\n" + taxLine + "\n----------------------------------\n" + totalLine + "\n----------------------------------\nOrder Information\nPaid: " + fund + "\nPick up: " + entity.pickupAt + "\nCustomer name: " + entity.from.name + "\n\nPowered by OrderCrunch";
      return text;
    };

    HomeCtrl.prototype.print = function(entity, cb) {
      var text,
        _this = this;
      text = this.constructReceipt(entity.toJSON(true));
      this.show(text);
      return StarIO.printReceipt(text, function(err) {
        if (!(err != null)) {
          return _this.commit(entity, function() {
            return typeof cb === "function" ? cb() : void 0;
          });
        } else {
          return typeof cb === "function" ? cb() : void 0;
        }
      });
    };

    HomeCtrl.prototype.show = function(text) {
      this.scope.list.splice(0, 0, text);
      if (!this.scope.$$phase) {
        return this.scope.$apply();
      }
    };

    HomeCtrl.prototype.find = function(cb) {
      var orders, q,
        _this = this;
      q = new Kinvey.Query();
      q.on("paid").equal("yes");
      q.on("printed").notEqual("yes");
      q.on("pickupUnix").sort(Kinvey.Query.ASC);
      orders = new Kinvey.Collection("orders", {
        query: q
      });
      return orders.fetch({
        success: function(list) {
          _this.scope.list = [];
          return async.forEachSeries(list, function(entity, cb) {
            return _this.print(entity, cb);
          }, function() {
            return typeof cb === "function" ? cb() : void 0;
          });
        },
        error: function(e) {
          return typeof cb === "function" ? cb(e) : void 0;
        }
      });
    };

    function HomeCtrl(scope) {
      var q,
        _this = this;
      this.scope = scope;
      $.extend(this.scope, this);
      StarIO.startHeartbeat(15000);
      q = async.queue(function(task, cb) {
        return _this.find(cb);
      }, 1);
      StarIO.on("stario.heartbeat", function() {
        StarIO.checkStatus(function(err, status) {
          if (!(err != null)) {
            _this.scope.status = status.status;
          }
          if (!_this.scope.$$phase) {
            return _this.scope.$apply();
          }
        });
        return q.push({});
      });
    }

    return HomeCtrl;

  })();

  HomeCtrl.$inject = ["$scope"];

  app.controller("HomeCtrl", HomeCtrl);

}).call(this);

});

require.define("/code/coffee/lib/kinvey.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {

  Kinvey.init({
    appKey: "kid_TVtkHjI09f",
    appSecret: "d4e76bc9de1b4dd0ba6c2d4f0288de2d"
  });

  Kinvey.User.prototype.me = function(options) {
    var url;
    url = this.store._getUrl({
      id: '_me'
    });
    return this.store._send('GET', url, null, options);
  };

  module.exports = Kinvey;

}).call(this);

});

require.define("/code/coffee/forge/stario.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var EventEmitter, StarIO, events,
    __hasProp = {}.hasOwnProperty,
    __extends = function(child, parent) { for (var key in parent) { if (__hasProp.call(parent, key)) child[key] = parent[key]; } function ctor() { this.constructor = child; } ctor.prototype = parent.prototype; child.prototype = new ctor(); child.__super__ = parent.prototype; return child; };

  events = require("events");

  EventEmitter = events.EventEmitter;

  StarIO = (function(_super) {

    __extends(StarIO, _super);

    StarIO.prototype.saveUserDetails = function(username, password, cb) {
      if (!(typeof forge !== "undefined" && forge !== null)) {
        localStorage.setItem("username", username);
        localStorage.setItem("password", password);
        if (typeof cb === "function") {
          cb();
        }
        return;
      }
      return typeof forge !== "undefined" && forge !== null ? forge.internal.call("stario.saveUserDetails", {
        username: username,
        password: password
      }, function() {
        return typeof cb === "function" ? cb(null) : void 0;
      }, function(e) {
        return typeof cb === "function" ? cb("error", e) : void 0;
      }) : void 0;
    };

    StarIO.prototype.getUserDetails = function(cb) {
      var password, result, username;
      if (!(typeof forge !== "undefined" && forge !== null)) {
        username = localStorage.getItem("username");
        password = localStorage.getItem("password");
        result = {
          username: username,
          password: password
        };
        if (typeof cb === "function") {
          cb(null, result);
        }
        return;
      }
      return typeof forge !== "undefined" && forge !== null ? forge.internal.call("stario.getUserDetails", {}, function(result) {
        return typeof cb === "function" ? cb(null, result) : void 0;
      }, function(e) {
        return typeof cb === "function" ? cb("error", e) : void 0;
      }) : void 0;
    };

    StarIO.prototype.checkStatus = function(cb) {
      if (!(typeof forge !== "undefined" && forge !== null)) {
        if (typeof cb === "function") {
          cb("error");
        }
        return;
      }
      return typeof forge !== "undefined" && forge !== null ? forge.internal.call("stario.checkStatus", {}, function(status) {
        return typeof cb === "function" ? cb(null, status) : void 0;
      }, function(e) {
        return typeof cb === "function" ? cb("error", e) : void 0;
      }) : void 0;
    };

    StarIO.prototype.printReceipt = function(text, cb) {
      if (!(typeof forge !== "undefined" && forge !== null)) {
        if (typeof cb === "function") {
          cb("error");
        }
        return;
      }
      return typeof forge !== "undefined" && forge !== null ? forge.internal.call("stario.printReceipt", {
        text: text
      }, function() {
        return typeof cb === "function" ? cb(null) : void 0;
      }, function(e) {
        return typeof cb === "function" ? cb("error", e) : void 0;
      }) : void 0;
    };

    StarIO.prototype.startHeartbeat = function(interval, cb) {
      if (!(typeof forge !== "undefined" && forge !== null)) {
        if (typeof cb === "function") {
          cb("error");
        }
        return;
      }
      return typeof forge !== "undefined" && forge !== null ? forge.internal.call("stario.startHeartbeat", {
        interval: interval
      }, function() {
        return typeof cb === "function" ? cb(null) : void 0;
      }, function(e) {
        return typeof cb === "function" ? cb("error", e) : void 0;
      }) : void 0;
    };

    StarIO.prototype.stopHeartbeat = function(text, cb) {
      if (!(typeof forge !== "undefined" && forge !== null)) {
        if (typeof cb === "function") {
          cb("error");
        }
        return;
      }
      return typeof forge !== "undefined" && forge !== null ? forge.internal.call("stario.stopHeartbeat", {}, function() {
        return typeof cb === "function" ? cb(null) : void 0;
      }, function(e) {
        return typeof cb === "function" ? cb("error", e) : void 0;
      }) : void 0;
    };

    function StarIO() {
      var _this = this;
      this.startHeartbeat(5000, function() {});
      if (typeof forge !== "undefined" && forge !== null) {
        forge.internal.addEventListener("stario.heartbeat", function(event, e) {
          _this.checkStatus(function() {});
          return _this.emit("stario.heartbeat");
        });
      }
    }

    return StarIO;

  })(EventEmitter);

  module.exports = new StarIO();

}).call(this);

});

require.define("events",function(require,module,exports,__dirname,__filename,process,global){if (!process.EventEmitter) process.EventEmitter = function () {};

var EventEmitter = exports.EventEmitter = process.EventEmitter;
var isArray = typeof Array.isArray === 'function'
    ? Array.isArray
    : function (xs) {
        return Object.prototype.toString.call(xs) === '[object Array]'
    }
;
function indexOf (xs, x) {
    if (xs.indexOf) return xs.indexOf(x);
    for (var i = 0; i < xs.length; i++) {
        if (x === xs[i]) return i;
    }
    return -1;
}

// By default EventEmitters will print a warning if more than
// 10 listeners are added to it. This is a useful default which
// helps finding memory leaks.
//
// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
var defaultMaxListeners = 10;
EventEmitter.prototype.setMaxListeners = function(n) {
  if (!this._events) this._events = {};
  this._events.maxListeners = n;
};


EventEmitter.prototype.emit = function(type) {
  // If there is no 'error' event listener then throw.
  if (type === 'error') {
    if (!this._events || !this._events.error ||
        (isArray(this._events.error) && !this._events.error.length))
    {
      if (arguments[1] instanceof Error) {
        throw arguments[1]; // Unhandled 'error' event
      } else {
        throw new Error("Uncaught, unspecified 'error' event.");
      }
      return false;
    }
  }

  if (!this._events) return false;
  var handler = this._events[type];
  if (!handler) return false;

  if (typeof handler == 'function') {
    switch (arguments.length) {
      // fast cases
      case 1:
        handler.call(this);
        break;
      case 2:
        handler.call(this, arguments[1]);
        break;
      case 3:
        handler.call(this, arguments[1], arguments[2]);
        break;
      // slower
      default:
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(this, args);
    }
    return true;

  } else if (isArray(handler)) {
    var args = Array.prototype.slice.call(arguments, 1);

    var listeners = handler.slice();
    for (var i = 0, l = listeners.length; i < l; i++) {
      listeners[i].apply(this, args);
    }
    return true;

  } else {
    return false;
  }
};

// EventEmitter is defined in src/node_events.cc
// EventEmitter.prototype.emit() is also defined there.
EventEmitter.prototype.addListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('addListener only takes instances of Function');
  }

  if (!this._events) this._events = {};

  // To avoid recursion in the case that type == "newListeners"! Before
  // adding it to the listeners, first emit "newListeners".
  this.emit('newListener', type, listener);

  if (!this._events[type]) {
    // Optimize the case of one listener. Don't need the extra array object.
    this._events[type] = listener;
  } else if (isArray(this._events[type])) {

    // Check for listener leak
    if (!this._events[type].warned) {
      var m;
      if (this._events.maxListeners !== undefined) {
        m = this._events.maxListeners;
      } else {
        m = defaultMaxListeners;
      }

      if (m && m > 0 && this._events[type].length > m) {
        this._events[type].warned = true;
        console.error('(node) warning: possible EventEmitter memory ' +
                      'leak detected. %d listeners added. ' +
                      'Use emitter.setMaxListeners() to increase limit.',
                      this._events[type].length);
        console.trace();
      }
    }

    // If we've already got an array, just append.
    this._events[type].push(listener);
  } else {
    // Adding the second element, need to change to array.
    this._events[type] = [this._events[type], listener];
  }

  return this;
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.once = function(type, listener) {
  var self = this;
  self.on(type, function g() {
    self.removeListener(type, g);
    listener.apply(this, arguments);
  });

  return this;
};

EventEmitter.prototype.removeListener = function(type, listener) {
  if ('function' !== typeof listener) {
    throw new Error('removeListener only takes instances of Function');
  }

  // does not use listeners(), so no side effect of creating _events[type]
  if (!this._events || !this._events[type]) return this;

  var list = this._events[type];

  if (isArray(list)) {
    var i = indexOf(list, listener);
    if (i < 0) return this;
    list.splice(i, 1);
    if (list.length == 0)
      delete this._events[type];
  } else if (this._events[type] === listener) {
    delete this._events[type];
  }

  return this;
};

EventEmitter.prototype.removeAllListeners = function(type) {
  // does not use listeners(), so no side effect of creating _events[type]
  if (type && this._events && this._events[type]) this._events[type] = null;
  return this;
};

EventEmitter.prototype.listeners = function(type) {
  if (!this._events) this._events = {};
  if (!this._events[type]) this._events[type] = [];
  if (!isArray(this._events[type])) {
    this._events[type] = [this._events[type]];
  }
  return this._events[type];
};

});

require.define("/node_modules/async/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./index"}
});

require.define("/node_modules/async/index.js",function(require,module,exports,__dirname,__filename,process,global){// This file is just added for convenience so this repository can be
// directly checked out into a project's deps folder
module.exports = require('./lib/async');

});

require.define("/node_modules/async/lib/async.js",function(require,module,exports,__dirname,__filename,process,global){/*global setTimeout: false, console: false */
(function () {

    var async = {};

    // global on the server, window in the browser
    var root = this,
        previous_async = root.async;

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = async;
    }
    else {
        root.async = async;
    }

    async.noConflict = function () {
        root.async = previous_async;
        return async;
    };

    //// cross-browser compatiblity functions ////

    var _forEach = function (arr, iterator) {
        if (arr.forEach) {
            return arr.forEach(iterator);
        }
        for (var i = 0; i < arr.length; i += 1) {
            iterator(arr[i], i, arr);
        }
    };

    var _map = function (arr, iterator) {
        if (arr.map) {
            return arr.map(iterator);
        }
        var results = [];
        _forEach(arr, function (x, i, a) {
            results.push(iterator(x, i, a));
        });
        return results;
    };

    var _reduce = function (arr, iterator, memo) {
        if (arr.reduce) {
            return arr.reduce(iterator, memo);
        }
        _forEach(arr, function (x, i, a) {
            memo = iterator(memo, x, i, a);
        });
        return memo;
    };

    var _keys = function (obj) {
        if (Object.keys) {
            return Object.keys(obj);
        }
        var keys = [];
        for (var k in obj) {
            if (obj.hasOwnProperty(k)) {
                keys.push(k);
            }
        }
        return keys;
    };

    //// exported async module functions ////

    //// nextTick implementation with browser-compatible fallback ////
    if (typeof process === 'undefined' || !(process.nextTick)) {
        async.nextTick = function (fn) {
            setTimeout(fn, 0);
        };
    }
    else {
        async.nextTick = process.nextTick;
    }

    async.forEach = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        _forEach(arr, function (x) {
            iterator(x, function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed === arr.length) {
                        callback(null);
                    }
                }
            });
        });
    };

    async.forEachSeries = function (arr, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length) {
            return callback();
        }
        var completed = 0;
        var iterate = function () {
            iterator(arr[completed], function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    completed += 1;
                    if (completed === arr.length) {
                        callback(null);
                    }
                    else {
                        iterate();
                    }
                }
            });
        };
        iterate();
    };

    async.forEachLimit = function (arr, limit, iterator, callback) {
        callback = callback || function () {};
        if (!arr.length || limit <= 0) {
            return callback();
        }
        var completed = 0;
        var started = 0;
        var running = 0;

        (function replenish () {
            if (completed === arr.length) {
                return callback();
            }

            while (running < limit && started < arr.length) {
                started += 1;
                running += 1;
                iterator(arr[started - 1], function (err) {
                    if (err) {
                        callback(err);
                        callback = function () {};
                    }
                    else {
                        completed += 1;
                        running -= 1;
                        if (completed === arr.length) {
                            callback();
                        }
                        else {
                            replenish();
                        }
                    }
                });
            }
        })();
    };


    var doParallel = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.forEach].concat(args));
        };
    };
    var doSeries = function (fn) {
        return function () {
            var args = Array.prototype.slice.call(arguments);
            return fn.apply(null, [async.forEachSeries].concat(args));
        };
    };


    var _asyncMap = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (err, v) {
                results[x.index] = v;
                callback(err);
            });
        }, function (err) {
            callback(err, results);
        });
    };
    async.map = doParallel(_asyncMap);
    async.mapSeries = doSeries(_asyncMap);


    // reduce only has a series version, as doing reduce in parallel won't
    // work in many situations.
    async.reduce = function (arr, memo, iterator, callback) {
        async.forEachSeries(arr, function (x, callback) {
            iterator(memo, x, function (err, v) {
                memo = v;
                callback(err);
            });
        }, function (err) {
            callback(err, memo);
        });
    };
    // inject alias
    async.inject = async.reduce;
    // foldl alias
    async.foldl = async.reduce;

    async.reduceRight = function (arr, memo, iterator, callback) {
        var reversed = _map(arr, function (x) {
            return x;
        }).reverse();
        async.reduce(reversed, memo, iterator, callback);
    };
    // foldr alias
    async.foldr = async.reduceRight;

    var _filter = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.filter = doParallel(_filter);
    async.filterSeries = doSeries(_filter);
    // select alias
    async.select = async.filter;
    async.selectSeries = async.filterSeries;

    var _reject = function (eachfn, arr, iterator, callback) {
        var results = [];
        arr = _map(arr, function (x, i) {
            return {index: i, value: x};
        });
        eachfn(arr, function (x, callback) {
            iterator(x.value, function (v) {
                if (!v) {
                    results.push(x);
                }
                callback();
            });
        }, function (err) {
            callback(_map(results.sort(function (a, b) {
                return a.index - b.index;
            }), function (x) {
                return x.value;
            }));
        });
    };
    async.reject = doParallel(_reject);
    async.rejectSeries = doSeries(_reject);

    var _detect = function (eachfn, arr, iterator, main_callback) {
        eachfn(arr, function (x, callback) {
            iterator(x, function (result) {
                if (result) {
                    main_callback(x);
                    main_callback = function () {};
                }
                else {
                    callback();
                }
            });
        }, function (err) {
            main_callback();
        });
    };
    async.detect = doParallel(_detect);
    async.detectSeries = doSeries(_detect);

    async.some = function (arr, iterator, main_callback) {
        async.forEach(arr, function (x, callback) {
            iterator(x, function (v) {
                if (v) {
                    main_callback(true);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(false);
        });
    };
    // any alias
    async.any = async.some;

    async.every = function (arr, iterator, main_callback) {
        async.forEach(arr, function (x, callback) {
            iterator(x, function (v) {
                if (!v) {
                    main_callback(false);
                    main_callback = function () {};
                }
                callback();
            });
        }, function (err) {
            main_callback(true);
        });
    };
    // all alias
    async.all = async.every;

    async.sortBy = function (arr, iterator, callback) {
        async.map(arr, function (x, callback) {
            iterator(x, function (err, criteria) {
                if (err) {
                    callback(err);
                }
                else {
                    callback(null, {value: x, criteria: criteria});
                }
            });
        }, function (err, results) {
            if (err) {
                return callback(err);
            }
            else {
                var fn = function (left, right) {
                    var a = left.criteria, b = right.criteria;
                    return a < b ? -1 : a > b ? 1 : 0;
                };
                callback(null, _map(results.sort(fn), function (x) {
                    return x.value;
                }));
            }
        });
    };

    async.auto = function (tasks, callback) {
        callback = callback || function () {};
        var keys = _keys(tasks);
        if (!keys.length) {
            return callback(null);
        }

        var results = {};

        var listeners = [];
        var addListener = function (fn) {
            listeners.unshift(fn);
        };
        var removeListener = function (fn) {
            for (var i = 0; i < listeners.length; i += 1) {
                if (listeners[i] === fn) {
                    listeners.splice(i, 1);
                    return;
                }
            }
        };
        var taskComplete = function () {
            _forEach(listeners.slice(0), function (fn) {
                fn();
            });
        };

        addListener(function () {
            if (_keys(results).length === keys.length) {
                callback(null, results);
                callback = function () {};
            }
        });

        _forEach(keys, function (k) {
            var task = (tasks[k] instanceof Function) ? [tasks[k]]: tasks[k];
            var taskCallback = function (err) {
                if (err) {
                    callback(err);
                    // stop subsequent errors hitting callback multiple times
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    taskComplete();
                }
            };
            var requires = task.slice(0, Math.abs(task.length - 1)) || [];
            var ready = function () {
                return _reduce(requires, function (a, x) {
                    return (a && results.hasOwnProperty(x));
                }, true) && !results.hasOwnProperty(k);
            };
            if (ready()) {
                task[task.length - 1](taskCallback, results);
            }
            else {
                var listener = function () {
                    if (ready()) {
                        removeListener(listener);
                        task[task.length - 1](taskCallback, results);
                    }
                };
                addListener(listener);
            }
        });
    };

    async.waterfall = function (tasks, callback) {
        callback = callback || function () {};
        if (!tasks.length) {
            return callback();
        }
        var wrapIterator = function (iterator) {
            return function (err) {
                if (err) {
                    callback(err);
                    callback = function () {};
                }
                else {
                    var args = Array.prototype.slice.call(arguments, 1);
                    var next = iterator.next();
                    if (next) {
                        args.push(wrapIterator(next));
                    }
                    else {
                        args.push(callback);
                    }
                    async.nextTick(function () {
                        iterator.apply(null, args);
                    });
                }
            };
        };
        wrapIterator(async.iterator(tasks))();
    };

    async.parallel = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.map(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.forEach(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.series = function (tasks, callback) {
        callback = callback || function () {};
        if (tasks.constructor === Array) {
            async.mapSeries(tasks, function (fn, callback) {
                if (fn) {
                    fn(function (err) {
                        var args = Array.prototype.slice.call(arguments, 1);
                        if (args.length <= 1) {
                            args = args[0];
                        }
                        callback.call(null, err, args);
                    });
                }
            }, callback);
        }
        else {
            var results = {};
            async.forEachSeries(_keys(tasks), function (k, callback) {
                tasks[k](function (err) {
                    var args = Array.prototype.slice.call(arguments, 1);
                    if (args.length <= 1) {
                        args = args[0];
                    }
                    results[k] = args;
                    callback(err);
                });
            }, function (err) {
                callback(err, results);
            });
        }
    };

    async.iterator = function (tasks) {
        var makeCallback = function (index) {
            var fn = function () {
                if (tasks.length) {
                    tasks[index].apply(null, arguments);
                }
                return fn.next();
            };
            fn.next = function () {
                return (index < tasks.length - 1) ? makeCallback(index + 1): null;
            };
            return fn;
        };
        return makeCallback(0);
    };

    async.apply = function (fn) {
        var args = Array.prototype.slice.call(arguments, 1);
        return function () {
            return fn.apply(
                null, args.concat(Array.prototype.slice.call(arguments))
            );
        };
    };

    var _concat = function (eachfn, arr, fn, callback) {
        var r = [];
        eachfn(arr, function (x, cb) {
            fn(x, function (err, y) {
                r = r.concat(y || []);
                cb(err);
            });
        }, function (err) {
            callback(err, r);
        });
    };
    async.concat = doParallel(_concat);
    async.concatSeries = doSeries(_concat);

    async.whilst = function (test, iterator, callback) {
        if (test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.whilst(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.until = function (test, iterator, callback) {
        if (!test()) {
            iterator(function (err) {
                if (err) {
                    return callback(err);
                }
                async.until(test, iterator, callback);
            });
        }
        else {
            callback();
        }
    };

    async.queue = function (worker, concurrency) {
        var workers = 0;
        var q = {
            tasks: [],
            concurrency: concurrency,
            saturated: null,
            empty: null,
            drain: null,
            push: function (data, callback) {
                if(data.constructor !== Array) {
                    data = [data];
                }
                _forEach(data, function(task) {
                    q.tasks.push({
                        data: task,
                        callback: typeof callback === 'function' ? callback : null
                    });
                    if (q.saturated && q.tasks.length == concurrency) {
                        q.saturated();
                    }
                    async.nextTick(q.process);
                });
            },
            process: function () {
                if (workers < q.concurrency && q.tasks.length) {
                    var task = q.tasks.shift();
                    if(q.empty && q.tasks.length == 0) q.empty();
                    workers += 1;
                    worker(task.data, function () {
                        workers -= 1;
                        if (task.callback) {
                            task.callback.apply(task, arguments);
                        }
                        if(q.drain && q.tasks.length + workers == 0) q.drain();
                        q.process();
                    });
                }
            },
            length: function () {
                return q.tasks.length;
            },
            running: function () {
                return workers;
            }
        };
        return q;
    };

    var _console_fn = function (name) {
        return function (fn) {
            var args = Array.prototype.slice.call(arguments, 1);
            fn.apply(null, args.concat([function (err) {
                var args = Array.prototype.slice.call(arguments, 1);
                if (typeof console !== 'undefined') {
                    if (err) {
                        if (console.error) {
                            console.error(err);
                        }
                    }
                    else if (console[name]) {
                        _forEach(args, function (x) {
                            console[name](x);
                        });
                    }
                }
            }]));
        };
    };
    async.log = _console_fn('log');
    async.dir = _console_fn('dir');
    /*async.info = _console_fn('info');
    async.warn = _console_fn('warn');
    async.error = _console_fn('error');*/

    async.memoize = function (fn, hasher) {
        var memo = {};
        var queues = {};
        hasher = hasher || function (x) {
            return x;
        };
        var memoized = function () {
            var args = Array.prototype.slice.call(arguments);
            var callback = args.pop();
            var key = hasher.apply(null, args);
            if (key in memo) {
                callback.apply(null, memo[key]);
            }
            else if (key in queues) {
                queues[key].push(callback);
            }
            else {
                queues[key] = [callback];
                fn.apply(null, args.concat([function () {
                    memo[key] = arguments;
                    var q = queues[key];
                    delete queues[key];
                    for (var i = 0, l = q.length; i < l; i++) {
                      q[i].apply(null, arguments);
                    }
                }]));
            }
        };
        memoized.unmemoized = fn;
        return memoized;
    };

    async.unmemoize = function (fn) {
      return function () {
        return (fn.unmemoized || fn).apply(null, arguments);
      };
    };

}());

});

require.define("/node_modules/sprintf/package.json",function(require,module,exports,__dirname,__filename,process,global){module.exports = {"main":"./lib/sprintf"}
});

require.define("/node_modules/sprintf/lib/sprintf.js",function(require,module,exports,__dirname,__filename,process,global){/**
sprintf() for JavaScript 0.7-beta1
http://www.diveintojavascript.com/projects/javascript-sprintf

Copyright (c) Alexandru Marasteanu <alexaholic [at) gmail (dot] com>
All rights reserved.

Redistribution and use in source and binary forms, with or without
modification, are permitted provided that the following conditions are met:
    * Redistributions of source code must retain the above copyright
      notice, this list of conditions and the following disclaimer.
    * Redistributions in binary form must reproduce the above copyright
      notice, this list of conditions and the following disclaimer in the
      documentation and/or other materials provided with the distribution.
    * Neither the name of sprintf() for JavaScript nor the
      names of its contributors may be used to endorse or promote products
      derived from this software without specific prior written permission.

THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS" AND
ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
DISCLAIMED. IN NO EVENT SHALL Alexandru Marasteanu BE LIABLE FOR ANY
DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
(INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
(INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF THIS
SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.


Changelog:
2010.11.07 - 0.7-beta1-node
  - converted it to a node.js compatible module

2010.09.06 - 0.7-beta1
  - features: vsprintf, support for named placeholders
  - enhancements: format cache, reduced global namespace pollution

2010.05.22 - 0.6:
 - reverted to 0.4 and fixed the bug regarding the sign of the number 0
 Note:
 Thanks to Raphael Pigulla <raph (at] n3rd [dot) org> (http://www.n3rd.org/)
 who warned me about a bug in 0.5, I discovered that the last update was
 a regress. I appologize for that.

2010.05.09 - 0.5:
 - bug fix: 0 is now preceeded with a + sign
 - bug fix: the sign was not at the right position on padded results (Kamal Abdali)
 - switched from GPL to BSD license

2007.10.21 - 0.4:
 - unit test and patch (David Baird)

2007.09.17 - 0.3:
 - bug fix: no longer throws exception on empty paramenters (Hans Pufal)

2007.09.11 - 0.2:
 - feature: added argument swapping

2007.04.03 - 0.1:
 - initial release
**/

var sprintf = (function() {
	function get_type(variable) {
		return Object.prototype.toString.call(variable).slice(8, -1).toLowerCase();
	}
	function str_repeat(input, multiplier) {
		for (var output = []; multiplier > 0; output[--multiplier] = input) {/* do nothing */}
		return output.join('');
	}

	var str_format = function() {
		if (!str_format.cache.hasOwnProperty(arguments[0])) {
			str_format.cache[arguments[0]] = str_format.parse(arguments[0]);
		}
		return str_format.format.call(null, str_format.cache[arguments[0]], arguments);
	};

	str_format.format = function(parse_tree, argv) {
		var cursor = 1, tree_length = parse_tree.length, node_type = '', arg, output = [], i, k, match, pad, pad_character, pad_length;
		for (i = 0; i < tree_length; i++) {
			node_type = get_type(parse_tree[i]);
			if (node_type === 'string') {
				output.push(parse_tree[i]);
			}
			else if (node_type === 'array') {
				match = parse_tree[i]; // convenience purposes only
				if (match[2]) { // keyword argument
					arg = argv[cursor];
					for (k = 0; k < match[2].length; k++) {
						if (!arg.hasOwnProperty(match[2][k])) {
							throw(sprintf('[sprintf] property "%s" does not exist', match[2][k]));
						}
						arg = arg[match[2][k]];
					}
				}
				else if (match[1]) { // positional argument (explicit)
					arg = argv[match[1]];
				}
				else { // positional argument (implicit)
					arg = argv[cursor++];
				}

				if (/[^s]/.test(match[8]) && (get_type(arg) != 'number')) {
					throw(sprintf('[sprintf] expecting number but found %s', get_type(arg)));
				}
				switch (match[8]) {
					case 'b': arg = arg.toString(2); break;
					case 'c': arg = String.fromCharCode(arg); break;
					case 'd': arg = parseInt(arg, 10); break;
					case 'e': arg = match[7] ? arg.toExponential(match[7]) : arg.toExponential(); break;
					case 'f': arg = match[7] ? parseFloat(arg).toFixed(match[7]) : parseFloat(arg); break;
					case 'o': arg = arg.toString(8); break;
					case 's': arg = ((arg = String(arg)) && match[7] ? arg.substring(0, match[7]) : arg); break;
					case 'u': arg = Math.abs(arg); break;
					case 'x': arg = arg.toString(16); break;
					case 'X': arg = arg.toString(16).toUpperCase(); break;
				}
				arg = (/[def]/.test(match[8]) && match[3] && arg >= 0 ? '+'+ arg : arg);
				pad_character = match[4] ? match[4] == '0' ? '0' : match[4].charAt(1) : ' ';
				pad_length = match[6] - String(arg).length;
				pad = match[6] ? str_repeat(pad_character, pad_length) : '';
				output.push(match[5] ? arg + pad : pad + arg);
			}
		}
		return output.join('');
	};

	str_format.cache = {};

	str_format.parse = function(fmt) {
		var _fmt = fmt, match = [], parse_tree = [], arg_names = 0;
		while (_fmt) {
			if ((match = /^[^\x25]+/.exec(_fmt)) !== null) {
				parse_tree.push(match[0]);
			}
			else if ((match = /^\x25{2}/.exec(_fmt)) !== null) {
				parse_tree.push('%');
			}
			else if ((match = /^\x25(?:([1-9]\d*)\$|\(([^\)]+)\))?(\+)?(0|'[^$])?(-)?(\d+)?(?:\.(\d+))?([b-fosuxX])/.exec(_fmt)) !== null) {
				if (match[2]) {
					arg_names |= 1;
					var field_list = [], replacement_field = match[2], field_match = [];
					if ((field_match = /^([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
						field_list.push(field_match[1]);
						while ((replacement_field = replacement_field.substring(field_match[0].length)) !== '') {
							if ((field_match = /^\.([a-z_][a-z_\d]*)/i.exec(replacement_field)) !== null) {
								field_list.push(field_match[1]);
							}
							else if ((field_match = /^\[(\d+)\]/.exec(replacement_field)) !== null) {
								field_list.push(field_match[1]);
							}
							else {
								throw('[sprintf] huh?');
							}
						}
					}
					else {
						throw('[sprintf] huh?');
					}
					match[2] = field_list;
				}
				else {
					arg_names |= 2;
				}
				if (arg_names === 3) {
					throw('[sprintf] mixing positional and named placeholders is not (yet) supported');
				}
				parse_tree.push(match);
			}
			else {
				throw('[sprintf] huh?');
			}
			_fmt = _fmt.substring(match[0].length);
		}
		return parse_tree;
	};

	return str_format;
})();

var vsprintf = function(fmt, argv) {
	argv.unshift(fmt);
	return sprintf.apply(null, argv);
};

exports.sprintf = sprintf;
exports.vsprintf = vsprintf;
});

require.define("/code/coffee/controller/body.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {
  var BodyCtrl, Kinvey, StarIO,
    __bind = function(fn, me){ return function(){ return fn.apply(me, arguments); }; };

  Kinvey = require("../lib/kinvey");

  StarIO = require("../forge/stario");

  BodyCtrl = (function() {

    function BodyCtrl(scope) {
      var _this = this;
      this.scope = scope;
      this.logout = __bind(this.logout, this);

      this.login = __bind(this.login, this);

      $.extend(this.scope, this);
      this.scope.page = 'login';
      StarIO.getUserDetails(function(err, result) {
        if ((result != null ? result.username : void 0) && (result != null ? result.password : void 0)) {
          _this.scope.username = result.username;
          _this.scope.password = result.password;
          return _this.login();
        }
      });
    }

    BodyCtrl.prototype.login = function() {
      var user,
        _this = this;
      user = new Kinvey.User();
      return user.login(this.scope.username, this.scope.password, {
        success: function() {
          StarIO.saveUserDetails(_this.scope.username, _this.scope.password);
          _this.scope.password = "";
          _this.scope.page = 'home';
          _this.scope.loggedIn = true;
          return _this.scope.$apply();
        },
        error: function() {
          _this.scope.password = "";
          _this.scope.error = "There is an error logging you in. Please try again.";
          return _this.scope.$apply();
        }
      });
    };

    BodyCtrl.prototype.logout = function() {
      StarIO.saveUserDetails("", "");
      this.scope.username = "";
      this.scope.password = "";
      this.scope.page = 'login';
      return this.scope.loggedIn = false;
    };

    return BodyCtrl;

  })();

  BodyCtrl.$inject = ["$scope"];

  app.controller("BodyCtrl", BodyCtrl);

}).call(this);

});

require.define("/code/index.coffee",function(require,module,exports,__dirname,__filename,process,global){(function() {

  window.app = angular.module("app", []);

  require("./coffee/directives/ocAutosize");

  require("./coffee/lib/inspector");

  require("./coffee/controller/home");

  require("./coffee/controller/body");

}).call(this);

});
require("/code/index.coffee");
})();
