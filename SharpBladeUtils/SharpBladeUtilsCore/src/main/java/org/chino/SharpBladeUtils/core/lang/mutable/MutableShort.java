package org.chino.SharpBladeUtils.core.lang.mutable;

/**
 * @ClassName MutableShort
 * @Description MutableShort 可变短整数
 * @Author LiuQi
 * @Date 2025/2/19 13:42
 * @Version 1.0
 */
public class MutableShort extends Number implements Comparable<MutableShort>, Mutable<Number> {
    private static final long serialVersionUID = 1L;

    /**
     * value 短整数值
     */
    private short value;

    /**
     * MutableShort 构造方法
     *
     * @author LiuQi
     */
    public MutableShort() {
    }

    /**
     * MutableShort 构造方法
     *
     * @param value 短整数值
     * @author LiuQi
     */
    public MutableShort(final short value) {
        this.value = value;
    }

    /**
     * compareTo 比较两个MutableShort 对象
     *
     * @param mutableShort 短整数 the object to be compared.
     * @return int 比较结果
     * @author LiuQi
     */
    @Override
    public int compareTo(MutableShort mutableShort) {
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
        this.value = value.shortValue();
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
