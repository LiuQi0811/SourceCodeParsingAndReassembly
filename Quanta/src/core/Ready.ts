/**
 * Ready.ts
 * @author LiuQi
 */
import {_Quanta} from '../Core.js';
import '../Deferred.js';
import {document} from '../variable/Document.js';
import {_window} from '../variable/Window.js';

/**
 * ready
 * @author LiuQi
 */
// The deferred used on DOM ready (在 DOM 就绪时使用的 deferred（延迟对象）)
let readyList = _Quanta.Deferred(),
    ready = _Quanta.fn.ready = function (fn: Record<string, any>) {
        // Execute a function using Promise's then()method (通过 Promise 的 then() 方法执行函数)
        readyList.then(fn);
    };
_Quanta.extend({
    // Is the DOM ready to be used? Set to true once it occurs.(DOM 是否已经可以安全使用？一旦就绪，将其设为 true)
    isReady: false,
    // A counter to track how many items to wait for before (一个计数器，用于跟踪在 ready 事件触发之前需要等待多少个项目)
    readyWait: 1,
    // Handle when the DOM is ready (处理 DOM 就绪时的逻辑)
    ready: function (wait: any) {
        // Abort if there are pending holds or we're already ready (如果存在未完成的等待（pending holds）或我们已经处于就绪状态，则中止（操作）)
        // Remember that the DOM is ready (记住，此时 DOM 已经就绪)
        _Quanta.isReady = true;
        // If a normal DOM Ready event fired, decrement, and wait if need be (如果触发了正常的 DOM 就绪事件，则减少计数，并根据需要等待)
        if (wait !== true && --_Quanta.readyWait > 0) return;
        // If there are functions bound, to execute (如果有已绑定的函数，则执行它们)
        console.error(" readyList ", readyList)
    }
});

// Catch cases where _Q(document).ready() is called
// after the browser event has already occurred. (处理在浏览器事件已经触发之后才调用 _Q(document).ready() 的情况)
if (document?.readyState !== "loading") {
    // Handle it asynchronously to allow scripts the opportunity to delay ready (异步处理该逻辑，以便脚本有机会延迟 ready 状态的执行)
    _window.setTimeout(_Quanta.ready);
} else {
    console.log(" isLoading !!!!");
}
ready.prototype = _Quanta.fn;