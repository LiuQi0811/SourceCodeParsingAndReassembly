package org.chino.SharpBladeUtils.core.convert;

import java.lang.reflect.Type;

/**
 * @ClassName ConvertUtil
 * @Description ConvertUtil 类型转换器工具
 * @Author LiuQi
 */
public class ConvertUtil {

    public static <T> T convertWithCheck(final Type type, final Object value, final T defaultValue, final boolean quietly) {
        final CompositeConverter compositeConverter = CompositeConverter.getInstance();
        try {

        }catch (final Exception e) {
            if (quietly) {
                return defaultValue;
            }
            throw e;
        }
        return null;
    }
}
