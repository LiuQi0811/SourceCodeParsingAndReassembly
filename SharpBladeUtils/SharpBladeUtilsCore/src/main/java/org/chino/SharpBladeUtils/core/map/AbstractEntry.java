package org.chino.SharpBladeUtils.core.map;

import java.util.Map;

/**
 * @ClassName AbstractEntry
 * @Description AbstractEntry {@link java.util.Map.Entry}抽象
 * @Author LiuQi
 * @Date 2025/2/21 14:37
 * @Version 1.0
 */
public abstract class AbstractEntry<K, V> implements Map.Entry<K, V> {
    /**
     * toString方法，返回 key = value格式的字符串
     *
     * @return {@link String} key = value格式的字符串
     * @author LiuQi
     */
    @Override
    public String toString() {
        // 返回 key = value格式的字符串
        return getKey() +
                " = " +
                getValue();
    }
}
