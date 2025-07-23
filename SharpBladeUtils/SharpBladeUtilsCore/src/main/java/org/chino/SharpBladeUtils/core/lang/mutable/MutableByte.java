package org.chino.SharpBladeUtils.core.lang.mutable;

/**
 * @ClassName MutableByte
 * @Description MutableByte 可变字节
 * @Author LiuQi
 */
public class MutableByte extends Number implements Comparable<MutableByte>, Mutable<Number> {
    private static final long serialVersionUID = 1L;
    /**
     * value 字节值
     */
    private byte value;

    /**
     * MutableByte 构造方法
     *
     * @author LiuQi
     */
    public MutableByte() {
    }

    /**
     * MutableByte 构造方法
     *
     * @param value 字节值
     * @author LiuQi
     */
    public MutableByte(byte value) {
        this.value = value;
    }

    /**
     * compareTo 比较两个MutableByte 对象
     *
     * @param mutableByte 可变字节 the object to be compared.
     * @return int 比较结果
     * @author LiuQi
     */
    @Override
    public int compareTo(MutableByte mutableByte) {
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
        this.value = value.byteValue();
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
