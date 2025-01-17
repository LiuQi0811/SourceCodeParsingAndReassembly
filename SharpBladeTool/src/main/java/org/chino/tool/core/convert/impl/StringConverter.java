package org.chino.tool.core.convert.impl;

import org.chino.tool.core.convert.AbstractConverter;

/**
 * @ClassName StringConverter
 * @Description StringConverter 字符串转换器
 * @Author LiuQi
 * @Date 2025/1/17 15:48
 * @Version 1.0
 */
public class StringConverter extends AbstractConverter {

    /**
     * serialVersionUID 序列化版本号
     */
    private static final long serialVersionUID = 1L;

    /**
     * StringConverter 构造方法
     *
     * @author LiuQi
     */
    public StringConverter() {
    }

    @Override
    protected Object convertInternal(Class<?> targetClass, Object value) {
        System.out.println(" StringConverter 转换器执行了 ---- 内部方法转换 ----");
        return null;
    }

}
