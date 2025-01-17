package org.chino.tool.core.convert;

import org.chino.tool.core.lang.Assert;

/**
 * @ClassName ConverterWithRoot
 * @Description ConverterWithRoot 根节点转换器
 * @Author LiuQi
 * @Date 2025/1/17 13:18
 * @Version 1.0
 */
public abstract class ConverterWithRoot implements Converter {
    protected final Converter rootConverter;

    /**
     * ConverterWithRoot 构造方法
     *
     * @param rootConverter {@link Converter} 根转换器
     * @author LiuQi
     */
    public ConverterWithRoot(Converter rootConverter) {
        // 校验根转换器不为空
        this.rootConverter = Assert.notNull(rootConverter);
    }

    /**
     * getRootConverter 获取根转换器
     *
     * @return {@link Converter} 根转换器
     * @author LiuQi
     */
    public Converter getRootConverter() {
        // 返回根转换器
        return rootConverter;
    }

}
