package org.chino.tool.core.clone;

/**
 * @ClassName Cloneable_
 * @Description Cloneable_ 克隆实现接口 -  继承Cloneable接口
 * @Author LiuQi
 * @Date 2025/1/8 9:33
 * @Version 1.0
 */
public interface Cloneable_<T> extends Cloneable {

    /**
     * clone 克隆方法
     *
     * @return {@link T}
     * @author LiuQi
     */
    T clone();
}
