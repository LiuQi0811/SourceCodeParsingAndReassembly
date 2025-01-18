package org.chino.tool.core.convert;

import org.chino.tool.core.array.ArrayTool;
import org.chino.tool.core.reflect.TypeTool;
import org.chino.tool.core.text.CharTool;

import java.io.Serializable;
import java.lang.reflect.Type;

/**
 * @ClassName AbstractConverter
 * @Description AbstractConverter 抽象转换器
 * @Author LiuQi
 * @Date 2025/1/17 15:48
 * @Version 1.0
 */
public abstract class AbstractConverter implements Converter, Serializable {

    /**
     * serialVersionUID 序列化版本号
     */
    private static final long serialVersionUID = 1L;

    /**
     * AbstractConverter 构造方法
     *
     * @author LiuQi
     */
    public AbstractConverter() {
    }

    @Override
    public Object convert(Type tagetType, Object value) {
        if (null == value) { // 待转换值为空
            // 直接返回 null
            return null;
        } else if (TypeTool.isUnknown(tagetType)) { // 目标类型未知
            // TODO 抛出异常 待处理
            return null;
        } else {
            Class<?> targetClass = TypeTool.getClass(tagetType);
            if (null == targetClass) { // 目标类型为空
                // TODO 抛出异常 待处理
                return null;
            } else {
                // 判断是否为目标类型实例 若不是则返回  convertInternal 转换内部处理
                return targetClass.isInstance(value) ? value : convertInternal(targetClass, value);
            }

        }
    }

    /**
     * convertInternal 转换内部处理
     *
     * @param targetClass {@link Class<?>} 目标类型
     * @param value       {@link Object}       待转换值
     * @return {@link Object} 转换后的值
     * @author LiuQi
     */
    protected abstract Object convertInternal(Class<?> targetClass, Object value);

    /**
     * convertToStr 转换到字符串
     *
     * @param value {@link Object} 待转换值
     * @return {@link String} 转换后的字符串值
     * @author LiuQi
     */
    protected String convertToStr(Object value) {
        if (null == value) { // 待转换值为空
            // 直接返回 null
            return null;
        } else if (value instanceof CharSequence) { // CharSequence 类型
            // 直接返回 toString 方法字符串处理
            return value.toString();
        } else if (ArrayTool.isArray(value)) { // Array数组类型
            // 返回 Array数组类型 转换为字符串方法
            return ArrayTool.toString(value);
        } else {
            // 返回 待转换值是字符类型 执行toString 将字符转换为字符串方法 否则 直接toString方法
            return (CharTool.isChar(value) ? CharTool.toString(((Character) value)) : value.toString());
        }
    }
}
