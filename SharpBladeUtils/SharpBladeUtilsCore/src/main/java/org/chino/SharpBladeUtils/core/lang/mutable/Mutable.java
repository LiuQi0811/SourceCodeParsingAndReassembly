package org.chino.SharpBladeUtils.core.lang.mutable;

import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Predicate;
import java.util.function.UnaryOperator;

/**
 * @ClassName Mutable
 * @Description Mutable 提供可变值类型接口
 * @Author LiuQi
 * @Date 2025/2/18 17:14
 * @Version 1.0
 */
public interface Mutable<T> {

    /**
     * of 静态方法，创建 MutableObject 对象
     *
     * @param value 当前值
     * @param <T>   泛型类型
     * @return 返回 MutableObject 对象
     * @author LiuQi
     */
    static <T> MutableObject<T> of(final T value) {
        // 创建 MutableObject 对象
        return new MutableObject<T>(value);
    }

    /**
     * get 获取当前值
     *
     * @return 返回 {@link T}当前值
     * @author LiuQi
     */
    T get();

    /**
     * set 设置当前值
     *
     * @param value {@link T}要设置的值
     * @author LiuQi
     */
    void set(T value);


    /**
     * map 映射当前值
     *
     * @param operator {@link UnaryOperator<T>} 映射
     * @return {@link Mutable<T>} 当前对象
     * @author LiuQi
     */
    default Mutable<T> map(final UnaryOperator<T> operator) {
        // 设置当前值
        set(operator.apply(get()));
        // 返回当前对象
        return this;
    }

    /**
     * peek 检查操作当前值
     *
     * @param consumer {@link Consumer<T>} 检查操作
     * @return {@link Mutable<T>} 当前对象
     * @author LiuQi
     */
    default Mutable<T> peek(final Consumer<T> consumer) {
        // 检查操作当前值
        consumer.accept(get());
        // 返回当前对象
        return this;
    }

    /**
     * test 检查当前值是否满足条件
     *
     * @param predicate {@link Predicate<T>} 检查条件
     * @return {@link Boolean} 当前值是否满足条件
     * @author LiuQi
     */
    default boolean test(final Predicate<T> predicate) {
        // 返回当前值是否满足条件
        return predicate.test(get());
    }

    /**
     * to 转换当前值
     *
     * @param function 转换函数
     * @param <R>      转换后的类型
     * @return {@link R} 转换后的值
     * @description 获取值，并将值转换为指定类型。
     * @author LiuQi
     */
    default <R> R to(final Function<T, R> function) {
        // 检查 function 是否为 null
        Objects.requireNonNull(function);
        // 返回转换后的值
        return function.apply(get());
    }
}
