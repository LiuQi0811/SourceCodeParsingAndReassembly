package org.chino.tool.core.lang.caller;

import java.io.Serializable;

/**
 * @ClassName SecurityManagerCaller
 * @Description SecurityManagerCaller 安全管理调用者对象
 * @Warning 警告信息 SecurityManager 已过时目前未找到解决方案，暂时使用 取消警告方法替代
 * @Author LiuQi
 * @Date 2025/1/11 10:55
 * @Version 1.0
 */
public class SecurityManagerCaller extends SecurityManager implements Caller, Serializable {

    /**
     * serialVersionUID 序列化版本号
     */
    private static final long serialVersionUID = 1L;

    /**
     * SecurityManagerCaller 构造方法
     *
     * @author LiuQi
     */
    public SecurityManagerCaller() {

    }

    @Override
    public Class<?> getCaller() {
        // 获取类加载器上下文对象
        Class<?>[] classContext = this.getClassContext();
        // 类加载器上下文 不为空 且长度大于2 则返回第三个元素 即调用者 否则返回null
        return null != classContext && 2 < classContext.length ? classContext[2] : null;
    }

    @Override
    public Class<?> getCallerCaller() {
        // 获取类加载器上下文对象
        Class<?>[] classContext = this.getClassContext();
        // 类加载器上下文 不为空 且长度大于3 则返回第四个元素 即调用者 否则返回null
        return null != classContext && 3 < classContext.length ? classContext[3] : null;
    }
}
