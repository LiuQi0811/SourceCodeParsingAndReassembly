package org.chino.tool.core.clone;


/**
 * @ClassName CloneSupport
 * @Description CloneSupport 克隆支持
 * @Author LiuQi
 * @Date 2025/1/8 9:37
 * @Version 1.0
 */
public class CloneSupport<T> implements Cloneable_<T> {

    /**
     * CloneSupport 构造方法
     *
     * @author LiuQi
     */
    public CloneSupport() {
    }

    @Override
    public T clone() {
        try {
            // 返回 父类的 clone 方法 这里使用了泛型所以需要强制转换回 T 类型
            return (T) super.clone();
        } catch (CloneNotSupportedException e) {
            // 抛出 克隆异常
            throw new CloneRuntimeException(e);
        }
    }
}
