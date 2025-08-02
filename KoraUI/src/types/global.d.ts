/*
 * 扩展 Window 接口
 */
export {};
declare global {
    interface Window {
        KoraUI: any; // 全局 KoraUI 实例
        KoraUIGlobal?: {
            dir?: string;
        };
    }
}