import {ConfigManager} from "./ConfigManager";

/**
 * ModuleLoader 模块加载器
 * @author LiuQi
 */
export class ModuleLoader {
    constructor(private config: ConfigManager) {
        console.warn("模块加载器 ", config);
    }
    useModules(modules: any, callback?: Function) {
        alert(1111111)
    }

    definitionModule(dep: any, cb: Function) {
    }
}