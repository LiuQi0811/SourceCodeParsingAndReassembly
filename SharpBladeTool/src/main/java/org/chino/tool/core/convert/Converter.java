package org.chino.tool.core.convert;

import org.chino.tool.core.tool.ObjTool;

import java.lang.reflect.Type;

/**
 * @ClassName Converter
 * @Description Converter 转换处理接口
 * @Author LiuQi
 * @Date 2025/1/9 11:40
 * @Version 1.0
 */
@FunctionalInterface
public interface Converter {

    /**
     * convert 转换方法
     *
     * @param type  类型
     * @param value 值
     * @return {@link Object} 转换后的值
     * @author LiuQi
     */
    Object convert(Type type, Object value);


    /**
     * convert 转换方法
     *
     * @param targetType   目标类型
     * @param value        值
     * @param defaultValue 默认值
     * @param <T>          泛型
     * @return {@link T} 转换后的值
     * @author LiuQi
     */
    default <T> T convert(Type targetType, Object value, T defaultValue) {
        // 转换处理，如果转换结果为空则返回默认值
        return (T) ObjTool.defaultIfNull(convert(targetType, value), defaultValue);
    }

}
