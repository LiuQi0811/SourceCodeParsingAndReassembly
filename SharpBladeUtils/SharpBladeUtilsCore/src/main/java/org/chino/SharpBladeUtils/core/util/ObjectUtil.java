package org.chino.SharpBladeUtils.core.util;

import java.util.function.Function;

/**
 * @ClassName ObjectUtil
 * @Description ObjectUtil 对象处理工具
 * <pre>
 *    1. 判断对象是否为空
 *    2. 对象克隆
 *    3. 序列化
 * </pre>
 * @Author LiuQi
 * @Date 2025/2/22 11:38
 * @Version 1.0
 */
public class ObjectUtil {

    /**
     * isNull 对象是否为空
     *
     * @param value {@link Object} 对象
     * @return {@link Boolean} 对象是否为空 true:空 false:非空
     * @author LiuQi
     */
    public static boolean isNull(final Object value) {
        // 返回对象是否为空 true:空 false:非空
        return null == value;
    }

    /**
     * defaultIfNull 是否为空则返回默认值
     *
     * @param value         {@link Object} 对象
     * @param customHandler {@link Function} 自定义处理器
     * @param defaultValue  {@link R} 默认值
     * @param <T>           {@link T}     默认值类型
     * @param <R>           {@link R}    返回值类型
     * @return {@link R} 返回值
     * @description 返回自定义handler处理后的结果，否则返回默认值
     * @author LiuQi
     */
    public static <T, R> R defaultIfNull(final T value, final Function<? super T, ? extends R> customHandler, final R defaultValue) {
        // 返回参数对象为空返回默认值，否则返回自定义handler处理后的结果。
        return isNull(value) ? defaultValue : customHandler.apply(value);
    }
}
