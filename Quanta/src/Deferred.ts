/**
 * Deferred.ts
 * @author LiuQi
 */
import {_Quanta} from './Quanta.js';

_Quanta.extend({
    a: function (){
        alert(" AAA ");
    }
});

export {_Quanta, _Quanta as _Q};