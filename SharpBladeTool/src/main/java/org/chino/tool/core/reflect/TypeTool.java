package org.chino.tool.core.reflect;

import java.lang.reflect.ParameterizedType;
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

    /**
     * getTypeArgument 获取类型参数
     *
     * @param type {@link Type} 类型
     * @return {@link Type} 类型
     * @author LiuQi
     */
    public static Type getTypeArgument(Type type) {
        // getTypeArgument 获取类型参数处理
        return getTypeArgument(type, 0);
    }

    /**
     * getTypeArgument 获取类型参数
     *
     * @param type  {@link Type} 类型
     * @param index {@link Integer} 索引
     * @return {@link Type} 类型
     * @author LiuQi
     */
    public static Type getTypeArgument(Type type, int index) {
        getTypeArguments(type);
        return null;
    }

    /**
     * getTypeArguments 获取类型参数数组
     *
     * @param type {@link Type} 类型
     * @return {@link Type} 类型数组
     * @author LiuQi
     */
    public static Type[] getTypeArguments(Type type) {
        if (null == type) { // 类型为空
            // 返回null
            return null;
        } else {// 类型不为空
            // toParameterizedType 将类型转换为参数化类型处理
            toParameterizedType(type);
            // TODO
            return null;
        }
    }

    /**
     * toParameterizedType 将类型转换为参数化类型
     *
     * @param type {@link Type} 类型
     * @return {@link ParameterizedType} 参数化类型接口
     * @author LiuQi
     */
    public static ParameterizedType toParameterizedType(Type type) {
        // toParameterizedType 将类型转换为参数化类型处理
        return toParameterizedType(type, 0);
    }

    /**
     * toParameterizedType 将类型转换为参数化类型
     *
     * @param type           {@link Type} 类型
     * @param interfaceIndex {@link Integer} 接口索引
     * @return {@link ParameterizedType} 参数化类型接口
     * @author LiuQi
     */
    public static ParameterizedType toParameterizedType(Type type, int interfaceIndex) {
        if (type instanceof TypeReference<?>) { // TypeReference 类型
            System.out.println("TypeReference 类型");
        }
        // TODO
        return null;
    }
}
