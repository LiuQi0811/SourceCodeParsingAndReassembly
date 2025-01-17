package org.chino.tool.core.reflect;

import java.lang.reflect.Type;

/**
 * @ClassName TypeReference
 * @Description TypeReference 类型引用 实现Type接口
 * @Author LiuQi
 * @Date 2025/1/17 17:16
 * @Version 1.0
 */
public class TypeReference<T> implements Type {

    /**
     * TYPE 类型 - 获取类型参数
     *
     * @author LiuQi
     */
    private final Type TYPE = TypeTool.getTypeArgument(this.getClass());

    /**
     * TypeReference 构造方法
     *
     * @author LiuQi
     */
    public TypeReference() {
    }

    /**
     * getType 获取类型
     *
     * @return {@link Type} 类型
     * @author LiuQi
     */
    public Type getType() {
        // 返回类型参数
        return TYPE;
    }

    /**
     * toString 方法
     *
     * @return {@link String} 字符串
     * @author LiuQi
     */
    public String toString() {
        // 返回类型参数的字符串处理
        return TYPE.toString();
    }
}
