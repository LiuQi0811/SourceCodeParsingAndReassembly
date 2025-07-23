package org.chino.SharpBladeUtils.core.lang.ref;

/**
 * @ClassName Reference_
 * @Description Reference_ 针对{@link java.lang.ref.Reference}的接口定义，用于扩展功能
 * <pre>
 *     1. 扩展Reference的功能
 *     2. 提供自定义的无需回收对象
 * </pre>
 * @Author LiuQi
 */
@FunctionalInterface
public interface Reference_<T> {
    /**
     * get 获取引用的原始对象
     *
     * @return T {@link T} 原始对象
     * @author LiuQi
     */
    T get();
}
