package org.chino.SharpBladeUtils.core.map.reference;

import org.chino.SharpBladeUtils.core.lang.ref.ReferenceUtil;
import org.chino.SharpBladeUtils.core.lang.ref.Reference_;

import java.io.Serializable;
import java.lang.ref.ReferenceQueue;
import java.util.Collection;
import java.util.Iterator;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentMap;
import java.util.function.BiConsumer;
import java.util.function.BiFunction;
import java.util.function.Function;

/**
 * @ClassName ReferenceConcurrentMap
 * @Description ReferenceConcurrentMap 线程安全的ReferenceMap实现
 * @Author LiuQi
 * @Date 2025/2/21 11:27
 * @Version 1.0
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
            // TODO 清除被GC回收的键和值引用 - 待处理逻辑。
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
        // TODO Auto-generated method stub
        return 0;
    }

    @Override
    public boolean isEmpty() {
        //TODO Auto-generated method stub
        return false;
    }

    @Override
    public V get(Object key) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public boolean containsKey(Object key) {
        // TODO Auto-generated method stub
        return false;
    }

    @Override
    public boolean containsValue(Object value) {
        // TODO Auto-generated method stub
        return false;
    }

    @Override
    public V put(K key, V value) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public V putIfAbsent(K key, V value) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public void putAll(Map<? extends K, ? extends V> m) {
        // TODO Auto-generated method stub
    }

    @Override
    public boolean replace(K key, V oldValue, V newValue) {
        // TODO Auto-generated method stub
        return false;
    }

    @Override
    public V replace(K key, V value) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public void replaceAll(BiFunction<? super K, ? super V, ? extends V> function) {
        // TODO Auto-generated method stub
    }

    @Override
    public V computeIfPresent(K key, BiFunction<? super K, ? super V, ? extends V> remappingFunction) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public V remove(Object key) {
        // TODO Auto-generated method stub
        return null;
    }

    @Override
    public boolean remove(Object key, Object value) {
        // TODO Auto-generated method stub
        return false;
    }

    @Override
    public void clear() {
        // TODO Auto-generated method stub
    }

    @Override
    public Set<K> keySet() {
        // TODO Auto-generated method stub
        return null;
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
}
