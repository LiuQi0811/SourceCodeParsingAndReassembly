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

    /**
     * range 生成一个从0开始到指定结束值（不包含）的整数数组，步长为1。
     *
     * @param excludedEnd {@link Integer} 结束值（不包含在结果中）
     * @return 生成的整数数组，如 excludedEnd=5 则返回 [0, 1, 2, 3, 4]
     * @author LiuQi
     */
    public static int[] range(int excludedEnd) {
        // 调用三参数版本`range`方法，起始值为0，步长为1
        return range(0, excludedEnd, 1);
    }

    /**
     * range 生成一个从指定起始值（包含）到结束值（不包含）的整数数组，步长为1。
     *
     * @param includedStart {@link Integer} 起始值（包含在结果中）
     * @param excludedEnd   {@link Integer}   结束值（不包含在结果中）
     * @return 生成的整数数组，如 includedStart=2, excludedEnd=5 则返回 [2, 3, 4]
     * @author LiuQi
     */
    public static int[] range(int includedStart, int excludedEnd) {
        // 调用三参数版本`range`方法，步长为1
        return range(includedStart, excludedEnd, 1);
    }

    /**
     * range 生成一个从指定起始值（包含）到结束值（不包含）的整数数组，支持自定义步长。
     *
     * @param includedStart {@link Integer} 起始值（包含在结果中）
     * @param excludedEnd   {@link Integer}  结束值（不包含在结果中）
     * @param step          {@link Integer}       步长（必须为正数，若<=0则默认为1）
     * @return 生成的整数数组
     * @author LiuQi
     */
    public static int[] range(int includedStart, int excludedEnd, int step) {
        // 处理起始值大于结束值的情况：自动交换两者
        if (includedStart > excludedEnd) {
            int temp = includedStart;
            includedStart = excludedEnd;
            excludedEnd = temp;
        }
        // 处理步长<=0的情况：强制设置为1
        if (step <= 0) {
            step = 1;
        }
        // 计算数组长度：
        // 1. 先计算理论长度：(excludedEnd - includedStart) / step
        // 2. 如果有余数，则长度+1（确保覆盖所有值）
        int deviation = excludedEnd - includedStart;
        int length = deviation / step;
        if (deviation % step != 0) {
            length += 1;
        }
        // 创建结果数组
        int[] range = new int[length];
        // 填充数组：
        // 1. 每次循环将当前起始值存入数组
        // 2. 起始值按步长递增
        for (int i = 0; i < length; i++) {
            range[i] = includedStart;
            includedStart += step;
        }
        // 返回结果数组
        return range;
    }


}
