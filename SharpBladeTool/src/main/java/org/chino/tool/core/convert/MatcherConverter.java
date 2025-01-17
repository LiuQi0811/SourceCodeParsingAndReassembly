package org.chino.tool.core.convert;

import org.chino.tool.core.reflect.TypeTool;

import java.lang.reflect.Type;

/**
 * @ClassName MatcherConverter
 * @Description MatcherConverter 转换匹配器接口 继承Converter接口
 * @Author LiuQi
 * @Date 2025/1/17 14:36
 * @Version 1.0
 */
public interface MatcherConverter extends Converter {

    /**
     * match 匹配
     *
     * @param targetType  目标类型
     * @param targetClass 目标类
     * @param value       待匹配值
     * @return {@link Boolean} 匹配成功返回true 否则false
     * @author LiuQi
     */
    boolean match(Type targetType, Class<?> targetClass, Object value);

    /**
     * match 匹配
     *
     * @param targetType 目标类型
     * @param value      待匹配值
     * @return {@link Boolean} 匹配成功返回true 否则false
     * @author LiuQi
     */
    default boolean match(Type targetType, Object value) {
        //  match 匹配处理
        return match(targetType, TypeTool.getClass(targetType), value);
    }
}
