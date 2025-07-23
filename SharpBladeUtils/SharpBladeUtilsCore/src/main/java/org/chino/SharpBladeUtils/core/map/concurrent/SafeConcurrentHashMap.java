package org.chino.SharpBladeUtils.core.map.concurrent;

import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Function;

/**
 * @ClassName SafeConcurrentHashMap
 * @Description SafeConcurrentHashMap 线程安全的ConcurrentHashMap实现
 * <pre>
 *     用于解决在JDK8中调用{@link ConcurrentHashMap#computeIfAbsent(Object, Function)}可能造成的死循环问题。<br>
 * </pre>
 * @Author LiuQi
 */
public class SafeConcurrentHashMap<K, V> extends ConcurrentHashMap<K, V> {
    private static final long serialVersionUID = 1L;

    /**
     * SafeConcurrentHashMap 构造方法
     *
     * @author LiuQi
     */
    public SafeConcurrentHashMap() {
        // 调用{@code ConcurrentHashMap}构造方法
        super();
    }
}
