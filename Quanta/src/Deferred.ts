/**
 * Deferred.ts
 * @author LiuQi
 */
import {_Quanta} from './Quanta.js';
import './core/Callbacks.js';

_Quanta.extend({
    Deferred: function (func: any) {
        let tuples: any = [
                // action, add listener, callbacks, ( 动作、添加监听器、回调函数，)
                // ... .then handlers, argument index, [final state] (…… .then 处理函数、参数索引、[最终状态])
                ["notify", "progress", _Quanta.Callbacks("memory"),
                    _Quanta.Callbacks("memory"), 2],
                ["resolve", "done", _Quanta.Callbacks("once memory"),
                    _Quanta.Callbacks("once memory"), 0, "resolved"],
                ["reject", "fail", _Quanta.Callbacks("once memory"),
                    _Quanta.Callbacks("once memory"), 1, "rejected"]
            ],
            state = "pending",
            promise: any = {
                then: function (onFulfilled: any, onRejected: any, onProgress: any) {
                    if (typeof onFulfilled === "function") {
                        onFulfilled();
                    }
                },
                // Get a promise for this deferred (获取此延迟对象对应的 Promise)
                // If value is provided, the promise aspect is added to the object (如果传入了 value，则会将 Promise 特性添加到该对象上)
                promise: function (value: any) {
                    return value !== null ? _Quanta.extend(value, promise) : promise;
                }
            },
            deferred: any = {};
        // Add list-specific methods (添加列表专属的方法)
        _Quanta.each(tuples, function (i: number, tuple: any) {
            let list = tuple[2],
                stateString = tuple[5];
            // promise.progress = list.add (将 promise.progress 指向 list.add)
            // promise.done = list.add ( 将 promise.done 指向 list.add)
            // promise.fail = list.add ( 将 promise.fail 指向 list.add)
            promise[tuple[1]] = list.add;
            // Handle state (处理状态)
            if (stateString) {
                list.add(function () {
                        // state = "resolved" (i.e., fulfilled) (状态为 "resolved"（即 fulfilled，表示异步操作已成功完成）)
                        // state = "rejected" (状态为 "rejected"（表示异步操作已失败或被拒绝）)
                        state = stateString;
                    },
                    // rejected_callbacks.disable (禁用 rejected 回调队列)
                    // fulfilled_callbacks.disable (禁用 fulfilled 回调队列)
                    tuples[3 - i][2].disable),
                    // rejected_handlers.disable (禁用 rejected_handlers（调用 disable 方法，阻止后续 rejected 回调执行）)
                    // fulfilled_handlers.disable (禁用 fulfilled_handlers（调用 disable 方法，阻止后续 fulfilled 回调执行）)
                    tuples[3 - i][3].disable,
                    // progress_callbacks.lock (锁定 progress_callbacks（禁止继续添加或触发进度回调）)
                    tuples[0][2].lock,
                    // progress_handlers.lock (锁定 progress_handlers（禁止继续添加新的进度回调）)
                    tuples[0][3].lock
            }
            // progress_handlers.fire (触发 progress 相关的回调函数（即进度更新回调）)
            // fulfilled_handlers.fire (触发 fulfilled 相关的回调函数（即操作成功回调）)
            // rejected_handlers.fire (触发 rejected 相关的回调函数（即操作失败回调）)
            list.add(tuple[3].fire);
            // deferred.notify = function() { deferred.notifyWith(...) } (将 deferred.notify 定义为调用 deferred.notifyWith(...))
            // deferred.resolve = function() { deferred.resolveWith(...) } (将 deferred.resolve 定义为调用 deferred.resolveWith(...))
            // deferred.reject = function() { deferred.rejectWith(...) } (将 deferred.reject 定义为调用 deferred.rejectWith(...))
            deferred[tuple[0]] = function () {
            }
            // deferred.notifyWith = list.fireWith (将 deferred.notifyWith 指向 list.fireWith（复用其触发逻辑）)
            // deferred.resolveWith = list.fireWith (将 deferred.resolveWith 指向 list.fireWith（复用其触发逻辑）)
            // deferred.rejectWith = list.fireWith (将 deferred.rejectWith 指向 list.fireWith（复用其触发逻辑）)
            deferred[tuple[0] + "With"] = list.fireWith;
        });
        // Make the deferred a promise (将 deferred 对象转换为 promise 对象)
        promise.promise(deferred);
        // Call given func if any (如果传入了函数，则调用该函数)
        if (func) {
            console.warn(" // TODO ....")
        }
        // All done! (全部完成！)
        return deferred;
    },
    // Deferred helper (Deferred 辅助函数)
    when: function () {

    }
});

export {_Quanta, _Quanta as _Q};