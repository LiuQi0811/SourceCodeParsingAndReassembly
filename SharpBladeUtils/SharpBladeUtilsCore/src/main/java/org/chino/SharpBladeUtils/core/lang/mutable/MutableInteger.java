package org.chino.SharpBladeUtils.core.lang.mutable;

/**
 * @ClassName MutableInteger
 * @Description MutableInteger 可变整数
 * @Author LiuQi
 * @Date 2025/2/19 13:42
 * @Version 1.0
 */
public class MutableInteger extends Number implements Comparable<MutableInteger>, Mutable<Number> {
    private static final long serialVersionUID = 1L;

    /**
     * value 整数值
     */
    private int value;

    /**
     * MutableInteger 构造方法
     *
     * @author LiuQi
     */
    public MutableInteger() {
    }

    /**
     * MutableInteger 构造方法
     *
     * @param value 整数值
     * @author LiuQi
     */
    public MutableInteger(final int value) {
        this.value = value;
    }

    /**
     * compareTo 比较两个MutableInteger 对象
     *
     * @param mutableInteger 可变整数 the object to be compared.
     * @return int 比较结果
     * @author LiuQi
     */
    @Override
    public int compareTo(MutableInteger mutableInteger) {
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
        return value;
    }

    /**
     * longValue 转长整数
     *
     * @return long 长整数
     * @author LiuQi
     */
    @Override
    public long longValue() {
        return value;
    }

    /**
     * floatValue 转单精度浮点数
     *
     * @return float 单精度浮点数
     * @author LiuQi
     */
    @Override
    public float floatValue() {
        return value;
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
        this.value = value.intValue();
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
