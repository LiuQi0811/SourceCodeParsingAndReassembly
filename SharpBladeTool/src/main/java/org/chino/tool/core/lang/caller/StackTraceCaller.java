package org.chino.tool.core.lang.caller;

import java.io.Serializable;

/**
 * @ClassName StackTraceCaller
 * @Description StackTraceCaller 堆栈跟踪调用对象
 * @Author LiuQi
 * @Date 2025/1/11 11:48
 * @Version 1.0
 */
public class StackTraceCaller implements Caller, Serializable {

    /**
     * serialVersionUID 序列化版本号
     */
    private static final long serialVersionUID = 1L;

    /**
     * StackTraceCaller 构造方法
     *
     * @author LiuQi
     */
    public StackTraceCaller() {
    }

    @Override
    public Class<?> getCaller() {
        // TODO 待实现
        return null;
    }

    @Override
    public Class<?> getCallerCaller() {
        // TODO 待实现
        return null;
    }
}
