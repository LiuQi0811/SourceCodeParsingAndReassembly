package org.chino.SharpBladeUtils.core.lang;

import org.chino.SharpBladeUtils.core.lang.ref.Reference_;

import java.lang.ref.ReferenceQueue;
import java.lang.ref.WeakReference;
import java.util.Objects;

/**
 * @ClassName WeakObject
 * @Description WeakObject 弱引用对象
 * <p>
 * 在GC时发现弱引用会回收其对象，可以用来防止内存泄露。
 * </p>
 * @Author LiuQi
 * @Date 2025/2/22 10:51
 * @Version 1.0
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

}
