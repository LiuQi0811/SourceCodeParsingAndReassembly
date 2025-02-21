package org.chino.SharpBladeUtils.core.lang.mutable;

import org.chino.SharpBladeUtils.core.map.AbstractEntry;

import java.io.Serializable;
import java.util.Map;

/**
 * @ClassName MutableEntry
 * @Description MutableEntry 可变键和值的{@link Map.Entry}实现
 * @Author LiuQi
 * @Date 2025/2/21 14:22
 * @Version 1.0
 */
public class MutableEntry<K, V> extends AbstractEntry<K, V> implements Mutable<Map.Entry<K, V>>, Serializable {
    private static final long serialVersionUID = 1L;
    /**
     * key 键
     */
    protected K key;
    /**
     * value 值
     */
    protected V value;

    /**
     * MutableEntry 构造方法
     *
     * @param key   键
     * @param value 值
     * @author LiuQi
     */
    public MutableEntry(final K key, final V value) {
        // 设置键和值
        this.key = key;
        this.value = value;
    }

    /**
     * of 用于创建 MutableEntry 对象
     *
     * @param key   键
     * @param value 值
     * @param <K>   键的类型
     * @param <V>   值的类型
     * @return {@code MutableEntry} MutableEntry<K, V> 对象
     * @author LiuQi
     */
    public static <K, V> MutableEntry<K, V> of(final K key, final V value) {
        // 返回 MutableEntry 对象
        return new MutableEntry<>(key, value);
    }

    @Override
    public Map.Entry<K, V> get() {
        // 返回 MutableEntry 对象
        return this;
    }

    @Override
    public void set(final Map.Entry<K, V> value) {
        // 设置键和值
        this.key = value.getKey();
        this.value = value.getValue();
    }

    /**
     * getKey 获取键
     *
     * @return {@code K} 键
     * @author LiuQi
     * @see Map.Entry#getKey() {@inheritDoc}
     */
    @Override
    public K getKey() {
        // 返回键
        return key;
    }

    /**
     * setKey 设置键
     *
     * @param key 键
     * @return {@code K} 键
     * @author LiuQi
     */
    public K setKey(final K key) {
        // 设置键并返回旧的键
        return this.key = key;
    }

    /**
     * getValue 获取值
     *
     * @return {@code V} 值
     * @author LiuQi
     * @see Map.Entry#getValue() {@inheritDoc}
     */
    @Override
    public V getValue() {
        // 返回值
        return value;
    }

    /**
     * setValue 设置值
     *
     * @param value 值
     * @return {@code V} 值
     * @author LiuQi
     * @see Map.Entry#setValue(Object) {@inheritDoc}
     */
    @Override
    public V setValue(final V value) {
        // 设置值并返回旧的值
        return this.value = value;
    }
}
