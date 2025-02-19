package org.chino.SharpBladeUtils.core.lang.mutable;

import java.io.Serializable;

/**
 * @ClassName MutableBoolean
 * @Description MutableBoolean 可变布尔类型
 * @Author LiuQi
 * @Date 2025/2/19 13:04
 * @Version 1.0
 */
public class MutableBoolean implements Comparable<MutableBoolean>, Mutable<Boolean>, Serializable {
    private static final long serialVersionUID = 1L;

    /**
     * value 布尔值
     */
    private boolean value;

    /**
     * MutableBoolean 构造方法
     *
     * @author LiuQi
     */
    public MutableBoolean() {
    }

    /**
     * MutableBoolean 构造方法
     *
     * @param value 布尔值
     * @author LiuQi
     */
    public MutableBoolean(final boolean value) {
        this.value = value;
    }

    /**
     * compareTo 比较两个 MutableBoolean 对象
     *
     * @param mutableBoolean the object to be compared.
     * @return the value {@code 0} if this object is equal to the specified
     * @author LiuQi
     */
    @Override
    public int compareTo(MutableBoolean mutableBoolean) {
        // 比较两个布尔值的大小
        return Boolean.compare(value, mutableBoolean.value);
    }

    @Override
    public Boolean get() {
        return value;
    }

    @Override
    public void set(Boolean value) {
        this.value = value;
    }
}
