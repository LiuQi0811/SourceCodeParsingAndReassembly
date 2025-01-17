package org.chino.tool.core.convert;

import org.chino.tool.core.lang.Option;
import org.chino.tool.core.reflect.TypeReference;
import org.chino.tool.core.reflect.TypeTool;
import org.chino.tool.core.tool.ObjTool;

import java.io.Serializable;
import java.lang.reflect.Type;
import java.util.Optional;

/**
 * @ClassName CompositeConverter
 * @Description CompositeConverter 组合转换器
 * @Author LiuQi
 * @Date 2025/1/14 13:28
 * @Version 1.0
 */
public class CompositeConverter implements Converter, Serializable {

    /**
     * serialVersionUID 序列化ID
     */
    private static final long serialVersionUID = 1L;

    private RegisterConverter registerConverter;

    /**
     * CompositeConverter 构造方法
     *
     * @author LiuQi
     */
    public CompositeConverter() {
    }

    /**
     * getInstance 获取CompositeConverter实例
     *
     * @return {@link CompositeConverter} 组合转换器实例对象
     * @author LiuQi
     */
    public static CompositeConverter getInstance() {
        // 返回CompositeConverter实例对象
        return SingletonHolder.INSTANCE;
    }

    @Override
    public Object convert(Type type, Object value) {
        // convert 转换方法处理
        return convert(type, value, null);
    }

    /**
     * convert 转换方法
     *
     * @param type         类型
     * @param value        值
     * @param defaultValue 默认值
     * @param <T>
     * @return {@link T}
     * @author LiuQi
     */
    public <T> T convert(Type type, Object value, T defaultValue) {
        // convert 转换方法处理 自定义优先
        return convert(type, value, defaultValue, true);
    }

    /**
     * convert 转换方法
     *
     * @param type          类型
     * @param value         值
     * @param defaultValue  默认值
     * @param isCustomFirst 是否自定义优先
     * @param <T>
     * @return {@link T}
     * @author LiuQi
     */
    public <T> T convert(Type type, Object value, T defaultValue, boolean isCustomFirst) {
        if (value == null) { // 值为空 直接返回默认值
            return defaultValue;
        } else {
            if (TypeTool.isUnknown(type)) { // 类型未知
                if (null == defaultValue) { // 默认值为空 直接返回值
                    return (T) value;
                }
                // 默认值不为空 并且类型未知 使用默认值的类型作为转换的类型
                type = defaultValue.getClass();
            }
            if (value instanceof Option<?>) { // Option 类型
                // TODO
                System.out.println(" TODO Option 类型 .......");
            }
            if (value instanceof Optional<?>) { // Optional 类型
                // Optional 类型 直接取值 或者 取默认值
                value = ((Optional<?>) value).orElse(null);
                if (ObjTool.isNull(value)) { // 取值为空 直接返回默认值
                    return defaultValue;
                }
            }
            if (value instanceof Converter) { // Converter 类型
                // Converter 类型转换处理
                return ((Converter) value).convert(type, value, defaultValue);
            } else {
                if (type instanceof TypeReference<?>) { // TypeReference 类型
                    // 直接取值 或者 取默认值
                    type = ((TypeReference<?>) type).getType();
                }
                // 获取转换器
                Converter converter = registerConverter.getConverter(type, value, isCustomFirst);
                if (null != converter) { // 转换器不为空
                    // 使用转换器进行转换处理
                    return converter.convert(type, value, defaultValue);
                } else { // 转换器为空
                    System.out.println(" // TODO 未找到合适的转换器 .......  ");
                }
                System.out.println(" TODO convert 转换方法 ............ " + converter);
            }
        }
        return null;
    }

    private static class SingletonHolder {

        /**
         * INSTANCE 创建CompositeConverter 组合转换器对象实例
         */
        private static final CompositeConverter INSTANCE = new CompositeConverter();

        /**
         * SingletonHolder 构造方法
         *
         * @author LiuQi
         */
        public SingletonHolder() {

        }

        /**
         * 静态代码块 初始化实例化对象
         * @author LiuQi
         */
        static {
            // 创建RegisterConverter对象实例
            INSTANCE.registerConverter = new RegisterConverter(INSTANCE);
        }
    }

}
