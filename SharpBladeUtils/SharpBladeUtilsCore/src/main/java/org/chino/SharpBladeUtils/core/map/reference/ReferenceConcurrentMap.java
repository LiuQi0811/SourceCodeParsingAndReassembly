package org.chino.SharpBladeUtils.core.map.reference;

import org.chino.SharpBladeUtils.core.lang.ref.ReferenceUtil;
import org.chino.SharpBladeUtils.core.lang.ref.Reference_;

import java.io.Serializable;
import java.lang.ref.ReferenceQueue;
import java.util.*;
import java.util.concurrent.ConcurrentMap;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Function;

/**
 * @ClassName ReferenceConcurrentMap
 * @Description ReferenceConcurrentMap 线程安全的ReferenceMap实现
 * @Author LiuQi
 */
public abstract class ReferenceConcurrentMap<K, V> implements ConcurrentMap<K, V>, Iterable<Map.Entry<K, V>>, Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * dataMap 存储键值对的ConcurrentMap对象。
     */
    final ConcurrentMap<Reference_<K>, Reference_<V>> dataMap;
    /**
     * referenceQueueKey 是一个ReferenceQueue对象，用于存储被垃圾回收的键引用。
     */
    private final ReferenceQueue<K> referenceQueueKey;
    /**
     * referenceQueueValue 是一个ReferenceQueue对象，用于存储被垃圾回收的值引用。
     */
    private final ReferenceQueue<V> referenceQueueValue;

    /**
     * wrapKey 用于将键包装为Reference_对象。
     *
     * @param key            {@link K} 键
     * @param referenceQueue {@link ReferenceQueue}参考队列，用于处理引用对象被垃圾回收的情况。
     * @return {@link Reference_} 对象，封装了原始键并可能包含引用队列。
     * @author LiuQi
     */
    abstract Reference_<K> wrapKey(final K key, final ReferenceQueue<? super K> referenceQueue);

    /**
     * wrapValue 用于将值包装为Reference_对象。
     *
     * @param value          {@link V}         值
     * @param referenceQueue {@link ReferenceQueue}参考队列，用于处理引用对象被垃圾回收的情况。
     * @return {@link Reference_} 对象，封装了原始值并可能包含引用队列。
     * @author LiuQi
     */
    abstract Reference_<V> wrapValue(final V value, final ReferenceQueue<? super V> referenceQueue);

    /**
     * ReferenceConcurrentMap 构造方法
     *
     * @param dataMap ConcurrentMap对象，用于存储键值对。
     * @author LiuQi
     */
    public ReferenceConcurrentMap(final ConcurrentMap<Reference_<K>, Reference_<V>> dataMap) {
        // 创建ReferenceConcurrentMap对象，实例化dataMap、referenceQueueKey和referenceQueueValue。
        this.dataMap = dataMap;
        this.referenceQueueKey = new ReferenceQueue<>();
        this.referenceQueueValue = new ReferenceQueue<>();
    }

    /**
     * computeIfAbsent   该方法在ConcurrentMap接口中定义，用于计算给定键的映射值。
     *
     * @param key             键
     * @param mappingFunction 映射函数，用于计算值
     * @return 计算得到的值，如果键已存在则返回现有映射的值
     * @author LiuQi
     * @see ConcurrentMap#computeIfAbsent(Object, Function)
     */
    @Override
    public V computeIfAbsent(K key, Function<? super K, ? extends V> mappingFunction) {
        // result 用于存储计算得到的值。
        V result = null;
        while (null == result) { // 循环直到找到或计算值为止。
            // 清除被GC回收的键和值引用
            purgeGCGarbage();
            // 获取键的引用对象，如果不存在则计算并添加到dataMap中。
            Reference_<V> vReference = dataMap.computeIfAbsent(wrapKey(key), kReference -> wrapValue(mappingFunction.apply(unwrap(kReference))));
            // 如果vReference在此时被GC回收，则unwrap后为null，需要循环计算
            // 此处需要判断vReference是否为NullReference_.NULL，如果是则跳出循环。
            if (NullReference_.NULL == vReference) return null;
            // 去除Reference_对象中的引用，并返回实际引用的对象。
            result = unwrap(vReference);
        }
        // 返回计算得到的值。
        return result;
    }

    /**
     * wrapKey 用于将键包装为Reference_对象。
     *
     * @param key {@link Object}  键
     * @return {@link Reference_} 对象，封装了原始键并可能包含引用队列。
     * @description 根据Reference类型构建key对应的{@link Reference}对象。
     * @author LiuQi
     */
    @SuppressWarnings(value = "unchecked")
    private Reference_<K> wrapKey(final Object key) {
        // 返回wrapKey 对应的Reference对象。
        return wrapKey(((K) key), referenceQueueKey);
    }

    /**
     * wrapValue 用于将值包装为Reference_对象。
     *
     * @param value {@link Object} 值
     * @return {@link Reference_} 对象，封装了原始值并可能包含引用队列。
     * @description 根据Reference类型构建value对应的{@link Reference}对象。
     * @author LiuQi
     */
    @SuppressWarnings(value = "unchecked")
    private Reference_<V> wrapValue(final Object value) {
        // 如果value为null，则返回NullReference_.NULL对象。
        if (null == value) return (Reference_<V>) NullReference_.NULL;
        // 返回wrapValue对应的Reference对象。
        return wrapValue(((V) value), referenceQueueValue);
    }

    /**
     * unwrap 用于获取Reference_对象实际引用的对象。
     *
     * @param reference_ {@link Reference_} 引用对象
     * @param <T>        {@link T}    泛型参数，表示引用对象的类型。
     * @return {@link T} 实际引用的对象
     * @description 去除Reference_对象中的引用，并返回实际引用的对象。
     * @author LiuQi
     */
    private static <T> T unwrap(final Reference_<T> reference_) {
        // 返回 ReferenceUtil 引用处理工具的get方法，获取引用对象的实际对象。
        return ReferenceUtil.get(reference_);
    }

    /**
     * NullReference_ 是一个实现了Reference_接口的私有内部类，用于表示一个空的引用对象。
     *
     * @author LiuQi
     */
    @SuppressWarnings(value = "rawtypes")
    private static class NullReference_ implements Reference_ {
        /**
         * NULL 是一个静态的final字段，表示一个空的引用对象。
         */
        public static final Object NULL = new NullReference_();

        @Override
        public Object get() {
            return null;
        }
    }

    @Override
    public int size() {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 返回dataMap的大小，即当前存储的键值对数量。
        return dataMap.size();
    }

    @Override
    public boolean isEmpty() {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 返回dataMap是否为空，即当前没有存储的键值对。
        return dataMap.isEmpty();
    }

    @Override
    public V get(final Object key) {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 返回dataMap中键对应的值，如果存在则去除Reference_对象中的引用并返回实际引用的对象。
        return unwrap(dataMap.get(wrapKey(key)));
    }

    @Override
    public boolean containsKey(final Object key) {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 返回dataMap是否包含给定的键，即当前是否有该键的映射。
        return dataMap.containsKey(wrapKey(key));
    }

    @Override
    public boolean containsValue(final Object value) {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 返回dataMap是否包含给定的值，即当前是否有该值的映射。
        return dataMap.containsValue(wrapValue(value));
    }

    @Override
    public V put(final K key, final V value) {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 将键值对放入dataMap中，并返回之前的映射的值（如果有的话）。
        final Reference_<V> vReference = dataMap.put(wrapKey(key), wrapValue(value));
        // 如果vReference在此时被GC回收，则unwrap后为null，需要循环计算
        return unwrap(vReference);
    }

    @Override
    public V putIfAbsent(final K key, final V value) {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 将键值对放入dataMap中，如果之前没有该键的映射则返回null。
        final Reference_<V> vReference = dataMap.putIfAbsent(wrapKey(key), wrapValue(value));
        // 如果vReference在此时被GC回收，则unwrap后为null，需要循环计算
        return unwrap(vReference);
    }

    @Override
    public void putAll(final Map<? extends K, ? extends V> dataMap) {
        // dataMap中的所有键值对到当前map中。
        dataMap.forEach(this::put);
    }

    @Override
    public V replace(final K key, final V value) {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 替换dataMap中键对应的值，如果之前有该键的映射则返回之前的值。
        Reference_<V> vReference = dataMap.replace(wrapKey(key), wrapValue(value));
        // 如果vReference在此时被GC回收，则unwrap后为null，需要循环计算
        return unwrap(vReference);
    }

    @Override
    public boolean replace(final K key, final V oldValue, final V newValue) {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 替换dataMap中键对应的值，如果之前有该键的映射且旧值为oldValue则返回true。
        return dataMap.replace(wrapKey(key), wrapValue(oldValue), wrapValue(newValue));
    }

    @Override
    public void replaceAll(final BiFunction<? super K, ? super V, ? extends V> function) {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 对dataMap中的每个键值对应用function函数，并替换为新的值。
        dataMap.replaceAll((kReference, vReference) -> wrapValue(function.apply(unwrap(kReference), unwrap(vReference))));
    }

    @Override
    public V computeIfPresent(K key, BiFunction<? super K, ? super V, ? extends V> remappingFunction) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public V remove(final Object key) {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 移除dataMap中键对应的键值对，并返回之前的映射的值（如果有的话）。
        return unwrap(dataMap.remove(wrapKey(key)));
    }

    @SuppressWarnings(value = "unchecked")
    @Override
    public boolean remove(final Object key, final Object value) {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 移除dataMap中键对应的值，如果之前有该键的映射且值为value则返回true。
        return dataMap.remove(wrapKey((K) key, null), value);
    }

    @SuppressWarnings(value = "StatementWithEmptyBody")
    @Override
    public void clear() {
        // 清除dataMap中的所有键值对，并清空引用队列
        dataMap.clear();
        // referenceQueueKey.poll()和referenceQueueValue.poll()用于清除被GC回收的键值对引用
        while (referenceQueueKey.poll() != null) ;
        while (referenceQueueValue.poll() != null) ;
    }

    @Override
    public Set<K> keySet() {
        // 清除被GC回收的键和值引用
        purgeGCGarbage();
        // 返回dataMap的键集合，即当前存储的所有键。
        Set<Reference_<K>> referenceSet = dataMap.keySet();
        // 返回一个抽象集合，其中包含dataMap的键引用。
        return new AbstractSet<K>() {
            @Override
            public Iterator<K> iterator() {
                return null;
            }

            @Override
            public int size() {
                return 0;
            }
        };
    }

    @Override
    public Collection<V> values() {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public Set<Entry<K, V>> entrySet() {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public void forEach(BiConsumer<? super K, ? super V> action) {
        // TODO Auto-generated method stub
    }

    @Override
    public Iterator<Entry<K, V>> iterator() {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public V compute(K key, BiFunction<? super K, ? super V, ? extends V> remappingFunction) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public V merge(K key, V value, BiFunction<? super V, ? super V, ? extends V> remappingFunction) {
        // TODO Auto-generated method stub
        return null;
    }

    /**
     * purgeGCGarbage 清除被回收的键值对垃圾
     *
     * @description <pre> Purge GC Garbage 清理垃圾，清除被GC回收的键值对 </pre>
     * @author LiuQi
     */
    @SuppressWarnings(value = "unchecked")
    private void purgeGCGarbage() {
        /**
         * referenceKey 引用键
         */
        Reference_<? extends K> referenceKey;
        /**
         * referenceValue 引用值
         */
        Reference_<? extends V> referenceValue;
        while ((referenceKey = (Reference_<? extends K>) referenceQueueKey.poll()) != null) { // 清除无效key对应键值对
            System.out.println("清除被回收的键值对垃圾" + referenceQueueKey.poll() + " - " + referenceKey);
        }
        while ((referenceValue = (Reference_<? extends V>) referenceQueueValue.poll()) != null) { // 清除无效value对应键值对
            System.out.println("清除被回收的键值对垃圾" + referenceQueueValue.poll() + " - " + referenceValue);
        }
    }
}
