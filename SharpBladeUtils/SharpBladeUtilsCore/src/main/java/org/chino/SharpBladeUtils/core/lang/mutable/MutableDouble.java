package org.chino.SharpBladeUtils.core.lang.mutable;

/**
 * @ClassName MutableDouble
 * @Description MutableDouble 可变双精度浮点数
 * @Author LiuQi
 * @Date 2025/2/19 13:42
 * @Version 1.0
 */
public class MutableDouble extends Number implements Comparable<MutableDouble>, Mutable<Number> {
    private static final long serialVersionUID = 1L;

    /**
     * value 双精度浮点数值
     */
    private double value;

    /**
     * MutableDouble 构造方法
     *
     * @author LiuQi
     */
    public MutableDouble() {
    }

    /**
     * MutableDouble 构造方法
     *
     * @param value 双精度浮点数值
     * @author LiuQi
     */
    public MutableDouble(final double value) {
        this.value = value;
    }

    /**
     * compareTo 比较两个MutableDouble 对象
     *
     * @param mutableDouble 双精度浮点数 the object to be compared.
     * @return int 比较结果
     * @author LiuQi
     */
    @Override
    public int compareTo(MutableDouble mutableDouble) {
        // TODO Auto-generated method stub
        return 0;
    }

    /**
     * intValue 转整数
     *
     * @return int 整数
     * @author LiuQi
     */
    @Override
    public int intValue() {
        return (int) value;
    }

    /**
     * longValue 转长整数
     *
     * @return long 长整数
     * @author LiuQi
     */
    @Override
    public long longValue() {
        return (long) value;
    }

    /**
     * floatValue 转单精度浮点数
     *
     * @return float 单精度浮点数
     * @author LiuQi
     */
    @Override
    public float floatValue() {
        return (float) value;
    }

    /**
     * doubleValue 转双精度浮点数
     *
     * @return double 双精度浮点数
     * @author LiuQi
     */
    @Override
    public double doubleValue() {
        return value;
    }

    @Override
    public Number get() {
        return value;
    }

    @Override
    public void set(Number value) {
        this.value = value.doubleValue();
    }

    /**
     * toString 转字符串
     *
     * @return String 字符串
     * @author LiuQi
     */
    @Override
    public String toString() {
        return String.valueOf(value);
    }
}
