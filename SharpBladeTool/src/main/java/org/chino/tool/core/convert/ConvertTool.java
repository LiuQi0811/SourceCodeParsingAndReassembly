package org.chino.tool.core.convert;

import java.lang.reflect.Type;

/**
 * @ClassName ConvertTool
 * @Description ConvertTool 转换处理工具
 * @Author LiuQi
 * @Date 2025/1/9 9:43
 * @Version 1.0
 */
public class ConvertTool {

    /**
     * ConvertUtil 构造方法
     *
     * @author LiuQi
     */
    public ConvertTool() {
    }

    /**
     * toStr 字符串类型转换处理
     *
     * @param value        {@link Object}值
     * @param defaultValue {@link String}默认值
     * @return {@link String} 处理后的字符串
     * @author LiuQi
     */
    public static String toStr(Object value, String defaultValue) {
        // convertQuietly 字符串类型静默转换处理
        return convertQuietly(String.class, value, defaultValue);
    }

    /**
     * convertQuietly 静默转换处理
     *
     * @param type         {@link Type}类型
     * @param value        {@link Object} 值
     * @param defaultValue {@link String}默认值
     * @param <T>          泛型
     * @return {@link T}
     * @author LiuQi
     */
    public static <T> T convertQuietly(Type type, Object value, T defaultValue) {
        // convertWithCheck 转换校验检查处理 - 静默转换开启
        return convertWithCheck(type, value, defaultValue, true);
    }

    /**
     * convertWithCheck 转换校验检查处理
     *
     * @param type         {@link Type}类型
     * @param value        {@link Object} 值
     * @param defaultValue {@link String}默认值
     * @param quietly      {@link Boolean} 是否静默转换
     * @param <T>          泛型
     * @return {@link T}
     * @author LiuQi
     */
    public static <T> T convertWithCheck(Type type, Object value, T defaultValue, boolean quietly) {
        // 获取CompositeConverter 转换注册实例 - 单例模式
        CompositeConverter compositeConverter = CompositeConverter.getInstance();
        try {
            // 返回 convert 转换处理结果
            return compositeConverter.convert(type, value, defaultValue);
        } catch (Exception e) {
            if (quietly) { // 静默转换处理
                // 返回默认值处理结果
                return defaultValue;
            } else {
                // 抛出异常处理
                throw e;
            }
        }
    }
}
