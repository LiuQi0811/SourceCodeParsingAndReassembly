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
     * isNotEmpty 判断一个 long 类型的数组是否非空。
     * 如果数组不为 null 且长度大于 0，则返回 true，表示数组非空；
     * 否则返回 false，表示数组为空。
     *
     * @param array {@link Long[]}要检查的 long 类型数组
     * @return 如果数组非空则返回 true，否则返回 false
     * @author LiuQi
     */
    public static boolean isNotEmpty(long[] array) {
        // 调用 isEmpty 方法并取反，判断数组是否非空
        return !isEmpty(array);
    }

    /**
     * isNotEmpty 判断一个 short 类型的数组是否非空。
     * 如果数组不为 null 且长度大于 0，则返回 true，表示数组非空；
     * 否则返回 false，表示数组为空。
     *
     * @param array {@link Short[]}要检查的 short 类型数组
     * @return 如果数组非空则返回 true，否则返回 false
     * @author LiuQi
     */
    public static boolean isNotEmpty(short[] array) {
        // 调用 isEmpty 方法并取反，判断数组是否非空
        return !isEmpty(array);
    }

    /**
     * isNotEmpty 判断一个 char 类型的数组是否非空。
     * 如果数组不为 null 且长度大于 0，则返回 true，表示数组非空；
     * 否则返回 false，表示数组为空。
     *
     * @param array {@link Character[]}要检查的 char 类型数组
     * @return 如果数组非空则返回 true，否则返回 false
     * @author LiuQi
     */
    public static boolean isNotEmpty(char[] array) {
        // 调用 isEmpty 方法并取反，判断数组是否非空
        return !isEmpty(array);
    }

    /**
     * isNotEmpty 判断一个 byte 类型的数组是否非空。
     * 如果数组不为 null 且长度大于 0，则返回 true，表示数组非空；
     * 否则返回 false，表示数组为空。
     *
     * @param array {@link Byte[]}要检查的 byte 类型数组
     * @return 如果数组非空则返回 true，否则返回 false
     * @author LiuQi
     */
    public static boolean isNotEmpty(byte[] array) {
        // 调用 isEmpty 方法并取反，判断数组是否非空
        return !isEmpty(array);
    }

    /**
     * isNotEmpty 判断一个 double 类型的数组是否非空。
     * 如果数组不为 null 且长度大于 0，则返回 true，表示数组非空；
     * 否则返回 false，表示数组为空。
     *
     * @param array {@link Double[]}要检查的 double 类型数组
     * @return 如果数组非空则返回 true，否则返回 false
     * @author LiuQi
     */
    public static boolean isNotEmpty(double[] array) {
        // 调用 isEmpty 方法并取反，判断数组是否非空
        return !isEmpty(array);
    }

    /**
     * isNotEmpty 判断一个 float 类型的数组是否非空。
     * 如果数组不为 null 且长度大于 0，则返回 true，表示数组非空；
     * 否则返回 false，表示数组为空。
     *
     * @param array {@link Float[]}要检查的 float 类型数组
     * @return 如果数组非空则返回 true，否则返回 false
     * @author LiuQi
     */
    public static boolean isNotEmpty(float[] array) {
        // 调用 isEmpty 方法并取反，判断数组是否非空
        return !isEmpty(array);
    }

    /**
     * isNotEmpty 判断一个 boolean 类型的数组是否非空。
     * 如果数组不为 null 且长度大于 0，则返回 true，表示数组非空；
     * 否则返回 false，表示数组为空。
     *
     * @param array {@link Boolean[]}要检查的 boolean 类型数组
     * @return 如果数组非空则返回 true，否则返回 false
     * @author LiuQi
     */
    public static boolean isNotEmpty(boolean[] array) {
        // 调用 isEmpty 方法并取反，判断数组是否非空
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
     * isEmpty 检查给定的long类型数组是否为空（null或长度为0）
     *
     * @param array {@link Long[]}要检查的long类型数组
     * @return 如果数组为null或长度为0，则返回true；否则返回false
     * @author LiuQi
     */
    public static boolean isEmpty(long[] array) {
        // 判断数组是否为null或者长度是否为0
        return array == null || array.length == 0;
    }

    /**
     * isEmpty 检查给定的 double 类型数组是否为空（null 或长度为 0）。
     *
     * @param array {@link Double[]} 要检查的 double 类型数组
     * @return 如果数组为 null 或长度为 0，则返回 true；否则返回 false
     * @author LiuQi
     */
    public static boolean isEmpty(double[] array) {
        // 判断数组是否为null或者长度是否为0
        return array == null || array.length == 0;
    }

    /**
     * isEmpty 检查给定的 float 类型数组是否为空（null 或长度为 0）。
     *
     * @param array {@link Float[]} 要检查的 float 类型数组
     * @return 如果数组为 null 或长度为 0，则返回 true；否则返回 false
     * @author LiuQi
     */
    public static boolean isEmpty(float[] array) {
        // 判断数组是否为null或者长度是否为0
        return array == null || array.length == 0;
    }

    /**
     * isEmpty 检查给定的 boolean 类型数组是否为空（null 或长度为 0）。
     *
     * @param array {@link Boolean[]} 要检查的 boolean 类型数组
     * @return 如果数组为 null 或长度为 0，则返回 true；否则返回 false
     * @author LiuQi
     */
    public static boolean isEmpty(boolean[] array) {
        // 判断数组是否为null或者长度是否为0
        return array == null || array.length == 0;
    }

    /**
     * isEmpty 检查给定的 short 类型数组是否为空（null 或长度为 0）。
     *
     * @param array {@link Short[]} 要检查的 short 类型数组
     * @return 如果数组为 null 或长度为 0，则返回 true；否则返回 false
     * @author LiuQi
     */
    public static boolean isEmpty(short[] array) {
        // 判断数组是否为null或者长度是否为0
        return array == null || array.length == 0;
    }

    /**
     * isEmpty 检查给定的 char 类型数组是否为空（null 或长度为 0）。
     *
     * @param array {@link Character[]} 要检查的 char 类型数组
     * @return 如果数组为 null 或长度为 0，则返回 true；否则返回 false
     * @author LiuQi
     */
    public static boolean isEmpty(char[] array) {
        // 判断数组是否为null或者长度是否为0
        return array == null || array.length == 0;
    }

    /**
     * isEmpty 检查给定的 byte 类型数组是否为空（null 或长度为 0）。
     *
     * @param array {@link Byte[]} 要检查的 byte 类型数组
     * @return 如果数组为 null 或长度为 0，则返回 true；否则返回 false
     * @author LiuQi
     */
    public static boolean isEmpty(byte[] array) {
        // 判断数组是否为null或者长度是否为0
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

    /**
     * max 计算一个可变参数 int 类型数组中的最大值。
     * 如果传入的数组为空（即 null 或长度为 0），则抛出 IllegalArgumentException 异常。
     *
     * @param numberArray {@link Integer[]} 可变参数 int 类型数组
     * @return 数组中的最大值
     * @throws IllegalArgumentException 如果数组为空（null 或长度为 0）
     * @author LiuQi
     */
    public static int max(int... numberArray) {
        // 检查数组是否为空
        if (isEmpty(numberArray)) {
            // 如果数组为空，抛出 IllegalArgumentException 异常，提示数组不能为空
            throw new IllegalArgumentException("Number array must not empty ! ");
        }
        // 假设数组的第一个元素为当前最大值
        int maxNumber = numberArray[0];
        // 从数组的第二个元素开始遍历
        for (int i = 1; i < numberArray.length; i++) {
            // 如果当前元素大于当前最大值，则更新最大值
            if (maxNumber < numberArray[i]) {
                maxNumber = numberArray[i];
            }
        }
        // 返回找到的最大值
        return maxNumber;
    }

    /**
     * max 计算一个可变参数 long 类型数组中的最大值。
     * 如果传入的数组为空（即 null 或长度为 0），则抛出 IllegalArgumentException 异常。
     *
     * @param numberArray {@link Long[]} 可变参数 long 类型数组
     * @return 数组中的最大值
     * @throws IllegalArgumentException 如果数组为空（null 或长度为 0）
     * @author LiuQi
     */
    public static long max(long... numberArray) {
        // 检查数组是否为空
        if (isEmpty(numberArray)) {
            // 如果数组为空，抛出 IllegalArgumentException 异常，提示数组不能为空
            throw new IllegalArgumentException("Number array must not empty ! ");
        }
        // 假设数组的第一个元素为当前最大值
        long maxNumber = numberArray[0];
        // 从数组的第二个元素开始遍历
        for (int i = 1; i < numberArray.length; i++) {
            // 如果当前元素大于当前最大值，则更新最大值
            if (maxNumber < numberArray[i]) {
                maxNumber = numberArray[i];
            }
        }
        // 返回找到的最大值
        return maxNumber;
    }

    /**
     * max 计算一个可变参数 double 类型数组中的最大值。
     * 如果传入的数组为空（即 null 或长度为 0），则抛出 IllegalArgumentException 异常。
     *
     * @param numberArray {@link Double[]} 可变参数 double 类型数组
     * @return 数组中的最大值
     * @throws IllegalArgumentException 如果数组为空（null 或长度为 0）
     * @author LiuQi
     */
    public static double max(double... numberArray) {
        // 检查数组是否为空
        if (isEmpty(numberArray)) {
            // 如果数组为空，抛出 IllegalArgumentException 异常，提示数组不能为空
            throw new IllegalArgumentException("Number array must not empty ! ");
        }
        // 假设数组的第一个元素为当前最大值
        double maxNumber = numberArray[0];
        // 从数组的第二个元素开始遍历
        for (int i = 1; i < numberArray.length; i++) {
            // 如果当前元素大于当前最大值，则更新最大值
            if (maxNumber < numberArray[i]) {
                maxNumber = numberArray[i];
            }
        }
        // 返回找到的最大值
        return maxNumber;
    }


}
