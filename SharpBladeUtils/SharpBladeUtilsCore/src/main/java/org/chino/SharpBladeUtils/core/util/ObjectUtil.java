package org.chino.SharpBladeUtils.core.util;

import java.util.Objects;
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
     * apply 是否应用提供的映射函数并返回结果
     *
     * @param value         {@link Object} 对象
     * @param customHandler {@link Function} 自定义处理器
     * @param <T>           {@link T} 参数类型
     * @param <R>           {@link R}返回值类型
     * @return {@link R} 返回值
     * @description 如果指定的对象不为 {@code null},则应用提供的映射函数并返回结果,否则返回 {@code null}。
     * @author LiuQi
     */
    public static <T, R> R apply(final T value, Function<T, R> customHandler) {
        // 如果指定的对象不为 {@code null},则应用提供的映射函数并返回结果,否则返回 {@code null}
        return defaultIfNull(value, customHandler, null);
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

    /**
     * equal 比较两个 Object 类型的值是否相等。
     * 如果两个值都是 Number 类型（如 Integer、Long、Double、BigDecimal 等），则调用 NumberUtil.equals 方法进行数值比较；
     * 否则使用 Objects.equals 方法进行常规比较（支持 null 值判断）。
     *
     * @param data  {@link Object} 第一个待比较的值（Object 类型）
     * @param data_ {@link Object} 第二个待比较的值（Object 类型）
     * @return 如果两个值相等，返回 true；否则返回 false
     * @author LiuQi
     */
    public static boolean equal(Object data, Object data_) {
        // 如果两个值都是 Number 类型（包括 Integer、Long、Double、BigDecimal 等子类）
        if (data instanceof Number && data_ instanceof Number) {
            // 调用 NumberUtil.equals 方法进行数值比较（支持高精度数值比较，如 BigDecimal）
            return NumberUtil.equals(((Number) data), ((Number) data_));
        }
        // 如果至少有一个值不是 Number 类型，则使用 Objects.equals 进行常规比较
        return Objects.equals(data, data_);
    }
}
