package org.chino.SharpBladeUtils.core.text.placeholder;

import org.chino.SharpBladeUtils.core.text.placeholder.template.SinglePlaceholderStringTemplate;

/**
 * @ClassName StringTemplate
 * @Description StringTemplate 字符串模板
 * @Author LiuQi
 * @Date 2025/2/24 14:59
 * @Version 1.0
 */
public abstract class StringTemplate {

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
     * @param <BuilderChild>  BuilderChild 构建器子类类型
     * @param <TemplateChild> TemplateChild 模板子类类型
     * @ClassName AbstractBuilder
     * @Description AbstractBuilder 抽象构建器
     * @Author LiuQi
     */
    protected static abstract class AbstractBuilder<BuilderChild extends AbstractBuilder<BuilderChild, TemplateChild>, TemplateChild extends StringTemplate> {

        /**
         * AbstractBuilder 构造方法
         *
         * @param template {@link String} 字符串模板
         * @author LiuQi
         */
        protected AbstractBuilder(final String template) {
            System.out.println("AbstractBuilder 执行啦 " + template);
        }
    }
}
