package org.chino.SharpBladeUtils.core.array;

/**
 * @ClassName ArrayUtil
 * @Description ArrayUtil 数组处理工具
 * @Author LiuQi
 * @Date 2025/2/21 10:30
 * @Version 1.0
 */
public class ArrayUtil {

    /**
     * isEmpty 数组是否为空
     *
     * @param array {@link T[]} 数组
     * @param <T>   泛型类型
     * @return 返回 数组为空 或者 数组长度为0 的布尔值  true：数组为空 或者 数组长度为0  false：反之
     * @author LiuQi
     */
    public static <T> boolean isEmpty(final T[] array) {
        // 返回 数组为空 或者 数组长度为0 的布尔值
        return array == null || array.length == 0;
    }

    /**
     * isArray 是否为数组
     *
     * @param data {@link Object} 对象
     * @return 返回  true：data不为空 且 data是数组的布尔值  false：data为空 或者 data不是数组的布尔值
     * @author LiuQi
     */
    public static boolean isArray(final Object data) {
        // 返回  data不为空 且 data是数组的布尔值
        return null != data && data.getClass().isArray();
    }
}
