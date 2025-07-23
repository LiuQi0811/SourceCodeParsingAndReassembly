package org.chino.SharpBladeUtils.core.text.placeholder.segment;

/**
 * @ClassName AbstractPlaceholderSegment
 * @Description AbstractPlaceholderSegment 抽象占位符片段
 * @Author LiuQi
 */
public abstract class AbstractPlaceholderSegment implements StringTemplateSegment {

    /**
     * placeholder 占位符
     */
    private final String placeholder;

    /**
     * AbstractPlaceholderSegment 构造方法
     *
     * @param placeholder {@link String} 占位符字符串
     * @author LiuQi
     */
    public AbstractPlaceholderSegment(final String placeholder) {
        // 设置占位符
        this.placeholder = placeholder;
    }

    /**
     * getPlaceholder 获取占位符
     *
     * @return {@link String} 占位符字符串
     * @author LiuQi
     */
    public String getPlaceholder() {
        // 返回占位符字符串
        return placeholder;
    }

    @Override
    public String getText() {
        // 返回占位符字符串
        return placeholder;
    }
}
