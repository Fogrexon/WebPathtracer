var Module = typeof Module !== "undefined" ? Module : {};
let arguments_ = [];
let thisProgram = "./this.program";
let quit_ = function(status, toThrow) {
    throw toThrow
};
const ENVIRONMENT_IS_WEB = typeof window === "object";
const ENVIRONMENT_IS_WORKER = typeof importScripts === "function";
let scriptDirectory = "";

function locateFile(path) {
    if (Module.locateFile) {
        return Module.locateFile(path, scriptDirectory)
    }
    return scriptDirectory + path
}
let readAsync; let readBinary;

if (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER) {
    if (ENVIRONMENT_IS_WORKER) {
        scriptDirectory = self.location.href
    } else if (typeof document !== "undefined" && document.currentScript) {
        scriptDirectory = document.currentScript.src
    }
    if (scriptDirectory.indexOf("blob:") !== 0) {
        scriptDirectory = scriptDirectory.substr(0, scriptDirectory.replace(/[?#].*/, "").lastIndexOf("/") + 1)
    } else {
        scriptDirectory = ""
    }
    if (ENVIRONMENT_IS_WORKER) {
        readBinary = function(url) {
            const xhr = new XMLHttpRequest;
            xhr.open("GET", url, false);
            xhr.responseType = "arraybuffer";
            xhr.send(null);
            return new Uint8Array(xhr.response)
        }
    }
    readAsync = function(url, onload, onerror) {
        const xhr = new XMLHttpRequest;
        xhr.open("GET", url, true);
        xhr.responseType = "arraybuffer";
        xhr.onload = function() {
            if (xhr.status === 200 || xhr.status === 0 && xhr.response) {
                onload(xhr.response);
                return
            }
            onerror()
        };
        xhr.onerror = onerror;
        xhr.send(null)
    }

}
const out = Module.print || console.log.bind(console);
var err = Module.printErr || console.warn.bind(console);

if (Module.arguments) arguments_ = Module.arguments;
if (Module.thisProgram) thisProgram = Module.thisProgram;
if (Module.quit) quit_ = Module.quit;

let tempRet0 = 0;
const setTempRet0 = function(value) {
    tempRet0 = value
};
let wasmBinary;
if (Module.wasmBinary) wasmBinary = Module.wasmBinary;
const noExitRuntime = Module.noExitRuntime || true;
if (typeof WebAssembly !== "object") {
    abort("no native wasm support detected")
}

function setValue(ptr, value, type) {
    type = type || "i8";
    if (type.charAt(type.length - 1) === "*") type = "i32";
    switch (type) {
        case "i1":
            HEAP8[ptr >> 0] = value;
            break;
        case "i8":
            HEAP8[ptr >> 0] = value;
            break;
        case "i16":
            HEAP16[ptr >> 1] = value;
            break;
        case "i32":
            HEAP32[ptr >> 2] = value;
            break;
        case "i64":
            tempI64 = [
                value >>> 0,
                (tempDouble = value, +Math.abs(tempDouble) >= 1 ? tempDouble > 0 ? (Math.min(+Math.floor(tempDouble / 4294967296), 4294967295) | 0) >>> 0 : ~~+Math.ceil((tempDouble - +(~~tempDouble >>> 0)) / 4294967296) >>> 0 : 0)
            ];
            HEAP32[ptr >> 2] = tempI64[0];
            HEAP32[ptr + 4 >> 2] = tempI64[1];
            break;
        case "float":
            HEAPF32[ptr >> 2] = value;
            break;
        case "double":
            HEAPF64[ptr >> 3] = value;
            break;
        default:
            abort(`invalid type for setValue: ${  type}`)
    }
}

function getValue(ptr, type, noSafe) {
    type = type || "i8";
    if (type.charAt(type.length - 1) === "*") type = "i32";
    switch (type) {
        case "i1":
            return HEAP8[ptr >> 0];
        case "i8":
            return HEAP8[ptr >> 0];
        case "i16":
            return HEAP16[ptr >> 1];
        case "i32":
            return HEAP32[ptr >> 2];
        case "i64":
            return HEAP32[ptr >> 2];
        case "float":
            return HEAPF32[ptr >> 2];
        case "double":
            return Number(HEAPF64[ptr >> 3]);
        default:
            abort(`invalid type for getValue: ${  type}`)
    }
    return null
}
let wasmMemory;
let ABORT = false;
let EXITSTATUS;

function assert(condition, text) {
    if (!condition) {
        abort(`Assertion failed: ${  text}`)
    }
}

function getCFunc(ident) {
    const func = Module[`_${  ident}`];
    assert(func, `Cannot call unknown function ${  ident  }, make sure it is exported`);
    return func
}

function ccall(ident, returnType, argTypes, args) {
    const toC = {
        "string": function(str) {
            let ret = 0;
            if (str !== null && str !== undefined && str !== 0) {
                const len = (str.length << 2) + 1;
                ret = stackAlloc(len);
                stringToUTF8(str, ret, len)
            }
            return ret
        },
        "array": function(arr) {
            const ret = stackAlloc(arr.length);
            writeArrayToMemory(arr, ret);
            return ret
        }
    };

    function convertReturnValue(ret) {
        if (returnType === "string") return UTF8ToString(ret);
        if (returnType === "boolean") return Boolean(ret);
        return ret
    }
    const func = getCFunc(ident);
    const cArgs = [];
    let stack = 0;
    if (args) {
        for (let i = 0; i < args.length; i++) {
            const converter = toC[argTypes[i]];
            if (converter) {
                if (stack === 0) stack = stackSave();
                cArgs[i] = converter(args[i])
            } else {
                cArgs[i] = args[i]
            }
        }
    }
    let ret = func.apply(null, cArgs);

    function onDone(ret) {
        if (stack !== 0) stackRestore(stack);
        return convertReturnValue(ret)
    }
    ret = onDone(ret);
    return ret
}
const ALLOC_STACK = 1;
const UTF8Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf8") : undefined;

function UTF8ArrayToString(heap, idx, maxBytesToRead) {
    const endIdx = idx + maxBytesToRead;
    let endPtr = idx;
    while (heap[endPtr] && !(endPtr >= endIdx)) ++endPtr;
    if (endPtr - idx > 16 && heap.subarray && UTF8Decoder) {
        return UTF8Decoder.decode(heap.subarray(idx, endPtr))
    } 
        let str = "";
        while (idx < endPtr) {
            let u0 = heap[idx++];
            if (!(u0 & 128)) {
                str += String.fromCharCode(u0);
                continue
            }
            const u1 = heap[idx++] & 63;
            if ((u0 & 224) == 192) {
                str += String.fromCharCode((u0 & 31) << 6 | u1);
                continue
            }
            const u2 = heap[idx++] & 63;
            if ((u0 & 240) == 224) {
                u0 = (u0 & 15) << 12 | u1 << 6 | u2
            } else {
                u0 = (u0 & 7) << 18 | u1 << 12 | u2 << 6 | heap[idx++] & 63
            }
            if (u0 < 65536) {
                str += String.fromCharCode(u0)
            } else {
                const ch = u0 - 65536;
                str += String.fromCharCode(55296 | ch >> 10, 56320 | ch & 1023)
            }
        }
    
    return str
}

function UTF8ToString(ptr, maxBytesToRead) {
    return ptr ? UTF8ArrayToString(HEAPU8, ptr, maxBytesToRead) : ""
}

function stringToUTF8Array(str, heap, outIdx, maxBytesToWrite) {
    if (!(maxBytesToWrite > 0)) return 0;
    const startIdx = outIdx;
    const endIdx = outIdx + maxBytesToWrite - 1;
    for (let i = 0; i < str.length; ++i) {
        let u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) {
            const u1 = str.charCodeAt(++i);
            u = 65536 + ((u & 1023) << 10) | u1 & 1023
        }
        if (u <= 127) {
            if (outIdx >= endIdx) break;
            heap[outIdx++] = u
        } else if (u <= 2047) {
            if (outIdx + 1 >= endIdx) break;
            heap[outIdx++] = 192 | u >> 6;
            heap[outIdx++] = 128 | u & 63
        } else if (u <= 65535) {
            if (outIdx + 2 >= endIdx) break;
            heap[outIdx++] = 224 | u >> 12;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        } else {
            if (outIdx + 3 >= endIdx) break;
            heap[outIdx++] = 240 | u >> 18;
            heap[outIdx++] = 128 | u >> 12 & 63;
            heap[outIdx++] = 128 | u >> 6 & 63;
            heap[outIdx++] = 128 | u & 63
        }
    }
    heap[outIdx] = 0;
    return outIdx - startIdx
}

function stringToUTF8(str, outPtr, maxBytesToWrite) {
    return stringToUTF8Array(str, HEAPU8, outPtr, maxBytesToWrite)
}

function lengthBytesUTF8(str) {
    let len = 0;
    for (let i = 0; i < str.length; ++i) {
        let u = str.charCodeAt(i);
        if (u >= 55296 && u <= 57343) u = 65536 + ((u & 1023) << 10) | str.charCodeAt(++i) & 1023;
        if (u <= 127) ++len;
        else if (u <= 2047) len += 2;
        else if (u <= 65535) len += 3;
        else len += 4
    }
    return len
}
const UTF16Decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-16le") : undefined;

function allocateUTF8OnStack(str) {
    const size = lengthBytesUTF8(str) + 1;
    const ret = stackAlloc(size);
    stringToUTF8Array(str, HEAP8, ret, size);
    return ret
}

function writeArrayToMemory(array, buffer) {
    HEAP8.set(array, buffer)
}

function writeAsciiToMemory(str, buffer, dontAddNull) {
    for (let i = 0; i < str.length; ++i) {
        HEAP8[buffer++ >> 0] = str.charCodeAt(i)
    }
    if (!dontAddNull) HEAP8[buffer >> 0] = 0
}

function alignUp(x, multiple) {
    if (x % multiple > 0) {
        x += multiple - x % multiple
    }
    return x
}
let buffer; let HEAP8; let HEAPU8; let HEAP16; let HEAPU16; let HEAP32; let HEAPU32; let HEAPF32; let HEAPF64;

function updateGlobalBufferAndViews(buf) {
    buffer = buf;
    Module.HEAP8 = HEAP8 = new Int8Array(buf);
    Module.HEAP16 = HEAP16 = new Int16Array(buf);
    Module.HEAP32 = HEAP32 = new Int32Array(buf);
    Module.HEAPU8 = HEAPU8 = new Uint8Array(buf);
    Module.HEAPU16 = HEAPU16 = new Uint16Array(buf);
    Module.HEAPU32 = HEAPU32 = new Uint32Array(buf);
    Module.HEAPF32 = HEAPF32 = new Float32Array(buf);
    Module.HEAPF64 = HEAPF64 = new Float64Array(buf)
}
const INITIAL_MEMORY = Module.INITIAL_MEMORY || 16777216;
let wasmTable;
const __ATPRERUN__ = [];
const __ATINIT__ = [];
const __ATMAIN__ = [];
const __ATPOSTRUN__ = [];
let runtimeInitialized = false;
let runtimeExited = false;
const runtimeKeepaliveCounter = 0;

function keepRuntimeAlive() {
    return noExitRuntime || runtimeKeepaliveCounter > 0
}

function preRun() {
    if (Module.preRun) {
        if (typeof Module.preRun === "function") Module.preRun = [Module.preRun];
        while (Module.preRun.length) {
            addOnPreRun(Module.preRun.shift())
        }
    }
    callRuntimeCallbacks(__ATPRERUN__)
}

function initRuntime() {
    runtimeInitialized = true;
    callRuntimeCallbacks(__ATINIT__)
}

function preMain() {
    callRuntimeCallbacks(__ATMAIN__)
}

function exitRuntime() {
    runtimeExited = true
}

function postRun() {
    if (Module.postRun) {
        if (typeof Module.postRun === "function") Module.postRun = [Module.postRun];
        while (Module.postRun.length) {
            addOnPostRun(Module.postRun.shift())
        }
    }
    callRuntimeCallbacks(__ATPOSTRUN__)
}

function addOnPreRun(cb) {
    __ATPRERUN__.unshift(cb)
}

function addOnInit(cb) {
    __ATINIT__.unshift(cb)
}

function addOnPostRun(cb) {
    __ATPOSTRUN__.unshift(cb)
}
let runDependencies = 0;
let runDependencyWatcher = null;
let dependenciesFulfilled = null;

function addRunDependency(id) {
    runDependencies++;
    if (Module.monitorRunDependencies) {
        Module.monitorRunDependencies(runDependencies)
    }
}

function removeRunDependency(id) {
    runDependencies--;
    if (Module.monitorRunDependencies) {
        Module.monitorRunDependencies(runDependencies)
    }
    if (runDependencies === 0) {
        if (runDependencyWatcher !== null) {
            clearInterval(runDependencyWatcher);
            runDependencyWatcher = null
        }
        if (dependenciesFulfilled) {
            const callback = dependenciesFulfilled;
            dependenciesFulfilled = null;
            callback()
        }
    }
}
Module.preloadedImages = {};
Module.preloadedAudios = {};

function abort(what) {

    if (Module.onAbort) {
        Module.onAbort(what)
    }

    what = `Aborted(${  what  })`;
    err(what);
    ABORT = true;
    EXITSTATUS = 1;
    what += ". Build with -s ASSERTIONS=1 for more info.";
    const e = new WebAssembly.RuntimeError(what);
    throw e
}
const dataURIPrefix = "data:application/octet-stream;base64,";

function isDataURI(filename) {
    return filename.startsWith(dataURIPrefix)
}

function isFileURI(filename) {
    return filename.startsWith("file://")
}
let wasmBinaryFile;
wasmBinaryFile = "main.wasm";
if (!isDataURI(wasmBinaryFile)) {
    wasmBinaryFile = locateFile(wasmBinaryFile)
}

function getBinary(file) {
    try {
        if (file === wasmBinaryFile && wasmBinary) {
            return new Uint8Array(wasmBinary)
        }
        if (readBinary) {
            return readBinary(file)
        } 

        throw new Error("both async and sync fetching of the wasm failed");
        
    } catch (err) {
        abort(err)
    }
}

function getBinaryPromise() {
    if (!wasmBinary && (ENVIRONMENT_IS_WEB || ENVIRONMENT_IS_WORKER)) {
        if (typeof fetch === "function" && !isFileURI(wasmBinaryFile)) {
            return fetch(wasmBinaryFile, {
                credentials: "same-origin"
            }).then((response) => {
                if (!response.ok) {
                    throw new Error(`failed to load wasm binary file at '${  wasmBinaryFile  }'`);
                }
                return response.arrayBuffer()
            }).catch(() => getBinary(wasmBinaryFile))
        } 
            if (readAsync) {
                return new Promise((resolve, reject) => {
                    readAsync(wasmBinaryFile, (response) => {
                        resolve(new Uint8Array(response))
                    }, reject)
                })
            }
        
    }
    return Promise.resolve().then(() => getBinary(wasmBinaryFile))
}

function createWasm() {
    const info = {
        "env": asmLibraryArg,
        "wasi_snapshot_preview1": asmLibraryArg
    };

    function receiveInstance(instance) {
        const {exports} = instance;
        Module.asm = exports;
        wasmMemory = Module.asm.memory;
        updateGlobalBufferAndViews(wasmMemory.buffer);
        wasmTable = Module.asm.__indirect_function_table;
        addOnInit(Module.asm.__wasm_call_ctors);
        removeRunDependency("wasm-instantiate")
    }
    addRunDependency("wasm-instantiate");

    function receiveInstantiationResult(result) {
        receiveInstance(result.instance)
    }

    function instantiateArrayBuffer(receiver) {
        return getBinaryPromise().then((binary) => WebAssembly.instantiate(binary, info)).then((instance) => instance).then(receiver, (reason) => {
            err(`failed to asynchronously prepare wasm: ${  reason}`);
            abort(reason)
        })
    }

    function instantiateAsync() {
        if (!wasmBinary && typeof WebAssembly.instantiateStreaming === "function" && !isDataURI(wasmBinaryFile) && !isFileURI(wasmBinaryFile) && typeof fetch === "function") {
            return fetch(wasmBinaryFile, {
                credentials: "same-origin"
            }).then((response) => {
                const result = WebAssembly.instantiateStreaming(response, info);
                return result.then(receiveInstantiationResult, (reason) => {
                    err(`wasm streaming compile failed: ${  reason}`);
                    err("falling back to ArrayBuffer instantiation");
                    return instantiateArrayBuffer(receiveInstantiationResult)
                })
            })
        } 
            return instantiateArrayBuffer(receiveInstantiationResult)
        
    }
    if (Module.instantiateWasm) {
        try {
            const exports = Module.instantiateWasm(info, receiveInstance);
            return exports
        } catch (e) {
            err(`Module.instantiateWasm callback failed with error: ${  e}`);
            return false
        }
    }
    instantiateAsync();
    return {}
}
let tempDouble;
let tempI64;

function callRuntimeCallbacks(callbacks) {
    while (callbacks.length > 0) {
        const callback = callbacks.shift();
        if (typeof callback === "function") {
            callback(Module);
            continue
        }
        const {func} = callback;
        if (typeof func === "number") {
            if (callback.arg === undefined) {
                getWasmTableEntry(func)()
            } else {
                getWasmTableEntry(func)(callback.arg)
            }
        } else {
            func(callback.arg === undefined ? null : callback.arg)
        }
    }
}

const wasmTableMirror = [];

function getWasmTableEntry(funcPtr) {
    let func = wasmTableMirror[funcPtr];
    if (!func) {
        if (funcPtr >= wasmTableMirror.length) wasmTableMirror.length = funcPtr + 1;
        wasmTableMirror[funcPtr] = func = wasmTable.get(funcPtr)
    }
    return func
}

function handleException(e) {
    if (e instanceof ExitStatus || e === "unwind") {
        return EXITSTATUS
    }
    quit_(1, e)
}

function _emscripten_memcpy_big(dest, src, num) {
    HEAPU8.copyWithin(dest, src, src + num)
}

function emscripten_realloc_buffer(size) {
    try {
        wasmMemory.grow(size - buffer.byteLength + 65535 >>> 16);
        updateGlobalBufferAndViews(wasmMemory.buffer);
        return 1
    } catch (e) {}
}

function _emscripten_resize_heap(requestedSize) {
    const oldSize = HEAPU8.length;
    requestedSize >>>= 0;
    const maxHeapSize = 2147483648;
    if (requestedSize > maxHeapSize) {
        return false
    }
    for (let cutDown = 1; cutDown <= 4; cutDown *= 2) {
        let overGrownHeapSize = oldSize * (1 + .2 / cutDown);
        overGrownHeapSize = Math.min(overGrownHeapSize, requestedSize + 100663296);
        const newSize = Math.min(maxHeapSize, alignUp(Math.max(requestedSize, overGrownHeapSize), 65536));
        const replacement = emscripten_realloc_buffer(newSize);
        if (replacement) {
            return true
        }
    }
    return false
}

var SYSCALLS = {
    mappings: {},
    buffers: [null, [],
        []
    ],
    printChar(stream, curr) {
        const buffer = SYSCALLS.buffers[stream];
        if (curr === 0 || curr === 10) {
            (stream === 1 ? out : err)(UTF8ArrayToString(buffer, 0));
            buffer.length = 0
        } else {
            buffer.push(curr)
        }
    },
    varargs: undefined,
    get() {
        SYSCALLS.varargs += 4;
        const ret = HEAP32[SYSCALLS.varargs - 4 >> 2];
        return ret
    },
    getStr(ptr) {
        const ret = UTF8ToString(ptr);
        return ret
    },
    get64(low, high) {
        return low
    }
};

function _fd_write(fd, iov, iovcnt, pnum) {
    let num = 0;
    for (let i = 0; i < iovcnt; i++) {
        const ptr = HEAP32[iov >> 2];
        const len = HEAP32[iov + 4 >> 2];
        iov += 8;
        for (let j = 0; j < len; j++) {
            SYSCALLS.printChar(fd, HEAPU8[ptr + j])
        }
        num += len
    }
    HEAP32[pnum >> 2] = num;
    return 0
}

function _setTempRet0(val) {
    setTempRet0(val)
}
const ASSERTIONS = false;
var asmLibraryArg = {
    "emscripten_memcpy_big": _emscripten_memcpy_big,
    "emscripten_resize_heap": _emscripten_resize_heap,
    "fd_write": _fd_write,
    "setTempRet0": _setTempRet0
};

const asm = createWasm();
var ___wasm_call_ctors = Module.___wasm_call_ctors = function() {
    return (___wasm_call_ctors = Module.___wasm_call_ctors = Module.asm.__wasm_call_ctors).apply(null, arguments)
};
var _main = Module._main = function() {
    return (_main = Module._main = Module.asm.main).apply(null, arguments)
};
var _count = Module._count = function() {
    return (_count = Module._count = Module.asm.count).apply(null, arguments)
};
var _pathTracing = Module._pathTracing = function() {
    return (_pathTracing = Module._pathTracing = Module.asm.pathTracing).apply(null, arguments)
};
var ___errno_location = Module.___errno_location = function() {
    return (___errno_location = Module.___errno_location = Module.asm.__errno_location).apply(null, arguments)
};
var stackSave = Module.stackSave = function() {
    return (stackSave = Module.stackSave = Module.asm.stackSave).apply(null, arguments)
};
var stackRestore = Module.stackRestore = function() {
    return (stackRestore = Module.stackRestore = Module.asm.stackRestore).apply(null, arguments)
};
var stackAlloc = Module.stackAlloc = function() {
    return (stackAlloc = Module.stackAlloc = Module.asm.stackAlloc).apply(null, arguments)
};
var _malloc = Module._malloc = function() {
    return (_malloc = Module._malloc = Module.asm.malloc).apply(null, arguments)
};
var _free = Module._free = function() {
    return (_free = Module._free = Module.asm.free).apply(null, arguments)
};
var dynCall_jiji = Module.dynCall_jiji = function() {
    return (dynCall_jiji = Module.dynCall_jiji = Module.asm.dynCall_jiji).apply(null, arguments)
};

Module.ccall = ccall;
Module.setValue = setValue;
Module.getValue = getValue;
let calledRun;

function ExitStatus(status) {
    this.name = "ExitStatus";
    this.message = `Program terminated with exit(${  status  })`;
    this.status = status
}
let calledMain = false;
dependenciesFulfilled = function runCaller() {
    if (!calledRun) run();
    if (!calledRun) dependenciesFulfilled = runCaller
};

function callMain(args) {
    const entryFunction = Module._main;
    args = args || [];
    const argc = args.length + 1;
    const argv = stackAlloc((argc + 1) * 4);
    HEAP32[argv >> 2] = allocateUTF8OnStack(thisProgram);
    for (let i = 1; i < argc; i++) {
        HEAP32[(argv >> 2) + i] = allocateUTF8OnStack(args[i - 1])
    }
    HEAP32[(argv >> 2) + argc] = 0;
    try {
        const ret = entryFunction(argc, argv);
        exit(ret, true);
        return ret
    } catch (e) {
        return handleException(e)
    } finally {
        calledMain = true
    }
}

function run(args) {
    args = args || arguments_;
    if (runDependencies > 0) {
        return
    }
    preRun();
    if (runDependencies > 0) {
        return
    }

    function doRun() {
        if (calledRun) return;
        calledRun = true;
        Module.calledRun = true;
        if (ABORT) return;
        initRuntime();
        preMain();
        if (Module.onRuntimeInitialized) Module.onRuntimeInitialized();
        if (shouldRunNow) callMain(args);
        postRun()
    }
    if (Module.setStatus) {
        Module.setStatus("Running...");
        setTimeout(() => {
            setTimeout(() => {
                Module.setStatus("")
            }, 1);
            doRun()
        }, 1)
    } else {
        doRun()
    }
}
Module.run = run;

function exit(status, implicit) {
    EXITSTATUS = status;
    if (keepRuntimeAlive()) {} else {
        exitRuntime()
    }
    procExit(status)
}

function procExit(code) {
    EXITSTATUS = code;
    if (!keepRuntimeAlive()) {
        if (Module.onExit) Module.onExit(code);
        ABORT = true
    }
    quit_(code, new ExitStatus(code))
}
if (Module.preInit) {
    if (typeof Module.preInit === "function") Module.preInit = [Module.preInit];
    while (Module.preInit.length > 0) {
        Module.preInit.pop()()
    }
}
var shouldRunNow = true;
if (Module.noInitialRun) shouldRunNow = false;
run();