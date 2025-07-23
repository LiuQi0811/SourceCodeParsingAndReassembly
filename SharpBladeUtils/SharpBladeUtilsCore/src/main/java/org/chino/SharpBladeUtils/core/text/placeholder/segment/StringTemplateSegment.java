package org.chino.SharpBladeUtils.core.text.placeholder.segment;

/**
 * @ClassName StringTemplateSegment
 * @Description StringTemplateSegment 字符串模板片段接口
 * @Author LiuQi
 */
public interface StringTemplateSegment {

    /**
     * getText  获取片段文本
     *
     * @return {@link String}  返回片段文本
     * @description 对于固定文本Segment，返回文本值；对于单占位符Segment，返回占位符；对于有前后缀的占位符Segment，返回占位符完整文本，例如: "{name}"
     * @author LiuQi
     */
    String getText();
}
