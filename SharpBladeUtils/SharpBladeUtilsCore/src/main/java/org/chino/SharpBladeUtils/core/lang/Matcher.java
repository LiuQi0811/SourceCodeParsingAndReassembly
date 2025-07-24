package org.chino.SharpBladeUtils.core.lang;


/**
 * @ClassName Matcher
 * @Description Matcher 匹配接口
 * @Author LiuQi
 */
@FunctionalInterface
public interface Matcher<T> {

    /**
     * match 给定对象是否匹配
     *
     * @param value {@link T}
     * @return {@link Boolean} 是否匹配
     */
    boolean match(T value);
}
