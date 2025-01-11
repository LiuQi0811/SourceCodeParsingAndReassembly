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
    public static Boolean isUnknown(Type type) {
        // 如果是 null 或者 TypeVariable 类型 认为是未知类型
        return null == type
                || type instanceof TypeVariable<?>;
    }
}
