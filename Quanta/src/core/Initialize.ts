/**
 * Initialize.ts
 * @author LiuQi
 */
import {_Quanta} from '../Core.js';
import {document} from '../variable/Document.js';

let rootQuanta_: any,
    /**
     * initialize
     * @author LiuQi
     */
    initialize = _Quanta.fn.initialize = function (selector: Document | Record<string, any>, context: Record<string, any>) {
        console.info("Initialize.... -> ", selector, context);
        // 对 ""、null、undefined、false 作为参数传入 _Q() 的情况进行处理
        if (!selector) return this;
        // 对 DOM 元素作为参数传入 _Q(DOMElement)的情况进行处理
        if (selector.nodeType) {
            this[0] = selector;
            this.length = 1;
            return this;
        }
        // 对Function 作为参数传入 _Q(Function) 的情况进行处理
        else if (typeof selector === "function") {
            return rootQuanta_.ready !== undefined
                ? rootQuanta_.ready(selector)
                : selector(_Quanta);
        }
    };

initialize.prototype = _Quanta.fn;

// Initialize central reference (初始化中心引用)
rootQuanta_ = _Quanta(document);
