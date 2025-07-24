package org.chino.SharpBladeUtils.core.map;


import java.util.HashMap;
import java.util.LinkedHashMap;

/**
 * @ClassName MapUtil
 * @Description MapUtil Map相关工具
 * @Author LiuQi
 */
public class MapUtil {
    /**
     * DEFAULT_LOAD_FACTOR 默认增长因子，当Map的size达到 容量*增长因子时，开始扩充Map
     */
    public static final float DEFAULT_LOAD_FACTOR = 0.75f;

    /**
     * newHashMap 创建一个新的HashMap，支持指定初始容量和是否保持插入顺序。
     * 如果isLinked=true，则创建LinkedHashMap（保持插入顺序）；
     * 如果isLinked=false，则创建普通HashMap（不保证顺序）。
     *
     * @param <K>      键的类型（泛型）
     * @param <V>      值的类型（泛型）
     * @param size     {@link Integer} 预期的初始容量（实际容量会根据负载因子调整）
     * @param isLinked {@link Boolean} 是否保持插入顺序（true=LinkedHashMap，false=HashMap）
     * @return 新创建的Map（HashMap或LinkedHashMap）
     * @author LiuQi
     */
    public static <K, V> HashMap<K, V> newHashMap(int size, boolean isLinked) {
        // 计算初始容量：
        // - size / DEFAULT_LOAD_FACTOR + 1 确保容量足够，避免频繁扩容
        // - DEFAULT_LOAD_FACTOR默认值为0.75（HashMap的负载因子）
        final int initialCapacity = (int) (size / DEFAULT_LOAD_FACTOR) + 1;
        // 根据isLinked参数选择Map实现：
        // - true: 返回LinkedHashMap（保持插入顺序）
        // - false: 返回HashMap（不保证顺序）
        return isLinked ? new LinkedHashMap<>(initialCapacity) : new HashMap<>(initialCapacity);
    }
}
