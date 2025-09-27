/**
 * Callbacks.ts
 * @author LiuQi
 */
import {_Quanta} from '../Core.js';
import {rotHtmlWhite} from '../variable/RNotHtmlWhite.js';
import {toType} from '../core/ToType.js';

/**
 * createOptions 将字符串格式的选项转换为对象格式的选项
 * @param options
 * @author LiuQi
 */
function createOptions(options: any) {
    let object: any = {};
    _Quanta.each(options.match(rotHtmlWhite) || [], function (_: any, flag: any) {
        object[flag] = true;
    });
    return object;
}

/*
 * _Quanta.Callbacks 使用以下参数创建一个回调函数列表：
 *
 *	options: 一个可选的、以空格分隔的选项列表，这些选项将改变回调列表的行为；
 *			也可以传入一个更传统的选项对象。
 *
 * 默认情况下，回调列表的行为类似于事件回调列表，可以被“触发”多次。
 *
 * 可能的选项包括：
 *
 *	once:			确保回调列表只能被触发一次（类似于 Deferred 对象）
 *
 *	memory:			会记录之前触发时传入的值，并在回调列表被触发后，
 *					任何新添加的回调函数都会立即使用最新“记住”的值被调用（类似于 Deferred）
 *
 *	unique:			确保一个回调函数只能被添加一次（列表中不会有重复的回调）
 *
 *	stopOnFalse:	当某个回调函数返回 false 时，中断后续回调函数的调用
 *
 */
_Quanta.Callbacks = function (options: any) {
    // Convert options from String-formatted to Object-formatted if needed ( 如有必要，将选项从字符串格式转换为对象格式)
    // (we check in cache first) (（我们会先检查缓存）)
    options = typeof options === "string"
        ? createOptions(options)
        : _Quanta.extend({}, options);
    let
        // Flag to know if list is currently firing (用于标识当前回调列表是否正在被触发的标志位)
        firing: any,
        // Last fire value for non-forgettable lists (非可遗忘列表的上次触发时传入的值)
        memory: any,
        // Flag to know if list was already fired (用于标识该回调列表是否已经被触发过的标志位)
        fired,
        // Flag to prevent firing (用于阻止回调列表被触发的标志位)
        locked,
        // Actual callback list (实际的回调函数列表)
        list: any[] = [],
        // Queue of execution data for repeatable lists (可重复触发列表的执行数据队列)
        queue: any[] = [],
        // Index of currently firing callback (modified by add/remove as needed) (当前正在执行的回调函数在列表中的索引（会根据添加/删除操作动态调整）)
        firingIndex: number = -1,
        // Fire callbacks (触发回调)
        fire = function () {

        },
        // Actual Callbacks object (实际的回调对象)
        self = {
            // Add a callback or a collection of callbacks to the list (向列表中添加一个回调函数或一组回调函数)
            add: function () {
                if (list) {
                    // If we have memory from a past run, we should fire after adding ( 如果我们从上一次执行中保留了记忆（memory），那么在添加回调后应该立即触发（fire）它们)
                    if (memory && !firing) {
                    }
                    (function add(args: IArguments) {
                        _Quanta.each(args, function (_: any, arg: any) {
                            if (typeof arg === "function") { // A function parameter ( function类型参数)
                                if (!options.unique || !self.has(arg)) {
                                    // parameter push to list (将参数添加到列表中)
                                    list.push(arg);
                                } else if (arg && arg.length && toType(arg) !== "string") { // The parameter exists and its type is not string. (参数存在 并且类型不是string)
                                    console.warn(" // TODO .... ")
                                }
                            }
                        });
                    })(arguments);
                    if(memory && !firing){
                        console.warn(" // TODO ....")
                    }
                }
                return this;
            },
            // Remove a callback from the list (从列表中移除一个回调函数)
            remove: function () {
                console.warn("// TODO remove... ");
            },
            // Check if a given callback is in the list. ( 检查给定的回调函数是否存在于列表中。)
            // If no argument is given, return whether or not list has callbacks attached. (如果没有传入任何参数，则返回列表中是否绑定了任何回调函数。)
            has: function (func: any) {
                return func ? _Quanta.inArray(func, list)
                    : list.length > 0;
            },
            // Remove all callbacks from the list (从列表中移除所有回调函数)
            empty: function () {
                console.warn("// TODO empty... ");
            },
            // Disable .fire and .add (禁用 .fire 和 .add 方法)
            // Abort any current/pending executions (中止任何当前或等待中的执行)
            // Clear all callbacks and values (清空所有回调函数和缓存值)
            disable: function () {
                console.warn("// TODO disable... ");
            },
            disabled: function () {
                console.warn("// TODO disabled... ");
            },
            // Disable .fire (禁用 .fire 方法)
            // Also disable .add unless we have memory (since it would have no effect) (同时也禁用 .add 方法，除非启用了 memory 选项（否则添加回调也没有效果）)
            // Abort any pending executions (中止任何等待中的执行)
            lock: function () {
                console.warn("// TODO lock... ");
            },
            locked: function () {
                console.warn("// TODO locked... ");
            },
            // Call all callbacks with the given context and arguments (使用给定的上下文（this 值）和参数，调用所有的回调函数)
            fireWith: function () {
                console.warn("// TODO fireWith... ");
            },
            // Call all the callbacks with the given arguments (使用给定的参数，调用所有的回调函数)
            fire: function () {
                console.warn("// TODO fire... ");
            },
            // To know if the callbacks have already been called at least once (用于判断回调函数是否至少已经被调用过一次)
            fired: function () {
                console.warn("// TODO fired... ");
            }
        };
    return self;
}


export {_Quanta, _Quanta as _Q};