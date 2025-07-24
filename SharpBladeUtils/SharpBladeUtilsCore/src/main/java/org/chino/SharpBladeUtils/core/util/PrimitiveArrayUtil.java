package org.chino.SharpBladeUtils.core.util;


/**
 * @ClassName PrimitiveArrayUtil
 * @Description PrimitiveArrayUtil 原始数组工具
 * @Author LiuQi
 */
public class PrimitiveArrayUtil {
    /**
     * INDEX_NOT_FOUND 数组中元素未找到的下标，值为-1
     */
    public static final int INDEX_NOT_FOUND = -1;

    /**
     * isNotEmpty 判断一个整型数组是否为非空状态。
     * <p>
     * 此方法是 {@link #isEmpty(int[])} 的逆向判断版本，用于直接检查数组是否"非空"。
     * "非空"的定义是：数组不为 null 且长度大于 0。
     *
     * @param array {@link Integer[]}要检查的整型数组
     * @return 如果数组不为 null 且包含至少一个元素（即长度 > 0），返回 true；
     * 如果数组为 null 或长度为 0，返回 false。
     * @author LiuQi
     * @see #isEmpty(int[])  依赖的 isEmpty 方法说明
     */
    public static boolean isNotEmpty(int[] array) {
        // 直接对 isEmpty(array) 的结果取反：
        // - 若 isEmpty 返回 true（数组为空），则 isNotEmpty 返回 false
        // - 若 isEmpty 返回 false（数组非空），则 isNotEmpty 返回 true
        return !isEmpty(array);
    }

    /**
     * isEmpty 判断一个整型数组是否为空。
     * 这个方法用于检查传入的整型数组是否为“空”状态。
     * “空”的定义包括两种情况：
     * 1. 数组引用为 null，即没有指向任何实际的数组对象；
     * 2. 数组的长度为 0，即虽然数组对象存在，但它不包含任何元素。
     *
     * @param array {@link Integer[]}要检查的整型数组。这是一个 int 类型的一维数组。
     * @return 如果数组为 null 或者数组的长度为 0，则返回 true，表示数组为空；
     * 否则返回 false，表示数组不为空（即数组中至少包含一个元素）。
     * @author LiuQi
     */
    public static boolean isEmpty(int[] array) {
        // 判断数组引用是否为 null
        // 如果 array 是 null，说明没有指向任何数组对象，直接返回 true 表示“空”
        // 或者
        // 判断数组的长度是否为 0
        // 如果 array 不为 null，但它的长度是 0，也返回 true 表示“空”
        return array == null || array.length == 0;
    }


}
