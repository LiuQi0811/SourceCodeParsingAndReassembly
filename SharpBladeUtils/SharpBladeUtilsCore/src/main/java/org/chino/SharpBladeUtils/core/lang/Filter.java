package org.chino.SharpBladeUtils.core.lang;


/**
 * @ClassName Filter
 * @Description Filter 过滤器接口
 * @Author LiuQi
 */
@FunctionalInterface
public interface Filter<T> {
    /**
     * accept 是否接受对象
     *
     * @param data {@link T} 检查的对象
     * @return 是否接受对象
     * @author LiuQi
     */
    boolean accept(T data);
}
