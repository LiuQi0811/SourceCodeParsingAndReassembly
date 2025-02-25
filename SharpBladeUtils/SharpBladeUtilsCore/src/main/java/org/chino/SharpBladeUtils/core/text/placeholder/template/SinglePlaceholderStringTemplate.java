package org.chino.SharpBladeUtils.core.text.placeholder.template;

import org.chino.SharpBladeUtils.core.text.StringPool;
import org.chino.SharpBladeUtils.core.text.placeholder.StringTemplate;

import java.util.function.UnaryOperator;

/**
 * @ClassName SinglePlaceholderStringTemplate
 * @Description SinglePlaceholderStringTemplate 单个占位符字符串模板
 * <pre>
 *     例如，"?", "{}", "$$$"
 * </pre>
 * @Author LiuQi
 * @Date 2025/2/24 15:04
 * @Version 1.0
 */
public class SinglePlaceholderStringTemplate extends StringTemplate {
    /**
     * DEFAULT_PLACEHOLDER 默认占位符
     */
    public static final String DEFAULT_PLACEHOLDER = StringPool.EMPTY_JSON;

    /**
     * placeholder 占位符{@link  StringPool#EMPTY_JSON}
     */
    protected String placeholder;

    /**
     * SinglePlaceholderStringTemplate 构造方法
     * @param placeholder  {@link String} 占位符
     * @param template   {@link String} 字符串模板
     * @param escapeChar 转义字符
     * @param defaultValue {@link String} 默认值
     * @param defaultValueHandler {@link UnaryOperator<String>} 默认值处理器
     * @param features    策略值
     * @author LiuQi
     */
    protected SinglePlaceholderStringTemplate(final String placeholder, final String template, final char escapeChar, final String defaultValue, final UnaryOperator<String> defaultValueHandler, final int features) {
        // 调用{@code StringTemplate(template, escapeChar, defaultValue, defaultValueHandler, features)} 构造方法
        super(template, escapeChar, defaultValue, defaultValueHandler, features);
        // 设置占位符
        this.placeholder = placeholder;
        // TODO  Segment列表 initialize
    }

    /**
     * builder 构建器
     *
     * @param template {@link String} 字符串模板
     * @return {@link Builder} 返回 Builder构建器对象
     * @author LiuQi
     */
    public static Builder builder(final String template) {
        // 返回 创建Builder 构建器对象
        return new Builder(template);
    }

    /**
     * Builder 构建器
     *
     * @author LiuQi
     * @ClassName Builder
     * @Description Builder 构建器 用于构建 SinglePlaceholderStringTemplate 对象
     */
    public static class Builder extends AbstractBuilder<Builder, SinglePlaceholderStringTemplate> {
        /**
         * placeholder 占位符
         */
        protected String placeholder;

        /**
         * Builder 构造方法
         *
         * @param template {@link String} 字符串模板
         * @author LiuQi
         */
        public Builder(final String template) {
            // 调用 {@code AbstractBuilder(template)}构造方法
            super(template);
        }

        @Override
        protected SinglePlaceholderStringTemplate buildInstance() {
            // 如果占位符为空，则使用默认占位符
            if (placeholder == null) this.placeholder = DEFAULT_PLACEHOLDER;
            // 返回 SinglePlaceholderStringTemplate 对象
            return new SinglePlaceholderStringTemplate(placeholder, template, escapeChar, defaultValue, defaultValueHandler, features);
        }

        /**
         * placeholder 设置占位符
         *
         * @param placeholder {@link String} 占位符
         * @return {@link Builder} Builder构建器对象
         * @author LiuQi
         */
        public Builder placeholder(final String placeholder) {
            // 设置占位符
            this.placeholder = placeholder;
            // 返回当前 Builder构建器对象
            return this;
        }
    }
}
