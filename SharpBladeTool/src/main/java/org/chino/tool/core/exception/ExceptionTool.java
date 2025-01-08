package org.chino.tool.core.exception;

import org.chino.tool.core.tool.StrTool;

/**
 * @ClassName ExceptionTool
 * @Description ExceptionTool 异常处理工具
 * @Author LiuQi
 * @Date 2025/1/8 15:17
 * @Version 1.0
 */
public class ExceptionTool {

    /**
     * ExceptionTool 构造方法
     */
    public ExceptionTool() {
    }

    /**
     * getMessage 获取异常信息
     *
     * @param e {@link Throwable} 异常对象
     * @return {@link String} 异常信息字符串
     * @author LiuQi
     */
    public static String getMessage(Throwable e) {
        // 异常对象为空时返回 "null"字符串 否则格式化处理
        return null == e
                ? "null"
                : StrTool.format("{}: {}", e.getClass().getSimpleName(), e.getMessage());
    }
}
