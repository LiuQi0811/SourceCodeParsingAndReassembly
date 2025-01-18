package org.chino.tool.core.convert.impl;

import org.chino.tool.core.convert.AbstractConverter;
import org.chino.tool.core.map.MapTool;
import org.w3c.dom.Node;

import java.lang.reflect.Type;
import java.sql.Blob;
import java.sql.Clob;
import java.util.Map;
import java.util.TimeZone;
import java.util.function.Function;

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

    private Map<Class<?>, Function<Object, String>> STRINGER;

    /**
     * StringConverter 构造方法
     *
     * @author LiuQi
     */
    public StringConverter() {
    }

    @Override
    protected Object convertInternal(Class<?> targetClass, Object value) {
        if (MapTool.isNotEmpty(STRINGER)) {
            System.out.println(" STRINGER 不为空 ----");
        }
        if (value instanceof TimeZone) { // TimeZone 类型
            System.out.println("// TODO  TimeZone 类型 ----");
            return null;
        } else if (value instanceof Node) { // Node 类型
            System.out.println("// TODO Node 类型 ----");
            return null;
        } else if (value instanceof Clob) { // Clob 类型
            System.out.println("// TODO Clob 类型 ----");
            return null;
        } else if (value instanceof Blob) { // Blob 类型
            System.out.println("// TODO Blob 类型 ----");
            return null;
        } else { // 其他类型
            // 待转换的值是 Type 类型则返回typeName 否则调用 convertToStr 方法进行转换
            return (value instanceof Type) ? ((Type) value).getTypeName() : convertToStr(value);
        }
    }

}
