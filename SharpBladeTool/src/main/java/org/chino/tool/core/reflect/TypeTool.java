package org.chino.tool.core.reflect;

import java.lang.reflect.Type;
import java.lang.reflect.TypeVariable;

/**
 * @ClassName TypeTool
 * @Description TypeTool 类型处理工具
 * @Author LiuQi
 * @Date 2025/1/9 10:29
 * @Version 1.0
 */
public class TypeTool {

    /**
     * TypeTool 构造方法
     *
     * @author LiuQi
     */
    public TypeTool() {
    }

    /**
     * isUnknown 是否是未知类型
     *
     * @param type {@link Type} 类型
     * @return {@link Boolean} true 是 false 否
     * @author LiuQi
     */
    public static boolean isUnknown(Type type) {
        // 如果是 null 或者 TypeVariable 类型 认为是未知类型
        return null == type
                || type instanceof TypeVariable<?>;
    }

    /**
     * getClass 获取类型对应的 Class类型
     *
     * @param type {@link Type} 类型
     * @return {@link Class} 类型
     * @author LiuQi
     */
    public static Class<?> getClass(Type type) {
        if (null == type) { // 参数类型为空
            return null;
        } else if (type instanceof Class) { // 参数类型为Class
            // 直接返回参数类型
            return (Class<?>) type;
        }
        // TODO 此处可以继续扩展其他类型的处理逻辑
        return null;
    }
}
