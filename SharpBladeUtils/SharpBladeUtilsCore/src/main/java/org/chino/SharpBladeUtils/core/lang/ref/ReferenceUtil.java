package org.chino.SharpBladeUtils.core.lang.ref;

import org.chino.SharpBladeUtils.core.util.ObjectUtil;

import java.lang.ref.*;

/**
 * @ClassName ReferenceUtil
 * @Description ReferenceUtil 引用处理工具
 * <pre>
 * 1.引用处理工具，用于处理各种类型的引用。
 * 2.引用工具类，主要针对{@link Reference}
 * 3.{@link SoftReference} 软引用，在GC报告内存不足时会被GC回收
 * 4.{@link WeakReference} 弱引用，在GC时发现弱引用会回收其对象
 * 5.{@link PhantomReference} 虚引用，在GC时发现虚引用对象，会将{@link PhantomReference}插入{@link ReferenceQueue}。 此时对象未被真正回收，要等到{@link ReferenceQueue}被真正处理后才会被回收。
 * </pre>
 * @Author LiuQi
 * @Date 2025/2/22 11:21
 * @Version 1.0
 */
public class ReferenceUtil {

    /**
     * get 获取引用对象
     *
     * @param reference_ {@link Reference_} 引用对象
     * @param <T>        {@link T}         泛型类型
     * @return {@link T} 返回引用对象
     * @description 安全的解包获取原始对象，如果引用对象为空则返回null
     * @author LiuQi
     */
    public static <T> T get(final Reference_<T> reference_) {
        // 使用ObjectUtil.apply方法，传入引用对象和自定义处理器函数。
        // 如果指定的对象不为 {@code null},则应用提供的映射函数并返回结果,否则返回 {@code null}
        return ObjectUtil.apply(reference_, Reference_::get);
    }
}
