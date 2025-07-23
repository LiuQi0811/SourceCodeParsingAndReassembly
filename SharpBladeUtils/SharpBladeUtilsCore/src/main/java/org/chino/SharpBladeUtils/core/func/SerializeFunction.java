package org.chino.SharpBladeUtils.core.func;

import java.io.Serializable;
import java.util.function.Function;

/**
 * @ClassName SerializeFunction
 * @Description SerializeFunction 可序列化的Function接口
 * @Author LiuQi
 */
@FunctionalInterface
public interface SerializeFunction<T, R> extends Function<T, R>, Serializable {
}
