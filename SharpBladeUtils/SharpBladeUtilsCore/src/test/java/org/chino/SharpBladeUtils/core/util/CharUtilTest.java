package org.chino.SharpBladeUtils.core.util;

import org.chino.SharpBladeUtils.core.text.CharUtil;
import org.junit.jupiter.api.Assertions;
import org.junit.jupiter.api.Test;

/**
 * @ClassName CharUtilTest
 * @Description CharUtilTest {@link CharUtil}字符处理工具单元测试类
 * @Author LiuQi
 */
public class CharUtilTest {

    /**
     * trimTest 去除字符串首尾空白字符测试
     *
     * @author LiuQi
     */
    @Test
    public void trimTest() {
        // 此字符串中的第一个字符为不可见字符: '\u202a'
        final String str = "‪/Users/liuqi/Desktop/chino.txt";
        // 断言第一个字符为不可见字符
        Assertions.assertEquals('\u202a', str.charAt(0)); // 输出true
        Assertions.assertTrue(CharUtil.isBlankChar(str.charAt(0))); // 输出true
    }

    /**
     * isEmojiTest 是否为表情符号测试
     *
     * @author LiuQi
     */
    @Test
    public void isEmojiTest() {
        final String str = " 😀奇诺 ";
        Assertions.assertFalse(CharUtil.isEmoji(str.charAt(0))); // 输出false
        Assertions.assertTrue(CharUtil.isEmoji(str.charAt(1))); // 输出true
    }

    /**
     * isCharTest 是否为字符测试
     *
     * @author LiuQi
     */
    @Test
    public void isCharTest() {
        final char c = 'x';
        Assertions.assertTrue(CharUtil.isChar(c)); // 输出true
    }

    /**
     * isBlankCharTest 是否为空白字符测试
     *
     * @author LiuQi
     */
    @SuppressWarnings("UnnecessaryUnicodeEscape")
    @Test
    public void isBlankCharTest() {
        Assertions.assertTrue(CharUtil.isBlankChar('\u00A0')); // 输出true
        Assertions.assertTrue(CharUtil.isBlankChar('\u0020')); // 输出true
        Assertions.assertTrue(CharUtil.isBlankChar('\u3000')); // 输出true
        Assertions.assertTrue(CharUtil.isBlankChar('\u0000')); // 输出true
    }

    /**
     * toCloseCharTest 转为闭合字符，将字母、数字转换为带圈的字符测试
     *
     * @author LiuQi
     */
    @Test
    public void toCloseCharTest() {
        Assertions.assertEquals('ⓑ', CharUtil.toCloseChar('b')); // 输出true
        Assertions.assertEquals('Ⓩ', CharUtil.toCloseChar('Z')); // 输出true
        Assertions.assertEquals('⑧', CharUtil.toCloseChar('8')); // 输出true
    }

    /**
     * toCloseByNumberTest 根据数字转为闭合字符测试
     *
     * @author LiuQi
     */
    @Test
    public void toCloseByNumberTest() {
        Assertions.assertEquals('①', CharUtil.toCloseByNumber(1)); // 输出true
        Assertions.assertEquals('②', CharUtil.toCloseByNumber(2)); // 输出true
        Assertions.assertEquals('⑱', CharUtil.toCloseByNumber(18)); // 输出true
    }

    /**
     * issueI5UGSQTest 解决issue I5UGSQ测试
     *
     * @author LiuQi
     */
    @SuppressWarnings("UnnecessaryUnicodeEscape")
    @Test
    public void issueI5UGSQTest() {
        char c = '\u3164';
        Assertions.assertTrue(CharUtil.isBlankChar(c)); // 输出true

        c = '\u2800';
        Assertions.assertTrue(CharUtil.isBlankChar(c)); // 输出true
    }

    /**
     * isASCIITest 是否为ASCII字符测试
     *
     * @author LiuQi
     */
    @Test
    public void isASCIITest() {
        Assertions.assertTrue(CharUtil.isASCII('a')); // 输出true
        Assertions.assertFalse(CharUtil.isASCII('\u3164')); // 输出false
        Assertions.assertFalse(CharUtil.isASCIIPrintable('€')); // 输出false
        Assertions.assertFalse(CharUtil.isASCIIControl('€')); // 输出false
        Assertions.assertFalse(CharUtil.isASCII('€')); // 输出false
    }

    /**
     * isLetterTest 是否为字母测试
     *
     * @author LiuQi
     */
    @Test
    public void isLetterTest() {
        Assertions.assertFalse(CharUtil.isLetter('€')); // 输出false
        Assertions.assertTrue(CharUtil.isLetter('A')); // 输出true
        Assertions.assertTrue(CharUtil.isLetter('m')); // 输出true
    }

    /**
     * isNumberTest 是否为数字测试
     *
     * @author LiuQi
     */
    @Test
    public void isNumberTest() {
        Assertions.assertFalse(CharUtil.isNumber('€')); // 输出false
        Assertions.assertTrue(CharUtil.isNumber('1')); // 输出true
        Assertions.assertTrue(CharUtil.isNumber('6')); // 输出true
    }

    /**
     * isHexCharTest 是否为十六进制字符测试
     *
     * @author LiuQi
     */
    @Test
    public void isHexCharTest() {
        Assertions.assertTrue(CharUtil.isHexChar('a')); // 输出true
        Assertions.assertTrue(CharUtil.isHexChar('b')); // 输出true
        Assertions.assertFalse(CharUtil.isHexChar('z')); // 输出false
        Assertions.assertTrue(CharUtil.isHexChar('1')); // 输出true
        Assertions.assertFalse(CharUtil.isHexChar('-')); // 输出false
    }

    /**
     * isLetterOrNumberTest 是否为字母或数字测试
     *
     * @author LiuQi
     */
    @Test
    public void isLetterOrNumberTest() {
        Assertions.assertTrue(CharUtil.isLetterOrNumber('a')); // 输出true
        Assertions.assertTrue(CharUtil.isLetterOrNumber('N')); // 输出true
        Assertions.assertTrue(CharUtil.isLetterOrNumber('M')); // 输出true
        Assertions.assertTrue(CharUtil.isLetterOrNumber('1')); // 输出true
        Assertions.assertFalse(CharUtil.isLetterOrNumber('-')); // 输出false
    }

    /**
     * isCharClassTest 给定类名是否为字符类测试
     *
     * @author LiuQi
     */
    @Test
    public void isCharClassTest() {
        Assertions.assertFalse(CharUtil.isCharClass(String.class)); // 输出false
        Assertions.assertTrue(CharUtil.isCharClass(Character.class)); // 输出true
        Assertions.assertTrue(CharUtil.isCharClass(char.class)); // 输出true
        Assertions.assertTrue(CharUtil.isCharClass(((Character) 'A').getClass())); // 输出true
    }

    /**
     * isFileSeparatorTest 是否为文件分隔符测试
     *
     * @author LiuQi
     */
    @Test
    public void isFileSeparatorTest() {
        Assertions.assertTrue(CharUtil.isFileSeparator('\\')); // 输出true (Windows文件分隔符)
        Assertions.assertTrue(CharUtil.isFileSeparator('/')); // 输出true (Unix/Linux/Mac文件分隔符)
    }

    /**
     * isZeroWidthCharTest 是否为零宽字符测试
     *
     * @author LiuQi
     */
    @Test
    public void isZeroWidthCharTest() {
        Assertions.assertTrue(CharUtil.isZeroWidthChar('\u200B')); // 输出true
        Assertions.assertTrue(CharUtil.isZeroWidthChar('\u200C')); // 输出true
        Assertions.assertTrue(CharUtil.isZeroWidthChar('\u200D')); // 输出true
        Assertions.assertFalse(CharUtil.isZeroWidthChar('\u200E')); // 输出false
    }

    /**
     * getTypeTest 获取字符类型测试
     *
     * @author LiuQi
     */
    @Test
    public void getTypeTest() {
        Assertions.assertEquals(1, CharUtil.getType('A')); // 输出true
        Assertions.assertEquals(9, CharUtil.getType('9')); // 输出true
        Assertions.assertEquals(1, CharUtil.getType('B')); // 输出true
    }

    /**
     * digit16Test 十六进制数字测试
     *
     * @author LiuQi
     */
    @Test
    public void digit16Test() {
        Assertions.assertEquals(10, CharUtil.digit16('A')); // 输出true
        Assertions.assertEquals(11, CharUtil.digit16('B')); // 输出true
        Assertions.assertEquals(12, CharUtil.digit16('C')); // 输出true
        Assertions.assertEquals(-1, CharUtil.digit16('&')); // 输出true
    }

    /**
     * equalsTest 比较两个字符是否相等测试
     *
     * @author LiuQi
     */
    @Test
    public void equalsTest() {
        Assertions.assertTrue(CharUtil.equals('A', 'a', true)); // 输出true
        Assertions.assertFalse(CharUtil.equals('B', 'b', false)); // 输出false
        Assertions.assertTrue(CharUtil.equals('C', 'C', false)); // 输出true
    }

    /**
     * toStringTest 字符转字符串测试
     *
     * @author LiuQi
     */
    @Test
    public void toStringTest() {
        Assertions.assertEquals("™", CharUtil.toString('™')); // 输出"™"
        Assertions.assertEquals("65", CharUtil.toString('A')); // 输出65
        Assertions.assertEquals("67", CharUtil.toString('C')); // 输出67
    }
}
