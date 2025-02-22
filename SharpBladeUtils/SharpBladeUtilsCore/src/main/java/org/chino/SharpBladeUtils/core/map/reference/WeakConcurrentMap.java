package org.chino.SharpBladeUtils.core.map.reference;

import org.chino.SharpBladeUtils.core.lang.WeakObject;
import org.chino.SharpBladeUtils.core.lang.ref.Reference_;
import org.chino.SharpBladeUtils.core.map.concurrent.SafeConcurrentHashMap;

import java.lang.ref.ReferenceQueue;
import java.util.concurrent.ConcurrentMap;

/**
 * @ClassName WeakConcurrentMap
 * @Description WeakConcurrentMap 线程安全的WeakMap实现
 * 键和值都为Weak引用，即，在GC时发现弱引用会回收其对象
 * @Author LiuQi
 * @Date 2025/2/21 11:47
 * @Version 1.0
 */
public class WeakConcurrentMap<K, V> extends ReferenceConcurrentMap<K, V> {
    private static final long serialVersionUID = 1L;

    /**
     * WeakConcurrentMap 构造方法
     *
     * @author LiuQi
     */
    public WeakConcurrentMap() {
        // 默认使用SafeConcurrentHashMap
        this(new SafeConcurrentHashMap<>());
    }

    /**
     * WeakConcurrentMap 构造方法
     *
     * @param dataMap ConcurrentMap
     * @author LiuQi
     */
    public WeakConcurrentMap(final ConcurrentMap<Reference_<K>, Reference_<V>> dataMap) {
        // 调用 {@code ReferenceConcurrentMap}构造方法
        super(dataMap);
    }

    @Override
    Reference_<K> wrapKey(K key, ReferenceQueue<? super K> referenceQueue) {
        // 创建WeakObject对象，并将其 作为Reference_返回
        return new WeakObject<>(key, referenceQueue);
    }

    @Override
    Reference_<V> wrapValue(V value, ReferenceQueue<? super V> referenceQueue) {
        // 创建WeakObject对象，并将其作为Reference_返回
        return new WeakObject<>(value, referenceQueue);
    }

}
