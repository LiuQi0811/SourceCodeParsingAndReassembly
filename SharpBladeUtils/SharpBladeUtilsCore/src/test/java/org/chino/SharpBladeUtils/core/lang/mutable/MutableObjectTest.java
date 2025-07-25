package org.chino.SharpBladeUtils.core.lang.mutable;

/**
 * @ClassName MutableObjectTest
 * @Description MutableObjectTest 可变对象单元测试类
 * @Author LiuQi
 */
public class MutableObjectTest extends BaseMutableTest<String, MutableObject<String>> {

    @Override
    MutableObject<String> getMutable(String value) {
        return new MutableObject<String>(value);
    }

    @Override
    String getValue() {
        return "Hello, MutableObject!";
    }
}
