package org.chino.tool.core.tool;

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
    public static <T> Boolean isEmpty(T[] array) {
        // 数组参数为空 或者 数组参数长度等于0 则返回true 否则返回false
        return array == null || array.length == 0;
    }
}
