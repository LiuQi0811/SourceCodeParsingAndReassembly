package org.chino.tool.core.clone;

import org.chino.tool.core.exception.ExceptionTool;
import org.chino.tool.core.tool.StrTool;

/**
 * @ClassName CloneRuntimeException
 * @Description CloneRuntimeException 克隆异常类 继承 RuntimeException
 * @Author LiuQi
 * @Date 2025/1/8 10:11
 * @Version 1.0
 */
public class CloneRuntimeException extends RuntimeException {

    /**
     * serialVersionUID 序列化版本号
     *
     * @author LiuQi
     */
    private static final long serialVersionUID = 6774837422188798989L;

    /**
     * CloneRuntimeException 构造方法
     *
     * @param e {@link Throwable} 异常对象
     * @author LiuQi
     */
    public CloneRuntimeException(Throwable e) {
        // 调用父类构造方法传递异常信息
        super(ExceptionTool.getMessage(e), e);
    }

    /**
     * CloneRuntimeException 构造方法
     *
     * @param message {@link String} 异常信息
     * @author LiuQi
     */
    public CloneRuntimeException(String message) {
        // 调用父类构造方法传递异常信息
        super(message);
    }

    /**
     * CloneRuntimeException 构造方法
     *
     * @param messageTemplate {@link String} 异常信息模板
     * @param params          {@link Object} 异常信息模板参数
     * @author LiuQi
     */
    public CloneRuntimeException(String messageTemplate, Object... params) {
        // 调用父类构造方法传递异常信息
        super(StrTool.format(messageTemplate, params));
    }

    /**
     * CloneRuntimeException 构造方法
     *
     * @param message {@link String} 异常信息
     * @param e       {@link Throwable} 异常对象
     * @author LiuQi
     */
    public CloneRuntimeException(String message, Throwable e) {
        // 调用父类构造方法传递异常信息
        super(message, e);
    }

    /**
     * CloneRuntimeException 构造方法
     *
     * @param e               {@link Throwable} 异常对象
     * @param messageTemplate {@link String} 异常信息模板
     * @param params          {@link Object} 异常信息模板参数
     * @author LiuQi
     */
    public CloneRuntimeException(Throwable e, String messageTemplate, Object... params) {
        // 调用父类构造方法传递异常信息
        super(StrTool.format(messageTemplate, params), e);
    }
}
