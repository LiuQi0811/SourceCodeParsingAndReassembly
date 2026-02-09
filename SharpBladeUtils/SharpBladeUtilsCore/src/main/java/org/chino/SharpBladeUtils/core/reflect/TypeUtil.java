package org.chino.SharpBladeUtils.core.reflect;

import java.lang.reflect.Type;
import java.lang.reflect.TypeVariable;

/**
 * @ClassName TypeUtil
 * @Description TypeUtil 类型工具 针对 {@link Type} 的工具
 * @Author LiuQi
 */
public class TypeUtil {
    /**
     * isUnknown 判断给定类型是否为"未知类型"。
     * <p>
     * 定义"未知类型"的标准：
     * 1. 类型为null（未指定类型）
     * 2. 类型是TypeVariable（类型变量，如泛型参数T）
     * <p>
     * 这类类型通常出现在以下场景：
     * - 原始类型(Raw Type)擦除后的泛型信息丢失
     * - 方法签名中的未具体化泛型参数
     * - 类型推断失败的情况
     *
     * @param type 要检查的Java类型(可能为Class、ParameterizedType等)
     * @return 如果类型为null或是类型变量(TypeVariable)，则返回true；
     * 否则返回false表示这是一个已知的具体类型
     * @apiNote 1. 此方法常用于泛型类型安全检查的预处理阶段
     * 2. 返回true时表示无法确定具体类型信息，需要特殊处理
     * 3. 典型应用场景包括：JSON反序列化时的类型推断、
     * 反射操作中的类型验证等
     * @author LiuQi
     */
    public static boolean isUnknown(final Type type) {
        // 判断条件：
        // 1. 类型为null（未指定类型）
        // 2. 类型是TypeVariable（泛型类型参数，如T）
        return null == type || type instanceof TypeVariable;
    }
}
