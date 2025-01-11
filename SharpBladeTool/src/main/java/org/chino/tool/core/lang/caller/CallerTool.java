package org.chino.tool.core.lang.caller;

/**
 * @ClassName CallerTool
 * @Description CallerTool 调用者处理工具
 * @Author LiuQi
 * @Date 2025/1/11 10:35
 * @Version 1.0
 */
public class CallerTool {

    /**
     * INSTANCE 调用者实例
     */
    private static final Caller INSTANCE = tryCreateCaller();

    /**
     * CallerTool 构造方法
     *
     * @author LiuQi
     */
    public CallerTool() {
    }

    /**
     * getCaller 获取调用者
     *
     * @return {@link Class<?>}
     * @author LiuQi
     */
    public static Class<?> getCaller() {
        // 返回调用者对象接口的调用者
        return INSTANCE.getCaller();
    }

    /**
     * getCallerCaller 获取调用者调用
     *
     * @return {@link Class<?>}
     * @author LiuQi
     */
    public static Class<?> getCallerCaller() {
        // 返回调用者对象接口的调用者
        return INSTANCE.getCallerCaller();
    }

    /**
     * tryCreateCaller 尝试创建调用者
     *
     * @return {@link Caller}
     * @author LiuQi
     */
    private static Caller tryCreateCaller() {
        try {
            // 创建SecurityManagerCaller对象 - Caller接口
            Caller caller = new SecurityManagerCaller();
            if (null != caller.getCaller() && null != caller.getCallerCaller()) { // 调用者不为空 并且 调用者调用不为空
                // 返回调用者对象接口
                return caller;
            }
        } catch (Exception e) {
            e.printStackTrace();
        }
        // 创建StackTraceCaller对象 - Caller接口
        Caller caller = new StackTraceCaller();
        // 返回调用者对象接口
        return caller;
    }
}
