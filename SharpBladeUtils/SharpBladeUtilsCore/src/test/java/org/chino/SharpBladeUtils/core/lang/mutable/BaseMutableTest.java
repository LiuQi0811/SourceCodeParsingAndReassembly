package org.chino.SharpBladeUtils.core.lang.mutable;

import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

import java.util.Objects;

/**
 * @ClassName BaseMutableTest
 * @Description BaseMutableTest 可变基类单元测试类
 * @Author LiuQi
 * @Date 2025/2/18 17:13
 * @Version 1.0
 */
public abstract class BaseMutableTest<V, M extends Mutable<V>> {

    /**
     * 测试 of 方法
     *
     * @author LiuQi
     */
    @Test
    void ofTest() {
        System.out.println(Mutable.of("1"));
        System.out.println(Mutable.of(true));
        System.out.println(Mutable.of((byte) 1));
        System.out.println(Mutable.of(1));
        System.out.println(Mutable.of(1.0D));
        System.out.println(Mutable.of(1.0F));
        System.out.println(Mutable.of(1L));
        System.out.println(Mutable.of(new Object()));
        System.out.println(Mutable.of((short) 1));
    }

    /**
     * getMutable {@link Mutable}获取可变对象
     *
     * @param value 值
     * @return M 可变对象类型
     * @author LiuQi
     */
    abstract M getMutable(V value);

    /**
     * getValue 获取值
     *
     * @return V 值类型
     * @author LiuQi
     */
    abstract V getValue();

    /**
     * getTest 获取值测试
     *
     * @author LiuQi
     */
    @Test
    void getTest() {
        // 获取可变对象
        Mutable<V> mutable = getMutable(getValue());
        // 获取值
        V value = mutable.get();
        Assertions.assertEquals(getValue(), value);
    }

    /**
     * setTest 设置值测试
     *
     * @author LiuQi
     */
    @Test
    void setTest() {
        // 获取可变对象
        Mutable<V> mutable = getMutable(getValue());
        // 设置值
        mutable.set((V) " My name is LiuQi.");
        // 获取值
        V value = mutable.get();
        Assertions.assertNotEquals(getValue(), value);  // 断言值不相等
        // 获取值并打印
        System.out.println(value);
    }

    /**
     * mapTest map映射测试
     *
     * @author LiuQi
     */
    @Test
    void mapTest() {
        // 获取可变对象
        Mutable<V> mutable = getMutable(getValue());
        // 映射值
        mutable.map(value -> (V) " My name is LiuQi.");
        // 获取值并打印
        System.out.println(mutable.get());
    }

    /**
     * peekTest peek检查操作测试
     *
     * @author LiuQi
     */
    @Test
    void peekTest() {
        // 获取可变对象
        Mutable<V> mutable = getMutable(getValue());
        Mutable<V> mutable_ = getMutable((V) "My name is LiuQi.");
        // 检查操作，将值设置为 Hello, MutableObject!
        mutable.peek(mutable_::set);
        // 输出 Hello, MutableObject!
        System.out.println(mutable);
        System.out.println(mutable_);
    }

    /**
     * testTest test 检查当前值是否满足条件测试
     *
     * @author LiuQi
     */
    @Test
    void testTest() {
        // 获取可变对象
        Mutable<V> mutable = getMutable(getValue());
        // 检查当前值是否满足条件，不为空
        mutable.test(Objects::nonNull);
        // 获取值并打印
        System.out.println(mutable.get());
    }

    /**
     * toTest 转换当前值测试
     *
     * @author LiuQi
     */
    @Test
    void toTest() {
        // 获取可变对象
        Mutable<V> mutable = getMutable(getValue());
        // 转换当前值，转换为字符串类型
        String value = mutable.to(String::valueOf);
        // 获取值并打印
        System.out.println(value);
    }

    /**
     * toOptional_Test 转换为 Optional_ 类型测试
     */
    @Test
    void toOptional_Test() {
        // 获取可变对象
        Mutable<V> mutable = getMutable(getValue());
        // 转换为 Optional_ 类型
        V value = mutable.toOptional_().getOrNull();
        // 获取值并打印
        System.out.println(value);
    }

}
