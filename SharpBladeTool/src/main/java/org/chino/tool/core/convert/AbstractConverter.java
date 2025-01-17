package org.chino.tool.core.convert;

import org.chino.tool.core.reflect.TypeTool;

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
     * @param targetClass 目标类型
     * @param value       待转换值
     * @return {@link Object} 转换后的值
     * @author LiuQi
     */
    protected abstract Object convertInternal(Class<?> targetClass, Object value);
}
