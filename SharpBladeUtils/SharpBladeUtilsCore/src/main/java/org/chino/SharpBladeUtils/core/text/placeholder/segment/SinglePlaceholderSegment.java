package org.chino.SharpBladeUtils.core.text.placeholder.segment;

/**
 * @ClassName SinglePlaceholderSegment
 * @Description SinglePlaceholderSegment 字符串模板-单变量占位符 Segment
 * @Author LiuQi
 * @Date 2025/2/26 17:29
 * @Version 1.0
 */
public class SinglePlaceholderSegment extends AbstractPlaceholderSegment {

    /**
     * SinglePlaceholderSegment 构造方法
     *
     * @param placeholder {@link String} 占位符字符串
     * @author LiuQi
     */
    public SinglePlaceholderSegment(final String placeholder) {
        // 调用 {@code AbstractPlaceholderSegment#AbstractPlaceholderSegment(String)} 构造方法
        super(placeholder);
    }

    /**
     * of  创建SinglePlaceholderSegment 对象
     *
     * @param placeholder {@link String} 占位符字符串
     * @return {@link SinglePlaceholderSegment} SinglePlaceholderSegment 字符串模板-单变量占位符 Segment对象
     * @author LiuQi
     */
    public static SinglePlaceholderSegment of(final String placeholder) {
        // 创建SinglePlaceholderSegment对象并返回
        return new SinglePlaceholderSegment(placeholder);
    }
}
