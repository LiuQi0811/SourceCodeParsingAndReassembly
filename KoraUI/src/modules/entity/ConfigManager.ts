/**
 * ConfigManager 配置管理
 * @author LiuQi
 */
export class ConfigManager {
    private readonly config: {
        timeout: number;
        debugMode: boolean;
        version: string;
        host?: string;
    };

    constructor() {
        this.config = {
            timeout: 10,
            debugMode: false,
            version: "6.7.0",
        };
    }


    get<K extends keyof typeof this.config>(key: K): typeof this.config[K] {
        return this.config[key];
    }

    set<K extends keyof typeof this.config>(key: K, value: typeof this.config[K]) {
        this.config[key] = value;
    }

    getConfig() {
        return {...this.config};
    }
}