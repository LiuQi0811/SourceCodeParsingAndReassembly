package org.chino.SharpBladeUtils.core.math;

import org.chino.SharpBladeUtils.core.comparator.CompareUtil;

import java.math.BigDecimal;
import java.util.Objects;

/**
 * @ClassName NumberUtil
 * @Description NumberUtil Number数字处理工具
 * @Author LiuQi
 * @Date 2025/2/24 9:13
 * @Version 1.0
 */
public class NumberUtil {

    /**
     * equals Number数字比较
     *
     * @param value  {@link Number} 数字一
     * @param value_ {@link Number} 数字二
     * @return 数字相等返回true，否则false
     * @author LiuQi
     * @see Objects#equals(Object, Object)
     * @see CompareUtil#equals(Comparable, Comparable)
     */
    public static boolean equals(final Number value, final Number value_) {
        // 如果都是BigDecimal，则直接比较精度丢失问题
        if (value instanceof BigDecimal && value_ instanceof BigDecimal)
            // 返回 BigDecimal的equals，避免精度丢失问题
            // BigDecimal使用compareTo方式比较，因为使用equals方法也判断小数位数，如2.0和2.00就不相等
            return CompareUtil.equals(((BigDecimal) value), ((BigDecimal) value_));
        // 返回 Objects.equals，避免精度丢失问题
        return Objects.equals(value, value_);
    }
}
