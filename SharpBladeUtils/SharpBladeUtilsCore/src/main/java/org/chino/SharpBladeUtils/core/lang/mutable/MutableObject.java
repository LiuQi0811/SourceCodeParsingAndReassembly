package org.chino.SharpBladeUtils.core.lang.mutable;

import java.io.Serializable;

/**
 * @ClassName MutableObject
 * @Description MutableObject 可变对象{@link Object}
 * @Author LiuQi
 * @Date 2025/2/18 17:19
 * @Version 1.0
 */
public class MutableObject<T> implements Mutable<T>, Serializable {
    private static final long serialVersionUID = 1L;
    /**
     * value 当前值
     */
    private T value;

    /**
     * MutableObject 构造方法
     * Creates a new MutableObject using default {@code null} value.
     *
     * @author LiuQi
     */
    public MutableObject() {
    }

    /**
     * MutableObject 构造方法
     * Creates a new MutableObject using the specified value.
     *
     * @param value {@link T} 当前值
     * @author LiuQi
     */
    public MutableObject(final T value) {
        this.value = value;
    }

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
        return new MutableObject<>(value);
    }

    @Override
    public T get() {
        return value;
    }

    @Override
    public void set(final T value) {
        this.value = value;
    }

    /**
     * toString 方法
     * Returns the String value of this MutableObject.
     *
     * @return 返回 String 值
     * @author LiuQi
     */
    @Override
    public String toString() {
        // 返回 String 值，如果 value 为 null 则返回 "null"。否则返回 value 的 toString() 值。
        return value == null ? "null" : value.toString();
    }
}
