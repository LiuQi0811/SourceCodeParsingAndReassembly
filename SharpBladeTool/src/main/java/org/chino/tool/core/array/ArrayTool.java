package org.chino.tool.core.array;

import java.util.Arrays;
import java.util.Objects;

/**
 * @ClassName ArrayTool
 * @Description ArrayTool 数组处理工具
 * @Author LiuQi
 * @Date 2025/1/8 10:48
 * @Version 1.0
 */
public class ArrayTool {

    /**
     * ArrayTool 构造方法
     *
     * @author LiuQi
     */
    public ArrayTool() {
    }

    /**
     * isEmpty 数组是否为空
     *
     * @param array {@link T[]} 数组
     * @param <T>   泛型
     * @return {@link Boolean} 是否为空数组
     * @author LiuQi
     */
    public static <T> boolean isEmpty(T[] array) {
        // 数组参数为空 或者 数组参数长度等于0 则返回true 否则返回false
        return array == null || array.length == 0;
    }

    /**
     * isArray 是否为数组
     *
     * @param param {@link Object}参数
     * @return {@link Boolean} 是否为数组
     * @author LiuQi
     */
    public static boolean isArray(Object param) {
        // 参数不为空 且 参数为数组类型 则返回true 否则返回false
        return null != param && param.getClass().isArray();
    }

    /**
     * toString 数组转字符串
     *
     * @param param {@link Object} 参数
     * @return {@link String} 处理后的字符串
     * @author LiuQi
     */
    public static String toString(Object param) {
        if (Objects.isNull(param)) { // 参数为空 直接返回null
            return null;
        } else if (param instanceof int[]) { // int[]数组
            // 将int[]数组转换为字符串并返回
            return Arrays.toString((int[]) param);
        } else if (param instanceof long[]) { // long[]数组
            // 将long[]数组转换为字符串并返回
            return Arrays.toString((long[]) param);
        } else if (param instanceof short[]) { // short[]数组
            // 将short[]数组转换为字符串并返回
            return Arrays.toString((short[]) param);
        } else if (param instanceof char[]) { // char[]数组
            // 将char[]数组转换为字符串并返回
            return Arrays.toString((char[]) param);
        } else if (param instanceof byte[]) { // byte[]数组
            // 将byte[]数组转换为字符串并返回
            return Arrays.toString((byte[]) param);
        } else if (param instanceof boolean[]) { // boolean[]数组
            // 将boolean[]数组转换为字符串并返回
            return Arrays.toString((boolean[]) param);
        } else if (param instanceof float[]) { // float[]数组
            // 将float[]数组转换为字符串并返回
            return Arrays.toString((float[]) param);
        } else if (param instanceof double[]) { // double[]数组
            // 将double[]数组转换为字符串并返回
            return Arrays.toString((double[]) param);
        } else {
            if (isArray(param)) { // 参数是数组
                try {
                    // 将Object[]数组转换为字符串并返回
                    return Arrays.deepToString((Object[]) param);
                } catch (Exception e) {
                    e.printStackTrace();
                }
            }
            // 直接返回toString方法
            return param.toString();
        }
    }
}
