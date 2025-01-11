package org.chino.tool.core.tool;

import java.util.function.Supplier;

/**
 * @ClassName ObjTool
 * @Description ObjTool 对象处理工具
 * @Author LiuQi
 * @Date 2025/1/9 11:05
 * @Version 1.0
 */
public class ObjTool {
    /**
     * ObjTool 构造方法
     *
     * @author LiuQi
     */
    public ObjTool() {

    }

    /**
     * defaultIfNull 默认值（如果为空）
     *
     * @param param                参数
     * @param defaultValueSupplier 默认值提供者 - 函数表达式（Lambda表达式）
     * @param <T>                  泛型
     * @return {@link T} 默认值（如果为空）
     * @author LiuQi
     */
    public static <T> T defaultIfNull(T param, Supplier<? extends T> defaultValueSupplier) {
        // 如果param参数 是null 则返回 defaultValueSupplier.get() 否则返回 param值
        return isNull(param) ? defaultValueSupplier.get() : param;
    }

    /**
     * isNull 是否为空
     *
     * @param param 参数
     * @return {@link Boolean}
     * @author LiuQi
     */
    public static Boolean isNull(Object param) {
        // 如果param参数 是null 或者 等于 null 则返回 true
        return null == param
                || param.equals(null);
    }
}
