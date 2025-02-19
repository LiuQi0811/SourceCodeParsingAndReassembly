package org.chino.SharpBladeUtils.core.lang;

import java.util.Objects;

/**
 * @ClassName Optional_
 * @Description Optional_ 可选对象
 * @Author LiuQi
 * @Date 2025/2/19 10:59
 * @Version 1.0
 */
public class Optional_<T> {

    /**
     * value 值
     */
    private final T value;
    /**
     * throwable 异常信息
     */
    private Throwable throwable;

    /**
     * Optional_ 构造方法
     *
     * @param value 值
     * @author LiuQi
     */
    public Optional_(final T value) {
        this.value = value;
    }

    /**
     * EMPTY 空实例 {@link Optional_}
     *
     * @return {@link Optional_}
     */
    private static final Optional_<?> EMPTY = new Optional_<>(null);

    /**
     * empty 返回一个空的 {@link Optional_}
     *
     * @param <T> 泛型类型
     * @return {@link Optional_}
     * @author LiuQi
     */
    public static <T> Optional_<T> empty() {
        @SuppressWarnings("unchecked") final Optional_<T> optional = (Optional_<T>) EMPTY;
        // 返回空的 Optional 实例
        return optional;
    }

    /**
     * of 返回一个非空的 {@link Optional_}
     *
     * @param value {@link T} 值
     * @param <T>   泛型类型
     * @return {@link Optional_} 实例
     * @author LiuQi
     */
    public static <T> Optional_<T> of(final T value) {
        // 返回一个非空的 Optional 实例
        return new Optional_<T>(Objects.requireNonNull(value));
    }

    /**
     * ofNullable 返回一个可能为空的 {@link Optional_}
     *
     * @param value {@link T} 值
     * @param <T>   泛型类型
     * @return {@link Optional_} 实例
     * @author LiuQi
     */
    public static <T> Optional_<T> ofNullable(final T value) {
        // 返回一个可能为空的 Optional 实例
        return value == null ? empty() : new Optional_<T>(value);
    }

    /**
     * getOrNull 获取值，如果为空则返回 null
     *
     * @return {@link T} 值，如果为空则返回 null
     * @author LiuQi
     */
    public T getOrNull() {
        // 返回 Optional_ 中的值，如果为空则返回 null。
        return value;
    }

    /**
     * getThrowable 获取异常信息
     *
     * @return {@link Throwable} 异常信息
     * @author LiuQi
     */
    public Throwable getThrowable() {
        // 返回 Optional_ 中的异常信息。
        return throwable;
    }

    /**
     * isFail 是否失败
     *
     * @return boolean 是否失败 true 是，false 否
     * @author LiuQi
     */
    public boolean isFail() {
        // 返回 Optional_ 是否包含异常信息，即是否失败。
        return null != throwable;
    }
}
