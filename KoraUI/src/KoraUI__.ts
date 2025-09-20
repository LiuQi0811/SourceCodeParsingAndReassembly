/**
 * KoraUI (主入口，Facade)
 * │
 * ├── ConfigManager              → 配置管理（timeout, debug, version...）
 * ├── ModuleLoader               → 模块加载（useModules, definitionModule, 脚本加载）
 * ├── CacheManager               → 缓存管理（模块缓存、状态、事件、回调）
 * ├── Utility                    → 工具函数（debounce, throttle, isArray, 类型判断...）
 * ├── DeviceDetector             → 设备信息（UA 解析、os、browser、mobile...）
 * ├── EventManager               → 事件管理（on, off, emit）
 * ├── LocalStoreManager          → 本地存储（localStorage/sessionStorage 封装）
 * ├── ImagePreloader             → 图片预加载
 * └── RouteResolver              → 路由解析（hash / query）
 * @author LiuQi
 */
// @ts-ignore
import {ConfigManager} from './modules/entity/ConfigManager.js';
import {ModuleLoader} from './modules/entity/ModuleLoader.js';
import {CacheManager} from './modules/entity/CacheManager.js';
import {Utility} from './modules/entity/Utility.js';
import {DeviceDetector} from './modules/entity/DeviceDetector.js';
import {EventManager} from './modules/entity/EventManager.js';
import {LocalStoreManager} from './modules/entity/LocalStoreManager.js';
import {ImagePreloader} from './modules/entity/ImagePreloader.js';
import {RouteResolver} from './modules/entity/RouteResolver.js';

class KoraUI__ {
    public config: ConfigManager;
    public moduleLoader: ModuleLoader;
    public cache: CacheManager;
    public utils: Utility;
    public device: DeviceDetector;
    public events: EventManager;
    public storage: LocalStoreManager;
    public imageLoader: ImagePreloader;
    public router: RouteResolver;

    constructor() {
        this.config = new ConfigManager();
        this.moduleLoader = new ModuleLoader(this.config);
        this.cache = new CacheManager();
        this.utils = new Utility();
        this.device = new DeviceDetector();
        this.events = new EventManager();
        this.storage = new LocalStoreManager();
        this.imageLoader = new ImagePreloader();
        this.router = new RouteResolver();
    }

    /**
     * useModules
     */
    useModules() {
        alert(" useModules ");
    }
}

export default new KoraUI__();