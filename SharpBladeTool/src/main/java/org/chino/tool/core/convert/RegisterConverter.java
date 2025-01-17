package org.chino.tool.core.convert;

import org.chino.tool.core.convert.impl.StringConverter;
import org.chino.tool.core.map.concurrent.SafeConcurrentHashMap;
import org.chino.tool.core.reflect.TypeTool;
import org.chino.tool.core.stream.StreamTool;

import java.io.Serializable;
import java.lang.reflect.Type;
import java.util.Map;
import java.util.Set;

/**
 * @ClassName RegisterConverter
 * @Description RegisterConverter 转换器注册对象
 * @Author LiuQi
 * @Date 2025/1/9 10:06
 * @Version 1.0
 */
public class RegisterConverter extends ConverterWithRoot implements Serializable {

    /**
     * serialVersionUID 序列化版本号
     */
    private static final long serialVersionUID = 1L;

    private volatile Set<MatcherConverter> converterSet;
    private volatile Map<Type, Converter> customConverterMap;
    private final Map<Class<?>, Converter> defaultConverterMap;

    /**
     * RegisterConverter 构造方法
     *
     * @param rootConverter 根转换器
     * @author LiuQi
     */
    public RegisterConverter(Converter rootConverter) {
        // 调用父类构造方法
        super(rootConverter);
        // initDefaultConverter 初始化默认转换器映射
        defaultConverterMap = initDefaultConverter(rootConverter);
    }

    @Override
    public Object convert(Type type, Object value) {
        return null;
    }

    /**
     * getConverter 获取转换器
     *
     * @param type          类型
     * @param value         值
     * @param isCustomFirst 是否自定义转换器优先
     * @return {@link Converter} 转换器
     * @author LiuQi
     */
    public Converter getConverter(Type type, Object value, boolean isCustomFirst) {
        // 声明 Converter 转换接口
        Converter converter;
        if (isCustomFirst) { // 自定义转换器优先
            // getCustomConverter 获取自定义转换器处理
            converter = getCustomConverter(type, value);
            if (null == converter) {
                // getCustomConverter 获取自定义转换器处理
                converter = getCustomConverter(type);
            }
            if (null == converter) { // 自定义转换器不存在
                // getDefaultConverter 获取默认转换器处理
                converter = getDefaultConverter(type);
            }
        } else { // 默认转换器优先
            converter = null;
            System.out.println("默认转换器优先 ............................TODO ");
        }
        // 返回 converter 转换器接口
        return converter;
    }

    /**
     * getDefaultConverter 获取默认转换器
     *
     * @param type 类型
     * @return {@link Converter} 默认转换器
     * @author LiuQi
     */
    public Converter getDefaultConverter(Type type) {
        // 如果参数类型为空 直接返回 null 否则获取类型对应的类对象
        Class<?> targetClass = null == type ? null : TypeTool.getClass(type);
        // 获取默认转换器映射不为空 且 类对象不为空 直接返回映射中的转换器 否则返回 null
        return null != defaultConverterMap && null != targetClass ? defaultConverterMap.get(targetClass) : null;
    }

    /**
     * getCustomConverter 获取自定义转换器
     *
     * @param type  类型
     * @param value 值
     * @return {@link Converter} 自定义转换器
     * @author LiuQi
     */
    public Converter getCustomConverter(Type type, Object value) {
        return StreamTool.of(converterSet)
                .filter((predicate) -> predicate.match(type, value))
                .findFirst().orElse(null);
    }

    /**
     * getCustomConverter 获取自定义转换器
     *
     * @param type 类型
     * @return {@link Converter} 自定义转换器
     * @author LiuQi
     */
    public Converter getCustomConverter(Type type) {
        // 获取自定义转换器映射为空 直接返回 null 否则返回映射中的转换器
        return null == customConverterMap ? null : customConverterMap.get(type);
    }

    /**
     * initDefaultConverter 初始化默认转换器
     *
     * @param rootConverter 根转换器
     * @return {@link Map<Class<?>, Converter>} 默认转换器映射
     * @author LiuQi
     */
    public Map<Class<?>, Converter> initDefaultConverter(Converter rootConverter) {
        // 创建SafeConcurrentHashMap 线程安全的HashMap对象
        Map<Class<?>, Converter> converterMap = new SafeConcurrentHashMap<>(64);

        // 创建StringConverter对象
        StringConverter stringConverter = new StringConverter();
        // 添加String类型对应的转换器到映射中
        converterMap.put(String.class, stringConverter);
        // TODO  do something
        return converterMap;
    }
}
