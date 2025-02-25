package org.chino.SharpBladeUtils.core.text.placeholder.template;

import org.chino.SharpBladeUtils.core.text.placeholder.StringTemplate;

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
