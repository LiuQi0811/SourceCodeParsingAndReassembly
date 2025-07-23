package org.chino.SharpBladeUtils.core.lang.ref;

import java.lang.ref.ReferenceQueue;
import java.lang.ref.WeakReference;
import java.util.Objects;

/**
 * @ClassName WeakObject
 * @Description WeakObject 弱引用对象
 * <pre>
 *     在GC时发现弱引用会回收其对象，可以用来防止内存泄露。
 * </pre>
 * @Author LiuQi
 */
public class WeakObject<T> extends WeakReference<T> implements Reference_<T> {

    /**
     * hashCode 哈希码
     */
    private final int hashCode;

    /**
     * WeakObject 构造方法
     *
     * @param data           数据对象
     * @param referenceQueue {@link ReferenceQueue} 引用队列
     * @author LiuQi
     */
    public WeakObject(final T data, final ReferenceQueue<? super T> referenceQueue) {
        // 调用 {@code WeakReference} 构造方法
        super(data, referenceQueue);
        // 设置 hashCode 哈希码
        hashCode = Objects.hashCode(data);
    }

    /**
     * hashCode  获取哈希码
     *
     * @return int 哈希码
     * @description {@link Object#hashCode()} 重写该方法，返回 {@link #hashCode} 哈希码。
     * @author LiuQi
     */
    @Override
    public int hashCode() {
        // 返回 hashCode 哈希码
        return hashCode;
    }

    /**
     * equals
     *
     * @param value {@link Object} 对象
     * @return boolean 是否相等 true 相等，false 不相等
     * @description {@link Object#equals(Object)}重写该方法，判断两个对象是否相等。
     * @author LiuQi
     */
    @Override
    public boolean equals(Object value) {
        if (value == this) { // 对象本身直接返回 true
            return true;
        } else if (value instanceof WeakObject) { // 对象是 {@link WeakObject} 类型
            // 比较两个对象的引用是否相等
            // TODO 此处存在问题，因为 {@link WeakObject#get()} 可能返回 null 导致后续的比较出现问题。 需要根据不同的类型进行判断。
            return Objects.equals(((WeakObject<?>) value).get(), get());
        }
        return false;
    }
}
