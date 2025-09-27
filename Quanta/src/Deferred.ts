/**
 * Deferred.ts
 * @author LiuQi
 */
import {_Quanta} from './Quanta.js';
import './core/Callbacks.js';

_Quanta.extend({
    Deferred: function (func: any) {
        let tuples: any[][] = [
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
            promise: any = {},
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
                list.add();
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
            // deferred.notifyWith = list.fireWith
            // deferred.resolveWith = list.fireWith
            // deferred.rejectWith = list.fireWith
            deferred[tuple[0] + "With"] = list.fireWith;
        });

        console.warn(" Promise ", promise);
        console.warn(" Deferred ", deferred);
    },
    // Deferred helper (Deferred 辅助函数)
    when: function () {

    }
});

export {_Quanta, _Quanta as _Q};