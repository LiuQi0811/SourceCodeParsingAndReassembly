package org.chino.tool.core.lang.caller;

/**
 * @ClassName Caller
 * @Description Caller 调用者接口
 * @Author LiuQi
 * @Date 2025/1/11 10:42
 * @Version 1.0
 */
public interface Caller {

    /**
     * getCaller 获取调用者
     *
     * @return {@link Class<?>}
     * @author LiuQi
     */
    Class<?> getCaller();

    /**
     * getCallerCaller 获取调用者调用
     *
     * @return {@link Class<?>}
     * @author LiuQi
     */
    Class<?> getCallerCaller();
}
