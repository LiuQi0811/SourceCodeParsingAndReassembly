/**
 * Ready.ts
 * @author LiuQi
 */
import {_Quanta} from '../Core.js';
import '../Deferred.js';

/**
 * ready
 * @author LiuQi
 */
let ready = _Quanta.fn.ready = function (fn: Record<string, any>) {
    console.log(" Ready..... -> ", fn);
};

ready.prototype = _Quanta.fn;