package org.chino.tool.core.map.concurrent;

import java.util.concurrent.ConcurrentHashMap;

/**
 * @ClassName SafeConcurrentHashMap
 * @Description SafeConcurrentHashMap 安全并发HashMap处理 继承 ConcurrentHashMap
 * @Author LiuQi
 * @Date 2025/1/17 15:38
 * @Version 1.0
 */
public class SafeConcurrentHashMap<K, V> extends ConcurrentHashMap<K, V> {

    /**
     * serialVersionUID 序列化版本号
     */
    private static final long serialVersionUID = 1L;

    /**
     * SafeConcurrentHashMap 构造方法
     *
     * @author LiuQi
     */
    public SafeConcurrentHashMap() {
    }

    /**
     * SafeConcurrentHashMap 构造方法
     *
     * @param initialCapacity 初始容量
     * @author LiuQi
     */
    public SafeConcurrentHashMap(int initialCapacity) {
        // 调用父类构造方法
        super(initialCapacity);
    }
}
