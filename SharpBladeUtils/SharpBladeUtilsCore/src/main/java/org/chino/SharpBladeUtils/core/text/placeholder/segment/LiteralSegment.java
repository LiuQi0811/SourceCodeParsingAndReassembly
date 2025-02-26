package org.chino.SharpBladeUtils.core.text.placeholder.segment;

/**
 * @ClassName LiteralSegment
 * @Description LiteralSegment 字符串模板-固定文本 Segment
 * @Author LiuQi
 * @Date 2025/2/26 17:56
 * @Version 1.0
 */
public class LiteralSegment implements StringTemplateSegment {
    /**
     * text 模板中固定的一段文本
     */
    private final String text;

    /**
     * LiteralSegment 构造方法
     *
     * @param text {@link String} 占位符字符串
     * @author LiuQi
     */
    public LiteralSegment(final String text) {
        // 设置模板中固定的一段文本
        this.text = text;
    }

    @Override
    public String getText() {
        // 返回模板中固定的一段文本
        return text;
    }
}
