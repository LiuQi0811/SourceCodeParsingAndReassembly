package org.chino.SharpBladeUtils.core.math;


import java.math.BigDecimal;
import java.util.Objects;

/**
 * @ClassName NumberUtil
 * @Description NumberUtil 数字工具
 * @Author LiuQi
 */
public class NumberUtil {

    /**
     * equals 比较两个 {@link Number} 类型的数值是否相等。
     * 如果两个数值都是 {@link BigDecimal} 类型，则调用专门的 {@link BigDecimal} 比较方法；
     * 否则直接使用 {@link Objects#equals(Object, Object)} 进行比较。
     *
     * @param number  {@link Number} 第一个数值（Number 类型）
     * @param number_ {@link Number} 第二个数值（Number 类型）
     * @return 如果两个数值相等，返回 {@code true}；否则返回 {@code false}
     * @author LiuQi
     */
    public static boolean equals(final Number number, final Number number_) {
        // 如果两个数值都是 BigDecimal 类型，则调用专门的 BigDecimal 比较方法
        if (number instanceof BigDecimal && number_ instanceof BigDecimal) {
            return equals(((BigDecimal) number), ((BigDecimal) number_));
        }
        // 否则使用 Objects.equals 进行比较（适用于 Integer、Long、Double 等其他 Number 子类）
        return Objects.equals(number, number_);
    }

    /**
     * equals 专门比较两个 {@link BigDecimal} 类型的数值是否相等。
     * 注意：{@link BigDecimal#equals(Object)} 方法不仅比较数值，还会比较精度（scale），
     * 因此这里改用 {@link BigDecimal#compareTo(BigDecimal)} 方法仅比较数值是否相等。
     *
     * @param bigDecimal  {@link BigDecimal}  第一个 BigDecimal 数值
     * @param bigDecimal_ {@link BigDecimal} 第二个 BigDecimal 数值
     * @return 如果两个 BigDecimal 数值相等（忽略精度差异），返回 {@code true}；否则返回 {@code false}
     * @author LiuQi
     */
    public static boolean equals(BigDecimal bigDecimal, BigDecimal bigDecimal_) {
        // 如果两个 BigDecimal 引用相同（包括均为 null 的情况），直接返回 true
        if (Objects.equals(bigDecimal, bigDecimal_)) {
            return true;
        }
        // 如果任一 BigDecimal 为 null，返回 false（因为前面已经检查过引用相等性，所以这里必然是一个为 null，另一个不为 null）
        if (bigDecimal == null || bigDecimal_ == null) {
            return false;
        }
        // 使用 compareTo 方法比较数值是否相等（忽略精度差异）
        return 0 == bigDecimal.compareTo(bigDecimal_);
    }
}
