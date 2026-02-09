package org.chino.SharpBladeUtils.core.convert;

import org.chino.SharpBladeUtils.core.lang.Optional_;
import org.chino.SharpBladeUtils.core.reflect.TypeUtil;
import org.chino.SharpBladeUtils.core.util.ObjectUtil;

import java.io.Serial;
import java.io.Serializable;
import java.lang.reflect.Type;
import java.util.Optional;

/**
 * @ClassName CompositeConverter
 * @Description CompositeConverter 复合转换器，融合了所有支持类型和自定义类型的转换规则
 * @Author LiuQi
 */
public class CompositeConverter implements Serializable {
    @Serial
    private static final long serialVersionUID = 1L;

    private RegisterConverter registerConverter;
    private SpecialConverter specialConverter;

    public CompositeConverter() {

    }

    private static class SingletonHolder {
        private static final CompositeConverter INSTANCE;

        static {
            INSTANCE = new CompositeConverter();
            INSTANCE.registerConverter = new RegisterConverter();
            INSTANCE.specialConverter = new SpecialConverter();
        }
    }

    public static CompositeConverter getInstance() {
        return SingletonHolder.INSTANCE;
    }

    public <T> T convert(Type type, Object value, final T defaultValue, final boolean isCustomFirst) {
        if (ObjectUtil.isNull(value)) {
            return defaultValue;
        }
        if (TypeUtil.isUnknown(type)) {
            if (null == defaultValue) {
                return (T) value;
            }
            type = defaultValue.getClass();
        }
        if (value instanceof Optional_) {
            value = ((Optional_<T>) value).getOrNull();
            if (ObjectUtil.isNull(value)) {
                return defaultValue;
            }
        }
        if (value instanceof Optional) {
            value = ((Optional<T>) value).orElse(null);
            if (ObjectUtil.isNull(value)) {
                return defaultValue;
            }
        }
        return null;
    }

    public static void main(String[] args) {
        getInstance().convert(String.class, Optional.of("FFF"), "HH ", true);
    }
}
