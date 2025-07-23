package org.chino.SharpBladeUtils.core.comparator;

/**
 * @ClassName CompareUtil
 * @Description CompareUtil Compare比较处理工具
 * @Author LiuQi
 */
public class CompareUtil {

    /**
     * equals 对象比较
     *
     * @param value  {@link T}    对象一 可以为{@code null}
     * @param value_ {@link T}   对象二 可以为{@code null}
     * @param <T>    {@link T} 泛型类型 (泛型限定为实现了Comparable接口的类型)
     * @return {@code true} 表示相等， {@code false} 表示不相等。
     * @author LiuQi
     * @see java.util.Comparator#compare(Object, Object)
     */
    public static <T extends Comparable<? super T>> boolean equals(final T value, final T value_) {
        // 调用 {@code compare(value, value_)} compare 对象比较方法
        // isNullGreater=false 默认null小于任何对象
        // 返回0 表示相等
        return compare(value, value_) == 0;
    }

    /**
     * compare 对象比较
     *
     * @param value  {@link T}    对象一 可以为{@code null}
     * @param value_ {@link T}   对象二 可以为{@code null}
     * @param <T>    {@link T} 泛型类型
     * @return
     * @description {@code null}安全的对象比较 {@link java.util.Comparator#compare(Object, Object)} 的实现。
     * <pre>
     *    -1:表示小于
     *     0:表示等于
     *     1:表示大于
     * </pre>
     * @author LiuQi
     * @see java.util.Comparator#compare(Object, Object)
     */
    public static <T extends Comparable<? super T>> int compare(final T value, final T value_) {
        // 调用 {@code compare(value, value_, false)} compare 对象比较方法
        // isNullGreater=false 默认null小于任何对象
        return compare(value, value_, false);
    }

    /**
     * compare 对象比较
     *
     * @param value         {@link T}    对象一 可以为{@code null}
     * @param value_        {@link T}   对象二 可以为{@code null}
     * @param isNullGreater 当被比较对象为null时是否排在后面，true表示null大于任何对象，false表示null小于任何对象
     * @param <T>           {@link T} 泛型类型
     * @return
     * @description {@code null}安全的对象比较 {@link java.util.Comparator#compare(Object, Object)} 的实现。
     * <pre>
     *    -1:表示小于
     *     0:表示等于
     *     1:表示大于
     * </pre>
     * @author LiuQi
     * @see java.util.Comparator#compare(Object, Object)
     */
    public static <T extends Comparable<? super T>> int compare(final T value, final T value_, final boolean isNullGreater) {
        if (value == value_) { // 参数一，二相等
            // 返回0 表示相等
            return 0;
        } else if (value == null) { // 参数一为null
            // 返回值取决于isNullGreater  true 返回1 表示null大于任何对象，false返回-1 表示null小于任何对象
            return isNullGreater ? 1 : -1;
        } else if (value_ == null) { // 参数二为null
            // 返回值取决于isNullGreater  true 返回-1 表示null小于任何对象，false返回1 表示null大于任何对象
            return isNullGreater ? -1 : 1;
        }
        // 返回 参数一与参数二比较的结果
        return value.compareTo(value_);
    }
}
