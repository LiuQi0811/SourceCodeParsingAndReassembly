package org.chino.SharpBladeUtils.core.text.placeholder;

import org.chino.SharpBladeUtils.core.lang.Assert;
import org.chino.SharpBladeUtils.core.text.CharPool;
import org.chino.SharpBladeUtils.core.text.StringUtil;
import org.chino.SharpBladeUtils.core.text.placeholder.segment.AbstractPlaceholderSegment;
import org.chino.SharpBladeUtils.core.text.placeholder.segment.LiteralSegment;
import org.chino.SharpBladeUtils.core.text.placeholder.segment.StringTemplateSegment;
import org.chino.SharpBladeUtils.core.text.placeholder.template.SinglePlaceholderStringTemplate;

import java.util.*;
import java.util.function.Function;
import java.util.function.UnaryOperator;

import static org.chino.SharpBladeUtils.core.text.placeholder.StringTemplate.Feature.*;

/**
 * @ClassName StringTemplate
 * @Description StringTemplate 字符串模板
 * @Author LiuQi
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
    protected final char escapeChar;
    /**
     * defaultValue 默认值
     */
    protected final String defaultValue;
    /**
     * defaultValueHandler 默认值处理器
     */
    protected final UnaryOperator<String> defaultValueHandler;
    /**
     * features 策略值
     */
    private final int features;
    /**
     * segments 字符串模板片段集合 (所有固定文本和占位符)
     */
    protected List<StringTemplateSegment> segments;
    /**
     * placeholderSegments 占位符片段集合 (所有占位符)
     */
    protected List<AbstractPlaceholderSegment> placeholderSegments;
    /**
     * fixedTextTotalLength 固定文本总长度
     */
    protected int fixedTextTotalLength;


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
     * getFeatures 获取策略值
     *
     * @return 策略值
     * @author LiuQi
     */
    public int getFeatures() {
        // 返回策略值
        return features;
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
        // 调用 {@code formatBySegment} 方法 并传入一个函数式接口 返回下一个元素 或者 null
        return formatBySegment(segment -> { // 函数式接口 返回下一个元素 或者 null
            if (iterator.hasNext()) { // 如果迭代器对象中有下一个元素 则执行以下操作
                return iterator.next();
            } else {// 如果迭代器对象中没有下一个元素 则执行以下操作
                // 调用 {@code formatMissingKey} 并传入当前segment对象
                return formatMissingKey(segment);
            }
        });
    }

    /**
     * afterInitialize  initialization after
     *
     * @description 初始化后执行的操作
     * @author LiuQi
     */
    protected void afterInitialize() {
        // 创建 segments 列表对象
        this.segments = new ArrayList<>(parseSegments(template));
        //  计算 固定文本segment 的数量 和文本总长度
        int literalSegmentSize = 0, fixedTextTotalLen = 0;
        for (final StringTemplateSegment segment : this.segments) { // 遍历segments集合
            if (segment instanceof LiteralSegment) { // segment 是固定文本片段 则执行以下操作
                // ++literalSegmentSize 固定文本片段{} 数量自增
                ++literalSegmentSize;
                // fixedTextTotalLen 计算固定文本总长度 += 当前segment的文本长度
                fixedTextTotalLen += segment.getText().length();
            }
        }
        // 设置固定文本总长度
        this.fixedTextTotalLength = fixedTextTotalLen;
        // 计算 占位符片段数量 = segments集合大小 - 固定文本片段{}的数量
        final int placeholderSegmentsSize = segments.size() - literalSegmentSize;
        if (placeholderSegmentsSize == 0) { // 占位符片段数量为0 则执行以下操作
            // 设置 placeholderSegments占位符片段集合为空列表对象
            this.placeholderSegments = Collections.emptyList();
        } else {
            // 创建 placeholderSegments占位符片段集合对象 并初始化大小 = 占位符片段数量
            List<AbstractPlaceholderSegment> placeholderSegments = new ArrayList<>(placeholderSegmentsSize);
            for (final StringTemplateSegment segment : segments) { // 遍历segments集合
                if (segment instanceof AbstractPlaceholderSegment) { // segment 是占位符片段 则执行以下操作
                    // 将 占位符片段对象 添加到 placeholderSegments占位符片段集合中
                    placeholderSegments.add((AbstractPlaceholderSegment) segment);
                }
            }
            // 设置 placeholderSegments占位符片段集合 = 遍历segments集合 并过滤出占位符片段
            this.placeholderSegments = placeholderSegments;
        }
    }

    /**
     * parseSegments 解析字符串模板片段
     *
     * @param template {@link String} 字符串模板
     * @return {@link List<StringTemplateSegment>} 字符串模板片段集合
     * @description 将 模板 解析为 Segment 列表  - 字符串模板片段
     * @author LiuQi
     */
    protected abstract List<StringTemplateSegment> parseSegments(String template);

    /**
     * formatBySegment 格式化片段
     *
     * @param valueSupplier {@link Function<AbstractPlaceholderSegment>} 占位符片段对应的值提供者
     *                      根据 占位符 返回 需要序列化的值，如果返回值不是 {@link String}，则使用 {@link org.chino.SharpBladeUtils.core.text.StringUtil#utf8Str(Object)}
     *                      方法转为字符串
     * @return {@link String} 格式化后的字符串模板片段
     * @description <pre>
     *     1.根据 策略 和 默认值 处理需要序列化的值, 生成格式化字符串
     *     2.依次遍历模板中的 占位符，根据 占位符 返回 需要序列化的值
     * </pre>
     * @author LiuQi
     */
    protected String formatBySegment(final Function<AbstractPlaceholderSegment, ?> valueSupplier) {
        // 调用 {@code formatRawBySegment(final Function<AbstractPlaceholderSegment, String> valueSupplier)} 方法 并传入 valueSupplier 占位符片段对应的值提供者
        return formatRawBySegment(segment -> {
            // 如果 valueSupplier 占位符片段对应的值提供者 为空 则返回 "null"
            Object result = valueSupplier.apply(segment);
            if (result != null) { // 如果 valueSupplier 占位符片段对应的值提供者 的结果不为空 则执行以下操作
                // 返回 valueSupplier 占位符片段对应的值提供者 的结果 使用 StringUtil.utf8Str 方法转为字符串
                return StringUtil.utf8Str(result);
            } else { // 如果 valueSupplier 占位符片段对应的值提供者 为空 则执行以下操作
                // 调用 {@code formatNullValue(final AbstractPlaceholderSegment segment)} 方法 并传入当前遍历的占位符片段对象
                return formatNullValue(segment);
            }
        });
    }

    /**
     * formatRawBySegment 格式化原始片段
     *
     * @param valueSupplier valueSupplier {@link Function<AbstractPlaceholderSegment>} 占位符片段对应的值提供者
     * @return {@link String} 格式化后的字符串模板片段
     * @description 根据原始数据 生成格式化字符串
     * @author LiuQi
     */
    public String formatRawBySegment(final Function<AbstractPlaceholderSegment, String> valueSupplier) {
        // 创建 结果字符串集合对象 并初始化大小 = 占位符片段数量
        final List<String> result = new ArrayList<>(placeholderSegments.size());
        // totalTextLen 计算固定文本 + 需要格式化的参数的字符串 的总字符数量 (字符串长度)
        int totalTextLen = this.fixedTextTotalLength;
        String valueStr;
        for (final AbstractPlaceholderSegment placeholderSegment : placeholderSegments) { // 遍历占位符片段集合
            //  valueStr 占位符片段对应的值 提供者 根据 valueSupplier 执行 apply 方法 并传入当前遍历的占位符片段对象
            valueStr = valueSupplier.apply(placeholderSegment);
            // 如果 valueStr 为空 则设置为 "null"
            if (valueStr == null) valueStr = "null";
            // totalTextLen 计算固定文本 + 需要格式化的参数的字符串 的总字符数量 (字符串长度) += 当前占位符片段对应的值 提供者 的结果
            totalTextLen += valueStr.length();
            // 将占位符片段对应的值 提供者的结果 添加到结果字符串集合中
            result.add(valueStr);
        }
        // index 索引
        int index = 0;
        // 创建StringBuilder对象 并初始化大小 = 固定文本 + 需要格式化的参数的字符串 的总字符数量 (字符串长度)
        final StringBuilder resultBuilder = new StringBuilder(totalTextLen);
        for (final StringTemplateSegment segment : segments) { // 遍历segments集合
            if (segment instanceof LiteralSegment) { // 如果是固定文本片段 则执行以下操作
                //  resultBuilder 添加 当前遍历的固定文本片段对象 的文本内容
                resultBuilder.append(segment.getText());
            } else {
                // 替换占位符片段对应的值 提供者的结果  example: this is {} for {} -> this is A for A
                resultBuilder.append(result.get(index++));
            }
        }
        // 返回结果字符串集合对象 toString 方法的结果 即格式化后的字符串模板片段
        return resultBuilder.toString();
    }

    /**
     * formatMissingKey 格式化缺失键
     *
     * @param placeholderSegment {@link AbstractPlaceholderSegment} 占位符片段对象
     * @return {@link String} 找不到占位符的字符串默认值
     * @description 根据策略 返回格式化参数中 找不到占位符时的默认值
     * @author LiuQi
     */
    protected String formatMissingKey(final AbstractPlaceholderSegment placeholderSegment) {
        // features 策略值
        final int features = getFeatures();
        if (FORMAT_MISSING_KEY_PRINT_WHOLE_PLACEHOLDER.contains(features)) { // 如果策略值包含 FORMAT_MISSING_KEY_PRINT_WHOLE_PLACEHOLDER 则执行以下操作
            // 返回占位符片段对象 的文本内容 - 即找不到占位符的字符串默认值
            return placeholderSegment.getText();
        } else if (FORMAT_MISSING_KEY_PRINT_DEFAULT_VALUE.contains(features)) { // 如果策略值包含 FORMAT_MISSING_KEY_PRINT_DEFAULT_VALUE 则执行以下操作
            System.out.println("FORMAT_MISSING_KEY_PRINT_DEFAULT_VALUE 策略 未实现");
        } else if (FORMAT_MISSING_KEY_PRINT_NULL.contains(features)) { // 如果策略值包含 FORMAT_MISSING_KEY_PRINT_NULL 则执行以下操作
            System.out.println("FORMAT_MISSING_KEY_PRINT_NULL 策略 未实现");
        } else if (FORMAT_MISSING_KEY_PRINT_EMPTY.contains(features)) { // 如果策略值包含 FORMAT_MISSING_KEY_PRINT_EMPTY 则执行以下操作
            System.out.println("FORMAT_MISSING_KEY_PRINT_EMPTY 策略 未实现");
        } else if (FORMAT_MISSING_KEY_PRINT_VARIABLE_NAME.contains(features)) { // 如果策略值包含 FORMAT_MISSING_KEY_PRINT_VARIABLE_NAME 则执行以下操作
            System.out.println("FORMAT_MISSING_KEY_PRINT_VARIABLE_NAME 策略 未实现");
        } else if (FORMAT_MISSING_KEY_THROWS.contains(features)) { // 如果策略值包含 FORMAT_MISSING_KEY_THROWS 则执行以下操作
            System.out.println("FORMAT_MISSING_KEY_THROWS 策略 未实现");
        }
        // TODO  异常处理 未实现
        return null;
    }

    /**
     * formatNullValue 格式化空值
     *
     * @param placeholderSegment {@link AbstractPlaceholderSegment} 占位符片段对象
     * @return {@link String} 占位符对应的值为 {@code null} 时的返回值
     * @description 根据策略 返回占位符对应的值为 {@code null} 时的返回值
     * @author LiuQi
     */
    public String formatNullValue(final AbstractPlaceholderSegment placeholderSegment) {
        // features 策略值
        int features = getFeatures();
        if (FORMAT_NULL_VALUE_TO_STR.contains(features)) { // 如果策略值包含 FORMAT_NULL_VALUE_TO_STR 则执行以下操作
            System.out.println(" FORMAT_NULL_VALUE_TO_STR 策略 未实现");
        } else if (FORMAT_NULL_VALUE_TO_EMPTY.contains(features)) { // 如果策略值包含 FORMAT_NULL_VALUE_TO_EMPTY 则执行以下操作
            System.out.println(" FORMAT_NULL_VALUE_TO_EMPTY 策略 未实现");
        } else if (FORMAT_NULL_VALUE_TO_WHOLE_PLACEHOLDER.contains(features)) { // 如果策略值包含 FORMAT_NULL_VALUE_TO_WHOLE_PLACEHOLDER 则执行以下操作
            System.out.println(" FORMAT_NULL_VALUE_TO_WHOLE_PLACEHOLDER 策略 未实现");
        } else if (FORMAT_NULL_VALUE_TO_DEFAULT_VALUE.contains(features)) { // 如果策略值包含 FORMAT_NULL_VALUE_TO_DEFAULT_VALUE 则执行以下操作
            System.out.println(" FORMAT_NULL_VALUE_TO_DEFAULT_VALUE 策略 未实现");
        }
        // TODO  异常处理 未实现
        return "null";
    }

    /**
     * addLiteralSegment 添加文本片段
     *
     * @param lastLiteralSegmentText 上一个新增的segment是否是固定文本
     * @param segments               segments {@link List<StringTemplateSegment>}字符串模板片段集合
     * @param newText                {@link String}  新的固定文本
     * @description 添加 固定文本segment，过滤空字符串 并合并相邻的固定文本
     * @author LiuQi
     */
    protected void addLiteralSegment(final boolean lastLiteralSegmentText, final List<StringTemplateSegment> segments, final String newText) {
        // 新增固定文本片段为空 则直接返回
        if (newText.isEmpty()) return;
        if (lastLiteralSegmentText) { // 如果上一个新增的segment是固定文本 则合并
            // 获取最后一个固定文本片段的索引位置
            final int lastIdx = segments.size() - 1;
            // 获取最后一个固定文本片段对象 并合并 新增的固定文本
            final StringTemplateSegment lastLiteralSegment = segments.get(lastIdx);
            // 合并 新增的固定文本 到最后一个固定文本片段对象中
            segments.set(lastIdx, new LiteralSegment(lastLiteralSegment.getText() + newText));
        } else {
            // 如果上一个新增的segment不是固定文本 则直接添加
            segments.add(new LiteralSegment(newText));
        }
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
         * FORMAT_MISSING_KEY_PRINT_DEFAULT_VALUE 缺失键时打印默认值
         */
        FORMAT_MISSING_KEY_PRINT_DEFAULT_VALUE(1, 0, 6),
        /**
         * FORMAT_MISSING_KEY_PRINT_NULL 缺失键时打印 null
         */
        FORMAT_MISSING_KEY_PRINT_NULL(2, 0, 6),
        /**
         * FORMAT_MISSING_KEY_PRINT_EMPTY 缺失键时打印空字符串
         */
        FORMAT_MISSING_KEY_PRINT_EMPTY(3, 0, 6),
        /**
         * FORMAT_MISSING_KEY_PRINT_VARIABLE_NAME 缺失键时打印变量名
         */
        FORMAT_MISSING_KEY_PRINT_VARIABLE_NAME(4, 0, 6),
        /**
         * FORMAT_MISSING_KEY_THROWS 缺失键时抛出异常
         */
        FORMAT_MISSING_KEY_THROWS(5, 0, 6),
        /**
         * FORMAT_NULL_VALUE_TO_STR 空值转为字符串 "null"
         */
        FORMAT_NULL_VALUE_TO_STR(6, 6, 4),
        /**
         * FORMAT_NULL_VALUE_TO_EMPTY 空值转为空字符串 ""
         */
        FORMAT_NULL_VALUE_TO_EMPTY(7, 6, 4),
        /**
         * FORMAT_NULL_VALUE_TO_WHOLE_PLACEHOLDER 空值转为整个占位符
         */
        FORMAT_NULL_VALUE_TO_WHOLE_PLACEHOLDER(8, 6, 4),
        /**
         * FORMAT_NULL_VALUE_TO_DEFAULT_VALUE 空值转为默认值
         */
        FORMAT_NULL_VALUE_TO_DEFAULT_VALUE(9, 6, 4),
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

        /**
         * contains 判断策略值是否包含当前枚举值的掩码值
         *
         * @param features 策略值
         * @return 返回 true 或 false
         * @author LiuQi
         */
        public boolean contains(final int features) {
            // 返回 true 或 false，判断策略值是否包含当前枚举值的掩码值
            return (features & mask) != 0;
        }
    }
}
