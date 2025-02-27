package org.chino.SharpBladeUtils.core.text.placeholder.template;

import org.chino.SharpBladeUtils.core.text.StringPool;
import org.chino.SharpBladeUtils.core.text.placeholder.StringTemplate;
import org.chino.SharpBladeUtils.core.text.placeholder.segment.LiteralSegment;
import org.chino.SharpBladeUtils.core.text.placeholder.segment.SinglePlaceholderSegment;
import org.chino.SharpBladeUtils.core.text.placeholder.segment.StringTemplateSegment;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.List;
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
     *
     * @param placeholder         {@link String} 占位符
     * @param template            {@link String} 字符串模板
     * @param escapeChar          转义字符
     * @param defaultValue        {@link String} 默认值
     * @param defaultValueHandler {@link UnaryOperator<String>} 默认值处理器
     * @param features            策略值
     * @author LiuQi
     */
    protected SinglePlaceholderStringTemplate(final String placeholder, final String template, final char escapeChar, final String defaultValue, final UnaryOperator<String> defaultValueHandler, final int features) {
        // 调用{@code StringTemplate(template, escapeChar, defaultValue, defaultValueHandler, features)} 构造方法
        super(template, escapeChar, defaultValue, defaultValueHandler, features);
        // 设置占位符
        this.placeholder = placeholder;
        // {@code afterInitialize()} Segment列表 initialize
        afterInitialize();
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
     * format 字符串格式化
     *
     * @param params {@link Object[]} 参数数组
     * @return {@link String} 格式化后的字符串
     * @author LiuQi
     */
    public String format(final Object... params) {
        // 调用 {@code formatArray(params)} 方法格式化参数数组 返回格式化后的字符串
        return formatArray(params);
    }

    /**
     * formatArray 字符串格式化数组
     *
     * @param array {@link Object[]} 参数数组
     * @return {@link String} 格式化后的字符串
     * @author LiuQi
     */
    public String formatArray(final Object[] array) {
        // 如果参数数组为空，则返回模板字符串
        if (array == null) return getTemplate();
        // 调用 {@code formatArray(params)} 方法格式化参数数组 返回格式化后的字符串
        return format(Arrays.asList(array));
    }

    /**
     * format 字符串格式化
     *
     * @param iterable {@link Iterable<?>} 可迭代对象
     * @return {@link String} 格式化后的字符串
     * @author LiuQi
     */
    public String format(final Iterable<?> iterable) {
        // 调用 {@code formatSequence(iterable)} 方法格式化可迭代对象 返回格式化后的字符串
        return super.formatSequence(iterable);
    }

    @Override
    protected List<StringTemplateSegment> parseSegments(final String template) {
        // placeholderLen 获取占位符长度
        final int placeholderLen = placeholder.length();
        // strPatternLen 字符串匹配长度
        final int strPatternLen = template.length();
        // handlerPosition 处理位置
        int handlerPosition = 0;
        // delimiterIndex 分隔占位符索引
        int delimiterIndex = 0;
        // lastLiteralSegmentText  上一个解析的segment是否是固定文本，如果是，则需要和当前新的文本部分合并
        boolean lastLiteralSegmentText = false;
        // 创建 SinglePlaceholderSegment 对象
        SinglePlaceholderSegment singlePlaceholderSegment = SinglePlaceholderSegment.of(placeholder);
        // 创建 Segment列表
        List<StringTemplateSegment> segmentList = null;
        while (true) { // 循环处理模板字符串
            // 计算下一个分隔符的位置
            delimiterIndex = template.indexOf(placeholder, handlerPosition);
            if (delimiterIndex == -1) {
                // 整个模板字符串都不包含占位符，则直接返回一个 LiteralSegment列表 对象
                if (handlerPosition == 0) return Collections.singletonList(new LiteralSegment(template));
                // 字符串模板剩余部分不再包含占位符，添加到LiteralSegment列表 对象
                if (handlerPosition < strPatternLen)
                    addLiteralSegment(lastLiteralSegmentText, segmentList, template.substring(handlerPosition));
                // 返回 Segment列表 对象
                return segmentList;
            } else if (segmentList == null) {
                // segmentList 实例化 Segment列表
                segmentList = new ArrayList<>();
            }
            if (delimiterIndex > 0 && template.charAt(delimiterIndex - 1) == escapeChar) { //  如果分隔符的前一个字符是转义字符，则忽略当前占位符
                if (delimiterIndex > 1 && template.charAt(delimiterIndex - 2) == escapeChar) { // 双转义字符
                    // addLiteralSegment 添加文本片段
                    addLiteralSegment(lastLiteralSegmentText, segmentList, template.substring(handlerPosition - 1));  // singlePlaceholderSegment 添加占位符片段
                    // singlePlaceholderSegment 添加占位符片段
                    segmentList.add(singlePlaceholderSegment);
                    // lastLiteralSegmentText 设置上一个解析的segment非固定文本
                    lastLiteralSegmentText = false;
                    // 更新 handlerPosition 处理位置
                    handlerPosition = delimiterIndex + placeholderLen;
                } else { // 占位符被转义
                    // addLiteralSegment 添加文本片段
                    addLiteralSegment(lastLiteralSegmentText, segments, template.substring(handlerPosition, delimiterIndex - 1) + placeholder.charAt(0));
                    // lastLiteralSegmentText 设置上一个解析的segment固定文本
                    lastLiteralSegmentText = true;
                    // 更新 handlerPosition 处理位置
                    handlerPosition = delimiterIndex + 1;
                }
            } else { // 正常占位符
                // addLiteralSegment 添加文本片段
                addLiteralSegment(lastLiteralSegmentText, segmentList, template.substring(handlerPosition, delimiterIndex));
                // singlePlaceholderSegment 添加占位符片段
                segmentList.add(singlePlaceholderSegment);
                // lastLiteralSegmentText 设置上一个解析的segment非固定文本
                lastLiteralSegmentText = false;
                // 更新 handlerPosition 处理位置
                handlerPosition = delimiterIndex + placeholderLen;
            }
        }
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
