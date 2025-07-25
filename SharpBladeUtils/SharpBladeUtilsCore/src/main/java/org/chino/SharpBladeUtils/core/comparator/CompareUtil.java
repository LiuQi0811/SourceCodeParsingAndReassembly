package org.chino.SharpBladeUtils.core.comparator;

import java.util.Comparator;

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
     * @see Comparator#compare(Object, Object)
     */
    public static <T extends Comparable<? super T>> boolean equals(final T value, final T value_) {
        // 调用 {@code compare(value, value_)} compare 对象比较方法
        // isNullGreater=false 默认null小于任何对象
        // 返回0 表示相等
        return compare(value, value_) == 0;
    }

    /**
     * compare 比较两个泛型对象的大小。
     * <p>
     * 该方法提供了两种比较策略：
     * 1. 如果传入了Comparator比较器(comparator不为null)，则使用该比较器进行比较。
     * 2. 如果没有传入Comparator(comparator为null)，则尝试使用Comparable接口进行自然排序比较，
     * 要求value和value_必须实现Comparable接口。
     * <p>
     * 注意事项：
     * - 当使用Comparable接口比较时：
     * - 会进行强制类型转换，如果value或value_未实现Comparable接口，将抛出ClassCastException。
     * - 如果value和value_的实际类型不同(但都实现了Comparable)，compareTo方法可能无法正确比较，
     * 因为Comparable的compareTo方法通常要求参数类型与当前对象类型相同或兼容。
     * - 当value或value_为null时：
     * - 如果comparator不为null，由comparator决定如何处理null值(可能抛出NullPointerException)。
     * - 如果comparator为null，调用Comparable.compareTo时会抛出NullPointerException。
     *
     * @param <T>        泛型类型参数，表示要比较的对象类型
     * @param value      第一个要比较的对象
     * @param value_     第二个要比较的对象
     * @param comparator 自定义比较器，用于定义对象之间的比较规则。如果为null，则尝试使用Comparable接口比较
     * @return 比较结果：
     * - 负整数：value小于value_
     * - 零：value等于value_
     * - 正整数：value大于value_
     * @throws ClassCastException   如果comparator为null，且value或value_未实现Comparable接口
     * @throws NullPointerException 如果：
     *                              - comparator为null，且value或value_为null(当调用Comparable.compareTo时)
     *                              - comparator不为null，且comparator处理null值时抛出NullPointerException
     * @author LiuQi
     */
    public static <T> int compare(T value, T value_, Comparator<T> comparator) {
        // 检查比较器是否为 null
        if (null == comparator) {
            // 如果比较器为 null，则尝试使用 Comparable 接口进行比较
            // 这里进行强制类型转换，将 value 和 value_ 转换为 Comparable 类型
            // 注意：这可能导致ClassCastException如果对象未实现Comparable
            return compare(((Comparable) value), (Comparable) value_);
        }
        // 如果比较器不为 null，则使用传入的比较器进行比较
        return comparator.compare(value, value_);
    }

    /**
     * compare 对象比较
     *
     * @param value  {@link T}    对象一 可以为{@code null}
     * @param value_ {@link T}   对象二 可以为{@code null}
     * @param <T>    {@link T} 泛型类型
     * @return
     * @description {@code null}安全的对象比较 {@link Comparator#compare(Object, Object)} 的实现。
     * <pre>
     *    -1:表示小于
     *     0:表示等于
     *     1:表示大于
     * </pre>
     * @author LiuQi
     * @see Comparator#compare(Object, Object)
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
     * @description {@code null}安全的对象比较 {@link Comparator#compare(Object, Object)} 的实现。
     * <pre>
     *    -1:表示小于
     *     0:表示等于
     *     1:表示大于
     * </pre>
     * @author LiuQi
     * @see Comparator#compare(Object, Object)
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
