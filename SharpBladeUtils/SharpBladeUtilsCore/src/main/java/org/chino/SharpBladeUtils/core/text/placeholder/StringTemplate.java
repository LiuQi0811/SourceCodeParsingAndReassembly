package org.chino.SharpBladeUtils.core.text.placeholder;

import org.chino.SharpBladeUtils.core.lang.Assert;
import org.chino.SharpBladeUtils.core.text.CharPool;
import org.chino.SharpBladeUtils.core.text.placeholder.template.SinglePlaceholderStringTemplate;

import java.util.Iterator;
import java.util.Objects;
import java.util.function.UnaryOperator;

import static org.chino.SharpBladeUtils.core.text.placeholder.StringTemplate.Feature.*;

/**
 * @ClassName StringTemplate
 * @Description StringTemplate 字符串模板
 * @Author LiuQi
 * @Date 2025/2/24 14:59
 * @Version 1.0
 */
public abstract class StringTemplate {
    /**
     * DEFAULT_ESCAPE 默认转义符字符
     */
    protected static final char DEFAULT_ESCAPE = CharPool.BACKSLASH;

    /**
     * globalFeatures 全局策略值
     */
    protected static int globalFeatures = Feature.of(FORMAT_MISSING_KEY_PRINT_WHOLE_PLACEHOLDER, FORMAT_NULL_VALUE_TO_STR,
            MATCH_KEEP_DEFAULT_VALUE, MATCH_EMPTY_VALUE_TO_NULL, MATCH_NULL_STR_TO_NULL);

    /**
     * template 字符串模板
     */
    private final String template;
    /**
     * escapeChar 转义符字符
     */
    private final char escapeChar;
    /**
     * defaultValue 默认值
     */
    private final String defaultValue;
    /**
     * defaultValueHandler 默认值处理器
     */
    private final UnaryOperator<String> defaultValueHandler;
    /**
     * features 策略值
     */
    private final int features;


    /**
     * StringTemplate 构造方法
     *
     * @param template            {@link String} 字符串模板
     * @param escapeChar          转义字符
     * @param defaultValue        {@link String} 默认值
     * @param defaultValueHandler {@link UnaryOperator<String>} 默认值处理器
     * @param features            策略值
     * @author LiuQi
     */
    protected StringTemplate(final String template, final char escapeChar, final String defaultValue, final UnaryOperator<String> defaultValueHandler, final int features) {
        Assert.notNull(template, "String template cannot be null");
        // 设置字符串模板
        this.template = template;
        // 设置转义符字符
        this.escapeChar = escapeChar;
        // 设置默认值和处理器
        this.defaultValue = defaultValue;
        this.defaultValueHandler = defaultValueHandler;
        // 设置策略值
        this.features = features;
    }

    /**
     * getTemplate 获取字符串模板
     *
     * @return {@link String} 字符串模板
     * @author LiuQi
     */
    public String getTemplate() {
        // 返回字符串模板
        return template;
    }

    /**
     * of 构建模板
     *
     * @param template {@link String} 字符串模板
     * @return {@link SinglePlaceholderStringTemplate.Builder}  Builder构建器对象
     * @description 创建 单占位符模板对象的 Builder
     * <pre>
     *     例如，"{}", "?", "$$$"
     * </pre>
     * @author LiuQi
     */
    public static SinglePlaceholderStringTemplate.Builder of(final String template) {
        // 返回 SinglePlaceholderStringTemplate.Builder 构建器对象
        return SinglePlaceholderStringTemplate.builder(template);
    }

    /**
     * formatSequence 格式化序列
     *
     * @param iterable {@link Iterable<?>} 可迭代对象
     * @return {@link String} 格式化后的字符串
     * @description 格式化序列
     * @author LiuQi
     */
    protected String formatSequence(final Iterable<?> iterable) {
        // 如果可迭代对象为空 则返回字符串模板
        if (iterable == null) return getTemplate();
        // 获取迭代器对象
        Iterator<?> iterator = iterable.iterator();
        // TODO 此处有待实现
        return null;
    }

    /**
     * @param <BuilderChild>  BuilderChild 构建器子类类型
     * @param <TemplateChild> TemplateChild 模板子类类型
     * @ClassName AbstractBuilder
     * @Description AbstractBuilder 抽象构建器
     * @Author LiuQi
     */
    protected static abstract class AbstractBuilder<BuilderChild extends AbstractBuilder<BuilderChild, TemplateChild>, TemplateChild extends StringTemplate> {
        /**
         * template 字符串模板
         */
        protected final String template;
        /**
         * escapeChar 转义符字符
         */
        protected char escapeChar;
        /**
         * defaultValue 默认值
         */
        protected String defaultValue;
        /**
         * defaultValueHandler 默认值处理器
         */
        protected UnaryOperator<String> defaultValueHandler;
        /**
         * features 策略值
         */
        protected int features;
        /**
         * hasEscapeChar 是否设置转义符
         */
        protected boolean hasEscapeChar;

        /**
         * AbstractBuilder 构造方法
         *
         * @param template {@link String} 字符串模板
         * @author LiuQi
         */
        protected AbstractBuilder(final String template) {
            // 校验模板不为空 设置字符串模板和策略值
            this.template = Objects.requireNonNull(template);
            this.features = StringTemplate.globalFeatures;
        }

        /**
         * build 构建模板对象
         *
         * @return {@link TemplateChild} 模板对象
         * @description 构建模板对象
         * @author LiuQi
         */
        public TemplateChild build() {
            // 如果没有设置转义符 则使用默认转义符
            if (!hasEscapeChar) this.escapeChar = DEFAULT_ESCAPE;
            // 构建模板对象实例 并返回
            return buildInstance();
        }

        /**
         * buildInstance 构建模板对象实例
         *
         * @return {@link TemplateChild} 模板对象实例
         * @description 构建模板对象实例 子类Builder
         * @author LiuQi
         */
        protected abstract TemplateChild buildInstance();
    }

    /**
     * @ClassName Feature
     * @Description Feature 策略枚举
     * @Author LiuQi
     */
    public enum Feature {
        /**
         * FORMAT_MISSING_KEY_PRINT_WHOLE_PLACEHOLDER 缺失键时打印整个占位符
         */
        FORMAT_MISSING_KEY_PRINT_WHOLE_PLACEHOLDER(0, 0, 6),
        /**
         * FORMAT_MISSING_KEY_PRINT_EMPTY 缺失键时打印空字符串
         */
        FORMAT_MISSING_KEY_PRINT_EMPTY(3, 0, 6),
        /**
         * FORMAT_NULL_VALUE_TO_STR 空值转为字符串 "null"
         */
        FORMAT_NULL_VALUE_TO_STR(6, 6, 4),
        /**
         * MATCH_KEEP_DEFAULT_VALUE 匹配时保持默认值，不替换为空字符串
         */
        MATCH_KEEP_DEFAULT_VALUE(16, 16, 3),
        /**
         * MATCH_EMPTY_VALUE_TO_NULL 匹配时空值转为 null
         */
        MATCH_EMPTY_VALUE_TO_NULL(19, 19, 4),
        /**
         * MATCH_NULL_STR_TO_NULL 匹配时字符串 "null" 转为 null
         */
        MATCH_NULL_STR_TO_NULL(23, 23, 3),
        ;

        /**
         * mask 掩码值
         */
        private final int mask;
        /**
         * clearMask 清除掩码值
         */
        private final int clearMask;

        /**
         * Feature 构造方法
         *
         * @param binaryPosition 二进制位置
         * @param binaryStart    二进制起始位
         * @param binaryLength   二进制长度
         * @author LiuQi
         */
        Feature(final int binaryPosition, final int binaryStart, final int binaryLength) {
            // 1 << binaryPosition;  例如：1 << 0 = 1, 1 << 1 = 2
            this.mask = 1 << binaryPosition;
            // (-1 << (binaryStart + binaryLength)) | ((1 << binaryStart) - 1);  例如：(-1 << (2 + 3)) | ((1 << 2) - 1);
            this.clearMask = (-1 << (binaryStart + binaryLength)) | ((1 << binaryStart) - 1);
        }

        /**
         * set 设置策略值
         *
         * @param features 策略值
         * @return 返回策略值
         * @author LiuQi
         */
        public int set(final int features) {
            // 返回策略值，将当前枚举值的掩码值设置为 features 的掩码值 & clearMask & mask
            return (features & clearMask) | mask;
        }

        /**
         * of 组合策略值
         *
         * @param features 策略值数组
         * @return 返回组合后的策略值
         * @author LiuQi
         */
        public static int of(final Feature... features) {
            // 如果 features 为空，则返回 0
            if (null == features) return 0;
            // 定义 result，用于存储组合后的策略值
            int result = 0;
            for (Feature feature : features) { // 遍历 features 数组，将每个枚举值对应的掩码值设置为 result
                // 将枚举值对应的掩码值设置为 result
                result = feature.set(result);
            }
            // 返回组合后的策略值
            return result;
        }
    }
}
