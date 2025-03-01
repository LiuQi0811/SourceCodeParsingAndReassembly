package org.chino.SharpBladeUtils.core.text.placeholder;

import org.chino.SharpBladeUtils.core.array.ArrayUtil;
import org.chino.SharpBladeUtils.core.lang.mutable.MutableEntry;
import org.chino.SharpBladeUtils.core.map.reference.WeakConcurrentMap;
import org.chino.SharpBladeUtils.core.text.StringUtil;
import org.chino.SharpBladeUtils.core.text.placeholder.template.SinglePlaceholderStringTemplate;

import java.util.Map;

/**
 * @ClassName StringFormatter
 * @Description StringFormatter 字符串格式化处理工具
 * @Author LiuQi
 * @Date 2025/2/21 10:52
 * @Version 1.0
 */
public class StringFormatter {

    /**
     * CACHE 缓存池 - 用于存放格式化模板，减少重复创建的开销
     */
    private static final WeakConcurrentMap<Map.Entry<CharSequence, Object>, StringTemplate> CACHE = new WeakConcurrentMap<>();

    /**
     * format 格式化字符串
     *
     * @param pattern {@link String} 匹配字符串
     * @param params  {@link Object} 参数列表
     * @return {@link String} 格式化后的字符串
     * @author LiuQi
     */
    public static String format(final String pattern, final Object... params) {
        // 调用 {@code formatWith(pattern, StringUtil.EMPTY_JSON, params)} 方法，传入模式字符串、占位符和参数列表
        return formatWith(pattern, StringUtil.EMPTY_JSON, params);
    }

    /**
     * formatWith  格式化字符串
     *
     * @param pattern     {@link String} 匹配字符串
     * @param placeHolder {@link String} 占位符
     * @param params      {@link Object} 参数列表
     * @return {@link String} 格式化后的字符串
     * @author LiuQi
     */
    public static String formatWith(final String pattern, final String placeHolder, final Object... params) {
        // 参数校验 - 参数为空 直接返回原字符串
        if (StringUtil.isBlank(pattern) || StringUtil.isBlank(placeHolder) || ArrayUtil.isEmpty(params)) return pattern;
        // 返回 StringTemplate 格式化模板的 format 方法执行结果 {@code computeIfAbsent(K key, Function<? super K, ? extends V> mappingFunction)}   该方法在ConcurrentMap接口中定义，用于计算给定键的映射值
        return ((SinglePlaceholderStringTemplate) CACHE.computeIfAbsent(MutableEntry.of(pattern, placeHolder), entry -> StringTemplate.of(pattern).placeholder(placeHolder).build()))
                .format(params);
    }
}
