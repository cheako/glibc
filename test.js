// The Module object: Our interface to the outside world. We import
// and export values on it, and do the work to get that through
// closure compiler if necessary. There are various ways Module can be used:
// 1. Not defined. We create it here
// 2. A function parameter, function(Module) { ..generated code.. }
// 3. pre-run appended it, var Module = {}; ..generated code..
// 4. External script tag defines var Module.
// We need to do an eval in order to handle the closure compiler
// case, where this code here is minified but Module was defined
// elsewhere (e.g. case 4 above). We also need to check if Module
// already exists (e.g. case 3 above).
// Note that if you want to run closure, and also to use Module
// after the generated code, you will need to define   var Module = {};
// before the code. Then that object will be used in the code, and you
// can continue to use Module afterwards as well.
var Module;
if (!Module) Module = (typeof Module !== 'undefined' ? Module : null) || {};

// Sometimes an existing Module object exists with properties
// meant to overwrite the default module functionality. Here
// we collect those properties and reapply _after_ we configure
// the current environment's defaults to avoid having to be so
// defensive during initialization.
var moduleOverrides = {};
for (var key in Module) {
  if (Module.hasOwnProperty(key)) {
    moduleOverrides[key] = Module[key];
  }
}

// The environment setup code below is customized to use Module.
// *** Environment setup code ***
var ENVIRONMENT_IS_WEB = false;
var ENVIRONMENT_IS_WORKER = false;
var ENVIRONMENT_IS_NODE = false;
var ENVIRONMENT_IS_SHELL = false;

// Three configurations we can be running in:
// 1) We could be the application main() thread running in the main JS UI thread. (ENVIRONMENT_IS_WORKER == false and ENVIRONMENT_IS_PTHREAD == false)
// 2) We could be the application main() thread proxied to worker. (with Emscripten -s PROXY_TO_WORKER=1) (ENVIRONMENT_IS_WORKER == true, ENVIRONMENT_IS_PTHREAD == false)
// 3) We could be an application pthread running in a worker. (ENVIRONMENT_IS_WORKER == true and ENVIRONMENT_IS_PTHREAD == true)

if (Module['ENVIRONMENT']) {
  if (Module['ENVIRONMENT'] === 'WEB') {
    ENVIRONMENT_IS_WEB = true;
  } else if (Module['ENVIRONMENT'] === 'WORKER') {
    ENVIRONMENT_IS_WORKER = true;
  } else if (Module['ENVIRONMENT'] === 'NODE') {
    ENVIRONMENT_IS_NODE = true;
  } else if (Module['ENVIRONMENT'] === 'SHELL') {
    ENVIRONMENT_IS_SHELL = true;
  } else {
    throw new Error('The provided Module[\'ENVIRONMENT\'] value is not valid. It must be one of: WEB|WORKER|NODE|SHELL.');
  }
} else {
  ENVIRONMENT_IS_WEB = typeof window === 'object';
  ENVIRONMENT_IS_WORKER = typeof importScripts === 'function';
  ENVIRONMENT_IS_NODE = typeof process === 'object' && typeof require === 'function' && !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_WORKER;
  ENVIRONMENT_IS_SHELL = !ENVIRONMENT_IS_WEB && !ENVIRONMENT_IS_NODE && !ENVIRONMENT_IS_WORKER;
}


if (ENVIRONMENT_IS_NODE) {
  // Expose functionality in the same simple way that the shells work
  // Note that we pollute the global namespace here, otherwise we break in node
  if (!Module['print']) Module['print'] = console.log;
  if (!Module['printErr']) Module['printErr'] = console.warn;

  var nodeFS;
  var nodePath;

  Module['read'] = function shell_read(filename, binary) {
    if (!nodeFS) nodeFS = require('fs');
    if (!nodePath) nodePath = require('path');
    filename = nodePath['normalize'](filename);
    var ret = nodeFS['readFileSync'](filename);
    return binary ? ret : ret.toString();
  };

  Module['readBinary'] = function readBinary(filename) {
    var ret = Module['read'](filename, true);
    if (!ret.buffer) {
      ret = new Uint8Array(ret);
    }
    assert(ret.buffer);
    return ret;
  };

  Module['load'] = function load(f) {
    globalEval(read(f));
  };

  if (!Module['thisProgram']) {
    if (process['argv'].length > 1) {
      Module['thisProgram'] = process['argv'][1].replace(/\\/g, '/');
    } else {
      Module['thisProgram'] = 'unknown-program';
    }
  }

  Module['arguments'] = process['argv'].slice(2);

  if (typeof module !== 'undefined') {
    module['exports'] = Module;
  }

  process['on']('uncaughtException', function(ex) {
    // suppress ExitStatus exceptions from showing an error
    if (!(ex instanceof ExitStatus)) {
      throw ex;
    }
  });

  Module['inspect'] = function () { return '[Emscripten Module object]'; };
}
else if (ENVIRONMENT_IS_SHELL) {
  if (!Module['print']) Module['print'] = print;
  if (typeof printErr != 'undefined') Module['printErr'] = printErr; // not present in v8 or older sm

  if (typeof read != 'undefined') {
    Module['read'] = read;
  } else {
    Module['read'] = function shell_read() { throw 'no read() available' };
  }

  Module['readBinary'] = function readBinary(f) {
    if (typeof readbuffer === 'function') {
      return new Uint8Array(readbuffer(f));
    }
    var data = read(f, 'binary');
    assert(typeof data === 'object');
    return data;
  };

  if (typeof scriptArgs != 'undefined') {
    Module['arguments'] = scriptArgs;
  } else if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof quit === 'function') {
    Module['quit'] = function(status, toThrow) {
      quit(status);
    }
  }

}
else if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
  Module['read'] = function shell_read(url) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, false);
    xhr.send(null);
    return xhr.responseText;
  };

  if (ENVIRONMENT_IS_WORKER) {
    Module['readBinary'] = function readBinary(url) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, false);
      xhr.responseType = 'arraybuffer';
      xhr.send(null);
      return new Uint8Array(xhr.response);
    };
  }

  Module['readAsync'] = function readAsync(url, onload, onerror) {
    var xhr = new XMLHttpRequest();
    xhr.open('GET', url, true);
    xhr.responseType = 'arraybuffer';
    xhr.onload = function xhr_onload() {
      if (xhr.status == 200 || (xhr.status == 0 && xhr.response)) { // file URLs can return 0
        onload(xhr.response);
      } else {
        onerror();
      }
    };
    xhr.onerror = onerror;
    xhr.send(null);
  };

  if (typeof arguments != 'undefined') {
    Module['arguments'] = arguments;
  }

  if (typeof console !== 'undefined') {
    if (!Module['print']) Module['print'] = function shell_print(x) {
      console.log(x);
    };
    if (!Module['printErr']) Module['printErr'] = function shell_printErr(x) {
      console.warn(x);
    };
  } else {
    // Probably a worker, and without console.log. We can do very little here...
    var TRY_USE_DUMP = false;
    if (!Module['print']) Module['print'] = (TRY_USE_DUMP && (typeof(dump) !== "undefined") ? (function(x) {
      dump(x);
    }) : (function(x) {
      // self.postMessage(x); // enable this if you want stdout to be sent as messages
    }));
  }

  if (ENVIRONMENT_IS_WORKER) {
    Module['load'] = importScripts;
  }

  if (typeof Module['setWindowTitle'] === 'undefined') {
    Module['setWindowTitle'] = function(title) { document.title = title };
  }
}
else {
  // Unreachable because SHELL is dependant on the others
  throw 'Unknown runtime environment. Where are we?';
}

function globalEval(x) {
  eval.call(null, x);
}
if (!Module['load'] && Module['read']) {
  Module['load'] = function load(f) {
    globalEval(Module['read'](f));
  };
}
if (!Module['print']) {
  Module['print'] = function(){};
}
if (!Module['printErr']) {
  Module['printErr'] = Module['print'];
}
if (!Module['arguments']) {
  Module['arguments'] = [];
}
if (!Module['thisProgram']) {
  Module['thisProgram'] = './this.program';
}
if (!Module['quit']) {
  Module['quit'] = function(status, toThrow) {
    throw toThrow;
  }
}

// *** Environment setup code ***

// Closure helpers
Module.print = Module['print'];
Module.printErr = Module['printErr'];

// Callbacks
Module['preRun'] = [];
Module['postRun'] = [];

// Merge back in the overrides
for (var key in moduleOverrides) {
  if (moduleOverrides.hasOwnProperty(key)) {
    Module[key] = moduleOverrides[key];
  }
}
// Free the object hierarchy contained in the overrides, this lets the GC
// reclaim data used e.g. in memoryInitializerRequest, which is a large typed array.
moduleOverrides = undefined;



// {{PREAMBLE_ADDITIONS}}

// === Preamble library stuff ===

// Documentation for the public APIs defined in this file must be updated in:
//    site/source/docs/api_reference/preamble.js.rst
// A prebuilt local version of the documentation is available at:
//    site/build/text/docs/api_reference/preamble.js.txt
// You can also build docs locally as HTML or other formats in site/
// An online HTML version (which may be of a different version of Emscripten)
//    is up at http://kripken.github.io/emscripten-site/docs/api_reference/preamble.js.html

//========================================
// Runtime code shared with compiler
//========================================

var Runtime = {
  setTempRet0: function (value) {
    tempRet0 = value;
    return value;
  },
  getTempRet0: function () {
    return tempRet0;
  },
  stackSave: function () {
    return STACKTOP;
  },
  stackRestore: function (stackTop) {
    STACKTOP = stackTop;
  },
  getNativeTypeSize: function (type) {
    switch (type) {
      case 'i1': case 'i8': return 1;
      case 'i16': return 2;
      case 'i32': return 4;
      case 'i64': return 8;
      case 'float': return 4;
      case 'double': return 8;
      default: {
        if (type[type.length-1] === '*') {
          return Runtime.QUANTUM_SIZE; // A pointer
        } else if (type[0] === 'i') {
          var bits = parseInt(type.substr(1));
          assert(bits % 8 === 0);
          return bits/8;
        } else {
          return 0;
        }
      }
    }
  },
  getNativeFieldSize: function (type) {
    return Math.max(Runtime.getNativeTypeSize(type), Runtime.QUANTUM_SIZE);
  },
  STACK_ALIGN: 16,
  prepVararg: function (ptr, type) {
    if (type === 'double' || type === 'i64') {
      // move so the load is aligned
      if (ptr & 7) {
        assert((ptr & 7) === 4);
        ptr += 4;
      }
    } else {
      assert((ptr & 3) === 0);
    }
    return ptr;
  },
  getAlignSize: function (type, size, vararg) {
    // we align i64s and doubles on 64-bit boundaries, unlike x86
    if (!vararg && (type == 'i64' || type == 'double')) return 8;
    if (!type) return Math.min(size, 8); // align structures internally to 64 bits
    return Math.min(size || (type ? Runtime.getNativeFieldSize(type) : 0), Runtime.QUANTUM_SIZE);
  },
  dynCall: function (sig, ptr, args) {
    if (args && args.length) {
      assert(args.length == sig.length-1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].apply(null, [ptr].concat(args));
    } else {
      assert(sig.length == 1);
      assert(('dynCall_' + sig) in Module, 'bad function pointer type - no table for sig \'' + sig + '\'');
      return Module['dynCall_' + sig].call(null, ptr);
    }
  },
  functionPointers: [],
  addFunction: function (func) {
    for (var i = 0; i < Runtime.functionPointers.length; i++) {
      if (!Runtime.functionPointers[i]) {
        Runtime.functionPointers[i] = func;
        return 2*(1 + i);
      }
    }
    throw 'Finished up all reserved function pointers. Use a higher value for RESERVED_FUNCTION_POINTERS.';
  },
  removeFunction: function (index) {
    Runtime.functionPointers[(index-2)/2] = null;
  },
  warnOnce: function (text) {
    if (!Runtime.warnOnce.shown) Runtime.warnOnce.shown = {};
    if (!Runtime.warnOnce.shown[text]) {
      Runtime.warnOnce.shown[text] = 1;
      Module.printErr(text);
    }
  },
  funcWrappers: {},
  getFuncWrapper: function (func, sig) {
    assert(sig);
    if (!Runtime.funcWrappers[sig]) {
      Runtime.funcWrappers[sig] = {};
    }
    var sigCache = Runtime.funcWrappers[sig];
    if (!sigCache[func]) {
      // optimize away arguments usage in common cases
      if (sig.length === 1) {
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func);
        };
      } else if (sig.length === 2) {
        sigCache[func] = function dynCall_wrapper(arg) {
          return Runtime.dynCall(sig, func, [arg]);
        };
      } else {
        // general case
        sigCache[func] = function dynCall_wrapper() {
          return Runtime.dynCall(sig, func, Array.prototype.slice.call(arguments));
        };
      }
    }
    return sigCache[func];
  },
  getCompilerSetting: function (name) {
    throw 'You must build with -s RETAIN_COMPILER_SETTINGS=1 for Runtime.getCompilerSetting or emscripten_get_compiler_setting to work';
  },
  stackAlloc: function (size) { var ret = STACKTOP;STACKTOP = (STACKTOP + size)|0;STACKTOP = (((STACKTOP)+15)&-16);(assert((((STACKTOP|0) < (STACK_MAX|0))|0))|0); return ret; },
  staticAlloc: function (size) { var ret = STATICTOP;STATICTOP = (STATICTOP + (assert(!staticSealed),size))|0;STATICTOP = (((STATICTOP)+15)&-16); return ret; },
  dynamicAlloc: function (size) { assert(DYNAMICTOP_PTR);var ret = HEAP32[DYNAMICTOP_PTR>>2];var end = (((ret + size + 15)|0) & -16);HEAP32[DYNAMICTOP_PTR>>2] = end;if (end >= TOTAL_MEMORY) {var success = enlargeMemory();if (!success) {HEAP32[DYNAMICTOP_PTR>>2] = ret;return 0;}}return ret;},
  alignMemory: function (size,quantum) { var ret = size = Math.ceil((size)/(quantum ? quantum : 16))*(quantum ? quantum : 16); return ret; },
  makeBigInt: function (low,high,unsigned) { var ret = (unsigned ? ((+((low>>>0)))+((+((high>>>0)))*4294967296.0)) : ((+((low>>>0)))+((+((high|0)))*4294967296.0))); return ret; },
  GLOBAL_BASE: 8,
  QUANTUM_SIZE: 4,
  __dummy__: 0
}



Module["Runtime"] = Runtime;



//========================================
// Runtime essentials
//========================================

var ABORT = 0; // whether we are quitting the application. no code should run after this. set in exit() and abort()
var EXITSTATUS = 0;

/** @type {function(*, string=)} */
function assert(condition, text) {
  if (!condition) {
    abort('Assertion failed: ' + text);
  }
}

var globalScope = this;

// Returns the C function with a specified identifier (for C++, you need to do manual name mangling)
function getCFunc(ident) {
  var func = Module['_' + ident]; // closure exported function
  if (!func) {
    try { func = eval('_' + ident); } catch(e) {}
  }
  assert(func, 'Cannot call unknown function ' + ident + ' (perhaps LLVM optimizations or closure removed it?)');
  return func;
}

var cwrap, ccall;
(function(){
  var JSfuncs = {
    // Helpers for cwrap -- it can't refer to Runtime directly because it might
    // be renamed by closure, instead it calls JSfuncs['stackSave'].body to find
    // out what the minified function name is.
    'stackSave': function() {
      Runtime.stackSave()
    },
    'stackRestore': function() {
      Runtime.stackRestore()
    },
    // type conversion from js to c
    'arrayToC' : function(arr) {
      var ret = Runtime.stackAlloc(arr.length);
      writeArrayToMemory(arr, ret);
      return ret;
    },
    'stringToC' : function(str) {
      var ret = 0;
      if (str !== null && str !== undefined && str !== 0) { // null string
        // at most 4 bytes per UTF-8 code point, +1 for the trailing '\0'
        var len = (str.length << 2) + 1;
        ret = Runtime.stackAlloc(len);
        stringToUTF8(str, ret, len);
      }
      return ret;
    }
  };
  // For fast lookup of conversion functions
  var toC = {'string' : JSfuncs['stringToC'], 'array' : JSfuncs['arrayToC']};

  // C calling interface.
  ccall = function ccallFunc(ident, returnType, argTypes, args, opts) {
    var func = getCFunc(ident);
    var cArgs = [];
    var stack = 0;
    assert(returnType !== 'array', 'Return type should not be "array".');
    if (args) {
      for (var i = 0; i < args.length; i++) {
        var converter = toC[argTypes[i]];
        if (converter) {
          if (stack === 0) stack = Runtime.stackSave();
          cArgs[i] = converter(args[i]);
        } else {
          cArgs[i] = args[i];
        }
      }
    }
    var ret = func.apply(null, cArgs);
    if ((!opts || !opts.async) && typeof EmterpreterAsync === 'object') {
      assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling ccall');
    }
    if (opts && opts.async) assert(!returnType, 'async ccalls cannot return values');
    if (returnType === 'string') ret = Pointer_stringify(ret);
    if (stack !== 0) {
      if (opts && opts.async) {
        EmterpreterAsync.asyncFinalizers.push(function() {
          Runtime.stackRestore(stack);
        });
        return;
      }
      Runtime.stackRestore(stack);
    }
    return ret;
  }

  var sourceRegex = /^function\s*[a-zA-Z$_0-9]*\s*\(([^)]*)\)\s*{\s*([^*]*?)[\s;]*(?:return\s*(.*?)[;\s]*)?}$/;
  function parseJSFunc(jsfunc) {
    // Match the body and the return value of a javascript function source
    var parsed = jsfunc.toString().match(sourceRegex).slice(1);
    return {arguments : parsed[0], body : parsed[1], returnValue: parsed[2]}
  }

  // sources of useful functions. we create this lazily as it can trigger a source decompression on this entire file
  var JSsource = null;
  function ensureJSsource() {
    if (!JSsource) {
      JSsource = {};
      for (var fun in JSfuncs) {
        if (JSfuncs.hasOwnProperty(fun)) {
          // Elements of toCsource are arrays of three items:
          // the code, and the return value
          JSsource[fun] = parseJSFunc(JSfuncs[fun]);
        }
      }
    }
  }

  cwrap = function cwrap(ident, returnType, argTypes) {
    argTypes = argTypes || [];
    var cfunc = getCFunc(ident);
    // When the function takes numbers and returns a number, we can just return
    // the original function
    var numericArgs = argTypes.every(function(type){ return type === 'number'});
    var numericRet = (returnType !== 'string');
    if ( numericRet && numericArgs) {
      return cfunc;
    }
    // Creation of the arguments list (["$1","$2",...,"$nargs"])
    var argNames = argTypes.map(function(x,i){return '$'+i});
    var funcstr = "(function(" + argNames.join(',') + ") {";
    var nargs = argTypes.length;
    if (!numericArgs) {
      // Generate the code needed to convert the arguments from javascript
      // values to pointers
      ensureJSsource();
      funcstr += 'var stack = ' + JSsource['stackSave'].body + ';';
      for (var i = 0; i < nargs; i++) {
        var arg = argNames[i], type = argTypes[i];
        if (type === 'number') continue;
        var convertCode = JSsource[type + 'ToC']; // [code, return]
        funcstr += 'var ' + convertCode.arguments + ' = ' + arg + ';';
        funcstr += convertCode.body + ';';
        funcstr += arg + '=(' + convertCode.returnValue + ');';
      }
    }

    // When the code is compressed, the name of cfunc is not literally 'cfunc' anymore
    var cfuncname = parseJSFunc(function(){return cfunc}).returnValue;
    // Call the function
    funcstr += 'var ret = ' + cfuncname + '(' + argNames.join(',') + ');';
    if (!numericRet) { // Return type can only by 'string' or 'number'
      // Convert the result to a string
      var strgfy = parseJSFunc(function(){return Pointer_stringify}).returnValue;
      funcstr += 'ret = ' + strgfy + '(ret);';
    }
    funcstr += "if (typeof EmterpreterAsync === 'object') { assert(!EmterpreterAsync.state, 'cannot start async op with normal JS calling cwrap') }";
    if (!numericArgs) {
      // If we had a stack, restore it
      ensureJSsource();
      funcstr += JSsource['stackRestore'].body.replace('()', '(stack)') + ';';
    }
    funcstr += 'return ret})';
    return eval(funcstr);
  };
})();
Module["ccall"] = ccall;
Module["cwrap"] = cwrap;

/** @type {function(number, number, string, boolean=)} */
function setValue(ptr, value, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': HEAP8[((ptr)>>0)]=value; break;
      case 'i8': HEAP8[((ptr)>>0)]=value; break;
      case 'i16': HEAP16[((ptr)>>1)]=value; break;
      case 'i32': HEAP32[((ptr)>>2)]=value; break;
      case 'i64': (tempI64 = [value>>>0,(tempDouble=value,(+(Math_abs(tempDouble))) >= 1.0 ? (tempDouble > 0.0 ? ((Math_min((+(Math_floor((tempDouble)/4294967296.0))), 4294967295.0))|0)>>>0 : (~~((+(Math_ceil((tempDouble - +(((~~(tempDouble)))>>>0))/4294967296.0)))))>>>0) : 0)],HEAP32[((ptr)>>2)]=tempI64[0],HEAP32[(((ptr)+(4))>>2)]=tempI64[1]); break;
      case 'float': HEAPF32[((ptr)>>2)]=value; break;
      case 'double': HEAPF64[((ptr)>>3)]=value; break;
      default: abort('invalid type for setValue: ' + type);
    }
}
Module["setValue"] = setValue;

/** @type {function(number, string, boolean=)} */
function getValue(ptr, type, noSafe) {
  type = type || 'i8';
  if (type.charAt(type.length-1) === '*') type = 'i32'; // pointers are 32-bit
    switch(type) {
      case 'i1': return HEAP8[((ptr)>>0)];
      case 'i8': return HEAP8[((ptr)>>0)];
      case 'i16': return HEAP16[((ptr)>>1)];
      case 'i32': return HEAP32[((ptr)>>2)];
      case 'i64': return HEAP32[((ptr)>>2)];
      case 'float': return HEAPF32[((ptr)>>2)];
      case 'double': return HEAPF64[((ptr)>>3)];
      default: abort('invalid type for setValue: ' + type);
    }
  return null;
}
Module["getValue"] = getValue;

var ALLOC_NORMAL = 0; // Tries to use _malloc()
var ALLOC_STACK = 1; // Lives for the duration of the current function call
var ALLOC_STATIC = 2; // Cannot be freed
var ALLOC_DYNAMIC = 3; // Cannot be freed except through sbrk
var ALLOC_NONE = 4; // Do not allocate
Module["ALLOC_NORMAL"] = ALLOC_NORMAL;
Module["ALLOC_STACK"] = ALLOC_STACK;
Module["ALLOC_STATIC"] = ALLOC_STATIC;
Module["ALLOC_DYNAMIC"] = ALLOC_DYNAMIC;
Module["ALLOC_NONE"] = ALLOC_NONE;

// allocate(): This is for internal use. You can use it yourself as well, but the interface
//             is a little tricky (see docs right below). The reason is that it is optimized
//             for multiple syntaxes to save space in generated code. So you should
//             normally not use allocate(), and instead allocate memory using _malloc(),
//             initialize it with setValue(), and so forth.
// @slab: An array of data, or a number. If a number, then the size of the block to allocate,
//        in *bytes* (note that this is sometimes confusing: the next parameter does not
//        affect this!)
// @types: Either an array of types, one for each byte (or 0 if no type at that position),
//         or a single type which is used for the entire block. This only matters if there
//         is initial data - if @slab is a number, then this does not matter at all and is
//         ignored.
// @allocator: How to allocate memory, see ALLOC_*
/** @type {function((TypedArray|Array<number>|number), string, number, number=)} */
function allocate(slab, types, allocator, ptr) {
  var zeroinit, size;
  if (typeof slab === 'number') {
    zeroinit = true;
    size = slab;
  } else {
    zeroinit = false;
    size = slab.length;
  }

  var singleType = typeof types === 'string' ? types : null;

  var ret;
  if (allocator == ALLOC_NONE) {
    ret = ptr;
  } else {
    ret = [typeof _malloc === 'function' ? _malloc : Runtime.staticAlloc, Runtime.stackAlloc, Runtime.staticAlloc, Runtime.dynamicAlloc][allocator === undefined ? ALLOC_STATIC : allocator](Math.max(size, singleType ? 1 : types.length));
  }

  if (zeroinit) {
    var ptr = ret, stop;
    assert((ret & 3) == 0);
    stop = ret + (size & ~3);
    for (; ptr < stop; ptr += 4) {
      HEAP32[((ptr)>>2)]=0;
    }
    stop = ret + size;
    while (ptr < stop) {
      HEAP8[((ptr++)>>0)]=0;
    }
    return ret;
  }

  if (singleType === 'i8') {
    if (slab.subarray || slab.slice) {
      HEAPU8.set(/** @type {!Uint8Array} */ (slab), ret);
    } else {
      HEAPU8.set(new Uint8Array(slab), ret);
    }
    return ret;
  }

  var i = 0, type, typeSize, previousType;
  while (i < size) {
    var curr = slab[i];

    if (typeof curr === 'function') {
      curr = Runtime.getFunctionIndex(curr);
    }

    type = singleType || types[i];
    if (type === 0) {
      i++;
      continue;
    }
    assert(type, 'Must know what type to store in allocate!');

    if (type == 'i64') type = 'i32'; // special case: we have one i32 here, and one i32 later

    setValue(ret+i, curr, type);

    // no need to look up size unless type changes, so cache it
    if (previousType !== type) {
      typeSize = Runtime.getNativeTypeSize(type);
      previousType = type;
    }
    i += typeSize;
  }

  return ret;
}
Module["allocate"] = allocate;

// Allocate memory during any stage of startup - static memory early on, dynamic memory later, malloc when ready
function getMemory(size) {
  if (!staticSealed) return Runtime.staticAlloc(size);
  if (!runtimeInitialized) return Runtime.dynamicAlloc(size);
  return _malloc(size);
}
Module["getMemory"] = getMemory;

/** @type {function(number, number=)} */
function Pointer_stringify(ptr, length) {
  if (length === 0 || !ptr) return '';
  // TODO: use TextDecoder
  // Find the length, and check for UTF while doing so
  var hasUtf = 0;
  var t;
  var i = 0;
  while (1) {
    assert(ptr + i < TOTAL_MEMORY);
    t = HEAPU8[(((ptr)+(i))>>0)];
    hasUtf |= t;
    if (t == 0 && !length) break;
    i++;
    if (length && i == length) break;
  }
  if (!length) length = i;

  var ret = '';

  if (hasUtf < 128) {
    var MAX_CHUNK = 1024; // split up into chunks, because .apply on a huge string can overflow the stack
    var curr;
    while (length > 0) {
      curr = String.fromCharCode.apply(String, HEAPU8.subarray(ptr, ptr + Math.min(length, MAX_CHUNK)));
      ret = ret ? ret + curr : curr;
      ptr += MAX_CHUNK;
      length -= MAX_CHUNK;
    }
    return ret;
  }
  return Module['UTF8ToString'](ptr);
}
Module["Pointer_stringify"] = Pointer_stringify;

// Given a pointer 'ptr' to a null-terminated ASCII-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function AsciiToString(ptr) {
  var str = '';
  while (1) {
    var ch = HEAP8[((ptr++)>>0)];
    if (!ch) return str;
    str += String.fromCharCode(ch);
  }
}
Module["AsciiToString"] = AsciiToString;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in ASCII form. The copy will require at most str.length+1 bytes of space in the HEAP.

function stringToAscii(str, outPtr) {
  return writeAsciiToMemory(str, outPtr, false);
}
Module["stringToAscii"] = stringToAscii;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the given array that contains uint8 values, returns
// a copy of that string as a Javascript String object.

var UTF8Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf8') : undefined;
function UTF8ArrayToString(u8Array, idx) {
  var endPtr = idx;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  while (u8Array[endPtr]) ++endPtr;

  if (endPtr - idx > 16 && u8Array.subarray && UTF8Decoder) {
    return UTF8Decoder.decode(u8Array.subarray(idx, endPtr));
  } else {
    var u0, u1, u2, u3, u4, u5;

    var str = '';
    while (1) {
      // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
      u0 = u8Array[idx++];
      if (!u0) return str;
      if (!(u0 & 0x80)) { str += String.fromCharCode(u0); continue; }
      u1 = u8Array[idx++] & 63;
      if ((u0 & 0xE0) == 0xC0) { str += String.fromCharCode(((u0 & 31) << 6) | u1); continue; }
      u2 = u8Array[idx++] & 63;
      if ((u0 & 0xF0) == 0xE0) {
        u0 = ((u0 & 15) << 12) | (u1 << 6) | u2;
      } else {
        u3 = u8Array[idx++] & 63;
        if ((u0 & 0xF8) == 0xF0) {
          u0 = ((u0 & 7) << 18) | (u1 << 12) | (u2 << 6) | u3;
        } else {
          u4 = u8Array[idx++] & 63;
          if ((u0 & 0xFC) == 0xF8) {
            u0 = ((u0 & 3) << 24) | (u1 << 18) | (u2 << 12) | (u3 << 6) | u4;
          } else {
            u5 = u8Array[idx++] & 63;
            u0 = ((u0 & 1) << 30) | (u1 << 24) | (u2 << 18) | (u3 << 12) | (u4 << 6) | u5;
          }
        }
      }
      if (u0 < 0x10000) {
        str += String.fromCharCode(u0);
      } else {
        var ch = u0 - 0x10000;
        str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
      }
    }
  }
}
Module["UTF8ArrayToString"] = UTF8ArrayToString;

// Given a pointer 'ptr' to a null-terminated UTF8-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

function UTF8ToString(ptr) {
  return UTF8ArrayToString(HEAPU8,ptr);
}
Module["UTF8ToString"] = UTF8ToString;

// Copies the given Javascript String object 'str' to the given byte array at address 'outIdx',
// encoded in UTF8 form and null-terminated. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outU8Array: the array to copy to. Each index in this array is assumed to be one 8-byte element.
//   outIdx: The starting offset in the array to begin the copying.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=1, only the null terminator will be written and nothing else.
//                    maxBytesToWrite=0 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8Array(str, outU8Array, outIdx, maxBytesToWrite) {
  if (!(maxBytesToWrite > 0)) // Parameter maxBytesToWrite is not optional. Negative values, 0, null, undefined and false each don't write out any bytes.
    return 0;

  var startIdx = outIdx;
  var endIdx = outIdx + maxBytesToWrite - 1; // -1 for string null terminator.
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    // For UTF8 byte structure, see http://en.wikipedia.org/wiki/UTF-8#Description and https://www.ietf.org/rfc/rfc2279.txt and https://tools.ietf.org/html/rfc3629
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      if (outIdx >= endIdx) break;
      outU8Array[outIdx++] = u;
    } else if (u <= 0x7FF) {
      if (outIdx + 1 >= endIdx) break;
      outU8Array[outIdx++] = 0xC0 | (u >> 6);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0xFFFF) {
      if (outIdx + 2 >= endIdx) break;
      outU8Array[outIdx++] = 0xE0 | (u >> 12);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x1FFFFF) {
      if (outIdx + 3 >= endIdx) break;
      outU8Array[outIdx++] = 0xF0 | (u >> 18);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else if (u <= 0x3FFFFFF) {
      if (outIdx + 4 >= endIdx) break;
      outU8Array[outIdx++] = 0xF8 | (u >> 24);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    } else {
      if (outIdx + 5 >= endIdx) break;
      outU8Array[outIdx++] = 0xFC | (u >> 30);
      outU8Array[outIdx++] = 0x80 | ((u >> 24) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 18) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 12) & 63);
      outU8Array[outIdx++] = 0x80 | ((u >> 6) & 63);
      outU8Array[outIdx++] = 0x80 | (u & 63);
    }
  }
  // Null-terminate the pointer to the buffer.
  outU8Array[outIdx] = 0;
  return outIdx - startIdx;
}
Module["stringToUTF8Array"] = stringToUTF8Array;

// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF8 form. The copy will require at most str.length*4+1 bytes of space in the HEAP.
// Use the function lengthBytesUTF8 to compute the exact number of bytes (excluding null terminator) that this function will write.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF8(str, outPtr, maxBytesToWrite) {
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF8(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  return stringToUTF8Array(str, HEAPU8,outPtr, maxBytesToWrite);
}
Module["stringToUTF8"] = stringToUTF8;

// Returns the number of bytes the given Javascript string takes if encoded as a UTF8 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF8(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! So decode UTF16->UTF32->UTF8.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var u = str.charCodeAt(i); // possibly a lead surrogate
    if (u >= 0xD800 && u <= 0xDFFF) u = 0x10000 + ((u & 0x3FF) << 10) | (str.charCodeAt(++i) & 0x3FF);
    if (u <= 0x7F) {
      ++len;
    } else if (u <= 0x7FF) {
      len += 2;
    } else if (u <= 0xFFFF) {
      len += 3;
    } else if (u <= 0x1FFFFF) {
      len += 4;
    } else if (u <= 0x3FFFFFF) {
      len += 5;
    } else {
      len += 6;
    }
  }
  return len;
}
Module["lengthBytesUTF8"] = lengthBytesUTF8;

// Given a pointer 'ptr' to a null-terminated UTF16LE-encoded string in the emscripten HEAP, returns
// a copy of that string as a Javascript String object.

var UTF16Decoder = typeof TextDecoder !== 'undefined' ? new TextDecoder('utf-16le') : undefined;
function UTF16ToString(ptr) {
  assert(ptr % 2 == 0, 'Pointer passed to UTF16ToString must be aligned to two bytes!');
  var endPtr = ptr;
  // TextDecoder needs to know the byte length in advance, it doesn't stop on null terminator by itself.
  // Also, use the length info to avoid running tiny strings through TextDecoder, since .subarray() allocates garbage.
  var idx = endPtr >> 1;
  while (HEAP16[idx]) ++idx;
  endPtr = idx << 1;

  if (endPtr - ptr > 32 && UTF16Decoder) {
    return UTF16Decoder.decode(HEAPU8.subarray(ptr, endPtr));
  } else {
    var i = 0;

    var str = '';
    while (1) {
      var codeUnit = HEAP16[(((ptr)+(i*2))>>1)];
      if (codeUnit == 0) return str;
      ++i;
      // fromCharCode constructs a character from a UTF-16 code unit, so we can pass the UTF16 string right through.
      str += String.fromCharCode(codeUnit);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF16 form. The copy will require at most str.length*4+2 bytes of space in the HEAP.
// Use the function lengthBytesUTF16() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=2, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<2 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF16(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 2 == 0, 'Pointer passed to stringToUTF16 must be aligned to two bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF16(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 2) return 0;
  maxBytesToWrite -= 2; // Null terminator.
  var startPtr = outPtr;
  var numCharsToWrite = (maxBytesToWrite < str.length*2) ? (maxBytesToWrite / 2) : str.length;
  for (var i = 0; i < numCharsToWrite; ++i) {
    // charCodeAt returns a UTF-16 encoded code unit, so it can be directly written to the HEAP.
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    HEAP16[((outPtr)>>1)]=codeUnit;
    outPtr += 2;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP16[((outPtr)>>1)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF16(str) {
  return str.length*2;
}


function UTF32ToString(ptr) {
  assert(ptr % 4 == 0, 'Pointer passed to UTF32ToString must be aligned to four bytes!');
  var i = 0;

  var str = '';
  while (1) {
    var utf32 = HEAP32[(((ptr)+(i*4))>>2)];
    if (utf32 == 0)
      return str;
    ++i;
    // Gotcha: fromCharCode constructs a character from a UTF-16 encoded code (pair), not from a Unicode code point! So encode the code point to UTF-16 for constructing.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    if (utf32 >= 0x10000) {
      var ch = utf32 - 0x10000;
      str += String.fromCharCode(0xD800 | (ch >> 10), 0xDC00 | (ch & 0x3FF));
    } else {
      str += String.fromCharCode(utf32);
    }
  }
}


// Copies the given Javascript String object 'str' to the emscripten HEAP at address 'outPtr',
// null-terminated and encoded in UTF32 form. The copy will require at most str.length*4+4 bytes of space in the HEAP.
// Use the function lengthBytesUTF32() to compute the exact number of bytes (excluding null terminator) that this function will write.
// Parameters:
//   str: the Javascript string to copy.
//   outPtr: Byte address in Emscripten HEAP where to write the string to.
//   maxBytesToWrite: The maximum number of bytes this function can write to the array. This count should include the null
//                    terminator, i.e. if maxBytesToWrite=4, only the null terminator will be written and nothing else.
//                    maxBytesToWrite<4 does not write any bytes to the output, not even the null terminator.
// Returns the number of bytes written, EXCLUDING the null terminator.

function stringToUTF32(str, outPtr, maxBytesToWrite) {
  assert(outPtr % 4 == 0, 'Pointer passed to stringToUTF32 must be aligned to four bytes!');
  assert(typeof maxBytesToWrite == 'number', 'stringToUTF32(str, outPtr, maxBytesToWrite) is missing the third parameter that specifies the length of the output buffer!');
  // Backwards compatibility: if max bytes is not specified, assume unsafe unbounded write is allowed.
  if (maxBytesToWrite === undefined) {
    maxBytesToWrite = 0x7FFFFFFF;
  }
  if (maxBytesToWrite < 4) return 0;
  var startPtr = outPtr;
  var endPtr = startPtr + maxBytesToWrite - 4;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i); // possibly a lead surrogate
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) {
      var trailSurrogate = str.charCodeAt(++i);
      codeUnit = 0x10000 + ((codeUnit & 0x3FF) << 10) | (trailSurrogate & 0x3FF);
    }
    HEAP32[((outPtr)>>2)]=codeUnit;
    outPtr += 4;
    if (outPtr + 4 > endPtr) break;
  }
  // Null-terminate the pointer to the HEAP.
  HEAP32[((outPtr)>>2)]=0;
  return outPtr - startPtr;
}


// Returns the number of bytes the given Javascript string takes if encoded as a UTF16 byte array, EXCLUDING the null terminator byte.

function lengthBytesUTF32(str) {
  var len = 0;
  for (var i = 0; i < str.length; ++i) {
    // Gotcha: charCodeAt returns a 16-bit word that is a UTF-16 encoded code unit, not a Unicode code point of the character! We must decode the string to UTF-32 to the heap.
    // See http://unicode.org/faq/utf_bom.html#utf16-3
    var codeUnit = str.charCodeAt(i);
    if (codeUnit >= 0xD800 && codeUnit <= 0xDFFF) ++i; // possibly a lead surrogate, so skip over the tail surrogate.
    len += 4;
  }

  return len;
}


function demangle(func) {
  var __cxa_demangle_func = Module['___cxa_demangle'] || Module['__cxa_demangle'];
  if (__cxa_demangle_func) {
    try {
      var s =
        func.substr(1);
      var len = lengthBytesUTF8(s)+1;
      var buf = _malloc(len);
      stringToUTF8(s, buf, len);
      var status = _malloc(4);
      var ret = __cxa_demangle_func(buf, 0, 0, status);
      if (getValue(status, 'i32') === 0 && ret) {
        return Pointer_stringify(ret);
      }
      // otherwise, libcxxabi failed
    } catch(e) {
      // ignore problems here
    } finally {
      if (buf) _free(buf);
      if (status) _free(status);
      if (ret) _free(ret);
    }
    // failure when using libcxxabi, don't demangle
    return func;
  }
  Runtime.warnOnce('warning: build with  -s DEMANGLE_SUPPORT=1  to link in libcxxabi demangling');
  return func;
}

function demangleAll(text) {
  var regex =
    /__Z[\w\d_]+/g;
  return text.replace(regex,
    function(x) {
      var y = demangle(x);
      return x === y ? x : (x + ' [' + y + ']');
    });
}

function jsStackTrace() {
  var err = new Error();
  if (!err.stack) {
    // IE10+ special cases: It does have callstack info, but it is only populated if an Error object is thrown,
    // so try that as a special-case.
    try {
      throw new Error(0);
    } catch(e) {
      err = e;
    }
    if (!err.stack) {
      return '(no stack trace available)';
    }
  }
  return err.stack.toString();
}

function stackTrace() {
  var js = jsStackTrace();
  if (Module['extraStackTrace']) js += '\n' + Module['extraStackTrace']();
  return demangleAll(js);
}
Module["stackTrace"] = stackTrace;

// Memory management

var PAGE_SIZE = 16384;
var WASM_PAGE_SIZE = 65536;
var ASMJS_PAGE_SIZE = 16777216;
var MIN_TOTAL_MEMORY = 16777216;

function alignUp(x, multiple) {
  if (x % multiple > 0) {
    x += multiple - (x % multiple);
  }
  return x;
}

var HEAP,
/** @type {ArrayBuffer} */
  buffer,
/** @type {Int8Array} */
  HEAP8,
/** @type {Uint8Array} */
  HEAPU8,
/** @type {Int16Array} */
  HEAP16,
/** @type {Uint16Array} */
  HEAPU16,
/** @type {Int32Array} */
  HEAP32,
/** @type {Uint32Array} */
  HEAPU32,
/** @type {Float32Array} */
  HEAPF32,
/** @type {Float64Array} */
  HEAPF64;

function updateGlobalBuffer(buf) {
  Module['buffer'] = buffer = buf;
}

function updateGlobalBufferViews() {
  Module['HEAP8'] = HEAP8 = new Int8Array(buffer);
  Module['HEAP16'] = HEAP16 = new Int16Array(buffer);
  Module['HEAP32'] = HEAP32 = new Int32Array(buffer);
  Module['HEAPU8'] = HEAPU8 = new Uint8Array(buffer);
  Module['HEAPU16'] = HEAPU16 = new Uint16Array(buffer);
  Module['HEAPU32'] = HEAPU32 = new Uint32Array(buffer);
  Module['HEAPF32'] = HEAPF32 = new Float32Array(buffer);
  Module['HEAPF64'] = HEAPF64 = new Float64Array(buffer);
}

var STATIC_BASE, STATICTOP, staticSealed; // static area
var STACK_BASE, STACKTOP, STACK_MAX; // stack area
var DYNAMIC_BASE, DYNAMICTOP_PTR; // dynamic area handled by sbrk

  STATIC_BASE = STATICTOP = STACK_BASE = STACKTOP = STACK_MAX = DYNAMIC_BASE = DYNAMICTOP_PTR = 0;
  staticSealed = false;


// Initializes the stack cookie. Called at the startup of main and at the startup of each thread in pthreads mode.
function writeStackCookie() {
  assert((STACK_MAX & 3) == 0);
  HEAPU32[(STACK_MAX >> 2)-1] = 0x02135467;
  HEAPU32[(STACK_MAX >> 2)-2] = 0x89BACDFE;
}

function checkStackCookie() {
  if (HEAPU32[(STACK_MAX >> 2)-1] != 0x02135467 || HEAPU32[(STACK_MAX >> 2)-2] != 0x89BACDFE) {
    abort('Stack overflow! Stack cookie has been overwritten, expected hex dwords 0x89BACDFE and 0x02135467, but received 0x' + HEAPU32[(STACK_MAX >> 2)-2].toString(16) + ' ' + HEAPU32[(STACK_MAX >> 2)-1].toString(16));
  }
  // Also test the global address 0 for integrity. This check is not compatible with SAFE_SPLIT_MEMORY though, since that mode already tests all address 0 accesses on its own.
  if (HEAP32[0] !== 0x63736d65 /* 'emsc' */) throw 'Runtime error: The application has corrupted its heap memory area (address zero)!';
}

function abortStackOverflow(allocSize) {
  abort('Stack overflow! Attempted to allocate ' + allocSize + ' bytes on the stack, but stack has only ' + (STACK_MAX - Module['asm'].stackSave() + allocSize) + ' bytes available!');
}

function abortOnCannotGrowMemory() {
  abort('Cannot enlarge memory arrays. Either (1) compile with  -s TOTAL_MEMORY=X  with X higher than the current value ' + TOTAL_MEMORY + ', (2) compile with  -s ALLOW_MEMORY_GROWTH=1  which allows increasing the size at runtime but prevents some optimizations, (3) set Module.TOTAL_MEMORY to a higher value before the program runs, or (4) if you want malloc to return NULL (0) instead of this abort, compile with  -s ABORTING_MALLOC=0 ');
}


function enlargeMemory() {
  abortOnCannotGrowMemory();
}


var TOTAL_STACK = Module['TOTAL_STACK'] || 5242880;
var TOTAL_MEMORY = Module['TOTAL_MEMORY'] || 16777216;
if (TOTAL_MEMORY < TOTAL_STACK) Module.printErr('TOTAL_MEMORY should be larger than TOTAL_STACK, was ' + TOTAL_MEMORY + '! (TOTAL_STACK=' + TOTAL_STACK + ')');

// Initialize the runtime's memory
// check for full engine support (use string 'subarray' to avoid closure compiler confusion)
assert(typeof Int32Array !== 'undefined' && typeof Float64Array !== 'undefined' && Int32Array.prototype.subarray !== undefined && Int32Array.prototype.set !== undefined,
       'JS engine does not provide full typed array support');



// Use a provided buffer, if there is one, or else allocate a new one
if (Module['buffer']) {
  buffer = Module['buffer'];
  assert(buffer.byteLength === TOTAL_MEMORY, 'provided buffer should be ' + TOTAL_MEMORY + ' bytes, but it is ' + buffer.byteLength);
} else {
  // Use a WebAssembly memory where available
  {
    buffer = new ArrayBuffer(TOTAL_MEMORY);
  }
  assert(buffer.byteLength === TOTAL_MEMORY);
}
updateGlobalBufferViews();


function getTotalMemory() {
  return TOTAL_MEMORY;
}

// Endianness check (note: assumes compiler arch was little-endian)
  HEAP32[0] = 0x63736d65; /* 'emsc' */
HEAP16[1] = 0x6373;
if (HEAPU8[2] !== 0x73 || HEAPU8[3] !== 0x63) throw 'Runtime error: expected the system to be little-endian!';

Module['HEAP'] = HEAP;
Module['buffer'] = buffer;
Module['HEAP8'] = HEAP8;
Module['HEAP16'] = HEAP16;
Module['HEAP32'] = HEAP32;
Module['HEAPU8'] = HEAPU8;
Module['HEAPU16'] = HEAPU16;
Module['HEAPU32'] = HEAPU32;
Module['HEAPF32'] = HEAPF32;
Module['HEAPF64'] = HEAPF64;

function callRuntimeCallbacks(callbacks) {
  while(callbacks.length > 0) {
    var callback = callbacks.shift();
    if (typeof callback == 'function') {
      callback();
      continue;
    }
    var func = callback.func;
    if (typeof func === 'number') {
      if (callback.arg === undefined) {
        Module['dynCall_v'](func);
      } else {
        Module['dynCall_vi'](func, callback.arg);
      }
    } else {
      func(callback.arg === undefined ? null : callback.arg);
    }
  }
}

var __ATPRERUN__  = []; // functions called before the runtime is initialized
var __ATINIT__    = []; // functions called during startup
var __ATMAIN__    = []; // functions called when main() is to be run
var __ATEXIT__    = []; // functions called during shutdown
var __ATPOSTRUN__ = []; // functions called after the runtime has exited

var runtimeInitialized = false;
var runtimeExited = false;


function preRun() {
  // compatibility - merge in anything from Module['preRun'] at this time
  if (Module['preRun']) {
    if (typeof Module['preRun'] == 'function') Module['preRun'] = [Module['preRun']];
    while (Module['preRun'].length) {
      addOnPreRun(Module['preRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPRERUN__);
}

function ensureInitRuntime() {
  checkStackCookie();
  if (runtimeInitialized) return;
  runtimeInitialized = true;
  callRuntimeCallbacks(__ATINIT__);
}

function preMain() {
  checkStackCookie();
  callRuntimeCallbacks(__ATMAIN__);
}

function exitRuntime() {
  checkStackCookie();
  callRuntimeCallbacks(__ATEXIT__);
  runtimeExited = true;
}

function postRun() {
  checkStackCookie();
  // compatibility - merge in anything from Module['postRun'] at this time
  if (Module['postRun']) {
    if (typeof Module['postRun'] == 'function') Module['postRun'] = [Module['postRun']];
    while (Module['postRun'].length) {
      addOnPostRun(Module['postRun'].shift());
    }
  }
  callRuntimeCallbacks(__ATPOSTRUN__);
}

function addOnPreRun(cb) {
  __ATPRERUN__.unshift(cb);
}
Module["addOnPreRun"] = addOnPreRun;

function addOnInit(cb) {
  __ATINIT__.unshift(cb);
}
Module["addOnInit"] = addOnInit;

function addOnPreMain(cb) {
  __ATMAIN__.unshift(cb);
}
Module["addOnPreMain"] = addOnPreMain;

function addOnExit(cb) {
  __ATEXIT__.unshift(cb);
}
Module["addOnExit"] = addOnExit;

function addOnPostRun(cb) {
  __ATPOSTRUN__.unshift(cb);
}
Module["addOnPostRun"] = addOnPostRun;

// Tools

/** @type {function(string, boolean=, number=)} */
function intArrayFromString(stringy, dontAddNull, length) {
  var len = length > 0 ? length : lengthBytesUTF8(stringy)+1;
  var u8array = new Array(len);
  var numBytesWritten = stringToUTF8Array(stringy, u8array, 0, u8array.length);
  if (dontAddNull) u8array.length = numBytesWritten;
  return u8array;
}
Module["intArrayFromString"] = intArrayFromString;

function intArrayToString(array) {
  var ret = [];
  for (var i = 0; i < array.length; i++) {
    var chr = array[i];
    if (chr > 0xFF) {
      assert(false, 'Character code ' + chr + ' (' + String.fromCharCode(chr) + ')  at offset ' + i + ' not in 0x00-0xFF.');
      chr &= 0xFF;
    }
    ret.push(String.fromCharCode(chr));
  }
  return ret.join('');
}
Module["intArrayToString"] = intArrayToString;

// Deprecated: This function should not be called because it is unsafe and does not provide
// a maximum length limit of how many bytes it is allowed to write. Prefer calling the
// function stringToUTF8Array() instead, which takes in a maximum length that can be used
// to be secure from out of bounds writes.
/** @deprecated */
function writeStringToMemory(string, buffer, dontAddNull) {
  Runtime.warnOnce('writeStringToMemory is deprecated and should not be called! Use stringToUTF8() instead!');

  var /** @type {number} */ lastChar, /** @type {number} */ end;
  if (dontAddNull) {
    // stringToUTF8Array always appends null. If we don't want to do that, remember the
    // character that existed at the location where the null will be placed, and restore
    // that after the write (below).
    end = buffer + lengthBytesUTF8(string);
    lastChar = HEAP8[end];
  }
  stringToUTF8(string, buffer, Infinity);
  if (dontAddNull) HEAP8[end] = lastChar; // Restore the value under the null character.
}
Module["writeStringToMemory"] = writeStringToMemory;

function writeArrayToMemory(array, buffer) {
  assert(array.length >= 0, 'writeArrayToMemory array must have a length (should be an array or typed array)')
  HEAP8.set(array, buffer);
}
Module["writeArrayToMemory"] = writeArrayToMemory;

function writeAsciiToMemory(str, buffer, dontAddNull) {
  for (var i = 0; i < str.length; ++i) {
    assert(str.charCodeAt(i) === str.charCodeAt(i)&0xff);
    HEAP8[((buffer++)>>0)]=str.charCodeAt(i);
  }
  // Null-terminate the pointer to the HEAP.
  if (!dontAddNull) HEAP8[((buffer)>>0)]=0;
}
Module["writeAsciiToMemory"] = writeAsciiToMemory;

function unSign(value, bits, ignore) {
  if (value >= 0) {
    return value;
  }
  return bits <= 32 ? 2*Math.abs(1 << (bits-1)) + value // Need some trickery, since if bits == 32, we are right at the limit of the bits JS uses in bitshifts
                    : Math.pow(2, bits)         + value;
}
function reSign(value, bits, ignore) {
  if (value <= 0) {
    return value;
  }
  var half = bits <= 32 ? Math.abs(1 << (bits-1)) // abs is needed if bits == 32
                        : Math.pow(2, bits-1);
  if (value >= half && (bits <= 32 || value > half)) { // for huge values, we can hit the precision limit and always get true here. so don't do that
                                                       // but, in general there is no perfect solution here. With 64-bit ints, we get rounding and errors
                                                       // TODO: In i64 mode 1, resign the two parts separately and safely
    value = -2*half + value; // Cannot bitshift half, as it may be at the limit of the bits JS uses in bitshifts
  }
  return value;
}

// check for imul support, and also for correctness ( https://bugs.webkit.org/show_bug.cgi?id=126345 )
if (!Math['imul'] || Math['imul'](0xffffffff, 5) !== -5) Math['imul'] = function imul(a, b) {
  var ah  = a >>> 16;
  var al = a & 0xffff;
  var bh  = b >>> 16;
  var bl = b & 0xffff;
  return (al*bl + ((ah*bl + al*bh) << 16))|0;
};
Math.imul = Math['imul'];


if (!Math['clz32']) Math['clz32'] = function(x) {
  x = x >>> 0;
  for (var i = 0; i < 32; i++) {
    if (x & (1 << (31 - i))) return i;
  }
  return 32;
};
Math.clz32 = Math['clz32']

if (!Math['trunc']) Math['trunc'] = function(x) {
  return x < 0 ? Math.ceil(x) : Math.floor(x);
};
Math.trunc = Math['trunc'];

var Math_abs = Math.abs;
var Math_cos = Math.cos;
var Math_sin = Math.sin;
var Math_tan = Math.tan;
var Math_acos = Math.acos;
var Math_asin = Math.asin;
var Math_atan = Math.atan;
var Math_atan2 = Math.atan2;
var Math_exp = Math.exp;
var Math_log = Math.log;
var Math_sqrt = Math.sqrt;
var Math_ceil = Math.ceil;
var Math_floor = Math.floor;
var Math_pow = Math.pow;
var Math_imul = Math.imul;
var Math_fround = Math.fround;
var Math_round = Math.round;
var Math_min = Math.min;
var Math_clz32 = Math.clz32;
var Math_trunc = Math.trunc;

// A counter of dependencies for calling run(). If we need to
// do asynchronous work before running, increment this and
// decrement it. Incrementing must happen in a place like
// PRE_RUN_ADDITIONS (used by emcc to add file preloading).
// Note that you can add dependencies in preRun, even though
// it happens right before run - run will be postponed until
// the dependencies are met.
var runDependencies = 0;
var runDependencyWatcher = null;
var dependenciesFulfilled = null; // overridden to take different actions when all run dependencies are fulfilled
var runDependencyTracking = {};

function getUniqueRunDependency(id) {
  var orig = id;
  while (1) {
    if (!runDependencyTracking[id]) return id;
    id = orig + Math.random();
  }
  return id;
}

function addRunDependency(id) {
  runDependencies++;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(!runDependencyTracking[id]);
    runDependencyTracking[id] = 1;
    if (runDependencyWatcher === null && typeof setInterval !== 'undefined') {
      // Check for missing dependencies every few seconds
      runDependencyWatcher = setInterval(function() {
        if (ABORT) {
          clearInterval(runDependencyWatcher);
          runDependencyWatcher = null;
          return;
        }
        var shown = false;
        for (var dep in runDependencyTracking) {
          if (!shown) {
            shown = true;
            Module.printErr('still waiting on run dependencies:');
          }
          Module.printErr('dependency: ' + dep);
        }
        if (shown) {
          Module.printErr('(end of list)');
        }
      }, 10000);
    }
  } else {
    Module.printErr('warning: run dependency added without ID');
  }
}
Module["addRunDependency"] = addRunDependency;

function removeRunDependency(id) {
  runDependencies--;
  if (Module['monitorRunDependencies']) {
    Module['monitorRunDependencies'](runDependencies);
  }
  if (id) {
    assert(runDependencyTracking[id]);
    delete runDependencyTracking[id];
  } else {
    Module.printErr('warning: run dependency removed without ID');
  }
  if (runDependencies == 0) {
    if (runDependencyWatcher !== null) {
      clearInterval(runDependencyWatcher);
      runDependencyWatcher = null;
    }
    if (dependenciesFulfilled) {
      var callback = dependenciesFulfilled;
      dependenciesFulfilled = null;
      callback(); // can add another dependenciesFulfilled
    }
  }
}
Module["removeRunDependency"] = removeRunDependency;

Module["preloadedImages"] = {}; // maps url to image data
Module["preloadedAudios"] = {}; // maps url to audio data



var memoryInitializer = null;



var /* show errors on likely calls to FS when it was not included */ FS = {
  error: function() {
    abort('Filesystem support (FS) was not included. The problem is that you are using files from JS, but files were not used from C/C++, so filesystem support was not auto-included. You can force-include filesystem support with  -s FORCE_FILESYSTEM=1');
  },
  init: function() { FS.error() },
  createDataFile: function() { FS.error() },
  createPreloadedFile: function() { FS.error() },
  createLazyFile: function() { FS.error() },
  open: function() { FS.error() },
  mkdev: function() { FS.error() },
  registerDevice: function() { FS.error() },
  analyzePath: function() { FS.error() },
  loadFilesFromDB: function() { FS.error() },

  ErrnoError: function ErrnoError() { FS.error() },
};
Module['FS_createDataFile'] = FS.createDataFile;
Module['FS_createPreloadedFile'] = FS.createPreloadedFile;



// === Body ===

var ASM_CONSTS = [];




STATIC_BASE = Runtime.GLOBAL_BASE;

STATICTOP = STATIC_BASE + 9456;
/* global initializers */  __ATINIT__.push();


/* memory initializer */ allocate([236,5,0,0,2,0,0,192,3,0,0,192,4,0,0,192,5,0,0,192,6,0,0,192,7,0,0,192,8,0,0,192,9,0,0,192,10,0,0,192,11,0,0,192,12,0,0,192,13,0,0,192,14,0,0,192,15,0,0,192,16,0,0,192,17,0,0,192,18,0,0,192,19,0,0,192,20,0,0,192,21,0,0,192,22,0,0,192,23,0,0,192,24,0,0,192,25,0,0,192,26,0,0,192,27,0,0,192,28,0,0,192,29,0,0,192,30,0,0,192,31,0,0,192,0,0,0,179,1,0,0,195,2,0,0,195,3,0,0,195,4,0,0,195,5,0,0,195,6,0,0,195,7,0,0,195,8,0,0,195,9,0,0,195,10,0,0,195,11,0,0,195,12,0,0,195,13,0,0,211,14,0,0,195,15,0,0,195,0,0,12,187,1,0,12,195,2,0,12,195,3,0,12,195,4,0,12,211,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,188,32,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,5,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,0,3,0,0,0,232,32,0,0,0,4,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,10,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,204,1,0,0,32,0,0,0,9,0,0,0,10,0,0,0,13,0,0,0,11,0,0,0,12,0,0,0,133,0,0,0,0,32,0,0,1,32,0,0,2,32,0,0,3,32,0,0,4,32,0,0,5,32,0,0,6,32,0,0,8,32,0,0,9,32,0,0,10,32,0,0,40,32,0,0,41,32,0,0,95,32,0,0,0,48,0,0,0,0,0,0,116,0,0,0,75,30,0,0,110,0,0,0,77,30,0,0,114,0,0,0,79,30,0,0,102,0,0,0,81,30,0,0,97,0,0,0,83,30,0,0,101,0,0,0,85,30,0,0,119,0,0,0,87,30,0,0,87,0,0,0,100,30,0,0,115,0,0,0,114,30,0,0,83,0,0,0,126,30,0,0,100,0,0,0,139,30,0,0,68,0,0,0,151,30,0,0,0,0,0,0,0,0,0,0,73,0,49,1,83,0,127,1,48,1,105,0,120,1,255,0,129,1,83,2,130,1,131,1,132,1,133,1,134,1,84,2,135,1,136,1,137,1,86,2,138,1,87,2,139,1,140,1,142,1,221,1,143,1,89,2,144,1,91,2,145,1,146,1,147,1,96,2,148,1,99,2,150,1,105,2,151,1,104,2,152,1,153,1,156,1,111,2,157,1,114,2,159,1,117,2,166,1,128,2,167,1,168,1,169,1,131,2,172,1,173,1,174,1,136,2,175,1,176,1,177,1,138,2,178,1,139,2,183,1,146,2,184,1,185,1,188,1,189,1,196,1,198,1,196,1,197,1,197,1,198,1,199,1,201,1,199,1,200,1,200,1,201,1,202,1,204,1,202,1,203,1,203,1,204,1,241,1,243,1,241,1,242,1,242,1,243,1,244,1,245,1,246,1,149,1,247,1,191,1,32,2,158,1,134,3,172,3,136,3,173,3,137,3,174,3,138,3,175,3,140,3,204,3,142,3,205,3,143,3,206,3,153,3,69,3,153,3,190,31,163,3,194,3,247,3,248,3,250,3,251,3,96,30,155,30,158,30,223,0,89,31,81,31,91,31,83,31,93,31,85,31,95,31,87,31,188,31,179,31,204,31,195,31,236,31,229,31,252,31,243,31,58,2,101,44,59,2,60,2,61,2,154,1,62,2,102,44,65,2,66,2,67,2,128,1,68,2,137,2,69,2,140,2,244,3,184,3,249,3,242,3,253,3,123,3,254,3,124,3,255,3,125,3,192,4,207,4,38,33,201,3,42,33,107,0,43,33,229,0,50,33,78,33,131,33,132,33,96,44,97,44,98,44,107,2,99,44,125,29,100,44,125,2,109,44,81,2,110,44,113,2,111,44,80,2,112,44,82,2,114,44,115,44,117,44,118,44,126,44,63,2,127,44,64,2,242,44,243,44,125,167,121,29,139,167,140,167,141,167,101,2,170,167,102,2,199,16,39,45,205,16,45,45,118,3,119,3,156,3,181,0,146,3,208,3,152,3,209,3,166,3,213,3,160,3,214,3,154,3,240,3,161,3,241,3,149,3,245,3,207,3,215,3,0,0,0,0,65,0,32,26,192,0,32,31,0,1,1,47,50,1,1,5,57,1,1,15,74,1,1,45,121,1,1,5,112,3,1,3,145,3,32,17,163,3,32,9,0,4,80,16,16,4,32,32,96,4,1,33,138,4,1,53,193,4,1,13,208,4,1,63,20,5,1,19,49,5,48,38,160,1,1,5,179,1,1,3,205,1,1,15,222,1,1,17,248,1,1,39,34,2,1,17,216,3,1,23,0,30,1,149,160,30,1,95,8,31,248,8,24,31,248,6,40,31,248,8,56,31,248,8,72,31,248,6,104,31,248,8,136,31,248,8,152,31,248,8,168,31,248,8,184,31,248,2,186,31,182,2,200,31,170,4,216,31,248,2,218,31,156,2,232,31,248,2,234,31,144,2,248,31,128,2,250,31,130,2,70,2,1,9,16,5,1,3,96,33,16,16,0,44,48,47,103,44,1,5,128,44,1,99,235,44,1,3,64,166,1,45,128,166,1,23,34,167,1,13,50,167,1,61,121,167,1,3,126,167,1,9,144,167,1,3,160,167,1,9,33,255,32,26,0,0,0,0,47,102,111,111,47,91,48,45,57,93,43,36,0,47,102,111,111,47,97,98,99,0,18,17,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,17,34,35,36,17,37,38,39,40,41,42,43,44,17,45,46,47,16,16,48,16,16,16,16,16,16,16,49,50,51,16,52,53,16,16,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,54,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,55,17,17,17,17,56,17,57,58,59,60,61,62,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,17,63,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,17,64,65,17,66,67,68,69,70,71,72,73,16,16,16,74,75,76,77,78,16,16,16,79,80,16,16,16,16,81,16,16,16,16,16,16,16,16,16,17,17,17,82,83,16,16,16,16,16,16,16,16,16,16,16,17,17,17,17,84,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,17,17,85,16,16,16,16,86,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,87,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,88,89,90,91,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,92,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,254,255,255,7,254,255,255,7,0,0,0,0,0,4,32,4,255,255,127,255,255,255,127,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,195,255,3,0,31,80,0,0,0,0,0,0,0,0,0,0,32,0,0,0,0,0,223,60,64,215,255,255,251,255,255,255,255,255,255,255,255,255,191,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,3,252,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,254,255,255,255,127,2,254,255,255,255,255,0,0,0,0,0,255,191,182,0,255,255,255,7,7,0,0,0,255,7,255,255,255,255,255,255,255,254,255,195,255,255,255,255,255,255,255,255,255,255,255,255,239,31,254,225,255,159,0,0,255,255,255,255,255,255,0,224,255,255,255,255,255,255,255,255,255,255,255,255,3,0,255,255,255,255,255,7,48,4,255,255,255,252,255,31,0,0,255,255,255,1,0,0,0,0,0,0,0,0,253,31,0,0,0,0,0,0,240,3,255,127,255,255,255,255,255,255,255,239,255,223,225,255,207,255,254,254,238,159,249,255,255,253,197,227,159,89,128,176,207,255,3,0,238,135,249,255,255,253,109,195,135,25,2,94,192,255,63,0,238,191,251,255,255,253,237,227,191,27,1,0,207,255,0,0,238,159,249,255,255,253,237,227,159,25,192,176,207,255,2,0,236,199,61,214,24,199,255,195,199,29,129,0,192,255,0,0,238,223,253,255,255,253,239,227,223,29,96,3,207,255,0,0,236,223,253,255,255,253,239,227,223,29,96,64,207,255,6,0,236,223,253,255,255,255,255,231,223,93,128,0,207,255,0,252,236,255,127,252,255,255,251,47,127,128,95,255,0,0,12,0,254,255,255,255,255,127,255,7,63,32,255,3,0,0,0,0,150,37,240,254,174,236,255,59,95,32,255,243,0,0,0,0,1,0,0,0,255,3,0,0,255,254,255,255,255,31,254,255,3,255,255,254,255,255,255,31,0,0,0,0,0,0,0,0,255,255,255,255,255,255,127,249,255,3,255,255,231,193,255,255,127,64,255,51,255,255,255,255,191,32,255,255,255,255,255,247,255,255,255,255,255,255,255,255,255,61,127,61,255,255,255,255,255,61,255,255,255,255,61,127,61,255,127,255,255,255,255,255,255,255,61,255,255,255,255,255,255,255,255,135,0,0,0,0,255,255,0,0,255,255,255,255,255,255,255,255,255,255,31,0,254,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,159,255,255,254,255,255,7,255,255,255,255,255,255,255,255,255,199,1,0,255,223,15,0,255,255,15,0,255,255,15,0,255,223,13,0,255,255,255,255,255,255,207,255,255,1,128,16,255,3,0,0,0,0,255,3,255,255,255,255,255,255,255,255,255,255,255,0,255,255,255,255,255,7,255,255,255,255,255,255,255,255,63,0,255,255,255,31,255,15,255,1,192,255,255,255,255,63,31,0,255,255,255,255,255,15,255,255,255,3,255,3,0,0,0,0,255,255,255,15,255,255,255,255,255,255,255,127,254,255,31,0,255,3,255,3,128,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,239,255,239,15,255,3,0,0,0,0,255,255,255,255,255,243,255,255,255,255,255,255,191,255,3,0,255,255,255,255,255,255,63,0,255,227,255,255,255,255,255,63,0,0,0,0,0,0,0,0,0,0,0,0,0,222,111,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,255,255,63,63,255,255,255,255,63,63,255,170,255,255,255,63,255,255,255,255,255,255,223,95,220,31,207,15,255,31,220,31,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,128,0,0,255,31,0,0,0,0,0,0,0,0,0,0,0,0,132,252,47,62,80,189,255,243,224,67,0,0,255,255,255,255,255,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,192,255,255,255,255,255,255,3,0,0,255,255,255,255,255,127,255,255,255,255,255,127,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,31,120,12,0,255,255,255,255,191,32,255,255,255,255,255,255,255,128,0,0,255,255,127,0,127,127,127,127,127,127,127,127,255,255,255,255,0,0,0,0,0,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,224,0,0,0,254,3,62,31,254,255,255,255,255,255,255,255,255,255,127,224,254,255,255,255,255,255,255,255,255,255,255,247,224,255,255,255,255,63,254,255,255,255,255,255,255,255,255,255,255,127,0,0,255,255,255,7,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,63,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,31,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,31,0,0,0,0,0,0,0,0,255,255,255,255,255,63,255,31,255,255,255,15,0,0,255,255,255,255,255,127,240,143,255,255,255,128,255,255,255,255,255,255,255,255,255,255,0,0,0,0,128,255,252,255,255,255,255,255,255,255,255,255,255,255,255,121,15,0,255,7,0,0,0,0,0,0,0,0,0,255,187,247,255,255,255,0,0,0,255,255,255,255,255,255,15,0,255,255,255,255,255,255,255,255,15,0,255,3,0,0,252,8,255,255,255,255,255,7,255,255,255,255,7,0,255,255,255,31,255,255,255,255,255,255,247,255,0,128,255,3,0,0,0,0,255,255,255,255,255,255,127,0,255,63,255,3,255,255,127,4,255,255,255,255,255,255,255,127,5,0,0,56,255,255,60,0,126,126,126,0,127,127,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,7,255,3,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,15,0,255,255,127,248,255,255,255,255,255,15,255,255,255,255,255,255,255,255,255,255,255,255,255,63,255,255,255,255,255,255,255,255,255,255,255,255,255,3,0,0,0,0,127,0,248,224,255,253,127,95,219,255,255,255,255,255,255,255,255,255,255,255,255,255,3,0,0,0,248,255,255,255,255,255,255,255,255,255,255,255,255,63,0,0,255,255,255,255,255,255,255,255,252,255,255,255,255,255,255,0,0,0,0,0,255,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0,223,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,31,0,0,255,3,254,255,255,7,254,255,255,7,192,255,255,255,255,255,255,255,255,255,255,127,252,252,252,28,0,0,0,0,255,239,255,255,127,255,255,183,255,63,255,63,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,7,0,0,0,0,0,0,0,0,255,255,255,255,255,255,31,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,31,255,255,255,255,255,255,1,0,0,0,0,0,255,255,255,127,0,0,255,255,255,7,0,0,0,0,0,0,255,255,255,63,255,255,255,255,15,255,62,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,63,255,3,0,0,0,0,0,0,0,0,0,0,63,253,255,255,255,255,191,145,255,255,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,63,0,255,255,255,3,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,192,0,0,0,0,0,0,0,0,111,240,239,254,255,255,15,0,0,0,0,0,255,255,255,31,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,63,0,255,255,63,0,255,255,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,63,0,0,0,192,255,0,0,252,255,255,255,255,255,255,1,0,0,255,255,255,1,255,3,255,255,255,255,255,255,199,255,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,30,0,255,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,63,0,255,3,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,127,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,127,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,31,0,255,255,255,255,255,127,0,0,248,255,0,0,0,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,223,255,255,255,255,255,255,255,255,223,100,222,255,235,239,255,255,255,255,255,255,255,191,231,223,223,255,255,255,123,95,252,253,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,63,255,255,255,253,255,255,247,255,255,255,247,255,255,223,255,255,255,223,255,255,127,255,255,255,127,255,255,255,253,255,255,255,253,255,255,247,207,255,255,255,255,255,255,239,255,255,255,150,254,247,10,132,234,150,170,150,247,247,94,255,251,255,15,238,251,255,15,0,0,0,0,0,0,0,0,18,16,19,20,21,22,23,24,25,26,27,28,29,30,31,32,33,16,16,34,35,16,36,37,38,39,40,41,42,43,16,44,45,46,17,47,48,17,17,49,17,17,17,50,51,52,53,54,55,56,57,17,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,58,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,59,16,60,61,62,63,64,65,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,66,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,67,16,16,68,16,69,70,71,16,72,16,73,16,16,16,16,74,75,76,77,16,16,78,16,79,80,16,16,16,16,81,16,16,16,16,16,16,16,16,16,16,16,16,16,82,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,83,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,84,85,86,87,16,16,88,89,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,16,90,16,91,92,93,94,95,96,97,98,16,16,16,16,16,16,16,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,0,0,0,0,254,255,0,252,1,0,0,248,1,0,0,120,0,0,0,0,255,251,223,251,0,0,128,0,0,0,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,60,0,252,255,224,175,255,255,255,255,255,255,255,255,255,255,223,255,255,255,255,255,32,64,176,0,0,0,0,0,0,0,0,0,0,0,0,0,64,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,0,0,0,0,0,134,254,255,255,255,0,64,73,0,0,0,0,0,24,0,223,255,0,200,0,0,0,0,0,0,0,1,0,60,0,0,0,0,0,0,0,0,0,0,0,0,16,224,1,30,0,96,255,191,0,0,0,0,0,0,255,7,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,248,207,3,0,0,0,3,0,32,255,127,0,0,0,78,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,0,0,0,0,0,0,0,0,0,16,0,32,30,0,48,0,1,0,0,0,0,0,0,0,0,16,0,32,0,0,0,0,252,15,0,0,0,0,0,0,0,16,0,32,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,32,0,0,0,0,3,0,0,0,0,0,0,0,0,16,0,32,0,0,0,0,253,0,0,0,0,0,0,0,0,0,0,32,0,0,0,0,255,7,0,0,0,0,0,0,0,0,0,32,0,0,0,0,0,255,0,0,0,0,0,0,0,16,0,32,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,32,0,0,0,0,63,2,0,0,0,0,0,0,0,0,0,4,0,0,0,0,16,0,0,0,0,0,0,128,0,128,192,223,0,12,0,0,0,0,0,0,0,0,0,0,0,0,0,31,0,0,0,0,0,0,254,255,255,255,0,252,255,255,0,0,0,0,0,0,0,0,252,0,0,0,0,0,0,192,255,223,255,7,0,0,0,0,0,0,0,0,0,0,128,6,0,252,0,0,24,62,0,0,128,191,0,204,0,0,0,0,0,0,0,0,0,0,0,8,0,0,0,0,0,0,0,0,0,0,0,96,255,255,255,31,0,0,255,3,0,0,0,0,0,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,96,0,0,1,0,0,24,0,0,0,0,0,0,0,0,0,56,0,0,0,0,16,0,0,0,112,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,48,0,0,254,127,47,0,0,255,3,255,127,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,14,49,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,196,255,255,255,255,0,0,0,192,0,0,0,0,0,0,0,0,1,0,224,159,0,0,0,0,127,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,16,0,16,0,0,252,255,255,255,31,0,0,0,0,0,12,0,0,0,0,0,0,64,0,12,240,0,0,0,0,0,0,192,248,0,0,0,0,0,0,0,192,0,0,0,0,0,0,0,0,255,0,255,255,255,33,16,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,127,0,0,240,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,160,3,224,0,224,0,224,0,96,128,248,255,255,255,252,255,255,255,255,255,127,31,252,241,127,255,127,0,0,255,255,255,3,0,0,255,255,255,255,1,0,123,3,208,193,175,66,0,12,31,188,255,255,0,0,0,0,0,2,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,15,0,255,255,255,255,127,0,0,0,255,7,0,0,255,255,255,255,255,255,255,255,255,255,63,0,0,0,0,0,0,252,255,255,254,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,31,255,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,224,135,3,254,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,127,255,15,0,0,0,0,0,0,0,0,255,255,255,251,255,255,255,255,255,255,255,255,255,255,15,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,63,0,0,0,255,15,30,255,255,255,1,252,193,224,0,0,0,0,0,0,0,0,0,0,0,30,1,0,0,0,0,0,0,0,0,0,0,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,0,0,0,0,255,255,255,255,15,0,0,0,255,255,255,127,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,127,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,127,0,0,0,0,0,0,192,0,224,0,0,0,0,0,0,0,0,0,0,0,128,15,112,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,0,255,255,127,0,3,0,0,0,0,0,0,0,0,0,0,0,0,6,0,0,0,0,0,0,0,0,0,0,0,0,0,0,68,8,0,0,0,15,255,3,0,0,0,0,0,0,240,0,0,0,0,0,0,0,0,0,16,192,0,0,255,255,3,7,0,0,0,0,0,248,0,0,0,0,8,128,0,0,0,0,0,0,0,0,0,0,8,0,255,63,0,192,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,240,0,0,128,11,0,0,0,0,0,0,0,128,2,0,0,192,0,0,67,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,56,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,0,0,0,0,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,252,255,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,192,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,48,255,255,255,3,127,0,255,255,255,255,247,255,127,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,254,255,0,252,1,0,0,248,1,0,0,248,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,127,127,0,48,135,255,255,255,255,255,143,255,0,0,0,0,0,0,224,255,255,7,255,15,0,0,0,0,0,0,255,255,255,255,255,63,0,0,0,0,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,0,0,0,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,192,143,0,0,0,128,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,135,255,0,255,1,0,0,0,224,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,254,0,0,0,255,0,0,0,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,127,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,192,63,252,255,63,0,0,0,3,0,0,0,0,0,0,254,3,0,0,0,0,0,0,0,0,0,0,0,0,0,24,0,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,225,1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,192,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,128,7,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,63,0,255,255,255,255,127,254,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,63,0,0,0,0,255,255,255,255,255,255,255,255,63,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,127,0,255,255,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,0,0,8,0,0,0,8,0,0,32,0,0,0,32,0,0,128,0,0,0,128,0,0,0,2,0,0,0,2,0,0,8,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,3,0,255,255,255,255,255,15,255,255,255,255,255,255,255,255,255,255,255,255,15,0,255,127,254,127,254,255,254,255,0,0,0,0,255,7,255,255,255,127,255,255,255,255,255,255,255,15,255,255,255,255,255,7,0,0,0,0,0,0,0,0,192,255,255,255,7,0,255,255,255,255,255,7,255,1,3,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,255,255,255,255,1,0,191,255,255,255,255,255,255,255,255,31,255,255,15,0,255,255,255,255,223,7,0,0,255,255,1,0,255,255,255,255,255,255,255,127,253,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,255,30,255,255,255,255,255,255,255,63,15,0,255,255,255,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,248,255,255,255,255,255,255,255,255,225,255,0,0,0,0,0,0,255,255,255,255,255,255,255,255,63,0,0,0,0,0,0,0,255,255,255,255,255,255,255,255,255,255,255,255,255,255,15,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,97,108,110,117,109,0,97,108,112,104,97,0,98,108,97,110,107,0,99,110,116,114,108,0,100,105,103,105,116,0,103,114,97,112,104,0,108,111,119,101,114,0,112,114,105,110,116,0,112,117,110,99,116,0,115,112,97,99,101,0,117,112,112,101,114,0,120,100,105,103,105,116,0,9,0,10,0,13,0,12,0,7,0,27,0,91,91,58,97,108,110,117,109,58,93,95,93,0,91,94,91,58,97,108,110,117,109,58,93,95,93,0,91,91,58,115,112,97,99,101,58,93,93,0,91,94,91,58,115,112,97,99,101,58,93,93,0,91,91,58,100,105,103,105,116,58,93,93,0,91,94,91,58,100,105,103,105,116,58,93,93,0], "i8", ALLOC_NONE, Runtime.GLOBAL_BASE);





/* no memory initializer */
var tempDoublePtr = STATICTOP; STATICTOP += 16;

assert(tempDoublePtr % 8 == 0);

function copyTempFloat(ptr) { // functions, because inlining this code increases code size too much

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

}

function copyTempDouble(ptr) {

  HEAP8[tempDoublePtr] = HEAP8[ptr];

  HEAP8[tempDoublePtr+1] = HEAP8[ptr+1];

  HEAP8[tempDoublePtr+2] = HEAP8[ptr+2];

  HEAP8[tempDoublePtr+3] = HEAP8[ptr+3];

  HEAP8[tempDoublePtr+4] = HEAP8[ptr+4];

  HEAP8[tempDoublePtr+5] = HEAP8[ptr+5];

  HEAP8[tempDoublePtr+6] = HEAP8[ptr+6];

  HEAP8[tempDoublePtr+7] = HEAP8[ptr+7];

}

// {{PRE_LIBRARY}}


  
  function ___setErrNo(value) {
      if (Module['___errno_location']) HEAP32[((Module['___errno_location']())>>2)]=value;
      else Module.printErr('failed to set errno from JS');
      return value;
    } 

   

  function ___lock() {}

  
  function _emscripten_memcpy_big(dest, src, num) {
      HEAPU8.set(HEAPU8.subarray(src, src+num), dest);
      return dest;
    } 

  
  var SYSCALLS={varargs:0,get:function (varargs) {
        SYSCALLS.varargs += 4;
        var ret = HEAP32[(((SYSCALLS.varargs)-(4))>>2)];
        return ret;
      },getStr:function () {
        var ret = Pointer_stringify(SYSCALLS.get());
        return ret;
      },get64:function () {
        var low = SYSCALLS.get(), high = SYSCALLS.get();
        if (low >= 0) assert(high === 0);
        else assert(high === -1);
        return low;
      },getZero:function () {
        assert(SYSCALLS.get() === 0);
      }};function ___syscall140(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // llseek
      var stream = SYSCALLS.getStreamFromFD(), offset_high = SYSCALLS.get(), offset_low = SYSCALLS.get(), result = SYSCALLS.get(), whence = SYSCALLS.get();
      // NOTE: offset_high is unused - Emscripten's off_t is 32-bit
      var offset = offset_low;
      FS.llseek(stream, offset, whence);
      HEAP32[((result)>>2)]=stream.position;
      if (stream.getdents && offset === 0 && whence === 0) stream.getdents = null; // reset readdir state
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall146(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // writev
      // hack to support printf in NO_FILESYSTEM
      var stream = SYSCALLS.get(), iov = SYSCALLS.get(), iovcnt = SYSCALLS.get();
      var ret = 0;
      if (!___syscall146.buffer) {
        ___syscall146.buffers = [null, [], []]; // 1 => stdout, 2 => stderr
        ___syscall146.printChar = function(stream, curr) {
          var buffer = ___syscall146.buffers[stream];
          assert(buffer);
          if (curr === 0 || curr === 10) {
            (stream === 1 ? Module['print'] : Module['printErr'])(UTF8ArrayToString(buffer, 0));
            buffer.length = 0;
          } else {
            buffer.push(curr);
          }
        };
      }
      for (var i = 0; i < iovcnt; i++) {
        var ptr = HEAP32[(((iov)+(i*8))>>2)];
        var len = HEAP32[(((iov)+(i*8 + 4))>>2)];
        for (var j = 0; j < len; j++) {
          ___syscall146.printChar(stream, HEAPU8[ptr+j]);
        }
        ret += len;
      }
      return ret;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___syscall54(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // ioctl
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }

  function ___unlock() {}

  function ___syscall6(which, varargs) {SYSCALLS.varargs = varargs;
  try {
   // close
      var stream = SYSCALLS.getStreamFromFD();
      FS.close(stream);
      return 0;
    } catch (e) {
    if (typeof FS === 'undefined' || !(e instanceof FS.ErrnoError)) abort(e);
    return -e.errno;
  }
  }
/* flush anything remaining in the buffer during shutdown */ __ATEXIT__.push(function() { var fflush = Module["_fflush"]; if (fflush) fflush(0); var printChar = ___syscall146.printChar; if (!printChar) return; var buffers = ___syscall146.buffers; if (buffers[1].length) printChar(1, 10); if (buffers[2].length) printChar(2, 10); });;
DYNAMICTOP_PTR = allocate(1, "i32", ALLOC_STATIC);

STACK_BASE = STACKTOP = Runtime.alignMemory(STATICTOP);

STACK_MAX = STACK_BASE + TOTAL_STACK;

DYNAMIC_BASE = Runtime.alignMemory(STACK_MAX);

HEAP32[DYNAMICTOP_PTR>>2] = DYNAMIC_BASE;

staticSealed = true; // seal the static portion of memory

assert(DYNAMIC_BASE < TOTAL_MEMORY, "TOTAL_MEMORY not big enough for stack");


function nullFunc_ii(x) { Module["printErr"]("Invalid function pointer called with signature 'ii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iiii(x) { Module["printErr"]("Invalid function pointer called with signature 'iiii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function nullFunc_iii(x) { Module["printErr"]("Invalid function pointer called with signature 'iii'. Perhaps this is an invalid value (e.g. caused by calling a virtual method on a NULL pointer)? Or calling a function with an incorrect type, which will fail? (it is worth building your source files with -Werror (warnings are errors), as warnings can indicate undefined behavior which can cause this)");  Module["printErr"]("Build with ASSERTIONS=2 for more info.");abort(x) }

function invoke_ii(index,a1) {
  try {
    return Module["dynCall_ii"](index,a1);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iiii(index,a1,a2,a3) {
  try {
    return Module["dynCall_iiii"](index,a1,a2,a3);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

function invoke_iii(index,a1,a2) {
  try {
    return Module["dynCall_iii"](index,a1,a2);
  } catch(e) {
    if (typeof e !== 'number' && e !== 'longjmp') throw e;
    Module["setThrew"](1, 0);
  }
}

Module.asmGlobalArg = { "Math": Math, "Int8Array": Int8Array, "Int16Array": Int16Array, "Int32Array": Int32Array, "Uint8Array": Uint8Array, "Uint16Array": Uint16Array, "Uint32Array": Uint32Array, "Float32Array": Float32Array, "Float64Array": Float64Array, "NaN": NaN, "Infinity": Infinity };

Module.asmLibraryArg = { "abort": abort, "assert": assert, "enlargeMemory": enlargeMemory, "getTotalMemory": getTotalMemory, "abortOnCannotGrowMemory": abortOnCannotGrowMemory, "abortStackOverflow": abortStackOverflow, "nullFunc_ii": nullFunc_ii, "nullFunc_iiii": nullFunc_iiii, "nullFunc_iii": nullFunc_iii, "invoke_ii": invoke_ii, "invoke_iiii": invoke_iiii, "invoke_iii": invoke_iii, "___lock": ___lock, "___syscall6": ___syscall6, "___setErrNo": ___setErrNo, "___syscall140": ___syscall140, "_emscripten_memcpy_big": _emscripten_memcpy_big, "___syscall54": ___syscall54, "___unlock": ___unlock, "___syscall146": ___syscall146, "DYNAMICTOP_PTR": DYNAMICTOP_PTR, "tempDoublePtr": tempDoublePtr, "ABORT": ABORT, "STACKTOP": STACKTOP, "STACK_MAX": STACK_MAX };
// EMSCRIPTEN_START_ASM
var asm = (function(global, env, buffer) {
'almost asm';


  var HEAP8 = new global.Int8Array(buffer);
  var HEAP16 = new global.Int16Array(buffer);
  var HEAP32 = new global.Int32Array(buffer);
  var HEAPU8 = new global.Uint8Array(buffer);
  var HEAPU16 = new global.Uint16Array(buffer);
  var HEAPU32 = new global.Uint32Array(buffer);
  var HEAPF32 = new global.Float32Array(buffer);
  var HEAPF64 = new global.Float64Array(buffer);

  var DYNAMICTOP_PTR=env.DYNAMICTOP_PTR|0;
  var tempDoublePtr=env.tempDoublePtr|0;
  var ABORT=env.ABORT|0;
  var STACKTOP=env.STACKTOP|0;
  var STACK_MAX=env.STACK_MAX|0;

  var __THREW__ = 0;
  var threwValue = 0;
  var setjmpId = 0;
  var undef = 0;
  var nan = global.NaN, inf = global.Infinity;
  var tempInt = 0, tempBigInt = 0, tempBigIntS = 0, tempValue = 0, tempDouble = 0.0;
  var tempRet0 = 0;

  var Math_floor=global.Math.floor;
  var Math_abs=global.Math.abs;
  var Math_sqrt=global.Math.sqrt;
  var Math_pow=global.Math.pow;
  var Math_cos=global.Math.cos;
  var Math_sin=global.Math.sin;
  var Math_tan=global.Math.tan;
  var Math_acos=global.Math.acos;
  var Math_asin=global.Math.asin;
  var Math_atan=global.Math.atan;
  var Math_atan2=global.Math.atan2;
  var Math_exp=global.Math.exp;
  var Math_log=global.Math.log;
  var Math_ceil=global.Math.ceil;
  var Math_imul=global.Math.imul;
  var Math_min=global.Math.min;
  var Math_max=global.Math.max;
  var Math_clz32=global.Math.clz32;
  var abort=env.abort;
  var assert=env.assert;
  var enlargeMemory=env.enlargeMemory;
  var getTotalMemory=env.getTotalMemory;
  var abortOnCannotGrowMemory=env.abortOnCannotGrowMemory;
  var abortStackOverflow=env.abortStackOverflow;
  var nullFunc_ii=env.nullFunc_ii;
  var nullFunc_iiii=env.nullFunc_iiii;
  var nullFunc_iii=env.nullFunc_iii;
  var invoke_ii=env.invoke_ii;
  var invoke_iiii=env.invoke_iiii;
  var invoke_iii=env.invoke_iii;
  var ___lock=env.___lock;
  var ___syscall6=env.___syscall6;
  var ___setErrNo=env.___setErrNo;
  var ___syscall140=env.___syscall140;
  var _emscripten_memcpy_big=env._emscripten_memcpy_big;
  var ___syscall54=env.___syscall54;
  var ___unlock=env.___unlock;
  var ___syscall146=env.___syscall146;
  var tempFloat = 0.0;

// EMSCRIPTEN_START_FUNCS

function stackAlloc(size) {
  size = size|0;
  var ret = 0;
  ret = STACKTOP;
  STACKTOP = (STACKTOP + size)|0;
  STACKTOP = (STACKTOP + 15)&-16;
  if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(size|0);

  return ret|0;
}
function stackSave() {
  return STACKTOP|0;
}
function stackRestore(top) {
  top = top|0;
  STACKTOP = top;
}
function establishStackSpace(stackBase, stackMax) {
  stackBase = stackBase|0;
  stackMax = stackMax|0;
  STACKTOP = stackBase;
  STACK_MAX = stackMax;
}

function setThrew(threw, value) {
  threw = threw|0;
  value = value|0;
  if ((__THREW__|0) == 0) {
    __THREW__ = threw;
    threwValue = value;
  }
}

function setTempRet0(value) {
  value = value|0;
  tempRet0 = value;
}
function getTempRet0() {
  return tempRet0|0;
}

function _reg_matches($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$expand_i1_val = 0, $$expand_i1_val2 = 0, $$expand_i1_val4 = 0, $$pre_trunc = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 64|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(64|0);
 $2 = sp + 48|0;
 $5 = sp + 8|0;
 $3 = $0;
 $4 = $1;
 $7 = $4;
 $8 = (_regcomp($5,$7,1)|0);
 $9 = ($8|0)!=(0);
 do {
  if ($9) {
   $$expand_i1_val = 0;
   HEAP8[$2>>0] = $$expand_i1_val;
  } else {
   $10 = $3;
   $11 = (_regexec($5,$10,0,0,0)|0);
   $6 = $11;
   _regfree($5);
   $12 = $6;
   $13 = ($12|0)==(0);
   if ($13) {
    $$expand_i1_val2 = 1;
    HEAP8[$2>>0] = $$expand_i1_val2;
    break;
   } else {
    $$expand_i1_val4 = 0;
    HEAP8[$2>>0] = $$expand_i1_val4;
    break;
   }
  }
 } while(0);
 $$pre_trunc = HEAP8[$2>>0]|0;
 $14 = $$pre_trunc&1;
 STACKTOP = sp;return ($14|0);
}
function _main() {
 var $0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $0 = 0;
 $1 = HEAP32[2]|0;
 $2 = (_reg_matches(1529,$1)|0);
 if ($2) {
  $0 = 0;
 } else {
  $0 = 1;
 }
 $3 = $0;
 STACKTOP = sp;return ($3|0);
}
function _malloc($0) {
 $0 = $0|0;
 var $$$0172$i = 0, $$$0173$i = 0, $$$4236$i = 0, $$$4329$i = 0, $$$i = 0, $$0 = 0, $$0$i = 0, $$0$i$i = 0, $$0$i$i$i = 0, $$0$i20$i = 0, $$01$i$i = 0, $$0172$lcssa$i = 0, $$01726$i = 0, $$0173$lcssa$i = 0, $$01735$i = 0, $$0192 = 0, $$0194 = 0, $$0201$i$i = 0, $$0202$i$i = 0, $$0206$i$i = 0;
 var $$0207$i$i = 0, $$024370$i = 0, $$0260$i$i = 0, $$0261$i$i = 0, $$0262$i$i = 0, $$0268$i$i = 0, $$0269$i$i = 0, $$0320$i = 0, $$0322$i = 0, $$0323$i = 0, $$0325$i = 0, $$0331$i = 0, $$0336$i = 0, $$0337$$i = 0, $$0337$i = 0, $$0339$i = 0, $$0340$i = 0, $$0345$i = 0, $$1176$i = 0, $$1178$i = 0;
 var $$124469$i = 0, $$1264$i$i = 0, $$1266$i$i = 0, $$1321$i = 0, $$1326$i = 0, $$1341$i = 0, $$1347$i = 0, $$1351$i = 0, $$2234243136$i = 0, $$2247$ph$i = 0, $$2253$ph$i = 0, $$2333$i = 0, $$3$i = 0, $$3$i$i = 0, $$3$i200 = 0, $$3328$i = 0, $$3349$i = 0, $$4$lcssa$i = 0, $$4$ph$i = 0, $$411$i = 0;
 var $$4236$i = 0, $$4329$lcssa$i = 0, $$432910$i = 0, $$4335$$4$i = 0, $$4335$ph$i = 0, $$43359$i = 0, $$723947$i = 0, $$748$i = 0, $$pre = 0, $$pre$i = 0, $$pre$i$i = 0, $$pre$i17$i = 0, $$pre$i195 = 0, $$pre$i210 = 0, $$pre$phi$i$iZ2D = 0, $$pre$phi$i18$iZ2D = 0, $$pre$phi$i211Z2D = 0, $$pre$phi$iZ2D = 0, $$pre$phiZ2D = 0, $$sink1$i = 0;
 var $$sink1$i$i = 0, $$sink14$i = 0, $$sink2$i = 0, $$sink2$i204 = 0, $$sink3$i = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0;
 var $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0;
 var $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0;
 var $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0;
 var $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0;
 var $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0;
 var $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0;
 var $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0;
 var $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0;
 var $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0;
 var $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0;
 var $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $3 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0;
 var $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0;
 var $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0;
 var $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0;
 var $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0;
 var $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $4 = 0, $40 = 0;
 var $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0, $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0;
 var $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0, $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0;
 var $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0, $445 = 0, $446 = 0, $447 = 0, $448 = 0, $449 = 0, $45 = 0, $450 = 0, $451 = 0, $452 = 0, $453 = 0, $454 = 0;
 var $455 = 0, $456 = 0, $457 = 0, $458 = 0, $459 = 0, $46 = 0, $460 = 0, $461 = 0, $462 = 0, $463 = 0, $464 = 0, $465 = 0, $466 = 0, $467 = 0, $468 = 0, $469 = 0, $47 = 0, $470 = 0, $471 = 0, $472 = 0;
 var $473 = 0, $474 = 0, $475 = 0, $476 = 0, $477 = 0, $478 = 0, $479 = 0, $48 = 0, $480 = 0, $481 = 0, $482 = 0, $483 = 0, $484 = 0, $485 = 0, $486 = 0, $487 = 0, $488 = 0, $489 = 0, $49 = 0, $490 = 0;
 var $491 = 0, $492 = 0, $493 = 0, $494 = 0, $495 = 0, $496 = 0, $497 = 0, $498 = 0, $499 = 0, $5 = 0, $50 = 0, $500 = 0, $501 = 0, $502 = 0, $503 = 0, $504 = 0, $505 = 0, $506 = 0, $507 = 0, $508 = 0;
 var $509 = 0, $51 = 0, $510 = 0, $511 = 0, $512 = 0, $513 = 0, $514 = 0, $515 = 0, $516 = 0, $517 = 0, $518 = 0, $519 = 0, $52 = 0, $520 = 0, $521 = 0, $522 = 0, $523 = 0, $524 = 0, $525 = 0, $526 = 0;
 var $527 = 0, $528 = 0, $529 = 0, $53 = 0, $530 = 0, $531 = 0, $532 = 0, $533 = 0, $534 = 0, $535 = 0, $536 = 0, $537 = 0, $538 = 0, $539 = 0, $54 = 0, $540 = 0, $541 = 0, $542 = 0, $543 = 0, $544 = 0;
 var $545 = 0, $546 = 0, $547 = 0, $548 = 0, $549 = 0, $55 = 0, $550 = 0, $551 = 0, $552 = 0, $553 = 0, $554 = 0, $555 = 0, $556 = 0, $557 = 0, $558 = 0, $559 = 0, $56 = 0, $560 = 0, $561 = 0, $562 = 0;
 var $563 = 0, $564 = 0, $565 = 0, $566 = 0, $567 = 0, $568 = 0, $569 = 0, $57 = 0, $570 = 0, $571 = 0, $572 = 0, $573 = 0, $574 = 0, $575 = 0, $576 = 0, $577 = 0, $578 = 0, $579 = 0, $58 = 0, $580 = 0;
 var $581 = 0, $582 = 0, $583 = 0, $584 = 0, $585 = 0, $586 = 0, $587 = 0, $588 = 0, $589 = 0, $59 = 0, $590 = 0, $591 = 0, $592 = 0, $593 = 0, $594 = 0, $595 = 0, $596 = 0, $597 = 0, $598 = 0, $599 = 0;
 var $6 = 0, $60 = 0, $600 = 0, $601 = 0, $602 = 0, $603 = 0, $604 = 0, $605 = 0, $606 = 0, $607 = 0, $608 = 0, $609 = 0, $61 = 0, $610 = 0, $611 = 0, $612 = 0, $613 = 0, $614 = 0, $615 = 0, $616 = 0;
 var $617 = 0, $618 = 0, $619 = 0, $62 = 0, $620 = 0, $621 = 0, $622 = 0, $623 = 0, $624 = 0, $625 = 0, $626 = 0, $627 = 0, $628 = 0, $629 = 0, $63 = 0, $630 = 0, $631 = 0, $632 = 0, $633 = 0, $634 = 0;
 var $635 = 0, $636 = 0, $637 = 0, $638 = 0, $639 = 0, $64 = 0, $640 = 0, $641 = 0, $642 = 0, $643 = 0, $644 = 0, $645 = 0, $646 = 0, $647 = 0, $648 = 0, $649 = 0, $65 = 0, $650 = 0, $651 = 0, $652 = 0;
 var $653 = 0, $654 = 0, $655 = 0, $656 = 0, $657 = 0, $658 = 0, $659 = 0, $66 = 0, $660 = 0, $661 = 0, $662 = 0, $663 = 0, $664 = 0, $665 = 0, $666 = 0, $667 = 0, $668 = 0, $669 = 0, $67 = 0, $670 = 0;
 var $671 = 0, $672 = 0, $673 = 0, $674 = 0, $675 = 0, $676 = 0, $677 = 0, $678 = 0, $679 = 0, $68 = 0, $680 = 0, $681 = 0, $682 = 0, $683 = 0, $684 = 0, $685 = 0, $686 = 0, $687 = 0, $688 = 0, $689 = 0;
 var $69 = 0, $690 = 0, $691 = 0, $692 = 0, $693 = 0, $694 = 0, $695 = 0, $696 = 0, $697 = 0, $698 = 0, $699 = 0, $7 = 0, $70 = 0, $700 = 0, $701 = 0, $702 = 0, $703 = 0, $704 = 0, $705 = 0, $706 = 0;
 var $707 = 0, $708 = 0, $709 = 0, $71 = 0, $710 = 0, $711 = 0, $712 = 0, $713 = 0, $714 = 0, $715 = 0, $716 = 0, $717 = 0, $718 = 0, $719 = 0, $72 = 0, $720 = 0, $721 = 0, $722 = 0, $723 = 0, $724 = 0;
 var $725 = 0, $726 = 0, $727 = 0, $728 = 0, $729 = 0, $73 = 0, $730 = 0, $731 = 0, $732 = 0, $733 = 0, $734 = 0, $735 = 0, $736 = 0, $737 = 0, $738 = 0, $739 = 0, $74 = 0, $740 = 0, $741 = 0, $742 = 0;
 var $743 = 0, $744 = 0, $745 = 0, $746 = 0, $747 = 0, $748 = 0, $749 = 0, $75 = 0, $750 = 0, $751 = 0, $752 = 0, $753 = 0, $754 = 0, $755 = 0, $756 = 0, $757 = 0, $758 = 0, $759 = 0, $76 = 0, $760 = 0;
 var $761 = 0, $762 = 0, $763 = 0, $764 = 0, $765 = 0, $766 = 0, $767 = 0, $768 = 0, $769 = 0, $77 = 0, $770 = 0, $771 = 0, $772 = 0, $773 = 0, $774 = 0, $775 = 0, $776 = 0, $777 = 0, $778 = 0, $779 = 0;
 var $78 = 0, $780 = 0, $781 = 0, $782 = 0, $783 = 0, $784 = 0, $785 = 0, $786 = 0, $787 = 0, $788 = 0, $789 = 0, $79 = 0, $790 = 0, $791 = 0, $792 = 0, $793 = 0, $794 = 0, $795 = 0, $796 = 0, $797 = 0;
 var $798 = 0, $799 = 0, $8 = 0, $80 = 0, $800 = 0, $801 = 0, $802 = 0, $803 = 0, $804 = 0, $805 = 0, $806 = 0, $807 = 0, $808 = 0, $809 = 0, $81 = 0, $810 = 0, $811 = 0, $812 = 0, $813 = 0, $814 = 0;
 var $815 = 0, $816 = 0, $817 = 0, $818 = 0, $819 = 0, $82 = 0, $820 = 0, $821 = 0, $822 = 0, $823 = 0, $824 = 0, $825 = 0, $826 = 0, $827 = 0, $828 = 0, $829 = 0, $83 = 0, $830 = 0, $831 = 0, $832 = 0;
 var $833 = 0, $834 = 0, $835 = 0, $836 = 0, $837 = 0, $838 = 0, $839 = 0, $84 = 0, $840 = 0, $841 = 0, $842 = 0, $843 = 0, $844 = 0, $845 = 0, $846 = 0, $847 = 0, $848 = 0, $849 = 0, $85 = 0, $850 = 0;
 var $851 = 0, $852 = 0, $853 = 0, $854 = 0, $855 = 0, $856 = 0, $857 = 0, $858 = 0, $859 = 0, $86 = 0, $860 = 0, $861 = 0, $862 = 0, $863 = 0, $864 = 0, $865 = 0, $866 = 0, $867 = 0, $868 = 0, $869 = 0;
 var $87 = 0, $870 = 0, $871 = 0, $872 = 0, $873 = 0, $874 = 0, $875 = 0, $876 = 0, $877 = 0, $878 = 0, $879 = 0, $88 = 0, $880 = 0, $881 = 0, $882 = 0, $883 = 0, $884 = 0, $885 = 0, $886 = 0, $887 = 0;
 var $888 = 0, $889 = 0, $89 = 0, $890 = 0, $891 = 0, $892 = 0, $893 = 0, $894 = 0, $895 = 0, $896 = 0, $897 = 0, $898 = 0, $899 = 0, $9 = 0, $90 = 0, $900 = 0, $901 = 0, $902 = 0, $903 = 0, $904 = 0;
 var $905 = 0, $906 = 0, $907 = 0, $908 = 0, $909 = 0, $91 = 0, $910 = 0, $911 = 0, $912 = 0, $913 = 0, $914 = 0, $915 = 0, $916 = 0, $917 = 0, $918 = 0, $919 = 0, $92 = 0, $920 = 0, $921 = 0, $922 = 0;
 var $923 = 0, $924 = 0, $925 = 0, $926 = 0, $927 = 0, $928 = 0, $929 = 0, $93 = 0, $930 = 0, $931 = 0, $932 = 0, $933 = 0, $934 = 0, $935 = 0, $936 = 0, $937 = 0, $938 = 0, $939 = 0, $94 = 0, $940 = 0;
 var $941 = 0, $942 = 0, $943 = 0, $944 = 0, $945 = 0, $946 = 0, $947 = 0, $948 = 0, $949 = 0, $95 = 0, $950 = 0, $951 = 0, $952 = 0, $953 = 0, $954 = 0, $955 = 0, $956 = 0, $957 = 0, $958 = 0, $959 = 0;
 var $96 = 0, $960 = 0, $961 = 0, $962 = 0, $963 = 0, $964 = 0, $965 = 0, $966 = 0, $967 = 0, $968 = 0, $969 = 0, $97 = 0, $970 = 0, $98 = 0, $99 = 0, $cond$i = 0, $cond$i$i = 0, $cond$i208 = 0, $exitcond$i$i = 0, $not$$i = 0;
 var $not$$i$i = 0, $not$$i197 = 0, $not$$i209 = 0, $not$1$i = 0, $not$1$i203 = 0, $not$3$i = 0, $not$5$i = 0, $or$cond$i = 0, $or$cond$i201 = 0, $or$cond1$i = 0, $or$cond10$i = 0, $or$cond11$i = 0, $or$cond11$not$i = 0, $or$cond12$i = 0, $or$cond2$i = 0, $or$cond2$i199 = 0, $or$cond49$i = 0, $or$cond5$i = 0, $or$cond50$i = 0, $or$cond7$i = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp;
 $2 = ($0>>>0)<(245);
 do {
  if ($2) {
   $3 = ($0>>>0)<(11);
   $4 = (($0) + 11)|0;
   $5 = $4 & -8;
   $6 = $3 ? 16 : $5;
   $7 = $6 >>> 3;
   $8 = HEAP32[1961]|0;
   $9 = $8 >>> $7;
   $10 = $9 & 3;
   $11 = ($10|0)==(0);
   if (!($11)) {
    $12 = $9 & 1;
    $13 = $12 ^ 1;
    $14 = (($13) + ($7))|0;
    $15 = $14 << 1;
    $16 = (7884 + ($15<<2)|0);
    $17 = ((($16)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($18)) + 8|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($16|0)==($20|0);
    if ($21) {
     $22 = 1 << $14;
     $23 = $22 ^ -1;
     $24 = $8 & $23;
     HEAP32[1961] = $24;
    } else {
     $25 = ((($20)) + 12|0);
     HEAP32[$25>>2] = $16;
     HEAP32[$17>>2] = $20;
    }
    $26 = $14 << 3;
    $27 = $26 | 3;
    $28 = ((($18)) + 4|0);
    HEAP32[$28>>2] = $27;
    $29 = (($18) + ($26)|0);
    $30 = ((($29)) + 4|0);
    $31 = HEAP32[$30>>2]|0;
    $32 = $31 | 1;
    HEAP32[$30>>2] = $32;
    $$0 = $19;
    STACKTOP = sp;return ($$0|0);
   }
   $33 = HEAP32[(7852)>>2]|0;
   $34 = ($6>>>0)>($33>>>0);
   if ($34) {
    $35 = ($9|0)==(0);
    if (!($35)) {
     $36 = $9 << $7;
     $37 = 2 << $7;
     $38 = (0 - ($37))|0;
     $39 = $37 | $38;
     $40 = $36 & $39;
     $41 = (0 - ($40))|0;
     $42 = $40 & $41;
     $43 = (($42) + -1)|0;
     $44 = $43 >>> 12;
     $45 = $44 & 16;
     $46 = $43 >>> $45;
     $47 = $46 >>> 5;
     $48 = $47 & 8;
     $49 = $48 | $45;
     $50 = $46 >>> $48;
     $51 = $50 >>> 2;
     $52 = $51 & 4;
     $53 = $49 | $52;
     $54 = $50 >>> $52;
     $55 = $54 >>> 1;
     $56 = $55 & 2;
     $57 = $53 | $56;
     $58 = $54 >>> $56;
     $59 = $58 >>> 1;
     $60 = $59 & 1;
     $61 = $57 | $60;
     $62 = $58 >>> $60;
     $63 = (($61) + ($62))|0;
     $64 = $63 << 1;
     $65 = (7884 + ($64<<2)|0);
     $66 = ((($65)) + 8|0);
     $67 = HEAP32[$66>>2]|0;
     $68 = ((($67)) + 8|0);
     $69 = HEAP32[$68>>2]|0;
     $70 = ($65|0)==($69|0);
     if ($70) {
      $71 = 1 << $63;
      $72 = $71 ^ -1;
      $73 = $8 & $72;
      HEAP32[1961] = $73;
      $90 = $73;
     } else {
      $74 = ((($69)) + 12|0);
      HEAP32[$74>>2] = $65;
      HEAP32[$66>>2] = $69;
      $90 = $8;
     }
     $75 = $63 << 3;
     $76 = (($75) - ($6))|0;
     $77 = $6 | 3;
     $78 = ((($67)) + 4|0);
     HEAP32[$78>>2] = $77;
     $79 = (($67) + ($6)|0);
     $80 = $76 | 1;
     $81 = ((($79)) + 4|0);
     HEAP32[$81>>2] = $80;
     $82 = (($79) + ($76)|0);
     HEAP32[$82>>2] = $76;
     $83 = ($33|0)==(0);
     if (!($83)) {
      $84 = HEAP32[(7864)>>2]|0;
      $85 = $33 >>> 3;
      $86 = $85 << 1;
      $87 = (7884 + ($86<<2)|0);
      $88 = 1 << $85;
      $89 = $90 & $88;
      $91 = ($89|0)==(0);
      if ($91) {
       $92 = $90 | $88;
       HEAP32[1961] = $92;
       $$pre = ((($87)) + 8|0);
       $$0194 = $87;$$pre$phiZ2D = $$pre;
      } else {
       $93 = ((($87)) + 8|0);
       $94 = HEAP32[$93>>2]|0;
       $$0194 = $94;$$pre$phiZ2D = $93;
      }
      HEAP32[$$pre$phiZ2D>>2] = $84;
      $95 = ((($$0194)) + 12|0);
      HEAP32[$95>>2] = $84;
      $96 = ((($84)) + 8|0);
      HEAP32[$96>>2] = $$0194;
      $97 = ((($84)) + 12|0);
      HEAP32[$97>>2] = $87;
     }
     HEAP32[(7852)>>2] = $76;
     HEAP32[(7864)>>2] = $79;
     $$0 = $68;
     STACKTOP = sp;return ($$0|0);
    }
    $98 = HEAP32[(7848)>>2]|0;
    $99 = ($98|0)==(0);
    if ($99) {
     $$0192 = $6;
    } else {
     $100 = (0 - ($98))|0;
     $101 = $98 & $100;
     $102 = (($101) + -1)|0;
     $103 = $102 >>> 12;
     $104 = $103 & 16;
     $105 = $102 >>> $104;
     $106 = $105 >>> 5;
     $107 = $106 & 8;
     $108 = $107 | $104;
     $109 = $105 >>> $107;
     $110 = $109 >>> 2;
     $111 = $110 & 4;
     $112 = $108 | $111;
     $113 = $109 >>> $111;
     $114 = $113 >>> 1;
     $115 = $114 & 2;
     $116 = $112 | $115;
     $117 = $113 >>> $115;
     $118 = $117 >>> 1;
     $119 = $118 & 1;
     $120 = $116 | $119;
     $121 = $117 >>> $119;
     $122 = (($120) + ($121))|0;
     $123 = (8148 + ($122<<2)|0);
     $124 = HEAP32[$123>>2]|0;
     $125 = ((($124)) + 4|0);
     $126 = HEAP32[$125>>2]|0;
     $127 = $126 & -8;
     $128 = (($127) - ($6))|0;
     $129 = ((($124)) + 16|0);
     $130 = HEAP32[$129>>2]|0;
     $not$3$i = ($130|0)==(0|0);
     $$sink14$i = $not$3$i&1;
     $131 = (((($124)) + 16|0) + ($$sink14$i<<2)|0);
     $132 = HEAP32[$131>>2]|0;
     $133 = ($132|0)==(0|0);
     if ($133) {
      $$0172$lcssa$i = $124;$$0173$lcssa$i = $128;
     } else {
      $$01726$i = $124;$$01735$i = $128;$135 = $132;
      while(1) {
       $134 = ((($135)) + 4|0);
       $136 = HEAP32[$134>>2]|0;
       $137 = $136 & -8;
       $138 = (($137) - ($6))|0;
       $139 = ($138>>>0)<($$01735$i>>>0);
       $$$0173$i = $139 ? $138 : $$01735$i;
       $$$0172$i = $139 ? $135 : $$01726$i;
       $140 = ((($135)) + 16|0);
       $141 = HEAP32[$140>>2]|0;
       $not$$i = ($141|0)==(0|0);
       $$sink1$i = $not$$i&1;
       $142 = (((($135)) + 16|0) + ($$sink1$i<<2)|0);
       $143 = HEAP32[$142>>2]|0;
       $144 = ($143|0)==(0|0);
       if ($144) {
        $$0172$lcssa$i = $$$0172$i;$$0173$lcssa$i = $$$0173$i;
        break;
       } else {
        $$01726$i = $$$0172$i;$$01735$i = $$$0173$i;$135 = $143;
       }
      }
     }
     $145 = (($$0172$lcssa$i) + ($6)|0);
     $146 = ($$0172$lcssa$i>>>0)<($145>>>0);
     if ($146) {
      $147 = ((($$0172$lcssa$i)) + 24|0);
      $148 = HEAP32[$147>>2]|0;
      $149 = ((($$0172$lcssa$i)) + 12|0);
      $150 = HEAP32[$149>>2]|0;
      $151 = ($150|0)==($$0172$lcssa$i|0);
      do {
       if ($151) {
        $156 = ((($$0172$lcssa$i)) + 20|0);
        $157 = HEAP32[$156>>2]|0;
        $158 = ($157|0)==(0|0);
        if ($158) {
         $159 = ((($$0172$lcssa$i)) + 16|0);
         $160 = HEAP32[$159>>2]|0;
         $161 = ($160|0)==(0|0);
         if ($161) {
          $$3$i = 0;
          break;
         } else {
          $$1176$i = $160;$$1178$i = $159;
         }
        } else {
         $$1176$i = $157;$$1178$i = $156;
        }
        while(1) {
         $162 = ((($$1176$i)) + 20|0);
         $163 = HEAP32[$162>>2]|0;
         $164 = ($163|0)==(0|0);
         if (!($164)) {
          $$1176$i = $163;$$1178$i = $162;
          continue;
         }
         $165 = ((($$1176$i)) + 16|0);
         $166 = HEAP32[$165>>2]|0;
         $167 = ($166|0)==(0|0);
         if ($167) {
          break;
         } else {
          $$1176$i = $166;$$1178$i = $165;
         }
        }
        HEAP32[$$1178$i>>2] = 0;
        $$3$i = $$1176$i;
       } else {
        $152 = ((($$0172$lcssa$i)) + 8|0);
        $153 = HEAP32[$152>>2]|0;
        $154 = ((($153)) + 12|0);
        HEAP32[$154>>2] = $150;
        $155 = ((($150)) + 8|0);
        HEAP32[$155>>2] = $153;
        $$3$i = $150;
       }
      } while(0);
      $168 = ($148|0)==(0|0);
      do {
       if (!($168)) {
        $169 = ((($$0172$lcssa$i)) + 28|0);
        $170 = HEAP32[$169>>2]|0;
        $171 = (8148 + ($170<<2)|0);
        $172 = HEAP32[$171>>2]|0;
        $173 = ($$0172$lcssa$i|0)==($172|0);
        if ($173) {
         HEAP32[$171>>2] = $$3$i;
         $cond$i = ($$3$i|0)==(0|0);
         if ($cond$i) {
          $174 = 1 << $170;
          $175 = $174 ^ -1;
          $176 = $98 & $175;
          HEAP32[(7848)>>2] = $176;
          break;
         }
        } else {
         $177 = ((($148)) + 16|0);
         $178 = HEAP32[$177>>2]|0;
         $not$1$i = ($178|0)!=($$0172$lcssa$i|0);
         $$sink2$i = $not$1$i&1;
         $179 = (((($148)) + 16|0) + ($$sink2$i<<2)|0);
         HEAP32[$179>>2] = $$3$i;
         $180 = ($$3$i|0)==(0|0);
         if ($180) {
          break;
         }
        }
        $181 = ((($$3$i)) + 24|0);
        HEAP32[$181>>2] = $148;
        $182 = ((($$0172$lcssa$i)) + 16|0);
        $183 = HEAP32[$182>>2]|0;
        $184 = ($183|0)==(0|0);
        if (!($184)) {
         $185 = ((($$3$i)) + 16|0);
         HEAP32[$185>>2] = $183;
         $186 = ((($183)) + 24|0);
         HEAP32[$186>>2] = $$3$i;
        }
        $187 = ((($$0172$lcssa$i)) + 20|0);
        $188 = HEAP32[$187>>2]|0;
        $189 = ($188|0)==(0|0);
        if (!($189)) {
         $190 = ((($$3$i)) + 20|0);
         HEAP32[$190>>2] = $188;
         $191 = ((($188)) + 24|0);
         HEAP32[$191>>2] = $$3$i;
        }
       }
      } while(0);
      $192 = ($$0173$lcssa$i>>>0)<(16);
      if ($192) {
       $193 = (($$0173$lcssa$i) + ($6))|0;
       $194 = $193 | 3;
       $195 = ((($$0172$lcssa$i)) + 4|0);
       HEAP32[$195>>2] = $194;
       $196 = (($$0172$lcssa$i) + ($193)|0);
       $197 = ((($196)) + 4|0);
       $198 = HEAP32[$197>>2]|0;
       $199 = $198 | 1;
       HEAP32[$197>>2] = $199;
      } else {
       $200 = $6 | 3;
       $201 = ((($$0172$lcssa$i)) + 4|0);
       HEAP32[$201>>2] = $200;
       $202 = $$0173$lcssa$i | 1;
       $203 = ((($145)) + 4|0);
       HEAP32[$203>>2] = $202;
       $204 = (($145) + ($$0173$lcssa$i)|0);
       HEAP32[$204>>2] = $$0173$lcssa$i;
       $205 = ($33|0)==(0);
       if (!($205)) {
        $206 = HEAP32[(7864)>>2]|0;
        $207 = $33 >>> 3;
        $208 = $207 << 1;
        $209 = (7884 + ($208<<2)|0);
        $210 = 1 << $207;
        $211 = $8 & $210;
        $212 = ($211|0)==(0);
        if ($212) {
         $213 = $8 | $210;
         HEAP32[1961] = $213;
         $$pre$i = ((($209)) + 8|0);
         $$0$i = $209;$$pre$phi$iZ2D = $$pre$i;
        } else {
         $214 = ((($209)) + 8|0);
         $215 = HEAP32[$214>>2]|0;
         $$0$i = $215;$$pre$phi$iZ2D = $214;
        }
        HEAP32[$$pre$phi$iZ2D>>2] = $206;
        $216 = ((($$0$i)) + 12|0);
        HEAP32[$216>>2] = $206;
        $217 = ((($206)) + 8|0);
        HEAP32[$217>>2] = $$0$i;
        $218 = ((($206)) + 12|0);
        HEAP32[$218>>2] = $209;
       }
       HEAP32[(7852)>>2] = $$0173$lcssa$i;
       HEAP32[(7864)>>2] = $145;
      }
      $219 = ((($$0172$lcssa$i)) + 8|0);
      $$0 = $219;
      STACKTOP = sp;return ($$0|0);
     } else {
      $$0192 = $6;
     }
    }
   } else {
    $$0192 = $6;
   }
  } else {
   $220 = ($0>>>0)>(4294967231);
   if ($220) {
    $$0192 = -1;
   } else {
    $221 = (($0) + 11)|0;
    $222 = $221 & -8;
    $223 = HEAP32[(7848)>>2]|0;
    $224 = ($223|0)==(0);
    if ($224) {
     $$0192 = $222;
    } else {
     $225 = (0 - ($222))|0;
     $226 = $221 >>> 8;
     $227 = ($226|0)==(0);
     if ($227) {
      $$0336$i = 0;
     } else {
      $228 = ($222>>>0)>(16777215);
      if ($228) {
       $$0336$i = 31;
      } else {
       $229 = (($226) + 1048320)|0;
       $230 = $229 >>> 16;
       $231 = $230 & 8;
       $232 = $226 << $231;
       $233 = (($232) + 520192)|0;
       $234 = $233 >>> 16;
       $235 = $234 & 4;
       $236 = $235 | $231;
       $237 = $232 << $235;
       $238 = (($237) + 245760)|0;
       $239 = $238 >>> 16;
       $240 = $239 & 2;
       $241 = $236 | $240;
       $242 = (14 - ($241))|0;
       $243 = $237 << $240;
       $244 = $243 >>> 15;
       $245 = (($242) + ($244))|0;
       $246 = $245 << 1;
       $247 = (($245) + 7)|0;
       $248 = $222 >>> $247;
       $249 = $248 & 1;
       $250 = $249 | $246;
       $$0336$i = $250;
      }
     }
     $251 = (8148 + ($$0336$i<<2)|0);
     $252 = HEAP32[$251>>2]|0;
     $253 = ($252|0)==(0|0);
     L74: do {
      if ($253) {
       $$2333$i = 0;$$3$i200 = 0;$$3328$i = $225;
       label = 57;
      } else {
       $254 = ($$0336$i|0)==(31);
       $255 = $$0336$i >>> 1;
       $256 = (25 - ($255))|0;
       $257 = $254 ? 0 : $256;
       $258 = $222 << $257;
       $$0320$i = 0;$$0325$i = $225;$$0331$i = $252;$$0337$i = $258;$$0340$i = 0;
       while(1) {
        $259 = ((($$0331$i)) + 4|0);
        $260 = HEAP32[$259>>2]|0;
        $261 = $260 & -8;
        $262 = (($261) - ($222))|0;
        $263 = ($262>>>0)<($$0325$i>>>0);
        if ($263) {
         $264 = ($262|0)==(0);
         if ($264) {
          $$411$i = $$0331$i;$$432910$i = 0;$$43359$i = $$0331$i;
          label = 61;
          break L74;
         } else {
          $$1321$i = $$0331$i;$$1326$i = $262;
         }
        } else {
         $$1321$i = $$0320$i;$$1326$i = $$0325$i;
        }
        $265 = ((($$0331$i)) + 20|0);
        $266 = HEAP32[$265>>2]|0;
        $267 = $$0337$i >>> 31;
        $268 = (((($$0331$i)) + 16|0) + ($267<<2)|0);
        $269 = HEAP32[$268>>2]|0;
        $270 = ($266|0)==(0|0);
        $271 = ($266|0)==($269|0);
        $or$cond2$i199 = $270 | $271;
        $$1341$i = $or$cond2$i199 ? $$0340$i : $266;
        $272 = ($269|0)==(0|0);
        $not$5$i = $272 ^ 1;
        $273 = $not$5$i&1;
        $$0337$$i = $$0337$i << $273;
        if ($272) {
         $$2333$i = $$1341$i;$$3$i200 = $$1321$i;$$3328$i = $$1326$i;
         label = 57;
         break;
        } else {
         $$0320$i = $$1321$i;$$0325$i = $$1326$i;$$0331$i = $269;$$0337$i = $$0337$$i;$$0340$i = $$1341$i;
        }
       }
      }
     } while(0);
     if ((label|0) == 57) {
      $274 = ($$2333$i|0)==(0|0);
      $275 = ($$3$i200|0)==(0|0);
      $or$cond$i201 = $274 & $275;
      if ($or$cond$i201) {
       $276 = 2 << $$0336$i;
       $277 = (0 - ($276))|0;
       $278 = $276 | $277;
       $279 = $223 & $278;
       $280 = ($279|0)==(0);
       if ($280) {
        $$0192 = $222;
        break;
       }
       $281 = (0 - ($279))|0;
       $282 = $279 & $281;
       $283 = (($282) + -1)|0;
       $284 = $283 >>> 12;
       $285 = $284 & 16;
       $286 = $283 >>> $285;
       $287 = $286 >>> 5;
       $288 = $287 & 8;
       $289 = $288 | $285;
       $290 = $286 >>> $288;
       $291 = $290 >>> 2;
       $292 = $291 & 4;
       $293 = $289 | $292;
       $294 = $290 >>> $292;
       $295 = $294 >>> 1;
       $296 = $295 & 2;
       $297 = $293 | $296;
       $298 = $294 >>> $296;
       $299 = $298 >>> 1;
       $300 = $299 & 1;
       $301 = $297 | $300;
       $302 = $298 >>> $300;
       $303 = (($301) + ($302))|0;
       $304 = (8148 + ($303<<2)|0);
       $305 = HEAP32[$304>>2]|0;
       $$4$ph$i = 0;$$4335$ph$i = $305;
      } else {
       $$4$ph$i = $$3$i200;$$4335$ph$i = $$2333$i;
      }
      $306 = ($$4335$ph$i|0)==(0|0);
      if ($306) {
       $$4$lcssa$i = $$4$ph$i;$$4329$lcssa$i = $$3328$i;
      } else {
       $$411$i = $$4$ph$i;$$432910$i = $$3328$i;$$43359$i = $$4335$ph$i;
       label = 61;
      }
     }
     if ((label|0) == 61) {
      while(1) {
       label = 0;
       $307 = ((($$43359$i)) + 4|0);
       $308 = HEAP32[$307>>2]|0;
       $309 = $308 & -8;
       $310 = (($309) - ($222))|0;
       $311 = ($310>>>0)<($$432910$i>>>0);
       $$$4329$i = $311 ? $310 : $$432910$i;
       $$4335$$4$i = $311 ? $$43359$i : $$411$i;
       $312 = ((($$43359$i)) + 16|0);
       $313 = HEAP32[$312>>2]|0;
       $not$1$i203 = ($313|0)==(0|0);
       $$sink2$i204 = $not$1$i203&1;
       $314 = (((($$43359$i)) + 16|0) + ($$sink2$i204<<2)|0);
       $315 = HEAP32[$314>>2]|0;
       $316 = ($315|0)==(0|0);
       if ($316) {
        $$4$lcssa$i = $$4335$$4$i;$$4329$lcssa$i = $$$4329$i;
        break;
       } else {
        $$411$i = $$4335$$4$i;$$432910$i = $$$4329$i;$$43359$i = $315;
        label = 61;
       }
      }
     }
     $317 = ($$4$lcssa$i|0)==(0|0);
     if ($317) {
      $$0192 = $222;
     } else {
      $318 = HEAP32[(7852)>>2]|0;
      $319 = (($318) - ($222))|0;
      $320 = ($$4329$lcssa$i>>>0)<($319>>>0);
      if ($320) {
       $321 = (($$4$lcssa$i) + ($222)|0);
       $322 = ($$4$lcssa$i>>>0)<($321>>>0);
       if (!($322)) {
        $$0 = 0;
        STACKTOP = sp;return ($$0|0);
       }
       $323 = ((($$4$lcssa$i)) + 24|0);
       $324 = HEAP32[$323>>2]|0;
       $325 = ((($$4$lcssa$i)) + 12|0);
       $326 = HEAP32[$325>>2]|0;
       $327 = ($326|0)==($$4$lcssa$i|0);
       do {
        if ($327) {
         $332 = ((($$4$lcssa$i)) + 20|0);
         $333 = HEAP32[$332>>2]|0;
         $334 = ($333|0)==(0|0);
         if ($334) {
          $335 = ((($$4$lcssa$i)) + 16|0);
          $336 = HEAP32[$335>>2]|0;
          $337 = ($336|0)==(0|0);
          if ($337) {
           $$3349$i = 0;
           break;
          } else {
           $$1347$i = $336;$$1351$i = $335;
          }
         } else {
          $$1347$i = $333;$$1351$i = $332;
         }
         while(1) {
          $338 = ((($$1347$i)) + 20|0);
          $339 = HEAP32[$338>>2]|0;
          $340 = ($339|0)==(0|0);
          if (!($340)) {
           $$1347$i = $339;$$1351$i = $338;
           continue;
          }
          $341 = ((($$1347$i)) + 16|0);
          $342 = HEAP32[$341>>2]|0;
          $343 = ($342|0)==(0|0);
          if ($343) {
           break;
          } else {
           $$1347$i = $342;$$1351$i = $341;
          }
         }
         HEAP32[$$1351$i>>2] = 0;
         $$3349$i = $$1347$i;
        } else {
         $328 = ((($$4$lcssa$i)) + 8|0);
         $329 = HEAP32[$328>>2]|0;
         $330 = ((($329)) + 12|0);
         HEAP32[$330>>2] = $326;
         $331 = ((($326)) + 8|0);
         HEAP32[$331>>2] = $329;
         $$3349$i = $326;
        }
       } while(0);
       $344 = ($324|0)==(0|0);
       do {
        if ($344) {
         $426 = $223;
        } else {
         $345 = ((($$4$lcssa$i)) + 28|0);
         $346 = HEAP32[$345>>2]|0;
         $347 = (8148 + ($346<<2)|0);
         $348 = HEAP32[$347>>2]|0;
         $349 = ($$4$lcssa$i|0)==($348|0);
         if ($349) {
          HEAP32[$347>>2] = $$3349$i;
          $cond$i208 = ($$3349$i|0)==(0|0);
          if ($cond$i208) {
           $350 = 1 << $346;
           $351 = $350 ^ -1;
           $352 = $223 & $351;
           HEAP32[(7848)>>2] = $352;
           $426 = $352;
           break;
          }
         } else {
          $353 = ((($324)) + 16|0);
          $354 = HEAP32[$353>>2]|0;
          $not$$i209 = ($354|0)!=($$4$lcssa$i|0);
          $$sink3$i = $not$$i209&1;
          $355 = (((($324)) + 16|0) + ($$sink3$i<<2)|0);
          HEAP32[$355>>2] = $$3349$i;
          $356 = ($$3349$i|0)==(0|0);
          if ($356) {
           $426 = $223;
           break;
          }
         }
         $357 = ((($$3349$i)) + 24|0);
         HEAP32[$357>>2] = $324;
         $358 = ((($$4$lcssa$i)) + 16|0);
         $359 = HEAP32[$358>>2]|0;
         $360 = ($359|0)==(0|0);
         if (!($360)) {
          $361 = ((($$3349$i)) + 16|0);
          HEAP32[$361>>2] = $359;
          $362 = ((($359)) + 24|0);
          HEAP32[$362>>2] = $$3349$i;
         }
         $363 = ((($$4$lcssa$i)) + 20|0);
         $364 = HEAP32[$363>>2]|0;
         $365 = ($364|0)==(0|0);
         if ($365) {
          $426 = $223;
         } else {
          $366 = ((($$3349$i)) + 20|0);
          HEAP32[$366>>2] = $364;
          $367 = ((($364)) + 24|0);
          HEAP32[$367>>2] = $$3349$i;
          $426 = $223;
         }
        }
       } while(0);
       $368 = ($$4329$lcssa$i>>>0)<(16);
       do {
        if ($368) {
         $369 = (($$4329$lcssa$i) + ($222))|0;
         $370 = $369 | 3;
         $371 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$371>>2] = $370;
         $372 = (($$4$lcssa$i) + ($369)|0);
         $373 = ((($372)) + 4|0);
         $374 = HEAP32[$373>>2]|0;
         $375 = $374 | 1;
         HEAP32[$373>>2] = $375;
        } else {
         $376 = $222 | 3;
         $377 = ((($$4$lcssa$i)) + 4|0);
         HEAP32[$377>>2] = $376;
         $378 = $$4329$lcssa$i | 1;
         $379 = ((($321)) + 4|0);
         HEAP32[$379>>2] = $378;
         $380 = (($321) + ($$4329$lcssa$i)|0);
         HEAP32[$380>>2] = $$4329$lcssa$i;
         $381 = $$4329$lcssa$i >>> 3;
         $382 = ($$4329$lcssa$i>>>0)<(256);
         if ($382) {
          $383 = $381 << 1;
          $384 = (7884 + ($383<<2)|0);
          $385 = HEAP32[1961]|0;
          $386 = 1 << $381;
          $387 = $385 & $386;
          $388 = ($387|0)==(0);
          if ($388) {
           $389 = $385 | $386;
           HEAP32[1961] = $389;
           $$pre$i210 = ((($384)) + 8|0);
           $$0345$i = $384;$$pre$phi$i211Z2D = $$pre$i210;
          } else {
           $390 = ((($384)) + 8|0);
           $391 = HEAP32[$390>>2]|0;
           $$0345$i = $391;$$pre$phi$i211Z2D = $390;
          }
          HEAP32[$$pre$phi$i211Z2D>>2] = $321;
          $392 = ((($$0345$i)) + 12|0);
          HEAP32[$392>>2] = $321;
          $393 = ((($321)) + 8|0);
          HEAP32[$393>>2] = $$0345$i;
          $394 = ((($321)) + 12|0);
          HEAP32[$394>>2] = $384;
          break;
         }
         $395 = $$4329$lcssa$i >>> 8;
         $396 = ($395|0)==(0);
         if ($396) {
          $$0339$i = 0;
         } else {
          $397 = ($$4329$lcssa$i>>>0)>(16777215);
          if ($397) {
           $$0339$i = 31;
          } else {
           $398 = (($395) + 1048320)|0;
           $399 = $398 >>> 16;
           $400 = $399 & 8;
           $401 = $395 << $400;
           $402 = (($401) + 520192)|0;
           $403 = $402 >>> 16;
           $404 = $403 & 4;
           $405 = $404 | $400;
           $406 = $401 << $404;
           $407 = (($406) + 245760)|0;
           $408 = $407 >>> 16;
           $409 = $408 & 2;
           $410 = $405 | $409;
           $411 = (14 - ($410))|0;
           $412 = $406 << $409;
           $413 = $412 >>> 15;
           $414 = (($411) + ($413))|0;
           $415 = $414 << 1;
           $416 = (($414) + 7)|0;
           $417 = $$4329$lcssa$i >>> $416;
           $418 = $417 & 1;
           $419 = $418 | $415;
           $$0339$i = $419;
          }
         }
         $420 = (8148 + ($$0339$i<<2)|0);
         $421 = ((($321)) + 28|0);
         HEAP32[$421>>2] = $$0339$i;
         $422 = ((($321)) + 16|0);
         $423 = ((($422)) + 4|0);
         HEAP32[$423>>2] = 0;
         HEAP32[$422>>2] = 0;
         $424 = 1 << $$0339$i;
         $425 = $426 & $424;
         $427 = ($425|0)==(0);
         if ($427) {
          $428 = $426 | $424;
          HEAP32[(7848)>>2] = $428;
          HEAP32[$420>>2] = $321;
          $429 = ((($321)) + 24|0);
          HEAP32[$429>>2] = $420;
          $430 = ((($321)) + 12|0);
          HEAP32[$430>>2] = $321;
          $431 = ((($321)) + 8|0);
          HEAP32[$431>>2] = $321;
          break;
         }
         $432 = HEAP32[$420>>2]|0;
         $433 = ($$0339$i|0)==(31);
         $434 = $$0339$i >>> 1;
         $435 = (25 - ($434))|0;
         $436 = $433 ? 0 : $435;
         $437 = $$4329$lcssa$i << $436;
         $$0322$i = $437;$$0323$i = $432;
         while(1) {
          $438 = ((($$0323$i)) + 4|0);
          $439 = HEAP32[$438>>2]|0;
          $440 = $439 & -8;
          $441 = ($440|0)==($$4329$lcssa$i|0);
          if ($441) {
           label = 97;
           break;
          }
          $442 = $$0322$i >>> 31;
          $443 = (((($$0323$i)) + 16|0) + ($442<<2)|0);
          $444 = $$0322$i << 1;
          $445 = HEAP32[$443>>2]|0;
          $446 = ($445|0)==(0|0);
          if ($446) {
           label = 96;
           break;
          } else {
           $$0322$i = $444;$$0323$i = $445;
          }
         }
         if ((label|0) == 96) {
          HEAP32[$443>>2] = $321;
          $447 = ((($321)) + 24|0);
          HEAP32[$447>>2] = $$0323$i;
          $448 = ((($321)) + 12|0);
          HEAP32[$448>>2] = $321;
          $449 = ((($321)) + 8|0);
          HEAP32[$449>>2] = $321;
          break;
         }
         else if ((label|0) == 97) {
          $450 = ((($$0323$i)) + 8|0);
          $451 = HEAP32[$450>>2]|0;
          $452 = ((($451)) + 12|0);
          HEAP32[$452>>2] = $321;
          HEAP32[$450>>2] = $321;
          $453 = ((($321)) + 8|0);
          HEAP32[$453>>2] = $451;
          $454 = ((($321)) + 12|0);
          HEAP32[$454>>2] = $$0323$i;
          $455 = ((($321)) + 24|0);
          HEAP32[$455>>2] = 0;
          break;
         }
        }
       } while(0);
       $456 = ((($$4$lcssa$i)) + 8|0);
       $$0 = $456;
       STACKTOP = sp;return ($$0|0);
      } else {
       $$0192 = $222;
      }
     }
    }
   }
  }
 } while(0);
 $457 = HEAP32[(7852)>>2]|0;
 $458 = ($457>>>0)<($$0192>>>0);
 if (!($458)) {
  $459 = (($457) - ($$0192))|0;
  $460 = HEAP32[(7864)>>2]|0;
  $461 = ($459>>>0)>(15);
  if ($461) {
   $462 = (($460) + ($$0192)|0);
   HEAP32[(7864)>>2] = $462;
   HEAP32[(7852)>>2] = $459;
   $463 = $459 | 1;
   $464 = ((($462)) + 4|0);
   HEAP32[$464>>2] = $463;
   $465 = (($462) + ($459)|0);
   HEAP32[$465>>2] = $459;
   $466 = $$0192 | 3;
   $467 = ((($460)) + 4|0);
   HEAP32[$467>>2] = $466;
  } else {
   HEAP32[(7852)>>2] = 0;
   HEAP32[(7864)>>2] = 0;
   $468 = $457 | 3;
   $469 = ((($460)) + 4|0);
   HEAP32[$469>>2] = $468;
   $470 = (($460) + ($457)|0);
   $471 = ((($470)) + 4|0);
   $472 = HEAP32[$471>>2]|0;
   $473 = $472 | 1;
   HEAP32[$471>>2] = $473;
  }
  $474 = ((($460)) + 8|0);
  $$0 = $474;
  STACKTOP = sp;return ($$0|0);
 }
 $475 = HEAP32[(7856)>>2]|0;
 $476 = ($475>>>0)>($$0192>>>0);
 if ($476) {
  $477 = (($475) - ($$0192))|0;
  HEAP32[(7856)>>2] = $477;
  $478 = HEAP32[(7868)>>2]|0;
  $479 = (($478) + ($$0192)|0);
  HEAP32[(7868)>>2] = $479;
  $480 = $477 | 1;
  $481 = ((($479)) + 4|0);
  HEAP32[$481>>2] = $480;
  $482 = $$0192 | 3;
  $483 = ((($478)) + 4|0);
  HEAP32[$483>>2] = $482;
  $484 = ((($478)) + 8|0);
  $$0 = $484;
  STACKTOP = sp;return ($$0|0);
 }
 $485 = HEAP32[2079]|0;
 $486 = ($485|0)==(0);
 if ($486) {
  HEAP32[(8324)>>2] = 4096;
  HEAP32[(8320)>>2] = 4096;
  HEAP32[(8328)>>2] = -1;
  HEAP32[(8332)>>2] = -1;
  HEAP32[(8336)>>2] = 0;
  HEAP32[(8288)>>2] = 0;
  $487 = $1;
  $488 = $487 & -16;
  $489 = $488 ^ 1431655768;
  HEAP32[$1>>2] = $489;
  HEAP32[2079] = $489;
  $493 = 4096;
 } else {
  $$pre$i195 = HEAP32[(8324)>>2]|0;
  $493 = $$pre$i195;
 }
 $490 = (($$0192) + 48)|0;
 $491 = (($$0192) + 47)|0;
 $492 = (($493) + ($491))|0;
 $494 = (0 - ($493))|0;
 $495 = $492 & $494;
 $496 = ($495>>>0)>($$0192>>>0);
 if (!($496)) {
  $$0 = 0;
  STACKTOP = sp;return ($$0|0);
 }
 $497 = HEAP32[(8284)>>2]|0;
 $498 = ($497|0)==(0);
 if (!($498)) {
  $499 = HEAP32[(8276)>>2]|0;
  $500 = (($499) + ($495))|0;
  $501 = ($500>>>0)<=($499>>>0);
  $502 = ($500>>>0)>($497>>>0);
  $or$cond1$i = $501 | $502;
  if ($or$cond1$i) {
   $$0 = 0;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $503 = HEAP32[(8288)>>2]|0;
 $504 = $503 & 4;
 $505 = ($504|0)==(0);
 L167: do {
  if ($505) {
   $506 = HEAP32[(7868)>>2]|0;
   $507 = ($506|0)==(0|0);
   L169: do {
    if ($507) {
     label = 118;
    } else {
     $$0$i20$i = (8292);
     while(1) {
      $508 = HEAP32[$$0$i20$i>>2]|0;
      $509 = ($508>>>0)>($506>>>0);
      if (!($509)) {
       $510 = ((($$0$i20$i)) + 4|0);
       $511 = HEAP32[$510>>2]|0;
       $512 = (($508) + ($511)|0);
       $513 = ($512>>>0)>($506>>>0);
       if ($513) {
        break;
       }
      }
      $514 = ((($$0$i20$i)) + 8|0);
      $515 = HEAP32[$514>>2]|0;
      $516 = ($515|0)==(0|0);
      if ($516) {
       label = 118;
       break L169;
      } else {
       $$0$i20$i = $515;
      }
     }
     $539 = (($492) - ($475))|0;
     $540 = $539 & $494;
     $541 = ($540>>>0)<(2147483647);
     if ($541) {
      $542 = (_sbrk(($540|0))|0);
      $543 = HEAP32[$$0$i20$i>>2]|0;
      $544 = HEAP32[$510>>2]|0;
      $545 = (($543) + ($544)|0);
      $546 = ($542|0)==($545|0);
      if ($546) {
       $547 = ($542|0)==((-1)|0);
       if ($547) {
        $$2234243136$i = $540;
       } else {
        $$723947$i = $540;$$748$i = $542;
        label = 135;
        break L167;
       }
      } else {
       $$2247$ph$i = $542;$$2253$ph$i = $540;
       label = 126;
      }
     } else {
      $$2234243136$i = 0;
     }
    }
   } while(0);
   do {
    if ((label|0) == 118) {
     $517 = (_sbrk(0)|0);
     $518 = ($517|0)==((-1)|0);
     if ($518) {
      $$2234243136$i = 0;
     } else {
      $519 = $517;
      $520 = HEAP32[(8320)>>2]|0;
      $521 = (($520) + -1)|0;
      $522 = $521 & $519;
      $523 = ($522|0)==(0);
      $524 = (($521) + ($519))|0;
      $525 = (0 - ($520))|0;
      $526 = $524 & $525;
      $527 = (($526) - ($519))|0;
      $528 = $523 ? 0 : $527;
      $$$i = (($528) + ($495))|0;
      $529 = HEAP32[(8276)>>2]|0;
      $530 = (($$$i) + ($529))|0;
      $531 = ($$$i>>>0)>($$0192>>>0);
      $532 = ($$$i>>>0)<(2147483647);
      $or$cond$i = $531 & $532;
      if ($or$cond$i) {
       $533 = HEAP32[(8284)>>2]|0;
       $534 = ($533|0)==(0);
       if (!($534)) {
        $535 = ($530>>>0)<=($529>>>0);
        $536 = ($530>>>0)>($533>>>0);
        $or$cond2$i = $535 | $536;
        if ($or$cond2$i) {
         $$2234243136$i = 0;
         break;
        }
       }
       $537 = (_sbrk(($$$i|0))|0);
       $538 = ($537|0)==($517|0);
       if ($538) {
        $$723947$i = $$$i;$$748$i = $517;
        label = 135;
        break L167;
       } else {
        $$2247$ph$i = $537;$$2253$ph$i = $$$i;
        label = 126;
       }
      } else {
       $$2234243136$i = 0;
      }
     }
    }
   } while(0);
   do {
    if ((label|0) == 126) {
     $548 = (0 - ($$2253$ph$i))|0;
     $549 = ($$2247$ph$i|0)!=((-1)|0);
     $550 = ($$2253$ph$i>>>0)<(2147483647);
     $or$cond7$i = $550 & $549;
     $551 = ($490>>>0)>($$2253$ph$i>>>0);
     $or$cond10$i = $551 & $or$cond7$i;
     if (!($or$cond10$i)) {
      $561 = ($$2247$ph$i|0)==((-1)|0);
      if ($561) {
       $$2234243136$i = 0;
       break;
      } else {
       $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
       label = 135;
       break L167;
      }
     }
     $552 = HEAP32[(8324)>>2]|0;
     $553 = (($491) - ($$2253$ph$i))|0;
     $554 = (($553) + ($552))|0;
     $555 = (0 - ($552))|0;
     $556 = $554 & $555;
     $557 = ($556>>>0)<(2147483647);
     if (!($557)) {
      $$723947$i = $$2253$ph$i;$$748$i = $$2247$ph$i;
      label = 135;
      break L167;
     }
     $558 = (_sbrk(($556|0))|0);
     $559 = ($558|0)==((-1)|0);
     if ($559) {
      (_sbrk(($548|0))|0);
      $$2234243136$i = 0;
      break;
     } else {
      $560 = (($556) + ($$2253$ph$i))|0;
      $$723947$i = $560;$$748$i = $$2247$ph$i;
      label = 135;
      break L167;
     }
    }
   } while(0);
   $562 = HEAP32[(8288)>>2]|0;
   $563 = $562 | 4;
   HEAP32[(8288)>>2] = $563;
   $$4236$i = $$2234243136$i;
   label = 133;
  } else {
   $$4236$i = 0;
   label = 133;
  }
 } while(0);
 if ((label|0) == 133) {
  $564 = ($495>>>0)<(2147483647);
  if ($564) {
   $565 = (_sbrk(($495|0))|0);
   $566 = (_sbrk(0)|0);
   $567 = ($565|0)!=((-1)|0);
   $568 = ($566|0)!=((-1)|0);
   $or$cond5$i = $567 & $568;
   $569 = ($565>>>0)<($566>>>0);
   $or$cond11$i = $569 & $or$cond5$i;
   $570 = $566;
   $571 = $565;
   $572 = (($570) - ($571))|0;
   $573 = (($$0192) + 40)|0;
   $574 = ($572>>>0)>($573>>>0);
   $$$4236$i = $574 ? $572 : $$4236$i;
   $or$cond11$not$i = $or$cond11$i ^ 1;
   $575 = ($565|0)==((-1)|0);
   $not$$i197 = $574 ^ 1;
   $576 = $575 | $not$$i197;
   $or$cond49$i = $576 | $or$cond11$not$i;
   if (!($or$cond49$i)) {
    $$723947$i = $$$4236$i;$$748$i = $565;
    label = 135;
   }
  }
 }
 if ((label|0) == 135) {
  $577 = HEAP32[(8276)>>2]|0;
  $578 = (($577) + ($$723947$i))|0;
  HEAP32[(8276)>>2] = $578;
  $579 = HEAP32[(8280)>>2]|0;
  $580 = ($578>>>0)>($579>>>0);
  if ($580) {
   HEAP32[(8280)>>2] = $578;
  }
  $581 = HEAP32[(7868)>>2]|0;
  $582 = ($581|0)==(0|0);
  do {
   if ($582) {
    $583 = HEAP32[(7860)>>2]|0;
    $584 = ($583|0)==(0|0);
    $585 = ($$748$i>>>0)<($583>>>0);
    $or$cond12$i = $584 | $585;
    if ($or$cond12$i) {
     HEAP32[(7860)>>2] = $$748$i;
    }
    HEAP32[(8292)>>2] = $$748$i;
    HEAP32[(8296)>>2] = $$723947$i;
    HEAP32[(8304)>>2] = 0;
    $586 = HEAP32[2079]|0;
    HEAP32[(7880)>>2] = $586;
    HEAP32[(7876)>>2] = -1;
    $$01$i$i = 0;
    while(1) {
     $587 = $$01$i$i << 1;
     $588 = (7884 + ($587<<2)|0);
     $589 = ((($588)) + 12|0);
     HEAP32[$589>>2] = $588;
     $590 = ((($588)) + 8|0);
     HEAP32[$590>>2] = $588;
     $591 = (($$01$i$i) + 1)|0;
     $exitcond$i$i = ($591|0)==(32);
     if ($exitcond$i$i) {
      break;
     } else {
      $$01$i$i = $591;
     }
    }
    $592 = (($$723947$i) + -40)|0;
    $593 = ((($$748$i)) + 8|0);
    $594 = $593;
    $595 = $594 & 7;
    $596 = ($595|0)==(0);
    $597 = (0 - ($594))|0;
    $598 = $597 & 7;
    $599 = $596 ? 0 : $598;
    $600 = (($$748$i) + ($599)|0);
    $601 = (($592) - ($599))|0;
    HEAP32[(7868)>>2] = $600;
    HEAP32[(7856)>>2] = $601;
    $602 = $601 | 1;
    $603 = ((($600)) + 4|0);
    HEAP32[$603>>2] = $602;
    $604 = (($600) + ($601)|0);
    $605 = ((($604)) + 4|0);
    HEAP32[$605>>2] = 40;
    $606 = HEAP32[(8332)>>2]|0;
    HEAP32[(7872)>>2] = $606;
   } else {
    $$024370$i = (8292);
    while(1) {
     $607 = HEAP32[$$024370$i>>2]|0;
     $608 = ((($$024370$i)) + 4|0);
     $609 = HEAP32[$608>>2]|0;
     $610 = (($607) + ($609)|0);
     $611 = ($$748$i|0)==($610|0);
     if ($611) {
      label = 145;
      break;
     }
     $612 = ((($$024370$i)) + 8|0);
     $613 = HEAP32[$612>>2]|0;
     $614 = ($613|0)==(0|0);
     if ($614) {
      break;
     } else {
      $$024370$i = $613;
     }
    }
    if ((label|0) == 145) {
     $615 = ((($$024370$i)) + 12|0);
     $616 = HEAP32[$615>>2]|0;
     $617 = $616 & 8;
     $618 = ($617|0)==(0);
     if ($618) {
      $619 = ($581>>>0)>=($607>>>0);
      $620 = ($581>>>0)<($$748$i>>>0);
      $or$cond50$i = $620 & $619;
      if ($or$cond50$i) {
       $621 = (($609) + ($$723947$i))|0;
       HEAP32[$608>>2] = $621;
       $622 = HEAP32[(7856)>>2]|0;
       $623 = ((($581)) + 8|0);
       $624 = $623;
       $625 = $624 & 7;
       $626 = ($625|0)==(0);
       $627 = (0 - ($624))|0;
       $628 = $627 & 7;
       $629 = $626 ? 0 : $628;
       $630 = (($581) + ($629)|0);
       $631 = (($$723947$i) - ($629))|0;
       $632 = (($622) + ($631))|0;
       HEAP32[(7868)>>2] = $630;
       HEAP32[(7856)>>2] = $632;
       $633 = $632 | 1;
       $634 = ((($630)) + 4|0);
       HEAP32[$634>>2] = $633;
       $635 = (($630) + ($632)|0);
       $636 = ((($635)) + 4|0);
       HEAP32[$636>>2] = 40;
       $637 = HEAP32[(8332)>>2]|0;
       HEAP32[(7872)>>2] = $637;
       break;
      }
     }
    }
    $638 = HEAP32[(7860)>>2]|0;
    $639 = ($$748$i>>>0)<($638>>>0);
    if ($639) {
     HEAP32[(7860)>>2] = $$748$i;
    }
    $640 = (($$748$i) + ($$723947$i)|0);
    $$124469$i = (8292);
    while(1) {
     $641 = HEAP32[$$124469$i>>2]|0;
     $642 = ($641|0)==($640|0);
     if ($642) {
      label = 153;
      break;
     }
     $643 = ((($$124469$i)) + 8|0);
     $644 = HEAP32[$643>>2]|0;
     $645 = ($644|0)==(0|0);
     if ($645) {
      break;
     } else {
      $$124469$i = $644;
     }
    }
    if ((label|0) == 153) {
     $646 = ((($$124469$i)) + 12|0);
     $647 = HEAP32[$646>>2]|0;
     $648 = $647 & 8;
     $649 = ($648|0)==(0);
     if ($649) {
      HEAP32[$$124469$i>>2] = $$748$i;
      $650 = ((($$124469$i)) + 4|0);
      $651 = HEAP32[$650>>2]|0;
      $652 = (($651) + ($$723947$i))|0;
      HEAP32[$650>>2] = $652;
      $653 = ((($$748$i)) + 8|0);
      $654 = $653;
      $655 = $654 & 7;
      $656 = ($655|0)==(0);
      $657 = (0 - ($654))|0;
      $658 = $657 & 7;
      $659 = $656 ? 0 : $658;
      $660 = (($$748$i) + ($659)|0);
      $661 = ((($640)) + 8|0);
      $662 = $661;
      $663 = $662 & 7;
      $664 = ($663|0)==(0);
      $665 = (0 - ($662))|0;
      $666 = $665 & 7;
      $667 = $664 ? 0 : $666;
      $668 = (($640) + ($667)|0);
      $669 = $668;
      $670 = $660;
      $671 = (($669) - ($670))|0;
      $672 = (($660) + ($$0192)|0);
      $673 = (($671) - ($$0192))|0;
      $674 = $$0192 | 3;
      $675 = ((($660)) + 4|0);
      HEAP32[$675>>2] = $674;
      $676 = ($668|0)==($581|0);
      do {
       if ($676) {
        $677 = HEAP32[(7856)>>2]|0;
        $678 = (($677) + ($673))|0;
        HEAP32[(7856)>>2] = $678;
        HEAP32[(7868)>>2] = $672;
        $679 = $678 | 1;
        $680 = ((($672)) + 4|0);
        HEAP32[$680>>2] = $679;
       } else {
        $681 = HEAP32[(7864)>>2]|0;
        $682 = ($668|0)==($681|0);
        if ($682) {
         $683 = HEAP32[(7852)>>2]|0;
         $684 = (($683) + ($673))|0;
         HEAP32[(7852)>>2] = $684;
         HEAP32[(7864)>>2] = $672;
         $685 = $684 | 1;
         $686 = ((($672)) + 4|0);
         HEAP32[$686>>2] = $685;
         $687 = (($672) + ($684)|0);
         HEAP32[$687>>2] = $684;
         break;
        }
        $688 = ((($668)) + 4|0);
        $689 = HEAP32[$688>>2]|0;
        $690 = $689 & 3;
        $691 = ($690|0)==(1);
        if ($691) {
         $692 = $689 & -8;
         $693 = $689 >>> 3;
         $694 = ($689>>>0)<(256);
         L237: do {
          if ($694) {
           $695 = ((($668)) + 8|0);
           $696 = HEAP32[$695>>2]|0;
           $697 = ((($668)) + 12|0);
           $698 = HEAP32[$697>>2]|0;
           $699 = ($698|0)==($696|0);
           if ($699) {
            $700 = 1 << $693;
            $701 = $700 ^ -1;
            $702 = HEAP32[1961]|0;
            $703 = $702 & $701;
            HEAP32[1961] = $703;
            break;
           } else {
            $704 = ((($696)) + 12|0);
            HEAP32[$704>>2] = $698;
            $705 = ((($698)) + 8|0);
            HEAP32[$705>>2] = $696;
            break;
           }
          } else {
           $706 = ((($668)) + 24|0);
           $707 = HEAP32[$706>>2]|0;
           $708 = ((($668)) + 12|0);
           $709 = HEAP32[$708>>2]|0;
           $710 = ($709|0)==($668|0);
           do {
            if ($710) {
             $715 = ((($668)) + 16|0);
             $716 = ((($715)) + 4|0);
             $717 = HEAP32[$716>>2]|0;
             $718 = ($717|0)==(0|0);
             if ($718) {
              $719 = HEAP32[$715>>2]|0;
              $720 = ($719|0)==(0|0);
              if ($720) {
               $$3$i$i = 0;
               break;
              } else {
               $$1264$i$i = $719;$$1266$i$i = $715;
              }
             } else {
              $$1264$i$i = $717;$$1266$i$i = $716;
             }
             while(1) {
              $721 = ((($$1264$i$i)) + 20|0);
              $722 = HEAP32[$721>>2]|0;
              $723 = ($722|0)==(0|0);
              if (!($723)) {
               $$1264$i$i = $722;$$1266$i$i = $721;
               continue;
              }
              $724 = ((($$1264$i$i)) + 16|0);
              $725 = HEAP32[$724>>2]|0;
              $726 = ($725|0)==(0|0);
              if ($726) {
               break;
              } else {
               $$1264$i$i = $725;$$1266$i$i = $724;
              }
             }
             HEAP32[$$1266$i$i>>2] = 0;
             $$3$i$i = $$1264$i$i;
            } else {
             $711 = ((($668)) + 8|0);
             $712 = HEAP32[$711>>2]|0;
             $713 = ((($712)) + 12|0);
             HEAP32[$713>>2] = $709;
             $714 = ((($709)) + 8|0);
             HEAP32[$714>>2] = $712;
             $$3$i$i = $709;
            }
           } while(0);
           $727 = ($707|0)==(0|0);
           if ($727) {
            break;
           }
           $728 = ((($668)) + 28|0);
           $729 = HEAP32[$728>>2]|0;
           $730 = (8148 + ($729<<2)|0);
           $731 = HEAP32[$730>>2]|0;
           $732 = ($668|0)==($731|0);
           do {
            if ($732) {
             HEAP32[$730>>2] = $$3$i$i;
             $cond$i$i = ($$3$i$i|0)==(0|0);
             if (!($cond$i$i)) {
              break;
             }
             $733 = 1 << $729;
             $734 = $733 ^ -1;
             $735 = HEAP32[(7848)>>2]|0;
             $736 = $735 & $734;
             HEAP32[(7848)>>2] = $736;
             break L237;
            } else {
             $737 = ((($707)) + 16|0);
             $738 = HEAP32[$737>>2]|0;
             $not$$i$i = ($738|0)!=($668|0);
             $$sink1$i$i = $not$$i$i&1;
             $739 = (((($707)) + 16|0) + ($$sink1$i$i<<2)|0);
             HEAP32[$739>>2] = $$3$i$i;
             $740 = ($$3$i$i|0)==(0|0);
             if ($740) {
              break L237;
             }
            }
           } while(0);
           $741 = ((($$3$i$i)) + 24|0);
           HEAP32[$741>>2] = $707;
           $742 = ((($668)) + 16|0);
           $743 = HEAP32[$742>>2]|0;
           $744 = ($743|0)==(0|0);
           if (!($744)) {
            $745 = ((($$3$i$i)) + 16|0);
            HEAP32[$745>>2] = $743;
            $746 = ((($743)) + 24|0);
            HEAP32[$746>>2] = $$3$i$i;
           }
           $747 = ((($742)) + 4|0);
           $748 = HEAP32[$747>>2]|0;
           $749 = ($748|0)==(0|0);
           if ($749) {
            break;
           }
           $750 = ((($$3$i$i)) + 20|0);
           HEAP32[$750>>2] = $748;
           $751 = ((($748)) + 24|0);
           HEAP32[$751>>2] = $$3$i$i;
          }
         } while(0);
         $752 = (($668) + ($692)|0);
         $753 = (($692) + ($673))|0;
         $$0$i$i = $752;$$0260$i$i = $753;
        } else {
         $$0$i$i = $668;$$0260$i$i = $673;
        }
        $754 = ((($$0$i$i)) + 4|0);
        $755 = HEAP32[$754>>2]|0;
        $756 = $755 & -2;
        HEAP32[$754>>2] = $756;
        $757 = $$0260$i$i | 1;
        $758 = ((($672)) + 4|0);
        HEAP32[$758>>2] = $757;
        $759 = (($672) + ($$0260$i$i)|0);
        HEAP32[$759>>2] = $$0260$i$i;
        $760 = $$0260$i$i >>> 3;
        $761 = ($$0260$i$i>>>0)<(256);
        if ($761) {
         $762 = $760 << 1;
         $763 = (7884 + ($762<<2)|0);
         $764 = HEAP32[1961]|0;
         $765 = 1 << $760;
         $766 = $764 & $765;
         $767 = ($766|0)==(0);
         if ($767) {
          $768 = $764 | $765;
          HEAP32[1961] = $768;
          $$pre$i17$i = ((($763)) + 8|0);
          $$0268$i$i = $763;$$pre$phi$i18$iZ2D = $$pre$i17$i;
         } else {
          $769 = ((($763)) + 8|0);
          $770 = HEAP32[$769>>2]|0;
          $$0268$i$i = $770;$$pre$phi$i18$iZ2D = $769;
         }
         HEAP32[$$pre$phi$i18$iZ2D>>2] = $672;
         $771 = ((($$0268$i$i)) + 12|0);
         HEAP32[$771>>2] = $672;
         $772 = ((($672)) + 8|0);
         HEAP32[$772>>2] = $$0268$i$i;
         $773 = ((($672)) + 12|0);
         HEAP32[$773>>2] = $763;
         break;
        }
        $774 = $$0260$i$i >>> 8;
        $775 = ($774|0)==(0);
        do {
         if ($775) {
          $$0269$i$i = 0;
         } else {
          $776 = ($$0260$i$i>>>0)>(16777215);
          if ($776) {
           $$0269$i$i = 31;
           break;
          }
          $777 = (($774) + 1048320)|0;
          $778 = $777 >>> 16;
          $779 = $778 & 8;
          $780 = $774 << $779;
          $781 = (($780) + 520192)|0;
          $782 = $781 >>> 16;
          $783 = $782 & 4;
          $784 = $783 | $779;
          $785 = $780 << $783;
          $786 = (($785) + 245760)|0;
          $787 = $786 >>> 16;
          $788 = $787 & 2;
          $789 = $784 | $788;
          $790 = (14 - ($789))|0;
          $791 = $785 << $788;
          $792 = $791 >>> 15;
          $793 = (($790) + ($792))|0;
          $794 = $793 << 1;
          $795 = (($793) + 7)|0;
          $796 = $$0260$i$i >>> $795;
          $797 = $796 & 1;
          $798 = $797 | $794;
          $$0269$i$i = $798;
         }
        } while(0);
        $799 = (8148 + ($$0269$i$i<<2)|0);
        $800 = ((($672)) + 28|0);
        HEAP32[$800>>2] = $$0269$i$i;
        $801 = ((($672)) + 16|0);
        $802 = ((($801)) + 4|0);
        HEAP32[$802>>2] = 0;
        HEAP32[$801>>2] = 0;
        $803 = HEAP32[(7848)>>2]|0;
        $804 = 1 << $$0269$i$i;
        $805 = $803 & $804;
        $806 = ($805|0)==(0);
        if ($806) {
         $807 = $803 | $804;
         HEAP32[(7848)>>2] = $807;
         HEAP32[$799>>2] = $672;
         $808 = ((($672)) + 24|0);
         HEAP32[$808>>2] = $799;
         $809 = ((($672)) + 12|0);
         HEAP32[$809>>2] = $672;
         $810 = ((($672)) + 8|0);
         HEAP32[$810>>2] = $672;
         break;
        }
        $811 = HEAP32[$799>>2]|0;
        $812 = ($$0269$i$i|0)==(31);
        $813 = $$0269$i$i >>> 1;
        $814 = (25 - ($813))|0;
        $815 = $812 ? 0 : $814;
        $816 = $$0260$i$i << $815;
        $$0261$i$i = $816;$$0262$i$i = $811;
        while(1) {
         $817 = ((($$0262$i$i)) + 4|0);
         $818 = HEAP32[$817>>2]|0;
         $819 = $818 & -8;
         $820 = ($819|0)==($$0260$i$i|0);
         if ($820) {
          label = 194;
          break;
         }
         $821 = $$0261$i$i >>> 31;
         $822 = (((($$0262$i$i)) + 16|0) + ($821<<2)|0);
         $823 = $$0261$i$i << 1;
         $824 = HEAP32[$822>>2]|0;
         $825 = ($824|0)==(0|0);
         if ($825) {
          label = 193;
          break;
         } else {
          $$0261$i$i = $823;$$0262$i$i = $824;
         }
        }
        if ((label|0) == 193) {
         HEAP32[$822>>2] = $672;
         $826 = ((($672)) + 24|0);
         HEAP32[$826>>2] = $$0262$i$i;
         $827 = ((($672)) + 12|0);
         HEAP32[$827>>2] = $672;
         $828 = ((($672)) + 8|0);
         HEAP32[$828>>2] = $672;
         break;
        }
        else if ((label|0) == 194) {
         $829 = ((($$0262$i$i)) + 8|0);
         $830 = HEAP32[$829>>2]|0;
         $831 = ((($830)) + 12|0);
         HEAP32[$831>>2] = $672;
         HEAP32[$829>>2] = $672;
         $832 = ((($672)) + 8|0);
         HEAP32[$832>>2] = $830;
         $833 = ((($672)) + 12|0);
         HEAP32[$833>>2] = $$0262$i$i;
         $834 = ((($672)) + 24|0);
         HEAP32[$834>>2] = 0;
         break;
        }
       }
      } while(0);
      $959 = ((($660)) + 8|0);
      $$0 = $959;
      STACKTOP = sp;return ($$0|0);
     }
    }
    $$0$i$i$i = (8292);
    while(1) {
     $835 = HEAP32[$$0$i$i$i>>2]|0;
     $836 = ($835>>>0)>($581>>>0);
     if (!($836)) {
      $837 = ((($$0$i$i$i)) + 4|0);
      $838 = HEAP32[$837>>2]|0;
      $839 = (($835) + ($838)|0);
      $840 = ($839>>>0)>($581>>>0);
      if ($840) {
       break;
      }
     }
     $841 = ((($$0$i$i$i)) + 8|0);
     $842 = HEAP32[$841>>2]|0;
     $$0$i$i$i = $842;
    }
    $843 = ((($839)) + -47|0);
    $844 = ((($843)) + 8|0);
    $845 = $844;
    $846 = $845 & 7;
    $847 = ($846|0)==(0);
    $848 = (0 - ($845))|0;
    $849 = $848 & 7;
    $850 = $847 ? 0 : $849;
    $851 = (($843) + ($850)|0);
    $852 = ((($581)) + 16|0);
    $853 = ($851>>>0)<($852>>>0);
    $854 = $853 ? $581 : $851;
    $855 = ((($854)) + 8|0);
    $856 = ((($854)) + 24|0);
    $857 = (($$723947$i) + -40)|0;
    $858 = ((($$748$i)) + 8|0);
    $859 = $858;
    $860 = $859 & 7;
    $861 = ($860|0)==(0);
    $862 = (0 - ($859))|0;
    $863 = $862 & 7;
    $864 = $861 ? 0 : $863;
    $865 = (($$748$i) + ($864)|0);
    $866 = (($857) - ($864))|0;
    HEAP32[(7868)>>2] = $865;
    HEAP32[(7856)>>2] = $866;
    $867 = $866 | 1;
    $868 = ((($865)) + 4|0);
    HEAP32[$868>>2] = $867;
    $869 = (($865) + ($866)|0);
    $870 = ((($869)) + 4|0);
    HEAP32[$870>>2] = 40;
    $871 = HEAP32[(8332)>>2]|0;
    HEAP32[(7872)>>2] = $871;
    $872 = ((($854)) + 4|0);
    HEAP32[$872>>2] = 27;
    ;HEAP32[$855>>2]=HEAP32[(8292)>>2]|0;HEAP32[$855+4>>2]=HEAP32[(8292)+4>>2]|0;HEAP32[$855+8>>2]=HEAP32[(8292)+8>>2]|0;HEAP32[$855+12>>2]=HEAP32[(8292)+12>>2]|0;
    HEAP32[(8292)>>2] = $$748$i;
    HEAP32[(8296)>>2] = $$723947$i;
    HEAP32[(8304)>>2] = 0;
    HEAP32[(8300)>>2] = $855;
    $874 = $856;
    while(1) {
     $873 = ((($874)) + 4|0);
     HEAP32[$873>>2] = 7;
     $875 = ((($874)) + 8|0);
     $876 = ($875>>>0)<($839>>>0);
     if ($876) {
      $874 = $873;
     } else {
      break;
     }
    }
    $877 = ($854|0)==($581|0);
    if (!($877)) {
     $878 = $854;
     $879 = $581;
     $880 = (($878) - ($879))|0;
     $881 = HEAP32[$872>>2]|0;
     $882 = $881 & -2;
     HEAP32[$872>>2] = $882;
     $883 = $880 | 1;
     $884 = ((($581)) + 4|0);
     HEAP32[$884>>2] = $883;
     HEAP32[$854>>2] = $880;
     $885 = $880 >>> 3;
     $886 = ($880>>>0)<(256);
     if ($886) {
      $887 = $885 << 1;
      $888 = (7884 + ($887<<2)|0);
      $889 = HEAP32[1961]|0;
      $890 = 1 << $885;
      $891 = $889 & $890;
      $892 = ($891|0)==(0);
      if ($892) {
       $893 = $889 | $890;
       HEAP32[1961] = $893;
       $$pre$i$i = ((($888)) + 8|0);
       $$0206$i$i = $888;$$pre$phi$i$iZ2D = $$pre$i$i;
      } else {
       $894 = ((($888)) + 8|0);
       $895 = HEAP32[$894>>2]|0;
       $$0206$i$i = $895;$$pre$phi$i$iZ2D = $894;
      }
      HEAP32[$$pre$phi$i$iZ2D>>2] = $581;
      $896 = ((($$0206$i$i)) + 12|0);
      HEAP32[$896>>2] = $581;
      $897 = ((($581)) + 8|0);
      HEAP32[$897>>2] = $$0206$i$i;
      $898 = ((($581)) + 12|0);
      HEAP32[$898>>2] = $888;
      break;
     }
     $899 = $880 >>> 8;
     $900 = ($899|0)==(0);
     if ($900) {
      $$0207$i$i = 0;
     } else {
      $901 = ($880>>>0)>(16777215);
      if ($901) {
       $$0207$i$i = 31;
      } else {
       $902 = (($899) + 1048320)|0;
       $903 = $902 >>> 16;
       $904 = $903 & 8;
       $905 = $899 << $904;
       $906 = (($905) + 520192)|0;
       $907 = $906 >>> 16;
       $908 = $907 & 4;
       $909 = $908 | $904;
       $910 = $905 << $908;
       $911 = (($910) + 245760)|0;
       $912 = $911 >>> 16;
       $913 = $912 & 2;
       $914 = $909 | $913;
       $915 = (14 - ($914))|0;
       $916 = $910 << $913;
       $917 = $916 >>> 15;
       $918 = (($915) + ($917))|0;
       $919 = $918 << 1;
       $920 = (($918) + 7)|0;
       $921 = $880 >>> $920;
       $922 = $921 & 1;
       $923 = $922 | $919;
       $$0207$i$i = $923;
      }
     }
     $924 = (8148 + ($$0207$i$i<<2)|0);
     $925 = ((($581)) + 28|0);
     HEAP32[$925>>2] = $$0207$i$i;
     $926 = ((($581)) + 20|0);
     HEAP32[$926>>2] = 0;
     HEAP32[$852>>2] = 0;
     $927 = HEAP32[(7848)>>2]|0;
     $928 = 1 << $$0207$i$i;
     $929 = $927 & $928;
     $930 = ($929|0)==(0);
     if ($930) {
      $931 = $927 | $928;
      HEAP32[(7848)>>2] = $931;
      HEAP32[$924>>2] = $581;
      $932 = ((($581)) + 24|0);
      HEAP32[$932>>2] = $924;
      $933 = ((($581)) + 12|0);
      HEAP32[$933>>2] = $581;
      $934 = ((($581)) + 8|0);
      HEAP32[$934>>2] = $581;
      break;
     }
     $935 = HEAP32[$924>>2]|0;
     $936 = ($$0207$i$i|0)==(31);
     $937 = $$0207$i$i >>> 1;
     $938 = (25 - ($937))|0;
     $939 = $936 ? 0 : $938;
     $940 = $880 << $939;
     $$0201$i$i = $940;$$0202$i$i = $935;
     while(1) {
      $941 = ((($$0202$i$i)) + 4|0);
      $942 = HEAP32[$941>>2]|0;
      $943 = $942 & -8;
      $944 = ($943|0)==($880|0);
      if ($944) {
       label = 216;
       break;
      }
      $945 = $$0201$i$i >>> 31;
      $946 = (((($$0202$i$i)) + 16|0) + ($945<<2)|0);
      $947 = $$0201$i$i << 1;
      $948 = HEAP32[$946>>2]|0;
      $949 = ($948|0)==(0|0);
      if ($949) {
       label = 215;
       break;
      } else {
       $$0201$i$i = $947;$$0202$i$i = $948;
      }
     }
     if ((label|0) == 215) {
      HEAP32[$946>>2] = $581;
      $950 = ((($581)) + 24|0);
      HEAP32[$950>>2] = $$0202$i$i;
      $951 = ((($581)) + 12|0);
      HEAP32[$951>>2] = $581;
      $952 = ((($581)) + 8|0);
      HEAP32[$952>>2] = $581;
      break;
     }
     else if ((label|0) == 216) {
      $953 = ((($$0202$i$i)) + 8|0);
      $954 = HEAP32[$953>>2]|0;
      $955 = ((($954)) + 12|0);
      HEAP32[$955>>2] = $581;
      HEAP32[$953>>2] = $581;
      $956 = ((($581)) + 8|0);
      HEAP32[$956>>2] = $954;
      $957 = ((($581)) + 12|0);
      HEAP32[$957>>2] = $$0202$i$i;
      $958 = ((($581)) + 24|0);
      HEAP32[$958>>2] = 0;
      break;
     }
    }
   }
  } while(0);
  $960 = HEAP32[(7856)>>2]|0;
  $961 = ($960>>>0)>($$0192>>>0);
  if ($961) {
   $962 = (($960) - ($$0192))|0;
   HEAP32[(7856)>>2] = $962;
   $963 = HEAP32[(7868)>>2]|0;
   $964 = (($963) + ($$0192)|0);
   HEAP32[(7868)>>2] = $964;
   $965 = $962 | 1;
   $966 = ((($964)) + 4|0);
   HEAP32[$966>>2] = $965;
   $967 = $$0192 | 3;
   $968 = ((($963)) + 4|0);
   HEAP32[$968>>2] = $967;
   $969 = ((($963)) + 8|0);
   $$0 = $969;
   STACKTOP = sp;return ($$0|0);
  }
 }
 $970 = (___errno_location()|0);
 HEAP32[$970>>2] = 12;
 $$0 = 0;
 STACKTOP = sp;return ($$0|0);
}
function _free($0) {
 $0 = $0|0;
 var $$0195$i = 0, $$0195$in$i = 0, $$0348 = 0, $$0349 = 0, $$0361 = 0, $$0368 = 0, $$1 = 0, $$1347 = 0, $$1352 = 0, $$1355 = 0, $$1363 = 0, $$1367 = 0, $$2 = 0, $$3 = 0, $$3365 = 0, $$pre = 0, $$pre$phiZ2D = 0, $$sink3 = 0, $$sink5 = 0, $1 = 0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0;
 var $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0;
 var $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0;
 var $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0;
 var $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0;
 var $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0;
 var $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0;
 var $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond374 = 0, $cond375 = 0, $not$ = 0, $not$370 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 if ($1) {
  return;
 }
 $2 = ((($0)) + -8|0);
 $3 = HEAP32[(7860)>>2]|0;
 $4 = ((($0)) + -4|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $5 & -8;
 $7 = (($2) + ($6)|0);
 $8 = $5 & 1;
 $9 = ($8|0)==(0);
 do {
  if ($9) {
   $10 = HEAP32[$2>>2]|0;
   $11 = $5 & 3;
   $12 = ($11|0)==(0);
   if ($12) {
    return;
   }
   $13 = (0 - ($10))|0;
   $14 = (($2) + ($13)|0);
   $15 = (($10) + ($6))|0;
   $16 = ($14>>>0)<($3>>>0);
   if ($16) {
    return;
   }
   $17 = HEAP32[(7864)>>2]|0;
   $18 = ($14|0)==($17|0);
   if ($18) {
    $78 = ((($7)) + 4|0);
    $79 = HEAP32[$78>>2]|0;
    $80 = $79 & 3;
    $81 = ($80|0)==(3);
    if (!($81)) {
     $$1 = $14;$$1347 = $15;$86 = $14;
     break;
    }
    $82 = (($14) + ($15)|0);
    $83 = ((($14)) + 4|0);
    $84 = $15 | 1;
    $85 = $79 & -2;
    HEAP32[(7852)>>2] = $15;
    HEAP32[$78>>2] = $85;
    HEAP32[$83>>2] = $84;
    HEAP32[$82>>2] = $15;
    return;
   }
   $19 = $10 >>> 3;
   $20 = ($10>>>0)<(256);
   if ($20) {
    $21 = ((($14)) + 8|0);
    $22 = HEAP32[$21>>2]|0;
    $23 = ((($14)) + 12|0);
    $24 = HEAP32[$23>>2]|0;
    $25 = ($24|0)==($22|0);
    if ($25) {
     $26 = 1 << $19;
     $27 = $26 ^ -1;
     $28 = HEAP32[1961]|0;
     $29 = $28 & $27;
     HEAP32[1961] = $29;
     $$1 = $14;$$1347 = $15;$86 = $14;
     break;
    } else {
     $30 = ((($22)) + 12|0);
     HEAP32[$30>>2] = $24;
     $31 = ((($24)) + 8|0);
     HEAP32[$31>>2] = $22;
     $$1 = $14;$$1347 = $15;$86 = $14;
     break;
    }
   }
   $32 = ((($14)) + 24|0);
   $33 = HEAP32[$32>>2]|0;
   $34 = ((($14)) + 12|0);
   $35 = HEAP32[$34>>2]|0;
   $36 = ($35|0)==($14|0);
   do {
    if ($36) {
     $41 = ((($14)) + 16|0);
     $42 = ((($41)) + 4|0);
     $43 = HEAP32[$42>>2]|0;
     $44 = ($43|0)==(0|0);
     if ($44) {
      $45 = HEAP32[$41>>2]|0;
      $46 = ($45|0)==(0|0);
      if ($46) {
       $$3 = 0;
       break;
      } else {
       $$1352 = $45;$$1355 = $41;
      }
     } else {
      $$1352 = $43;$$1355 = $42;
     }
     while(1) {
      $47 = ((($$1352)) + 20|0);
      $48 = HEAP32[$47>>2]|0;
      $49 = ($48|0)==(0|0);
      if (!($49)) {
       $$1352 = $48;$$1355 = $47;
       continue;
      }
      $50 = ((($$1352)) + 16|0);
      $51 = HEAP32[$50>>2]|0;
      $52 = ($51|0)==(0|0);
      if ($52) {
       break;
      } else {
       $$1352 = $51;$$1355 = $50;
      }
     }
     HEAP32[$$1355>>2] = 0;
     $$3 = $$1352;
    } else {
     $37 = ((($14)) + 8|0);
     $38 = HEAP32[$37>>2]|0;
     $39 = ((($38)) + 12|0);
     HEAP32[$39>>2] = $35;
     $40 = ((($35)) + 8|0);
     HEAP32[$40>>2] = $38;
     $$3 = $35;
    }
   } while(0);
   $53 = ($33|0)==(0|0);
   if ($53) {
    $$1 = $14;$$1347 = $15;$86 = $14;
   } else {
    $54 = ((($14)) + 28|0);
    $55 = HEAP32[$54>>2]|0;
    $56 = (8148 + ($55<<2)|0);
    $57 = HEAP32[$56>>2]|0;
    $58 = ($14|0)==($57|0);
    if ($58) {
     HEAP32[$56>>2] = $$3;
     $cond374 = ($$3|0)==(0|0);
     if ($cond374) {
      $59 = 1 << $55;
      $60 = $59 ^ -1;
      $61 = HEAP32[(7848)>>2]|0;
      $62 = $61 & $60;
      HEAP32[(7848)>>2] = $62;
      $$1 = $14;$$1347 = $15;$86 = $14;
      break;
     }
    } else {
     $63 = ((($33)) + 16|0);
     $64 = HEAP32[$63>>2]|0;
     $not$370 = ($64|0)!=($14|0);
     $$sink3 = $not$370&1;
     $65 = (((($33)) + 16|0) + ($$sink3<<2)|0);
     HEAP32[$65>>2] = $$3;
     $66 = ($$3|0)==(0|0);
     if ($66) {
      $$1 = $14;$$1347 = $15;$86 = $14;
      break;
     }
    }
    $67 = ((($$3)) + 24|0);
    HEAP32[$67>>2] = $33;
    $68 = ((($14)) + 16|0);
    $69 = HEAP32[$68>>2]|0;
    $70 = ($69|0)==(0|0);
    if (!($70)) {
     $71 = ((($$3)) + 16|0);
     HEAP32[$71>>2] = $69;
     $72 = ((($69)) + 24|0);
     HEAP32[$72>>2] = $$3;
    }
    $73 = ((($68)) + 4|0);
    $74 = HEAP32[$73>>2]|0;
    $75 = ($74|0)==(0|0);
    if ($75) {
     $$1 = $14;$$1347 = $15;$86 = $14;
    } else {
     $76 = ((($$3)) + 20|0);
     HEAP32[$76>>2] = $74;
     $77 = ((($74)) + 24|0);
     HEAP32[$77>>2] = $$3;
     $$1 = $14;$$1347 = $15;$86 = $14;
    }
   }
  } else {
   $$1 = $2;$$1347 = $6;$86 = $2;
  }
 } while(0);
 $87 = ($86>>>0)<($7>>>0);
 if (!($87)) {
  return;
 }
 $88 = ((($7)) + 4|0);
 $89 = HEAP32[$88>>2]|0;
 $90 = $89 & 1;
 $91 = ($90|0)==(0);
 if ($91) {
  return;
 }
 $92 = $89 & 2;
 $93 = ($92|0)==(0);
 if ($93) {
  $94 = HEAP32[(7868)>>2]|0;
  $95 = ($7|0)==($94|0);
  $96 = HEAP32[(7864)>>2]|0;
  if ($95) {
   $97 = HEAP32[(7856)>>2]|0;
   $98 = (($97) + ($$1347))|0;
   HEAP32[(7856)>>2] = $98;
   HEAP32[(7868)>>2] = $$1;
   $99 = $98 | 1;
   $100 = ((($$1)) + 4|0);
   HEAP32[$100>>2] = $99;
   $101 = ($$1|0)==($96|0);
   if (!($101)) {
    return;
   }
   HEAP32[(7864)>>2] = 0;
   HEAP32[(7852)>>2] = 0;
   return;
  }
  $102 = ($7|0)==($96|0);
  if ($102) {
   $103 = HEAP32[(7852)>>2]|0;
   $104 = (($103) + ($$1347))|0;
   HEAP32[(7852)>>2] = $104;
   HEAP32[(7864)>>2] = $86;
   $105 = $104 | 1;
   $106 = ((($$1)) + 4|0);
   HEAP32[$106>>2] = $105;
   $107 = (($86) + ($104)|0);
   HEAP32[$107>>2] = $104;
   return;
  }
  $108 = $89 & -8;
  $109 = (($108) + ($$1347))|0;
  $110 = $89 >>> 3;
  $111 = ($89>>>0)<(256);
  do {
   if ($111) {
    $112 = ((($7)) + 8|0);
    $113 = HEAP32[$112>>2]|0;
    $114 = ((($7)) + 12|0);
    $115 = HEAP32[$114>>2]|0;
    $116 = ($115|0)==($113|0);
    if ($116) {
     $117 = 1 << $110;
     $118 = $117 ^ -1;
     $119 = HEAP32[1961]|0;
     $120 = $119 & $118;
     HEAP32[1961] = $120;
     break;
    } else {
     $121 = ((($113)) + 12|0);
     HEAP32[$121>>2] = $115;
     $122 = ((($115)) + 8|0);
     HEAP32[$122>>2] = $113;
     break;
    }
   } else {
    $123 = ((($7)) + 24|0);
    $124 = HEAP32[$123>>2]|0;
    $125 = ((($7)) + 12|0);
    $126 = HEAP32[$125>>2]|0;
    $127 = ($126|0)==($7|0);
    do {
     if ($127) {
      $132 = ((($7)) + 16|0);
      $133 = ((($132)) + 4|0);
      $134 = HEAP32[$133>>2]|0;
      $135 = ($134|0)==(0|0);
      if ($135) {
       $136 = HEAP32[$132>>2]|0;
       $137 = ($136|0)==(0|0);
       if ($137) {
        $$3365 = 0;
        break;
       } else {
        $$1363 = $136;$$1367 = $132;
       }
      } else {
       $$1363 = $134;$$1367 = $133;
      }
      while(1) {
       $138 = ((($$1363)) + 20|0);
       $139 = HEAP32[$138>>2]|0;
       $140 = ($139|0)==(0|0);
       if (!($140)) {
        $$1363 = $139;$$1367 = $138;
        continue;
       }
       $141 = ((($$1363)) + 16|0);
       $142 = HEAP32[$141>>2]|0;
       $143 = ($142|0)==(0|0);
       if ($143) {
        break;
       } else {
        $$1363 = $142;$$1367 = $141;
       }
      }
      HEAP32[$$1367>>2] = 0;
      $$3365 = $$1363;
     } else {
      $128 = ((($7)) + 8|0);
      $129 = HEAP32[$128>>2]|0;
      $130 = ((($129)) + 12|0);
      HEAP32[$130>>2] = $126;
      $131 = ((($126)) + 8|0);
      HEAP32[$131>>2] = $129;
      $$3365 = $126;
     }
    } while(0);
    $144 = ($124|0)==(0|0);
    if (!($144)) {
     $145 = ((($7)) + 28|0);
     $146 = HEAP32[$145>>2]|0;
     $147 = (8148 + ($146<<2)|0);
     $148 = HEAP32[$147>>2]|0;
     $149 = ($7|0)==($148|0);
     if ($149) {
      HEAP32[$147>>2] = $$3365;
      $cond375 = ($$3365|0)==(0|0);
      if ($cond375) {
       $150 = 1 << $146;
       $151 = $150 ^ -1;
       $152 = HEAP32[(7848)>>2]|0;
       $153 = $152 & $151;
       HEAP32[(7848)>>2] = $153;
       break;
      }
     } else {
      $154 = ((($124)) + 16|0);
      $155 = HEAP32[$154>>2]|0;
      $not$ = ($155|0)!=($7|0);
      $$sink5 = $not$&1;
      $156 = (((($124)) + 16|0) + ($$sink5<<2)|0);
      HEAP32[$156>>2] = $$3365;
      $157 = ($$3365|0)==(0|0);
      if ($157) {
       break;
      }
     }
     $158 = ((($$3365)) + 24|0);
     HEAP32[$158>>2] = $124;
     $159 = ((($7)) + 16|0);
     $160 = HEAP32[$159>>2]|0;
     $161 = ($160|0)==(0|0);
     if (!($161)) {
      $162 = ((($$3365)) + 16|0);
      HEAP32[$162>>2] = $160;
      $163 = ((($160)) + 24|0);
      HEAP32[$163>>2] = $$3365;
     }
     $164 = ((($159)) + 4|0);
     $165 = HEAP32[$164>>2]|0;
     $166 = ($165|0)==(0|0);
     if (!($166)) {
      $167 = ((($$3365)) + 20|0);
      HEAP32[$167>>2] = $165;
      $168 = ((($165)) + 24|0);
      HEAP32[$168>>2] = $$3365;
     }
    }
   }
  } while(0);
  $169 = $109 | 1;
  $170 = ((($$1)) + 4|0);
  HEAP32[$170>>2] = $169;
  $171 = (($86) + ($109)|0);
  HEAP32[$171>>2] = $109;
  $172 = HEAP32[(7864)>>2]|0;
  $173 = ($$1|0)==($172|0);
  if ($173) {
   HEAP32[(7852)>>2] = $109;
   return;
  } else {
   $$2 = $109;
  }
 } else {
  $174 = $89 & -2;
  HEAP32[$88>>2] = $174;
  $175 = $$1347 | 1;
  $176 = ((($$1)) + 4|0);
  HEAP32[$176>>2] = $175;
  $177 = (($86) + ($$1347)|0);
  HEAP32[$177>>2] = $$1347;
  $$2 = $$1347;
 }
 $178 = $$2 >>> 3;
 $179 = ($$2>>>0)<(256);
 if ($179) {
  $180 = $178 << 1;
  $181 = (7884 + ($180<<2)|0);
  $182 = HEAP32[1961]|0;
  $183 = 1 << $178;
  $184 = $182 & $183;
  $185 = ($184|0)==(0);
  if ($185) {
   $186 = $182 | $183;
   HEAP32[1961] = $186;
   $$pre = ((($181)) + 8|0);
   $$0368 = $181;$$pre$phiZ2D = $$pre;
  } else {
   $187 = ((($181)) + 8|0);
   $188 = HEAP32[$187>>2]|0;
   $$0368 = $188;$$pre$phiZ2D = $187;
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $189 = ((($$0368)) + 12|0);
  HEAP32[$189>>2] = $$1;
  $190 = ((($$1)) + 8|0);
  HEAP32[$190>>2] = $$0368;
  $191 = ((($$1)) + 12|0);
  HEAP32[$191>>2] = $181;
  return;
 }
 $192 = $$2 >>> 8;
 $193 = ($192|0)==(0);
 if ($193) {
  $$0361 = 0;
 } else {
  $194 = ($$2>>>0)>(16777215);
  if ($194) {
   $$0361 = 31;
  } else {
   $195 = (($192) + 1048320)|0;
   $196 = $195 >>> 16;
   $197 = $196 & 8;
   $198 = $192 << $197;
   $199 = (($198) + 520192)|0;
   $200 = $199 >>> 16;
   $201 = $200 & 4;
   $202 = $201 | $197;
   $203 = $198 << $201;
   $204 = (($203) + 245760)|0;
   $205 = $204 >>> 16;
   $206 = $205 & 2;
   $207 = $202 | $206;
   $208 = (14 - ($207))|0;
   $209 = $203 << $206;
   $210 = $209 >>> 15;
   $211 = (($208) + ($210))|0;
   $212 = $211 << 1;
   $213 = (($211) + 7)|0;
   $214 = $$2 >>> $213;
   $215 = $214 & 1;
   $216 = $215 | $212;
   $$0361 = $216;
  }
 }
 $217 = (8148 + ($$0361<<2)|0);
 $218 = ((($$1)) + 28|0);
 HEAP32[$218>>2] = $$0361;
 $219 = ((($$1)) + 16|0);
 $220 = ((($$1)) + 20|0);
 HEAP32[$220>>2] = 0;
 HEAP32[$219>>2] = 0;
 $221 = HEAP32[(7848)>>2]|0;
 $222 = 1 << $$0361;
 $223 = $221 & $222;
 $224 = ($223|0)==(0);
 do {
  if ($224) {
   $225 = $221 | $222;
   HEAP32[(7848)>>2] = $225;
   HEAP32[$217>>2] = $$1;
   $226 = ((($$1)) + 24|0);
   HEAP32[$226>>2] = $217;
   $227 = ((($$1)) + 12|0);
   HEAP32[$227>>2] = $$1;
   $228 = ((($$1)) + 8|0);
   HEAP32[$228>>2] = $$1;
  } else {
   $229 = HEAP32[$217>>2]|0;
   $230 = ($$0361|0)==(31);
   $231 = $$0361 >>> 1;
   $232 = (25 - ($231))|0;
   $233 = $230 ? 0 : $232;
   $234 = $$2 << $233;
   $$0348 = $234;$$0349 = $229;
   while(1) {
    $235 = ((($$0349)) + 4|0);
    $236 = HEAP32[$235>>2]|0;
    $237 = $236 & -8;
    $238 = ($237|0)==($$2|0);
    if ($238) {
     label = 73;
     break;
    }
    $239 = $$0348 >>> 31;
    $240 = (((($$0349)) + 16|0) + ($239<<2)|0);
    $241 = $$0348 << 1;
    $242 = HEAP32[$240>>2]|0;
    $243 = ($242|0)==(0|0);
    if ($243) {
     label = 72;
     break;
    } else {
     $$0348 = $241;$$0349 = $242;
    }
   }
   if ((label|0) == 72) {
    HEAP32[$240>>2] = $$1;
    $244 = ((($$1)) + 24|0);
    HEAP32[$244>>2] = $$0349;
    $245 = ((($$1)) + 12|0);
    HEAP32[$245>>2] = $$1;
    $246 = ((($$1)) + 8|0);
    HEAP32[$246>>2] = $$1;
    break;
   }
   else if ((label|0) == 73) {
    $247 = ((($$0349)) + 8|0);
    $248 = HEAP32[$247>>2]|0;
    $249 = ((($248)) + 12|0);
    HEAP32[$249>>2] = $$1;
    HEAP32[$247>>2] = $$1;
    $250 = ((($$1)) + 8|0);
    HEAP32[$250>>2] = $248;
    $251 = ((($$1)) + 12|0);
    HEAP32[$251>>2] = $$0349;
    $252 = ((($$1)) + 24|0);
    HEAP32[$252>>2] = 0;
    break;
   }
  }
 } while(0);
 $253 = HEAP32[(7876)>>2]|0;
 $254 = (($253) + -1)|0;
 HEAP32[(7876)>>2] = $254;
 $255 = ($254|0)==(0);
 if ($255) {
  $$0195$in$i = (8300);
 } else {
  return;
 }
 while(1) {
  $$0195$i = HEAP32[$$0195$in$i>>2]|0;
  $256 = ($$0195$i|0)==(0|0);
  $257 = ((($$0195$i)) + 8|0);
  if ($256) {
   break;
  } else {
   $$0195$in$i = $257;
  }
 }
 HEAP32[(7876)>>2] = -1;
 return;
}
function _calloc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0);
 if ($2) {
  $$0 = 0;
 } else {
  $3 = Math_imul($1, $0)|0;
  $4 = $1 | $0;
  $5 = ($4>>>0)>(65535);
  if ($5) {
   $6 = (($3>>>0) / ($0>>>0))&-1;
   $7 = ($6|0)==($1|0);
   $$ = $7 ? $3 : -1;
   $$0 = $$;
  } else {
   $$0 = $3;
  }
 }
 $8 = (_malloc($$0)|0);
 $9 = ($8|0)==(0|0);
 if ($9) {
  return ($8|0);
 }
 $10 = ((($8)) + -4|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = $11 & 3;
 $13 = ($12|0)==(0);
 if ($13) {
  return ($8|0);
 }
 _memset(($8|0),0,($$0|0))|0;
 return ($8|0);
}
function _realloc($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $3 = 0, $4 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0|0);
 if ($2) {
  $3 = (_malloc($1)|0);
  $$1 = $3;
  return ($$1|0);
 }
 $4 = ($1>>>0)>(4294967231);
 if ($4) {
  $5 = (___errno_location()|0);
  HEAP32[$5>>2] = 12;
  $$1 = 0;
  return ($$1|0);
 }
 $6 = ($1>>>0)<(11);
 $7 = (($1) + 11)|0;
 $8 = $7 & -8;
 $9 = $6 ? 16 : $8;
 $10 = ((($0)) + -8|0);
 $11 = (_try_realloc_chunk($10,$9)|0);
 $12 = ($11|0)==(0|0);
 if (!($12)) {
  $13 = ((($11)) + 8|0);
  $$1 = $13;
  return ($$1|0);
 }
 $14 = (_malloc($1)|0);
 $15 = ($14|0)==(0|0);
 if ($15) {
  $$1 = 0;
  return ($$1|0);
 }
 $16 = ((($0)) + -4|0);
 $17 = HEAP32[$16>>2]|0;
 $18 = $17 & -8;
 $19 = $17 & 3;
 $20 = ($19|0)==(0);
 $21 = $20 ? 8 : 4;
 $22 = (($18) - ($21))|0;
 $23 = ($22>>>0)<($1>>>0);
 $24 = $23 ? $22 : $1;
 _memcpy(($14|0),($0|0),($24|0))|0;
 _free($0);
 $$1 = $14;
 return ($$1|0);
}
function _try_realloc_chunk($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$1246 = 0, $$1249 = 0, $$2 = 0, $$3 = 0, $$sink1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0;
 var $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0;
 var $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $15 = 0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0;
 var $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0;
 var $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0;
 var $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0;
 var $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond = 0, $not$ = 0, $storemerge = 0, $storemerge1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ((($0)) + 4|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = $3 & -8;
 $5 = (($0) + ($4)|0);
 $6 = $3 & 3;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ($1>>>0)<(256);
  if ($8) {
   $$2 = 0;
   return ($$2|0);
  }
  $9 = (($1) + 4)|0;
  $10 = ($4>>>0)<($9>>>0);
  if (!($10)) {
   $11 = (($4) - ($1))|0;
   $12 = HEAP32[(8324)>>2]|0;
   $13 = $12 << 1;
   $14 = ($11>>>0)>($13>>>0);
   if (!($14)) {
    $$2 = $0;
    return ($$2|0);
   }
  }
  $$2 = 0;
  return ($$2|0);
 }
 $15 = ($4>>>0)<($1>>>0);
 if (!($15)) {
  $16 = (($4) - ($1))|0;
  $17 = ($16>>>0)>(15);
  if (!($17)) {
   $$2 = $0;
   return ($$2|0);
  }
  $18 = (($0) + ($1)|0);
  $19 = $3 & 1;
  $20 = $19 | $1;
  $21 = $20 | 2;
  HEAP32[$2>>2] = $21;
  $22 = ((($18)) + 4|0);
  $23 = $16 | 3;
  HEAP32[$22>>2] = $23;
  $24 = (($18) + ($16)|0);
  $25 = ((($24)) + 4|0);
  $26 = HEAP32[$25>>2]|0;
  $27 = $26 | 1;
  HEAP32[$25>>2] = $27;
  _dispose_chunk($18,$16);
  $$2 = $0;
  return ($$2|0);
 }
 $28 = HEAP32[(7868)>>2]|0;
 $29 = ($5|0)==($28|0);
 if ($29) {
  $30 = HEAP32[(7856)>>2]|0;
  $31 = (($30) + ($4))|0;
  $32 = ($31>>>0)>($1>>>0);
  $33 = (($31) - ($1))|0;
  $34 = (($0) + ($1)|0);
  if (!($32)) {
   $$2 = 0;
   return ($$2|0);
  }
  $35 = $33 | 1;
  $36 = ((($34)) + 4|0);
  $37 = $3 & 1;
  $38 = $37 | $1;
  $39 = $38 | 2;
  HEAP32[$2>>2] = $39;
  HEAP32[$36>>2] = $35;
  HEAP32[(7868)>>2] = $34;
  HEAP32[(7856)>>2] = $33;
  $$2 = $0;
  return ($$2|0);
 }
 $40 = HEAP32[(7864)>>2]|0;
 $41 = ($5|0)==($40|0);
 if ($41) {
  $42 = HEAP32[(7852)>>2]|0;
  $43 = (($42) + ($4))|0;
  $44 = ($43>>>0)<($1>>>0);
  if ($44) {
   $$2 = 0;
   return ($$2|0);
  }
  $45 = (($43) - ($1))|0;
  $46 = ($45>>>0)>(15);
  $47 = $3 & 1;
  if ($46) {
   $48 = (($0) + ($1)|0);
   $49 = (($48) + ($45)|0);
   $50 = $47 | $1;
   $51 = $50 | 2;
   HEAP32[$2>>2] = $51;
   $52 = ((($48)) + 4|0);
   $53 = $45 | 1;
   HEAP32[$52>>2] = $53;
   HEAP32[$49>>2] = $45;
   $54 = ((($49)) + 4|0);
   $55 = HEAP32[$54>>2]|0;
   $56 = $55 & -2;
   HEAP32[$54>>2] = $56;
   $storemerge = $48;$storemerge1 = $45;
  } else {
   $57 = $47 | $43;
   $58 = $57 | 2;
   HEAP32[$2>>2] = $58;
   $59 = (($0) + ($43)|0);
   $60 = ((($59)) + 4|0);
   $61 = HEAP32[$60>>2]|0;
   $62 = $61 | 1;
   HEAP32[$60>>2] = $62;
   $storemerge = 0;$storemerge1 = 0;
  }
  HEAP32[(7852)>>2] = $storemerge1;
  HEAP32[(7864)>>2] = $storemerge;
  $$2 = $0;
  return ($$2|0);
 }
 $63 = ((($5)) + 4|0);
 $64 = HEAP32[$63>>2]|0;
 $65 = $64 & 2;
 $66 = ($65|0)==(0);
 if (!($66)) {
  $$2 = 0;
  return ($$2|0);
 }
 $67 = $64 & -8;
 $68 = (($67) + ($4))|0;
 $69 = ($68>>>0)<($1>>>0);
 if ($69) {
  $$2 = 0;
  return ($$2|0);
 }
 $70 = (($68) - ($1))|0;
 $71 = $64 >>> 3;
 $72 = ($64>>>0)<(256);
 do {
  if ($72) {
   $73 = ((($5)) + 8|0);
   $74 = HEAP32[$73>>2]|0;
   $75 = ((($5)) + 12|0);
   $76 = HEAP32[$75>>2]|0;
   $77 = ($76|0)==($74|0);
   if ($77) {
    $78 = 1 << $71;
    $79 = $78 ^ -1;
    $80 = HEAP32[1961]|0;
    $81 = $80 & $79;
    HEAP32[1961] = $81;
    break;
   } else {
    $82 = ((($74)) + 12|0);
    HEAP32[$82>>2] = $76;
    $83 = ((($76)) + 8|0);
    HEAP32[$83>>2] = $74;
    break;
   }
  } else {
   $84 = ((($5)) + 24|0);
   $85 = HEAP32[$84>>2]|0;
   $86 = ((($5)) + 12|0);
   $87 = HEAP32[$86>>2]|0;
   $88 = ($87|0)==($5|0);
   do {
    if ($88) {
     $93 = ((($5)) + 16|0);
     $94 = ((($93)) + 4|0);
     $95 = HEAP32[$94>>2]|0;
     $96 = ($95|0)==(0|0);
     if ($96) {
      $97 = HEAP32[$93>>2]|0;
      $98 = ($97|0)==(0|0);
      if ($98) {
       $$3 = 0;
       break;
      } else {
       $$1246 = $97;$$1249 = $93;
      }
     } else {
      $$1246 = $95;$$1249 = $94;
     }
     while(1) {
      $99 = ((($$1246)) + 20|0);
      $100 = HEAP32[$99>>2]|0;
      $101 = ($100|0)==(0|0);
      if (!($101)) {
       $$1246 = $100;$$1249 = $99;
       continue;
      }
      $102 = ((($$1246)) + 16|0);
      $103 = HEAP32[$102>>2]|0;
      $104 = ($103|0)==(0|0);
      if ($104) {
       break;
      } else {
       $$1246 = $103;$$1249 = $102;
      }
     }
     HEAP32[$$1249>>2] = 0;
     $$3 = $$1246;
    } else {
     $89 = ((($5)) + 8|0);
     $90 = HEAP32[$89>>2]|0;
     $91 = ((($90)) + 12|0);
     HEAP32[$91>>2] = $87;
     $92 = ((($87)) + 8|0);
     HEAP32[$92>>2] = $90;
     $$3 = $87;
    }
   } while(0);
   $105 = ($85|0)==(0|0);
   if (!($105)) {
    $106 = ((($5)) + 28|0);
    $107 = HEAP32[$106>>2]|0;
    $108 = (8148 + ($107<<2)|0);
    $109 = HEAP32[$108>>2]|0;
    $110 = ($5|0)==($109|0);
    if ($110) {
     HEAP32[$108>>2] = $$3;
     $cond = ($$3|0)==(0|0);
     if ($cond) {
      $111 = 1 << $107;
      $112 = $111 ^ -1;
      $113 = HEAP32[(7848)>>2]|0;
      $114 = $113 & $112;
      HEAP32[(7848)>>2] = $114;
      break;
     }
    } else {
     $115 = ((($85)) + 16|0);
     $116 = HEAP32[$115>>2]|0;
     $not$ = ($116|0)!=($5|0);
     $$sink1 = $not$&1;
     $117 = (((($85)) + 16|0) + ($$sink1<<2)|0);
     HEAP32[$117>>2] = $$3;
     $118 = ($$3|0)==(0|0);
     if ($118) {
      break;
     }
    }
    $119 = ((($$3)) + 24|0);
    HEAP32[$119>>2] = $85;
    $120 = ((($5)) + 16|0);
    $121 = HEAP32[$120>>2]|0;
    $122 = ($121|0)==(0|0);
    if (!($122)) {
     $123 = ((($$3)) + 16|0);
     HEAP32[$123>>2] = $121;
     $124 = ((($121)) + 24|0);
     HEAP32[$124>>2] = $$3;
    }
    $125 = ((($120)) + 4|0);
    $126 = HEAP32[$125>>2]|0;
    $127 = ($126|0)==(0|0);
    if (!($127)) {
     $128 = ((($$3)) + 20|0);
     HEAP32[$128>>2] = $126;
     $129 = ((($126)) + 24|0);
     HEAP32[$129>>2] = $$3;
    }
   }
  }
 } while(0);
 $130 = ($70>>>0)<(16);
 $131 = $3 & 1;
 if ($130) {
  $132 = $68 | $131;
  $133 = $132 | 2;
  HEAP32[$2>>2] = $133;
  $134 = (($0) + ($68)|0);
  $135 = ((($134)) + 4|0);
  $136 = HEAP32[$135>>2]|0;
  $137 = $136 | 1;
  HEAP32[$135>>2] = $137;
  $$2 = $0;
  return ($$2|0);
 } else {
  $138 = (($0) + ($1)|0);
  $139 = $131 | $1;
  $140 = $139 | 2;
  HEAP32[$2>>2] = $140;
  $141 = ((($138)) + 4|0);
  $142 = $70 | 3;
  HEAP32[$141>>2] = $142;
  $143 = (($138) + ($70)|0);
  $144 = ((($143)) + 4|0);
  $145 = HEAP32[$144>>2]|0;
  $146 = $145 | 1;
  HEAP32[$144>>2] = $146;
  _dispose_chunk($138,$70);
  $$2 = $0;
  return ($$2|0);
 }
 return (0)|0;
}
function _dispose_chunk($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0366 = 0, $$0367 = 0, $$0378 = 0, $$0385 = 0, $$1 = 0, $$1365 = 0, $$1373 = 0, $$1376 = 0, $$1380 = 0, $$1384 = 0, $$2 = 0, $$3 = 0, $$3382 = 0, $$pre = 0, $$pre$phiZ2D = 0, $$sink2 = 0, $$sink4 = 0, $10 = 0, $100 = 0, $101 = 0;
 var $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0;
 var $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0;
 var $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0;
 var $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0;
 var $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0;
 var $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $2 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0;
 var $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0;
 var $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0;
 var $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0;
 var $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0;
 var $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0;
 var $cond = 0, $cond5 = 0, $not$ = 0, $not$1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = (($0) + ($1)|0);
 $3 = ((($0)) + 4|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = $4 & 1;
 $6 = ($5|0)==(0);
 do {
  if ($6) {
   $7 = HEAP32[$0>>2]|0;
   $8 = $4 & 3;
   $9 = ($8|0)==(0);
   if ($9) {
    return;
   }
   $10 = (0 - ($7))|0;
   $11 = (($0) + ($10)|0);
   $12 = (($7) + ($1))|0;
   $13 = HEAP32[(7864)>>2]|0;
   $14 = ($11|0)==($13|0);
   if ($14) {
    $74 = ((($2)) + 4|0);
    $75 = HEAP32[$74>>2]|0;
    $76 = $75 & 3;
    $77 = ($76|0)==(3);
    if (!($77)) {
     $$1 = $11;$$1365 = $12;
     break;
    }
    $78 = (($11) + ($12)|0);
    $79 = ((($11)) + 4|0);
    $80 = $12 | 1;
    $81 = $75 & -2;
    HEAP32[(7852)>>2] = $12;
    HEAP32[$74>>2] = $81;
    HEAP32[$79>>2] = $80;
    HEAP32[$78>>2] = $12;
    return;
   }
   $15 = $7 >>> 3;
   $16 = ($7>>>0)<(256);
   if ($16) {
    $17 = ((($11)) + 8|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ((($11)) + 12|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($20|0)==($18|0);
    if ($21) {
     $22 = 1 << $15;
     $23 = $22 ^ -1;
     $24 = HEAP32[1961]|0;
     $25 = $24 & $23;
     HEAP32[1961] = $25;
     $$1 = $11;$$1365 = $12;
     break;
    } else {
     $26 = ((($18)) + 12|0);
     HEAP32[$26>>2] = $20;
     $27 = ((($20)) + 8|0);
     HEAP32[$27>>2] = $18;
     $$1 = $11;$$1365 = $12;
     break;
    }
   }
   $28 = ((($11)) + 24|0);
   $29 = HEAP32[$28>>2]|0;
   $30 = ((($11)) + 12|0);
   $31 = HEAP32[$30>>2]|0;
   $32 = ($31|0)==($11|0);
   do {
    if ($32) {
     $37 = ((($11)) + 16|0);
     $38 = ((($37)) + 4|0);
     $39 = HEAP32[$38>>2]|0;
     $40 = ($39|0)==(0|0);
     if ($40) {
      $41 = HEAP32[$37>>2]|0;
      $42 = ($41|0)==(0|0);
      if ($42) {
       $$3 = 0;
       break;
      } else {
       $$1373 = $41;$$1376 = $37;
      }
     } else {
      $$1373 = $39;$$1376 = $38;
     }
     while(1) {
      $43 = ((($$1373)) + 20|0);
      $44 = HEAP32[$43>>2]|0;
      $45 = ($44|0)==(0|0);
      if (!($45)) {
       $$1373 = $44;$$1376 = $43;
       continue;
      }
      $46 = ((($$1373)) + 16|0);
      $47 = HEAP32[$46>>2]|0;
      $48 = ($47|0)==(0|0);
      if ($48) {
       break;
      } else {
       $$1373 = $47;$$1376 = $46;
      }
     }
     HEAP32[$$1376>>2] = 0;
     $$3 = $$1373;
    } else {
     $33 = ((($11)) + 8|0);
     $34 = HEAP32[$33>>2]|0;
     $35 = ((($34)) + 12|0);
     HEAP32[$35>>2] = $31;
     $36 = ((($31)) + 8|0);
     HEAP32[$36>>2] = $34;
     $$3 = $31;
    }
   } while(0);
   $49 = ($29|0)==(0|0);
   if ($49) {
    $$1 = $11;$$1365 = $12;
   } else {
    $50 = ((($11)) + 28|0);
    $51 = HEAP32[$50>>2]|0;
    $52 = (8148 + ($51<<2)|0);
    $53 = HEAP32[$52>>2]|0;
    $54 = ($11|0)==($53|0);
    if ($54) {
     HEAP32[$52>>2] = $$3;
     $cond = ($$3|0)==(0|0);
     if ($cond) {
      $55 = 1 << $51;
      $56 = $55 ^ -1;
      $57 = HEAP32[(7848)>>2]|0;
      $58 = $57 & $56;
      HEAP32[(7848)>>2] = $58;
      $$1 = $11;$$1365 = $12;
      break;
     }
    } else {
     $59 = ((($29)) + 16|0);
     $60 = HEAP32[$59>>2]|0;
     $not$1 = ($60|0)!=($11|0);
     $$sink2 = $not$1&1;
     $61 = (((($29)) + 16|0) + ($$sink2<<2)|0);
     HEAP32[$61>>2] = $$3;
     $62 = ($$3|0)==(0|0);
     if ($62) {
      $$1 = $11;$$1365 = $12;
      break;
     }
    }
    $63 = ((($$3)) + 24|0);
    HEAP32[$63>>2] = $29;
    $64 = ((($11)) + 16|0);
    $65 = HEAP32[$64>>2]|0;
    $66 = ($65|0)==(0|0);
    if (!($66)) {
     $67 = ((($$3)) + 16|0);
     HEAP32[$67>>2] = $65;
     $68 = ((($65)) + 24|0);
     HEAP32[$68>>2] = $$3;
    }
    $69 = ((($64)) + 4|0);
    $70 = HEAP32[$69>>2]|0;
    $71 = ($70|0)==(0|0);
    if ($71) {
     $$1 = $11;$$1365 = $12;
    } else {
     $72 = ((($$3)) + 20|0);
     HEAP32[$72>>2] = $70;
     $73 = ((($70)) + 24|0);
     HEAP32[$73>>2] = $$3;
     $$1 = $11;$$1365 = $12;
    }
   }
  } else {
   $$1 = $0;$$1365 = $1;
  }
 } while(0);
 $82 = ((($2)) + 4|0);
 $83 = HEAP32[$82>>2]|0;
 $84 = $83 & 2;
 $85 = ($84|0)==(0);
 if ($85) {
  $86 = HEAP32[(7868)>>2]|0;
  $87 = ($2|0)==($86|0);
  $88 = HEAP32[(7864)>>2]|0;
  if ($87) {
   $89 = HEAP32[(7856)>>2]|0;
   $90 = (($89) + ($$1365))|0;
   HEAP32[(7856)>>2] = $90;
   HEAP32[(7868)>>2] = $$1;
   $91 = $90 | 1;
   $92 = ((($$1)) + 4|0);
   HEAP32[$92>>2] = $91;
   $93 = ($$1|0)==($88|0);
   if (!($93)) {
    return;
   }
   HEAP32[(7864)>>2] = 0;
   HEAP32[(7852)>>2] = 0;
   return;
  }
  $94 = ($2|0)==($88|0);
  if ($94) {
   $95 = HEAP32[(7852)>>2]|0;
   $96 = (($95) + ($$1365))|0;
   HEAP32[(7852)>>2] = $96;
   HEAP32[(7864)>>2] = $$1;
   $97 = $96 | 1;
   $98 = ((($$1)) + 4|0);
   HEAP32[$98>>2] = $97;
   $99 = (($$1) + ($96)|0);
   HEAP32[$99>>2] = $96;
   return;
  }
  $100 = $83 & -8;
  $101 = (($100) + ($$1365))|0;
  $102 = $83 >>> 3;
  $103 = ($83>>>0)<(256);
  do {
   if ($103) {
    $104 = ((($2)) + 8|0);
    $105 = HEAP32[$104>>2]|0;
    $106 = ((($2)) + 12|0);
    $107 = HEAP32[$106>>2]|0;
    $108 = ($107|0)==($105|0);
    if ($108) {
     $109 = 1 << $102;
     $110 = $109 ^ -1;
     $111 = HEAP32[1961]|0;
     $112 = $111 & $110;
     HEAP32[1961] = $112;
     break;
    } else {
     $113 = ((($105)) + 12|0);
     HEAP32[$113>>2] = $107;
     $114 = ((($107)) + 8|0);
     HEAP32[$114>>2] = $105;
     break;
    }
   } else {
    $115 = ((($2)) + 24|0);
    $116 = HEAP32[$115>>2]|0;
    $117 = ((($2)) + 12|0);
    $118 = HEAP32[$117>>2]|0;
    $119 = ($118|0)==($2|0);
    do {
     if ($119) {
      $124 = ((($2)) + 16|0);
      $125 = ((($124)) + 4|0);
      $126 = HEAP32[$125>>2]|0;
      $127 = ($126|0)==(0|0);
      if ($127) {
       $128 = HEAP32[$124>>2]|0;
       $129 = ($128|0)==(0|0);
       if ($129) {
        $$3382 = 0;
        break;
       } else {
        $$1380 = $128;$$1384 = $124;
       }
      } else {
       $$1380 = $126;$$1384 = $125;
      }
      while(1) {
       $130 = ((($$1380)) + 20|0);
       $131 = HEAP32[$130>>2]|0;
       $132 = ($131|0)==(0|0);
       if (!($132)) {
        $$1380 = $131;$$1384 = $130;
        continue;
       }
       $133 = ((($$1380)) + 16|0);
       $134 = HEAP32[$133>>2]|0;
       $135 = ($134|0)==(0|0);
       if ($135) {
        break;
       } else {
        $$1380 = $134;$$1384 = $133;
       }
      }
      HEAP32[$$1384>>2] = 0;
      $$3382 = $$1380;
     } else {
      $120 = ((($2)) + 8|0);
      $121 = HEAP32[$120>>2]|0;
      $122 = ((($121)) + 12|0);
      HEAP32[$122>>2] = $118;
      $123 = ((($118)) + 8|0);
      HEAP32[$123>>2] = $121;
      $$3382 = $118;
     }
    } while(0);
    $136 = ($116|0)==(0|0);
    if (!($136)) {
     $137 = ((($2)) + 28|0);
     $138 = HEAP32[$137>>2]|0;
     $139 = (8148 + ($138<<2)|0);
     $140 = HEAP32[$139>>2]|0;
     $141 = ($2|0)==($140|0);
     if ($141) {
      HEAP32[$139>>2] = $$3382;
      $cond5 = ($$3382|0)==(0|0);
      if ($cond5) {
       $142 = 1 << $138;
       $143 = $142 ^ -1;
       $144 = HEAP32[(7848)>>2]|0;
       $145 = $144 & $143;
       HEAP32[(7848)>>2] = $145;
       break;
      }
     } else {
      $146 = ((($116)) + 16|0);
      $147 = HEAP32[$146>>2]|0;
      $not$ = ($147|0)!=($2|0);
      $$sink4 = $not$&1;
      $148 = (((($116)) + 16|0) + ($$sink4<<2)|0);
      HEAP32[$148>>2] = $$3382;
      $149 = ($$3382|0)==(0|0);
      if ($149) {
       break;
      }
     }
     $150 = ((($$3382)) + 24|0);
     HEAP32[$150>>2] = $116;
     $151 = ((($2)) + 16|0);
     $152 = HEAP32[$151>>2]|0;
     $153 = ($152|0)==(0|0);
     if (!($153)) {
      $154 = ((($$3382)) + 16|0);
      HEAP32[$154>>2] = $152;
      $155 = ((($152)) + 24|0);
      HEAP32[$155>>2] = $$3382;
     }
     $156 = ((($151)) + 4|0);
     $157 = HEAP32[$156>>2]|0;
     $158 = ($157|0)==(0|0);
     if (!($158)) {
      $159 = ((($$3382)) + 20|0);
      HEAP32[$159>>2] = $157;
      $160 = ((($157)) + 24|0);
      HEAP32[$160>>2] = $$3382;
     }
    }
   }
  } while(0);
  $161 = $101 | 1;
  $162 = ((($$1)) + 4|0);
  HEAP32[$162>>2] = $161;
  $163 = (($$1) + ($101)|0);
  HEAP32[$163>>2] = $101;
  $164 = HEAP32[(7864)>>2]|0;
  $165 = ($$1|0)==($164|0);
  if ($165) {
   HEAP32[(7852)>>2] = $101;
   return;
  } else {
   $$2 = $101;
  }
 } else {
  $166 = $83 & -2;
  HEAP32[$82>>2] = $166;
  $167 = $$1365 | 1;
  $168 = ((($$1)) + 4|0);
  HEAP32[$168>>2] = $167;
  $169 = (($$1) + ($$1365)|0);
  HEAP32[$169>>2] = $$1365;
  $$2 = $$1365;
 }
 $170 = $$2 >>> 3;
 $171 = ($$2>>>0)<(256);
 if ($171) {
  $172 = $170 << 1;
  $173 = (7884 + ($172<<2)|0);
  $174 = HEAP32[1961]|0;
  $175 = 1 << $170;
  $176 = $174 & $175;
  $177 = ($176|0)==(0);
  if ($177) {
   $178 = $174 | $175;
   HEAP32[1961] = $178;
   $$pre = ((($173)) + 8|0);
   $$0385 = $173;$$pre$phiZ2D = $$pre;
  } else {
   $179 = ((($173)) + 8|0);
   $180 = HEAP32[$179>>2]|0;
   $$0385 = $180;$$pre$phiZ2D = $179;
  }
  HEAP32[$$pre$phiZ2D>>2] = $$1;
  $181 = ((($$0385)) + 12|0);
  HEAP32[$181>>2] = $$1;
  $182 = ((($$1)) + 8|0);
  HEAP32[$182>>2] = $$0385;
  $183 = ((($$1)) + 12|0);
  HEAP32[$183>>2] = $173;
  return;
 }
 $184 = $$2 >>> 8;
 $185 = ($184|0)==(0);
 if ($185) {
  $$0378 = 0;
 } else {
  $186 = ($$2>>>0)>(16777215);
  if ($186) {
   $$0378 = 31;
  } else {
   $187 = (($184) + 1048320)|0;
   $188 = $187 >>> 16;
   $189 = $188 & 8;
   $190 = $184 << $189;
   $191 = (($190) + 520192)|0;
   $192 = $191 >>> 16;
   $193 = $192 & 4;
   $194 = $193 | $189;
   $195 = $190 << $193;
   $196 = (($195) + 245760)|0;
   $197 = $196 >>> 16;
   $198 = $197 & 2;
   $199 = $194 | $198;
   $200 = (14 - ($199))|0;
   $201 = $195 << $198;
   $202 = $201 >>> 15;
   $203 = (($200) + ($202))|0;
   $204 = $203 << 1;
   $205 = (($203) + 7)|0;
   $206 = $$2 >>> $205;
   $207 = $206 & 1;
   $208 = $207 | $204;
   $$0378 = $208;
  }
 }
 $209 = (8148 + ($$0378<<2)|0);
 $210 = ((($$1)) + 28|0);
 HEAP32[$210>>2] = $$0378;
 $211 = ((($$1)) + 16|0);
 $212 = ((($$1)) + 20|0);
 HEAP32[$212>>2] = 0;
 HEAP32[$211>>2] = 0;
 $213 = HEAP32[(7848)>>2]|0;
 $214 = 1 << $$0378;
 $215 = $213 & $214;
 $216 = ($215|0)==(0);
 if ($216) {
  $217 = $213 | $214;
  HEAP32[(7848)>>2] = $217;
  HEAP32[$209>>2] = $$1;
  $218 = ((($$1)) + 24|0);
  HEAP32[$218>>2] = $209;
  $219 = ((($$1)) + 12|0);
  HEAP32[$219>>2] = $$1;
  $220 = ((($$1)) + 8|0);
  HEAP32[$220>>2] = $$1;
  return;
 }
 $221 = HEAP32[$209>>2]|0;
 $222 = ($$0378|0)==(31);
 $223 = $$0378 >>> 1;
 $224 = (25 - ($223))|0;
 $225 = $222 ? 0 : $224;
 $226 = $$2 << $225;
 $$0366 = $226;$$0367 = $221;
 while(1) {
  $227 = ((($$0367)) + 4|0);
  $228 = HEAP32[$227>>2]|0;
  $229 = $228 & -8;
  $230 = ($229|0)==($$2|0);
  if ($230) {
   label = 69;
   break;
  }
  $231 = $$0366 >>> 31;
  $232 = (((($$0367)) + 16|0) + ($231<<2)|0);
  $233 = $$0366 << 1;
  $234 = HEAP32[$232>>2]|0;
  $235 = ($234|0)==(0|0);
  if ($235) {
   label = 68;
   break;
  } else {
   $$0366 = $233;$$0367 = $234;
  }
 }
 if ((label|0) == 68) {
  HEAP32[$232>>2] = $$1;
  $236 = ((($$1)) + 24|0);
  HEAP32[$236>>2] = $$0367;
  $237 = ((($$1)) + 12|0);
  HEAP32[$237>>2] = $$1;
  $238 = ((($$1)) + 8|0);
  HEAP32[$238>>2] = $$1;
  return;
 }
 else if ((label|0) == 69) {
  $239 = ((($$0367)) + 8|0);
  $240 = HEAP32[$239>>2]|0;
  $241 = ((($240)) + 12|0);
  HEAP32[$241>>2] = $$1;
  HEAP32[$239>>2] = $$1;
  $242 = ((($$1)) + 8|0);
  HEAP32[$242>>2] = $240;
  $243 = ((($$1)) + 12|0);
  HEAP32[$243>>2] = $$0367;
  $244 = ((($$1)) + 24|0);
  HEAP32[$244>>2] = 0;
  return;
 }
}
function _emscripten_get_global_libc() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (8340|0);
}
function ___stdio_close($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $vararg_buffer = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $vararg_buffer = sp;
 $1 = ((($0)) + 60|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = (_dummy_570($2)|0);
 HEAP32[$vararg_buffer>>2] = $3;
 $4 = (___syscall6(6,($vararg_buffer|0))|0);
 $5 = (___syscall_ret($4)|0);
 STACKTOP = sp;return ($5|0);
}
function ___stdio_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$04756 = 0, $$04855 = 0, $$04954 = 0, $$051 = 0, $$1 = 0, $$150 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0;
 var $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_buffer3 = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr6 = 0;
 var $vararg_ptr7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $vararg_buffer3 = sp + 16|0;
 $vararg_buffer = sp;
 $3 = sp + 32|0;
 $4 = ((($0)) + 28|0);
 $5 = HEAP32[$4>>2]|0;
 HEAP32[$3>>2] = $5;
 $6 = ((($3)) + 4|0);
 $7 = ((($0)) + 20|0);
 $8 = HEAP32[$7>>2]|0;
 $9 = (($8) - ($5))|0;
 HEAP32[$6>>2] = $9;
 $10 = ((($3)) + 8|0);
 HEAP32[$10>>2] = $1;
 $11 = ((($3)) + 12|0);
 HEAP32[$11>>2] = $2;
 $12 = (($9) + ($2))|0;
 $13 = ((($0)) + 60|0);
 $14 = HEAP32[$13>>2]|0;
 $15 = $3;
 HEAP32[$vararg_buffer>>2] = $14;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = $15;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = 2;
 $16 = (___syscall146(146,($vararg_buffer|0))|0);
 $17 = (___syscall_ret($16)|0);
 $18 = ($12|0)==($17|0);
 L1: do {
  if ($18) {
   label = 3;
  } else {
   $$04756 = 2;$$04855 = $12;$$04954 = $3;$25 = $17;
   while(1) {
    $26 = ($25|0)<(0);
    if ($26) {
     break;
    }
    $34 = (($$04855) - ($25))|0;
    $35 = ((($$04954)) + 4|0);
    $36 = HEAP32[$35>>2]|0;
    $37 = ($25>>>0)>($36>>>0);
    $38 = ((($$04954)) + 8|0);
    $$150 = $37 ? $38 : $$04954;
    $39 = $37 << 31 >> 31;
    $$1 = (($39) + ($$04756))|0;
    $40 = $37 ? $36 : 0;
    $$0 = (($25) - ($40))|0;
    $41 = HEAP32[$$150>>2]|0;
    $42 = (($41) + ($$0)|0);
    HEAP32[$$150>>2] = $42;
    $43 = ((($$150)) + 4|0);
    $44 = HEAP32[$43>>2]|0;
    $45 = (($44) - ($$0))|0;
    HEAP32[$43>>2] = $45;
    $46 = HEAP32[$13>>2]|0;
    $47 = $$150;
    HEAP32[$vararg_buffer3>>2] = $46;
    $vararg_ptr6 = ((($vararg_buffer3)) + 4|0);
    HEAP32[$vararg_ptr6>>2] = $47;
    $vararg_ptr7 = ((($vararg_buffer3)) + 8|0);
    HEAP32[$vararg_ptr7>>2] = $$1;
    $48 = (___syscall146(146,($vararg_buffer3|0))|0);
    $49 = (___syscall_ret($48)|0);
    $50 = ($34|0)==($49|0);
    if ($50) {
     label = 3;
     break L1;
    } else {
     $$04756 = $$1;$$04855 = $34;$$04954 = $$150;$25 = $49;
    }
   }
   $27 = ((($0)) + 16|0);
   HEAP32[$27>>2] = 0;
   HEAP32[$4>>2] = 0;
   HEAP32[$7>>2] = 0;
   $28 = HEAP32[$0>>2]|0;
   $29 = $28 | 32;
   HEAP32[$0>>2] = $29;
   $30 = ($$04756|0)==(2);
   if ($30) {
    $$051 = 0;
   } else {
    $31 = ((($$04954)) + 4|0);
    $32 = HEAP32[$31>>2]|0;
    $33 = (($2) - ($32))|0;
    $$051 = $33;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $19 = ((($0)) + 44|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ((($0)) + 48|0);
  $22 = HEAP32[$21>>2]|0;
  $23 = (($20) + ($22)|0);
  $24 = ((($0)) + 16|0);
  HEAP32[$24>>2] = $23;
  HEAP32[$4>>2] = $20;
  HEAP32[$7>>2] = $20;
  $$051 = $2;
 }
 STACKTOP = sp;return ($$051|0);
}
function ___stdio_seek($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$pre = 0, $10 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, $vararg_ptr3 = 0, $vararg_ptr4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 20|0;
 $4 = ((($0)) + 60|0);
 $5 = HEAP32[$4>>2]|0;
 $6 = $3;
 HEAP32[$vararg_buffer>>2] = $5;
 $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
 HEAP32[$vararg_ptr1>>2] = 0;
 $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
 HEAP32[$vararg_ptr2>>2] = $1;
 $vararg_ptr3 = ((($vararg_buffer)) + 12|0);
 HEAP32[$vararg_ptr3>>2] = $6;
 $vararg_ptr4 = ((($vararg_buffer)) + 16|0);
 HEAP32[$vararg_ptr4>>2] = $2;
 $7 = (___syscall140(140,($vararg_buffer|0))|0);
 $8 = (___syscall_ret($7)|0);
 $9 = ($8|0)<(0);
 if ($9) {
  HEAP32[$3>>2] = -1;
  $10 = -1;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $10 = $$pre;
 }
 STACKTOP = sp;return ($10|0);
}
function ___syscall_ret($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)>(4294963200);
 if ($1) {
  $2 = (0 - ($0))|0;
  $3 = (___errno_location()|0);
  HEAP32[$3>>2] = $2;
  $$0 = -1;
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function ___errno_location() {
 var $0 = 0, $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (___pthread_self_103()|0);
 $1 = ((($0)) + 64|0);
 return ($1|0);
}
function ___pthread_self_103() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function _pthread_self() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 return (216|0);
}
function _dummy_570($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return ($0|0);
}
function ___stdout_write($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $vararg_buffer = 0, $vararg_ptr1 = 0, $vararg_ptr2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $vararg_buffer = sp;
 $3 = sp + 16|0;
 $4 = ((($0)) + 36|0);
 HEAP32[$4>>2] = 4;
 $5 = HEAP32[$0>>2]|0;
 $6 = $5 & 64;
 $7 = ($6|0)==(0);
 if ($7) {
  $8 = ((($0)) + 60|0);
  $9 = HEAP32[$8>>2]|0;
  $10 = $3;
  HEAP32[$vararg_buffer>>2] = $9;
  $vararg_ptr1 = ((($vararg_buffer)) + 4|0);
  HEAP32[$vararg_ptr1>>2] = 21523;
  $vararg_ptr2 = ((($vararg_buffer)) + 8|0);
  HEAP32[$vararg_ptr2>>2] = $10;
  $11 = (___syscall54(54,($vararg_buffer|0))|0);
  $12 = ($11|0)==(0);
  if (!($12)) {
   $13 = ((($0)) + 75|0);
   HEAP8[$13>>0] = -1;
  }
 }
 $14 = (___stdio_write($0,$1,$2)|0);
 STACKTOP = sp;return ($14|0);
}
function _strcmp($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$011 = 0, $$0710 = 0, $$lcssa = 0, $$lcssa8 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $2 = HEAP8[$0>>0]|0;
 $3 = HEAP8[$1>>0]|0;
 $4 = ($2<<24>>24)!=($3<<24>>24);
 $5 = ($2<<24>>24)==(0);
 $or$cond9 = $5 | $4;
 if ($or$cond9) {
  $$lcssa = $3;$$lcssa8 = $2;
 } else {
  $$011 = $1;$$0710 = $0;
  while(1) {
   $6 = ((($$0710)) + 1|0);
   $7 = ((($$011)) + 1|0);
   $8 = HEAP8[$6>>0]|0;
   $9 = HEAP8[$7>>0]|0;
   $10 = ($8<<24>>24)!=($9<<24>>24);
   $11 = ($8<<24>>24)==(0);
   $or$cond = $11 | $10;
   if ($or$cond) {
    $$lcssa = $9;$$lcssa8 = $8;
    break;
   } else {
    $$011 = $7;$$0710 = $6;
   }
  }
 }
 $12 = $$lcssa8&255;
 $13 = $$lcssa&255;
 $14 = (($12) - ($13))|0;
 return ($14|0);
}
function _strncmp($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$01824 = 0, $$01926 = 0, $$01926$in = 0, $$020 = 0, $$025 = 0, $$lcssa = 0, $$lcssa22 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond21 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($2|0)==(0);
 if ($3) {
  $$020 = 0;
 } else {
  $4 = HEAP8[$0>>0]|0;
  $5 = $4&255;
  $6 = ($4<<24>>24)==(0);
  $7 = HEAP8[$1>>0]|0;
  $8 = $7&255;
  L3: do {
   if ($6) {
    $$lcssa = $8;$$lcssa22 = $5;
   } else {
    $$01824 = $0;$$01926$in = $2;$$025 = $1;$12 = $4;$22 = $8;$23 = $5;$9 = $7;
    while(1) {
     $$01926 = (($$01926$in) + -1)|0;
     $10 = ($9<<24>>24)!=(0);
     $11 = ($$01926|0)!=(0);
     $or$cond = $11 & $10;
     $13 = ($12<<24>>24)==($9<<24>>24);
     $or$cond21 = $13 & $or$cond;
     if (!($or$cond21)) {
      $$lcssa = $22;$$lcssa22 = $23;
      break L3;
     }
     $14 = ((($$01824)) + 1|0);
     $15 = ((($$025)) + 1|0);
     $16 = HEAP8[$14>>0]|0;
     $17 = $16&255;
     $18 = ($16<<24>>24)==(0);
     $19 = HEAP8[$15>>0]|0;
     $20 = $19&255;
     if ($18) {
      $$lcssa = $20;$$lcssa22 = $17;
      break;
     } else {
      $$01824 = $14;$$01926$in = $$01926;$$025 = $15;$12 = $16;$22 = $20;$23 = $17;$9 = $19;
     }
    }
   }
  } while(0);
  $21 = (($$lcssa22) - ($$lcssa))|0;
  $$020 = $21;
 }
 return ($$020|0);
}
function ___lockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return 0;
}
function ___unlockfile($0) {
 $0 = $0|0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 return;
}
function _isblank($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(32);
 $2 = ($0|0)==(9);
 $3 = $1 | $2;
 $4 = $3&1;
 return ($4|0);
}
function _iswalnum($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_iswdigit($0)|0);
 $2 = ($1|0)==(0);
 if ($2) {
  $3 = (_iswalpha($0)|0);
  $4 = ($3|0)!=(0);
  $6 = $4;
 } else {
  $6 = 1;
 }
 $5 = $6&1;
 return ($5|0);
}
function _iswdigit($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (($0) + -48)|0;
 $2 = ($1>>>0)<(10);
 $3 = $2&1;
 return ($3|0);
}
function _iswalpha($0) {
 $0 = $0|0;
 var $$ = 0, $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)<(131072);
 if ($1) {
  $2 = $0 >>> 8;
  $3 = (1538 + ($2)|0);
  $4 = HEAP8[$3>>0]|0;
  $5 = $4&255;
  $6 = $5 << 5;
  $7 = $0 >>> 3;
  $8 = $7 & 31;
  $9 = $6 | $8;
  $10 = (1538 + ($9)|0);
  $11 = HEAP8[$10>>0]|0;
  $12 = $11&255;
  $13 = $0 & 7;
  $14 = $12 >>> $13;
  $15 = $14 & 1;
  $$0 = $15;
 } else {
  $16 = ($0>>>0)<(196606);
  $$ = $16&1;
  $$0 = $$;
 }
 return ($$0|0);
}
function _iswblank($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_isblank($0)|0);
 return ($1|0);
}
function _iswcntrl($0) {
 $0 = $0|0;
 var $$ = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $or$cond = 0, $or$cond6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)<(32);
 $2 = (($0) + -127)|0;
 $3 = ($2>>>0)<(33);
 $or$cond = $1 | $3;
 $4 = $0 & -2;
 $5 = ($4|0)==(8232);
 $or$cond6 = $5 | $or$cond;
 $6 = (($0) + -65529)|0;
 $7 = ($6>>>0)<(3);
 $$ = $7 | $or$cond6;
 $8 = $$&1;
 return ($8|0);
}
function _iswctype($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 do {
  switch ($1|0) {
  case 1:  {
   $2 = (_iswalnum($0)|0);
   $$0 = $2;
   break;
  }
  case 2:  {
   $3 = (_iswalpha($0)|0);
   $$0 = $3;
   break;
  }
  case 3:  {
   $4 = (_iswblank($0)|0);
   $$0 = $4;
   break;
  }
  case 4:  {
   $5 = (_iswcntrl($0)|0);
   $$0 = $5;
   break;
  }
  case 5:  {
   $6 = (_iswdigit($0)|0);
   $$0 = $6;
   break;
  }
  case 6:  {
   $7 = (_iswgraph($0)|0);
   $$0 = $7;
   break;
  }
  case 7:  {
   $8 = (_iswlower($0)|0);
   $$0 = $8;
   break;
  }
  case 8:  {
   $9 = (_iswprint($0)|0);
   $$0 = $9;
   break;
  }
  case 9:  {
   $10 = (_iswpunct($0)|0);
   $$0 = $10;
   break;
  }
  case 10:  {
   $11 = (_iswspace($0)|0);
   $$0 = $11;
   break;
  }
  case 11:  {
   $12 = (_iswupper($0)|0);
   $$0 = $12;
   break;
  }
  case 12:  {
   $13 = (_iswxdigit($0)|0);
   $$0 = $13;
   break;
  }
  default: {
   $$0 = 0;
  }
  }
 } while(0);
 return ($$0|0);
}
function _iswgraph($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_iswspace($0)|0);
 $2 = ($1|0)==(0);
 if ($2) {
  $3 = (_iswprint($0)|0);
  $4 = ($3|0)!=(0);
  $6 = $4;
 } else {
  $6 = 0;
 }
 $5 = $6&1;
 return ($5|0);
}
function _iswlower($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_towupper($0)|0);
 $2 = ($1|0)!=($0|0);
 $3 = $2&1;
 return ($3|0);
}
function _iswprint($0) {
 $0 = $0|0;
 var $$ = 0, $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $not$or$cond11 = 0, $notlhs = 0, $notrhs = 0, $or$cond = 0, $or$cond9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)<(255);
 if ($1) {
  $2 = (($0) + 1)|0;
  $3 = $2 & 127;
  $4 = ($3>>>0)>(32);
  $5 = $4&1;
  $$0 = $5;
 } else {
  $6 = ($0>>>0)<(8232);
  $7 = (($0) + -8234)|0;
  $8 = ($7>>>0)<(47062);
  $or$cond = $6 | $8;
  $9 = (($0) + -57344)|0;
  $10 = ($9>>>0)<(8185);
  $or$cond9 = $10 | $or$cond;
  if ($or$cond9) {
   $$0 = 1;
  } else {
   $11 = (($0) + -65532)|0;
   $12 = $0 & 65534;
   $notlhs = ($11>>>0)<(1048580);
   $notrhs = ($12|0)!=(65534);
   $not$or$cond11 = $notrhs & $notlhs;
   $$ = $not$or$cond11&1;
   return ($$|0);
  }
 }
 return ($$0|0);
}
function _iswpunct($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0>>>0)<(131072);
 if ($1) {
  $2 = $0 >>> 8;
  $3 = (4514 + ($2)|0);
  $4 = HEAP8[$3>>0]|0;
  $5 = $4&255;
  $6 = $5 << 5;
  $7 = $0 >>> 3;
  $8 = $7 & 31;
  $9 = $6 | $8;
  $10 = (4514 + ($9)|0);
  $11 = HEAP8[$10>>0]|0;
  $12 = $11&255;
  $13 = $0 & 7;
  $14 = $12 >>> $13;
  $15 = $14 & 1;
  $$0 = $15;
 } else {
  $$0 = 0;
 }
 return ($$0|0);
}
function _iswspace($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0);
 if ($1) {
  $5 = 0;
 } else {
  $2 = (_wcschr(588,$0)|0);
  $3 = ($2|0)!=(0|0);
  $5 = $3;
 }
 $4 = $5&1;
 return ($4|0);
}
function _iswupper($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (_towlower($0)|0);
 $2 = ($1|0)!=($0|0);
 $3 = $2&1;
 return ($3|0);
}
function _iswxdigit($0) {
 $0 = $0|0;
 var $$ = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (($0) + -48)|0;
 $2 = ($1>>>0)<(10);
 $3 = $0 | 32;
 $4 = (($3) + -97)|0;
 $5 = ($4>>>0)<(6);
 $$ = $2 | $5;
 $6 = $$&1;
 return ($6|0);
}
function _towlower($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (___towcase($0,1)|0);
 return ($1|0);
}
function ___towcase($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$06284 = 0, $$16383 = 0, $$2 = 0, $$neg75 = 0, $$neg77 = 0, $$neg78 = 0, $$not = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0;
 var $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0;
 var $58 = 0, $59 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond65 = 0, $or$cond67 = 0, $or$cond69 = 0, $or$cond71 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = $1 << 1;
 $3 = (($2) + -1)|0;
 $4 = (($1) + -1)|0;
 $5 = (_iswalpha($0)|0);
 $6 = ($5|0)==(0);
 $7 = (($0) + -1536)|0;
 $8 = ($7>>>0)<(2560);
 $or$cond65 = $8 | $6;
 $9 = (($0) + -11776)|0;
 $10 = ($9>>>0)<(30784);
 $or$cond67 = $10 | $or$cond65;
 $11 = (($0) + -43008)|0;
 $12 = ($11>>>0)<(22272);
 $or$cond69 = $12 | $or$cond67;
 L1: do {
  if ($or$cond69) {
   $$2 = $0;
  } else {
   $13 = ($1|0)!=(0);
   $14 = (($0) + -4256)|0;
   $15 = ($14>>>0)<(46);
   $or$cond71 = $13 & $15;
   if ($or$cond71) {
    $16 = ($0|0)>(4293);
    if ($16) {
     switch ($0|0) {
     case 4295: case 4301:  {
      break;
     }
     default: {
      $$2 = $0;
      break L1;
     }
     }
    }
    $17 = (($0) + 7264)|0;
    $$2 = $17;
    break;
   }
   $$not = $13 ^ 1;
   $18 = (($0) + -11520)|0;
   $19 = ($18>>>0)<(38);
   $or$cond = $19 & $$not;
   if ($or$cond) {
    $20 = (($0) + -7264)|0;
    $$2 = $20;
    break;
   } else {
    $$06284 = 0;
   }
   while(1) {
    $27 = (((1268 + ($$06284<<2)|0)) + 3|0);
    $28 = HEAP8[$27>>0]|0;
    $29 = (1268 + ($$06284<<2)|0);
    $30 = HEAP16[$29>>1]|0;
    $31 = $30&65535;
    $32 = (((1268 + ($$06284<<2)|0)) + 2|0);
    $33 = HEAP8[$32>>0]|0;
    $34 = $33 << 24 >> 24;
    $35 = $34 & $4;
    $$neg75 = (($0) - ($31))|0;
    $36 = (($$neg75) - ($35))|0;
    $37 = $28&255;
    $38 = ($36>>>0)<($37>>>0);
    $21 = (($$06284) + 1)|0;
    if ($38) {
     label = 11;
     break;
    }
    $22 = ($21|0)==(61);
    if ($22) {
     break;
    } else {
     $$06284 = $21;
    }
   }
   if ((label|0) == 11) {
    $39 = ($33<<24>>24)==(1);
    if ($39) {
     $40 = (($1) + ($0))|0;
     $41 = $$neg75 & 1;
     $42 = (($40) - ($41))|0;
     $$2 = $42;
     break;
    } else {
     $43 = Math_imul($34, $3)|0;
     $44 = (($43) + ($0))|0;
     $$2 = $44;
     break;
    }
   }
   $23 = (1 - ($1))|0;
   $24 = (780 + ($23<<1)|0);
   $25 = HEAP16[$24>>1]|0;
   $26 = ($25<<16>>16)==(0);
   L20: do {
    if (!($26)) {
     $$16383 = 0;$46 = $25;
     while(1) {
      $45 = $46&65535;
      $47 = ($45|0)==($0|0);
      if ($47) {
       break;
      }
      $51 = (($$16383) + 1)|0;
      $52 = ((780 + ($51<<2)|0) + ($23<<1)|0);
      $53 = HEAP16[$52>>1]|0;
      $54 = ($53<<16>>16)==(0);
      if ($54) {
       break L20;
      } else {
       $$16383 = $51;$46 = $53;
      }
     }
     $48 = ((780 + ($$16383<<2)|0) + ($1<<1)|0);
     $49 = HEAP16[$48>>1]|0;
     $50 = $49&65535;
     $$2 = $50;
     break L1;
    }
   } while(0);
   $$neg77 = ($1*40)|0;
   $$neg78 = (($0) + -66600)|0;
   $55 = (($$neg78) + ($$neg77))|0;
   $56 = ($55>>>0)<(40);
   $57 = (($0) + -40)|0;
   $58 = ($1*80)|0;
   $59 = (($57) + ($58))|0;
   $$ = $56 ? $59 : $0;
   return ($$|0);
  }
 } while(0);
 return ($$2|0);
}
function _wcschr($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$09 = 0, $$not = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1|0)==(0);
 if ($2) {
  $3 = (_wcslen($0)|0);
  $4 = (($0) + ($3<<2)|0);
  $$0 = $4;
 } else {
  $$09 = $0;
  while(1) {
   $5 = HEAP32[$$09>>2]|0;
   $6 = ($5|0)!=(0);
   $$not = $6 ^ 1;
   $7 = ($5|0)==($1|0);
   $or$cond = $7 | $$not;
   $8 = ((($$09)) + 4|0);
   if ($or$cond) {
    break;
   } else {
    $$09 = $8;
   }
  }
  $9 = $6 ? $$09 : 0;
  $$0 = $9;
 }
 return ($$0|0);
}
function _wcslen($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$0 = $0;
 while(1) {
  $1 = HEAP32[$$0>>2]|0;
  $2 = ($1|0)==(0);
  $3 = ((($$0)) + 4|0);
  if ($2) {
   break;
  } else {
   $$0 = $3;
  }
 }
 $4 = $$0;
 $5 = $0;
 $6 = (($4) - ($5))|0;
 $7 = $6 >> 2;
 return ($7|0);
}
function _towupper($0) {
 $0 = $0|0;
 var $1 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (___towcase($0,0)|0);
 return ($1|0);
}
function _wctype($0) {
 $0 = $0|0;
 var $$01113 = 0, $$012 = 0, $$014 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $$01113 = 1;$$014 = 7682;$3 = 97;
 while(1) {
  $2 = ($1<<24>>24)==($3<<24>>24);
  if ($2) {
   $4 = (_strcmp($0,$$014)|0);
   $5 = ($4|0)==(0);
   if ($5) {
    $$012 = $$01113;
    break;
   }
  }
  $6 = (($$01113) + 1)|0;
  $7 = ((($$014)) + 6|0);
  $8 = HEAP8[$7>>0]|0;
  $9 = ($8<<24>>24)==(0);
  if ($9) {
   $$012 = 0;
   break;
  } else {
   $$01113 = $6;$$014 = $7;$3 = $8;
  }
 }
 return ($$012|0);
}
function _qsort($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $$067$lcssa = 0, $$06772 = 0, $$068$lcssa = 0, $$06871 = 0, $$1 = 0, $$169 = 0, $$2 = 0, $$pre$pre = 0, $$pre76 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $15$phi = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0;
 var $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0;
 var $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 208|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(208|0);
 $4 = sp + 8|0;
 $5 = sp;
 $6 = Math_imul($2, $1)|0;
 $7 = $5;
 $8 = $7;
 HEAP32[$8>>2] = 1;
 $9 = (($7) + 4)|0;
 $10 = $9;
 HEAP32[$10>>2] = 0;
 $11 = ($6|0)==(0);
 L1: do {
  if (!($11)) {
   $12 = (0 - ($2))|0;
   $13 = ((($4)) + 4|0);
   HEAP32[$13>>2] = $2;
   HEAP32[$4>>2] = $2;
   $$0 = 2;$15 = $2;$17 = $2;
   while(1) {
    $14 = (($15) + ($2))|0;
    $16 = (($14) + ($17))|0;
    $18 = (($4) + ($$0<<2)|0);
    HEAP32[$18>>2] = $16;
    $19 = ($16>>>0)<($6>>>0);
    $20 = (($$0) + 1)|0;
    if ($19) {
     $15$phi = $17;$$0 = $20;$17 = $16;$15 = $15$phi;
    } else {
     break;
    }
   }
   $21 = (($0) + ($6)|0);
   $22 = (($21) + ($12)|0);
   $23 = ($22>>>0)>($0>>>0);
   if ($23) {
    $24 = $22;
    $$06772 = 1;$$06871 = $0;$26 = 1;
    while(1) {
     $25 = $26 & 3;
     $27 = ($25|0)==(3);
     do {
      if ($27) {
       _sift($$06871,$2,$3,$$06772,$4);
       _shr($5,2);
       $28 = (($$06772) + 2)|0;
       $$1 = $28;
      } else {
       $29 = (($$06772) + -1)|0;
       $30 = (($4) + ($29<<2)|0);
       $31 = HEAP32[$30>>2]|0;
       $32 = $$06871;
       $33 = (($24) - ($32))|0;
       $34 = ($31>>>0)<($33>>>0);
       if ($34) {
        _sift($$06871,$2,$3,$$06772,$4);
       } else {
        _trinkle($$06871,$2,$3,$5,$$06772,0,$4);
       }
       $35 = ($$06772|0)==(1);
       if ($35) {
        _shl($5,1);
        $$1 = 0;
        break;
       } else {
        _shl($5,$29);
        $$1 = 1;
        break;
       }
      }
     } while(0);
     $36 = HEAP32[$5>>2]|0;
     $37 = $36 | 1;
     HEAP32[$5>>2] = $37;
     $38 = (($$06871) + ($2)|0);
     $39 = ($38>>>0)<($22>>>0);
     if ($39) {
      $$06772 = $$1;$$06871 = $38;$26 = $37;
     } else {
      $$067$lcssa = $$1;$$068$lcssa = $38;$61 = $37;
      break;
     }
    }
   } else {
    $$067$lcssa = 1;$$068$lcssa = $0;$61 = 1;
   }
   _trinkle($$068$lcssa,$2,$3,$5,$$067$lcssa,0,$4);
   $40 = ((($5)) + 4|0);
   $$169 = $$068$lcssa;$$2 = $$067$lcssa;$42 = $61;
   while(1) {
    $41 = ($$2|0)==(1);
    $43 = ($42|0)==(1);
    $or$cond = $41 & $43;
    if ($or$cond) {
     $44 = HEAP32[$40>>2]|0;
     $45 = ($44|0)==(0);
     if ($45) {
      break L1;
     }
    } else {
     $46 = ($$2|0)<(2);
     if (!($46)) {
      _shl($5,2);
      $49 = (($$2) + -2)|0;
      $50 = HEAP32[$5>>2]|0;
      $51 = $50 ^ 7;
      HEAP32[$5>>2] = $51;
      _shr($5,1);
      $52 = (($4) + ($49<<2)|0);
      $53 = HEAP32[$52>>2]|0;
      $54 = (0 - ($53))|0;
      $55 = (($$169) + ($54)|0);
      $56 = (($55) + ($12)|0);
      $57 = (($$2) + -1)|0;
      _trinkle($56,$2,$3,$5,$57,1,$4);
      _shl($5,1);
      $58 = HEAP32[$5>>2]|0;
      $59 = $58 | 1;
      HEAP32[$5>>2] = $59;
      $60 = (($$169) + ($12)|0);
      _trinkle($60,$2,$3,$5,$49,1,$4);
      $$169 = $60;$$2 = $49;$42 = $59;
      continue;
     }
    }
    $47 = (_pntz($5)|0);
    _shr($5,$47);
    $48 = (($47) + ($$2))|0;
    $$pre$pre = HEAP32[$5>>2]|0;
    $$pre76 = (($$169) + ($12)|0);
    $$169 = $$pre76;$$2 = $48;$42 = $$pre$pre;
   }
  }
 } while(0);
 STACKTOP = sp;return;
}
function _sift($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0$lcssa = 0, $$029$be = 0, $$02932 = 0, $$030$be = 0, $$03031 = 0, $$033 = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 240|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(240|0);
 $5 = sp;
 HEAP32[$5>>2] = $0;
 $6 = ($3|0)>(1);
 L1: do {
  if ($6) {
   $7 = (0 - ($1))|0;
   $$02932 = $0;$$03031 = $3;$$033 = 1;$14 = $0;
   while(1) {
    $8 = (($$02932) + ($7)|0);
    $9 = (($$03031) + -2)|0;
    $10 = (($4) + ($9<<2)|0);
    $11 = HEAP32[$10>>2]|0;
    $12 = (0 - ($11))|0;
    $13 = (($8) + ($12)|0);
    $15 = (FUNCTION_TABLE_iii[$2 & 7]($14,$13)|0);
    $16 = ($15|0)>(-1);
    if ($16) {
     $17 = (FUNCTION_TABLE_iii[$2 & 7]($14,$8)|0);
     $18 = ($17|0)>(-1);
     if ($18) {
      $$0$lcssa = $$033;
      break L1;
     }
    }
    $19 = (FUNCTION_TABLE_iii[$2 & 7]($13,$8)|0);
    $20 = ($19|0)>(-1);
    $21 = (($$033) + 1)|0;
    $22 = (($5) + ($$033<<2)|0);
    if ($20) {
     HEAP32[$22>>2] = $13;
     $23 = (($$03031) + -1)|0;
     $$029$be = $13;$$030$be = $23;
    } else {
     HEAP32[$22>>2] = $8;
     $$029$be = $8;$$030$be = $9;
    }
    $24 = ($$030$be|0)>(1);
    if (!($24)) {
     $$0$lcssa = $21;
     break L1;
    }
    $$pre = HEAP32[$5>>2]|0;
    $$02932 = $$029$be;$$03031 = $$030$be;$$033 = $21;$14 = $$pre;
   }
  } else {
   $$0$lcssa = 1;
  }
 } while(0);
 _cycle($1,$5,$$0$lcssa);
 STACKTOP = sp;return;
}
function _shr($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$pre = 0, $$pre11 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1>>>0)>(31);
 $3 = ((($0)) + 4|0);
 if ($2) {
  $4 = (($1) + -32)|0;
  $5 = HEAP32[$3>>2]|0;
  HEAP32[$0>>2] = $5;
  HEAP32[$3>>2] = 0;
  $$0 = $4;$10 = 0;$7 = $5;
 } else {
  $$pre = HEAP32[$0>>2]|0;
  $$pre11 = HEAP32[$3>>2]|0;
  $$0 = $1;$10 = $$pre11;$7 = $$pre;
 }
 $6 = $7 >>> $$0;
 $8 = (32 - ($$0))|0;
 $9 = $10 << $8;
 $11 = $9 | $6;
 HEAP32[$0>>2] = $11;
 $12 = $10 >>> $$0;
 HEAP32[$3>>2] = $12;
 return;
}
function _trinkle($0,$1,$2,$3,$4,$5,$6) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 var $$0$lcssa = 0, $$045$lcssa = 0, $$04551 = 0, $$0455780 = 0, $$046$lcssa = 0, $$04653 = 0, $$0465681 = 0, $$047$lcssa = 0, $$0475582 = 0, $$049 = 0, $$05879 = 0, $$05879$phi = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0;
 var $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0;
 var $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $50 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $phitmp = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 240|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(240|0);
 $7 = sp + 232|0;
 $8 = sp;
 $9 = HEAP32[$3>>2]|0;
 HEAP32[$7>>2] = $9;
 $10 = ((($3)) + 4|0);
 $11 = HEAP32[$10>>2]|0;
 $12 = ((($7)) + 4|0);
 HEAP32[$12>>2] = $11;
 HEAP32[$8>>2] = $0;
 $13 = ($9|0)!=(1);
 $14 = ($11|0)!=(0);
 $15 = $13 | $14;
 L1: do {
  if ($15) {
   $16 = (0 - ($1))|0;
   $17 = (($6) + ($4<<2)|0);
   $18 = HEAP32[$17>>2]|0;
   $19 = (0 - ($18))|0;
   $20 = (($0) + ($19)|0);
   $21 = (FUNCTION_TABLE_iii[$2 & 7]($20,$0)|0);
   $22 = ($21|0)<(1);
   if ($22) {
    $$0$lcssa = $0;$$045$lcssa = 1;$$046$lcssa = $4;$$047$lcssa = $5;
    label = 9;
   } else {
    $phitmp = ($5|0)==(0);
    $$0455780 = 1;$$0465681 = $4;$$0475582 = $phitmp;$$05879 = $0;$28 = $20;
    while(1) {
     $23 = ($$0465681|0)>(1);
     $or$cond = $$0475582 & $23;
     if ($or$cond) {
      $24 = (($$05879) + ($16)|0);
      $25 = (($$0465681) + -2)|0;
      $26 = (($6) + ($25<<2)|0);
      $27 = HEAP32[$26>>2]|0;
      $29 = (FUNCTION_TABLE_iii[$2 & 7]($24,$28)|0);
      $30 = ($29|0)>(-1);
      if ($30) {
       $$04551 = $$0455780;$$04653 = $$0465681;$$049 = $$05879;
       label = 10;
       break L1;
      }
      $31 = (0 - ($27))|0;
      $32 = (($24) + ($31)|0);
      $33 = (FUNCTION_TABLE_iii[$2 & 7]($32,$28)|0);
      $34 = ($33|0)>(-1);
      if ($34) {
       $$04551 = $$0455780;$$04653 = $$0465681;$$049 = $$05879;
       label = 10;
       break L1;
      }
     }
     $35 = (($$0455780) + 1)|0;
     $36 = (($8) + ($$0455780<<2)|0);
     HEAP32[$36>>2] = $28;
     $37 = (_pntz($7)|0);
     _shr($7,$37);
     $38 = (($37) + ($$0465681))|0;
     $39 = HEAP32[$7>>2]|0;
     $40 = ($39|0)!=(1);
     $41 = HEAP32[$12>>2]|0;
     $42 = ($41|0)!=(0);
     $43 = $40 | $42;
     if (!($43)) {
      $$04551 = $35;$$04653 = $38;$$049 = $28;
      label = 10;
      break L1;
     }
     $$pre = HEAP32[$8>>2]|0;
     $44 = (($6) + ($38<<2)|0);
     $45 = HEAP32[$44>>2]|0;
     $46 = (0 - ($45))|0;
     $47 = (($28) + ($46)|0);
     $48 = (FUNCTION_TABLE_iii[$2 & 7]($47,$$pre)|0);
     $49 = ($48|0)<(1);
     if ($49) {
      $$0$lcssa = $28;$$045$lcssa = $35;$$046$lcssa = $38;$$047$lcssa = 0;
      label = 9;
      break;
     } else {
      $$05879$phi = $28;$$0455780 = $35;$$0465681 = $38;$$0475582 = 1;$28 = $47;$$05879 = $$05879$phi;
     }
    }
   }
  } else {
   $$0$lcssa = $0;$$045$lcssa = 1;$$046$lcssa = $4;$$047$lcssa = $5;
   label = 9;
  }
 } while(0);
 if ((label|0) == 9) {
  $50 = ($$047$lcssa|0)==(0);
  if ($50) {
   $$04551 = $$045$lcssa;$$04653 = $$046$lcssa;$$049 = $$0$lcssa;
   label = 10;
  }
 }
 if ((label|0) == 10) {
  _cycle($1,$8,$$04551);
  _sift($$049,$1,$2,$$04653,$6);
 }
 STACKTOP = sp;return;
}
function _shl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$pre = 0, $$pre11 = 0, $10 = 0, $11 = 0, $12 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($1>>>0)>(31);
 $3 = ((($0)) + 4|0);
 if ($2) {
  $4 = (($1) + -32)|0;
  $5 = HEAP32[$0>>2]|0;
  HEAP32[$3>>2] = $5;
  HEAP32[$0>>2] = 0;
  $$0 = $4;$10 = 0;$7 = $5;
 } else {
  $$pre = HEAP32[$3>>2]|0;
  $$pre11 = HEAP32[$0>>2]|0;
  $$0 = $1;$10 = $$pre11;$7 = $$pre;
 }
 $6 = $7 << $$0;
 $8 = (32 - ($$0))|0;
 $9 = $10 >>> $8;
 $11 = $9 | $6;
 HEAP32[$3>>2] = $11;
 $12 = $10 << $$0;
 HEAP32[$0>>2] = $12;
 return;
}
function _pntz($0) {
 $0 = $0|0;
 var $$ = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = (($1) + -1)|0;
 $3 = (_a_ctz_l_737($2)|0);
 $4 = ($3|0)==(0);
 if ($4) {
  $5 = ((($0)) + 4|0);
  $6 = HEAP32[$5>>2]|0;
  $7 = (_a_ctz_l_737($6)|0);
  $8 = (($7) + 32)|0;
  $9 = ($7|0)==(0);
  $$ = $9 ? 0 : $8;
  return ($$|0);
 } else {
  return ($3|0);
 }
 return (0)|0;
}
function _a_ctz_l_737($0) {
 $0 = $0|0;
 var $$068 = 0, $$07 = 0, $$09 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0);
 if ($1) {
  $$07 = 32;
 } else {
  $2 = $0 & 1;
  $3 = ($2|0)==(0);
  if ($3) {
   $$068 = $0;$$09 = 0;
   while(1) {
    $4 = (($$09) + 1)|0;
    $5 = $$068 >>> 1;
    $6 = $5 & 1;
    $7 = ($6|0)==(0);
    if ($7) {
     $$068 = $5;$$09 = $4;
    } else {
     $$07 = $4;
     break;
    }
   }
  } else {
   $$07 = 0;
  }
 }
 return ($$07|0);
}
function _cycle($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$02527 = 0, $$026 = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0;
 var $exitcond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 256|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(256|0);
 $3 = sp;
 $4 = ($2|0)<(2);
 L1: do {
  if (!($4)) {
   $5 = (($1) + ($2<<2)|0);
   HEAP32[$5>>2] = $3;
   $6 = ($0|0)==(0);
   if (!($6)) {
    $$02527 = $0;$10 = $3;
    while(1) {
     $7 = ($$02527>>>0)<(256);
     $8 = $7 ? $$02527 : 256;
     $9 = HEAP32[$1>>2]|0;
     _memcpy(($10|0),($9|0),($8|0))|0;
     $$026 = 0;
     while(1) {
      $11 = (($1) + ($$026<<2)|0);
      $12 = HEAP32[$11>>2]|0;
      $13 = (($$026) + 1)|0;
      $14 = (($1) + ($13<<2)|0);
      $15 = HEAP32[$14>>2]|0;
      _memcpy(($12|0),($15|0),($8|0))|0;
      $16 = HEAP32[$11>>2]|0;
      $17 = (($16) + ($8)|0);
      HEAP32[$11>>2] = $17;
      $exitcond = ($13|0)==($2|0);
      if ($exitcond) {
       break;
      } else {
       $$026 = $13;
      }
     }
     $18 = (($$02527) - ($8))|0;
     $19 = ($18|0)==(0);
     if ($19) {
      break L1;
     }
     $$pre = HEAP32[$5>>2]|0;
     $$02527 = $18;$10 = $$pre;
    }
   }
  }
 } while(0);
 STACKTOP = sp;return;
}
function _mbtowc($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$ = 0, $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0;
 var $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0;
 var $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $not$ = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = sp;
 $4 = ($1|0)==(0|0);
 L1: do {
  if ($4) {
   $$0 = 0;
  } else {
   $5 = ($2|0)==(0);
   do {
    if (!($5)) {
     $6 = ($0|0)==(0|0);
     $$ = $6 ? $3 : $0;
     $7 = HEAP8[$1>>0]|0;
     $8 = ($7<<24>>24)>(-1);
     if ($8) {
      $9 = $7&255;
      HEAP32[$$>>2] = $9;
      $10 = ($7<<24>>24)!=(0);
      $11 = $10&1;
      $$0 = $11;
      break L1;
     }
     $12 = (___pthread_self_428()|0);
     $13 = ((($12)) + 188|0);
     $14 = HEAP32[$13>>2]|0;
     $15 = HEAP32[$14>>2]|0;
     $not$ = ($15|0)==(0|0);
     $16 = HEAP8[$1>>0]|0;
     if ($not$) {
      $17 = $16 << 24 >> 24;
      $18 = $17 & 57343;
      HEAP32[$$>>2] = $18;
      $$0 = 1;
      break L1;
     }
     $19 = $16&255;
     $20 = (($19) + -194)|0;
     $21 = ($20>>>0)>(50);
     if (!($21)) {
      $22 = ((($1)) + 1|0);
      $23 = (12 + ($20<<2)|0);
      $24 = HEAP32[$23>>2]|0;
      $25 = ($2>>>0)<(4);
      if ($25) {
       $26 = ($2*6)|0;
       $27 = (($26) + -6)|0;
       $28 = -2147483648 >>> $27;
       $29 = $24 & $28;
       $30 = ($29|0)==(0);
       if (!($30)) {
        break;
       }
      }
      $31 = HEAP8[$22>>0]|0;
      $32 = $31&255;
      $33 = $32 >>> 3;
      $34 = (($33) + -16)|0;
      $35 = $24 >> 26;
      $36 = (($33) + ($35))|0;
      $37 = $34 | $36;
      $38 = ($37>>>0)>(7);
      if (!($38)) {
       $39 = $24 << 6;
       $40 = (($32) + -128)|0;
       $41 = $40 | $39;
       $42 = ($41|0)<(0);
       if (!($42)) {
        HEAP32[$$>>2] = $41;
        $$0 = 2;
        break L1;
       }
       $43 = ((($1)) + 2|0);
       $44 = HEAP8[$43>>0]|0;
       $45 = $44&255;
       $46 = (($45) + -128)|0;
       $47 = ($46>>>0)>(63);
       if (!($47)) {
        $48 = $41 << 6;
        $49 = $46 | $48;
        $50 = ($49|0)<(0);
        if (!($50)) {
         HEAP32[$$>>2] = $49;
         $$0 = 3;
         break L1;
        }
        $51 = ((($1)) + 3|0);
        $52 = HEAP8[$51>>0]|0;
        $53 = $52&255;
        $54 = (($53) + -128)|0;
        $55 = ($54>>>0)>(63);
        if (!($55)) {
         $56 = $49 << 6;
         $57 = $54 | $56;
         HEAP32[$$>>2] = $57;
         $$0 = 4;
         break L1;
        }
       }
      }
     }
    }
   } while(0);
   $58 = (___errno_location()|0);
   HEAP32[$58>>2] = 84;
   $$0 = -1;
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function ___pthread_self_428() {
 var $0 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_pthread_self()|0);
 return ($0|0);
}
function ___ofl_lock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___lock((8404|0));
 return (8412|0);
}
function ___ofl_unlock() {
 var label = 0, sp = 0;
 sp = STACKTOP;
 ___unlock((8404|0));
 return;
}
function _fflush($0) {
 $0 = $0|0;
 var $$0 = 0, $$023 = 0, $$02325 = 0, $$02327 = 0, $$024$lcssa = 0, $$02426 = 0, $$1 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $phitmp = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $8 = HEAP32[146]|0;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $29 = 0;
   } else {
    $10 = HEAP32[146]|0;
    $11 = (_fflush($10)|0);
    $29 = $11;
   }
   $12 = (___ofl_lock()|0);
   $$02325 = HEAP32[$12>>2]|0;
   $13 = ($$02325|0)==(0|0);
   if ($13) {
    $$024$lcssa = $29;
   } else {
    $$02327 = $$02325;$$02426 = $29;
    while(1) {
     $14 = ((($$02327)) + 76|0);
     $15 = HEAP32[$14>>2]|0;
     $16 = ($15|0)>(-1);
     if ($16) {
      $17 = (___lockfile($$02327)|0);
      $25 = $17;
     } else {
      $25 = 0;
     }
     $18 = ((($$02327)) + 20|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = ((($$02327)) + 28|0);
     $21 = HEAP32[$20>>2]|0;
     $22 = ($19>>>0)>($21>>>0);
     if ($22) {
      $23 = (___fflush_unlocked($$02327)|0);
      $24 = $23 | $$02426;
      $$1 = $24;
     } else {
      $$1 = $$02426;
     }
     $26 = ($25|0)==(0);
     if (!($26)) {
      ___unlockfile($$02327);
     }
     $27 = ((($$02327)) + 56|0);
     $$023 = HEAP32[$27>>2]|0;
     $28 = ($$023|0)==(0|0);
     if ($28) {
      $$024$lcssa = $$1;
      break;
     } else {
      $$02327 = $$023;$$02426 = $$1;
     }
    }
   }
   ___ofl_unlock();
   $$0 = $$024$lcssa;
  } else {
   $2 = ((($0)) + 76|0);
   $3 = HEAP32[$2>>2]|0;
   $4 = ($3|0)>(-1);
   if (!($4)) {
    $5 = (___fflush_unlocked($0)|0);
    $$0 = $5;
    break;
   }
   $6 = (___lockfile($0)|0);
   $phitmp = ($6|0)==(0);
   $7 = (___fflush_unlocked($0)|0);
   if ($phitmp) {
    $$0 = $7;
   } else {
    ___unlockfile($0);
    $$0 = $7;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___fflush_unlocked($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 20|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 28|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2>>>0)>($4>>>0);
 if ($5) {
  $6 = ((($0)) + 36|0);
  $7 = HEAP32[$6>>2]|0;
  (FUNCTION_TABLE_iiii[$7 & 7]($0,0,0)|0);
  $8 = HEAP32[$1>>2]|0;
  $9 = ($8|0)==(0|0);
  if ($9) {
   $$0 = -1;
  } else {
   label = 3;
  }
 } else {
  label = 3;
 }
 if ((label|0) == 3) {
  $10 = ((($0)) + 4|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ((($0)) + 8|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($11>>>0)<($13>>>0);
  if ($14) {
   $15 = $11;
   $16 = $13;
   $17 = (($15) - ($16))|0;
   $18 = ((($0)) + 40|0);
   $19 = HEAP32[$18>>2]|0;
   (FUNCTION_TABLE_iiii[$19 & 7]($0,$17,1)|0);
  }
  $20 = ((($0)) + 16|0);
  HEAP32[$20>>2] = 0;
  HEAP32[$3>>2] = 0;
  HEAP32[$1>>2] = 0;
  HEAP32[$12>>2] = 0;
  HEAP32[$10>>2] = 0;
  $$0 = 0;
 }
 return ($$0|0);
}
function _regcomp($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$0188 = 0, $$0190 = 0, $$0192 = 0, $$0193 = 0, $$0195 = 0, $$0196$lcssa = 0, $$0196210 = 0, $$0201 = 0, $$1191 = 0, $$1194208 = 0, $$1198209 = 0, $$2199 = 0, $$3 = 0, $$3200$lcssa = 0, $$3200207 = 0, $$lobit = 0, $$lobit$not = 0, $10 = 0, $100 = 0;
 var $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0;
 var $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0;
 var $138 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0;
 var $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0;
 var $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0;
 var $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0;
 var $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 48|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(48|0);
 $3 = sp;
 $4 = (_tre_stack_new()|0);
 $5 = ($4|0)==(0|0);
 L1: do {
  if ($5) {
   $$0188 = 12;
  } else {
   $6 = (___tre_mem_new_impl(0,0)|0);
   $7 = ($6|0)==(0|0);
   if ($7) {
    _tre_stack_destroy($4);
    $$0188 = 12;
    break;
   }
   $8 = ((($3)) + 8|0);
   ;HEAP32[$8>>2]=0|0;HEAP32[$8+4>>2]=0|0;HEAP32[$8+8>>2]=0|0;HEAP32[$8+12>>2]=0|0;HEAP32[$8+16>>2]=0|0;
   HEAP32[$3>>2] = $6;
   $9 = ((($3)) + 4|0);
   HEAP32[$9>>2] = $4;
   $10 = ((($3)) + 16|0);
   HEAP32[$10>>2] = $1;
   $11 = ((($3)) + 32|0);
   HEAP32[$11>>2] = $2;
   $12 = ((($3)) + 28|0);
   HEAP32[$12>>2] = -1;
   $13 = (_tre_parse($3)|0);
   $14 = ($13|0)==(0);
   L6: do {
    if ($14) {
     $15 = ((($3)) + 20|0);
     $16 = HEAP32[$15>>2]|0;
     $17 = (($16) + -1)|0;
     HEAP32[$0>>2] = $17;
     $18 = ((($3)) + 8|0);
     $19 = HEAP32[$18>>2]|0;
     $20 = HEAP32[$12>>2]|0;
     $21 = ($20|0)<($16|0);
     if ($21) {
      $22 = (_calloc(1,68)|0);
      $23 = ($22|0)==(0|0);
      if ($23) {
       $$0192 = $22;$$0195 = 0;$$0201 = 0;$$3 = 12;$135 = 0;$137 = 0;
      } else {
       $$lobit = $20 >>> 31;
       $$lobit$not = $$lobit ^ 1;
       $24 = ((($22)) + 60|0);
       HEAP32[$24>>2] = $$lobit$not;
       $25 = ((($22)) + 28|0);
       HEAP32[$25>>2] = $16;
       $26 = ($$lobit$not|0)!=(0);
       $27 = $2 & 8;
       $28 = ($27|0)==(0);
       $or$cond = $28 | $26;
       if ($or$cond) {
        $29 = (_tre_add_tags(0,$4,$19,$22)|0);
        $30 = ($29|0)==(0);
        if (!($30)) {
         $$0192 = $22;$$0195 = 0;$$0201 = 0;$$3 = $29;$135 = 0;$137 = 0;
         break;
        }
        $31 = ((($22)) + 40|0);
        $32 = HEAP32[$31>>2]|0;
        $33 = ($32|0)>(0);
        if ($33) {
         $34 = $32 << 2;
         $35 = (($34) + 4)|0;
         $36 = (_malloc($35)|0);
         $37 = ($36|0)==(0|0);
         if ($37) {
          $$0192 = $22;$$0195 = 0;$$0201 = 0;$$3 = 12;$135 = 0;$137 = 0;
          break;
         }
         $38 = ((($22)) + 32|0);
         HEAP32[$38>>2] = $36;
         _memset(($36|0),-1,($35|0))|0;
         $$0190 = $36;
        } else {
         $$0190 = 0;
        }
        $39 = $32 << 1;
        $40 = $39 | 1;
        $41 = (_calloc($40,4)|0);
        $42 = ((($22)) + 36|0);
        HEAP32[$42>>2] = $41;
        $43 = ($41|0)==(0|0);
        if ($43) {
         $$0192 = $22;$$0195 = 0;$$0201 = 0;$$3 = 12;$135 = 0;$137 = 0;
         break;
        }
        $44 = HEAP32[$15>>2]|0;
        $45 = (_calloc($44,12)|0);
        $46 = ($45|0)==(0|0);
        if ($46) {
         $$0192 = $22;$$0195 = 0;$$0201 = 0;$$3 = 12;$135 = 0;$137 = 0;
         break;
        }
        $47 = ((($22)) + 16|0);
        HEAP32[$47>>2] = $45;
        $48 = (_tre_add_tags($6,$4,$19,$22)|0);
        $49 = ($48|0)==(0);
        if ($49) {
         $$1191 = $$0190;
        } else {
         $$0192 = $22;$$0195 = 0;$$0201 = 0;$$3 = $48;$135 = 0;$137 = 0;
         break;
        }
       } else {
        $$1191 = 0;
       }
       $50 = ((($3)) + 24|0);
       $51 = (_tre_expand_ast($6,$4,$19,$50,$$1191)|0);
       $52 = ($51|0)==(0);
       if ($52) {
        $53 = HEAP32[$50>>2]|0;
        $54 = (($53) + 1)|0;
        HEAP32[$50>>2] = $54;
        $55 = (_tre_ast_new_literal($6,0,0,$53)|0);
        $56 = ($55|0)==(0|0);
        if ($56) {
         $$0192 = $22;$$0195 = 0;$$0201 = 0;$$3 = 12;$135 = 0;$137 = 0;
        } else {
         $57 = (_tre_ast_new_catenation($6,$19,$55)|0);
         $58 = ($57|0)==(0|0);
         if ($58) {
          $$0192 = $22;$$0195 = 0;$$0201 = 0;$$3 = 12;$135 = 0;$137 = 0;
         } else {
          $59 = (_tre_compute_nfl($6,$4,$57)|0);
          $60 = ($59|0)==(0);
          if ($60) {
           $61 = HEAP32[$50>>2]|0;
           $62 = $61 << 2;
           $63 = (_malloc($62)|0);
           $64 = ($63|0)==(0|0);
           if ($64) {
            $$0192 = $22;$$0195 = $63;$$0201 = 0;$$3 = 12;$135 = 0;$137 = 0;
           } else {
            $65 = (_malloc($62)|0);
            $66 = ($65|0)==(0|0);
            if ($66) {
             $$0192 = $22;$$0195 = $63;$$0201 = $65;$$3 = 12;$135 = $63;$137 = 0;
            } else {
             $67 = ($61|0)>(0);
             if ($67) {
              $68 = $61 << 2;
              _memset(($63|0),0,($68|0))|0;
             }
             (_tre_ast_to_tnfa($57,0,$63,0)|0);
             $69 = HEAP32[$50>>2]|0;
             $70 = ($69|0)>(0);
             if ($70) {
              $$0196210 = 0;$$1198209 = 0;
              while(1) {
               $71 = (($65) + ($$1198209<<2)|0);
               HEAP32[$71>>2] = $$0196210;
               $72 = (($63) + ($$1198209<<2)|0);
               $73 = HEAP32[$72>>2]|0;
               $74 = (($$0196210) + 1)|0;
               $75 = (($74) + ($73))|0;
               HEAP32[$72>>2] = 0;
               $76 = (($$1198209) + 1)|0;
               $77 = ($76|0)<($69|0);
               if ($77) {
                $$0196210 = $75;$$1198209 = $76;
               } else {
                $$0196$lcssa = $75;
                break;
               }
              }
             } else {
              $$0196$lcssa = 0;
             }
             $78 = (($$0196$lcssa) + 1)|0;
             $79 = (_calloc($78,32)|0);
             $80 = ($79|0)==(0|0);
             if ($80) {
              $$0192 = $22;$$0195 = $63;$$0201 = $65;$$3 = 12;$135 = $63;$137 = $65;
             } else {
              HEAP32[$22>>2] = $79;
              $81 = ((($22)) + 4|0);
              HEAP32[$81>>2] = $$0196$lcssa;
              $82 = (_tre_ast_to_tnfa($57,$79,$63,$65)|0);
              $83 = ($82|0)==(0);
              if ($83) {
               $84 = ((($22)) + 20|0);
               HEAP32[$84>>2] = 0;
               $85 = ((($57)) + 24|0);
               $86 = HEAP32[$85>>2]|0;
               $$0193 = $86;$$2199 = 0;
               while(1) {
                $87 = HEAP32[$$0193>>2]|0;
                $88 = ($87|0)>(-1);
                $89 = (($$2199) + 1)|0;
                $90 = ((($$0193)) + 32|0);
                if ($88) {
                 $$0193 = $90;$$2199 = $89;
                } else {
                 break;
                }
               }
               $91 = (_calloc($89,32)|0);
               $92 = ($91|0)==(0|0);
               if ($92) {
                $$0192 = $22;$$0195 = $63;$$0201 = $65;$$3 = 12;$135 = $63;$137 = $65;
               } else {
                $93 = ((($22)) + 8|0);
                HEAP32[$93>>2] = $91;
                $94 = HEAP32[$85>>2]|0;
                $95 = HEAP32[$94>>2]|0;
                $96 = ($95|0)>(-1);
                if ($96) {
                 $$1194208 = $94;$$3200207 = 0;$98 = $95;
                 while(1) {
                  $97 = (($65) + ($98<<2)|0);
                  $99 = HEAP32[$97>>2]|0;
                  $100 = (($79) + ($99<<5)|0);
                  $101 = (((($91) + ($$3200207<<5)|0)) + 8|0);
                  HEAP32[$101>>2] = $100;
                  $102 = (((($91) + ($$3200207<<5)|0)) + 12|0);
                  HEAP32[$102>>2] = $98;
                  $103 = (((($91) + ($$3200207<<5)|0)) + 16|0);
                  HEAP32[$103>>2] = 0;
                  $104 = ((($$1194208)) + 12|0);
                  $105 = HEAP32[$104>>2]|0;
                  $106 = ($105|0)==(0|0);
                  if (!($106)) {
                   $$0 = 0;
                   while(1) {
                    $107 = (($105) + ($$0<<2)|0);
                    $108 = HEAP32[$107>>2]|0;
                    $109 = ($108|0)>(-1);
                    $110 = (($$0) + 1)|0;
                    if ($109) {
                     $$0 = $110;
                    } else {
                     break;
                    }
                   }
                   $111 = $110 << 2;
                   $112 = (_malloc($111)|0);
                   HEAP32[$103>>2] = $112;
                   $113 = ($112|0)==(0|0);
                   if ($113) {
                    $$0192 = $22;$$0195 = $63;$$0201 = $65;$$3 = 12;$135 = $63;$137 = $65;
                    break L6;
                   }
                   $114 = HEAP32[$104>>2]|0;
                   _memcpy(($112|0),($114|0),($111|0))|0;
                  }
                  $115 = ((($$1194208)) + 16|0);
                  $116 = HEAP32[$115>>2]|0;
                  $117 = (((($91) + ($$3200207<<5)|0)) + 20|0);
                  HEAP32[$117>>2] = $116;
                  $118 = (($$3200207) + 1)|0;
                  $119 = ((($$1194208)) + 32|0);
                  $120 = HEAP32[$119>>2]|0;
                  $121 = ($120|0)>(-1);
                  if ($121) {
                   $$1194208 = $119;$$3200207 = $118;$98 = $120;
                  } else {
                   $$3200$lcssa = $118;
                   break;
                  }
                 }
                } else {
                 $$3200$lcssa = 0;
                }
                $122 = (((($91) + ($$3200$lcssa<<5)|0)) + 8|0);
                HEAP32[$122>>2] = 0;
                HEAP32[$81>>2] = $$0196$lcssa;
                $123 = ((($57)) + 28|0);
                $124 = HEAP32[$123>>2]|0;
                $125 = HEAP32[$124>>2]|0;
                $126 = (($65) + ($125<<2)|0);
                $127 = HEAP32[$126>>2]|0;
                $128 = (($79) + ($127<<5)|0);
                $129 = ((($22)) + 12|0);
                HEAP32[$129>>2] = $128;
                $130 = HEAP32[$50>>2]|0;
                $131 = ((($22)) + 52|0);
                HEAP32[$131>>2] = $130;
                $132 = ((($22)) + 56|0);
                HEAP32[$132>>2] = $2;
                ___tre_mem_destroy($6);
                _tre_stack_destroy($4);
                _free($63);
                _free($65);
                $133 = ((($0)) + 4|0);
                HEAP32[$133>>2] = $22;
                $$0188 = 0;
                break L1;
               }
              } else {
               $$0192 = $22;$$0195 = $63;$$0201 = $65;$$3 = $82;$135 = $63;$137 = $65;
              }
             }
            }
           }
          } else {
           $$0192 = $22;$$0195 = 0;$$0201 = 0;$$3 = $59;$135 = 0;$137 = 0;
          }
         }
        }
       } else {
        $$0192 = $22;$$0195 = 0;$$0201 = 0;$$3 = $51;$135 = 0;$137 = 0;
       }
      }
     } else {
      $$0192 = 0;$$0195 = 0;$$0201 = 0;$$3 = 6;$135 = 0;$137 = 0;
     }
    } else {
     $$0192 = 0;$$0195 = 0;$$0201 = 0;$$3 = $13;$135 = 0;$137 = 0;
    }
   } while(0);
   ___tre_mem_destroy($6);
   _tre_stack_destroy($4);
   $134 = ($$0195|0)==(0|0);
   if (!($134)) {
    _free($135);
   }
   $136 = ($$0201|0)==(0|0);
   if (!($136)) {
    _free($137);
   }
   $138 = ((($0)) + 4|0);
   HEAP32[$138>>2] = $$0192;
   _regfree($0);
   $$0188 = $$3;
  }
 } while(0);
 STACKTOP = sp;return ($$0188|0);
}
function _tre_stack_new() {
 var $$0 = 0, $0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $0 = (_malloc(20)|0);
 $1 = ($0|0)==(0|0);
 do {
  if ($1) {
   $$0 = $0;
  } else {
   $2 = (_malloc(2048)|0);
   $3 = ((($0)) + 16|0);
   HEAP32[$3>>2] = $2;
   $4 = ($2|0)==(0|0);
   if ($4) {
    _free($0);
    $$0 = 0;
    break;
   } else {
    HEAP32[$0>>2] = 512;
    $5 = ((($0)) + 4|0);
    HEAP32[$5>>2] = 1024000;
    $6 = ((($0)) + 8|0);
    HEAP32[$6>>2] = 128;
    $7 = ((($0)) + 12|0);
    HEAP32[$7>>2] = 0;
    $$0 = $0;
    break;
   }
  }
 } while(0);
 return ($$0|0);
}
function ___tre_mem_new_impl($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0$in = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = ($0|0)==(0);
 if ($2) {
  $3 = (_calloc(1,24)|0);
  $$0$in = $3;
 } else {
  ;HEAP32[$1>>2]=0|0;HEAP32[$1+4>>2]=0|0;HEAP32[$1+8>>2]=0|0;HEAP32[$1+12>>2]=0|0;HEAP32[$1+16>>2]=0|0;HEAP32[$1+20>>2]=0|0;
  $$0$in = $1;
 }
 return ($$0$in|0);
}
function _tre_stack_destroy($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 16|0);
 $2 = HEAP32[$1>>2]|0;
 _free($2);
 _free($0);
 return;
}
function _tre_parse($0) {
 $0 = $0|0;
 var $$ = 0, $$$3153 = 0, $$$6 = 0, $$0143 = 0, $$0146 = 0, $$0146$ph = 0, $$0149$ph = 0, $$0150 = 0, $$0150$ph = 0, $$0156 = 0, $$1144 = 0, $$1147 = 0, $$1157 = 0, $$2152 = 0, $$3153 = 0, $$5 = 0, $$5155323 = 0, $$5155324 = 0, $$6$ph = 0, $$7 = 0;
 var $$not164 = 0, $$old = 0, $$old167 = 0, $$ph = 0, $$pr171 = 0, $$pre = 0, $$sink = 0, $$sink169 = 0, $1 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0;
 var $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0;
 var $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0;
 var $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0;
 var $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0;
 var $97 = 0, $98 = 0, $99 = 0, $or$cond = 0, $or$cond11 = 0, $or$cond166 = 0, $or$cond3 = 0, $or$cond7 = 0, $or$cond9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $1 = sp + 4|0;
 $2 = sp;
 $3 = ((($0)) + 32|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = $4 & 1;
 $6 = ((($0)) + 16|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($0)) + 4|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = (_tre_stack_push_int($9,0)|0);
 $11 = ($10|0)==(0);
 L1: do {
  if ($11) {
   $12 = ($5|0)!=(0);
   $13 = ((($0)) + 8|0);
   $14 = ((($0)) + 12|0);
   $$not164 = $12 ^ 1;
   $$0146$ph = 0;$$0149$ph = 1;$$0150$ph = $7;
   L3: while(1) {
    $$0143 = 0;$$0146 = $$0146$ph;$$0150 = $$0150$ph;$$0156 = 0;
    L5: while(1) {
     $15 = HEAP8[$$0150>>0]|0;
     if ($12) {
      $19 = ($15<<24>>24)==(40);
      if ($19) {
       break;
      }
      $30 = ($15<<24>>24)==(41);
      $31 = ($$0146|0)!=(0);
      $or$cond = $31 & $30;
      if ($or$cond) {
       label = 13;
      } else {
       label = 14;
      }
     } else {
      $16 = ($15<<24>>24)==(92);
      if ($16) {
       $17 = ((($$0150)) + 1|0);
       $18 = HEAP8[$17>>0]|0;
       switch ($18<<24>>24) {
       case 40:  {
        break L5;
        break;
       }
       case 41:  {
        label = 13;
        break;
       }
       default: {
        label = 14;
       }
       }
      } else {
       label = 14;
      }
     }
     if ((label|0) == 13) {
      label = 0;
      $32 = HEAP32[$0>>2]|0;
      $33 = (_tre_ast_new_literal($32,-1,-1,-1)|0);
      HEAP32[$13>>2] = $33;
      $34 = ($33|0)==(0|0);
      if ($34) {
       $$5 = 12;
       break L1;
      } else {
       $$1144 = $$0143;$$1147 = $$0146;$$1157 = $$0156;$$2152 = $$0150;
      }
     }
     else if ((label|0) == 14) {
      label = 0;
      $35 = (_parse_atom($0,$$0150)|0);
      $36 = ($35|0)==(0);
      if (!($36)) {
       $$5 = $35;
       break L1;
      }
      $37 = HEAP32[$14>>2]|0;
      $$1144 = $$0143;$$1147 = $$0146;$$1157 = $$0156;$$2152 = $37;
     }
     while(1) {
      $$3153 = $$2152;
      L18: while(1) {
       $38 = HEAP8[$$3153>>0]|0;
       switch ($38<<24>>24) {
       case 42: case 92:  {
        break;
       }
       default: {
        if (!($12)) {
         $$6$ph = $$3153;
         break L18;
        }
        switch ($38<<24>>24) {
        case 123: case 63: case 43:  {
         break;
        }
        default: {
         $$6$ph = $$3153;
         break L18;
        }
        }
       }
       }
       $39 = ($38<<24>>24)==(92);
       $or$cond3 = $12 & $39;
       if ($or$cond3) {
        $$6$ph = $$3153;
        break;
       }
       $40 = ((($$3153)) + 1|0);
       if ($39) {
        $41 = HEAP8[$40>>0]|0;
        switch ($41<<24>>24) {
        case 123: case 63: case 43:  {
         break;
        }
        default: {
         $$6$ph = $$3153;
         break L18;
        }
        }
       }
       $$$3153 = $39 ? $40 : $$3153;
       if (!($12)) {
        $42 = HEAP32[$6>>2]|0;
        $43 = ((($42)) + 1|0);
        $44 = ($$$3153|0)==($43|0);
        if ($44) {
         $45 = ((($$$3153)) + -1|0);
         $46 = HEAP8[$45>>0]|0;
         $47 = ($46<<24>>24)==(94);
         if ($47) {
          $$6$ph = $$$3153;
          break;
         }
        }
       }
       $48 = HEAP8[$$$3153>>0]|0;
       $49 = ($48<<24>>24)==(123);
       if ($49) {
        $50 = ((($$$3153)) + 1|0);
        $51 = (_parse_dup($50,$5,$1,$2)|0);
        $52 = ($51|0)==(0|0);
        if ($52) {
         label = 28;
         break L3;
        }
        $$pre = HEAP32[$2>>2]|0;
        $59 = ($$pre|0)==(0);
        $60 = HEAP32[$0>>2]|0;
        if ($59) {
         $61 = (_tre_ast_new_literal($60,-1,-1,-1)|0);
         $$5155323 = $51;$$sink = $61;
        } else {
         $$5155324 = $51;$64 = $60;$65 = $$pre;
         label = 36;
        }
       } else {
        HEAP32[$1>>2] = 0;
        HEAP32[$2>>2] = -1;
        $53 = HEAP8[$$$3153>>0]|0;
        $54 = ($53<<24>>24)==(43);
        if ($54) {
         HEAP32[$1>>2] = 1;
         $$pr171 = HEAP8[$$$3153>>0]|0;
         $55 = $$pr171;
        } else {
         $55 = $53;
        }
        $56 = ($55<<24>>24)==(63);
        if ($56) {
         HEAP32[$2>>2] = 1;
         $112 = 1;
        } else {
         $112 = -1;
        }
        $57 = ((($$$3153)) + 1|0);
        $58 = HEAP32[$0>>2]|0;
        $$5155324 = $57;$64 = $58;$65 = $112;
        label = 36;
       }
       if ((label|0) == 36) {
        label = 0;
        $62 = HEAP32[$13>>2]|0;
        $63 = HEAP32[$1>>2]|0;
        $66 = (_tre_ast_new_iter($64,$62,$63,$65,0)|0);
        $$5155323 = $$5155324;$$sink = $66;
       }
       HEAP32[$13>>2] = $$sink;
       $71 = ($$sink|0)==(0|0);
       if ($71) {
        $$5 = 12;
        break L1;
       } else {
        $$3153 = $$5155323;
       }
      }
      $67 = HEAP32[$0>>2]|0;
      $68 = HEAP32[$13>>2]|0;
      $69 = (_tre_ast_new_catenation($67,$$1144,$68)|0);
      $70 = HEAP8[$$6$ph>>0]|0;
      do {
       if ($12) {
        $72 = ($70<<24>>24)==(124);
        if ($72) {
         $$ph = 124;
        } else {
         $73 = ($70<<24>>24)==(41);
         $74 = ($$1147|0)!=(0);
         $or$cond7 = $74 & $73;
         if ($or$cond7) {
          $$ph = 41;
         } else {
          $80 = $70;
          label = 44;
          break;
         }
        }
        $86 = HEAP32[$0>>2]|0;
        $87 = (_tre_ast_new_union($86,$$1157,$69)|0);
        $114 = $87;$94 = $$ph;
        label = 50;
       } else {
        $$old = ($70<<24>>24)==(92);
        if ($$old) {
         $75 = ((($$6$ph)) + 1|0);
         $76 = HEAP8[$75>>0]|0;
         $77 = ($76<<24>>24)==(41);
         if ($77) {
          $78 = HEAP32[$0>>2]|0;
          $79 = (_tre_ast_new_union($78,$$1157,$69)|0);
          $113 = $79;
          label = 49;
         } else {
          $80 = 92;
          label = 44;
         }
        } else {
         $85 = $70;
         label = 46;
        }
       }
      } while(0);
      if ((label|0) == 44) {
       label = 0;
       $81 = ($80<<24>>24)==(92);
       $or$cond166 = $81 & $$not164;
       if ($or$cond166) {
        $82 = ((($$6$ph)) + 1|0);
        $83 = HEAP8[$82>>0]|0;
        $84 = ($83<<24>>24)==(124);
        if ($84) {
         label = 48;
        } else {
         $$0143 = $69;$$0146 = $$1147;$$0150 = $$6$ph;$$0156 = $$1157;
         continue L5;
        }
       } else {
        $85 = $80;
        label = 46;
       }
      }
      if ((label|0) == 46) {
       label = 0;
       $$old167 = ($85<<24>>24)==(0);
       if ($$old167) {
        label = 48;
       } else {
        $$0143 = $69;$$0146 = $$1147;$$0150 = $$6$ph;$$0156 = $$1157;
        continue L5;
       }
      }
      if ((label|0) == 48) {
       label = 0;
       $88 = HEAP32[$0>>2]|0;
       $89 = (_tre_ast_new_union($88,$$1157,$69)|0);
       $90 = ($70<<24>>24)==(92);
       if ($90) {
        $113 = $89;
        label = 49;
       } else {
        $114 = $89;$94 = $70;
        label = 50;
       }
      }
      if ((label|0) == 49) {
       label = 0;
       $91 = ((($$6$ph)) + 1|0);
       $92 = HEAP8[$91>>0]|0;
       $93 = ($92<<24>>24)==(124);
       if ($93) {
        $$sink169 = 2;$115 = $113;
        break;
       }
       $96 = ($$1147|0)==(0);
       if ($96) {
        $$5 = 8;
        break L1;
       }
       $97 = ((($$6$ph)) + 2|0);
       $$7 = $97;$102 = $113;$105 = 92;
      }
      else if ((label|0) == 50) {
       label = 0;
       $95 = ($94<<24>>24)==(124);
       if ($95) {
        $$sink169 = 1;$115 = $114;
        break;
       }
       $98 = ($94<<24>>24)==(41);
       $99 = ((($$6$ph)) + 1|0);
       $$$6 = $98 ? $99 : $$6$ph;
       $$7 = $$$6;$102 = $114;$105 = $94;
      }
      $100 = (($$1147) + -1)|0;
      $101 = (_tre_stack_pop_int($9)|0);
      $103 = (_marksub($0,$102,$101)|0);
      $104 = ($103|0)==(0);
      if (!($104)) {
       $$5 = $103;
       break L1;
      }
      $106 = ($105<<24>>24)==(0);
      $107 = ($$1147|0)<(1);
      $or$cond9 = $107 & $106;
      if ($or$cond9) {
       label = 56;
       break L3;
      }
      $or$cond11 = $107 | $106;
      if ($or$cond11) {
       $$5 = 8;
       break L1;
      }
      $110 = (_tre_stack_pop_voidptr($9)|0);
      $111 = (_tre_stack_pop_voidptr($9)|0);
      $$1144 = $110;$$1147 = $100;$$1157 = $111;$$2152 = $$7;
     }
     $109 = (($$6$ph) + ($$sink169)|0);
     $$0143 = 0;$$0146 = $$1147;$$0150 = $109;$$0156 = $115;
    }
    $20 = (_tre_stack_push_voidptr($9,$$0156)|0);
    $21 = ($20|0)==(0);
    if (!($21)) {
     $$5 = $20;
     break L1;
    }
    $22 = (_tre_stack_push_voidptr($9,$$0143)|0);
    $23 = ($22|0)==(0);
    if (!($23)) {
     $$5 = $22;
     break L1;
    }
    $24 = (_tre_stack_push_int($9,$$0149$ph)|0);
    $25 = ($24|0)==(0);
    if (!($25)) {
     $$5 = $24;
     break L1;
    }
    $26 = (($$0149$ph) + 1)|0;
    $27 = ((($$0150)) + 1|0);
    $28 = ((($$0150)) + 2|0);
    $$ = $12 ? $27 : $28;
    $29 = (($$0146) + 1)|0;
    $$0146$ph = $29;$$0149$ph = $26;$$0150$ph = $$;
   }
   if ((label|0) == 28) {
    $$5 = 10;
    break;
   }
   else if ((label|0) == 56) {
    $108 = ((($0)) + 20|0);
    HEAP32[$108>>2] = $$0149$ph;
    $$5 = 0;
    break;
   }
  } else {
   $$5 = $10;
  }
 } while(0);
 STACKTOP = sp;return ($$5|0);
}
function _tre_add_tags($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$$0486 = 0, $$$0501 = 0, $$0 = 0, $$0458 = 0, $$0459$be = 0, $$0459$lcssa = 0, $$0460$be = 0, $$0460$lcssa = 0, $$0460594 = 0, $$0462$be = 0, $$0462$lcssa = 0, $$0462591 = 0, $$0471$be = 0, $$0471$lcssa = 0, $$0471588 = 0, $$0486$be = 0, $$0486$lcssa = 0, $$0486585 = 0, $$0496 = 0, $$0497 = 0;
 var $$0498 = 0, $$0499 = 0, $$0500 = 0, $$0501$ = 0, $$0501$be = 0, $$0501582 = 0, $$0512$ = 0, $$0512$be = 0, $$0512$lcssa = 0, $$0512579 = 0, $$0527$ = 0, $$0527$be = 0, $$0527576 = 0, $$0531 = 0, $$0534 = 0, $$0535 = 0, $$0536 = 0, $$0538 = 0, $$0541 = 0, $$10481 = 0;
 var $$10511 = 0, $$10522 = 0, $$11 = 0, $$11482 = 0, $$11523 = 0, $$12 = 0, $$13484 = 0, $$13525 = 0, $$14 = 0, $$14485 = 0, $$14526 = 0, $$1461 = 0, $$1472 = 0, $$15 = 0, $$1513 = 0, $$1537 = 0, $$1539 = 0, $$16 = 0, $$2473 = 0, $$2514 = 0;
 var $$2529 = 0, $$2540574 = 0, $$3504 = 0, $$3530 = 0, $$4 = 0, $$543 = 0, $$5467 = 0, $$5476 = 0, $$5491 = 0, $$5517 = 0, $$6477 = 0, $$6492 = 0, $$6518 = 0, $$7469 = 0, $$7508 = 0, $$8 = 0, $$8494 = 0, $$8509 = 0, $$9480 = 0, $$9521 = 0;
 var $$lcssa560 = 0, $$lobit = 0, $$lobit$not = 0, $$pre = 0, $$pre$phi620Z2D = 0, $$sink2 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0;
 var $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0;
 var $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0;
 var $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0;
 var $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0;
 var $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0;
 var $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0;
 var $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0;
 var $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0;
 var $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0;
 var $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0;
 var $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0;
 var $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0;
 var $330 = 0, $331 = 0, $332 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0;
 var $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0;
 var $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $or$cond542 = 0, $or$cond6 = 0, $or$cond6575 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = (_tre_stack_num_objects($1)|0);
 $5 = ($0|0)==(0|0);
 $6 = ($3|0)==(0|0);
 $7 = $5 | $6;
 if (!($7)) {
  $8 = ((($3)) + 48|0);
  HEAP32[$8>>2] = 0;
  $9 = ((($3)) + 36|0);
  $10 = HEAP32[$9>>2]|0;
  HEAP32[$10>>2] = -1;
 }
 $11 = ((($3)) + 28|0);
 $12 = HEAP32[$11>>2]|0;
 $13 = $12 << 3;
 $14 = (($13) + 8)|0;
 $15 = (_malloc($14)|0);
 $16 = ($15|0)==(0|0);
 do {
  if ($16) {
   $$0458 = 12;
  } else {
   HEAP32[$15>>2] = -1;
   $17 = $12 << 2;
   $18 = (($17) + 4)|0;
   $19 = (_malloc($18)|0);
   $20 = ($19|0)==(0|0);
   if ($20) {
    _free($15);
    $$0458 = 12;
    break;
   }
   HEAP32[$19>>2] = -1;
   $$0535 = 0;
   while(1) {
    $21 = ($$0535>>>0)>($12>>>0);
    $22 = (($$0535) + 1)|0;
    if ($21) {
     break;
    } else {
     $$0535 = $22;
    }
   }
   (_tre_stack_push_voidptr($1,$2)|0);
   $23 = (_tre_stack_push_int($1,0)|0);
   $24 = (_tre_stack_num_objects($1)|0);
   $25 = ($24|0)<=($4|0);
   $26 = ($23|0)!=(0);
   $or$cond6575 = $26 | $25;
   L12: do {
    if ($or$cond6575) {
     $$0459$lcssa = $23;$$0460$lcssa = $15;$$0462$lcssa = 0;$$0471$lcssa = 0;$$0486$lcssa = 0;$$0512$lcssa = -1;
    } else {
     $27 = ((($3)) + 32|0);
     $28 = ((($3)) + 36|0);
     $29 = ((($3)) + 16|0);
     $$0460594 = $15;$$0462591 = 0;$$0471588 = 0;$$0486585 = 0;$$0501582 = 1;$$0512579 = -1;$$0527576 = 0;
     while(1) {
      $30 = (_tre_stack_pop_int($1)|0);
      L16: do {
       switch ($30|0) {
       case 6:  {
        $34 = (_tre_stack_pop_int($1)|0);
        $$0536 = 0;
        while(1) {
         $35 = (($$0460594) + ($$0536<<2)|0);
         $36 = HEAP32[$35>>2]|0;
         $37 = ($36|0)>(-1);
         $38 = (($$0536) + 1)|0;
         if ($37) {
          $$0536 = $38;
         } else {
          break;
         }
        }
        $39 = $34 << 1;
        $40 = $39 | 1;
        HEAP32[$35>>2] = $40;
        $41 = (($$0460594) + ($38<<2)|0);
        HEAP32[$41>>2] = -1;
        $$1537 = 0;
        while(1) {
         $42 = (($19) + ($$1537<<2)|0);
         $43 = HEAP32[$42>>2]|0;
         $44 = ($43|0)>(-1);
         $45 = (($$1537) + 1)|0;
         if ($44) {
          $$1537 = $45;
         } else {
          break;
         }
        }
        $46 = (($$1537) + -1)|0;
        $47 = (($19) + ($46<<2)|0);
        HEAP32[$47>>2] = -1;
        $$0459$be = 0;$$0460$be = $$0460594;$$0462$be = $$0462591;$$0471$be = $$0471588;$$0486$be = $$0486585;$$0501$be = $$0501582;$$0512$be = $$0512579;$$0527$be = $$0527576;
        break;
       }
       case 0:  {
        $48 = (_tre_stack_pop_voidptr($1)|0);
        $49 = ((($48)) + 12|0);
        $50 = HEAP32[$49>>2]|0;
        $51 = ($50|0)>(-1);
        if ($51) {
         $$0538 = 0;
         while(1) {
          $52 = (($$0460594) + ($$0538<<2)|0);
          $53 = HEAP32[$52>>2]|0;
          $54 = ($53|0)>(-1);
          $55 = (($$0538) + 1)|0;
          if ($54) {
           $$0538 = $55;
          } else {
           break;
          }
         }
         $56 = $50 << 1;
         HEAP32[$52>>2] = $56;
         $57 = (($$0460594) + ($55<<2)|0);
         HEAP32[$57>>2] = -1;
         if (!($7)) {
          $$1539 = 0;
          while(1) {
           $58 = (($19) + ($$1539<<2)|0);
           $59 = HEAP32[$58>>2]|0;
           $60 = ($59|0)>(-1);
           $61 = (($$1539) + 1)|0;
           if ($60) {
            $$1539 = $61;
           } else {
            break;
           }
          }
          $62 = HEAP32[$29>>2]|0;
          $63 = (((($62) + (($50*12)|0)|0)) + 8|0);
          HEAP32[$63>>2] = 0;
          $64 = ($$1539|0)>(0);
          if ($64) {
           $65 = $$1539 << 2;
           $66 = (($65) + 4)|0;
           $67 = (_malloc($66)|0);
           $68 = ($67|0)==(0|0);
           if ($68) {
            $$0459$be = 12;$$0460$be = $$0460594;$$0462$be = $$0462591;$$0471$be = $$0471588;$$0486$be = $$0486585;$$0501$be = $$0501582;$$0512$be = $$0512579;$$0527$be = $$0527576;
            break L16;
           }
           HEAP32[$63>>2] = $67;
           $69 = HEAP32[$19>>2]|0;
           $70 = ($69|0)>(-1);
           if ($70) {
            $$2540574 = 0;$71 = $69;$72 = $67;
            while(1) {
             HEAP32[$72>>2] = $71;
             $73 = (($$2540574) + 1)|0;
             $74 = (($19) + ($73<<2)|0);
             $75 = HEAP32[$74>>2]|0;
             $76 = ($75|0)>(-1);
             $77 = (($67) + ($73<<2)|0);
             if ($76) {
              $$2540574 = $73;$71 = $75;$72 = $77;
             } else {
              $$lcssa560 = $77;
              break;
             }
            }
           } else {
            $$lcssa560 = $67;
           }
           HEAP32[$$lcssa560>>2] = -1;
          }
         }
         $78 = HEAP32[$49>>2]|0;
         $79 = (_tre_stack_push_int($1,$78)|0);
         $80 = ($79|0)==(0);
         if (!($80)) {
          $$0459$be = $79;$$0460$be = $$0460594;$$0462$be = $$0462591;$$0471$be = $$0471588;$$0486$be = $$0486585;$$0501$be = $$0501582;$$0512$be = $$0512579;$$0527$be = $$0527576;
          break L16;
         }
         $81 = (_tre_stack_push_int($1,6)|0);
         $82 = ($81|0)==(0);
         if (!($82)) {
          $$0459$be = $81;$$0460$be = $$0460594;$$0462$be = $$0462591;$$0471$be = $$0471588;$$0486$be = $$0486585;$$0501$be = $$0501582;$$0512$be = $$0512579;$$0527$be = $$0527576;
          break L16;
         }
        }
        $83 = HEAP32[$48>>2]|0;
        L42: do {
         switch ($83|0) {
         case 0:  {
          $84 = ((($48)) + 4|0);
          $85 = HEAP32[$84>>2]|0;
          $86 = HEAP32[$85>>2]|0;
          $87 = ($86|0)>(-1);
          $88 = ($86|0)==(-4);
          $or$cond542 = $87 | $88;
          if ($or$cond542) {
           $89 = HEAP32[$$0460594>>2]|0;
           $90 = ($89|0)>(-1);
           if ($90) {
            if ($7) {
             $104 = ((($48)) + 20|0);
             HEAP32[$104>>2] = 1;
             $$2473 = $$0471588;$$2514 = $$0512579;$$4 = 0;
            } else {
             $91 = (_tre_add_tag_left($0,$48,$$0486585)|0);
             $92 = HEAP32[$27>>2]|0;
             $93 = (($92) + ($$0486585<<2)|0);
             HEAP32[$93>>2] = $$0527576;
             $94 = ($$0512579|0)>(-1);
             if ($94) {
              $95 = HEAP32[$28>>2]|0;
              $$0541 = 0;
              while(1) {
               $96 = (($95) + ($$0541<<2)|0);
               $97 = HEAP32[$96>>2]|0;
               $98 = ($97|0)>(-1);
               $99 = (($$0541) + 1)|0;
               if ($98) {
                $$0541 = $99;
               } else {
                break;
               }
              }
              HEAP32[$96>>2] = $$0486585;
              $100 = (($95) + ($99<<2)|0);
              HEAP32[$100>>2] = $$0512579;
              $101 = (($$0541) + 2)|0;
              $102 = (($95) + ($101<<2)|0);
              HEAP32[$102>>2] = -1;
              $103 = (($$0471588) + 1)|0;
              $$1472 = $103;$$1513 = -1;
             } else {
              $$1472 = $$0471588;$$1513 = $$0512579;
             }
             _tre_purge_regset($$0460594,$3,$$0486585);
             $$2473 = $$1472;$$2514 = $$1513;$$4 = $91;
            }
            HEAP32[$$0460594>>2] = -1;
            $105 = (($$0462591) + 1)|0;
            $106 = (($$0501582) + 1)|0;
            $$10511 = $106;$$13484 = $$2473;$$13525 = $$2514;$$14 = $$4;$$2529 = $$0527576;$$7469 = $105;$$8494 = $$0501582;
           } else {
            $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = 0;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
           }
          } else {
           $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = 0;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
          }
          break;
         }
         case 1:  {
          $107 = ((($48)) + 4|0);
          $108 = HEAP32[$107>>2]|0;
          $109 = HEAP32[$108>>2]|0;
          $110 = ((($108)) + 4|0);
          $111 = HEAP32[$110>>2]|0;
          $112 = (_tre_stack_push_voidptr($1,$48)|0);
          $113 = ($112|0)==(0);
          if ($113) {
           $114 = (_tre_stack_push_int($1,5)|0);
           $115 = ($114|0)==(0);
           if ($115) {
            $116 = (_tre_stack_push_voidptr($1,$111)|0);
            $117 = ($116|0)==(0);
            if ($117) {
             $118 = (_tre_stack_push_int($1,0)|0);
             $119 = ($118|0)==(0);
             if ($119) {
              $120 = ((($109)) + 20|0);
              $121 = HEAP32[$120>>2]|0;
              $122 = (($121) + ($$0501582))|0;
              $123 = (_tre_stack_push_int($1,$122)|0);
              $124 = ($123|0)==(0);
              if ($124) {
               $125 = HEAP32[$120>>2]|0;
               $126 = ($125|0)>(0);
               if ($126) {
                $127 = ((($111)) + 20|0);
                $128 = HEAP32[$127>>2]|0;
                $129 = ($128|0)>(0);
                $$0501$ = $129 ? $$0501582 : -1;
                $130 = $129&1;
                $$$0501 = (($130) + ($$0501582))|0;
                $$0534 = $$0501$;$$3504 = $$$0501;
               } else {
                $$0534 = -1;$$3504 = $$0501582;
               }
               $131 = (_tre_stack_push_int($1,$$0534)|0);
               $132 = ($131|0)==(0);
               if ($132) {
                $133 = (_tre_stack_push_int($1,4)|0);
                $134 = ($133|0)==(0);
                if ($134) {
                 $135 = (_tre_stack_push_voidptr($1,$109)|0);
                 $136 = ($135|0)==(0);
                 if ($136) {
                  $137 = (_tre_stack_push_int($1,0)|0);
                  $$10511 = $$3504;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $137;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
                 } else {
                  $$10511 = $$3504;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $135;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
                 }
                } else {
                 $$10511 = $$3504;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $133;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
                }
               } else {
                $$10511 = $$3504;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $131;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
               }
              } else {
               $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $123;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
              }
             } else {
              $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $118;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
             }
            } else {
             $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $116;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
            }
           } else {
            $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $114;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
           }
          } else {
           $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $112;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
          }
          break;
         }
         case 2:  {
          $138 = ((($48)) + 4|0);
          $139 = HEAP32[$138>>2]|0;
          if ($7) {
           $140 = HEAP32[$$0460594>>2]|0;
           $141 = ($140|0)>(-1);
           if ($141) {
            $147 = 1;
           } else {
            $142 = ((($139)) + 12|0);
            $143 = HEAP8[$142>>0]|0;
            $144 = $143 & 1;
            $145 = ($144<<24>>24)!=(0);
            $147 = $145;
           }
           $146 = $147&1;
           $148 = (_tre_stack_push_int($1,$146)|0);
           $149 = ($148|0)==(0);
           if (!($149)) {
            $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $148;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
            break L42;
           }
          } else {
           $150 = (_tre_stack_push_int($1,$$0486585)|0);
           $151 = ($150|0)==(0);
           if (!($151)) {
            $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $150;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
            break L42;
           }
           $152 = ((($139)) + 12|0);
           $153 = HEAP8[$152>>0]|0;
           $154 = $153 & 1;
           $155 = $154&255;
           $156 = (_tre_stack_push_int($1,$155)|0);
           $157 = ($156|0)==(0);
           if (!($157)) {
            $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $156;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
            break L42;
           }
          }
          $158 = (_tre_stack_push_voidptr($1,$48)|0);
          $159 = ($158|0)==(0);
          if ($159) {
           $160 = (_tre_stack_push_int($1,1)|0);
           $161 = ($160|0)==(0);
           if ($161) {
            $162 = HEAP32[$139>>2]|0;
            $163 = (_tre_stack_push_voidptr($1,$162)|0);
            $164 = ($163|0)==(0);
            if ($164) {
             $165 = (_tre_stack_push_int($1,0)|0);
             $166 = ($165|0)==(0);
             if ($166) {
              $167 = HEAP32[$$0460594>>2]|0;
              $168 = ($167|0)>(-1);
              if (!($168)) {
               $169 = ((($139)) + 12|0);
               $170 = HEAP8[$169>>0]|0;
               $171 = $170 & 1;
               $172 = ($171<<24>>24)==(0);
               if ($172) {
                $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = 0;$$2529 = 0;$$7469 = $$0462591;$$8494 = $$0486585;
                break L42;
               }
              }
              if ($7) {
               $$6477 = $$0471588;$$6518 = $$0512579;$$8 = 0;
              } else {
               $173 = (_tre_add_tag_left($0,$48,$$0486585)|0);
               $174 = ((($139)) + 12|0);
               $175 = HEAP8[$174>>0]|0;
               $176 = $175 & 1;
               $177 = ($176<<24>>24)==(0);
               $178 = HEAP32[$27>>2]|0;
               $$0527$ = $177 ? $$0527576 : 1;
               $$sink2 = (($178) + ($$0486585<<2)|0);
               HEAP32[$$sink2>>2] = $$0527$;
               $179 = ($$0512579|0)>(-1);
               if ($179) {
                $180 = HEAP32[$28>>2]|0;
                $$0531 = 0;
                while(1) {
                 $181 = (($180) + ($$0531<<2)|0);
                 $182 = HEAP32[$181>>2]|0;
                 $183 = ($182|0)>(-1);
                 $184 = (($$0531) + 1)|0;
                 if ($183) {
                  $$0531 = $184;
                 } else {
                  break;
                 }
                }
                HEAP32[$181>>2] = $$0486585;
                $185 = (($180) + ($184<<2)|0);
                HEAP32[$185>>2] = $$0512579;
                $186 = (($$0531) + 2)|0;
                $187 = (($180) + ($186<<2)|0);
                HEAP32[$187>>2] = -1;
                $188 = (($$0471588) + 1)|0;
                $$5476 = $188;$$5517 = -1;
               } else {
                $$5476 = $$0471588;$$5517 = $$0512579;
               }
               _tre_purge_regset($$0460594,$3,$$0486585);
               $$6477 = $$5476;$$6518 = $$5517;$$8 = $173;
              }
              HEAP32[$$0460594>>2] = -1;
              $189 = (($$0462591) + 1)|0;
              $190 = (($$0501582) + 1)|0;
              $$10511 = $190;$$13484 = $$6477;$$13525 = $$6518;$$14 = $$8;$$2529 = 0;$$7469 = $189;$$8494 = $$0501582;
             } else {
              $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $165;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
             }
            } else {
             $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $163;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
            }
           } else {
            $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $160;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
           }
          } else {
           $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $158;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
          }
          break;
         }
         case 3:  {
          $191 = ((($48)) + 4|0);
          $192 = HEAP32[$191>>2]|0;
          $193 = HEAP32[$192>>2]|0;
          $194 = ((($192)) + 4|0);
          $195 = HEAP32[$194>>2]|0;
          $196 = HEAP32[$$0460594>>2]|0;
          $197 = ($196|0)>(-1);
          $198 = (($$0501582) + 1)|0;
          $$0499 = $197 ? $198 : $$0501582;
          $199 = (_tre_stack_push_int($1,$$0499)|0);
          $200 = ($199|0)==(0);
          if ($200) {
           $$0500 = $197 ? $$0501582 : $$0486585;
           $201 = (_tre_stack_push_int($1,$$0500)|0);
           $202 = ($201|0)==(0);
           if ($202) {
            $203 = (_tre_stack_push_voidptr($1,$$0460594)|0);
            $204 = ($203|0)==(0);
            if ($204) {
             $205 = HEAP32[$$0460594>>2]|0;
             $$lobit = $205 >>> 31;
             $$lobit$not = $$lobit ^ 1;
             $206 = (_tre_stack_push_int($1,$$lobit$not)|0);
             $207 = ($206|0)==(0);
             if ($207) {
              $208 = (_tre_stack_push_voidptr($1,$48)|0);
              $209 = ($208|0)==(0);
              if ($209) {
               $210 = (_tre_stack_push_voidptr($1,$195)|0);
               $211 = ($210|0)==(0);
               if ($211) {
                $212 = (_tre_stack_push_voidptr($1,$193)|0);
                $213 = ($212|0)==(0);
                if ($213) {
                 $214 = (_tre_stack_push_int($1,3)|0);
                 $215 = ($214|0)==(0);
                 if ($215) {
                  $216 = (_tre_stack_push_voidptr($1,$195)|0);
                  $217 = ($216|0)==(0);
                  if ($217) {
                   $218 = (_tre_stack_push_int($1,0)|0);
                   $219 = ($218|0)==(0);
                   if ($219) {
                    $220 = (_tre_stack_push_int($1,2)|0);
                    $221 = ($220|0)==(0);
                    if (!($221)) {
                     $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $220;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
                     break L42;
                    }
                    $222 = (_tre_stack_push_voidptr($1,$193)|0);
                    $223 = ($222|0)==(0);
                    if (!($223)) {
                     $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $222;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
                     break L42;
                    }
                    $224 = (_tre_stack_push_int($1,0)|0);
                    $225 = ($224|0)==(0);
                    if (!($225)) {
                     $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $224;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
                     break L42;
                    }
                    $226 = HEAP32[$$0460594>>2]|0;
                    $227 = ($226|0)>(-1);
                    if ($227) {
                     if ($7) {
                      $$10481 = $$0471588;$$10522 = $$0512579;$$11 = 0;
                     } else {
                      $228 = (_tre_add_tag_left($0,$48,$$0486585)|0);
                      $229 = HEAP32[$27>>2]|0;
                      $230 = (($229) + ($$0486585<<2)|0);
                      HEAP32[$230>>2] = $$0527576;
                      $231 = ($$0512579|0)>(-1);
                      if ($231) {
                       $232 = HEAP32[$28>>2]|0;
                       $$0498 = 0;
                       while(1) {
                        $233 = (($232) + ($$0498<<2)|0);
                        $234 = HEAP32[$233>>2]|0;
                        $235 = ($234|0)>(-1);
                        $236 = (($$0498) + 1)|0;
                        if ($235) {
                         $$0498 = $236;
                        } else {
                         break;
                        }
                       }
                       HEAP32[$233>>2] = $$0486585;
                       $237 = (($232) + ($236<<2)|0);
                       HEAP32[$237>>2] = $$0512579;
                       $238 = (($$0498) + 2)|0;
                       $239 = (($232) + ($238<<2)|0);
                       HEAP32[$239>>2] = -1;
                       $240 = (($$0471588) + 1)|0;
                       $$9480 = $240;$$9521 = -1;
                      } else {
                       $$9480 = $$0471588;$$9521 = $$0512579;
                      }
                      _tre_purge_regset($$0460594,$3,$$0486585);
                      $$10481 = $$9480;$$10522 = $$9521;$$11 = $228;
                     }
                     HEAP32[$$0460594>>2] = -1;
                     $241 = (($$0462591) + 1)|0;
                     $$11482 = $$10481;$$11523 = $$10522;$$12 = $$11;$$5467 = $241;$$5491 = $$0501582;$$7508 = $198;
                    } else {
                     $$11482 = $$0471588;$$11523 = $$0512579;$$12 = 0;$$5467 = $$0462591;$$5491 = $$0486585;$$7508 = $$0501582;
                    }
                    $242 = ((($48)) + 16|0);
                    $243 = HEAP32[$242>>2]|0;
                    $244 = ($243|0)>(0);
                    $245 = (($$7508) + 1)|0;
                    $246 = (($$7508) + 2)|0;
                    $$8509 = $244 ? $246 : $$7508;
                    $$6492 = $244 ? $245 : $$5491;
                    $$10511 = $$8509;$$13484 = $$11482;$$13525 = $$11523;$$14 = $$12;$$2529 = $$0527576;$$7469 = $$5467;$$8494 = $$6492;
                   } else {
                    $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $218;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
                   }
                  } else {
                   $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $216;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
                  }
                 } else {
                  $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $214;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
                 }
                } else {
                 $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $212;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
                }
               } else {
                $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $210;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
               }
              } else {
               $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $208;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
              }
             } else {
              $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $206;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
             }
            } else {
             $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $203;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
            }
           } else {
            $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $201;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
           }
          } else {
           $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = $199;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
          }
          break;
         }
         default: {
          $$10511 = $$0501582;$$13484 = $$0471588;$$13525 = $$0512579;$$14 = 0;$$2529 = $$0527576;$$7469 = $$0462591;$$8494 = $$0486585;
         }
         }
        } while(0);
        $247 = HEAP32[$49>>2]|0;
        $248 = ($247|0)>(-1);
        if ($248) {
         $$0497 = 0;
         while(1) {
          $249 = (($19) + ($$0497<<2)|0);
          $250 = HEAP32[$249>>2]|0;
          $251 = ($250|0)>(-1);
          $252 = (($$0497) + 1)|0;
          if ($251) {
           $$0497 = $252;
          } else {
           break;
          }
         }
         HEAP32[$249>>2] = $247;
         $253 = (($19) + ($252<<2)|0);
         HEAP32[$253>>2] = -1;
         $$0459$be = $$14;$$0460$be = $$0460594;$$0462$be = $$7469;$$0471$be = $$13484;$$0486$be = $$8494;$$0501$be = $$10511;$$0512$be = $$13525;$$0527$be = $$2529;
        } else {
         $$0459$be = $$14;$$0460$be = $$0460594;$$0462$be = $$7469;$$0471$be = $$13484;$$0486$be = $$8494;$$0501$be = $$10511;$$0512$be = $$13525;$$0527$be = $$2529;
        }
        break;
       }
       case 1:  {
        $254 = (_tre_stack_pop_voidptr($1)|0);
        if ($7) {
         $255 = ((($254)) + 4|0);
         $256 = HEAP32[$255>>2]|0;
         $257 = HEAP32[$256>>2]|0;
         $258 = ((($257)) + 20|0);
         $259 = HEAP32[$258>>2]|0;
         $260 = (_tre_stack_pop_int($1)|0);
         $261 = (($260) + ($259))|0;
         $262 = ((($254)) + 20|0);
         HEAP32[$262>>2] = $261;
         $$0496 = 0;$$14526 = -1;
        } else {
         $263 = (_tre_stack_pop_int($1)|0);
         $264 = (_tre_stack_pop_int($1)|0);
         $265 = ($263|0)==(0);
         $$0512$ = $265 ? $$0512579 : $264;
         $$0496 = $263;$$14526 = $$0512$;
        }
        $266 = ($$0496|0)==(0);
        $$543 = $266&1;
        $$3530 = $7 ? $$0527576 : $$543;
        $$0459$be = 0;$$0460$be = $$0460594;$$0462$be = $$0462591;$$0471$be = $$0471588;$$0486$be = $$0486585;$$0501$be = $$0501582;$$0512$be = $$14526;$$0527$be = $$3530;
        break;
       }
       case 4:  {
        $267 = (_tre_stack_pop_int($1)|0);
        $268 = (_tre_stack_pop_int($1)|0);
        $269 = ($267|0)>(-1);
        $$$0486 = $269 ? $267 : $$0486585;
        $$0459$be = 0;$$0460$be = $$0460594;$$0462$be = $$0462591;$$0471$be = $$0471588;$$0486$be = $$$0486;$$0501$be = $268;$$0512$be = $$0512579;$$0527$be = $$0527576;
        break;
       }
       case 5:  {
        $270 = (_tre_stack_pop_voidptr($1)|0);
        if ($7) {
         $271 = ((($270)) + 4|0);
         $272 = HEAP32[$271>>2]|0;
         $273 = HEAP32[$272>>2]|0;
         $274 = ((($273)) + 20|0);
         $275 = HEAP32[$274>>2]|0;
         $276 = ((($272)) + 4|0);
         $277 = HEAP32[$276>>2]|0;
         $278 = ((($277)) + 20|0);
         $279 = HEAP32[$278>>2]|0;
         $280 = (($279) + ($275))|0;
         $281 = ((($270)) + 20|0);
         HEAP32[$281>>2] = $280;
         $$0459$be = 0;$$0460$be = $$0460594;$$0462$be = $$0462591;$$0471$be = $$0471588;$$0486$be = $$0486585;$$0501$be = $$0501582;$$0512$be = $$0512579;$$0527$be = $$0527576;
        } else {
         $$0459$be = 0;$$0460$be = $$0460594;$$0462$be = $$0462591;$$0471$be = $$0471588;$$0486$be = $$0486585;$$0501$be = $$0501582;$$0512$be = $$0512579;$$0527$be = $$0527576;
        }
        break;
       }
       case 2:  {
        $$1461 = $$0460594;
        while(1) {
         $282 = HEAP32[$$1461>>2]|0;
         $283 = ($282|0)>(-1);
         $284 = ((($$1461)) + 4|0);
         if ($283) {
          $$1461 = $284;
         } else {
          $$0459$be = 0;$$0460$be = $$1461;$$0462$be = $$0462591;$$0471$be = $$0471588;$$0486$be = $$0486585;$$0501$be = $$0501582;$$0512$be = $$0512579;$$0527$be = $$0527576;
          break;
         }
        }
        break;
       }
       case 3:  {
        $285 = (_tre_stack_pop_voidptr($1)|0);
        $286 = (_tre_stack_pop_voidptr($1)|0);
        $287 = (_tre_stack_pop_voidptr($1)|0);
        $288 = (_tre_stack_pop_int($1)|0);
        if ($7) {
         $289 = ((($287)) + 4|0);
         $290 = HEAP32[$289>>2]|0;
         $291 = HEAP32[$290>>2]|0;
         $292 = ((($291)) + 20|0);
         $293 = HEAP32[$292>>2]|0;
         $294 = ((($290)) + 4|0);
         $295 = HEAP32[$294>>2]|0;
         $296 = ((($295)) + 20|0);
         $297 = HEAP32[$296>>2]|0;
         $298 = ((($287)) + 16|0);
         $299 = HEAP32[$298>>2]|0;
         $300 = ($299|0)>(0);
         $301 = $300 ? 2 : 0;
         $302 = (($293) + ($288))|0;
         $303 = (($302) + ($297))|0;
         $304 = (($303) + ($301))|0;
         $305 = ((($287)) + 20|0);
         HEAP32[$305>>2] = $304;
         $$pre$phi620Z2D = $298;
        } else {
         $$pre = ((($287)) + 16|0);
         $$pre$phi620Z2D = $$pre;
        }
        $306 = (_tre_stack_pop_voidptr($1)|0);
        $307 = (_tre_stack_pop_int($1)|0);
        $308 = (_tre_stack_pop_int($1)|0);
        $309 = HEAP32[$$pre$phi620Z2D>>2]|0;
        $310 = ($309|0)>(0);
        if ($310) {
         if ($7) {
          $$16 = 0;
         } else {
          $311 = (_tre_add_tag_right($0,$285,$307)|0);
          $312 = HEAP32[$27>>2]|0;
          $313 = (($312) + ($307<<2)|0);
          HEAP32[$313>>2] = 1;
          $314 = ($311|0)==(0);
          if ($314) {
           $315 = (_tre_add_tag_right($0,$286,$308)|0);
           $$15 = $315;
          } else {
           $$15 = $311;
          }
          $316 = HEAP32[$27>>2]|0;
          $317 = (($316) + ($308<<2)|0);
          HEAP32[$317>>2] = 1;
          $$16 = $$15;
         }
         $318 = (($$0462591) + 2)|0;
         $$0459$be = $$16;$$0460$be = $306;$$0462$be = $318;$$0471$be = $$0471588;$$0486$be = $$0486585;$$0501$be = $$0501582;$$0512$be = $$0512579;$$0527$be = 1;
        } else {
         $$0459$be = 0;$$0460$be = $306;$$0462$be = $$0462591;$$0471$be = $$0471588;$$0486$be = $$0486585;$$0501$be = $$0501582;$$0512$be = $$0512579;$$0527$be = 1;
        }
        break;
       }
       default: {
        $$0459$be = 0;$$0460$be = $$0460594;$$0462$be = $$0462591;$$0471$be = $$0471588;$$0486$be = $$0486585;$$0501$be = $$0501582;$$0512$be = $$0512579;$$0527$be = $$0527576;
       }
       }
      } while(0);
      $31 = (_tre_stack_num_objects($1)|0);
      $32 = ($31|0)<=($4|0);
      $33 = ($$0459$be|0)!=(0);
      $or$cond6 = $33 | $32;
      if ($or$cond6) {
       $$0459$lcssa = $$0459$be;$$0460$lcssa = $$0460$be;$$0462$lcssa = $$0462$be;$$0471$lcssa = $$0471$be;$$0486$lcssa = $$0486$be;$$0512$lcssa = $$0512$be;
       break L12;
      } else {
       $$0460594 = $$0460$be;$$0462591 = $$0462$be;$$0471588 = $$0471$be;$$0486585 = $$0486$be;$$0501582 = $$0501$be;$$0512579 = $$0512$be;$$0527576 = $$0527$be;
      }
     }
    }
   } while(0);
   if ($7) {
    $$14485 = $$0471$lcssa;
   } else {
    _tre_purge_regset($$0460$lcssa,$3,$$0486$lcssa);
    $319 = ($$0512$lcssa|0)>(-1);
    if ($319) {
     $320 = ((($3)) + 36|0);
     $321 = HEAP32[$320>>2]|0;
     $$0 = 0;
     while(1) {
      $322 = (($321) + ($$0<<2)|0);
      $323 = HEAP32[$322>>2]|0;
      $324 = ($323|0)>(-1);
      $325 = (($$0) + 1)|0;
      if ($324) {
       $$0 = $325;
      } else {
       break;
      }
     }
     HEAP32[$322>>2] = $$0486$lcssa;
     $326 = (($321) + ($325<<2)|0);
     HEAP32[$326>>2] = $$0512$lcssa;
     $327 = (($$0) + 2)|0;
     $328 = (($321) + ($327<<2)|0);
     HEAP32[$328>>2] = -1;
     $329 = (($$0471$lcssa) + 1)|0;
     $$14485 = $329;
    } else {
     $$14485 = $$0471$lcssa;
    }
   }
   $330 = ((($3)) + 48|0);
   HEAP32[$330>>2] = $$0462$lcssa;
   $331 = ((($3)) + 40|0);
   HEAP32[$331>>2] = $$0462$lcssa;
   $332 = ((($3)) + 44|0);
   HEAP32[$332>>2] = $$14485;
   _free($15);
   _free($19);
   $$0458 = $$0459$lcssa;
  }
 } while(0);
 return ($$0458|0);
}
function _tre_expand_ast($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0167$lcssa = 0, $$0180$lcssa = 0, $$0185$lcssa = 0, $$0185243288 = 0, $$0189256$be = 0, $$0189256$lcssa = 0, $$0189256293 = 0, $$0194255$be = 0, $$0194255294 = 0, $$1184248 = 0, $$1186 = 0, $$13 = 0, $$210 = 0, $$2182 = 0, $$3188 = 0, $$3188217 = 0, $$4$ph = 0, $$6$ph = 0, $$8$ph = 0, $$be = 0;
 var $$lcssa226 = 0, $$pre = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0;
 var $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0;
 var $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0;
 var $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0;
 var $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0;
 var $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0;
 var $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $or$cond = 0, $storemerge = 0, $storemerge252 = 0, $storemerge253 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $5 = sp + 16|0;
 $6 = sp + 12|0;
 $7 = sp + 8|0;
 $8 = sp + 4|0;
 $9 = sp;
 $10 = (_tre_stack_num_objects($1)|0);
 HEAP32[$5>>2] = 0;
 HEAP32[$6>>2] = 0;
 $11 = (_tre_stack_push_voidptr($1,$2)|0);
 $12 = ($11|0)==(0);
 L1: do {
  if ($12) {
   $13 = (_tre_stack_push_int($1,0)|0);
   $14 = ($13|0)==(0);
   if ($14) {
    $15 = (_tre_stack_num_objects($1)|0);
    $16 = ($15|0)>($10|0);
    L4: do {
     if ($16) {
      $$0189256293 = 0;$$0194255294 = 0;$28 = 0;
      L5: while(1) {
       $17 = (_tre_stack_pop_int($1)|0);
       $18 = (_tre_stack_pop_voidptr($1)|0);
       L7: do {
        switch ($17|0) {
        case 0:  {
         $19 = HEAP32[$18>>2]|0;
         switch ($19|0) {
         case 0:  {
          $20 = ((($18)) + 4|0);
          $21 = HEAP32[$20>>2]|0;
          $22 = HEAP32[$21>>2]|0;
          $23 = ($22|0)>(-1);
          $24 = ($22|0)==(-4);
          $or$cond = $23 | $24;
          if (!($or$cond)) {
           $$0189256$be = $$0189256293;$$0194255$be = $$0194255294;$$be = $28;
           break L7;
          }
          $25 = ((($21)) + 8|0);
          $26 = HEAP32[$25>>2]|0;
          $27 = (($26) + ($28))|0;
          HEAP32[$25>>2] = $27;
          $29 = HEAP32[$6>>2]|0;
          $30 = ($27|0)>($29|0);
          if (!($30)) {
           $$0189256$be = $$0189256293;$$0194255$be = $$0194255294;$$be = $28;
           break L7;
          }
          HEAP32[$6>>2] = $27;
          $$0189256$be = $$0189256293;$$0194255$be = $$0194255294;$$be = $28;
          break L7;
          break;
         }
         case 3:  {
          $31 = ((($18)) + 4|0);
          $32 = HEAP32[$31>>2]|0;
          $33 = ((($32)) + 4|0);
          $34 = HEAP32[$33>>2]|0;
          $35 = (_tre_stack_push_voidptr($1,$34)|0);
          $36 = ($35|0)==(0);
          if (!($36)) {
           $$0167$lcssa = $35;$$0189256$lcssa = $$0189256293;
           break L4;
          }
          $37 = (_tre_stack_push_int($1,0)|0);
          $38 = ($37|0)==(0);
          if (!($38)) {
           $$0167$lcssa = $37;$$0189256$lcssa = $$0189256293;
           break L4;
          }
          $39 = HEAP32[$32>>2]|0;
          $40 = (_tre_stack_push_voidptr($1,$39)|0);
          $41 = ($40|0)==(0);
          if (!($41)) {
           $$0167$lcssa = $40;$$0189256$lcssa = $$0189256293;
           break L4;
          }
          break;
         }
         case 1:  {
          $42 = ((($18)) + 4|0);
          $43 = HEAP32[$42>>2]|0;
          $44 = ((($43)) + 4|0);
          $45 = HEAP32[$44>>2]|0;
          $46 = (_tre_stack_push_voidptr($1,$45)|0);
          $47 = ($46|0)==(0);
          if (!($47)) {
           $$0167$lcssa = $46;$$0189256$lcssa = $$0189256293;
           break L4;
          }
          $48 = (_tre_stack_push_int($1,0)|0);
          $49 = ($48|0)==(0);
          if (!($49)) {
           $$0167$lcssa = $48;$$0189256$lcssa = $$0189256293;
           break L4;
          }
          $50 = HEAP32[$43>>2]|0;
          $51 = (_tre_stack_push_voidptr($1,$50)|0);
          $52 = ($51|0)==(0);
          if (!($52)) {
           $$0167$lcssa = $51;$$0189256$lcssa = $$0189256293;
           break L4;
          }
          break;
         }
         case 2:  {
          $53 = ((($18)) + 4|0);
          $54 = HEAP32[$53>>2]|0;
          $55 = (_tre_stack_push_int($1,$28)|0);
          $56 = ($55|0)==(0);
          if (!($56)) {
           $$0167$lcssa = $55;$$0189256$lcssa = $$0189256293;
           break L4;
          }
          $57 = (_tre_stack_push_voidptr($1,$18)|0);
          $58 = ($57|0)==(0);
          if (!($58)) {
           $$0167$lcssa = $57;$$0189256$lcssa = $$0189256293;
           break L4;
          }
          $59 = (_tre_stack_push_int($1,1)|0);
          $60 = ($59|0)==(0);
          if (!($60)) {
           $$0167$lcssa = $59;$$0189256$lcssa = $$0189256293;
           break L4;
          }
          $61 = HEAP32[$54>>2]|0;
          $62 = (_tre_stack_push_voidptr($1,$61)|0);
          $63 = ($62|0)==(0);
          if (!($63)) {
           $$0167$lcssa = $62;$$0189256$lcssa = $$0189256293;
           break L4;
          }
          $64 = (_tre_stack_push_int($1,0)|0);
          $65 = ($64|0)==(0);
          if (!($65)) {
           $$0167$lcssa = $64;$$0189256$lcssa = $$0189256293;
           break L4;
          }
          $66 = ((($54)) + 4|0);
          $67 = HEAP32[$66>>2]|0;
          $68 = ($67|0)>(1);
          if ($68) {
           label = 22;
          } else {
           $69 = ((($54)) + 8|0);
           $70 = HEAP32[$69>>2]|0;
           $71 = ($70|0)>(1);
           if ($71) {
            label = 22;
           } else {
            $148 = $28;
           }
          }
          if ((label|0) == 22) {
           label = 0;
           HEAP32[$5>>2] = 0;
           $148 = 0;
          }
          $72 = (($$0194255294) + 1)|0;
          $$0189256$be = $$0189256293;$$0194255$be = $72;$$be = $148;
          break L7;
          break;
         }
         default: {
          $$0189256$be = $$0189256293;$$0194255$be = $$0194255294;$$be = $28;
          break L7;
         }
         }
         $73 = (_tre_stack_push_int($1,0)|0);
         $74 = ($73|0)==(0);
         if ($74) {
          $$0189256$be = $$0189256293;$$0194255$be = $$0194255294;$$be = $28;
         } else {
          $$0167$lcssa = $73;$$0189256$lcssa = $$0189256293;
          break L4;
         }
         break;
        }
        case 1:  {
         $77 = ((($18)) + 4|0);
         $78 = HEAP32[$77>>2]|0;
         $79 = (_tre_stack_pop_int($1)|0);
         HEAP32[$5>>2] = $79;
         $80 = ((($78)) + 4|0);
         $81 = HEAP32[$80>>2]|0;
         $82 = ($81|0)>(1);
         if ($82) {
          HEAP32[$7>>2] = 0;
          label = 30;
         } else {
          $83 = ((($78)) + 8|0);
          $84 = HEAP32[$83>>2]|0;
          $85 = ($84|0)>(1);
          if ($85) {
           HEAP32[$7>>2] = 0;
           $86 = ($81|0)>(0);
           if ($86) {
            label = 30;
           } else {
            $$0180$lcssa = $79;$$0185$lcssa = 0;$$lcssa226 = $81;
            label = 37;
           }
          } else {
           $141 = $79;
          }
         }
         L36: do {
          if ((label|0) == 30) {
           label = 0;
           $87 = ($81|0)>(1);
           $88 = $87 ? 1 : 2;
           $89 = HEAP32[$78>>2]|0;
           $90 = (_tre_copy_ast($0,$1,$89,$88,$5,$4,$8,$6)|0);
           $91 = ($90|0)==(0);
           if ($91) {
            $$0185243288 = 0;$149 = $79;$97 = 1;
           } else {
            $$4$ph = $90;
            label = 34;
            break L5;
           }
           while(1) {
            $92 = ($$0185243288|0)==(0|0);
            $93 = HEAP32[$8>>2]|0;
            if ($92) {
             $$1186 = $93;
            } else {
             $94 = (_tre_ast_new_catenation($0,$$0185243288,$93)|0);
             $$1186 = $94;
            }
            $95 = ($$1186|0)==(0|0);
            if ($95) {
             $$4$ph = 12;
             label = 34;
             break L5;
            }
            $96 = HEAP32[$80>>2]|0;
            $98 = ($97|0)<($96|0);
            if (!($98)) {
             $$0180$lcssa = $149;$$0185$lcssa = $$1186;$$lcssa226 = $96;
             label = 37;
             break L36;
            }
            $$pre = HEAP32[$5>>2]|0;
            $99 = (($97) + 1)|0;
            $100 = ($99|0)<($96|0);
            $101 = $100 ? 1 : 2;
            $102 = HEAP32[$78>>2]|0;
            $103 = (_tre_copy_ast($0,$1,$102,$101,$5,$4,$8,$6)|0);
            $104 = ($103|0)==(0);
            if ($104) {
             $$0185243288 = $$1186;$149 = $$pre;$97 = $99;
            } else {
             $$4$ph = $103;
             label = 34;
             break L5;
            }
           }
          }
         } while(0);
         if ((label|0) == 37) {
          label = 0;
          $105 = ((($78)) + 8|0);
          $106 = HEAP32[$105>>2]|0;
          $107 = ($106|0)==(-1);
          if ($107) {
           $109 = HEAP32[$5>>2]|0;
           $110 = HEAP32[$78>>2]|0;
           $111 = (_tre_copy_ast($0,$1,$110,0,$5,0,$7,$6)|0);
           $112 = ($111|0)==(0);
           if (!($112)) {
            $$8$ph = $111;
            break L5;
           }
           $113 = HEAP32[$7>>2]|0;
           $114 = (_tre_ast_new_iter($0,$113,0,-1,0)|0);
           HEAP32[$7>>2] = $114;
           $115 = ($114|0)==(0|0);
           if ($115) {
            $$8$ph = 12;
            break L5;
           } else {
            $$2182 = $109;$132 = $114;
           }
          } else {
           $108 = ($$lcssa226|0)<($106|0);
           if ($108) {
            $$1184248 = $$lcssa226;$storemerge252 = 0;
            while(1) {
             $116 = HEAP32[$5>>2]|0;
             $117 = HEAP32[$78>>2]|0;
             $118 = (_tre_copy_ast($0,$1,$117,0,$5,0,$9,$6)|0);
             $119 = ($118|0)==(0);
             if (!($119)) {
              $$6$ph = $118;$storemerge253 = $storemerge252;
              label = 48;
              break L5;
             }
             $120 = ($storemerge252|0)==(0|0);
             $121 = HEAP32[$9>>2]|0;
             if ($120) {
              $storemerge = $121;
             } else {
              $122 = (_tre_ast_new_catenation($0,$121,$storemerge252)|0);
              $storemerge = $122;
             }
             $123 = ($storemerge|0)==(0|0);
             if ($123) {
              $$6$ph = 12;$storemerge253 = 0;
              label = 48;
              break L5;
             }
             $124 = (_tre_ast_new_literal($0,-1,-1,-1)|0);
             $125 = ($124|0)==(0|0);
             if ($125) {
              $$6$ph = 12;$storemerge253 = $storemerge;
              label = 48;
              break L5;
             }
             $126 = (_tre_ast_new_union($0,$124,$storemerge)|0);
             $127 = ($126|0)==(0|0);
             if ($127) {
              $$6$ph = 12;$storemerge253 = 0;
              label = 48;
              break L5;
             }
             $128 = (($$1184248) + 1)|0;
             $129 = HEAP32[$105>>2]|0;
             $130 = ($128|0)<($129|0);
             if ($130) {
              $$1184248 = $128;$storemerge252 = $126;
             } else {
              break;
             }
            }
            HEAP32[$7>>2] = $126;
            $$2182 = $116;$132 = $126;
           } else {
            $$2182 = $$0180$lcssa;$132 = 0;
           }
          }
          HEAP32[$5>>2] = $$2182;
          $131 = ($$0185$lcssa|0)==(0|0);
          if ($131) {
           $$3188 = $132;
           label = 54;
          } else {
           $133 = ($132|0)==(0|0);
           if ($133) {
            $$3188217 = $$0185$lcssa;
           } else {
            $134 = (_tre_ast_new_catenation($0,$$0185$lcssa,$132)|0);
            $$3188 = $134;
            label = 54;
           }
          }
          if ((label|0) == 54) {
           label = 0;
           $135 = ($$3188|0)==(0|0);
           if ($135) {
            $$8$ph = 12;
            break L5;
           } else {
            $$3188217 = $$3188;
           }
          }
          $136 = ((($$3188217)) + 4|0);
          $137 = HEAP32[$136>>2]|0;
          HEAP32[$77>>2] = $137;
          $138 = HEAP32[$$3188217>>2]|0;
          HEAP32[$18>>2] = $138;
          $141 = $$2182;
         }
         $139 = (($$0194255294) + -1)|0;
         $140 = (($141) - ($79))|0;
         $142 = (($140) + ($$0189256293))|0;
         $143 = ($139|0)==(0);
         if ($143) {
          HEAP32[$5>>2] = $142;
          $$0189256$be = $142;$$0194255$be = 0;$$be = $142;
         } else {
          $$0189256$be = $142;$$0194255$be = $139;$$be = $141;
         }
         break;
        }
        default: {
         $$0189256$be = $$0189256293;$$0194255$be = $$0194255294;$$be = $28;
        }
        }
       } while(0);
       $75 = (_tre_stack_num_objects($1)|0);
       $76 = ($75|0)>($10|0);
       if ($76) {
        $$0189256293 = $$0189256$be;$$0194255294 = $$0194255$be;$28 = $$be;
       } else {
        $$0167$lcssa = 0;$$0189256$lcssa = $$0189256$be;
        break L4;
       }
      }
      if ((label|0) == 34) {
       $$8$ph = $$4$ph;
      }
      else if ((label|0) == 48) {
       HEAP32[$7>>2] = $storemerge253;
       $$8$ph = $$6$ph;
      }
      $$13 = $$8$ph;
      break L1;
     } else {
      $$0167$lcssa = 0;$$0189256$lcssa = 0;
     }
    } while(0);
    $144 = HEAP32[$3>>2]|0;
    $145 = (($144) + ($$0189256$lcssa))|0;
    $146 = HEAP32[$6>>2]|0;
    $147 = ($146|0)>($145|0);
    $$210 = $147 ? $146 : $145;
    HEAP32[$3>>2] = $$210;
    $$13 = $$0167$lcssa;
   } else {
    $$13 = $13;
   }
  } else {
   $$13 = $11;
  }
 } while(0);
 STACKTOP = sp;return ($$13|0);
}
function _tre_ast_new_literal($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = (___tre_mem_alloc_impl($0,0,0,1,20)|0);
 $5 = (_tre_ast_new_node($0,0,$4)|0);
 $6 = ($5|0)==(0|0);
 if ($6) {
  $$0 = 0;
 } else {
  HEAP32[$4>>2] = $1;
  $7 = ((($4)) + 4|0);
  HEAP32[$7>>2] = $2;
  $8 = ((($4)) + 8|0);
  HEAP32[$8>>2] = $3;
  $$0 = $5;
 }
 return ($$0|0);
}
function _tre_ast_new_catenation($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1|0)==(0|0);
 if ($3) {
  $$0 = $2;
 } else {
  $4 = (___tre_mem_alloc_impl($0,0,0,1,8)|0);
  $5 = (_tre_ast_new_node($0,1,$4)|0);
  $6 = ($5|0)==(0|0);
  if ($6) {
   $$0 = 0;
  } else {
   HEAP32[$4>>2] = $1;
   $7 = ((($4)) + 4|0);
   HEAP32[$7>>2] = $2;
   $8 = ((($1)) + 16|0);
   $9 = HEAP32[$8>>2]|0;
   $10 = ((($2)) + 16|0);
   $11 = HEAP32[$10>>2]|0;
   $12 = (($11) + ($9))|0;
   $13 = ((($5)) + 16|0);
   HEAP32[$13>>2] = $12;
   $$0 = $5;
  }
 }
 return ($$0|0);
}
function _tre_compute_nfl($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$21$ph = 0, $$24 = 0, $$316 = 0, $$pre = 0, $$pre$phi391Z2D = 0, $$pre390 = 0, $$sink = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0;
 var $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0;
 var $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0;
 var $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0;
 var $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0;
 var $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0;
 var $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $not$ = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $3 = sp + 4|0;
 $4 = sp;
 $5 = (_tre_stack_num_objects($1)|0);
 $6 = (_tre_stack_push_voidptr($1,$2)|0);
 $7 = ($6|0)==(0);
 L1: do {
  if ($7) {
   $8 = (_tre_stack_push_int($1,0)|0);
   $9 = ($8|0)==(0);
   if ($9) {
    $10 = (_tre_stack_num_objects($1)|0);
    $11 = ($10|0)>($5|0);
    if ($11) {
     L5: while(1) {
      $12 = (_tre_stack_pop_int($1)|0);
      $13 = (_tre_stack_pop_voidptr($1)|0);
      L7: do {
       switch ($12|0) {
       case 0:  {
        $14 = HEAP32[$13>>2]|0;
        switch ($14|0) {
        case 0:  {
         $15 = ((($13)) + 4|0);
         $16 = HEAP32[$15>>2]|0;
         $17 = HEAP32[$16>>2]|0;
         $18 = ($17|0)==(-4);
         if ($18) {
          $19 = ((($13)) + 8|0);
          HEAP32[$19>>2] = 0;
          $20 = ((($16)) + 8|0);
          $21 = HEAP32[$20>>2]|0;
          $22 = (_tre_set_one($0,$21,0,1114111,0,0,-1)|0);
          $23 = ((($13)) + 24|0);
          HEAP32[$23>>2] = $22;
          $24 = ($22|0)==(0|0);
          if ($24) {
           $$24 = 12;
           break L1;
          }
          $25 = HEAP32[$20>>2]|0;
          $26 = ((($16)) + 4|0);
          $27 = HEAP32[$26>>2]|0;
          $28 = (_tre_set_one($0,$25,0,1114111,0,0,$27)|0);
          $29 = ((($13)) + 28|0);
          HEAP32[$29>>2] = $28;
          $30 = ($28|0)==(0|0);
          if ($30) {
           $$24 = 12;
           break L1;
          } else {
           break L7;
          }
         }
         $31 = ($17|0)<(0);
         $32 = ((($13)) + 8|0);
         if ($31) {
          HEAP32[$32>>2] = 1;
          $33 = (_tre_set_empty($0)|0);
          $34 = ((($13)) + 24|0);
          HEAP32[$34>>2] = $33;
          $35 = ($33|0)==(0|0);
          if ($35) {
           $$24 = 12;
           break L1;
          }
          $36 = (_tre_set_empty($0)|0);
          $37 = ((($13)) + 28|0);
          HEAP32[$37>>2] = $36;
          $38 = ($36|0)==(0|0);
          if ($38) {
           $$24 = 12;
           break L1;
          } else {
           break L7;
          }
         } else {
          HEAP32[$32>>2] = 0;
          $39 = ((($16)) + 8|0);
          $40 = HEAP32[$39>>2]|0;
          $41 = ((($16)) + 4|0);
          $42 = HEAP32[$41>>2]|0;
          $43 = (_tre_set_one($0,$40,$17,$42,0,0,-1)|0);
          $44 = ((($13)) + 24|0);
          HEAP32[$44>>2] = $43;
          $45 = ($43|0)==(0|0);
          if ($45) {
           $$24 = 12;
           break L1;
          }
          $46 = HEAP32[$39>>2]|0;
          $47 = HEAP32[$16>>2]|0;
          $48 = HEAP32[$41>>2]|0;
          $49 = ((($16)) + 12|0);
          $50 = HEAP32[$49>>2]|0;
          $51 = ((($16)) + 16|0);
          $52 = HEAP32[$51>>2]|0;
          $53 = (_tre_set_one($0,$46,$47,$48,$50,$52,-1)|0);
          $54 = ((($13)) + 28|0);
          HEAP32[$54>>2] = $53;
          $55 = ($53|0)==(0|0);
          if ($55) {
           $$24 = 12;
           break L1;
          } else {
           break L7;
          }
         }
         break;
        }
        case 3:  {
         $56 = (_tre_stack_push_voidptr($1,$13)|0);
         $57 = ($56|0)==(0);
         if (!($57)) {
          $$24 = $56;
          break L1;
         }
         $58 = (_tre_stack_push_int($1,1)|0);
         $59 = ($58|0)==(0);
         if (!($59)) {
          $$24 = $58;
          break L1;
         }
         $60 = ((($13)) + 4|0);
         $61 = HEAP32[$60>>2]|0;
         $62 = ((($61)) + 4|0);
         $63 = HEAP32[$62>>2]|0;
         $64 = (_tre_stack_push_voidptr($1,$63)|0);
         $65 = ($64|0)==(0);
         if (!($65)) {
          $$24 = $64;
          break L1;
         }
         $66 = (_tre_stack_push_int($1,0)|0);
         $67 = ($66|0)==(0);
         if (!($67)) {
          $$24 = $66;
          break L1;
         }
         $68 = HEAP32[$60>>2]|0;
         $69 = HEAP32[$68>>2]|0;
         $70 = (_tre_stack_push_voidptr($1,$69)|0);
         $71 = ($70|0)==(0);
         if (!($71)) {
          $$24 = $70;
          break L1;
         }
         $72 = (_tre_stack_push_int($1,0)|0);
         $73 = ($72|0)==(0);
         if ($73) {
          break L7;
         } else {
          $$24 = $72;
          break L1;
         }
         break;
        }
        case 1:  {
         $74 = (_tre_stack_push_voidptr($1,$13)|0);
         $75 = ($74|0)==(0);
         if (!($75)) {
          $$24 = $74;
          break L1;
         }
         $76 = (_tre_stack_push_int($1,2)|0);
         $77 = ($76|0)==(0);
         if (!($77)) {
          $$24 = $76;
          break L1;
         }
         $78 = ((($13)) + 4|0);
         $79 = HEAP32[$78>>2]|0;
         $80 = ((($79)) + 4|0);
         $81 = HEAP32[$80>>2]|0;
         $82 = (_tre_stack_push_voidptr($1,$81)|0);
         $83 = ($82|0)==(0);
         if (!($83)) {
          $$24 = $82;
          break L1;
         }
         $84 = (_tre_stack_push_int($1,0)|0);
         $85 = ($84|0)==(0);
         if (!($85)) {
          $$24 = $84;
          break L1;
         }
         $86 = HEAP32[$78>>2]|0;
         $87 = HEAP32[$86>>2]|0;
         $88 = (_tre_stack_push_voidptr($1,$87)|0);
         $89 = ($88|0)==(0);
         if (!($89)) {
          $$24 = $88;
          break L1;
         }
         $90 = (_tre_stack_push_int($1,0)|0);
         $91 = ($90|0)==(0);
         if ($91) {
          break L7;
         } else {
          $$24 = $90;
          break L1;
         }
         break;
        }
        case 2:  {
         $92 = (_tre_stack_push_voidptr($1,$13)|0);
         $93 = ($92|0)==(0);
         if (!($93)) {
          $$24 = $92;
          break L1;
         }
         $94 = (_tre_stack_push_int($1,3)|0);
         $95 = ($94|0)==(0);
         if (!($95)) {
          $$24 = $94;
          break L1;
         }
         $96 = ((($13)) + 4|0);
         $97 = HEAP32[$96>>2]|0;
         $98 = HEAP32[$97>>2]|0;
         $99 = (_tre_stack_push_voidptr($1,$98)|0);
         $100 = ($99|0)==(0);
         if (!($100)) {
          $$24 = $99;
          break L1;
         }
         $101 = (_tre_stack_push_int($1,0)|0);
         $102 = ($101|0)==(0);
         if ($102) {
          break L7;
         } else {
          $$24 = $101;
          break L1;
         }
         break;
        }
        default: {
         break L7;
        }
        }
        break;
       }
       case 1:  {
        $103 = ((($13)) + 4|0);
        $104 = HEAP32[$103>>2]|0;
        $105 = HEAP32[$104>>2]|0;
        $106 = ((($105)) + 8|0);
        $107 = HEAP32[$106>>2]|0;
        $108 = ($107|0)==(0);
        $109 = ((($104)) + 4|0);
        $110 = HEAP32[$109>>2]|0;
        if ($108) {
         $111 = ((($110)) + 8|0);
         $112 = HEAP32[$111>>2]|0;
         $113 = ($112|0)!=(0);
         $115 = $113;
        } else {
         $115 = 1;
        }
        $114 = $115&1;
        $116 = ((($13)) + 8|0);
        HEAP32[$116>>2] = $114;
        $117 = ((($105)) + 24|0);
        $118 = HEAP32[$117>>2]|0;
        $119 = ((($110)) + 24|0);
        $120 = HEAP32[$119>>2]|0;
        $121 = (_tre_set_union($0,$118,$120,0,0)|0);
        $122 = ((($13)) + 24|0);
        HEAP32[$122>>2] = $121;
        $123 = ($121|0)==(0|0);
        if ($123) {
         $$24 = 12;
         break L1;
        }
        $124 = HEAP32[$104>>2]|0;
        $125 = ((($124)) + 28|0);
        $126 = HEAP32[$125>>2]|0;
        $127 = HEAP32[$109>>2]|0;
        $128 = ((($127)) + 28|0);
        $129 = HEAP32[$128>>2]|0;
        $130 = (_tre_set_union($0,$126,$129,0,0)|0);
        $131 = ((($13)) + 28|0);
        HEAP32[$131>>2] = $130;
        $132 = ($130|0)==(0|0);
        if ($132) {
         $$24 = 12;
         break L1;
        }
        break;
       }
       case 3:  {
        $133 = ((($13)) + 4|0);
        $134 = HEAP32[$133>>2]|0;
        $135 = ((($134)) + 4|0);
        $136 = HEAP32[$135>>2]|0;
        $137 = ($136|0)==(0);
        $$pre = HEAP32[$134>>2]|0;
        if ($137) {
         $$sink = 1;
        } else {
         $138 = ((($$pre)) + 8|0);
         $139 = HEAP32[$138>>2]|0;
         $not$ = ($139|0)!=(0);
         $$316 = $not$&1;
         $$sink = $$316;
        }
        $140 = ((($13)) + 8|0);
        HEAP32[$140>>2] = $$sink;
        $141 = ((($$pre)) + 24|0);
        $142 = HEAP32[$141>>2]|0;
        $143 = ((($13)) + 24|0);
        HEAP32[$143>>2] = $142;
        $144 = ((($$pre)) + 28|0);
        $145 = HEAP32[$144>>2]|0;
        $146 = ((($13)) + 28|0);
        HEAP32[$146>>2] = $145;
        break;
       }
       case 2:  {
        $149 = ((($13)) + 4|0);
        $150 = HEAP32[$149>>2]|0;
        $151 = HEAP32[$150>>2]|0;
        $152 = ((($151)) + 8|0);
        $153 = HEAP32[$152>>2]|0;
        $154 = ($153|0)==(0);
        if ($154) {
         $161 = 0;
        } else {
         $155 = ((($150)) + 4|0);
         $156 = HEAP32[$155>>2]|0;
         $157 = ((($156)) + 8|0);
         $158 = HEAP32[$157>>2]|0;
         $159 = ($158|0)!=(0);
         $161 = $159;
        }
        $160 = $161&1;
        $162 = ((($13)) + 8|0);
        HEAP32[$162>>2] = $160;
        $163 = HEAP32[$152>>2]|0;
        $164 = ($163|0)==(0);
        if ($164) {
         $187 = ((($151)) + 24|0);
         $188 = HEAP32[$187>>2]|0;
         $189 = ((($13)) + 24|0);
         HEAP32[$189>>2] = $188;
         $$pre390 = ((($150)) + 4|0);
         $$pre$phi391Z2D = $$pre390;
        } else {
         $165 = (_tre_match_empty($1,$151,0,0,$3)|0);
         $166 = ($165|0)==(0);
         if (!($166)) {
          $$21$ph = $165;
          break L5;
         }
         $167 = HEAP32[$3>>2]|0;
         $168 = $167 << 2;
         $169 = (($168) + 4)|0;
         $170 = (_malloc($169)|0);
         $171 = ($170|0)==(0|0);
         if ($171) {
          $$21$ph = 12;
          break L5;
         }
         HEAP32[$170>>2] = -1;
         HEAP32[$4>>2] = 0;
         $172 = HEAP32[$150>>2]|0;
         $173 = (_tre_match_empty($1,$172,$170,$4,0)|0);
         $174 = ($173|0)==(0);
         if (!($174)) {
          label = 45;
          break L5;
         }
         $175 = ((($150)) + 4|0);
         $176 = HEAP32[$175>>2]|0;
         $177 = ((($176)) + 24|0);
         $178 = HEAP32[$177>>2]|0;
         $179 = HEAP32[$150>>2]|0;
         $180 = ((($179)) + 24|0);
         $181 = HEAP32[$180>>2]|0;
         $182 = HEAP32[$4>>2]|0;
         $183 = (_tre_set_union($0,$178,$181,$170,$182)|0);
         $184 = ((($13)) + 24|0);
         HEAP32[$184>>2] = $183;
         _free($170);
         $185 = HEAP32[$184>>2]|0;
         $186 = ($185|0)==(0|0);
         if ($186) {
          $$21$ph = 12;
          break L5;
         } else {
          $$pre$phi391Z2D = $175;
         }
        }
        $190 = HEAP32[$$pre$phi391Z2D>>2]|0;
        $191 = ((($190)) + 8|0);
        $192 = HEAP32[$191>>2]|0;
        $193 = ($192|0)==(0);
        if ($193) {
         $215 = ((($190)) + 28|0);
         $216 = HEAP32[$215>>2]|0;
         $217 = ((($13)) + 28|0);
         HEAP32[$217>>2] = $216;
        } else {
         $194 = (_tre_match_empty($1,$190,0,0,$3)|0);
         $195 = ($194|0)==(0);
         if (!($195)) {
          $$21$ph = $194;
          break L5;
         }
         $196 = HEAP32[$3>>2]|0;
         $197 = $196 << 2;
         $198 = (($197) + 4)|0;
         $199 = (_malloc($198)|0);
         $200 = ($199|0)==(0|0);
         if ($200) {
          $$21$ph = 12;
          break L5;
         }
         HEAP32[$199>>2] = -1;
         HEAP32[$4>>2] = 0;
         $201 = HEAP32[$$pre$phi391Z2D>>2]|0;
         $202 = (_tre_match_empty($1,$201,$199,$4,0)|0);
         $203 = ($202|0)==(0);
         if (!($203)) {
          label = 52;
          break L5;
         }
         $204 = HEAP32[$150>>2]|0;
         $205 = ((($204)) + 28|0);
         $206 = HEAP32[$205>>2]|0;
         $207 = HEAP32[$$pre$phi391Z2D>>2]|0;
         $208 = ((($207)) + 28|0);
         $209 = HEAP32[$208>>2]|0;
         $210 = HEAP32[$4>>2]|0;
         $211 = (_tre_set_union($0,$206,$209,$199,$210)|0);
         $212 = ((($13)) + 28|0);
         HEAP32[$212>>2] = $211;
         _free($199);
         $213 = HEAP32[$212>>2]|0;
         $214 = ($213|0)==(0|0);
         if ($214) {
          $$21$ph = 12;
          break L5;
         }
        }
        break;
       }
       default: {
       }
       }
      } while(0);
      $147 = (_tre_stack_num_objects($1)|0);
      $148 = ($147|0)>($5|0);
      if (!($148)) {
       $$24 = 0;
       break L1;
      }
     }
     if ((label|0) == 45) {
      _free($170);
      $$21$ph = $173;
     }
     else if ((label|0) == 52) {
      _free($199);
      $$21$ph = $202;
     }
     $$24 = $$21$ph;
    } else {
     $$24 = 0;
    }
   } else {
    $$24 = $8;
   }
  } else {
   $$24 = $6;
  }
 } while(0);
 STACKTOP = sp;return ($$24|0);
}
function _tre_ast_to_tnfa($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$051 = 0, $$sink52 = 0, $$tr = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $$tr = $0;
 L1: while(1) {
  $4 = HEAP32[$$tr>>2]|0;
  switch ($4|0) {
  case 2:  {
   $25 = ((($$tr)) + 4|0);
   $26 = HEAP32[$25>>2]|0;
   $27 = ((($26)) + 8|0);
   $28 = HEAP32[$27>>2]|0;
   $29 = ($28|0)==(-1);
   if ($29) {
    $30 = HEAP32[$26>>2]|0;
    $31 = ((($30)) + 28|0);
    $32 = HEAP32[$31>>2]|0;
    $33 = ((($30)) + 24|0);
    $34 = HEAP32[$33>>2]|0;
    $35 = (_tre_make_trans($32,$34,$1,$2,$3)|0);
    $36 = ($35|0)==(0);
    if ($36) {
     $$sink52 = $26;
    } else {
     $$051 = $35;
     break L1;
    }
   } else {
    $$sink52 = $26;
   }
   break;
  }
  case 3:  {
   $5 = ((($$tr)) + 4|0);
   $6 = HEAP32[$5>>2]|0;
   $7 = HEAP32[$6>>2]|0;
   $8 = (_tre_ast_to_tnfa($7,$1,$2,$3)|0);
   $9 = ($8|0)==(0);
   if (!($9)) {
    $$051 = $8;
    break L1;
   }
   $10 = ((($6)) + 4|0);
   $$sink52 = $10;
   break;
  }
  case 1:  {
   $11 = ((($$tr)) + 4|0);
   $12 = HEAP32[$11>>2]|0;
   $13 = HEAP32[$12>>2]|0;
   $14 = ((($13)) + 28|0);
   $15 = HEAP32[$14>>2]|0;
   $16 = ((($12)) + 4|0);
   $17 = HEAP32[$16>>2]|0;
   $18 = ((($17)) + 24|0);
   $19 = HEAP32[$18>>2]|0;
   $20 = (_tre_make_trans($15,$19,$1,$2,$3)|0);
   $21 = ($20|0)==(0);
   if (!($21)) {
    $$051 = $20;
    break L1;
   }
   $22 = HEAP32[$12>>2]|0;
   $23 = (_tre_ast_to_tnfa($22,$1,$2,$3)|0);
   $24 = ($23|0)==(0);
   if ($24) {
    $$sink52 = $16;
   } else {
    $$051 = $23;
    break L1;
   }
   break;
  }
  default: {
   $$051 = 0;
   break L1;
  }
  }
  $37 = HEAP32[$$sink52>>2]|0;
  $$tr = $37;
 }
 return ($$051|0);
}
function ___tre_mem_destroy($0) {
 $0 = $0|0;
 var $$in1011 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP32[$0>>2]|0;
 $2 = ($1|0)==(0|0);
 if (!($2)) {
  $$in1011 = $1;
  while(1) {
   $3 = HEAP32[$$in1011>>2]|0;
   _free($3);
   $4 = ((($$in1011)) + 4|0);
   $5 = HEAP32[$4>>2]|0;
   _free($$in1011);
   $6 = ($5|0)==(0|0);
   if ($6) {
    break;
   } else {
    $$in1011 = $5;
   }
  }
 }
 _free($0);
 return;
}
function _regfree($0) {
 $0 = $0|0;
 var $$04250 = 0, $$047 = 0, $$146 = 0, $$lcssa = 0, $$lcssa45 = 0, $$pre = 0, $$pre57 = 0, $$pre58 = 0, $$pre59 = 0, $$pre60 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0;
 var $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0;
 var $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 4|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ($2|0)==(0|0);
 if (!($3)) {
  $4 = ((($2)) + 4|0);
  $5 = HEAP32[$4>>2]|0;
  $6 = ($5|0)==(0);
  $7 = HEAP32[$2>>2]|0;
  if ($6) {
   $$lcssa45 = $7;
  } else {
   $$04250 = 0;$9 = $7;
   while(1) {
    $8 = (((($9) + ($$04250<<5)|0)) + 8|0);
    $10 = HEAP32[$8>>2]|0;
    $11 = ($10|0)==(0|0);
    if ($11) {
     $59 = $9;
    } else {
     $12 = (((($9) + ($$04250<<5)|0)) + 16|0);
     $13 = HEAP32[$12>>2]|0;
     $14 = ($13|0)==(0|0);
     if ($14) {
      $16 = $9;
     } else {
      _free($13);
      $$pre = HEAP32[$2>>2]|0;
      $16 = $$pre;
     }
     $15 = (((($16) + ($$04250<<5)|0)) + 28|0);
     $17 = HEAP32[$15>>2]|0;
     $18 = ($17|0)==(0|0);
     if ($18) {
      $59 = $16;
     } else {
      _free($17);
      $$pre57 = HEAP32[$2>>2]|0;
      $59 = $$pre57;
     }
    }
    $19 = (($$04250) + 1)|0;
    $20 = HEAP32[$4>>2]|0;
    $21 = ($19>>>0)<($20>>>0);
    if ($21) {
     $$04250 = $19;$9 = $59;
    } else {
     $$lcssa45 = $59;
     break;
    }
   }
  }
  $22 = ($$lcssa45|0)==(0|0);
  if (!($22)) {
   _free($$lcssa45);
  }
  $23 = ((($2)) + 8|0);
  $24 = HEAP32[$23>>2]|0;
  $25 = ($24|0)==(0|0);
  if (!($25)) {
   $26 = ((($24)) + 8|0);
   $27 = HEAP32[$26>>2]|0;
   $28 = ($27|0)==(0|0);
   if ($28) {
    $36 = $24;
   } else {
    $$047 = $24;
    while(1) {
     $29 = ((($$047)) + 16|0);
     $30 = HEAP32[$29>>2]|0;
     $31 = ($30|0)==(0|0);
     if (!($31)) {
      _free($30);
     }
     $32 = ((($$047)) + 32|0);
     $33 = ((($$047)) + 40|0);
     $34 = HEAP32[$33>>2]|0;
     $35 = ($34|0)==(0|0);
     if ($35) {
      break;
     } else {
      $$047 = $32;
     }
    }
    $$pre58 = HEAP32[$23>>2]|0;
    $36 = $$pre58;
   }
   _free($36);
  }
  $37 = ((($2)) + 16|0);
  $38 = HEAP32[$37>>2]|0;
  $39 = ($38|0)==(0|0);
  if (!($39)) {
   $40 = ((($2)) + 28|0);
   $41 = HEAP32[$40>>2]|0;
   $42 = ($41|0)==(0);
   if ($42) {
    $$lcssa = $38;
   } else {
    $$146 = 0;$44 = $38;$60 = $41;
    while(1) {
     $43 = (((($44) + (($$146*12)|0)|0)) + 8|0);
     $45 = HEAP32[$43>>2]|0;
     $46 = ($45|0)==(0|0);
     if ($46) {
      $49 = $60;$61 = $44;
     } else {
      _free($45);
      $$pre59 = HEAP32[$40>>2]|0;
      $$pre60 = HEAP32[$37>>2]|0;
      $49 = $$pre59;$61 = $$pre60;
     }
     $47 = (($$146) + 1)|0;
     $48 = ($47>>>0)<($49>>>0);
     if ($48) {
      $$146 = $47;$44 = $61;$60 = $49;
     } else {
      $$lcssa = $61;
      break;
     }
    }
   }
   _free($$lcssa);
  }
  $50 = ((($2)) + 32|0);
  $51 = HEAP32[$50>>2]|0;
  $52 = ($51|0)==(0|0);
  if (!($52)) {
   _free($51);
  }
  $53 = ((($2)) + 20|0);
  $54 = HEAP32[$53>>2]|0;
  $55 = ($54|0)==(0|0);
  if (!($55)) {
   _free($54);
  }
  $56 = ((($2)) + 36|0);
  $57 = HEAP32[$56>>2]|0;
  $58 = ($57|0)==(0|0);
  if (!($58)) {
   _free($57);
  }
  _free($2);
 }
 return;
}
function _tre_make_trans($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0$ph175 = 0, $$0119171 = 0, $$0120167 = 0, $$0121 = 0, $$0124 = 0, $$0127 = 0, $$0128 = 0, $$0131$ph174 = 0, $$0131158 = 0, $$1 = 0, $$1122 = 0, $$1125161 = 0, $$2 = 0, $$2123169 = 0, $$2126 = 0, $$3 = 0, $$4164 = 0, $$5 = 0, $$lcssa155 = 0, $$pre = 0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $16 = 0, $17 = 0;
 var $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0;
 var $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0;
 var $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0;
 var $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0;
 var $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ($2|0)==(0|0);
 $6 = HEAP32[$0>>2]|0;
 $7 = ($6|0)>(-1);
 L1: do {
  if ($5) {
   if ($7) {
    $8 = ((($1)) + 32|0);
    $135 = $6;$140 = $0;
    while(1) {
     $132 = HEAP32[$1>>2]|0;
     $133 = ($132|0)>(-1);
     if ($133) {
      $134 = (($3) + ($135<<2)|0);
      $136 = HEAP32[$134>>2]|0;
      $137 = (($136) + 1)|0;
      HEAP32[$134>>2] = $137;
      $138 = HEAP32[$8>>2]|0;
      $139 = ($138|0)>(-1);
      if ($139) {
       $145 = $8;
       while(1) {
        $$pre = HEAP32[$140>>2]|0;
        $141 = (($3) + ($$pre<<2)|0);
        $142 = HEAP32[$141>>2]|0;
        $143 = (($142) + 1)|0;
        HEAP32[$141>>2] = $143;
        $144 = ((($145)) + 32|0);
        $146 = HEAP32[$144>>2]|0;
        $147 = ($146|0)>(-1);
        if ($147) {
         $145 = $144;
        } else {
         break;
        }
       }
      }
     }
     $148 = ((($140)) + 32|0);
     $149 = HEAP32[$148>>2]|0;
     $150 = ($149|0)>(-1);
     if ($150) {
      $135 = $149;$140 = $148;
     } else {
      $$0128 = 0;
      break;
     }
    }
   } else {
    $$0128 = 0;
   }
  } else {
   if ($7) {
    $12 = $0;
    while(1) {
     $9 = HEAP32[$1>>2]|0;
     $10 = ($9|0)>(-1);
     L15: do {
      if ($10) {
       $11 = ((($12)) + 4|0);
       $13 = ((($12)) + 8|0);
       $14 = ((($12)) + 16|0);
       $15 = ((($12)) + 20|0);
       $16 = ((($12)) + 24|0);
       $17 = ((($12)) + 28|0);
       $18 = ((($12)) + 12|0);
       $$0$ph175 = -1;$$0131$ph174 = $1;$151 = $9;
       while(1) {
        $$0131158 = $$0131$ph174;$19 = $151;
        while(1) {
         $20 = ($19|0)==($$0$ph175|0);
         if (!($20)) {
          break;
         }
         $21 = ((($$0131158)) + 32|0);
         $22 = HEAP32[$21>>2]|0;
         $23 = ($22|0)>(-1);
         if ($23) {
          $$0131158 = $21;$19 = $22;
         } else {
          break L15;
         }
        }
        $24 = HEAP32[$12>>2]|0;
        $25 = (($4) + ($24<<2)|0);
        $26 = HEAP32[$25>>2]|0;
        $27 = (($2) + ($26<<5)|0);
        $$0127 = $27;
        while(1) {
         $28 = ((($$0127)) + 8|0);
         $29 = HEAP32[$28>>2]|0;
         $30 = ($29|0)==(0|0);
         $31 = ((($$0127)) + 32|0);
         if ($30) {
          break;
         } else {
          $$0127 = $31;
         }
        }
        $32 = ((($$0127)) + 40|0);
        HEAP32[$32>>2] = 0;
        $33 = HEAP32[$11>>2]|0;
        HEAP32[$$0127>>2] = $33;
        $34 = HEAP32[$13>>2]|0;
        $35 = ((($$0127)) + 4|0);
        HEAP32[$35>>2] = $34;
        $36 = (($4) + ($19<<2)|0);
        $37 = HEAP32[$36>>2]|0;
        $38 = (($2) + ($37<<5)|0);
        HEAP32[$28>>2] = $38;
        $39 = ((($$0127)) + 12|0);
        HEAP32[$39>>2] = $19;
        $40 = HEAP32[$14>>2]|0;
        $41 = ((($$0131158)) + 16|0);
        $42 = HEAP32[$41>>2]|0;
        $43 = $42 | $40;
        $44 = HEAP32[$15>>2]|0;
        $45 = ($44|0)!=(0);
        $46 = $45 ? 4 : 0;
        $47 = $43 | $46;
        $48 = HEAP32[$16>>2]|0;
        $49 = ($48|0)!=(0|0);
        $50 = $49 ? 8 : 0;
        $51 = $47 | $50;
        $52 = ((($$0127)) + 20|0);
        HEAP32[$52>>2] = $51;
        $53 = HEAP32[$17>>2]|0;
        $54 = ($53|0)>(-1);
        $55 = ((($$0127)) + 24|0);
        if ($54) {
         HEAP32[$55>>2] = $53;
         $56 = $51 | 256;
         HEAP32[$52>>2] = $56;
        } else {
         HEAP32[$55>>2] = $44;
        }
        if ($49) {
         $$0124 = 0;
         while(1) {
          $57 = (($48) + ($$0124<<2)|0);
          $58 = HEAP32[$57>>2]|0;
          $59 = ($58|0)==(0);
          $60 = (($$0124) + 1)|0;
          if ($59) {
           break;
          } else {
           $$0124 = $60;
          }
         }
         $61 = $60 << 2;
         $62 = (_malloc($61)|0);
         $63 = ((($$0127)) + 28|0);
         HEAP32[$63>>2] = $62;
         $64 = ($62|0)==(0|0);
         if ($64) {
          $$0128 = 12;
          break L1;
         }
         $65 = HEAP32[$16>>2]|0;
         $66 = HEAP32[$65>>2]|0;
         $67 = ($66|0)==(0);
         if ($67) {
          $$lcssa155 = $62;
         } else {
          $$1125161 = 0;$68 = $66;$69 = $62;
          while(1) {
           HEAP32[$69>>2] = $68;
           $70 = (($$1125161) + 1)|0;
           $71 = (($65) + ($70<<2)|0);
           $72 = HEAP32[$71>>2]|0;
           $73 = ($72|0)==(0);
           $74 = (($62) + ($70<<2)|0);
           if ($73) {
            $$lcssa155 = $74;
            break;
           } else {
            $$1125161 = $70;$68 = $72;$69 = $74;
           }
          }
         }
         HEAP32[$$lcssa155>>2] = 0;
        } else {
         $75 = ((($$0127)) + 28|0);
         HEAP32[$75>>2] = 0;
        }
        $76 = HEAP32[$18>>2]|0;
        $77 = ($76|0)==(0|0);
        if ($77) {
         $$3 = 0;
        } else {
         $$2126 = 0;
         while(1) {
          $78 = (($76) + ($$2126<<2)|0);
          $79 = HEAP32[$78>>2]|0;
          $80 = ($79|0)>(-1);
          $81 = (($$2126) + 1)|0;
          if ($80) {
           $$2126 = $81;
          } else {
           $$3 = $$2126;
           break;
          }
         }
        }
        $82 = ((($$0131158)) + 12|0);
        $83 = HEAP32[$82>>2]|0;
        $84 = ($83|0)==(0|0);
        if ($84) {
         $$1122 = 0;
        } else {
         $$0121 = 0;
         while(1) {
          $85 = (($83) + ($$0121<<2)|0);
          $86 = HEAP32[$85>>2]|0;
          $87 = ($86|0)>(-1);
          $88 = (($$0121) + 1)|0;
          if ($87) {
           $$0121 = $88;
          } else {
           $$1122 = $$0121;
           break;
          }
         }
        }
        $89 = ((($$0127)) + 16|0);
        $90 = HEAP32[$89>>2]|0;
        $91 = ($90|0)==(0|0);
        if (!($91)) {
         _free($90);
        }
        HEAP32[$89>>2] = 0;
        $92 = (($$1122) + ($$3))|0;
        $93 = ($92|0)>(0);
        if ($93) {
         $94 = $92 << 2;
         $95 = (($94) + 4)|0;
         $96 = (_malloc($95)|0);
         HEAP32[$89>>2] = $96;
         $97 = ($96|0)==(0|0);
         if ($97) {
          $$0128 = 12;
          break L1;
         }
         $98 = HEAP32[$18>>2]|0;
         $99 = ($98|0)==(0|0);
         if ($99) {
          $$5 = 0;
         } else {
          $100 = HEAP32[$98>>2]|0;
          $101 = ($100|0)>(-1);
          if ($101) {
           $$4164 = 0;$103 = $100;
           while(1) {
            $102 = (($96) + ($$4164<<2)|0);
            HEAP32[$102>>2] = $103;
            $104 = (($$4164) + 1)|0;
            $105 = (($98) + ($104<<2)|0);
            $106 = HEAP32[$105>>2]|0;
            $107 = ($106|0)>(-1);
            if ($107) {
             $$4164 = $104;$103 = $106;
            } else {
             $$5 = $104;
             break;
            }
           }
          } else {
           $$5 = 0;
          }
         }
         $108 = HEAP32[$82>>2]|0;
         $109 = ($108|0)==(0|0);
         if ($109) {
          $$2 = $$5;
         } else {
          $110 = HEAP32[$108>>2]|0;
          $111 = ($110|0)>(-1);
          if ($111) {
           $112 = ($$5|0)>(0);
           $$0119171 = $$5;$$2123169 = 0;$118 = $110;
           while(1) {
            L65: do {
             if ($112) {
              $$0120167 = 0;
              while(1) {
               $115 = (($96) + ($$0120167<<2)|0);
               $116 = HEAP32[$115>>2]|0;
               $117 = ($116|0)==($118|0);
               $113 = (($$0120167) + 1)|0;
               if ($117) {
                $$1 = $$0119171;
                break L65;
               }
               $114 = ($113|0)<($$5|0);
               if ($114) {
                $$0120167 = $113;
               } else {
                label = 40;
                break;
               }
              }
             } else {
              label = 40;
             }
            } while(0);
            if ((label|0) == 40) {
             label = 0;
             $119 = (($$0119171) + 1)|0;
             $120 = (($96) + ($$0119171<<2)|0);
             HEAP32[$120>>2] = $118;
             $$1 = $119;
            }
            $121 = (($$2123169) + 1)|0;
            $122 = (($108) + ($121<<2)|0);
            $123 = HEAP32[$122>>2]|0;
            $124 = ($123|0)>(-1);
            if ($124) {
             $$0119171 = $$1;$$2123169 = $121;$118 = $123;
            } else {
             $$2 = $$1;
             break;
            }
           }
          } else {
           $$2 = $$5;
          }
         }
         $125 = (($96) + ($$2<<2)|0);
         HEAP32[$125>>2] = -1;
        }
        $126 = ((($$0131158)) + 32|0);
        $127 = HEAP32[$126>>2]|0;
        $128 = ($127|0)>(-1);
        if ($128) {
         $$0$ph175 = $19;$$0131$ph174 = $126;$151 = $127;
        } else {
         break;
        }
       }
      }
     } while(0);
     $129 = ((($12)) + 32|0);
     $130 = HEAP32[$129>>2]|0;
     $131 = ($130|0)>(-1);
     if ($131) {
      $12 = $129;
     } else {
      $$0128 = 0;
      break;
     }
    }
   } else {
    $$0128 = 0;
   }
  }
 } while(0);
 return ($$0128|0);
}
function _tre_stack_num_objects($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 12|0);
 $2 = HEAP32[$1>>2]|0;
 return ($2|0);
}
function _tre_stack_push_voidptr($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$byval_copy = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $$byval_copy = sp + 4|0;
 $2 = sp;
 HEAP32[$2>>2] = $1;
 ;HEAP32[$$byval_copy>>2]=HEAP32[$2>>2]|0;
 $3 = (_tre_stack_push($0,$$byval_copy)|0);
 STACKTOP = sp;return ($3|0);
}
function _tre_stack_push_int($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$byval_copy = 0, $2 = 0, $3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $$byval_copy = sp + 4|0;
 $2 = sp;
 HEAP32[$2>>2] = $1;
 ;HEAP32[$$byval_copy>>2]=HEAP32[$2>>2]|0;
 $3 = (_tre_stack_push($0,$$byval_copy)|0);
 STACKTOP = sp;return ($3|0);
}
function _tre_stack_pop_int($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 16|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 12|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = (($4) + -1)|0;
 HEAP32[$3>>2] = $5;
 $6 = (($2) + ($5<<2)|0);
 $7 = HEAP32[$6>>2]|0;
 return ($7|0);
}
function _tre_stack_pop_voidptr($0) {
 $0 = $0|0;
 var $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 16|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 12|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = (($4) + -1)|0;
 HEAP32[$3>>2] = $5;
 $6 = (($2) + ($5<<2)|0);
 $7 = HEAP32[$6>>2]|0;
 return ($7|0);
}
function _tre_set_one($0,$1,$2,$3,$4,$5,$6) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $7 = (___tre_mem_alloc_impl($0,0,0,1,64)|0);
 $8 = ($7|0)==(0|0);
 if ($8) {
  $$0 = 0;
 } else {
  HEAP32[$7>>2] = $1;
  $9 = ((($7)) + 4|0);
  HEAP32[$9>>2] = $2;
  $10 = ((($7)) + 8|0);
  HEAP32[$10>>2] = $3;
  $11 = ((($7)) + 20|0);
  HEAP32[$11>>2] = $4;
  $12 = ((($7)) + 24|0);
  HEAP32[$12>>2] = $5;
  $13 = ((($7)) + 28|0);
  HEAP32[$13>>2] = $6;
  $14 = ((($7)) + 32|0);
  HEAP32[$14>>2] = -1;
  $15 = ((($7)) + 36|0);
  HEAP32[$15>>2] = -1;
  $16 = ((($7)) + 40|0);
  HEAP32[$16>>2] = -1;
  $$0 = $7;
 }
 return ($$0|0);
}
function _tre_set_empty($0) {
 $0 = $0|0;
 var $$0 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (___tre_mem_alloc_impl($0,0,0,1,32)|0);
 $2 = ($1|0)==(0|0);
 if ($2) {
  $$0 = 0;
 } else {
  HEAP32[$1>>2] = -1;
  $3 = ((($1)) + 4|0);
  HEAP32[$3>>2] = -1;
  $4 = ((($1)) + 8|0);
  HEAP32[$4>>2] = -1;
  $$0 = $1;
 }
 return ($$0|0);
}
function _tre_set_union($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0$lcssa = 0, $$0173 = 0, $$0174$lcssa = 0, $$0174204 = 0, $$0175$lcssa = 0, $$0175199 = 0, $$0177 = 0, $$0179 = 0, $$0214 = 0, $$1$lcssa = 0, $$1176207 = 0, $$1178195 = 0, $$1180$lcssa = 0, $$1180211 = 0, $$1194 = 0, $$2 = 0, $$lcssa189 = 0, $$lcssa191 = 0, $$sink = 0, $$sink5 = 0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0;
 var $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0;
 var $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0;
 var $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0;
 var $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0;
 var $99 = 0, $exitcond = 0, $exitcond228 = 0, $exitcond229 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ($3|0)==(0|0);
 if ($5) {
  $$0$lcssa = 0;
 } else {
  $$0214 = 0;
  while(1) {
   $6 = (($3) + ($$0214<<2)|0);
   $7 = HEAP32[$6>>2]|0;
   $8 = ($7|0)>(-1);
   $9 = (($$0214) + 1)|0;
   if ($8) {
    $$0214 = $9;
   } else {
    $$0$lcssa = $$0214;
    break;
   }
  }
 }
 $$0179 = 0;
 while(1) {
  $10 = (($1) + ($$0179<<5)|0);
  $11 = HEAP32[$10>>2]|0;
  $12 = ($11|0)>(-1);
  $13 = (($$0179) + 1)|0;
  if ($12) {
   $$0179 = $13;
  } else {
   $$0177 = 0;
   break;
  }
 }
 while(1) {
  $14 = (($2) + ($$0177<<5)|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = ($15|0)>(-1);
  $17 = (($$0177) + 1)|0;
  if ($16) {
   $$0177 = $17;
  } else {
   break;
  }
 }
 $18 = (($$0177) + ($$0179))|0;
 $19 = $18 << 5;
 $20 = (($19) + 32)|0;
 $21 = (___tre_mem_alloc_impl($0,0,0,1,$20)|0);
 $22 = ($21|0)==(0|0);
 L10: do {
  if ($22) {
   $$0173 = 0;
  } else {
   $23 = HEAP32[$1>>2]|0;
   $24 = ($23|0)>(-1);
   if ($24) {
    $25 = ($$0$lcssa|0)>(0);
    $$1180211 = 0;$30 = $23;
    while(1) {
     $29 = (($21) + ($$1180211<<5)|0);
     HEAP32[$29>>2] = $30;
     $31 = (((($1) + ($$1180211<<5)|0)) + 4|0);
     $32 = HEAP32[$31>>2]|0;
     $33 = (((($21) + ($$1180211<<5)|0)) + 4|0);
     HEAP32[$33>>2] = $32;
     $34 = (((($1) + ($$1180211<<5)|0)) + 8|0);
     $35 = HEAP32[$34>>2]|0;
     $36 = (((($21) + ($$1180211<<5)|0)) + 8|0);
     HEAP32[$36>>2] = $35;
     $37 = (((($1) + ($$1180211<<5)|0)) + 16|0);
     $38 = HEAP32[$37>>2]|0;
     $39 = $38 | $4;
     $40 = (((($21) + ($$1180211<<5)|0)) + 16|0);
     HEAP32[$40>>2] = $39;
     $41 = (((($1) + ($$1180211<<5)|0)) + 20|0);
     $42 = HEAP32[$41>>2]|0;
     $43 = (((($21) + ($$1180211<<5)|0)) + 20|0);
     HEAP32[$43>>2] = $42;
     $44 = (((($1) + ($$1180211<<5)|0)) + 24|0);
     $45 = HEAP32[$44>>2]|0;
     $46 = (((($21) + ($$1180211<<5)|0)) + 24|0);
     HEAP32[$46>>2] = $45;
     $47 = (((($1) + ($$1180211<<5)|0)) + 28|0);
     $48 = HEAP32[$47>>2]|0;
     $49 = (((($21) + ($$1180211<<5)|0)) + 28|0);
     HEAP32[$49>>2] = $48;
     $50 = (((($1) + ($$1180211<<5)|0)) + 12|0);
     $51 = HEAP32[$50>>2]|0;
     $52 = ($51|0)==(0|0);
     $or$cond = $5 & $52;
     if ($or$cond) {
      $$sink = 0;
     } else {
      if ($52) {
       $$0175$lcssa = 0;
      } else {
       $$0175199 = 0;
       while(1) {
        $53 = (($51) + ($$0175199<<2)|0);
        $54 = HEAP32[$53>>2]|0;
        $55 = ($54|0)>(-1);
        $56 = (($$0175199) + 1)|0;
        if ($55) {
         $$0175199 = $56;
        } else {
         $$0175$lcssa = $$0175199;
         break;
        }
       }
      }
      $57 = (($$0175$lcssa) + ($$0$lcssa))|0;
      $58 = $57 << 2;
      $59 = (($58) + 4)|0;
      $60 = (___tre_mem_alloc_impl($0,0,0,0,$59)|0);
      $61 = ($60|0)==(0|0);
      if ($61) {
       $$0173 = 0;
       break L10;
      }
      $62 = ($$0175$lcssa|0)>(0);
      if ($62) {
       $63 = HEAP32[$50>>2]|0;
       $$0174204 = 0;
       while(1) {
        $64 = (($63) + ($$0174204<<2)|0);
        $65 = HEAP32[$64>>2]|0;
        $66 = (($60) + ($$0174204<<2)|0);
        HEAP32[$66>>2] = $65;
        $67 = (($$0174204) + 1)|0;
        $exitcond228 = ($67|0)==($$0175$lcssa|0);
        if ($exitcond228) {
         $$0174$lcssa = $$0175$lcssa;
         break;
        } else {
         $$0174204 = $67;
        }
       }
      } else {
       $$0174$lcssa = 0;
      }
      if ($25) {
       $$1176207 = 0;$71 = $$0174$lcssa;
       while(1) {
        $68 = (($3) + ($$1176207<<2)|0);
        $69 = HEAP32[$68>>2]|0;
        $70 = (($60) + ($71<<2)|0);
        HEAP32[$70>>2] = $69;
        $72 = (($$1176207) + 1)|0;
        $73 = (($72) + ($$0174$lcssa))|0;
        $exitcond229 = ($72|0)==($$0$lcssa|0);
        if ($exitcond229) {
         break;
        } else {
         $$1176207 = $72;$71 = $73;
        }
       }
       $74 = (($$0$lcssa) + ($$0174$lcssa))|0;
       $$lcssa191 = $74;
      } else {
       $$lcssa191 = $$0174$lcssa;
      }
      $75 = (($60) + ($$lcssa191<<2)|0);
      HEAP32[$75>>2] = -1;
      $$sink = $60;
     }
     $76 = (((($21) + ($$1180211<<5)|0)) + 12|0);
     HEAP32[$76>>2] = $$sink;
     $77 = (($$1180211) + 1)|0;
     $78 = (($1) + ($77<<5)|0);
     $79 = HEAP32[$78>>2]|0;
     $80 = ($79|0)>(-1);
     if ($80) {
      $$1180211 = $77;$30 = $79;
     } else {
      $$1180$lcssa = $77;
      break;
     }
    }
   } else {
    $$1180$lcssa = 0;
   }
   $26 = HEAP32[$2>>2]|0;
   $27 = ($26|0)>(-1);
   $28 = (($21) + ($$1180$lcssa<<5)|0);
   if ($27) {
    $$1178195 = 0;$81 = $26;$82 = $28;$86 = $$1180$lcssa;
    while(1) {
     HEAP32[$82>>2] = $81;
     $83 = (((($2) + ($$1178195<<5)|0)) + 4|0);
     $84 = HEAP32[$83>>2]|0;
     $85 = (((($21) + ($86<<5)|0)) + 4|0);
     HEAP32[$85>>2] = $84;
     $87 = (((($2) + ($$1178195<<5)|0)) + 8|0);
     $88 = HEAP32[$87>>2]|0;
     $89 = (((($21) + ($86<<5)|0)) + 8|0);
     HEAP32[$89>>2] = $88;
     $90 = (((($2) + ($$1178195<<5)|0)) + 16|0);
     $91 = HEAP32[$90>>2]|0;
     $92 = (((($21) + ($86<<5)|0)) + 16|0);
     HEAP32[$92>>2] = $91;
     $93 = (((($2) + ($$1178195<<5)|0)) + 20|0);
     $94 = HEAP32[$93>>2]|0;
     $95 = (((($21) + ($86<<5)|0)) + 20|0);
     HEAP32[$95>>2] = $94;
     $96 = (((($2) + ($$1178195<<5)|0)) + 24|0);
     $97 = HEAP32[$96>>2]|0;
     $98 = (((($21) + ($86<<5)|0)) + 24|0);
     HEAP32[$98>>2] = $97;
     $99 = (((($2) + ($$1178195<<5)|0)) + 28|0);
     $100 = HEAP32[$99>>2]|0;
     $101 = (((($21) + ($86<<5)|0)) + 28|0);
     HEAP32[$101>>2] = $100;
     $102 = (((($2) + ($$1178195<<5)|0)) + 12|0);
     $103 = HEAP32[$102>>2]|0;
     $104 = ($103|0)==(0|0);
     if ($104) {
      $$sink5 = 0;
     } else {
      $$2 = 0;
      while(1) {
       $105 = (($103) + ($$2<<2)|0);
       $106 = HEAP32[$105>>2]|0;
       $107 = ($106|0)>(-1);
       $108 = (($$2) + 1)|0;
       if ($107) {
        $$2 = $108;
       } else {
        break;
       }
      }
      $109 = $108 << 2;
      $110 = (___tre_mem_alloc_impl($0,0,0,0,$109)|0);
      $111 = ($110|0)==(0|0);
      if ($111) {
       $$0173 = 0;
       break L10;
      }
      $112 = ($$2|0)>(0);
      if ($112) {
       $113 = HEAP32[$102>>2]|0;
       $$1194 = 0;
       while(1) {
        $114 = (($113) + ($$1194<<2)|0);
        $115 = HEAP32[$114>>2]|0;
        $116 = (($110) + ($$1194<<2)|0);
        HEAP32[$116>>2] = $115;
        $117 = (($$1194) + 1)|0;
        $exitcond = ($117|0)==($$2|0);
        if ($exitcond) {
         $$1$lcssa = $$2;
         break;
        } else {
         $$1194 = $117;
        }
       }
      } else {
       $$1$lcssa = 0;
      }
      $118 = (($110) + ($$1$lcssa<<2)|0);
      HEAP32[$118>>2] = -1;
      $$sink5 = $110;
     }
     $119 = (((($21) + ($86<<5)|0)) + 12|0);
     HEAP32[$119>>2] = $$sink5;
     $120 = (($$1178195) + 1)|0;
     $121 = (($2) + ($120<<5)|0);
     $122 = HEAP32[$121>>2]|0;
     $123 = ($122|0)>(-1);
     $124 = (($120) + ($$1180$lcssa))|0;
     $125 = (($21) + ($124<<5)|0);
     if ($123) {
      $$1178195 = $120;$81 = $122;$82 = $125;$86 = $124;
     } else {
      $$lcssa189 = $125;
      break;
     }
    }
   } else {
    $$lcssa189 = $28;
   }
   HEAP32[$$lcssa189>>2] = -1;
   $$0173 = $21;
  }
 } while(0);
 return ($$0173|0);
}
function _tre_match_empty($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0$lcssa = 0, $$062 = 0, $$sink = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0;
 var $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0;
 var $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $7 = 0, $8 = 0, $9 = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 $5 = (_tre_stack_num_objects($0)|0);
 $6 = ($4|0)!=(0|0);
 if ($6) {
  HEAP32[$4>>2] = 0;
 }
 $7 = (_tre_stack_push_voidptr($0,$1)|0);
 $8 = ($7|0)==(0);
 L4: do {
  if ($8) {
   $9 = ($2|0)==(0|0);
   $10 = ($3|0)==(0|0);
   $11 = (_tre_stack_num_objects($0)|0);
   $12 = ($11|0)>($5|0);
   if ($12) {
    while(1) {
     $13 = (_tre_stack_pop_voidptr($0)|0);
     $14 = HEAP32[$13>>2]|0;
     L8: do {
      switch ($14|0) {
      case 0:  {
       $19 = ((($13)) + 4|0);
       $20 = HEAP32[$19>>2]|0;
       $21 = HEAP32[$20>>2]|0;
       switch ($21|0) {
       case -3:  {
        break;
       }
       case -2:  {
        if ($10) {
         break L8;
        }
        $34 = ((($20)) + 4|0);
        $35 = HEAP32[$34>>2]|0;
        $36 = HEAP32[$3>>2]|0;
        $37 = $36 | $35;
        HEAP32[$3>>2] = $37;
        break L8;
        break;
       }
       default: {
        break L8;
       }
       }
       $22 = ((($20)) + 4|0);
       $23 = HEAP32[$22>>2]|0;
       $24 = ($23|0)>(-1);
       if ($24) {
        L15: do {
         if (!($9)) {
          $$062 = 0;
          while(1) {
           $25 = (($2) + ($$062<<2)|0);
           $26 = HEAP32[$25>>2]|0;
           $27 = ($26|0)>(-1);
           if (!($27)) {
            break;
           }
           $28 = ($26|0)==($23|0);
           $29 = (($$062) + 1)|0;
           if ($28) {
            break L15;
           } else {
            $$062 = $29;
           }
          }
          $30 = (($$062) + 1)|0;
          $31 = (($2) + ($30<<2)|0);
          HEAP32[$25>>2] = $23;
          HEAP32[$31>>2] = -1;
         }
        } while(0);
        if ($6) {
         $32 = HEAP32[$4>>2]|0;
         $33 = (($32) + 1)|0;
         HEAP32[$4>>2] = $33;
        }
       }
       break;
      }
      case 3:  {
       $38 = ((($13)) + 4|0);
       $39 = HEAP32[$38>>2]|0;
       $40 = HEAP32[$39>>2]|0;
       $41 = ((($40)) + 8|0);
       $42 = HEAP32[$41>>2]|0;
       $43 = ($42|0)==(0);
       if (!($43)) {
        $$sink = $40;
        label = 6;
        break L8;
       }
       $44 = ((($39)) + 4|0);
       $45 = HEAP32[$44>>2]|0;
       $46 = ((($45)) + 8|0);
       $47 = HEAP32[$46>>2]|0;
       $48 = ($47|0)==(0);
       if (!($48)) {
        $$sink = $45;
        label = 6;
       }
       break;
      }
      case 1:  {
       $49 = ((($13)) + 4|0);
       $50 = HEAP32[$49>>2]|0;
       $51 = HEAP32[$50>>2]|0;
       $52 = (_tre_stack_push_voidptr($0,$51)|0);
       $53 = ($52|0)==(0);
       if (!($53)) {
        $$0$lcssa = $52;
        break L4;
       }
       $54 = ((($50)) + 4|0);
       $55 = HEAP32[$54>>2]|0;
       $$sink = $55;
       label = 6;
       break;
      }
      case 2:  {
       $56 = ((($13)) + 4|0);
       $57 = HEAP32[$56>>2]|0;
       $58 = HEAP32[$57>>2]|0;
       $59 = ((($58)) + 8|0);
       $60 = HEAP32[$59>>2]|0;
       $61 = ($60|0)==(0);
       if (!($61)) {
        $$sink = $58;
        label = 6;
       }
       break;
      }
      default: {
      }
      }
     } while(0);
     if ((label|0) == 6) {
      label = 0;
      $15 = (_tre_stack_push_voidptr($0,$$sink)|0);
      $16 = ($15|0)==(0);
      if (!($16)) {
       $$0$lcssa = $15;
       break L4;
      }
     }
     $17 = (_tre_stack_num_objects($0)|0);
     $18 = ($17|0)>($5|0);
     if (!($18)) {
      $$0$lcssa = 0;
      break L4;
     }
    }
   } else {
    $$0$lcssa = 0;
   }
  } else {
   $$0$lcssa = $7;
  }
 } while(0);
 return ($$0$lcssa|0);
}
function ___tre_mem_alloc_impl($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$ = 0, $$3 = 0, $$55 = 0, $$phi$trans$insert = 0, $$pre = 0, $$pre$phiZ2D = 0, $$pre60$pre$phiZZ2D = 0, $$sink = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0;
 var $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $5 = 0;
 var $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = ((($0)) + 16|0);
 $6 = HEAP32[$5>>2]|0;
 $7 = ($6|0)==(0);
 L1: do {
  if ($7) {
   $8 = ((($0)) + 12|0);
   $9 = HEAP32[$8>>2]|0;
   $10 = ($9>>>0)<($4>>>0);
   if ($10) {
    $11 = ($1|0)==(0);
    do {
     if ($11) {
      $14 = $4 << 3;
      $15 = ($14>>>0)>(1024);
      $$ = $15 ? $14 : 1024;
      $16 = (_malloc(8)|0);
      $17 = ($16|0)==(0|0);
      if ($17) {
       HEAP32[$5>>2] = 1;
       $$3 = 0;
       break L1;
      }
      $18 = (_malloc($$)|0);
      HEAP32[$16>>2] = $18;
      $19 = ($18|0)==(0|0);
      $20 = $18;
      if ($19) {
       _free($16);
       HEAP32[$5>>2] = 1;
       $$3 = 0;
       break L1;
      }
      $21 = ((($16)) + 4|0);
      HEAP32[$21>>2] = 0;
      $22 = ((($0)) + 4|0);
      $23 = HEAP32[$22>>2]|0;
      $24 = ($23|0)==(0|0);
      if (!($24)) {
       $25 = ((($23)) + 4|0);
       HEAP32[$25>>2] = $16;
      }
      $26 = HEAP32[$0>>2]|0;
      $27 = ($26|0)==(0|0);
      if ($27) {
       HEAP32[$0>>2] = $16;
      }
      HEAP32[$22>>2] = $16;
      $28 = ((($0)) + 8|0);
      HEAP32[$28>>2] = $20;
      $$pre60$pre$phiZZ2D = $28;$$sink = $$;$40 = $18;
     } else {
      $12 = ($2|0)==(0|0);
      if ($12) {
       HEAP32[$5>>2] = 1;
       $$3 = 0;
       break L1;
      } else {
       $13 = ((($0)) + 8|0);
       HEAP32[$13>>2] = $2;
       $$pre60$pre$phiZZ2D = $13;$$sink = 1024;$40 = $2;
       break;
      }
     }
    } while(0);
    HEAP32[$8>>2] = $$sink;
    $$pre$phiZ2D = $$pre60$pre$phiZZ2D;$29 = $40;$38 = $$sink;
   } else {
    $$phi$trans$insert = ((($0)) + 8|0);
    $$pre = HEAP32[$$phi$trans$insert>>2]|0;
    $$pre$phiZ2D = $$phi$trans$insert;$29 = $$pre;$38 = $9;
   }
   $30 = $29;
   $31 = (($30) + ($4))|0;
   $32 = $31 & 3;
   $33 = ($32|0)==(0);
   $34 = (4 - ($32))|0;
   $$55 = $33 ? 0 : $34;
   $35 = (($$55) + ($4))|0;
   $36 = (($29) + ($35)|0);
   HEAP32[$$pre$phiZ2D>>2] = $36;
   $37 = (($38) - ($35))|0;
   HEAP32[$8>>2] = $37;
   $39 = ($3|0)==(0);
   if ($39) {
    $$3 = $29;
   } else {
    _memset(($29|0),0,($35|0))|0;
    $$3 = $29;
   }
  } else {
   $$3 = 0;
  }
 } while(0);
 return ($$3|0);
}
function _tre_stack_push($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$1 = 0, $$byval_copy = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $3 = 0, $4 = 0;
 var $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $$byval_copy = sp;
 $2 = ((($0)) + 12|0);
 $3 = HEAP32[$2>>2]|0;
 $4 = HEAP32[$0>>2]|0;
 $5 = ($3|0)<($4|0);
 if ($5) {
  $6 = ((($0)) + 16|0);
  $7 = HEAP32[$6>>2]|0;
  $8 = (($7) + ($3<<2)|0);
  $9 = HEAP32[$1>>2]|0;
  HEAP32[$8>>2] = $9;
  $10 = HEAP32[$2>>2]|0;
  $11 = (($10) + 1)|0;
  HEAP32[$2>>2] = $11;
  $$1 = 0;
 } else {
  $12 = ((($0)) + 4|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ($4|0)<($13|0);
  if ($14) {
   $15 = ((($0)) + 8|0);
   $16 = HEAP32[$15>>2]|0;
   $17 = (($16) + ($4))|0;
   $18 = ($17|0)>($13|0);
   $$ = $18 ? $13 : $17;
   $19 = ((($0)) + 16|0);
   $20 = HEAP32[$19>>2]|0;
   $21 = $$ << 2;
   $22 = (_realloc($20,$21)|0);
   $23 = ($22|0)==(0|0);
   if ($23) {
    $$1 = 12;
   } else {
    HEAP32[$0>>2] = $$;
    HEAP32[$19>>2] = $22;
    ;HEAP32[$$byval_copy>>2]=HEAP32[$1>>2]|0;
    (_tre_stack_push($0,$$byval_copy)|0);
    $$1 = 0;
   }
  } else {
   $$1 = 12;
  }
 }
 STACKTOP = sp;return ($$1|0);
}
function _tre_ast_new_node($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (___tre_mem_alloc_impl($0,0,0,1,32)|0);
 $4 = ($3|0)!=(0|0);
 $5 = ($2|0)!=(0|0);
 $or$cond = $5 & $4;
 if ($or$cond) {
  $6 = ((($3)) + 4|0);
  HEAP32[$6>>2] = $2;
  HEAP32[$3>>2] = $1;
  $7 = ((($3)) + 8|0);
  HEAP32[$7>>2] = -1;
  $8 = ((($3)) + 12|0);
  HEAP32[$8>>2] = -1;
  $$0 = $3;
 } else {
  $$0 = 0;
 }
 return ($$0|0);
}
function _tre_copy_ast($0,$1,$2,$3,$4,$5,$6,$7) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 $6 = $6|0;
 $7 = $7|0;
 var $$0146$ph$ph = 0, $$0151$ph$ph = 0, $$0155$ph$be = 0, $$0155$ph$ph = 0, $$0155$ph194 = 0, $$0162 = 0, $$0163 = 0, $$0164 = 0, $$1 = 0, $$1147 = 0, $$1152 = 0, $$3149 = 0, $$3154 = 0, $$4150 = 0, $$5160 = 0, $$6 = 0, $$7 = 0, $$not = 0, $$old2 = 0, $10 = 0;
 var $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0;
 var $119 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0;
 var $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $50 = 0;
 var $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $70 = 0;
 var $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0;
 var $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $or$cond = 0, $or$cond165 = 0, $or$cond167 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $8 = (_tre_stack_num_objects($1)|0);
 (_tre_stack_push_voidptr($1,$2)|0);
 $9 = (_tre_stack_push_int($1,0)|0);
 $$old2 = ($9|0)==(0);
 L1: do {
  if ($$old2) {
   $10 = $3 & 1;
   $11 = ($10|0)==(0);
   $12 = $3 & 2;
   $13 = ($12|0)!=(0);
   $$0146$ph$ph = 0;$$0151$ph$ph = 1;$$0155$ph$ph = $6;
   while(1) {
    $14 = (_tre_stack_num_objects($1)|0);
    $15 = ($14|0)>($8|0);
    if ($15) {
     $$0155$ph194 = $$0155$ph$ph;
    } else {
     $$4150 = $$0146$ph$ph;$$7 = 0;
     break L1;
    }
    L5: while(1) {
     L7: while(1) {
      $16 = (_tre_stack_pop_int($1)|0);
      switch ($16|0) {
      case 1:  {
       label = 7;
       break L7;
       break;
      }
      case 0:  {
       $20 = (_tre_stack_pop_voidptr($1)|0);
       $21 = HEAP32[$20>>2]|0;
       switch ($21|0) {
       case 0:  {
        label = 9;
        break L5;
        break;
       }
       case 3:  {
        label = 19;
        break L5;
        break;
       }
       case 1:  {
        label = 26;
        break L5;
        break;
       }
       case 2:  {
        label = 33;
        break L7;
        break;
       }
       default: {
       }
       }
       break;
      }
      default: {
      }
      }
      $17 = (_tre_stack_num_objects($1)|0);
      $18 = ($17|0)>($8|0);
      if (!($18)) {
       $$4150 = $$0146$ph$ph;$$7 = 0;
       break L1;
      }
     }
     if ((label|0) == 7) {
      label = 0;
      $19 = (_tre_stack_pop_voidptr($1)|0);
      $$0155$ph$be = $19;
     }
     else if ((label|0) == 33) {
      label = 0;
      $95 = ((($20)) + 4|0);
      $96 = HEAP32[$95>>2]|0;
      $97 = HEAP32[$96>>2]|0;
      $98 = (_tre_stack_push_voidptr($1,$97)|0);
      $99 = ($98|0)==(0);
      if (!($99)) {
       $$4150 = $$0146$ph$ph;$$7 = $98;
       break L1;
      }
      $100 = (_tre_stack_push_int($1,0)|0);
      $101 = ($100|0)==(0);
      if (!($101)) {
       $$4150 = $$0146$ph$ph;$$7 = $100;
       break L1;
      }
      $102 = HEAP32[$96>>2]|0;
      $103 = ((($96)) + 4|0);
      $104 = HEAP32[$103>>2]|0;
      $105 = ((($96)) + 8|0);
      $106 = HEAP32[$105>>2]|0;
      $107 = ((($96)) + 12|0);
      $108 = HEAP8[$107>>0]|0;
      $109 = $108 & 1;
      $110 = $109&255;
      $111 = (_tre_ast_new_iter($0,$102,$104,$106,$110)|0);
      HEAP32[$$0155$ph194>>2] = $111;
      $112 = ($111|0)==(0|0);
      if ($112) {
       $$4150 = $$0146$ph$ph;$$7 = 12;
       break L1;
      }
      $113 = ((($111)) + 4|0);
      $114 = HEAP32[$113>>2]|0;
      $$0155$ph$be = $114;
     }
     $115 = (_tre_stack_num_objects($1)|0);
     $116 = ($115|0)>($8|0);
     if ($116) {
      $$0155$ph194 = $$0155$ph$be;
     } else {
      $$4150 = $$0146$ph$ph;$$7 = 0;
      break L1;
     }
    }
    if ((label|0) == 9) {
     label = 0;
     $22 = ((($20)) + 4|0);
     $23 = HEAP32[$22>>2]|0;
     $24 = ((($23)) + 8|0);
     $25 = HEAP32[$24>>2]|0;
     $26 = HEAP32[$23>>2]|0;
     $27 = ((($23)) + 4|0);
     $28 = HEAP32[$27>>2]|0;
     $29 = ($26|0)>(-1);
     $30 = ($26|0)==(-4);
     $or$cond165 = $29 | $30;
     if ($or$cond165) {
      $31 = HEAP32[$4>>2]|0;
      $32 = (($31) + ($25))|0;
      $33 = (($$0146$ph$ph) + 1)|0;
      $$0162 = $28;$$0163 = $26;$$0164 = $32;$$1147 = $33;$$1152 = $$0151$ph$ph;
     } else {
      $34 = ($26|0)==(-3);
      $$not = $34 ^ 1;
      $or$cond167 = $11 | $$not;
      if ($or$cond167) {
       if ($34) {
        $35 = ($$0151$ph$ph|0)!=(0);
        $or$cond = $13 & $35;
        if ($or$cond) {
         $36 = (($5) + ($28<<2)|0);
         HEAP32[$36>>2] = 1;
         $$0162 = $28;$$0163 = -3;$$0164 = $25;$$1147 = $$0146$ph$ph;$$1152 = 0;
        } else {
         $$0162 = $28;$$0163 = -3;$$0164 = $25;$$1147 = $$0146$ph$ph;$$1152 = $$0151$ph$ph;
        }
       } else {
        $$0162 = $28;$$0163 = $26;$$0164 = $25;$$1147 = $$0146$ph$ph;$$1152 = $$0151$ph$ph;
       }
      } else {
       $$0162 = -1;$$0163 = -1;$$0164 = -1;$$1147 = $$0146$ph$ph;$$1152 = $$0151$ph$ph;
      }
     }
     $37 = (_tre_ast_new_literal($0,$$0163,$$0162,$$0164)|0);
     HEAP32[$$0155$ph194>>2] = $37;
     $38 = ($37|0)==(0|0);
     if ($38) {
      $$1 = 12;
     } else {
      $39 = ((($37)) + 4|0);
      $40 = HEAP32[$39>>2]|0;
      $41 = ((($23)) + 12|0);
      $42 = HEAP32[$41>>2]|0;
      $43 = ((($40)) + 12|0);
      HEAP32[$43>>2] = $42;
      $44 = ((($23)) + 16|0);
      $45 = HEAP32[$44>>2]|0;
      $46 = ((($40)) + 16|0);
      HEAP32[$46>>2] = $45;
      $$1 = 0;
     }
     $47 = HEAP32[$7>>2]|0;
     $48 = ($$0164|0)>($47|0);
     if ($48) {
      HEAP32[$7>>2] = $$0164;
      $$3149 = $$1147;$$3154 = $$1152;$$5160 = $$0155$ph194;$$6 = $$1;
     } else {
      $$3149 = $$1147;$$3154 = $$1152;$$5160 = $$0155$ph194;$$6 = $$1;
     }
    }
    else if ((label|0) == 19) {
     label = 0;
     $49 = ((($20)) + 4|0);
     $50 = HEAP32[$49>>2]|0;
     $51 = HEAP32[$50>>2]|0;
     $52 = ((($50)) + 4|0);
     $53 = HEAP32[$52>>2]|0;
     $54 = (_tre_ast_new_union($0,$51,$53)|0);
     HEAP32[$$0155$ph194>>2] = $54;
     $55 = ($54|0)==(0|0);
     if ($55) {
      $$4150 = $$0146$ph$ph;$$7 = 12;
      break L1;
     }
     $56 = ((($54)) + 4|0);
     $57 = HEAP32[$56>>2]|0;
     $58 = HEAP32[$52>>2]|0;
     $59 = (_tre_stack_push_voidptr($1,$58)|0);
     $60 = ($59|0)==(0);
     if (!($60)) {
      $$4150 = $$0146$ph$ph;$$7 = $59;
      break L1;
     }
     $61 = (_tre_stack_push_int($1,0)|0);
     $62 = ($61|0)==(0);
     if (!($62)) {
      $$4150 = $$0146$ph$ph;$$7 = $61;
      break L1;
     }
     $63 = ((($57)) + 4|0);
     $64 = (_tre_stack_push_voidptr($1,$63)|0);
     $65 = ($64|0)==(0);
     if (!($65)) {
      $$4150 = $$0146$ph$ph;$$7 = $64;
      break L1;
     }
     $66 = (_tre_stack_push_int($1,1)|0);
     $67 = ($66|0)==(0);
     if (!($67)) {
      $$4150 = $$0146$ph$ph;$$7 = $66;
      break L1;
     }
     $68 = HEAP32[$50>>2]|0;
     $69 = (_tre_stack_push_voidptr($1,$68)|0);
     $70 = ($69|0)==(0);
     if (!($70)) {
      $$4150 = $$0146$ph$ph;$$7 = $69;
      break L1;
     }
     $71 = (_tre_stack_push_int($1,0)|0);
     $$3149 = $$0146$ph$ph;$$3154 = $$0151$ph$ph;$$5160 = $57;$$6 = $71;
    }
    else if ((label|0) == 26) {
     label = 0;
     $72 = ((($20)) + 4|0);
     $73 = HEAP32[$72>>2]|0;
     $74 = HEAP32[$73>>2]|0;
     $75 = ((($73)) + 4|0);
     $76 = HEAP32[$75>>2]|0;
     $77 = (_tre_ast_new_catenation($0,$74,$76)|0);
     HEAP32[$$0155$ph194>>2] = $77;
     $78 = ($77|0)==(0|0);
     if ($78) {
      $$4150 = $$0146$ph$ph;$$7 = 12;
      break L1;
     }
     $79 = ((($77)) + 4|0);
     $80 = HEAP32[$79>>2]|0;
     HEAP32[$80>>2] = 0;
     $81 = ((($80)) + 4|0);
     HEAP32[$81>>2] = 0;
     $82 = HEAP32[$75>>2]|0;
     $83 = (_tre_stack_push_voidptr($1,$82)|0);
     $84 = ($83|0)==(0);
     if (!($84)) {
      $$4150 = $$0146$ph$ph;$$7 = $83;
      break L1;
     }
     $85 = (_tre_stack_push_int($1,0)|0);
     $86 = ($85|0)==(0);
     if (!($86)) {
      $$4150 = $$0146$ph$ph;$$7 = $85;
      break L1;
     }
     $87 = (_tre_stack_push_voidptr($1,$81)|0);
     $88 = ($87|0)==(0);
     if (!($88)) {
      $$4150 = $$0146$ph$ph;$$7 = $87;
      break L1;
     }
     $89 = (_tre_stack_push_int($1,1)|0);
     $90 = ($89|0)==(0);
     if (!($90)) {
      $$4150 = $$0146$ph$ph;$$7 = $89;
      break L1;
     }
     $91 = HEAP32[$73>>2]|0;
     $92 = (_tre_stack_push_voidptr($1,$91)|0);
     $93 = ($92|0)==(0);
     if (!($93)) {
      $$4150 = $$0146$ph$ph;$$7 = $92;
      break L1;
     }
     $94 = (_tre_stack_push_int($1,0)|0);
     $$3149 = $$0146$ph$ph;$$3154 = $$0151$ph$ph;$$5160 = $80;$$6 = $94;
    }
    $117 = ($$6|0)==(0);
    if ($117) {
     $$0146$ph$ph = $$3149;$$0151$ph$ph = $$3154;$$0155$ph$ph = $$5160;
    } else {
     $$4150 = $$3149;$$7 = $$6;
     break;
    }
   }
  } else {
   $$4150 = 0;$$7 = $9;
  }
 } while(0);
 $118 = HEAP32[$4>>2]|0;
 $119 = (($118) + ($$4150))|0;
 HEAP32[$4>>2] = $119;
 return ($$7|0);
}
function _tre_ast_new_iter($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $5 = (___tre_mem_alloc_impl($0,0,0,1,16)|0);
 $6 = (_tre_ast_new_node($0,2,$5)|0);
 $7 = ($6|0)==(0|0);
 if ($7) {
  $$0 = 0;
 } else {
  HEAP32[$5>>2] = $1;
  $8 = ((($5)) + 4|0);
  HEAP32[$8>>2] = $2;
  $9 = ((($5)) + 8|0);
  HEAP32[$9>>2] = $3;
  $10 = ((($5)) + 12|0);
  $11 = $4&255;
  $12 = HEAP8[$10>>0]|0;
  $13 = $11 & 1;
  $14 = $12 & -2;
  $15 = $14 | $13;
  HEAP8[$10>>0] = $15;
  $16 = ((($1)) + 16|0);
  $17 = HEAP32[$16>>2]|0;
  $18 = ((($6)) + 16|0);
  HEAP32[$18>>2] = $17;
  $$0 = $6;
 }
 return ($$0|0);
}
function _tre_ast_new_union($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1|0)==(0|0);
 if ($3) {
  $$0 = $2;
 } else {
  $4 = (___tre_mem_alloc_impl($0,0,0,1,8)|0);
  $5 = (_tre_ast_new_node($0,3,$4)|0);
  $6 = ($5|0)!=(0|0);
  $7 = ($2|0)!=(0|0);
  $or$cond = $7 & $6;
  if ($or$cond) {
   HEAP32[$4>>2] = $1;
   $8 = ((($4)) + 4|0);
   HEAP32[$8>>2] = $2;
   $9 = ((($1)) + 16|0);
   $10 = HEAP32[$9>>2]|0;
   $11 = ((($2)) + 16|0);
   $12 = HEAP32[$11>>2]|0;
   $13 = (($12) + ($10))|0;
   $14 = ((($5)) + 16|0);
   HEAP32[$14>>2] = $13;
   $$0 = $5;
  } else {
   $$0 = 0;
  }
 }
 return ($$0|0);
}
function _tre_add_tag_left($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (___tre_mem_alloc_impl($0,0,0,0,8)|0);
 $4 = ($3|0)==(0|0);
 if ($4) {
  $$0 = 12;
 } else {
  $5 = (_tre_ast_new_literal($0,-3,$2,-1)|0);
  HEAP32[$3>>2] = $5;
  $6 = ($5|0)==(0|0);
  if ($6) {
   $$0 = 12;
  } else {
   $7 = (___tre_mem_alloc_impl($0,0,0,0,32)|0);
   $8 = ((($3)) + 4|0);
   HEAP32[$8>>2] = $7;
   $9 = ($7|0)==(0|0);
   if ($9) {
    $$0 = 12;
   } else {
    $10 = ((($1)) + 4|0);
    $11 = HEAP32[$10>>2]|0;
    $12 = ((($7)) + 4|0);
    HEAP32[$12>>2] = $11;
    $13 = HEAP32[$1>>2]|0;
    HEAP32[$7>>2] = $13;
    $14 = ((($7)) + 8|0);
    HEAP32[$14>>2] = -1;
    $15 = ((($7)) + 12|0);
    HEAP32[$15>>2] = -1;
    $16 = ((($7)) + 16|0);
    ;HEAP32[$16>>2]=0|0;HEAP32[$16+4>>2]=0|0;HEAP32[$16+8>>2]=0|0;HEAP32[$16+12>>2]=0|0;
    HEAP32[$10>>2] = $3;
    HEAP32[$1>>2] = 1;
    $$0 = 0;
   }
  }
 }
 return ($$0|0);
}
function _tre_purge_regset($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$016 = 0, $$sink = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = ($3|0)>(-1);
 if ($4) {
  $5 = ((($1)) + 16|0);
  $6 = HEAP32[$5>>2]|0;
  $$016 = 0;$8 = $3;
  while(1) {
   $7 = $8 >>> 1;
   $9 = $8 & 1;
   $10 = ($9|0)==(0);
   $11 = (((($6) + (($7*12)|0)|0)) + 4|0);
   $12 = (($6) + (($7*12)|0)|0);
   $$sink = $10 ? $12 : $11;
   HEAP32[$$sink>>2] = $2;
   $13 = (($$016) + 1)|0;
   $14 = (($0) + ($13<<2)|0);
   $15 = HEAP32[$14>>2]|0;
   $16 = ($15|0)>(-1);
   if ($16) {
    $$016 = $13;$8 = $15;
   } else {
    break;
   }
  }
 }
 HEAP32[$0>>2] = -1;
 return;
}
function _tre_add_tag_right($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = (___tre_mem_alloc_impl($0,0,0,0,8)|0);
 $4 = ($3|0)==(0|0);
 if ($4) {
  $$0 = 12;
 } else {
  $5 = (_tre_ast_new_literal($0,-3,$2,-1)|0);
  $6 = ((($3)) + 4|0);
  HEAP32[$6>>2] = $5;
  $7 = ($5|0)==(0|0);
  if ($7) {
   $$0 = 12;
  } else {
   $8 = (___tre_mem_alloc_impl($0,0,0,0,32)|0);
   HEAP32[$3>>2] = $8;
   $9 = ($8|0)==(0|0);
   if ($9) {
    $$0 = 12;
   } else {
    $10 = ((($1)) + 4|0);
    $11 = HEAP32[$10>>2]|0;
    $12 = ((($8)) + 4|0);
    HEAP32[$12>>2] = $11;
    $13 = HEAP32[$1>>2]|0;
    HEAP32[$8>>2] = $13;
    $14 = ((($8)) + 8|0);
    HEAP32[$14>>2] = -1;
    $15 = ((($8)) + 12|0);
    HEAP32[$15>>2] = -1;
    $16 = ((($8)) + 16|0);
    ;HEAP32[$16>>2]=0|0;HEAP32[$16+4>>2]=0|0;HEAP32[$16+8>>2]=0|0;HEAP32[$16+12>>2]=0|0;
    HEAP32[$10>>2] = $3;
    HEAP32[$1>>2] = 1;
    $$0 = 0;
   }
  }
 }
 return ($$0|0);
}
function _parse_atom($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$0 = 0, $$0125 = 0, $$0130$lcssa = 0, $$0130139 = 0, $$0131$lcssa = 0, $$0131138 = 0, $$1 = 0, $$132 = 0, $$135 = 0, $$2 = 0, $$2127 = 0, $$3 = 0, $$4 = 0, $$4129 = 0, $$5 = 0, $$pre$phiZ2D = 0, $10 = 0, $100 = 0, $101 = 0;
 var $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0;
 var $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0;
 var $139 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0;
 var $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0;
 var $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0;
 var $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0, $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0;
 var $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0, $98 = 0, $99 = 0, $cond = 0, $cond136 = 0, $cond137 = 0, $or$cond = 0, $or$cond134 = 0;
 var $or$cond3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $2 = sp;
 $3 = ((($0)) + 32|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = $4 & 1;
 $6 = HEAP8[$1>>0]|0;
 $7 = $6 << 24 >> 24;
 L1: do {
  switch ($7|0) {
  case 91:  {
   $8 = ((($1)) + 1|0);
   $9 = (_parse_bracket($0,$8)|0);
   $$0 = $9;
   break;
  }
  case 92:  {
   $10 = ((($1)) + 1|0);
   $11 = (_tre_expand_macro($10)|0);
   $12 = ($11|0)==(0|0);
   if (!($12)) {
    $13 = (_parse_atom($0,$11)|0);
    $14 = ((($1)) + 2|0);
    $15 = ((($0)) + 12|0);
    HEAP32[$15>>2] = $14;
    $$0 = $13;
    break L1;
   }
   $16 = HEAP8[$10>>0]|0;
   $17 = $16 << 24 >> 24;
   switch ($17|0) {
   case 0:  {
    $$0 = 5;
    break L1;
    break;
   }
   case 98:  {
    $18 = HEAP32[$0>>2]|0;
    $19 = (_tre_ast_new_literal($18,-2,64,-1)|0);
    $$0125 = $19;$$2 = $10;
    break;
   }
   case 66:  {
    $20 = HEAP32[$0>>2]|0;
    $21 = (_tre_ast_new_literal($20,-2,128,-1)|0);
    $$0125 = $21;$$2 = $10;
    break;
   }
   case 60:  {
    $22 = HEAP32[$0>>2]|0;
    $23 = (_tre_ast_new_literal($22,-2,16,-1)|0);
    $$0125 = $23;$$2 = $10;
    break;
   }
   case 62:  {
    $24 = HEAP32[$0>>2]|0;
    $25 = (_tre_ast_new_literal($24,-2,32,-1)|0);
    $$0125 = $25;$$2 = $10;
    break;
   }
   case 120:  {
    $26 = ((($1)) + 2|0);
    $27 = HEAP8[$26>>0]|0;
    $28 = ($27<<24>>24)==(123);
    $29 = ((($1)) + 3|0);
    $$ = $28 ? 8 : 2;
    $$132 = $28 ? $29 : $26;
    $$0130139 = 0;$$0131138 = 0;
    while(1) {
     $30 = (($$132) + ($$0130139)|0);
     $31 = HEAP8[$30>>0]|0;
     $32 = $31 << 24 >> 24;
     $33 = (_hexval_525($32)|0);
     $34 = ($33|0)<(0);
     if ($34) {
      $$0130$lcssa = $$0130139;$$0131$lcssa = $$0131138;
      break;
     }
     $35 = $$0131138 << 4;
     $36 = (($33) + ($35))|0;
     $37 = (($$0130139) + 1)|0;
     $38 = ($37|0)<($$|0);
     $39 = ($36|0)<(1114112);
     $40 = $39 & $38;
     if ($40) {
      $$0130139 = $37;$$0131138 = $36;
     } else {
      $$0130$lcssa = $37;$$0131$lcssa = $36;
      break;
     }
    }
    $41 = (($$132) + ($$0130$lcssa)|0);
    if ($28) {
     $42 = HEAP8[$41>>0]|0;
     $43 = ($42<<24>>24)==(125);
     if (!($43)) {
      $$0 = 9;
      break L1;
     }
     $44 = ((($41)) + 1|0);
     $$1 = $44;
    } else {
     $$1 = $41;
    }
    $45 = HEAP32[$0>>2]|0;
    $46 = ((($0)) + 24|0);
    $47 = HEAP32[$46>>2]|0;
    $48 = (($47) + 1)|0;
    HEAP32[$46>>2] = $48;
    $49 = (_tre_ast_new_literal($45,$$0131$lcssa,$$0131$lcssa,$47)|0);
    $50 = ((($$1)) + -1|0);
    $$0125 = $49;$$2 = $50;
    break;
   }
   case 63: case 43: case 123:  {
    $cond = ($5|0)==(0);
    if ($cond) {
     $$0 = 13;
     break L1;
    } else {
     $$3 = $10;
     label = 37;
     break L1;
    }
    break;
   }
   case 124:  {
    $cond136 = ($5|0)==(0);
    if (!($cond136)) {
     $$3 = $10;
     label = 37;
     break L1;
    }
    $51 = HEAP32[$0>>2]|0;
    $52 = (_tre_ast_new_literal($51,-1,-1,-1)|0);
    $$4 = $1;$$5 = $52;
    label = 45;
    break L1;
    break;
   }
   default: {
    $53 = ($5|0)==(0);
    $54 = (($17) + -49)|0;
    $55 = ($54>>>0)<(9);
    $or$cond134 = $53 & $55;
    if (!($or$cond134)) {
     $$3 = $10;
     label = 37;
     break L1;
    }
    $56 = (($17) + -48)|0;
    $57 = HEAP32[$0>>2]|0;
    $58 = ((($0)) + 24|0);
    $59 = HEAP32[$58>>2]|0;
    $60 = (($59) + 1)|0;
    HEAP32[$58>>2] = $60;
    $61 = (_tre_ast_new_literal($57,-4,$56,$59)|0);
    $62 = ((($0)) + 28|0);
    $63 = HEAP32[$62>>2]|0;
    $64 = ($56|0)<($63|0);
    $$135 = $64 ? $63 : $56;
    HEAP32[$62>>2] = $$135;
    $$0125 = $61;$$2 = $10;
   }
   }
   $65 = ((($$2)) + 1|0);
   $$4 = $65;$$5 = $$0125;
   label = 45;
   break;
  }
  case 46:  {
   $66 = $4 & 4;
   $67 = ($66|0)==(0);
   $68 = ((($0)) + 24|0);
   $69 = HEAP32[$68>>2]|0;
   $70 = (($69) + 1)|0;
   HEAP32[$68>>2] = $70;
   $71 = HEAP32[$0>>2]|0;
   if ($67) {
    $81 = (_tre_ast_new_literal($71,0,1114111,$69)|0);
    $$2127 = $81;
   } else {
    $72 = (_tre_ast_new_literal($71,0,9,$69)|0);
    $73 = HEAP32[$0>>2]|0;
    $74 = HEAP32[$68>>2]|0;
    $75 = (($74) + 1)|0;
    HEAP32[$68>>2] = $75;
    $76 = (_tre_ast_new_literal($73,11,1114111,$74)|0);
    $77 = ($72|0)!=(0|0);
    $78 = ($76|0)!=(0|0);
    $or$cond = $77 & $78;
    if ($or$cond) {
     $79 = HEAP32[$0>>2]|0;
     $80 = (_tre_ast_new_union($79,$72,$76)|0);
     $$2127 = $80;
    } else {
     $$2127 = 0;
    }
   }
   $82 = ((($1)) + 1|0);
   $$4 = $82;$$5 = $$2127;
   label = 45;
   break;
  }
  case 94:  {
   $83 = ($5|0)==(0);
   if ($83) {
    $84 = ((($0)) + 16|0);
    $85 = HEAP32[$84>>2]|0;
    $86 = ($85|0)==($1|0);
    if (!($86)) {
     $$3 = $1;
     label = 37;
     break L1;
    }
   }
   $87 = HEAP32[$0>>2]|0;
   $88 = (_tre_ast_new_literal($87,-2,1,-1)|0);
   $89 = ((($1)) + 1|0);
   $$4 = $89;$$5 = $88;
   label = 45;
   break;
  }
  case 36:  {
   $90 = ($5|0)==(0);
   $91 = ((($1)) + 1|0);
   if ($90) {
    $92 = HEAP8[$91>>0]|0;
    $93 = ($92<<24>>24)==(0);
    if (!($93)) {
     $$3 = $1;
     label = 37;
     break L1;
    }
   }
   $94 = HEAP32[$0>>2]|0;
   $95 = (_tre_ast_new_literal($94,-2,2,-1)|0);
   $$4 = $91;$$5 = $95;
   label = 45;
   break;
  }
  case 63: case 43: case 123: case 42:  {
   $cond137 = ($5|0)==(0);
   if ($cond137) {
    $$3 = $1;
    label = 37;
   } else {
    $$0 = 13;
   }
   break;
  }
  case 124:  {
   $96 = ($5|0)==(0);
   if ($96) {
    $$3 = $1;
    label = 37;
   } else {
    label = 36;
   }
   break;
  }
  case 0:  {
   label = 36;
   break;
  }
  default: {
   $$3 = $1;
   label = 37;
  }
  }
 } while(0);
 if ((label|0) == 36) {
  $97 = HEAP32[$0>>2]|0;
  $98 = (_tre_ast_new_literal($97,-1,-1,-1)|0);
  $$4 = $1;$$5 = $98;
  label = 45;
 }
 else if ((label|0) == 37) {
  $99 = (_mbtowc($2,$$3,-1)|0);
  $100 = ($99|0)<(0);
  if ($100) {
   $$0 = 2;
  } else {
   $101 = HEAP32[$3>>2]|0;
   $102 = $101 & 2;
   $103 = ($102|0)==(0);
   do {
    if ($103) {
     label = 43;
    } else {
     $104 = HEAP32[$2>>2]|0;
     $105 = (_iswupper($104)|0);
     $106 = ($105|0)==(0);
     if ($106) {
      $107 = HEAP32[$2>>2]|0;
      $108 = (_iswlower($107)|0);
      $109 = ($108|0)==(0);
      if ($109) {
       label = 43;
       break;
      }
     }
     $110 = HEAP32[$0>>2]|0;
     $111 = HEAP32[$2>>2]|0;
     $112 = (_towupper($111)|0);
     $113 = HEAP32[$2>>2]|0;
     $114 = (_towupper($113)|0);
     $115 = ((($0)) + 24|0);
     $116 = HEAP32[$115>>2]|0;
     $117 = (_tre_ast_new_literal($110,$112,$114,$116)|0);
     $118 = HEAP32[$0>>2]|0;
     $119 = HEAP32[$2>>2]|0;
     $120 = (_towlower($119)|0);
     $121 = HEAP32[$2>>2]|0;
     $122 = (_towlower($121)|0);
     $123 = HEAP32[$115>>2]|0;
     $124 = (_tre_ast_new_literal($118,$120,$122,$123)|0);
     $125 = ($117|0)!=(0|0);
     $126 = ($124|0)!=(0|0);
     $or$cond3 = $125 & $126;
     if ($or$cond3) {
      $127 = HEAP32[$0>>2]|0;
      $128 = (_tre_ast_new_union($127,$117,$124)|0);
      $$4129 = $128;$$pre$phiZ2D = $115;
     } else {
      $$4129 = 0;$$pre$phiZ2D = $115;
     }
    }
   } while(0);
   if ((label|0) == 43) {
    $129 = HEAP32[$0>>2]|0;
    $130 = HEAP32[$2>>2]|0;
    $131 = ((($0)) + 24|0);
    $132 = HEAP32[$131>>2]|0;
    $133 = (_tre_ast_new_literal($129,$130,$130,$132)|0);
    $$4129 = $133;$$pre$phiZ2D = $131;
   }
   $134 = HEAP32[$$pre$phiZ2D>>2]|0;
   $135 = (($134) + 1)|0;
   HEAP32[$$pre$phiZ2D>>2] = $135;
   $136 = (($$3) + ($99)|0);
   $$4 = $136;$$5 = $$4129;
   label = 45;
  }
 }
 if ((label|0) == 45) {
  $137 = ($$5|0)==(0|0);
  if ($137) {
   $$0 = 12;
  } else {
   $138 = ((($0)) + 8|0);
   HEAP32[$138>>2] = $$5;
   $139 = ((($0)) + 12|0);
   HEAP32[$139>>2] = $$4;
   $$0 = 0;
  }
 }
 STACKTOP = sp;return ($$0|0);
}
function _parse_dup($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$0 = 0, $$016 = 0, $$1 = 0, $$pre = 0, $$pre17 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0;
 var $25 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, $or$cond3 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $4 = sp + 4|0;
 $5 = sp;
 $6 = (_parse_dup_count($0,$4)|0);
 $7 = HEAP8[$6>>0]|0;
 $8 = ($7<<24>>24)==(44);
 if ($8) {
  $9 = ((($6)) + 1|0);
  $10 = (_parse_dup_count($9,$5)|0);
  $$pre = HEAP32[$5>>2]|0;
  $$pre17 = HEAP32[$4>>2]|0;
  $$016 = $10;$12 = $$pre;$14 = $$pre17;
 } else {
  $11 = HEAP32[$4>>2]|0;
  HEAP32[$5>>2] = $11;
  $$016 = $6;$12 = $11;$14 = $11;
 }
 $13 = ($12|0)<($14|0);
 $15 = ($12|0)>(-1);
 $or$cond = $15 & $13;
 $16 = ($12|0)>(255);
 $or$cond3 = $16 | $or$cond;
 $17 = ($14>>>0)>(255);
 $18 = $17 | $or$cond3;
 do {
  if ($18) {
   $$0 = 0;
  } else {
   $19 = ($1|0)==(0);
   if ($19) {
    $20 = ((($$016)) + 1|0);
    $21 = HEAP8[$$016>>0]|0;
    $22 = ($21<<24>>24)==(92);
    if ($22) {
     $$1 = $20;
    } else {
     $$0 = 0;
     break;
    }
   } else {
    $$1 = $$016;
   }
   $23 = HEAP8[$$1>>0]|0;
   $24 = ($23<<24>>24)==(125);
   if ($24) {
    $25 = ((($$1)) + 1|0);
    HEAP32[$2>>2] = $14;
    HEAP32[$3>>2] = $12;
    $$0 = $25;
   } else {
    $$0 = 0;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$0|0);
}
function _marksub($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$1 = 0, $$119 = 0, $$phi$trans$insert = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0;
 var $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ((($1)) + 12|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($4|0)>(-1);
 if ($5) {
  $6 = HEAP32[$0>>2]|0;
  $7 = (_tre_ast_new_literal($6,-1,-1,-1)|0);
  $8 = ($7|0)==(0|0);
  if ($8) {
   $$1 = 12;
  } else {
   $9 = HEAP32[$0>>2]|0;
   $10 = (_tre_ast_new_catenation($9,$7,$1)|0);
   $11 = ($10|0)==(0|0);
   if ($11) {
    $$1 = 12;
   } else {
    $12 = ((($1)) + 16|0);
    $13 = HEAP32[$12>>2]|0;
    $14 = ((($10)) + 16|0);
    HEAP32[$14>>2] = $13;
    $$119 = $10;$18 = $13;
    label = 6;
   }
  }
 } else {
  $$phi$trans$insert = ((($1)) + 16|0);
  $$pre = HEAP32[$$phi$trans$insert>>2]|0;
  $$119 = $1;$18 = $$pre;
  label = 6;
 }
 if ((label|0) == 6) {
  $15 = ((($$119)) + 12|0);
  HEAP32[$15>>2] = $2;
  $16 = ((($$119)) + 16|0);
  $17 = (($18) + 1)|0;
  HEAP32[$16>>2] = $17;
  $19 = ((($0)) + 8|0);
  HEAP32[$19>>2] = $$119;
  $$1 = 0;
 }
 return ($$1|0);
}
function _parse_dup_count($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$0 = 0, $$012 = 0, $$pre = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $isdigit = 0, $isdigit14 = 0, $isdigittmp = 0, $isdigittmp13 = 0, $or$cond = 0;
 var label = 0, sp = 0;
 sp = STACKTOP;
 HEAP32[$1>>2] = -1;
 $2 = HEAP8[$0>>0]|0;
 $3 = $2 << 24 >> 24;
 $isdigittmp = (($3) + -48)|0;
 $isdigit = ($isdigittmp>>>0)<(10);
 if ($isdigit) {
  HEAP32[$1>>2] = 0;
  $$pre = HEAP8[$0>>0]|0;
  $$012 = $0;$5 = 0;$7 = $$pre;
  while(1) {
   $4 = ($5*10)|0;
   $6 = $7 << 24 >> 24;
   $8 = (($4) + -48)|0;
   $9 = (($8) + ($6))|0;
   HEAP32[$1>>2] = $9;
   $10 = ((($$012)) + 1|0);
   $11 = HEAP8[$10>>0]|0;
   $12 = $11 << 24 >> 24;
   $isdigittmp13 = (($12) + -48)|0;
   $isdigit14 = ($isdigittmp13>>>0)>(9);
   $13 = ($9|0)>(255);
   $or$cond = $13 | $isdigit14;
   if ($or$cond) {
    $$0 = $10;
    break;
   } else {
    $$012 = $10;$5 = $9;$7 = $11;
   }
  }
 } else {
  $$0 = $0;
 }
 return ($$0|0);
}
function _parse_bracket($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $$ = 0, $$0 = 0, $$064 = 0, $$065 = 0, $$06674 = 0, $$06773 = 0, $$07172 = 0, $$1 = 0, $$168 = 0, $$2 = 0, $$269 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0;
 var $19 = 0, $2 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $3 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0;
 var $37 = 0, $38 = 0, $39 = 0, $4 = 0, $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0;
 var $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 288|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(288|0);
 $2 = sp + 264|0;
 $3 = sp;
 $4 = HEAP32[$0>>2]|0;
 HEAP32[$2>>2] = $4;
 $5 = ((($2)) + 8|0);
 HEAP32[$5>>2] = 0;
 $6 = ((($2)) + 12|0);
 HEAP32[$6>>2] = 32;
 $7 = (_malloc(128)|0);
 $8 = ((($2)) + 4|0);
 HEAP32[$8>>2] = $7;
 $9 = ($7|0)==(0|0);
 if ($9) {
  $$065 = 12;
 } else {
  $10 = ((($3)) + 4|0);
  HEAP32[$10>>2] = 0;
  $11 = HEAP8[$1>>0]|0;
  $12 = ($11<<24>>24)==(94);
  $13 = $12&1;
  HEAP32[$3>>2] = $13;
  $14 = ((($1)) + 1|0);
  $$ = $12 ? $14 : $1;
  $15 = (_parse_bracket_terms($0,$$,$2,$3)|0);
  $16 = ($15|0)==(0);
  L3: do {
   if ($16) {
    $17 = HEAP32[$3>>2]|0;
    $18 = ($17|0)==(0);
    if ($18) {
     $$064 = 0;
    } else {
     $19 = HEAP32[$8>>2]|0;
     $20 = HEAP32[$5>>2]|0;
     _qsort($19,$20,4,5);
     $21 = (_tre_new_lit($2)|0);
     $22 = ($21|0)==(0|0);
     if ($22) {
      $$0 = 12;$$2 = 0;
      break;
     }
     HEAP32[$21>>2] = 1114112;
     $23 = ((($21)) + 4|0);
     HEAP32[$23>>2] = 1114112;
     $24 = ((($21)) + 8|0);
     HEAP32[$24>>2] = -1;
     $25 = HEAP32[$10>>2]|0;
     $26 = ($25|0)==(0);
     if ($26) {
      $$064 = 0;
     } else {
      $27 = HEAP32[$0>>2]|0;
      $28 = $25 << 2;
      $29 = (($28) + 4)|0;
      $30 = (___tre_mem_alloc_impl($27,0,0,0,$29)|0);
      $31 = ($30|0)==(0|0);
      if ($31) {
       $$0 = 12;$$2 = 0;
       break;
      }
      $32 = ((($3)) + 8|0);
      _memcpy(($30|0),($32|0),($28|0))|0;
      $33 = (($30) + ($25<<2)|0);
      HEAP32[$33>>2] = 0;
      $$064 = $30;
     }
    }
    $34 = HEAP32[$5>>2]|0;
    $35 = ($34|0)>(0);
    if ($35) {
     $36 = HEAP32[$8>>2]|0;
     $37 = ((($0)) + 24|0);
     $$06674 = 0;$$06773 = 0;$$07172 = 0;
     while(1) {
      $38 = (($36) + ($$07172<<2)|0);
      $39 = HEAP32[$38>>2]|0;
      $40 = HEAP32[$39>>2]|0;
      $41 = ((($39)) + 4|0);
      do {
       if ($18) {
        $$168 = $$06773;
        label = 14;
       } else {
        $42 = HEAP32[$41>>2]|0;
        $43 = ($40|0)>($$06773|0);
        $44 = (($42) + 1)|0;
        if ($43) {
         $47 = (($40) + -1)|0;
         HEAP32[$39>>2] = $$06773;
         HEAP32[$41>>2] = $47;
         $$168 = $44;
         label = 14;
         break;
        } else {
         $45 = ($44|0)>=($$06773|0);
         $46 = $45 ? $44 : $$06773;
         $$1 = $$06674;$$269 = $46;
         break;
        }
       }
      } while(0);
      if ((label|0) == 14) {
       label = 0;
       $48 = HEAP32[$37>>2]|0;
       $49 = ((($39)) + 8|0);
       HEAP32[$49>>2] = $48;
       $50 = ((($39)) + 16|0);
       HEAP32[$50>>2] = $$064;
       $51 = HEAP32[$0>>2]|0;
       $52 = (_tre_ast_new_node($51,0,$39)|0);
       $53 = HEAP32[$0>>2]|0;
       $54 = (_tre_ast_new_union($53,$$06674,$52)|0);
       $55 = ($54|0)==(0|0);
       if ($55) {
        $$0 = 12;$$2 = 0;
        break L3;
       } else {
        $$1 = $54;$$269 = $$168;
       }
      }
      $56 = (($$07172) + 1)|0;
      $57 = ($56|0)<($34|0);
      if ($57) {
       $$06674 = $$1;$$06773 = $$269;$$07172 = $56;
      } else {
       $$0 = 0;$$2 = $$1;
       break;
      }
     }
    } else {
     $$0 = 0;$$2 = 0;
    }
   } else {
    $$0 = $15;$$2 = 0;
   }
  } while(0);
  $58 = HEAP32[$8>>2]|0;
  _free($58);
  $59 = ((($0)) + 24|0);
  $60 = HEAP32[$59>>2]|0;
  $61 = (($60) + 1)|0;
  HEAP32[$59>>2] = $61;
  $62 = ((($0)) + 8|0);
  HEAP32[$62>>2] = $$2;
  $$065 = $$0;
 }
 STACKTOP = sp;return ($$065|0);
}
function _tre_expand_macro($0) {
 $0 = $0|0;
 var $$0$lcssa = 0, $$05 = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = HEAP8[$0>>0]|0;
 $$05 = 0;
 while(1) {
  $2 = (676 + ($$05<<3)|0);
  $3 = HEAP8[$2>>0]|0;
  $4 = ($3<<24>>24)==($1<<24>>24);
  if ($4) {
   $$0$lcssa = $$05;
   break;
  }
  $5 = (($$05) + 1)|0;
  $6 = ($5|0)==(12);
  if ($6) {
   $$0$lcssa = 12;
   break;
  } else {
   $$05 = $5;
  }
 }
 $7 = (((676 + ($$0$lcssa<<3)|0)) + 4|0);
 $8 = HEAP32[$7>>2]|0;
 return ($8|0);
}
function _hexval_525($0) {
 $0 = $0|0;
 var $$ = 0, $1 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = (($0) + -48)|0;
 $2 = ($1>>>0)<(10);
 if ($2) {
  return ($1|0);
 } else {
  $3 = $0 | 32;
  $4 = (($3) + -97)|0;
  $5 = ($4>>>0)<(6);
  $6 = (($3) + -87)|0;
  $$ = $5 ? $6 : -1;
  return ($$|0);
 }
 return (0)|0;
}
function _parse_bracket_terms($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$082120 = 0, $$091$be = 0, $$091121 = 0, $$190102 = 0, $$285104 = 0, $$288103 = 0, $$293101 = 0, $$4 = 0, $$lcssa111 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0;
 var $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $4 = 0;
 var $40 = 0, $41 = 0, $42 = 0, $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0;
 var $59 = 0, $6 = 0, $60 = 0, $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $8 = 0, $9 = 0, $or$cond = 0;
 var $or$cond94 = 0, $or$cond95 = 0, $or$cond97 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 32|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(32|0);
 $4 = sp;
 $5 = sp + 4|0;
 $6 = (_mbtowc($4,$1,-1)|0);
 $7 = ($6|0)<(1);
 $8 = HEAP8[$1>>0]|0;
 L1: do {
  if ($7) {
   $$lcssa111 = $8;
   label = 3;
  } else {
   $9 = ((($3)) + 4|0);
   $10 = ((($0)) + 32|0);
   $$091121 = $1;$13 = $8;$43 = $6;
   L3: while(1) {
    $14 = ($13<<24>>24)!=(93);
    $15 = ($$091121|0)==($1|0);
    $or$cond94 = $15 | $14;
    if (!($or$cond94)) {
     label = 5;
     break;
    }
    $18 = ($13<<24>>24)!=(45);
    $or$cond95 = $15 | $18;
    L6: do {
     if (!($or$cond95)) {
      $19 = ((($$091121)) + 1|0);
      $20 = HEAP8[$19>>0]|0;
      switch ($20<<24>>24) {
      case 93:  {
       break L6;
       break;
      }
      case 45:  {
       break;
      }
      default: {
       $$4 = 11;
       break L1;
      }
      }
      $21 = ((($$091121)) + 2|0);
      $22 = HEAP8[$21>>0]|0;
      $23 = ($22<<24>>24)==(93);
      if ($23) {
       $$4 = 11;
       break L1;
      }
     }
    } while(0);
    $24 = ($13<<24>>24)==(91);
    L10: do {
     if ($24) {
      $25 = ((($$091121)) + 1|0);
      $26 = HEAP8[$25>>0]|0;
      switch ($26<<24>>24) {
      case 61: case 46:  {
       $$4 = 3;
       break L1;
       break;
      }
      case 58:  {
       break;
      }
      default: {
       label = 17;
       break L10;
      }
      }
      $27 = ((($$091121)) + 2|0);
      $$082120 = 0;
      L13: while(1) {
       $28 = (($27) + ($$082120)|0);
       $29 = HEAP8[$28>>0]|0;
       switch ($29<<24>>24) {
       case 0:  {
        label = 16;
        break L3;
        break;
       }
       case 58:  {
        break L13;
        break;
       }
       default: {
       }
       }
       $30 = (($$082120) + 1)|0;
       $31 = ($30|0)<(14);
       if ($31) {
        $$082120 = $30;
       } else {
        label = 16;
        break L3;
       }
      }
      _memcpy(($5|0),($27|0),($$082120|0))|0;
      $32 = (($5) + ($$082120)|0);
      HEAP8[$32>>0] = 0;
      $33 = (_wctype($5)|0);
      $34 = ($33|0)==(0);
      if ($34) {
       label = 16;
       break L3;
      }
      $35 = (($$082120) + 1)|0;
      $36 = (($27) + ($35)|0);
      $37 = HEAP8[$36>>0]|0;
      $38 = ($37<<24>>24)==(93);
      $39 = (($$082120) + 2)|0;
      $40 = (($27) + ($39)|0);
      if (!($38)) {
       label = 16;
       break L3;
      }
      $54 = HEAP32[$3>>2]|0;
      $55 = ($54|0)==(0);
      if ($55) {
       $$190102 = $33;$$285104 = 1114111;$$288103 = 0;$$293101 = $40;$71 = 1;
       label = 25;
      } else {
       $56 = HEAP32[$9>>2]|0;
       $57 = ($56|0)>(63);
       if ($57) {
        $$4 = 12;
        break L1;
       }
       $58 = (($56) + 1)|0;
       HEAP32[$9>>2] = $58;
       $59 = (((($3)) + 8|0) + ($56<<2)|0);
       HEAP32[$59>>2] = $33;
       $$091$be = $40;
      }
     } else {
      label = 17;
     }
    } while(0);
    if ((label|0) == 17) {
     label = 0;
     $41 = HEAP32[$4>>2]|0;
     $42 = (($$091121) + ($43)|0);
     $44 = HEAP8[$42>>0]|0;
     $45 = ($44<<24>>24)==(45);
     if ($45) {
      $46 = ((($42)) + 1|0);
      $47 = HEAP8[$46>>0]|0;
      $48 = ($47<<24>>24)==(93);
      if ($48) {
       $$190102 = 0;$$285104 = $41;$$288103 = $41;$$293101 = $42;$71 = 0;
       label = 25;
      } else {
       $49 = (_mbtowc($4,$46,-1)|0);
       $50 = HEAP32[$4>>2]|0;
       $51 = ($49|0)<(1);
       $52 = ($41|0)>($50|0);
       $or$cond97 = $51 | $52;
       if ($or$cond97) {
        $$4 = 11;
        break L1;
       }
       $53 = (($46) + ($49)|0);
       $$190102 = 0;$$285104 = $50;$$288103 = $41;$$293101 = $53;$71 = 0;
       label = 25;
      }
     } else {
      $$190102 = 0;$$285104 = $41;$$288103 = $41;$$293101 = $42;$71 = 0;
      label = 25;
     }
    }
    if ((label|0) == 25) {
     label = 0;
     $63 = (_tre_new_lit($2)|0);
     $64 = ($63|0)==(0|0);
     if ($64) {
      $$4 = 12;
      break L1;
     }
     HEAP32[$63>>2] = $$288103;
     $65 = ((($63)) + 4|0);
     HEAP32[$65>>2] = $$285104;
     $66 = ((($63)) + 12|0);
     HEAP32[$66>>2] = $$190102;
     $67 = ((($63)) + 8|0);
     HEAP32[$67>>2] = -1;
     $68 = HEAP32[$10>>2]|0;
     $69 = $68 & 2;
     $70 = ($69|0)==(0);
     $or$cond = $71 | $70;
     if ($or$cond) {
      $$091$be = $$293101;
     } else {
      $72 = (_add_icase_literals($2,$$288103,$$285104)|0);
      $73 = ($72|0)==(0);
      if ($73) {
       $$091$be = $$293101;
      } else {
       $$4 = 12;
       break L1;
      }
     }
    }
    $60 = (_mbtowc($4,$$091$be,-1)|0);
    $61 = ($60|0)<(1);
    $62 = HEAP8[$$091$be>>0]|0;
    if ($61) {
     $$lcssa111 = $62;
     label = 3;
     break L1;
    } else {
     $$091121 = $$091$be;$13 = $62;$43 = $60;
    }
   }
   if ((label|0) == 5) {
    $16 = ((($$091121)) + 1|0);
    $17 = ((($0)) + 12|0);
    HEAP32[$17>>2] = $16;
    $$4 = 0;
    break;
   }
   else if ((label|0) == 16) {
    $$4 = 4;
    break;
   }
  }
 } while(0);
 if ((label|0) == 3) {
  $11 = ($$lcssa111<<24>>24)!=(0);
  $12 = $11 ? 2 : 7;
  $$4 = $12;
 }
 STACKTOP = sp;return ($$4|0);
}
function _tre_compare_lit($0,$1) {
 $0 = $0|0;
 $1 = $1|0;
 var $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $2 = HEAP32[$0>>2]|0;
 $3 = HEAP32[$2>>2]|0;
 $4 = HEAP32[$1>>2]|0;
 $5 = HEAP32[$4>>2]|0;
 $6 = (($3) - ($5))|0;
 return ($6|0);
}
function _tre_new_lit($0) {
 $0 = $0|0;
 var $$0 = 0, $$phi$trans$insert = 0, $$pre = 0, $$pre16 = 0, $1 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $2 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0;
 var $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $1 = ((($0)) + 8|0);
 $2 = HEAP32[$1>>2]|0;
 $3 = ((($0)) + 12|0);
 $4 = HEAP32[$3>>2]|0;
 $5 = ($2|0)<($4|0);
 if ($5) {
  $$phi$trans$insert = ((($0)) + 4|0);
  $$pre = HEAP32[$$phi$trans$insert>>2]|0;
  $14 = $2;$16 = $$pre;
  label = 6;
 } else {
  $6 = ($4|0)>(32767);
  if ($6) {
   $$0 = 0;
  } else {
   $7 = $4 << 1;
   HEAP32[$3>>2] = $7;
   $8 = ((($0)) + 4|0);
   $9 = HEAP32[$8>>2]|0;
   $10 = $4 << 3;
   $11 = (_realloc($9,$10)|0);
   $12 = ($11|0)==(0|0);
   if ($12) {
    $$0 = 0;
   } else {
    HEAP32[$8>>2] = $11;
    $$pre16 = HEAP32[$1>>2]|0;
    $14 = $$pre16;$16 = $11;
    label = 6;
   }
  }
 }
 if ((label|0) == 6) {
  $13 = (($14) + 1)|0;
  HEAP32[$1>>2] = $13;
  $15 = (($16) + ($14<<2)|0);
  $17 = HEAP32[$0>>2]|0;
  $18 = (___tre_mem_alloc_impl($17,0,0,1,20)|0);
  HEAP32[$15>>2] = $18;
  $$0 = $18;
 }
 return ($$0|0);
}
function _add_icase_literals($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0$be = 0, $$036 = 0, $$036$in = 0, $$039 = 0, $$040 = 0, $$042 = 0, $$1 = 0, $$1$in = 0, $$137 = 0, $$137$in = 0, $$2 = 0, $$2$in = 0, $$238 = 0, $$3 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0;
 var $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $3 = ($1|0)>($2|0);
 L1: do {
  if ($3) {
   $$040 = 0;
  } else {
   $$042 = $1;
   while(1) {
    $4 = (_iswlower($$042)|0);
    $5 = ($4|0)==(0);
    L4: do {
     if ($5) {
      $10 = (_iswupper($$042)|0);
      $11 = ($10|0)==(0);
      if ($11) {
       $16 = (($$042) + 1)|0;
       $$0$be = $16;
       break;
      }
      $12 = (_towlower($$042)|0);
      $$137$in = $12;$$2$in = $$042;
      while(1) {
       $$2 = (($$2$in) + 1)|0;
       $$137 = (($$137$in) + 1)|0;
       $13 = ($$2$in|0)<($2|0);
       if (!($13)) {
        $$039 = $12;$$238 = $$137;$$3 = $$2;
        label = 12;
        break L4;
       }
       $14 = (_towlower($$2)|0);
       $15 = ($14|0)==($$137|0);
       if ($15) {
        $$137$in = $$137;$$2$in = $$2;
       } else {
        $$039 = $12;$$238 = $$137;$$3 = $$2;
        label = 12;
        break;
       }
      }
     } else {
      $6 = (_towupper($$042)|0);
      $$036$in = $6;$$1$in = $$042;
      while(1) {
       $$1 = (($$1$in) + 1)|0;
       $$036 = (($$036$in) + 1)|0;
       $7 = ($$1$in|0)<($2|0);
       if (!($7)) {
        $$039 = $6;$$238 = $$036;$$3 = $$1;
        label = 12;
        break L4;
       }
       $8 = (_towupper($$1)|0);
       $9 = ($8|0)==($$036|0);
       if ($9) {
        $$036$in = $$036;$$1$in = $$1;
       } else {
        $$039 = $6;$$238 = $$036;$$3 = $$1;
        label = 12;
        break;
       }
      }
     }
    } while(0);
    if ((label|0) == 12) {
     label = 0;
     $18 = (_tre_new_lit($0)|0);
     $19 = ($18|0)==(0|0);
     if ($19) {
      $$040 = -1;
      break L1;
     }
     HEAP32[$18>>2] = $$039;
     $20 = (($$238) + -1)|0;
     $21 = ((($18)) + 4|0);
     HEAP32[$21>>2] = $20;
     $22 = ((($18)) + 8|0);
     HEAP32[$22>>2] = -1;
     $$0$be = $$3;
    }
    $17 = ($$0$be|0)>($2|0);
    if ($17) {
     $$040 = 0;
     break;
    } else {
     $$042 = $$0$be;
    }
   }
  }
 } while(0);
 return ($$040|0);
}
function _regexec($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$ = 0, $$0 = 0, $$026 = 0, $$027 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0, $23 = 0, $24 = 0, $25 = 0;
 var $26 = 0, $27 = 0, $28 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, $or$cond = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $5 = sp;
 $6 = ((($0)) + 4|0);
 $7 = HEAP32[$6>>2]|0;
 $8 = ((($7)) + 56|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = $9 & 8;
 $11 = ($10|0)==(0);
 $$ = $11 ? $2 : 0;
 $12 = ((($7)) + 40|0);
 $13 = HEAP32[$12>>2]|0;
 $14 = ($13|0)>(0);
 $15 = ($$|0)!=(0);
 $or$cond = $14 & $15;
 if ($or$cond) {
  $16 = $13 << 2;
  $17 = (_malloc($16)|0);
  $18 = ($17|0)==(0|0);
  if ($18) {
   $$027 = 12;
  } else {
   $$0 = $17;$28 = $17;
   label = 3;
  }
 } else {
  $$0 = 0;$28 = 0;
  label = 3;
 }
 if ((label|0) == 3) {
  $19 = ((($7)) + 60|0);
  $20 = HEAP32[$19>>2]|0;
  $21 = ($20|0)==(0);
  if ($21) {
   $23 = (_tre_tnfa_run_parallel($7,$1,$$0,$4,$5)|0);
   $$026 = $23;
  } else {
   $22 = (_tre_tnfa_run_backtrack($7,$1,$$0,$4,$5)|0);
   $$026 = $22;
  }
  $24 = ($$026|0)==(0);
  if ($24) {
   $25 = HEAP32[$8>>2]|0;
   $26 = HEAP32[$5>>2]|0;
   _tre_fill_pmatch($$,$3,$25,$7,$$0,$26);
  }
  $27 = ($$0|0)==(0|0);
  if ($27) {
   $$027 = $$026;
  } else {
   _free($28);
   $$027 = $$026;
  }
 }
 STACKTOP = sp;return ($$027|0);
}
function _tre_tnfa_run_backtrack($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$ = 0, $$0450620676 = 0, $$0452616 = 0, $$0458 = 0, $$0463 = 0, $$0463$pn = 0, $$0467 = 0, $$0476 = 0, $$0477641 = 0, $$0479631 = 0, $$0481596 = 0, $$0482 = 0, $$0486592 = 0, $$0487587 = 0, $$0501 = 0, $$0503602 = 0, $$0505 = 0, $$0519599 = 0, $$0529$ph = 0, $$0531598 = 0;
 var $$0535 = 0, $$0612 = 0, $$11516 = 0, $$12517 = 0, $$13518 = 0, $$14 = 0, $$1459 = 0, $$1468 = 0, $$1480 = 0, $$1483 = 0, $$1502 = 0, $$1504628 = 0, $$1506600 = 0, $$1520 = 0, $$1530 = 0, $$1532 = 0, $$1536 = 0, $$2455 = 0, $$2465 = 0, $$2469 = 0;
 var $$2484 = 0, $$2521609 = 0, $$2533 = 0, $$3461 = 0, $$3466 = 0, $$3470 = 0, $$3485 = 0, $$3508 = 0, $$3522 = 0, $$3534 = 0, $$4462 = 0, $$4523 = 0, $$5472 = 0, $$5510 = 0, $$5524624 = 0, $$6473 = 0, $$6500 = 0, $$6511 = 0, $$6525 = 0, $$7474 = 0;
 var $$7512625 = 0, $$7526638 = 0, $$8475 = 0, $$8527 = 0, $$9514 = 0, $$9528 = 0, $$old = 0, $$old11 = 0, $$old37 = 0, $$old38 = 0, $$ph = 0, $$pre = 0, $$pre655 = 0, $$pre657 = 0, $$pre658 = 0, $$pre659 = 0, $$pre661 = 0, $$pre662 = 0, $$pre663 = 0, $$pre665 = 0;
 var $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0, $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0;
 var $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0, $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0;
 var $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0, $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0;
 var $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0, $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0;
 var $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0, $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0;
 var $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0, $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0;
 var $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0, $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0;
 var $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0, $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0;
 var $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0, $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0;
 var $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0, $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0;
 var $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0, $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0;
 var $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0, $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0;
 var $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0, $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0;
 var $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0, $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0;
 var $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0, $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0;
 var $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0, $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0;
 var $390 = 0, $391 = 0, $392 = 0, $393 = 0, $394 = 0, $395 = 0, $396 = 0, $397 = 0, $398 = 0, $399 = 0, $40 = 0, $400 = 0, $401 = 0, $402 = 0, $403 = 0, $404 = 0, $405 = 0, $406 = 0, $407 = 0, $408 = 0;
 var $409 = 0, $41 = 0, $410 = 0, $411 = 0, $412 = 0, $413 = 0, $414 = 0, $415 = 0, $416 = 0, $417 = 0, $418 = 0, $419 = 0, $42 = 0, $420 = 0, $421 = 0, $422 = 0, $423 = 0, $424 = 0, $425 = 0, $426 = 0;
 var $427 = 0, $428 = 0, $429 = 0, $43 = 0, $430 = 0, $431 = 0, $432 = 0, $433 = 0, $434 = 0, $435 = 0, $436 = 0, $437 = 0, $438 = 0, $439 = 0, $44 = 0, $440 = 0, $441 = 0, $442 = 0, $443 = 0, $444 = 0;
 var $445 = 0, $446 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $brmerge = 0, $brmerge643 = 0, $brmerge646 = 0, $brmerge647 = 0, $not$ = 0, $notlhs = 0, $notlhs650 = 0, $notrhs = 0, $notrhs651 = 0, $or$cond$not = 0, $or$cond10 = 0, $or$cond12 = 0, $or$cond15 = 0, $or$cond18 = 0, $or$cond21 = 0, $or$cond24 = 0, $or$cond27$not = 0, $or$cond30 = 0;
 var $or$cond36 = 0, $or$cond39 = 0, $or$cond42 = 0, $or$cond45 = 0, $or$cond48 = 0, $or$cond51 = 0, $or$cond6 = 0, $or$cond645 = 0, $or$cond649 = 0, $tmp = 0, $tmp537 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $5 = sp;
 HEAP32[$5>>2] = 0;
 $6 = $3 & 1;
 $7 = $3 & 2;
 $8 = ((($0)) + 56|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = $9 & 4;
 $11 = (___tre_mem_new_impl(0,0)|0);
 $12 = ($11|0)==(0|0);
 L1: do {
  if ($12) {
   $$14 = 12;
  } else {
   $13 = (___tre_mem_alloc_impl($11,0,0,0,32)|0);
   $14 = ($13|0)==(0|0);
   if ($14) {
    ___tre_mem_destroy($11);
    $$14 = 12;
    break;
   }
   $15 = ((($13)) + 24|0);
   HEAP32[$15>>2] = 0;
   $16 = ((($13)) + 28|0);
   HEAP32[$16>>2] = 0;
   $17 = ((($0)) + 40|0);
   $18 = HEAP32[$17>>2]|0;
   $19 = ($18|0)==(0);
   if ($19) {
    $$0535 = 0;$131 = 0;
    label = 6;
   } else {
    $20 = $18 << 2;
    $21 = (_malloc($20)|0);
    $22 = ($21|0)==(0|0);
    if ($22) {
     $$1502 = 0;$$1530 = 0;$$1536 = $21;$$6500 = 12;$441 = 0;$443 = 0;$445 = 0;
    } else {
     $$0535 = $21;$131 = $21;
     label = 6;
    }
   }
   L8: do {
    if ((label|0) == 6) {
     $23 = ((($0)) + 28|0);
     $24 = HEAP32[$23>>2]|0;
     $25 = ($24|0)==(0);
     if ($25) {
      $$0501 = 0;$133 = 0;
     } else {
      $26 = $24 << 3;
      $27 = (_malloc($26)|0);
      $28 = ($27|0)==(0|0);
      if ($28) {
       $$1502 = $27;$$1530 = 0;$$1536 = $$0535;$$6500 = 12;$441 = $131;$443 = 0;$445 = 0;
       break;
      } else {
       $$0501 = $27;$133 = $27;
      }
     }
     $29 = ((($0)) + 52|0);
     $30 = HEAP32[$29>>2]|0;
     $31 = ($30|0)==(0);
     if ($31) {
      $$0529$ph = 0;$$ph = 0;
     } else {
      $32 = $30 << 2;
      $33 = (_malloc($32)|0);
      $34 = ($33|0)==(0|0);
      if ($34) {
       $$1502 = $$0501;$$1530 = $33;$$1536 = $$0535;$$6500 = 12;$441 = $131;$443 = $133;$445 = 0;
       break;
      } else {
       $$0529$ph = $33;$$ph = $33;
      }
     }
     $35 = ((($0)) + 8|0);
     $36 = ((($0)) + 12|0);
     $37 = ($2|0)!=(0|0);
     $38 = ((($0)) + 32|0);
     $39 = ($10|0)!=(0);
     $40 = ($2|0)==(0|0);
     $notlhs650 = ($6|0)==(0);
     $notlhs = ($6|0)==(0);
     $$0458 = $1;$$0467 = 1;$$0476 = -1;$$0482 = -1;$$0505 = $13;$41 = $18;$62 = 0;
     L16: while(1) {
      $42 = ($41|0)>(0);
      if ($42) {
       $$0487587 = 0;$446 = $41;
       while(1) {
        $46 = (($$0535) + ($$0487587<<2)|0);
        HEAP32[$46>>2] = -1;
        if ($40) {
         $50 = $446;
        } else {
         $47 = (($2) + ($$0487587<<2)|0);
         HEAP32[$47>>2] = -1;
         $$pre655 = HEAP32[$17>>2]|0;
         $50 = $$pre655;
        }
        $48 = (($$0487587) + 1)|0;
        $49 = ($48|0)<($50|0);
        if ($49) {
         $$0487587 = $48;$446 = $50;
        } else {
         break;
        }
       }
      }
      $43 = HEAP32[$29>>2]|0;
      $44 = ($43|0)>(0);
      if ($44) {
       $45 = $43 << 2;
       _memset(($$ph|0),0,($45|0))|0;
      }
      $51 = (($$0467) + ($$0476))|0;
      $52 = (_mbtowc($5,$$0458,4)|0);
      $53 = ($52|0)<(1);
      if ($53) {
       $54 = ($52|0)<(0);
       if ($54) {
        $$1502 = $$0501;$$1530 = $$0529$ph;$$1536 = $$0535;$$6500 = 1;$441 = $131;$443 = $133;$445 = $$ph;
        break L8;
       } else {
        $$1468 = 1;
       }
      } else {
       $$1468 = $52;
      }
      $55 = (($$0458) + ($$1468)|0);
      $56 = HEAP32[$5>>2]|0;
      $57 = HEAP32[$35>>2]|0;
      $58 = ((($57)) + 8|0);
      $59 = HEAP32[$58>>2]|0;
      $60 = ($59|0)==(0|0);
      if ($60) {
       $$12517 = $$0505;$$2484 = $$0482;$$7474 = $$1468;$$8527 = 0;
       label = 170;
      } else {
       $61 = ($51|0)!=(0);
       $63 = ($62|0)==(95);
       $64 = ($51|0)==(0);
       $65 = ($62|0)==(10);
       $or$cond6 = $39 & $65;
       $notrhs = ($51|0)<(1);
       $or$cond$not = $notrhs & $notlhs;
       $$0503602 = $57;$$0519599 = 0;$$0531598 = 0;$$1506600 = $$0505;$122 = $58;
       while(1) {
        $66 = ((($$0503602)) + 20|0);
        $67 = HEAP32[$66>>2]|0;
        $68 = ($67|0)==(0);
        L35: do {
         if ($68) {
          label = 49;
         } else {
          $69 = $67 & 1;
          $70 = ($69|0)==(0);
          $brmerge = $70 | $or$cond$not;
          $brmerge643 = $brmerge | $or$cond6;
          if ($brmerge643) {
           $71 = $67 & 2;
           $72 = ($71|0)==(0);
           if (!($72)) {
            $73 = HEAP32[$5>>2]|0;
            $74 = $73 | $7;
            $75 = ($74|0)==(0);
            $76 = ($73|0)==(10);
            $or$cond10 = $39 & $76;
            $or$cond645 = $75 | $or$cond10;
            if (!($or$cond645)) {
             $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
             break;
            }
           }
           $77 = $67 & 16;
           $78 = ($77|0)==(0);
           do {
            if (!($78)) {
             if ($63) {
              $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
              break L35;
             }
             $79 = (_iswalnum($62)|0);
             $80 = ($79|0)==(0);
             if (!($80)) {
              $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
              break L35;
             }
             $81 = HEAP32[$5>>2]|0;
             $82 = ($81|0)==(95);
             if ($82) {
              break;
             }
             $83 = (_iswalnum($81)|0);
             $84 = ($83|0)==(0);
             if ($84) {
              $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
              break L35;
             }
            }
           } while(0);
           $85 = HEAP32[$66>>2]|0;
           $86 = $85 & 32;
           $87 = ($86|0)==(0);
           if ($87) {
            $96 = $85;
           } else {
            if ($63) {
             $$old = HEAP32[$5>>2]|0;
             $$old11 = ($$old|0)==(95);
             if ($$old11) {
              $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
              break;
             } else {
              $92 = $$old;
             }
            } else {
             $88 = (_iswalnum($62)|0);
             $89 = ($88|0)==(0);
             $90 = HEAP32[$5>>2]|0;
             $91 = ($90|0)==(95);
             $or$cond12 = $89 | $91;
             if ($or$cond12) {
              $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
              break;
             } else {
              $92 = $90;
             }
            }
            $93 = (_iswalnum($92)|0);
            $94 = ($93|0)==(0);
            if (!($94)) {
             $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
             break;
            }
            $$pre657 = HEAP32[$66>>2]|0;
            $96 = $$pre657;
           }
           $95 = $96 & 64;
           $97 = ($95|0)!=(0);
           $or$cond15 = $61 & $97;
           $98 = HEAP32[$5>>2]|0;
           $99 = ($98|0)!=(0);
           $or$cond18 = $99 & $or$cond15;
           do {
            if ($or$cond18) {
             if ($63) {
              $102 = $98;$106 = 1;
             } else {
              $100 = (_iswalnum($62)|0);
              $101 = ($100|0)!=(0);
              $$pre658 = HEAP32[$5>>2]|0;
              $102 = $$pre658;$106 = $101;
             }
             $103 = ($102|0)==(95);
             if ($103) {
              if ($106) {
               $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
               break L35;
              } else {
               break;
              }
             } else {
              $104 = (_iswalnum($102)|0);
              $105 = ($104|0)!=(0);
              $tmp537 = $106 ^ $105;
              if ($tmp537) {
               break;
              } else {
               $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
               break L35;
              }
             }
            }
           } while(0);
           $107 = HEAP32[$66>>2]|0;
           $108 = $107 & 128;
           $109 = ($108|0)==(0);
           if ($109) {
            label = 49;
            break;
           }
           $110 = HEAP32[$5>>2]|0;
           $111 = ($110|0)==(0);
           $or$cond21 = $64 | $111;
           if ($or$cond21) {
            $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
            break;
           }
           if ($63) {
            $114 = $110;$119 = 1;
           } else {
            $112 = (_iswalnum($62)|0);
            $113 = ($112|0)!=(0);
            $$pre659 = HEAP32[$5>>2]|0;
            $114 = $$pre659;$119 = $113;
           }
           $115 = ($114|0)==(95);
           if ($115) {
            if ($119) {
             label = 49;
             break;
            } else {
             $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
             break;
            }
           } else {
            $116 = (_iswalnum($114)|0);
            $117 = ($116|0)!=(0);
            $118 = $119 ^ $117;
            if ($118) {
             $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
             break;
            } else {
             label = 49;
             break;
            }
           }
          } else {
           $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$1506600;
          }
         }
        } while(0);
        do {
         if ((label|0) == 49) {
          label = 0;
          $120 = ($$0531598|0)==(0|0);
          if ($120) {
           $121 = HEAP32[$122>>2]|0;
           $123 = ((($$0503602)) + 16|0);
           $124 = HEAP32[$123>>2]|0;
           $$1520 = $124;$$1532 = $121;$$5510 = $$1506600;
           break;
          }
          $125 = ((($$1506600)) + 28|0);
          $126 = HEAP32[$125>>2]|0;
          $127 = ($126|0)==(0|0);
          if ($127) {
           $128 = (___tre_mem_alloc_impl($11,0,0,0,32)|0);
           $129 = ($128|0)==(0|0);
           if ($129) {
            label = 53;
            break L16;
           }
           $135 = ((($128)) + 24|0);
           HEAP32[$135>>2] = $$1506600;
           $136 = ((($128)) + 28|0);
           HEAP32[$136>>2] = 0;
           $137 = HEAP32[$17>>2]|0;
           $138 = $137 << 2;
           $139 = (___tre_mem_alloc_impl($11,0,0,0,$138)|0);
           $140 = ((($128)) + 20|0);
           HEAP32[$140>>2] = $139;
           $141 = ($139|0)==(0|0);
           if ($141) {
            label = 60;
            break L16;
           }
           HEAP32[$125>>2] = $128;
           $$3508 = $128;
          } else {
           $$3508 = $126;
          }
          HEAP32[$$3508>>2] = $51;
          $145 = ((($$3508)) + 4|0);
          HEAP32[$145>>2] = $55;
          $146 = HEAP32[$122>>2]|0;
          $147 = ((($$3508)) + 8|0);
          HEAP32[$147>>2] = $146;
          $148 = ((($$0503602)) + 12|0);
          $149 = HEAP32[$148>>2]|0;
          $150 = ((($$3508)) + 12|0);
          HEAP32[$150>>2] = $149;
          $151 = HEAP32[$5>>2]|0;
          $152 = ((($$3508)) + 16|0);
          HEAP32[$152>>2] = $151;
          $153 = HEAP32[$17>>2]|0;
          $154 = ($153|0)>(0);
          if ($154) {
           $155 = ((($$3508)) + 20|0);
           $156 = HEAP32[$155>>2]|0;
           $$0486592 = 0;
           while(1) {
            $157 = (($$0535) + ($$0486592<<2)|0);
            $158 = HEAP32[$157>>2]|0;
            $159 = (($156) + ($$0486592<<2)|0);
            HEAP32[$159>>2] = $158;
            $160 = (($$0486592) + 1)|0;
            $161 = HEAP32[$17>>2]|0;
            $162 = ($160|0)<($161|0);
            if ($162) {
             $$0486592 = $160;
            } else {
             break;
            }
           }
          }
          $163 = ((($$0503602)) + 16|0);
          $164 = HEAP32[$163>>2]|0;
          $165 = ($164|0)==(0|0);
          if ($165) {
           $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$3508;
          } else {
           $166 = HEAP32[$164>>2]|0;
           $167 = ($166|0)>(-1);
           if (!($167)) {
            $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$3508;
            break;
           }
           $168 = ((($$3508)) + 20|0);
           $169 = HEAP32[$168>>2]|0;
           $$0481596 = $164;$172 = $166;
           while(1) {
            $170 = ((($$0481596)) + 4|0);
            $171 = (($169) + ($172<<2)|0);
            HEAP32[$171>>2] = $51;
            $173 = HEAP32[$170>>2]|0;
            $174 = ($173|0)>(-1);
            if ($174) {
             $$0481596 = $170;$172 = $173;
            } else {
             $$1520 = $$0519599;$$1532 = $$0531598;$$5510 = $$3508;
             break;
            }
           }
          }
         }
        } while(0);
        $175 = ((($$0503602)) + 32|0);
        $176 = ((($$0503602)) + 40|0);
        $177 = HEAP32[$176>>2]|0;
        $178 = ($177|0)==(0|0);
        if ($178) {
         break;
        } else {
         $$0503602 = $175;$$0519599 = $$1520;$$0531598 = $$1532;$$1506600 = $$5510;$122 = $176;
        }
       }
       $179 = ($$1520|0)==(0|0);
       if ($179) {
        $$3522 = 0;
       } else {
        $180 = HEAP32[$$1520>>2]|0;
        $181 = ($180|0)>(-1);
        if ($181) {
         $$2521609 = $$1520;$183 = $180;
         while(1) {
          $182 = (($$0535) + ($183<<2)|0);
          HEAP32[$182>>2] = $51;
          $184 = ((($$2521609)) + 4|0);
          $185 = HEAP32[$184>>2]|0;
          $186 = ($185|0)>(-1);
          if ($186) {
           $$2521609 = $184;$183 = $185;
          } else {
           $$3522 = $184;
           break;
          }
         }
        } else {
         $$3522 = $$1520;
        }
       }
       $187 = ($$1532|0)==(0|0);
       if ($187) {
        $$12517 = $$5510;$$2484 = $$0482;$$7474 = $$1468;$$8527 = $$3522;
        label = 170;
       } else {
        $$0463 = $51;$$1459 = $55;$$1483 = $$0482;$$2469 = $$1468;$$2533 = $$1532;$$4523 = $$3522;$$6511 = $$5510;
        label = 79;
       }
      }
      L98: while(1) {
       if ((label|0) == 79) {
        label = 0;
        $188 = HEAP32[$36>>2]|0;
        $189 = ($$2533|0)==($188|0);
        if ($189) {
         $190 = ($$1483|0)<($$0463|0);
         if (!($190)) {
          $191 = ($$1483|0)==($$0463|0);
          $or$cond24 = $37 & $191;
          if (!($or$cond24)) {
           $$12517 = $$6511;$$2484 = $$1483;$$7474 = $$2469;$$8527 = $$4523;
           label = 170;
           continue;
          }
          $192 = HEAP32[$17>>2]|0;
          $193 = HEAP32[$38>>2]|0;
          $194 = (_tre_tag_order($192,$193,$$0535,$2)|0);
          $195 = ($194|0)==(0);
          if ($195) {
           $$12517 = $$6511;$$2484 = $$1483;$$7474 = $$2469;$$8527 = $$4523;
           label = 170;
           continue;
          }
         }
         if (!($37)) {
          $$12517 = $$6511;$$2484 = $$0463;$$7474 = $$2469;$$8527 = $$4523;
          label = 170;
          continue;
         }
         $196 = HEAP32[$17>>2]|0;
         $197 = ($196|0)>(0);
         if ($197) {
          $$0477641 = 0;
         } else {
          $$12517 = $$6511;$$2484 = $$0463;$$7474 = $$2469;$$8527 = $$4523;
          label = 170;
          continue;
         }
         while(1) {
          $198 = (($$0535) + ($$0477641<<2)|0);
          $199 = HEAP32[$198>>2]|0;
          $200 = (($2) + ($$0477641<<2)|0);
          HEAP32[$200>>2] = $199;
          $201 = (($$0477641) + 1)|0;
          $202 = HEAP32[$17>>2]|0;
          $203 = ($201|0)<($202|0);
          if ($203) {
           $$0477641 = $201;
          } else {
           $$12517 = $$6511;$$2484 = $$0463;$$7474 = $$2469;$$8527 = $$4523;
           label = 170;
           continue L98;
          }
         }
        }
        $204 = ((($$2533)) + 8|0);
        $205 = HEAP32[$204>>2]|0;
        $206 = ($205|0)==(0|0);
        if ($206) {
         label = 94;
        } else {
         $207 = ((($$2533)) + 20|0);
         $208 = HEAP32[$207>>2]|0;
         $209 = $208 & 256;
         $210 = ($209|0)==(0);
         if ($210) {
          label = 94;
         } else {
          $211 = ((($$2533)) + 24|0);
          $212 = HEAP32[$211>>2]|0;
          $213 = (($212) + 1)|0;
          $214 = HEAP32[$8>>2]|0;
          $215 = $214 & -9;
          _tre_fill_pmatch($213,$$0501,$215,$0,$$0535,$$0463);
          $216 = (($$0501) + ($212<<3)|0);
          $217 = HEAP32[$216>>2]|0;
          $218 = (((($$0501) + ($212<<3)|0)) + 4|0);
          $219 = HEAP32[$218>>2]|0;
          $220 = (($219) - ($217))|0;
          $221 = (($1) + ($217)|0);
          $222 = ((($$1459)) + -1|0);
          $223 = (_strncmp($221,$222,$220)|0);
          $224 = ($223|0)==(0);
          if (!($224)) {
           $$12517 = $$6511;$$2484 = $$1483;$$7474 = $$2469;$$8527 = $$4523;
           label = 170;
           continue;
          }
          $225 = ($220|0)==(0);
          $$ = $225&1;
          $226 = ((($$2533)) + 12|0);
          $227 = HEAP32[$226>>2]|0;
          $228 = (($$0529$ph) + ($227<<2)|0);
          if ($225) {
           $229 = HEAP32[$228>>2]|0;
           $230 = ($229|0)==(0);
           if (!($230)) {
            $$12517 = $$6511;$$2484 = $$1483;$$7474 = $$2469;$$8527 = $$4523;
            label = 170;
            continue;
           }
          }
          HEAP32[$228>>2] = $$;
          $231 = (($220) + -1)|0;
          $232 = (($$1459) + ($231)|0);
          $233 = (($231) + ($$0463))|0;
          $234 = HEAP32[$5>>2]|0;
          $235 = (_mbtowc($5,$232,4)|0);
          $236 = ($235|0)<(1);
          if ($236) {
           $237 = ($235|0)<(0);
           if ($237) {
            $$1502 = $$0501;$$1530 = $$0529$ph;$$1536 = $$0535;$$6500 = 1;$441 = $131;$443 = $133;$445 = $$ph;
            break L8;
           } else {
            $$3470 = 1;
           }
          } else {
           $$3470 = $235;
          }
          $238 = (($232) + ($$3470)|0);
          $$0463$pn = $233;$$2455 = $234;$$3461 = $238;$$6473 = $$3470;
         }
        }
        if ((label|0) == 94) {
         label = 0;
         $239 = HEAP32[$5>>2]|0;
         $240 = ($239|0)==(0);
         if ($240) {
          $$12517 = $$6511;$$2484 = $$1483;$$7474 = $$2469;$$8527 = $$4523;
          label = 170;
          continue;
         }
         $241 = (_mbtowc($5,$$1459,4)|0);
         $242 = ($241|0)<(1);
         if ($242) {
          $243 = ($241|0)<(0);
          if ($243) {
           $$1502 = $$0501;$$1530 = $$0529$ph;$$1536 = $$0535;$$6500 = 1;$441 = $131;$443 = $133;$445 = $$ph;
           break L8;
          } else {
           $$5472 = 1;
          }
         } else {
          $$5472 = $241;
         }
         $244 = (($$1459) + ($$5472)|0);
         $$0463$pn = $$0463;$$2455 = $239;$$3461 = $244;$$6473 = $$5472;
        }
        $$2465 = (($$0463$pn) + ($$2469))|0;
        $245 = HEAP32[$204>>2]|0;
        $246 = ($245|0)==(0|0);
        if ($246) {
         $$12517 = $$6511;$$2484 = $$1483;$$7474 = $$6473;$$8527 = $$4523;
         label = 170;
         continue;
        }
        $247 = ($$2465|0)!=(0);
        $248 = ($$2455|0)==(95);
        $249 = ($$2465|0)==(0);
        $250 = ($$2455|0)==(10);
        $or$cond30 = $39 & $250;
        $notrhs651 = ($$2465|0)<(1);
        $or$cond27$not = $notrhs651 & $notlhs650;
        $$0479631 = 0;$$1504628 = $$2533;$$5524624 = $$4523;$$7512625 = $$6511;$346 = $204;
        while(1) {
         $251 = HEAP32[$$1504628>>2]|0;
         $252 = ($251>>>0)>($$2455>>>0);
         L139: do {
          if ($252) {
           $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
          } else {
           $253 = ((($$1504628)) + 4|0);
           $254 = HEAP32[$253>>2]|0;
           $255 = ($254>>>0)<($$2455>>>0);
           if ($255) {
            $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
            break;
           }
           $256 = ((($$1504628)) + 20|0);
           $257 = HEAP32[$256>>2]|0;
           $258 = ($257|0)==(0);
           do {
            if (!($258)) {
             $259 = $257 & 1;
             $260 = ($259|0)==(0);
             $brmerge646 = $260 | $or$cond27$not;
             $brmerge647 = $brmerge646 | $or$cond30;
             if (!($brmerge647)) {
              $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
              break L139;
             }
             $261 = $257 & 2;
             $262 = ($261|0)==(0);
             if (!($262)) {
              $263 = HEAP32[$5>>2]|0;
              $264 = $263 | $7;
              $265 = ($264|0)==(0);
              $266 = ($263|0)==(10);
              $or$cond36 = $39 & $266;
              $or$cond649 = $265 | $or$cond36;
              if (!($or$cond649)) {
               $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
               break L139;
              }
             }
             $267 = $257 & 16;
             $268 = ($267|0)==(0);
             do {
              if (!($268)) {
               if ($248) {
                $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                break L139;
               }
               $269 = (_iswalnum($$2455)|0);
               $270 = ($269|0)==(0);
               if (!($270)) {
                $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                break L139;
               }
               $271 = HEAP32[$5>>2]|0;
               $272 = ($271|0)==(95);
               if ($272) {
                break;
               }
               $273 = (_iswalnum($271)|0);
               $274 = ($273|0)==(0);
               if ($274) {
                $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                break L139;
               }
              }
             } while(0);
             $275 = HEAP32[$256>>2]|0;
             $276 = $275 & 32;
             $277 = ($276|0)==(0);
             if ($277) {
              $286 = $275;
             } else {
              if ($248) {
               $$old37 = HEAP32[$5>>2]|0;
               $$old38 = ($$old37|0)==(95);
               if ($$old38) {
                $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                break L139;
               } else {
                $282 = $$old37;
               }
              } else {
               $278 = (_iswalnum($$2455)|0);
               $279 = ($278|0)==(0);
               $280 = HEAP32[$5>>2]|0;
               $281 = ($280|0)==(95);
               $or$cond39 = $279 | $281;
               if ($or$cond39) {
                $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                break L139;
               } else {
                $282 = $280;
               }
              }
              $283 = (_iswalnum($282)|0);
              $284 = ($283|0)==(0);
              if (!($284)) {
               $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
               break L139;
              }
              $$pre661 = HEAP32[$256>>2]|0;
              $286 = $$pre661;
             }
             $285 = $286 & 64;
             $287 = ($285|0)!=(0);
             $or$cond42 = $247 & $287;
             $288 = HEAP32[$5>>2]|0;
             $289 = ($288|0)!=(0);
             $or$cond45 = $289 & $or$cond42;
             do {
              if ($or$cond45) {
               if ($248) {
                $292 = $288;$296 = 1;
               } else {
                $290 = (_iswalnum($$2455)|0);
                $291 = ($290|0)!=(0);
                $$pre662 = HEAP32[$5>>2]|0;
                $292 = $$pre662;$296 = $291;
               }
               $293 = ($292|0)==(95);
               if ($293) {
                if ($296) {
                 $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                 break L139;
                } else {
                 break;
                }
               } else {
                $294 = (_iswalnum($292)|0);
                $295 = ($294|0)!=(0);
                $tmp = $296 ^ $295;
                if ($tmp) {
                 break;
                } else {
                 $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                 break L139;
                }
               }
              }
             } while(0);
             $297 = HEAP32[$256>>2]|0;
             $298 = $297 & 128;
             $299 = ($298|0)==(0);
             do {
              if (!($299)) {
               $300 = HEAP32[$5>>2]|0;
               $301 = ($300|0)==(0);
               $or$cond48 = $249 | $301;
               if ($or$cond48) {
                $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                break L139;
               }
               if ($248) {
                $304 = $300;$309 = 1;
               } else {
                $302 = (_iswalnum($$2455)|0);
                $303 = ($302|0)!=(0);
                $$pre663 = HEAP32[$5>>2]|0;
                $304 = $$pre663;$309 = $303;
               }
               $305 = ($304|0)==(95);
               if ($305) {
                if ($309) {
                 break;
                } else {
                 $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                 break L139;
                }
               } else {
                $306 = (_iswalnum($304)|0);
                $307 = ($306|0)!=(0);
                $308 = $309 ^ $307;
                if ($308) {
                 $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                 break L139;
                } else {
                 break;
                }
               }
              }
             } while(0);
             $310 = HEAP32[$256>>2]|0;
             $311 = $310 & 4;
             $312 = ($311|0)==(0);
             do {
              if ($312) {
               $321 = $310;
              } else {
               $313 = HEAP32[$8>>2]|0;
               $314 = $313 & 2;
               $315 = ($314|0)==(0);
               if (!($315)) {
                $321 = $310;
                break;
               }
               $316 = ((($$1504628)) + 24|0);
               $317 = HEAP32[$316>>2]|0;
               $318 = (_iswctype($$2455,$317)|0);
               $319 = ($318|0)==(0);
               if ($319) {
                $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                break L139;
               }
               $$pre665 = HEAP32[$256>>2]|0;
               $321 = $$pre665;
              }
             } while(0);
             $320 = $321 & 4;
             $322 = ($320|0)==(0);
             do {
              if (!($322)) {
               $323 = HEAP32[$8>>2]|0;
               $324 = $323 & 2;
               $325 = ($324|0)==(0);
               if ($325) {
                break;
               }
               $326 = (_towlower($$2455)|0);
               $327 = ((($$1504628)) + 24|0);
               $328 = HEAP32[$327>>2]|0;
               $329 = (_iswctype($326,$328)|0);
               $330 = ($329|0)==(0);
               if (!($330)) {
                break;
               }
               $331 = (_towupper($$2455)|0);
               $332 = HEAP32[$327>>2]|0;
               $333 = (_iswctype($331,$332)|0);
               $334 = ($333|0)==(0);
               if ($334) {
                $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
                break L139;
               }
              }
             } while(0);
             $335 = HEAP32[$256>>2]|0;
             $336 = $335 & 8;
             $337 = ($336|0)==(0);
             if ($337) {
              break;
             }
             $338 = ((($$1504628)) + 28|0);
             $339 = HEAP32[$338>>2]|0;
             $340 = HEAP32[$8>>2]|0;
             $341 = $340 & 2;
             $342 = (_tre_neg_char_classes_match($339,$$2455,$341)|0);
             $343 = ($342|0)==(0);
             if (!($343)) {
              $$11516 = $$7512625;$$1480 = $$0479631;$$6525 = $$5524624;
              break L139;
             }
            }
           } while(0);
           $344 = ($$0479631|0)==(0|0);
           if ($344) {
            $345 = HEAP32[$346>>2]|0;
            $347 = ((($$1504628)) + 16|0);
            $348 = HEAP32[$347>>2]|0;
            $$11516 = $$7512625;$$1480 = $345;$$6525 = $348;
            break;
           }
           $349 = ((($$7512625)) + 28|0);
           $350 = HEAP32[$349>>2]|0;
           $351 = ($350|0)==(0|0);
           if ($351) {
            $352 = (___tre_mem_alloc_impl($11,0,0,0,32)|0);
            $353 = ($352|0)==(0|0);
            if ($353) {
             label = 144;
             break L16;
            }
            $357 = ((($352)) + 24|0);
            HEAP32[$357>>2] = $$7512625;
            $358 = ((($352)) + 28|0);
            HEAP32[$358>>2] = 0;
            $359 = HEAP32[$17>>2]|0;
            $360 = $359 << 2;
            $361 = (___tre_mem_alloc_impl($11,0,0,0,$360)|0);
            $362 = ((($352)) + 20|0);
            HEAP32[$362>>2] = $361;
            $363 = ($361|0)==(0|0);
            if ($363) {
             label = 151;
             break L16;
            }
            HEAP32[$349>>2] = $352;
            $$9514 = $352;
           } else {
            $$9514 = $350;
           }
           HEAP32[$$9514>>2] = $$2465;
           $367 = ((($$9514)) + 4|0);
           HEAP32[$367>>2] = $$3461;
           $368 = HEAP32[$346>>2]|0;
           $369 = ((($$9514)) + 8|0);
           HEAP32[$369>>2] = $368;
           $370 = ((($$1504628)) + 12|0);
           $371 = HEAP32[$370>>2]|0;
           $372 = ((($$9514)) + 12|0);
           HEAP32[$372>>2] = $371;
           $373 = HEAP32[$5>>2]|0;
           $374 = ((($$9514)) + 16|0);
           HEAP32[$374>>2] = $373;
           $375 = HEAP32[$17>>2]|0;
           $376 = ($375|0)>(0);
           if ($376) {
            $377 = ((($$9514)) + 20|0);
            $378 = HEAP32[$377>>2]|0;
            $$0452616 = 0;
            while(1) {
             $379 = (($$0535) + ($$0452616<<2)|0);
             $380 = HEAP32[$379>>2]|0;
             $381 = (($378) + ($$0452616<<2)|0);
             HEAP32[$381>>2] = $380;
             $382 = (($$0452616) + 1)|0;
             $383 = HEAP32[$17>>2]|0;
             $384 = ($382|0)<($383|0);
             if ($384) {
              $$0452616 = $382;
             } else {
              break;
             }
            }
           }
           $385 = ((($$1504628)) + 16|0);
           $386 = HEAP32[$385>>2]|0;
           $387 = ($386|0)==(0|0);
           if ($387) {
            $$11516 = $$9514;$$1480 = $$0479631;$$6525 = $$5524624;
            break;
           }
           $388 = ((($$9514)) + 20|0);
           $389 = HEAP32[$386>>2]|0;
           $390 = ($389|0)>(-1);
           if (!($390)) {
            $$11516 = $$9514;$$1480 = $$0479631;$$6525 = $$5524624;
            break;
           }
           $391 = HEAP32[$388>>2]|0;
           $$0450620676 = $386;$393 = $389;
           while(1) {
            $392 = (($391) + ($393<<2)|0);
            HEAP32[$392>>2] = $$2465;
            $394 = ((($$0450620676)) + 4|0);
            $395 = HEAP32[$394>>2]|0;
            $396 = ($395|0)>(-1);
            if ($396) {
             $$0450620676 = $394;$393 = $395;
            } else {
             $$11516 = $$9514;$$1480 = $$0479631;$$6525 = $$5524624;
             break;
            }
           }
          }
         } while(0);
         $397 = ((($$1504628)) + 32|0);
         $398 = ((($$1504628)) + 40|0);
         $399 = HEAP32[$398>>2]|0;
         $400 = ($399|0)==(0|0);
         if ($400) {
          break;
         } else {
          $$0479631 = $$1480;$$1504628 = $397;$$5524624 = $$6525;$$7512625 = $$11516;$346 = $398;
         }
        }
        $401 = ($$1480|0)==(0|0);
        if ($401) {
         $$12517 = $$11516;$$2484 = $$1483;$$7474 = $$6473;$$8527 = $$6525;
         label = 170;
         continue;
        }
        $402 = ($$6525|0)==(0|0);
        if ($402) {
         $$13518 = $$11516;$$3466 = $$2465;$$3485 = $$1483;$$3534 = $$1480;$$4462 = $$3461;$$8475 = $$6473;$$9528 = 0;
        } else {
         $403 = HEAP32[$$6525>>2]|0;
         $404 = ($403|0)>(-1);
         if ($404) {
          $$7526638 = $$6525;$407 = $403;
          while(1) {
           $405 = ((($$7526638)) + 4|0);
           $406 = (($$0535) + ($407<<2)|0);
           HEAP32[$406>>2] = $$2465;
           $408 = HEAP32[$405>>2]|0;
           $409 = ($408|0)>(-1);
           if ($409) {
            $$7526638 = $405;$407 = $408;
           } else {
            $$13518 = $$11516;$$3466 = $$2465;$$3485 = $$1483;$$3534 = $$1480;$$4462 = $$3461;$$8475 = $$6473;$$9528 = $405;
            break;
           }
          }
         } else {
          $$13518 = $$11516;$$3466 = $$2465;$$3485 = $$1483;$$3534 = $$1480;$$4462 = $$3461;$$8475 = $$6473;$$9528 = $$6525;
         }
        }
       }
       else if ((label|0) == 170) {
        label = 0;
        $410 = ((($$12517)) + 24|0);
        $411 = HEAP32[$410>>2]|0;
        $412 = ($411|0)==(0|0);
        if ($412) {
         break;
        }
        $413 = ((($$12517)) + 8|0);
        $414 = HEAP32[$413>>2]|0;
        $415 = ((($414)) + 20|0);
        $416 = HEAP32[$415>>2]|0;
        $417 = $416 & 256;
        $418 = ($417|0)==(0);
        if (!($418)) {
         $419 = ((($$12517)) + 12|0);
         $420 = HEAP32[$419>>2]|0;
         $421 = (($$0529$ph) + ($420<<2)|0);
         HEAP32[$421>>2] = 0;
        }
        $422 = HEAP32[$$12517>>2]|0;
        $423 = ((($$12517)) + 4|0);
        $424 = HEAP32[$423>>2]|0;
        $425 = ((($$12517)) + 16|0);
        $426 = HEAP32[$425>>2]|0;
        HEAP32[$5>>2] = $426;
        $427 = HEAP32[$17>>2]|0;
        $428 = ($427|0)>(0);
        if ($428) {
         $429 = ((($$12517)) + 20|0);
         $430 = HEAP32[$429>>2]|0;
         $$0612 = 0;
         while(1) {
          $431 = (($430) + ($$0612<<2)|0);
          $432 = HEAP32[$431>>2]|0;
          $433 = (($$0535) + ($$0612<<2)|0);
          HEAP32[$433>>2] = $432;
          $434 = (($$0612) + 1)|0;
          $435 = ($434|0)<($427|0);
          if ($435) {
           $$0612 = $434;
          } else {
           $$13518 = $411;$$3466 = $422;$$3485 = $$2484;$$3534 = $414;$$4462 = $424;$$8475 = $$7474;$$9528 = $$8527;
           break;
          }
         }
        } else {
         $$13518 = $411;$$3466 = $422;$$3485 = $$2484;$$3534 = $414;$$4462 = $424;$$8475 = $$7474;$$9528 = $$8527;
        }
       }
       $$0463 = $$3466;$$1459 = $$4462;$$1483 = $$3485;$$2469 = $$8475;$$2533 = $$3534;$$4523 = $$9528;$$6511 = $$13518;
       label = 79;
      }
      $436 = ($$2484|0)>(-1);
      $437 = HEAP32[$5>>2]|0;
      $438 = ($437|0)==(0);
      $or$cond51 = $436 | $438;
      if ($or$cond51) {
       label = 179;
       break;
      }
      HEAP32[$5>>2] = $56;
      $$pre = HEAP32[$17>>2]|0;
      $$0458 = $55;$$0467 = $$7474;$$0476 = $51;$$0482 = $$2484;$$0505 = $$12517;$41 = $$pre;$62 = $56;
     }
     if ((label|0) == 53) {
      ___tre_mem_destroy($11);
      $130 = ($$0535|0)==(0|0);
      if (!($130)) {
       _free($131);
      }
      $132 = ($$0501|0)==(0|0);
      if (!($132)) {
       _free($133);
      }
      $134 = ($$0529$ph|0)==(0|0);
      if ($134) {
       $$14 = 12;
       break L1;
      }
      _free($$ph);
      $$14 = 12;
      break L1;
     }
     else if ((label|0) == 60) {
      ___tre_mem_destroy($11);
      $142 = ($$0535|0)==(0|0);
      if (!($142)) {
       _free($131);
      }
      $143 = ($$0501|0)==(0|0);
      if (!($143)) {
       _free($133);
      }
      $144 = ($$0529$ph|0)==(0|0);
      if ($144) {
       $$14 = 12;
       break L1;
      }
      _free($$ph);
      $$14 = 12;
      break L1;
     }
     else if ((label|0) == 144) {
      ___tre_mem_destroy($11);
      $354 = ($$0535|0)==(0|0);
      if (!($354)) {
       _free($131);
      }
      $355 = ($$0501|0)==(0|0);
      if (!($355)) {
       _free($133);
      }
      $356 = ($$0529$ph|0)==(0|0);
      if ($356) {
       $$14 = 12;
       break L1;
      }
      _free($$ph);
      $$14 = 12;
      break L1;
     }
     else if ((label|0) == 151) {
      ___tre_mem_destroy($11);
      $364 = ($$0535|0)==(0|0);
      if (!($364)) {
       _free($131);
      }
      $365 = ($$0501|0)==(0|0);
      if (!($365)) {
       _free($133);
      }
      $366 = ($$0529$ph|0)==(0|0);
      if ($366) {
       $$14 = 12;
       break L1;
      }
      _free($$ph);
      $$14 = 12;
      break L1;
     }
     else if ((label|0) == 179) {
      $not$ = $436 ^ 1;
      $439 = $not$&1;
      HEAP32[$4>>2] = $$2484;
      $$1502 = $$0501;$$1530 = $$0529$ph;$$1536 = $$0535;$$6500 = $439;$441 = $131;$443 = $133;$445 = $$ph;
      break;
     }
    }
   } while(0);
   ___tre_mem_destroy($11);
   $440 = ($$1536|0)==(0|0);
   if (!($440)) {
    _free($441);
   }
   $442 = ($$1502|0)==(0|0);
   if (!($442)) {
    _free($443);
   }
   $444 = ($$1530|0)==(0|0);
   if ($444) {
    $$14 = $$6500;
   } else {
    _free($445);
    $$14 = $$6500;
   }
  }
 } while(0);
 STACKTOP = sp;return ($$14|0);
}
function _tre_tnfa_run_parallel($0,$1,$2,$3,$4) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 var $$ = 0, $$0415 = 0, $$0420587 = 0, $$0421 = 0, $$0422 = 0, $$0423 = 0, $$0426 = 0, $$0427$ph533 = 0, $$0427511 = 0, $$0432 = 0, $$0437 = 0, $$0448586 = 0, $$0456 = 0, $$0457523 = 0, $$0460 = 0, $$0468540 = 0, $$1 = 0, $$10 = 0, $$10447 = 0, $$10447$lobit = 0;
 var $$1424 = 0, $$1428565 = 0, $$1430 = 0, $$1433$ph$lcssa = 0, $$1433$ph531 = 0, $$1433$ph532$mux = 0, $$1438$ph$lcssa = 0, $$1438$ph529 = 0, $$1438$ph530$mux = 0, $$1449584 = 0, $$1458549 = 0, $$1461$ph$lcssa = 0, $$1461$ph527 = 0, $$1469574 = 0, $$1471 = 0, $$1474 = 0, $$2425 = 0, $$2431$lcssa = 0, $$2431578 = 0, $$2434 = 0;
 var $$2439 = 0, $$2462 = 0, $$2472 = 0, $$2475 = 0, $$3$lcssa = 0, $$3435 = 0, $$3440 = 0, $$3451525 = 0, $$3463$lcssa = 0, $$3463542 = 0, $$4 = 0, $$4436 = 0, $$4441 = 0, $$4452537 = 0, $$4464 = 0, $$477 = 0, $$5 = 0, $$5442$lcssa = 0, $$5442576 = 0, $$5453546 = 0;
 var $$5465$lcssa = 0, $$5465575 = 0, $$6$lcssa = 0, $$6443$lcssa = 0, $$6443556 = 0, $$6454553 = 0, $$6466$lcssa = 0, $$6466555 = 0, $$6577 = 0, $$7$lcssa = 0, $$7444 = 0, $$7455551 = 0, $$7467 = 0, $$7559 = 0, $$8 = 0, $$9446 = 0, $$not = 0, $$not597 = 0, $$old = 0, $$old34 = 0;
 var $$old35 = 0, $$old46 = 0, $$old47 = 0, $$old8 = 0, $$pre = 0, $$pre$phi630Z2D = 0, $$pre$phi632Z2D = 0, $$pre619 = 0, $$pre620 = 0, $$pre622 = 0, $$pre624 = 0, $$pre625 = 0, $$pre626 = 0, $$pre628 = 0, $$pre631 = 0, $10 = 0, $100 = 0, $101 = 0, $102 = 0, $103 = 0;
 var $104 = 0, $105 = 0, $106 = 0, $107 = 0, $108 = 0, $109 = 0, $11 = 0, $110 = 0, $111 = 0, $112 = 0, $113 = 0, $114 = 0, $115 = 0, $116 = 0, $117 = 0, $118 = 0, $119 = 0, $12 = 0, $120 = 0, $121 = 0;
 var $122 = 0, $123 = 0, $124 = 0, $125 = 0, $126 = 0, $127 = 0, $128 = 0, $129 = 0, $13 = 0, $130 = 0, $131 = 0, $132 = 0, $133 = 0, $134 = 0, $135 = 0, $136 = 0, $137 = 0, $138 = 0, $139 = 0, $14 = 0;
 var $140 = 0, $141 = 0, $142 = 0, $143 = 0, $144 = 0, $145 = 0, $146 = 0, $147 = 0, $148 = 0, $149 = 0, $15 = 0, $150 = 0, $151 = 0, $152 = 0, $153 = 0, $154 = 0, $155 = 0, $156 = 0, $157 = 0, $158 = 0;
 var $159 = 0, $16 = 0, $160 = 0, $161 = 0, $162 = 0, $163 = 0, $164 = 0, $165 = 0, $166 = 0, $167 = 0, $168 = 0, $169 = 0, $17 = 0, $170 = 0, $171 = 0, $172 = 0, $173 = 0, $174 = 0, $175 = 0, $176 = 0;
 var $177 = 0, $178 = 0, $179 = 0, $18 = 0, $180 = 0, $181 = 0, $182 = 0, $183 = 0, $184 = 0, $185 = 0, $186 = 0, $187 = 0, $188 = 0, $189 = 0, $19 = 0, $190 = 0, $191 = 0, $192 = 0, $193 = 0, $194 = 0;
 var $195 = 0, $196 = 0, $197 = 0, $198 = 0, $199 = 0, $20 = 0, $200 = 0, $201 = 0, $202 = 0, $203 = 0, $204 = 0, $205 = 0, $206 = 0, $207 = 0, $208 = 0, $209 = 0, $21 = 0, $210 = 0, $211 = 0, $212 = 0;
 var $213 = 0, $214 = 0, $215 = 0, $216 = 0, $217 = 0, $218 = 0, $219 = 0, $22 = 0, $220 = 0, $221 = 0, $222 = 0, $223 = 0, $224 = 0, $225 = 0, $226 = 0, $227 = 0, $228 = 0, $229 = 0, $23 = 0, $230 = 0;
 var $231 = 0, $232 = 0, $233 = 0, $234 = 0, $235 = 0, $236 = 0, $237 = 0, $238 = 0, $239 = 0, $24 = 0, $240 = 0, $241 = 0, $242 = 0, $243 = 0, $244 = 0, $245 = 0, $246 = 0, $247 = 0, $248 = 0, $249 = 0;
 var $25 = 0, $250 = 0, $251 = 0, $252 = 0, $253 = 0, $254 = 0, $255 = 0, $256 = 0, $257 = 0, $258 = 0, $259 = 0, $26 = 0, $260 = 0, $261 = 0, $262 = 0, $263 = 0, $264 = 0, $265 = 0, $266 = 0, $267 = 0;
 var $268 = 0, $269 = 0, $27 = 0, $270 = 0, $271 = 0, $272 = 0, $273 = 0, $274 = 0, $275 = 0, $276 = 0, $277 = 0, $278 = 0, $279 = 0, $28 = 0, $280 = 0, $281 = 0, $282 = 0, $283 = 0, $284 = 0, $285 = 0;
 var $286 = 0, $287 = 0, $288 = 0, $289 = 0, $29 = 0, $290 = 0, $291 = 0, $292 = 0, $293 = 0, $294 = 0, $295 = 0, $296 = 0, $297 = 0, $298 = 0, $299 = 0, $30 = 0, $300 = 0, $301 = 0, $302 = 0, $303 = 0;
 var $304 = 0, $305 = 0, $306 = 0, $307 = 0, $308 = 0, $309 = 0, $31 = 0, $310 = 0, $311 = 0, $312 = 0, $313 = 0, $314 = 0, $315 = 0, $316 = 0, $317 = 0, $318 = 0, $319 = 0, $32 = 0, $320 = 0, $321 = 0;
 var $322 = 0, $323 = 0, $324 = 0, $325 = 0, $326 = 0, $327 = 0, $328 = 0, $329 = 0, $33 = 0, $330 = 0, $331 = 0, $332 = 0, $333 = 0, $334 = 0, $335 = 0, $336 = 0, $337 = 0, $338 = 0, $339 = 0, $34 = 0;
 var $340 = 0, $341 = 0, $342 = 0, $343 = 0, $344 = 0, $345 = 0, $346 = 0, $347 = 0, $348 = 0, $349 = 0, $35 = 0, $350 = 0, $351 = 0, $352 = 0, $353 = 0, $354 = 0, $355 = 0, $356 = 0, $357 = 0, $358 = 0;
 var $359 = 0, $36 = 0, $360 = 0, $361 = 0, $362 = 0, $363 = 0, $364 = 0, $365 = 0, $366 = 0, $367 = 0, $368 = 0, $369 = 0, $37 = 0, $370 = 0, $371 = 0, $372 = 0, $373 = 0, $374 = 0, $375 = 0, $376 = 0;
 var $377 = 0, $378 = 0, $379 = 0, $38 = 0, $380 = 0, $381 = 0, $382 = 0, $383 = 0, $384 = 0, $385 = 0, $386 = 0, $387 = 0, $388 = 0, $389 = 0, $39 = 0, $390 = 0, $391 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $5 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0;
 var $61 = 0, $62 = 0, $63 = 0, $64 = 0, $65 = 0, $66 = 0, $67 = 0, $68 = 0, $69 = 0, $7 = 0, $70 = 0, $71 = 0, $72 = 0, $73 = 0, $74 = 0, $75 = 0, $76 = 0, $77 = 0, $78 = 0, $79 = 0;
 var $8 = 0, $80 = 0, $81 = 0, $82 = 0, $83 = 0, $84 = 0, $85 = 0, $86 = 0, $87 = 0, $88 = 0, $89 = 0, $9 = 0, $90 = 0, $91 = 0, $92 = 0, $93 = 0, $94 = 0, $95 = 0, $96 = 0, $97 = 0;
 var $98 = 0, $99 = 0, $brmerge = 0, $brmerge590 = 0, $brmerge593 = 0, $brmerge594 = 0, $brmerge598 = 0, $exitcond = 0, $exitcond615 = 0, $exitcond617 = 0, $notlhs = 0, $notlhs601 = 0, $notrhs = 0, $notrhs602 = 0, $or$cond$not = 0, $or$cond12 = 0, $or$cond15 = 0, $or$cond18 = 0, $or$cond21 = 0, $or$cond24$not = 0;
 var $or$cond27 = 0, $or$cond3 = 0, $or$cond33 = 0, $or$cond36 = 0, $or$cond39 = 0, $or$cond42 = 0, $or$cond45 = 0, $or$cond48 = 0, $or$cond592 = 0, $or$cond596 = 0, $or$cond7 = 0, $or$cond9 = 0, $tmp = 0, $tmp476 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 STACKTOP = STACKTOP + 16|0; if ((STACKTOP|0) >= (STACK_MAX|0)) abortStackOverflow(16|0);
 $5 = sp;
 HEAP32[$5>>2] = 0;
 $6 = $3 & 1;
 $7 = $3 & 2;
 $8 = ((($0)) + 56|0);
 $9 = HEAP32[$8>>2]|0;
 $10 = $9 & 4;
 $11 = ($2|0)==(0|0);
 if ($11) {
  $$0456 = 0;
 } else {
  $12 = ((($0)) + 40|0);
  $13 = HEAP32[$12>>2]|0;
  $$0456 = $13;
 }
 $14 = $$0456 << 2;
 $15 = ((($0)) + 52|0);
 $16 = HEAP32[$15>>2]|0;
 $17 = $16 << 3;
 $18 = (($17) + 8)|0;
 $19 = Math_imul($14, $16)|0;
 $20 = (($18) + ($19))|0;
 $21 = $20 << 1;
 $22 = (($14) + 12)|0;
 $23 = (($22) + ($17))|0;
 $24 = (($23) + ($21))|0;
 $25 = (_malloc($24)|0);
 $26 = ($25|0)==(0|0);
 if ($26) {
  $$1 = 12;
 } else {
  _memset(($25|0),0,($24|0))|0;
  $27 = (($25) + ($14)|0);
  $28 = $27;
  $29 = $28 & 3;
  $30 = ($29|0)==(0);
  $31 = (4 - ($29))|0;
  $$ = $30 ? 0 : $31;
  $32 = (($27) + ($$)|0);
  $33 = (($32) + ($18)|0);
  $34 = $33;
  $35 = $34 & 3;
  $36 = ($35|0)==(0);
  $37 = (4 - ($35))|0;
  $38 = $36 ? 0 : $37;
  $39 = (($33) + ($38)|0);
  $40 = (($39) + ($18)|0);
  $41 = $40;
  $42 = $41 & 3;
  $43 = ($42|0)==(0);
  $44 = (4 - ($42))|0;
  $$477 = $43 ? 0 : $44;
  $45 = (($40) + ($$477)|0);
  $46 = (($45) + ($17)|0);
  $47 = $46;
  $48 = $47 & 3;
  $49 = ($16|0)>(0);
  if ($49) {
   $50 = ($48|0)==(0);
   $51 = (4 - ($48))|0;
   $52 = $50 ? 0 : $51;
   $53 = (($46) + ($52)|0);
   $$0420587 = $53;$$0448586 = 0;
   while(1) {
    $54 = (((($39) + ($$0448586<<3)|0)) + 4|0);
    HEAP32[$54>>2] = $$0420587;
    $55 = (($$0420587) + ($14)|0);
    $56 = (((($32) + ($$0448586<<3)|0)) + 4|0);
    HEAP32[$56>>2] = $55;
    $57 = (($55) + ($14)|0);
    $58 = (($$0448586) + 1)|0;
    $59 = ($58|0)<($16|0);
    if ($59) {
     $$0420587 = $57;$$0448586 = $58;
    } else {
     break;
    }
   }
   if ($49) {
    $$1449584 = 0;
    while(1) {
     $60 = (($45) + ($$1449584<<3)|0);
     HEAP32[$60>>2] = -1;
     $61 = (($$1449584) + 1)|0;
     $62 = ($61|0)<($16|0);
     if ($62) {
      $$1449584 = $61;
     } else {
      break;
     }
    }
   }
  }
  $63 = (_mbtowc($5,$1,4)|0);
  $64 = ($63|0)<(1);
  if ($64) {
   $65 = ($63|0)<(0);
   if ($65) {
    $$0426 = 1;
   } else {
    $$0423 = 1;
    label = 11;
   }
  } else {
   $$0423 = $63;
   label = 11;
  }
  L16: do {
   if ((label|0) == 11) {
    $66 = (($1) + ($$0423)|0);
    $67 = ((($0)) + 8|0);
    $68 = ($10|0)!=(0);
    $69 = ($$0456|0)>(0);
    $70 = ((($0)) + 12|0);
    $71 = ((($0)) + 44|0);
    $72 = ((($0)) + 32|0);
    $73 = ((($0)) + 36|0);
    $74 = ($$0456|0)==(0);
    $notlhs601 = ($6|0)==(0);
    $$not597 = ($$0456|0)<(1);
    $notlhs = ($6|0)==(0);
    $$0415 = 0;$$0421 = $66;$$0422 = 0;$$0432 = 0;$$0437 = -1;$$0460 = $32;$$1424 = $$0423;$$1430 = $25;$$1471 = $32;$$1474 = $39;
    while(1) {
     $75 = ($$0437|0)<(0);
     if ($75) {
      $76 = HEAP32[$67>>2]|0;
      $77 = ((($76)) + 8|0);
      $78 = HEAP32[$77>>2]|0;
      $79 = ($78|0)==(0|0);
      L22: do {
       if ($79) {
        $$1433$ph$lcssa = $$0432;$$1438$ph$lcssa = $$0437;$$1461$ph$lcssa = $$0460;
       } else {
        $80 = ($$0422|0)!=(0);
        $81 = ($$0415|0)==(95);
        $82 = ($$0422|0)==(0);
        $83 = ($$0415|0)==(10);
        $or$cond3 = $68 & $83;
        $notrhs602 = ($$0422|0)<(1);
        $or$cond$not = $notrhs602 & $notlhs601;
        $$0427$ph533 = $76;$$1433$ph531 = $$0432;$$1438$ph529 = $$0437;$$1461$ph527 = $$0460;$391 = $77;
        while(1) {
         $$0427511 = $$0427$ph533;$148 = $391;
         L26: while(1) {
          $84 = ((($$0427511)) + 12|0);
          $85 = HEAP32[$84>>2]|0;
          $86 = (($45) + ($85<<3)|0);
          $87 = HEAP32[$86>>2]|0;
          $88 = ($87|0)<($$0422|0);
          if (!($88)) {
           $$2462 = $$1461$ph527;$$3435 = $$1433$ph531;$$3440 = $$1438$ph529;
           break;
          }
          $89 = ((($$0427511)) + 20|0);
          $90 = HEAP32[$89>>2]|0;
          $91 = ($90|0)==(0);
          if ($91) {
           label = 46;
           break;
          }
          $92 = $90 & 1;
          $93 = ($92|0)==(0);
          $brmerge = $93 | $or$cond$not;
          $brmerge590 = $brmerge | $or$cond3;
          L30: do {
           if ($brmerge590) {
            $94 = $90 & 2;
            $95 = ($94|0)==(0);
            if (!($95)) {
             $96 = HEAP32[$5>>2]|0;
             $97 = $96 | $7;
             $98 = ($97|0)==(0);
             $99 = ($96|0)==(10);
             $or$cond7 = $68 & $99;
             $or$cond592 = $98 | $or$cond7;
             if (!($or$cond592)) {
              break;
             }
            }
            $100 = $90 & 16;
            $101 = ($100|0)==(0);
            do {
             if (!($101)) {
              if ($81) {
               break L30;
              }
              $102 = (_iswalnum($$0415)|0);
              $103 = ($102|0)==(0);
              if (!($103)) {
               break L30;
              }
              $104 = HEAP32[$5>>2]|0;
              $105 = ($104|0)==(95);
              if ($105) {
               break;
              }
              $106 = (_iswalnum($104)|0);
              $107 = ($106|0)==(0);
              if ($107) {
               break L30;
              }
             }
            } while(0);
            $108 = HEAP32[$89>>2]|0;
            $109 = $108 & 32;
            $110 = ($109|0)==(0);
            if ($110) {
             $119 = $108;
            } else {
             if ($81) {
              $$old = HEAP32[$5>>2]|0;
              $$old8 = ($$old|0)==(95);
              if ($$old8) {
               break;
              } else {
               $115 = $$old;
              }
             } else {
              $111 = (_iswalnum($$0415)|0);
              $112 = ($111|0)==(0);
              $113 = HEAP32[$5>>2]|0;
              $114 = ($113|0)==(95);
              $or$cond9 = $112 | $114;
              if ($or$cond9) {
               break;
              } else {
               $115 = $113;
              }
             }
             $116 = (_iswalnum($115)|0);
             $117 = ($116|0)==(0);
             if (!($117)) {
              break;
             }
             $$pre = HEAP32[$89>>2]|0;
             $119 = $$pre;
            }
            $118 = $119 & 64;
            $120 = ($118|0)!=(0);
            $or$cond12 = $80 & $120;
            $121 = HEAP32[$5>>2]|0;
            $122 = ($121|0)!=(0);
            $or$cond15 = $122 & $or$cond12;
            do {
             if ($or$cond15) {
              if ($81) {
               $125 = $121;$129 = 1;
              } else {
               $123 = (_iswalnum($$0415)|0);
               $124 = ($123|0)!=(0);
               $$pre619 = HEAP32[$5>>2]|0;
               $125 = $$pre619;$129 = $124;
              }
              $126 = ($125|0)==(95);
              if ($126) {
               if ($129) {
                break L30;
               } else {
                break;
               }
              } else {
               $127 = (_iswalnum($125)|0);
               $128 = ($127|0)!=(0);
               $tmp476 = $129 ^ $128;
               if ($tmp476) {
                break;
               } else {
                break L30;
               }
              }
             }
            } while(0);
            $130 = HEAP32[$89>>2]|0;
            $131 = $130 & 128;
            $132 = ($131|0)==(0);
            if ($132) {
             label = 46;
             break L26;
            }
            $133 = HEAP32[$5>>2]|0;
            $134 = ($133|0)==(0);
            $or$cond18 = $82 | $134;
            if ($or$cond18) {
             break;
            }
            if ($81) {
             $137 = $133;$142 = 1;
            } else {
             $135 = (_iswalnum($$0415)|0);
             $136 = ($135|0)!=(0);
             $$pre620 = HEAP32[$5>>2]|0;
             $137 = $$pre620;$142 = $136;
            }
            $138 = ($137|0)==(95);
            if ($138) {
             if ($142) {
              label = 46;
              break L26;
             } else {
              break;
             }
            } else {
             $139 = (_iswalnum($137)|0);
             $140 = ($139|0)!=(0);
             $141 = $142 ^ $140;
             if ($141) {
              break;
             } else {
              label = 46;
              break L26;
             }
            }
           }
          } while(0);
          $143 = ((($$0427511)) + 32|0);
          $144 = ((($$0427511)) + 40|0);
          $145 = HEAP32[$144>>2]|0;
          $146 = ($145|0)==(0|0);
          if ($146) {
           $$1433$ph$lcssa = $$1433$ph531;$$1438$ph$lcssa = $$1438$ph529;$$1461$ph$lcssa = $$1461$ph527;
           break L22;
          } else {
           $$0427511 = $143;$148 = $144;
          }
         }
         if ((label|0) == 46) {
          label = 0;
          $147 = HEAP32[$148>>2]|0;
          HEAP32[$$1461$ph527>>2] = $147;
          if ($69) {
           $149 = ((($$1461$ph527)) + 4|0);
           $150 = HEAP32[$149>>2]|0;
           _memset(($150|0),-1,($14|0))|0;
          }
          $151 = ((($$0427511)) + 16|0);
          $152 = HEAP32[$151>>2]|0;
          $153 = ($152|0)==(0|0);
          if (!($153)) {
           $154 = HEAP32[$152>>2]|0;
           $155 = ($154|0)>(-1);
           if ($155) {
            $156 = ((($$1461$ph527)) + 4|0);
            $$0457523 = $152;$157 = $154;
            while(1) {
             $158 = ($157|0)<($$0456|0);
             if ($158) {
              $159 = HEAP32[$156>>2]|0;
              $160 = (($159) + ($157<<2)|0);
              HEAP32[$160>>2] = $$0422;
             }
             $161 = ((($$0457523)) + 4|0);
             $162 = HEAP32[$161>>2]|0;
             $163 = ($162|0)>(-1);
             if ($163) {
              $$0457523 = $161;$157 = $162;
             } else {
              break;
             }
            }
           }
          }
          $164 = HEAP32[$$1461$ph527>>2]|0;
          $165 = HEAP32[$70>>2]|0;
          $$not = ($164|0)!=($165|0);
          $brmerge598 = $$not | $$not597;
          if ($brmerge598) {
           $$1433$ph532$mux = $$not ? $$1433$ph531 : 1;
           $$1438$ph530$mux = $$not ? $$1438$ph529 : $$0422;
           $$pre631 = ((($$1461$ph527)) + 4|0);
           $$2434 = $$1433$ph532$mux;$$2439 = $$1438$ph530$mux;$$pre$phi632Z2D = $$pre631;
          } else {
           $166 = ((($$1461$ph527)) + 4|0);
           $167 = HEAP32[$166>>2]|0;
           $$3451525 = 0;
           while(1) {
            $168 = (($167) + ($$3451525<<2)|0);
            $169 = HEAP32[$168>>2]|0;
            $170 = (($2) + ($$3451525<<2)|0);
            HEAP32[$170>>2] = $169;
            $171 = (($$3451525) + 1)|0;
            $exitcond = ($171|0)==($$0456|0);
            if ($exitcond) {
             $$2434 = 1;$$2439 = $$0422;$$pre$phi632Z2D = $166;
             break;
            } else {
             $$3451525 = $171;
            }
           }
          }
          $172 = HEAP32[$84>>2]|0;
          $173 = (($45) + ($172<<3)|0);
          HEAP32[$173>>2] = $$0422;
          $174 = (((($45) + ($172<<3)|0)) + 4|0);
          HEAP32[$174>>2] = $$pre$phi632Z2D;
          $175 = ((($$1461$ph527)) + 8|0);
          $$2462 = $175;$$3435 = $$2434;$$3440 = $$2439;
         }
         $176 = ((($$0427511)) + 32|0);
         $177 = ((($$0427511)) + 40|0);
         $178 = HEAP32[$177>>2]|0;
         $179 = ($178|0)==(0|0);
         if ($179) {
          $$1433$ph$lcssa = $$3435;$$1438$ph$lcssa = $$3440;$$1461$ph$lcssa = $$2462;
          break;
         } else {
          $$0427$ph533 = $176;$$1433$ph531 = $$3435;$$1438$ph529 = $$3440;$$1461$ph527 = $$2462;$391 = $177;
         }
        }
       }
      } while(0);
      HEAP32[$$1461$ph$lcssa>>2] = 0;
      $$old46 = HEAP32[$5>>2]|0;
      $$old47 = ($$old46|0)==(0);
      if ($$old47) {
       $$10447 = $$1438$ph$lcssa;
       break;
      } else {
       $$4436 = $$1433$ph$lcssa;$$4441 = $$1438$ph$lcssa;$229 = $$old46;
      }
     } else {
      if ($74) {
       $$10447 = $$0437;
       break;
      }
      $180 = ($$0460|0)!=($$1471|0);
      $181 = HEAP32[$5>>2]|0;
      $182 = ($181|0)!=(0);
      $or$cond48 = $180 & $182;
      if ($or$cond48) {
       $$4436 = $$0432;$$4441 = $$0437;$229 = $181;
      } else {
       $$10447 = $$0437;
       break;
      }
     }
     $183 = (($$0422) + ($$1424))|0;
     $184 = (_mbtowc($5,$$0421,4)|0);
     $185 = ($184|0)<(1);
     if ($185) {
      $186 = ($184|0)<(0);
      if ($186) {
       $$0426 = 1;
       break L16;
      } else {
       $$2425 = 1;
      }
     } else {
      $$2425 = $184;
     }
     $187 = (($$0421) + ($$2425)|0);
     $188 = HEAP32[$71>>2]|0;
     $189 = ($188|0)!=(0);
     $190 = ($$4436|0)!=(0);
     $or$cond21 = $190 & $189;
     if ($or$cond21) {
      $191 = HEAP32[$$1471>>2]|0;
      $192 = ($191|0)==(0|0);
      if ($192) {
       $$3463$lcssa = $$1474;
      } else {
       $193 = HEAP32[$73>>2]|0;
       $194 = HEAP32[$193>>2]|0;
       $195 = ($194|0)>(-1);
       $$0468540 = $$1471;$$3463542 = $$1474;
       while(1) {
        $196 = ((($$0468540)) + 4|0);
        L101: do {
         if ($195) {
          $$4452537 = 0;$200 = $194;
          while(1) {
           $197 = $$4452537 | 1;
           $198 = (($193) + ($197<<2)|0);
           $199 = HEAP32[$198>>2]|0;
           $201 = ($200|0)<($$0456|0);
           if (!($201)) {
            $$4464 = $$3463542;
            break L101;
           }
           $202 = HEAP32[$196>>2]|0;
           $203 = (($202) + ($199<<2)|0);
           $204 = HEAP32[$203>>2]|0;
           $205 = (($2) + ($199<<2)|0);
           $206 = HEAP32[$205>>2]|0;
           $207 = ($204|0)==($206|0);
           if ($207) {
            $208 = (($202) + ($200<<2)|0);
            $209 = HEAP32[$208>>2]|0;
            $210 = (($2) + ($200<<2)|0);
            $211 = HEAP32[$210>>2]|0;
            $212 = ($209|0)<($211|0);
            if ($212) {
             $$4464 = $$3463542;
             break L101;
            }
           }
           $213 = (($$4452537) + 2)|0;
           $214 = (($193) + ($213<<2)|0);
           $215 = HEAP32[$214>>2]|0;
           $216 = ($215|0)>(-1);
           if ($216) {
            $$4452537 = $213;$200 = $215;
           } else {
            break;
           }
          }
          $217 = $202;
          $$pre$phi630Z2D = $196;$221 = $217;
          label = 75;
         } else {
          $$pre622 = HEAP32[$196>>2]|0;
          $$pre$phi630Z2D = $196;$221 = $$pre622;
          label = 75;
         }
        } while(0);
        if ((label|0) == 75) {
         label = 0;
         $218 = HEAP32[$$0468540>>2]|0;
         HEAP32[$$3463542>>2] = $218;
         $219 = ((($$3463542)) + 4|0);
         $220 = HEAP32[$219>>2]|0;
         HEAP32[$219>>2] = $221;
         HEAP32[$$pre$phi630Z2D>>2] = $220;
         $222 = ((($$3463542)) + 8|0);
         $$4464 = $222;
        }
        $223 = ((($$0468540)) + 8|0);
        $224 = HEAP32[$223>>2]|0;
        $225 = ($224|0)==(0|0);
        if ($225) {
         $$3463$lcssa = $$4464;
         break;
        } else {
         $$0468540 = $223;$$3463542 = $$4464;
        }
       }
      }
      HEAP32[$$3463$lcssa>>2] = 0;
      $$2472 = $$1471;$$2475 = $$1474;$$5 = 0;
     } else {
      $$2472 = $$1474;$$2475 = $$1471;$$5 = $$4436;
     }
     $226 = HEAP32[$$2475>>2]|0;
     $227 = ($226|0)==(0|0);
     if ($227) {
      $$2431$lcssa = $$1430;$$5442$lcssa = $$4441;$$5465$lcssa = $$2472;$$6$lcssa = $$5;
     } else {
      $228 = ($183|0)!=(0);
      $230 = ($229|0)==(95);
      $231 = ($183|0)==(0);
      $232 = ($229|0)==(10);
      $or$cond27 = $68 & $232;
      $notrhs = ($183|0)<(1);
      $or$cond24$not = $notrhs & $notlhs;
      $$1469574 = $$2475;$$2431578 = $$1430;$$5442576 = $$4441;$$5465575 = $$2472;$$6577 = $$5;$234 = $226;
      while(1) {
       $233 = ((($234)) + 8|0);
       $235 = HEAP32[$233>>2]|0;
       $236 = ($235|0)==(0|0);
       if ($236) {
        $$3$lcssa = $$2431578;$$6443$lcssa = $$5442576;$$6466$lcssa = $$5465575;$$7$lcssa = $$6577;
       } else {
        $237 = ((($$1469574)) + 4|0);
        $$1428565 = $234;$$6443556 = $$5442576;$$6466555 = $$5465575;$$7559 = $$6577;$335 = $$2431578;$354 = $233;
        while(1) {
         $238 = HEAP32[$$1428565>>2]|0;
         $239 = ($238>>>0)>($229>>>0);
         L123: do {
          if ($239) {
           $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
          } else {
           $240 = ((($$1428565)) + 4|0);
           $241 = HEAP32[$240>>2]|0;
           $242 = ($241>>>0)<($229>>>0);
           if ($242) {
            $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
           } else {
            $243 = ((($$1428565)) + 20|0);
            $244 = HEAP32[$243>>2]|0;
            $245 = ($244|0)==(0);
            do {
             if (!($245)) {
              $246 = $244 & 1;
              $247 = ($246|0)==(0);
              $brmerge593 = $247 | $or$cond24$not;
              $brmerge594 = $brmerge593 | $or$cond27;
              if (!($brmerge594)) {
               $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
               break L123;
              }
              $248 = $244 & 2;
              $249 = ($248|0)==(0);
              if (!($249)) {
               $250 = HEAP32[$5>>2]|0;
               $251 = $250 | $7;
               $252 = ($251|0)==(0);
               $253 = ($250|0)==(10);
               $or$cond33 = $68 & $253;
               $or$cond596 = $252 | $or$cond33;
               if (!($or$cond596)) {
                $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                break L123;
               }
              }
              $254 = $244 & 16;
              $255 = ($254|0)==(0);
              do {
               if (!($255)) {
                if ($230) {
                 $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                 break L123;
                }
                $256 = (_iswalnum($229)|0);
                $257 = ($256|0)==(0);
                if (!($257)) {
                 $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                 break L123;
                }
                $258 = HEAP32[$5>>2]|0;
                $259 = ($258|0)==(95);
                if ($259) {
                 break;
                }
                $260 = (_iswalnum($258)|0);
                $261 = ($260|0)==(0);
                if ($261) {
                 $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                 break L123;
                }
               }
              } while(0);
              $262 = HEAP32[$243>>2]|0;
              $263 = $262 & 32;
              $264 = ($263|0)==(0);
              if ($264) {
               $273 = $262;
              } else {
               if ($230) {
                $$old34 = HEAP32[$5>>2]|0;
                $$old35 = ($$old34|0)==(95);
                if ($$old35) {
                 $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                 break L123;
                } else {
                 $269 = $$old34;
                }
               } else {
                $265 = (_iswalnum($229)|0);
                $266 = ($265|0)==(0);
                $267 = HEAP32[$5>>2]|0;
                $268 = ($267|0)==(95);
                $or$cond36 = $266 | $268;
                if ($or$cond36) {
                 $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                 break L123;
                } else {
                 $269 = $267;
                }
               }
               $270 = (_iswalnum($269)|0);
               $271 = ($270|0)==(0);
               if (!($271)) {
                $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                break L123;
               }
               $$pre624 = HEAP32[$243>>2]|0;
               $273 = $$pre624;
              }
              $272 = $273 & 64;
              $274 = ($272|0)!=(0);
              $or$cond39 = $228 & $274;
              $275 = HEAP32[$5>>2]|0;
              $276 = ($275|0)!=(0);
              $or$cond42 = $276 & $or$cond39;
              do {
               if ($or$cond42) {
                if ($230) {
                 $279 = $275;$283 = 1;
                } else {
                 $277 = (_iswalnum($229)|0);
                 $278 = ($277|0)!=(0);
                 $$pre625 = HEAP32[$5>>2]|0;
                 $279 = $$pre625;$283 = $278;
                }
                $280 = ($279|0)==(95);
                if ($280) {
                 if ($283) {
                  $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                  break L123;
                 } else {
                  break;
                 }
                } else {
                 $281 = (_iswalnum($279)|0);
                 $282 = ($281|0)!=(0);
                 $tmp = $283 ^ $282;
                 if ($tmp) {
                  break;
                 } else {
                  $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                  break L123;
                 }
                }
               }
              } while(0);
              $284 = HEAP32[$243>>2]|0;
              $285 = $284 & 128;
              $286 = ($285|0)==(0);
              do {
               if (!($286)) {
                $287 = HEAP32[$5>>2]|0;
                $288 = ($287|0)==(0);
                $or$cond45 = $231 | $288;
                if ($or$cond45) {
                 $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                 break L123;
                }
                if ($230) {
                 $291 = $287;$296 = 1;
                } else {
                 $289 = (_iswalnum($229)|0);
                 $290 = ($289|0)!=(0);
                 $$pre626 = HEAP32[$5>>2]|0;
                 $291 = $$pre626;$296 = $290;
                }
                $292 = ($291|0)==(95);
                if ($292) {
                 if ($296) {
                  break;
                 } else {
                  $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                  break L123;
                 }
                } else {
                 $293 = (_iswalnum($291)|0);
                 $294 = ($293|0)!=(0);
                 $295 = $296 ^ $294;
                 if ($295) {
                  $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                  break L123;
                 } else {
                  break;
                 }
                }
               }
              } while(0);
              $297 = HEAP32[$243>>2]|0;
              $298 = $297 & 4;
              $299 = ($298|0)==(0);
              do {
               if ($299) {
                $308 = $297;
               } else {
                $300 = HEAP32[$8>>2]|0;
                $301 = $300 & 2;
                $302 = ($301|0)==(0);
                if (!($302)) {
                 $308 = $297;
                 break;
                }
                $303 = ((($$1428565)) + 24|0);
                $304 = HEAP32[$303>>2]|0;
                $305 = (_iswctype($229,$304)|0);
                $306 = ($305|0)==(0);
                if ($306) {
                 $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                 break L123;
                }
                $$pre628 = HEAP32[$243>>2]|0;
                $308 = $$pre628;
               }
              } while(0);
              $307 = $308 & 4;
              $309 = ($307|0)==(0);
              do {
               if (!($309)) {
                $310 = HEAP32[$8>>2]|0;
                $311 = $310 & 2;
                $312 = ($311|0)==(0);
                if ($312) {
                 break;
                }
                $313 = (_towlower($229)|0);
                $314 = ((($$1428565)) + 24|0);
                $315 = HEAP32[$314>>2]|0;
                $316 = (_iswctype($313,$315)|0);
                $317 = ($316|0)==(0);
                if (!($317)) {
                 break;
                }
                $318 = (_towupper($229)|0);
                $319 = HEAP32[$314>>2]|0;
                $320 = (_iswctype($318,$319)|0);
                $321 = ($320|0)==(0);
                if ($321) {
                 $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
                 break L123;
                }
               }
              } while(0);
              $322 = HEAP32[$243>>2]|0;
              $323 = $322 & 8;
              $324 = ($323|0)==(0);
              if ($324) {
               break;
              }
              $325 = ((($$1428565)) + 28|0);
              $326 = HEAP32[$325>>2]|0;
              $327 = HEAP32[$8>>2]|0;
              $328 = $327 & 2;
              $329 = (_tre_neg_char_classes_match($326,$229,$328)|0);
              $330 = ($329|0)==(0);
              if (!($330)) {
               $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
               break L123;
              }
             }
            } while(0);
            if ($69) {
             $331 = HEAP32[$237>>2]|0;
             $$5453546 = 0;
             while(1) {
              $332 = (($331) + ($$5453546<<2)|0);
              $333 = HEAP32[$332>>2]|0;
              $334 = (($335) + ($$5453546<<2)|0);
              HEAP32[$334>>2] = $333;
              $336 = (($$5453546) + 1)|0;
              $exitcond615 = ($336|0)==($$0456|0);
              if ($exitcond615) {
               break;
              } else {
               $$5453546 = $336;
              }
             }
            }
            $337 = ((($$1428565)) + 16|0);
            $338 = HEAP32[$337>>2]|0;
            $339 = ($338|0)==(0|0);
            do {
             if (!($339)) {
              $340 = HEAP32[$338>>2]|0;
              $341 = ($340|0)>(-1);
              if ($341) {
               $$1458549 = $338;$342 = $340;
              } else {
               break;
              }
              while(1) {
               $343 = ($342|0)<($$0456|0);
               if ($343) {
                $344 = (($335) + ($342<<2)|0);
                HEAP32[$344>>2] = $183;
               }
               $345 = ((($$1458549)) + 4|0);
               $346 = HEAP32[$345>>2]|0;
               $347 = ($346|0)>(-1);
               if ($347) {
                $$1458549 = $345;$342 = $346;
               } else {
                break;
               }
              }
             }
            } while(0);
            $348 = ((($$1428565)) + 12|0);
            $349 = HEAP32[$348>>2]|0;
            $350 = (($45) + ($349<<3)|0);
            $351 = HEAP32[$350>>2]|0;
            $352 = ($351|0)<($183|0);
            if (!($352)) {
             $371 = HEAP32[$72>>2]|0;
             $372 = (((($45) + ($349<<3)|0)) + 4|0);
             $373 = HEAP32[$372>>2]|0;
             $374 = HEAP32[$373>>2]|0;
             $375 = (_tre_tag_order($$0456,$371,$335,$374)|0);
             $376 = ($375|0)==(0);
             if ($376) {
              $$10 = $$7559;$$4 = $335;$$7467 = $$6466555;$$9446 = $$6443556;
              break;
             }
             HEAP32[$373>>2] = $335;
             $377 = HEAP32[$354>>2]|0;
             $378 = HEAP32[$70>>2]|0;
             $379 = ($377|0)==($378|0);
             if (!($379)) {
              $$10 = $$7559;$$4 = $374;$$7467 = $$6466555;$$9446 = $$6443556;
              break;
             }
             if ($69) {
              $$7455551 = 0;
             } else {
              $$10 = 1;$$4 = $374;$$7467 = $$6466555;$$9446 = $183;
              break;
             }
             while(1) {
              $380 = (($335) + ($$7455551<<2)|0);
              $381 = HEAP32[$380>>2]|0;
              $382 = (($2) + ($$7455551<<2)|0);
              HEAP32[$382>>2] = $381;
              $383 = (($$7455551) + 1)|0;
              $exitcond617 = ($383|0)==($$0456|0);
              if ($exitcond617) {
               $$10 = 1;$$4 = $374;$$7467 = $$6466555;$$9446 = $183;
               break L123;
              } else {
               $$7455551 = $383;
              }
             }
            }
            $353 = HEAP32[$354>>2]|0;
            HEAP32[$$6466555>>2] = $353;
            $355 = ((($$6466555)) + 4|0);
            $356 = HEAP32[$355>>2]|0;
            HEAP32[$355>>2] = $335;
            HEAP32[$350>>2] = $183;
            $357 = (((($45) + ($349<<3)|0)) + 4|0);
            HEAP32[$357>>2] = $355;
            $358 = $353;
            $359 = HEAP32[$70>>2]|0;
            $360 = ($358|0)==($359|0);
            do {
             if ($360) {
              $361 = ($$6443556|0)==(-1);
              if ($361) {
               if ($69) {
                $$6454553 = 0;
               } else {
                $$7444 = $183;$$8 = 1;
                break;
               }
              } else {
               if (!($69)) {
                $$7444 = $$6443556;$$8 = $$7559;
                break;
               }
               $362 = HEAP32[$335>>2]|0;
               $363 = HEAP32[$2>>2]|0;
               $364 = ($362|0)>($363|0);
               if ($364) {
                $$7444 = $$6443556;$$8 = $$7559;
                break;
               } else {
                $$6454553 = 0;
               }
              }
              while(1) {
               $365 = (($335) + ($$6454553<<2)|0);
               $366 = HEAP32[$365>>2]|0;
               $367 = (($2) + ($$6454553<<2)|0);
               HEAP32[$367>>2] = $366;
               $368 = (($$6454553) + 1)|0;
               $369 = ($368|0)<($$0456|0);
               if ($369) {
                $$6454553 = $368;
               } else {
                $$7444 = $183;$$8 = 1;
                break;
               }
              }
             } else {
              $$7444 = $$6443556;$$8 = $$7559;
             }
            } while(0);
            $370 = ((($$6466555)) + 8|0);
            $$10 = $$8;$$4 = $356;$$7467 = $370;$$9446 = $$7444;
           }
          }
         } while(0);
         $384 = ((($$1428565)) + 32|0);
         $385 = ((($$1428565)) + 40|0);
         $386 = HEAP32[$385>>2]|0;
         $387 = ($386|0)==(0|0);
         if ($387) {
          $$3$lcssa = $$4;$$6443$lcssa = $$9446;$$6466$lcssa = $$7467;$$7$lcssa = $$10;
          break;
         } else {
          $$1428565 = $384;$$6443556 = $$9446;$$6466555 = $$7467;$$7559 = $$10;$335 = $$4;$354 = $385;
         }
        }
       }
       $388 = ((($$1469574)) + 8|0);
       $389 = HEAP32[$388>>2]|0;
       $390 = ($389|0)==(0|0);
       if ($390) {
        $$2431$lcssa = $$3$lcssa;$$5442$lcssa = $$6443$lcssa;$$5465$lcssa = $$6466$lcssa;$$6$lcssa = $$7$lcssa;
        break;
       } else {
        $$1469574 = $388;$$2431578 = $$3$lcssa;$$5442576 = $$6443$lcssa;$$5465575 = $$6466$lcssa;$$6577 = $$7$lcssa;$234 = $389;
       }
      }
     }
     HEAP32[$$5465$lcssa>>2] = 0;
     $$0415 = $229;$$0421 = $187;$$0422 = $183;$$0432 = $$6$lcssa;$$0437 = $$5442$lcssa;$$0460 = $$5465$lcssa;$$1424 = $$2425;$$1430 = $$2431$lcssa;$$1471 = $$2472;$$1474 = $$2475;
    }
    HEAP32[$4>>2] = $$10447;
    $$10447$lobit = $$10447 >>> 31;
    $$0426 = $$10447$lobit;
   }
  } while(0);
  _free($25);
  $$1 = $$0426;
 }
 STACKTOP = sp;return ($$1|0);
}
function _tre_fill_pmatch($0,$1,$2,$3,$4,$5) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 $4 = $4|0;
 $5 = $5|0;
 var $$08490 = 0, $$096 = 0, $$193 = 0, $$2$ph = 0, $$pre = 0, $$pre101 = 0, $$sink3 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $20 = 0, $21 = 0, $22 = 0;
 var $23 = 0, $24 = 0, $25 = 0, $26 = 0, $27 = 0, $28 = 0, $29 = 0, $30 = 0, $31 = 0, $32 = 0, $33 = 0, $34 = 0, $35 = 0, $36 = 0, $37 = 0, $38 = 0, $39 = 0, $40 = 0, $41 = 0, $42 = 0;
 var $43 = 0, $44 = 0, $45 = 0, $46 = 0, $47 = 0, $48 = 0, $49 = 0, $50 = 0, $51 = 0, $52 = 0, $53 = 0, $54 = 0, $55 = 0, $56 = 0, $57 = 0, $58 = 0, $59 = 0, $6 = 0, $60 = 0, $7 = 0;
 var $8 = 0, $9 = 0, $or$cond = 0, $or$cond86 = 0, $or$cond8695 = 0, $or$cond87 = 0, $or$cond88 = 0, $scevgep = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $6 = ($5|0)>(-1);
 $7 = $2 & 8;
 $8 = ($7|0)==(0);
 $or$cond = $8 & $6;
 if ($or$cond) {
  $12 = ((($3)) + 16|0);
  $13 = HEAP32[$12>>2]|0;
  $14 = ((($3)) + 28|0);
  $15 = HEAP32[$14>>2]|0;
  $16 = ($15|0)!=(0);
  $17 = ($0|0)!=(0);
  $or$cond8695 = $17 & $16;
  if ($or$cond8695) {
   $18 = ((($3)) + 48|0);
   $$pre = HEAP32[$18>>2]|0;
   $$096 = 0;
   while(1) {
    $19 = (($13) + (($$096*12)|0)|0);
    $20 = HEAP32[$19>>2]|0;
    $21 = ($20|0)==($$pre|0);
    if ($21) {
     $25 = $5;
    } else {
     $22 = (($4) + ($20<<2)|0);
     $23 = HEAP32[$22>>2]|0;
     $25 = $23;
    }
    $24 = (($1) + ($$096<<3)|0);
    HEAP32[$24>>2] = $25;
    $26 = (((($13) + (($$096*12)|0)|0)) + 4|0);
    $27 = HEAP32[$26>>2]|0;
    $28 = ($27|0)==($$pre|0);
    if ($28) {
     $$sink3 = $5;
    } else {
     $29 = (($4) + ($27<<2)|0);
     $30 = HEAP32[$29>>2]|0;
     $$sink3 = $30;
    }
    $31 = (((($1) + ($$096<<3)|0)) + 4|0);
    HEAP32[$31>>2] = $$sink3;
    $32 = ($25|0)==(-1);
    $33 = ($$sink3|0)==(-1);
    $or$cond88 = $33 | $32;
    if ($or$cond88) {
     HEAP32[$31>>2] = -1;
     HEAP32[$24>>2] = -1;
    }
    $34 = (($$096) + 1)|0;
    $35 = ($34>>>0)<($15>>>0);
    $36 = ($34>>>0)<($0>>>0);
    $or$cond86 = $36 & $35;
    if ($or$cond86) {
     $$096 = $34;
    } else {
     break;
    }
   }
   if ($or$cond8695) {
    $$193 = 0;
    while(1) {
     $37 = (((($1) + ($$193<<3)|0)) + 4|0);
     $38 = (((($13) + (($$193*12)|0)|0)) + 8|0);
     $39 = HEAP32[$38>>2]|0;
     $40 = ($39|0)==(0|0);
     if (!($40)) {
      $41 = HEAP32[$39>>2]|0;
      $42 = ($41|0)>(-1);
      if ($42) {
       $43 = (($1) + ($$193<<3)|0);
       $$pre101 = HEAP32[$43>>2]|0;
       $$08490 = 0;$45 = $41;$47 = $$pre101;
       while(1) {
        $44 = (($1) + ($45<<3)|0);
        $46 = HEAP32[$44>>2]|0;
        $48 = ($47|0)<($46|0);
        if ($48) {
         label = 19;
        } else {
         $49 = HEAP32[$37>>2]|0;
         $50 = (((($1) + ($45<<3)|0)) + 4|0);
         $51 = HEAP32[$50>>2]|0;
         $52 = ($49|0)>($51|0);
         if ($52) {
          label = 19;
         } else {
          $60 = $47;
         }
        }
        if ((label|0) == 19) {
         label = 0;
         HEAP32[$37>>2] = -1;
         HEAP32[$43>>2] = -1;
         $60 = -1;
        }
        $53 = (($$08490) + 1)|0;
        $54 = (($39) + ($53<<2)|0);
        $55 = HEAP32[$54>>2]|0;
        $56 = ($55|0)>(-1);
        if ($56) {
         $$08490 = $53;$45 = $55;$47 = $60;
        } else {
         break;
        }
       }
      }
     }
     $57 = (($$193) + 1)|0;
     $58 = ($57>>>0)<($15>>>0);
     $59 = ($57>>>0)<($0>>>0);
     $or$cond87 = $59 & $58;
     if ($or$cond87) {
      $$193 = $57;
     } else {
      $$2$ph = $57;
      break;
     }
    }
   } else {
    $$2$ph = 0;
   }
  } else {
   $$2$ph = 0;
  }
 } else {
  $$2$ph = 0;
 }
 $9 = ($$2$ph>>>0)<($0>>>0);
 if ($9) {
  $scevgep = (($1) + ($$2$ph<<3)|0);
  $10 = (($0) - ($$2$ph))|0;
  $11 = $10 << 3;
  _memset(($scevgep|0),-1,($11|0))|0;
 }
 return;
}
function _tre_neg_char_classes_match($0,$1,$2) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 var $$0 = 0, $$01011 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $18 = 0, $19 = 0, $3 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0;
 var sp = 0;
 sp = STACKTOP;
 $3 = HEAP32[$0>>2]|0;
 $4 = ($3|0)==(0);
 L1: do {
  if ($4) {
   $$0 = 0;
  } else {
   $5 = ($2|0)==(0);
   $$01011 = $0;$6 = $3;
   while(1) {
    if ($5) {
     $7 = (_iswctype($1,$6)|0);
     $8 = ($7|0)==(0);
     if (!($8)) {
      $$0 = 1;
      break L1;
     }
    } else {
     $9 = (_towupper($1)|0);
     $10 = HEAP32[$$01011>>2]|0;
     $11 = (_iswctype($9,$10)|0);
     $12 = ($11|0)==(0);
     if (!($12)) {
      $$0 = 1;
      break L1;
     }
     $13 = (_towlower($1)|0);
     $14 = HEAP32[$$01011>>2]|0;
     $15 = (_iswctype($13,$14)|0);
     $16 = ($15|0)==(0);
     if (!($16)) {
      $$0 = 1;
      break L1;
     }
    }
    $17 = ((($$01011)) + 4|0);
    $18 = HEAP32[$17>>2]|0;
    $19 = ($18|0)==(0);
    if ($19) {
     $$0 = 0;
     break;
    } else {
     $$01011 = $17;$6 = $18;
    }
   }
  }
 } while(0);
 return ($$0|0);
}
function _tre_tag_order($0,$1,$2,$3) {
 $0 = $0|0;
 $1 = $1|0;
 $2 = $2|0;
 $3 = $3|0;
 var $$018 = 0, $$019 = 0, $10 = 0, $11 = 0, $12 = 0, $13 = 0, $14 = 0, $15 = 0, $16 = 0, $17 = 0, $4 = 0, $5 = 0, $6 = 0, $7 = 0, $8 = 0, $9 = 0, label = 0, sp = 0;
 sp = STACKTOP;
 $4 = ($0|0)>(0);
 L1: do {
  if ($4) {
   $$019 = 0;
   while(1) {
    $5 = (($1) + ($$019<<2)|0);
    $6 = HEAP32[$5>>2]|0;
    $7 = ($6|0)==(0);
    $8 = (($2) + ($$019<<2)|0);
    $9 = HEAP32[$8>>2]|0;
    $10 = (($3) + ($$019<<2)|0);
    $11 = HEAP32[$10>>2]|0;
    if ($7) {
     $12 = ($9|0)<($11|0);
     if ($12) {
      $$018 = 1;
      break L1;
     }
     $13 = ($9|0)>($11|0);
     if ($13) {
      $$018 = 0;
      break L1;
     }
    } else {
     $14 = ($9|0)>($11|0);
     if ($14) {
      $$018 = 1;
      break L1;
     }
     $15 = ($9|0)<($11|0);
     if ($15) {
      $$018 = 0;
      break L1;
     }
    }
    $16 = (($$019) + 1)|0;
    $17 = ($16|0)<($0|0);
    if ($17) {
     $$019 = $16;
    } else {
     $$018 = 0;
     break;
    }
   }
  } else {
   $$018 = 0;
  }
 } while(0);
 return ($$018|0);
}
function runPostSets() {
}
function _sbrk(increment) {
    increment = increment|0;
    var oldDynamicTop = 0;
    var oldDynamicTopOnChange = 0;
    var newDynamicTop = 0;
    var totalMemory = 0;
    increment = ((increment + 15) & -16)|0;
    oldDynamicTop = HEAP32[DYNAMICTOP_PTR>>2]|0;
    newDynamicTop = oldDynamicTop + increment | 0;

    if (((increment|0) > 0 & (newDynamicTop|0) < (oldDynamicTop|0)) // Detect and fail if we would wrap around signed 32-bit int.
      | (newDynamicTop|0) < 0) { // Also underflow, sbrk() should be able to be used to subtract.
      abortOnCannotGrowMemory()|0;
      ___setErrNo(12);
      return -1;
    }

    HEAP32[DYNAMICTOP_PTR>>2] = newDynamicTop;
    totalMemory = getTotalMemory()|0;
    if ((newDynamicTop|0) > (totalMemory|0)) {
      if ((enlargeMemory()|0) == 0) {
        HEAP32[DYNAMICTOP_PTR>>2] = oldDynamicTop;
        ___setErrNo(12);
        return -1;
      }
    }
    return oldDynamicTop|0;
}
function _memset(ptr, value, num) {
    ptr = ptr|0; value = value|0; num = num|0;
    var end = 0, aligned_end = 0, block_aligned_end = 0, value4 = 0;
    end = (ptr + num)|0;

    value = value & 0xff;
    if ((num|0) >= 67 /* 64 bytes for an unrolled loop + 3 bytes for unaligned head*/) {
      while ((ptr&3) != 0) {
        HEAP8[((ptr)>>0)]=value;
        ptr = (ptr+1)|0;
      }

      aligned_end = (end & -4)|0;
      block_aligned_end = (aligned_end - 64)|0;
      value4 = value | (value << 8) | (value << 16) | (value << 24);

      while((ptr|0) <= (block_aligned_end|0)) {
        HEAP32[((ptr)>>2)]=value4;
        HEAP32[(((ptr)+(4))>>2)]=value4;
        HEAP32[(((ptr)+(8))>>2)]=value4;
        HEAP32[(((ptr)+(12))>>2)]=value4;
        HEAP32[(((ptr)+(16))>>2)]=value4;
        HEAP32[(((ptr)+(20))>>2)]=value4;
        HEAP32[(((ptr)+(24))>>2)]=value4;
        HEAP32[(((ptr)+(28))>>2)]=value4;
        HEAP32[(((ptr)+(32))>>2)]=value4;
        HEAP32[(((ptr)+(36))>>2)]=value4;
        HEAP32[(((ptr)+(40))>>2)]=value4;
        HEAP32[(((ptr)+(44))>>2)]=value4;
        HEAP32[(((ptr)+(48))>>2)]=value4;
        HEAP32[(((ptr)+(52))>>2)]=value4;
        HEAP32[(((ptr)+(56))>>2)]=value4;
        HEAP32[(((ptr)+(60))>>2)]=value4;
        ptr = (ptr + 64)|0;
      }

      while ((ptr|0) < (aligned_end|0) ) {
        HEAP32[((ptr)>>2)]=value4;
        ptr = (ptr+4)|0;
      }
    }
    // The remaining bytes.
    while ((ptr|0) < (end|0)) {
      HEAP8[((ptr)>>0)]=value;
      ptr = (ptr+1)|0;
    }
    return (end-num)|0;
}
function _memcpy(dest, src, num) {
    dest = dest|0; src = src|0; num = num|0;
    var ret = 0;
    var aligned_dest_end = 0;
    var block_aligned_dest_end = 0;
    var dest_end = 0;
    // Test against a benchmarked cutoff limit for when HEAPU8.set() becomes faster to use.
    if ((num|0) >=
      8192
    ) {
      return _emscripten_memcpy_big(dest|0, src|0, num|0)|0;
    }

    ret = dest|0;
    dest_end = (dest + num)|0;
    if ((dest&3) == (src&3)) {
      // The initial unaligned < 4-byte front.
      while (dest & 3) {
        if ((num|0) == 0) return ret|0;
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        dest = (dest+1)|0;
        src = (src+1)|0;
        num = (num-1)|0;
      }
      aligned_dest_end = (dest_end & -4)|0;
      block_aligned_dest_end = (aligned_dest_end - 64)|0;
      while ((dest|0) <= (block_aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        HEAP32[(((dest)+(4))>>2)]=((HEAP32[(((src)+(4))>>2)])|0);
        HEAP32[(((dest)+(8))>>2)]=((HEAP32[(((src)+(8))>>2)])|0);
        HEAP32[(((dest)+(12))>>2)]=((HEAP32[(((src)+(12))>>2)])|0);
        HEAP32[(((dest)+(16))>>2)]=((HEAP32[(((src)+(16))>>2)])|0);
        HEAP32[(((dest)+(20))>>2)]=((HEAP32[(((src)+(20))>>2)])|0);
        HEAP32[(((dest)+(24))>>2)]=((HEAP32[(((src)+(24))>>2)])|0);
        HEAP32[(((dest)+(28))>>2)]=((HEAP32[(((src)+(28))>>2)])|0);
        HEAP32[(((dest)+(32))>>2)]=((HEAP32[(((src)+(32))>>2)])|0);
        HEAP32[(((dest)+(36))>>2)]=((HEAP32[(((src)+(36))>>2)])|0);
        HEAP32[(((dest)+(40))>>2)]=((HEAP32[(((src)+(40))>>2)])|0);
        HEAP32[(((dest)+(44))>>2)]=((HEAP32[(((src)+(44))>>2)])|0);
        HEAP32[(((dest)+(48))>>2)]=((HEAP32[(((src)+(48))>>2)])|0);
        HEAP32[(((dest)+(52))>>2)]=((HEAP32[(((src)+(52))>>2)])|0);
        HEAP32[(((dest)+(56))>>2)]=((HEAP32[(((src)+(56))>>2)])|0);
        HEAP32[(((dest)+(60))>>2)]=((HEAP32[(((src)+(60))>>2)])|0);
        dest = (dest+64)|0;
        src = (src+64)|0;
      }
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP32[((dest)>>2)]=((HEAP32[((src)>>2)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    } else {
      // In the unaligned copy case, unroll a bit as well.
      aligned_dest_end = (dest_end - 4)|0;
      while ((dest|0) < (aligned_dest_end|0) ) {
        HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
        HEAP8[(((dest)+(1))>>0)]=((HEAP8[(((src)+(1))>>0)])|0);
        HEAP8[(((dest)+(2))>>0)]=((HEAP8[(((src)+(2))>>0)])|0);
        HEAP8[(((dest)+(3))>>0)]=((HEAP8[(((src)+(3))>>0)])|0);
        dest = (dest+4)|0;
        src = (src+4)|0;
      }
    }
    // The remaining unaligned < 4 byte tail.
    while ((dest|0) < (dest_end|0)) {
      HEAP8[((dest)>>0)]=((HEAP8[((src)>>0)])|0);
      dest = (dest+1)|0;
      src = (src+1)|0;
    }
    return ret|0;
}

  
function dynCall_ii(index,a1) {
  index = index|0;
  a1=a1|0;
  return FUNCTION_TABLE_ii[index&1](a1|0)|0;
}


function dynCall_iiii(index,a1,a2,a3) {
  index = index|0;
  a1=a1|0; a2=a2|0; a3=a3|0;
  return FUNCTION_TABLE_iiii[index&7](a1|0,a2|0,a3|0)|0;
}


function dynCall_iii(index,a1,a2) {
  index = index|0;
  a1=a1|0; a2=a2|0;
  return FUNCTION_TABLE_iii[index&7](a1|0,a2|0)|0;
}

function b0(p0) {
 p0 = p0|0; nullFunc_ii(0);return 0;
}
function b1(p0,p1,p2) {
 p0 = p0|0;p1 = p1|0;p2 = p2|0; nullFunc_iiii(1);return 0;
}
function b2(p0,p1) {
 p0 = p0|0;p1 = p1|0; nullFunc_iii(2);return 0;
}

// EMSCRIPTEN_END_FUNCS
var FUNCTION_TABLE_ii = [b0,___stdio_close];
var FUNCTION_TABLE_iiii = [b1,b1,___stdout_write,___stdio_seek,___stdio_write,b1,b1,b1];
var FUNCTION_TABLE_iii = [b2,b2,b2,b2,b2,_tre_compare_lit,b2,b2];

  return { _sbrk: _sbrk, getTempRet0: getTempRet0, _fflush: _fflush, _main: _main, setTempRet0: setTempRet0, establishStackSpace: establishStackSpace, dynCall_iiii: dynCall_iiii, _memset: _memset, dynCall_ii: dynCall_ii, _malloc: _malloc, ___errno_location: ___errno_location, _emscripten_get_global_libc: _emscripten_get_global_libc, _memcpy: _memcpy, stackAlloc: stackAlloc, setThrew: setThrew, dynCall_iii: dynCall_iii, _free: _free, stackRestore: stackRestore, stackSave: stackSave, runPostSets: runPostSets };
})
// EMSCRIPTEN_END_ASM
(Module.asmGlobalArg, Module.asmLibraryArg, buffer);

var real__malloc = asm["_malloc"]; asm["_malloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__malloc.apply(null, arguments);
};

var real_getTempRet0 = asm["getTempRet0"]; asm["getTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_getTempRet0.apply(null, arguments);
};

var real__fflush = asm["_fflush"]; asm["_fflush"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__fflush.apply(null, arguments);
};

var real__main = asm["_main"]; asm["_main"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__main.apply(null, arguments);
};

var real_setTempRet0 = asm["setTempRet0"]; asm["setTempRet0"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setTempRet0.apply(null, arguments);
};

var real_establishStackSpace = asm["establishStackSpace"]; asm["establishStackSpace"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_establishStackSpace.apply(null, arguments);
};

var real_stackSave = asm["stackSave"]; asm["stackSave"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackSave.apply(null, arguments);
};

var real__sbrk = asm["_sbrk"]; asm["_sbrk"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__sbrk.apply(null, arguments);
};

var real__emscripten_get_global_libc = asm["_emscripten_get_global_libc"]; asm["_emscripten_get_global_libc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__emscripten_get_global_libc.apply(null, arguments);
};

var real_stackAlloc = asm["stackAlloc"]; asm["stackAlloc"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackAlloc.apply(null, arguments);
};

var real_setThrew = asm["setThrew"]; asm["setThrew"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_setThrew.apply(null, arguments);
};

var real__free = asm["_free"]; asm["_free"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real__free.apply(null, arguments);
};

var real_stackRestore = asm["stackRestore"]; asm["stackRestore"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real_stackRestore.apply(null, arguments);
};

var real____errno_location = asm["___errno_location"]; asm["___errno_location"] = function() {
  assert(runtimeInitialized, 'you need to wait for the runtime to be ready (e.g. wait for main() to be called)');
  assert(!runtimeExited, 'the runtime was exited (use NO_EXIT_RUNTIME to keep it alive after main() exits)');
  return real____errno_location.apply(null, arguments);
};
var _malloc = Module["_malloc"] = asm["_malloc"];
var getTempRet0 = Module["getTempRet0"] = asm["getTempRet0"];
var _fflush = Module["_fflush"] = asm["_fflush"];
var _main = Module["_main"] = asm["_main"];
var setTempRet0 = Module["setTempRet0"] = asm["setTempRet0"];
var establishStackSpace = Module["establishStackSpace"] = asm["establishStackSpace"];
var stackSave = Module["stackSave"] = asm["stackSave"];
var _memset = Module["_memset"] = asm["_memset"];
var _sbrk = Module["_sbrk"] = asm["_sbrk"];
var _emscripten_get_global_libc = Module["_emscripten_get_global_libc"] = asm["_emscripten_get_global_libc"];
var _memcpy = Module["_memcpy"] = asm["_memcpy"];
var stackAlloc = Module["stackAlloc"] = asm["stackAlloc"];
var setThrew = Module["setThrew"] = asm["setThrew"];
var _free = Module["_free"] = asm["_free"];
var stackRestore = Module["stackRestore"] = asm["stackRestore"];
var ___errno_location = Module["___errno_location"] = asm["___errno_location"];
var runPostSets = Module["runPostSets"] = asm["runPostSets"];
var dynCall_ii = Module["dynCall_ii"] = asm["dynCall_ii"];
var dynCall_iiii = Module["dynCall_iiii"] = asm["dynCall_iiii"];
var dynCall_iii = Module["dynCall_iii"] = asm["dynCall_iii"];
;
Runtime.stackAlloc = Module['stackAlloc'];
Runtime.stackSave = Module['stackSave'];
Runtime.stackRestore = Module['stackRestore'];
Runtime.establishStackSpace = Module['establishStackSpace'];
Runtime.setTempRet0 = Module['setTempRet0'];
Runtime.getTempRet0 = Module['getTempRet0'];


// === Auto-generated postamble setup entry stuff ===

Module['asm'] = asm;






/**
 * @constructor
 * @extends {Error}
 */
function ExitStatus(status) {
  this.name = "ExitStatus";
  this.message = "Program terminated with exit(" + status + ")";
  this.status = status;
};
ExitStatus.prototype = new Error();
ExitStatus.prototype.constructor = ExitStatus;

var initialStackTop;
var preloadStartTime = null;
var calledMain = false;

dependenciesFulfilled = function runCaller() {
  // If run has never been called, and we should call run (INVOKE_RUN is true, and Module.noInitialRun is not false)
  if (!Module['calledRun']) run();
  if (!Module['calledRun']) dependenciesFulfilled = runCaller; // try this again later, after new deps are fulfilled
}

Module['callMain'] = Module.callMain = function callMain(args) {
  assert(runDependencies == 0, 'cannot call main when async dependencies remain! (listen on __ATMAIN__)');
  assert(__ATPRERUN__.length == 0, 'cannot call main when preRun functions remain to be called');

  args = args || [];

  ensureInitRuntime();

  var argc = args.length+1;
  function pad() {
    for (var i = 0; i < 4-1; i++) {
      argv.push(0);
    }
  }
  var argv = [allocate(intArrayFromString(Module['thisProgram']), 'i8', ALLOC_NORMAL) ];
  pad();
  for (var i = 0; i < argc-1; i = i + 1) {
    argv.push(allocate(intArrayFromString(args[i]), 'i8', ALLOC_NORMAL));
    pad();
  }
  argv.push(0);
  argv = allocate(argv, 'i32', ALLOC_NORMAL);


  try {

    var ret = Module['_main'](argc, argv, 0);


    // if we're not running an evented main loop, it's time to exit
    exit(ret, /* implicit = */ true);
  }
  catch(e) {
    if (e instanceof ExitStatus) {
      // exit() throws this once it's done to make sure execution
      // has been stopped completely
      return;
    } else if (e == 'SimulateInfiniteLoop') {
      // running an evented main loop, don't immediately exit
      Module['noExitRuntime'] = true;
      return;
    } else {
      var toLog = e;
      if (e && typeof e === 'object' && e.stack) {
        toLog = [e, e.stack];
      }
      Module.printErr('exception thrown: ' + toLog);
      Module['quit'](1, e);
    }
  } finally {
    calledMain = true;
  }
}




/** @type {function(Array=)} */
function run(args) {
  args = args || Module['arguments'];

  if (preloadStartTime === null) preloadStartTime = Date.now();

  if (runDependencies > 0) {
    return;
  }

  writeStackCookie();

  preRun();

  if (runDependencies > 0) return; // a preRun added a dependency, run will be called later
  if (Module['calledRun']) return; // run may have just been called through dependencies being fulfilled just in this very frame

  function doRun() {
    if (Module['calledRun']) return; // run may have just been called while the async setStatus time below was happening
    Module['calledRun'] = true;

    if (ABORT) return;

    ensureInitRuntime();

    preMain();

    if (ENVIRONMENT_IS_WEB && preloadStartTime !== null) {
      Module.printErr('pre-main prep time: ' + (Date.now() - preloadStartTime) + ' ms');
    }

    if (Module['onRuntimeInitialized']) Module['onRuntimeInitialized']();

    if (Module['_main'] && shouldRunNow) Module['callMain'](args);

    postRun();
  }

  if (Module['setStatus']) {
    Module['setStatus']('Running...');
    setTimeout(function() {
      setTimeout(function() {
        Module['setStatus']('');
      }, 1);
      doRun();
    }, 1);
  } else {
    doRun();
  }
  checkStackCookie();
}
Module['run'] = Module.run = run;

function exit(status, implicit) {
  if (implicit && Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') implicitly called by end of main(), but noExitRuntime, so not exiting the runtime (you can use emscripten_force_exit, if you want to force a true shutdown)');
    return;
  }

  if (Module['noExitRuntime']) {
    Module.printErr('exit(' + status + ') called, but noExitRuntime, so halting execution but not exiting the runtime or preventing further async execution (you can use emscripten_force_exit, if you want to force a true shutdown)');
  } else {

    ABORT = true;
    EXITSTATUS = status;
    STACKTOP = initialStackTop;

    exitRuntime();

    if (Module['onExit']) Module['onExit'](status);
  }

  if (ENVIRONMENT_IS_NODE) {
    process['exit'](status);
  }
  Module['quit'](status, new ExitStatus(status));
}
Module['exit'] = Module.exit = exit;

var abortDecorators = [];

function abort(what) {
  if (Module['onAbort']) {
    Module['onAbort'](what);
  }

  if (what !== undefined) {
    Module.print(what);
    Module.printErr(what);
    what = JSON.stringify(what)
  } else {
    what = '';
  }

  ABORT = true;
  EXITSTATUS = 1;

  var extra = '';

  var output = 'abort(' + what + ') at ' + stackTrace() + extra;
  if (abortDecorators) {
    abortDecorators.forEach(function(decorator) {
      output = decorator(output, what);
    });
  }
  throw output;
}
Module['abort'] = Module.abort = abort;

// {{PRE_RUN_ADDITIONS}}

if (Module['preInit']) {
  if (typeof Module['preInit'] == 'function') Module['preInit'] = [Module['preInit']];
  while (Module['preInit'].length > 0) {
    Module['preInit'].pop()();
  }
}

// shouldRunNow refers to calling main(), not run().
var shouldRunNow = true;
if (Module['noInitialRun']) {
  shouldRunNow = false;
}


run();

// {{POST_RUN_ADDITIONS}}





// {{MODULE_ADDITIONS}}



