package org.chino.SharpBladeUtils.core.lang.mutable;

/**
 * @ClassName MutableLong
 * @Description MutableLong 可变长整数
 * @Author LiuQi
 */
public class MutableLong extends Number implements Comparable<MutableLong>, Mutable<Number> {
    private static final long serialVersionUID = 1L;

    /**
     * value 长整数值
     */
    private long value;

    /**
     * MutableLong 构造方法
     *
     * @author LiuQi
     */
    public MutableLong() {
    }

    /**
     * MutableLong 构造方法
     *
     * @param value 整数值
     * @author LiuQi
     */
    public MutableLong(final long value) {
        this.value = value;
    }

    /**
     * compareTo 比较两个MutableLong 对象
     *
     * @param mutableLong 可变长整数 the object to be compared.
     * @return int 比较结果
     * @author LiuQi
     */
    @Override
    public int compareTo(MutableLong mutableLong) {
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
        this.value = value.longValue();
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
