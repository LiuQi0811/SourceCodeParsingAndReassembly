package org.chino.SharpBladeUtils.core.text;

/**
 * @ClassName CharUtil
 * @Description CharUtil 字符处理工具
 * @Author LiuQi
 * @Date 2025/2/17 14:57
 * @Version 1.0
 */
public class CharUtil implements CharPool {

    /**
     * isASCII 是否为ASCII字符
     *
     * @param char_ 被检查的字符
     * @return boolean 是否ASCII字符 true 是，false 否。
     * @description ASCII字符位于0~127之间。
     * <pre>
     *   CharUtil.isAscii('a')  = true
     *   CharUtil.isAscii('A')  = true
     *   CharUtil.isAscii('3')  = true
     *   CharUtil.isAscii('-')  = true
     *   CharUtil.isAscii('\n') = true
     *   CharUtil.isAscii('&copy;') = false
     * </pre>
     * <p>
     * @author LiuQi
     * @see <a href="https://baike.baidu.com/item/ASCII/309296#3">百度百科 ASCII</a>
     */
    public static boolean isASCII(final char char_) {
        // 返回 true 如果指定的字符位于 0 到 127 之间，否则返回 false。
        return char_ < 128;
    }

    /**
     * isASCIIPrintable 是否为可见ASCII字符
     *
     * @param char_ 被检查的字符
     * @return boolean 是否可见ASCII字符 true 是，false 否。
     * @description 可见字符位于32~126之间。
     * <pre>
     *   CharUtil.isAscii('a')  = true
     *   CharUtil.isAscii('A')  = true
     *   CharUtil.isAscii('3')  = true
     *   CharUtil.isAscii('-')  = true
     *   CharUtil.isAscii('\n') = true
     *   CharUtil.isAscii('&copy;') = false
     * </pre>
     * @author LiuQi
     * @see <a href="https://www.asciim.cn/">ASCII码</a>
     */
    public static boolean isASCIIPrintable(final char char_) {
        // 返回 true 如果指定的字符位于 32 到 126 之间，否则返回 false。
        return char_ >= 32 && char_ < 127;
    }

    /**
     * isASCIIControl 是否为ASCII控制字符
     *
     * @param char_ 被检查的字符
     * @return boolean 是否ASCII控制字符 true 是，false 否。
     * @description ASCII控制字符位于0~31之间，以及127。
     * <pre>
     *   CharUtil.isAscii('a')  = true
     *   CharUtil.isAscii('A')  = true
     *   CharUtil.isAscii('3')  = true
     *   CharUtil.isAscii('-')  = true
     *   CharUtil.isAscii('\n') = true
     *   CharUtil.isAscii('&copy;') = false
     * </pre>
     * @author LiuQi
     * @see <a href="https://www.asciim.cn/">ASCII码</a>
     */
    public static boolean isASCIIControl(final char char_) {
        // 返回 true 如果指定的字符是 ASCII 控制字符，否则返回 false。 ASCII 控制字符位于0~31之间，以及127。
        return char_ < 32 || char_ == 127;
    }

    /**
     * isLetter 是否为字母
     *
     * @param char_ 被检查的字符
     * @return boolean 是否字母 true 是，false 否。
     * @description 字母包括大写和小写。字母包括A~Z和a~z
     * <pre>
     *   CharUtil.isLetterUpper('a')  = false
     *   CharUtil.isLetterUpper('A')  = true
     *   CharUtil.isLetterUpper('3')  = false
     *   CharUtil.isLetterUpper('-')  = false
     *   CharUtil.isLetterUpper('\n') = false
     *   CharUtil.isLetterUpper('&copy;') = false
     * </pre>
     * @author LiuQi
     */
    public static boolean isLetter(final char char_) {
        // 返回 true 如果指定的字符是字母，否则返回 false。包括大写和小写。
        return isLetterUpper(char_) || isLetterLower(char_);
    }

    /**
     * isLetterUpper 是否为大写字母
     *
     * @param char_ 被检查的字符
     * @return boolean 是否大写字母 true 是，false 否。
     * @description 大写字母位于A~Z之间。
     * <pre>
     *   CharUtil.isLetterUpper('a')  = false
     *   CharUtil.isLetterUpper('A')  = true
     *   CharUtil.isLetterUpper('3')  = false
     *   CharUtil.isLetterUpper('-')  = false
     *   CharUtil.isLetterUpper('\n') = false
     *   CharUtil.isLetterUpper('&copy;') = false
     * </pre>
     * @author LiuQi
     */
    public static boolean isLetterUpper(final char char_) {
        // 返回 true 如果指定的字符是大写字母，否则返回 false。大写字母位于A~Z之间。
        return char_ >= 'A' && char_ <= 'Z';
    }

    /**
     * isLetterLower 是否为小写字母
     *
     * @param char_ 被检查的字符
     * @return boolean 是否小写字母 true 是，false 否。
     * @description 小写字母位于a~z之间。
     * <pre>
     *   CharUtil.isLetterLower('a')  = true
     *   CharUtil.isLetterLower('A')  = false
     *   CharUtil.isLetterLower('3')  = false
     *   CharUtil.isLetterLower('-')  = false
     *   CharUtil.isLetterLower('\n') = false
     *   CharUtil.isLetterLower('&copy;') = false
     * </pre>
     * @author LiuQi
     */
    public static boolean isLetterLower(final char char_) {
        // 返回 true 如果指定的字符是小写字母，否则返回 false。小写字母位于a~z之间。
        return char_ >= 'a' && char_ <= 'z';
    }

    /**
     * isNumber 是否为数字
     *
     * @param char_ 被检查的字符
     * @return boolean 是否数字 true 是，false 否。
     * @description 数字位于0~9之间。
     * <pre>
     *   CharUtil.isNumber('a')  = false
     *   CharUtil.isNumber('A')  = false
     *   CharUtil.isNumber('3')  = true
     *   CharUtil.isNumber('-')  = false
     *   CharUtil.isNumber('\n') = false
     * </pre>
     * @author LiuQi
     */
    public static boolean isNumber(final char char_) {
        // 返回 true 如果指定的字符是数字，否则返回 false。数字位于0~9之间。
        return char_ >= '0' && char_ <= '9';
    }

    /**
     * isHexChar 是否为十六进制数字
     *
     * @param char_ 被检查的字符
     * @return boolean 是否十六进制数字 true 是，false 否。
     * <pre>
     *   CharUtil.isHexChar('a')  = true
     *   CharUtil.isHexChar('A')  = true
     *   CharUtil.isHexChar('3')  = true
     *   CharUtil.isHexChar('-')  = false
     *   CharUtil.isHexChar('\n') = false
     * </pre>
     * @author LiuQi
     */
    public static boolean isHexChar(final char char_) {
        // 返回 true 如果指定的字符是十六进制数字，否则返回 false。十六进制数字位于0~9之间，以及A~F和a~f之间。
        return isNumber(char_) || (char_ >= 'A' && char_ <= 'F') || (char_ >= 'a' && char_ <= 'f');
    }

    /**
     * isLetterOrNumber 是否为字母或数字
     *
     * @param char_ 被检查的字符
     * @return boolean 是否字母或数字 true 是，false 否。
     * @description 字母包括大写和小写。数字位于0~9之间。
     * <pre>
     *     CharUtil.isLetterOrNumber('a')  = true
     *     CharUtil.isLetterOrNumber('A')  = true
     *     CharUtil.isLetterOrNumber('3')  = true
     *     CharUtil.isLetterOrNumber('-')  = false
     * </pre>
     * @author LiuQi
     */
    public static boolean isLetterOrNumber(final char char_) {
        // 返回 true 如果指定的字符是字母或数字，否则返回 false。包括大写和小写。
        return isNumber(char_) || isLetter(char_);
    }

    /**
     * isCharClass 给定类名是否是字符类
     *
     * @param clazz {@link Class<?>}给定类名
     * @return boolean 是否字符类 true 是，false 否。
     * @description 字符类包括字母、数字、空白符等。
     * <pre>
     *     Character.class
     *     char.class
     *     CharUtil.isCharClass(String.class) = false
     *     CharUtil.isCharClass(char.class) = true
     *     CharUtil.isCharClass(Character.class) = true
     *     CharUtil.isCharClass(((Character) 'A').getClass()) = true
     * </pre>
     * @author LiuQi
     */
    public static boolean isCharClass(final Class<?> clazz) {
        // 返回 true 如果指定的类是字符类，否则返回 false。包括Character.class和char.class。
        return clazz == Character.class || clazz == char.class;
    }

    /**
     * isBlankChar 是否空白符
     *
     * @param char_ 字符
     * @return boolean 是否空白符 true 是，false 否。
     * @description 空白符包括空格、制表符、全角空格等。
     * @author LiuQi
     * @see Character#isWhitespace(int)
     * @see Character#isSpaceChar(int)
     */
    public static boolean isBlankChar(final char char_) {
        // 返回 true 如果指定的字符是空白符，否则返回 false。
        return isBlankChar((int) char_);
    }

    /**
     * isBlankChar 是否空白符
     *
     * @param char_ 字符
     * @return boolean 是否空白符 true 是，false 否。
     * @description 空白符包括空格、制表符、全角空格等。
     * @author LiuQi
     * @see Character#isWhitespace(int)
     * @see Character#isSpaceChar(int)
     */
    @SuppressWarnings(value = "UnnecessaryUnicodeEscape")
    public static boolean isBlankChar(final int char_) {
        // 返回 true 如果指定的字符是空白符，否则返回 false。
        return Character.isWhitespace(char_)
                || Character.isSpaceChar(char_)
                || char_ == '\ufeff'
                || char_ == '\u202a'
                || char_ == '\u0000'
                // issue#I5UGSQ，Hangul Filler
                || char_ == '\u3164'
                // Braille Pattern Blank
                || char_ == '\u2800'
                // MONGOLIAN VOWEL SEPARATOR
                || char_ == '\u180e';
    }

    /**
     * isEmoji 是否是表情符号
     *
     * @param char_ 字符
     * @return boolean 是否是表情符号 true 是，false 否。
     * @description 表情符号包括emoji表情等。
     * @author LiuQi
     */
    public static boolean isEmoji(final char char_) {
        // 返回 true 如果指定的字符是表情符号，否则返回 false。
        return !((char_ == 0x0) ||
                (char_ == 0x9) ||
                (char_ == 0xA) ||
                (char_ == 0xD) ||
                ((char_ >= 0x20) && (char_ <= 0xD7FF)) ||
                ((char_ >= 0xE000) && (char_ <= 0xFFFD)) ||
                ((char_ >= 0x100000) && (char_ <= 0x10FFFF)));
    }

    /**
     * isChar 是否是字符类型
     *
     * @param value 被检查的对象
     * @return 是否是字符类型 true 是，false 否。
     * @description 给定对象对应的类是否为字符类，字符类包括：
     * <pre>
     * Character.class
     * char.class
     * </pre>
     * @author LiuQi
     */
    public static boolean isChar(final Object value) {
        // 返回 true 如果 value 是 Character 类型或 char 基本数据类型的实例，否则返回 false。
        return value instanceof Character
                ||
                value.getClass().isInstance(char.class);
    }

    /**
     * toCloseChar 转为闭合字符
     *
     * @param char_ 被转换的字符，如果字符不支持转换，返回原字符。
     * @return char 转换后的闭合字符。
     * @description 将字母、数字转换为带圈的字符。
     * <pre>
     *     '1' -》 '①'
     *     'A' -》 'Ⓐ'
     *     'a' -》 'ⓐ'
     * </pre>
     * <p>
     * 获取带圈数字 /封闭式字母数字 ，从1-20,超过1-20报错
     * @author LiuQi
     * @see <a href="https://en.wikipedia.org/wiki/List_of_Unicode_characters#Unicode_symbols">Unicode_symbols</a>
     * @see <a href="https://en.wikipedia.org/wiki/Enclosed_Alphanumerics">Alphanumerics</a>
     */
    public static char toCloseChar(final char char_) {
        // 默认返回原字符
        int result = char_;
        if (char_ >= '1' && char_ <= '9') { // 数字 1-9 (闭合数字)
            result = '①' + char_ - '1';
        } else if (char_ >= 'A' && char_ <= 'Z') { // 大写字母 A-Z (闭合字母)
            result = 'Ⓐ' + char_ - 'A';
        } else if (char_ >= 'a' && char_ <= 'z') {// 小写字母 a-z (闭合字母)
            result = 'ⓐ' + char_ - 'a';
        }
        // 返回闭合字符
        return (char) result;
    }

    /**
     * toCloseByNumber 根据数字转为闭合字符
     *
     * @param number 被转换的数字。
     * @return 返回闭合字符。
     * @description 将[1-20]数字转换为带圈的字符：
     * <pre>
     *     1 -》 '①'
     *     12 -》 '⑫'
     *     20 -》 '⑳'
     * <pre>
     * 也称作：封闭式字符，英文：Enclosed Alphanumerics
     * @see <a href="https://en.wikipedia.org/wiki/List_of_Unicode_characters#Unicode_symbols">维基百科wikipedia-Unicode_symbols</a>
     * @see <a href="https://zh.wikipedia.org/wiki/Unicode%E5%AD%97%E7%AC%A6%E5%88%97%E8%A1%A8">维基百科wikipedia-Unicode字符列表</a>
     * @see <a href="https://coolsymbol.com/">coolsymbol</a>
     * @see <a href="https://baike.baidu.com/item/%E7%89%B9%E6%AE%8A%E5%AD%97%E7%AC%A6/112715?fr=aladdin">百度百科 特殊字符</a>
     * @author LiuQi
     */
    public static char toCloseByNumber(final int number) {
        // 数字必须在[1-20]之间 否则抛出异常
        if (number > 20) throw new IllegalArgumentException("Number must be [1-20]");
        // 返回闭合字符 ①-⑳
        return (char) ('①' + number - 1);
    }

    /**
     * isFileSeparator 是否是文件分隔符
     *
     * @param char_ 被检查的字符
     * @return boolean 是否是文件分隔符 true 是，false 否。
     * @description 文件分隔符在不同的操作系统中不同，例如：
     * <pre>
     *     Windows: \
     *     Linux: /
     *     Mac: /
     * </pre>
     * @author LiuQi
     */
    public static boolean isFileSeparator(final char char_) {
        // 返回 true 如果 char_ 是文件分隔符，否则返回 false。
        return SLASH == char_ || BACKSLASH == char_;
    }

    /**
     * isZeroWidthChar 是否为零宽字符
     *
     * @param char_ 被检查的字符
     * @return boolean 是否是零宽字符 true 是，false 否。
     * @description 零宽字符是指在视觉上不可见的字符，它们通常用于排版和文本处理中。
     * <pre>
     *     \u200B 零宽空格
     *     \u200C 零宽非换行空格
     *     \u200D 零宽连接符
     *     \uFEFF 零宽无断空格
     *     \u2060 零宽连字符
     *     \u2063 零宽不连字符
     *     \u2064 零宽连字符
     *     \u2065 零宽不连字符
     *     ...
     * </pre>
     * <h3>零宽字符（Zero-width characters）</h3>
     * <ul>
     *     <li>定义</li>
     *     <p>零宽字符（Zero-width character）‌是一类特殊的字符，它们本身不占用显示宽度，对肉眼不可见，但在计算机中仍然占用空间。常见的零宽字符包括‌零宽空格（‌U+200B）、‌零宽连接符（‌U+200D）等。</p>
     *     <p>隐藏字符；零宽字符虽然不可见，但会影响字符串长度</p>
     *     <li>常见的零宽字符</li>
     *     <p>零宽空格（U+200B）‌：用于在不增加可见空间的情况下分隔数字和文字。</p>
     *     <p>零宽连接符（U+200D）‌：常用于Emoji表情中，表示多个字符的连接。</p>
     *     <p>零宽非连接符（U+200C）‌：用于抑制周围字符的连接。</p>
     *     <p>左至右符（U+200E）‌：改变文字的方向。</p>
     *     <p>右至左符（U+200F）‌：改变文字的方向。</p>
     *     <p>蒙古文元音分隔符（U+180E）‌：用于蒙古文排版。</p>
     *     <li>应用场景</li>
     *     <p>零宽字符在实际应用中有多种用途，例如：</p>
     *     <p>文字水印‌：通过在文字中插入零宽字符，可以在不影响视觉效果的情况下添加水印。</p>
     *     <p>‌复杂Emoji表情‌：零宽连接符用于连接多个字符，形成复杂的Emoji表情。</p>
     * </ul>
     * @author LiuQi
     */
    public static boolean isZeroWidthChar(final char char_) {
        switch (char_) { // 返回 true 如果 char_ 是零宽字符，否则返回 false。
            case '\u200B': // 零宽空格
            case '\u200C': // 零宽非换行空格
            case '\u200D': // 零宽连接符
            case '\uFEFF': // 零宽无断空格
            case '\u2060': // 零宽连字符
            case '\u2063': // 零宽不连字符
            case '\u2064': // 零宽连字符
            case '\u2065': // 零宽不连字符
                return true;
            default:
                return false;
        }
    }

    /**
     * getType 获取字符类型
     *
     * @param char_ 被检查的字符
     * @return int 字符类型
     * @author LiuQi
     */
    public static int getType(final char char_) {
        // 返回字符类型
        return Character.getType(char_);
    }

    /**
     * digit16 获取十六进制数字
     *
     * @param char_ 被检查的字符
     * @return int 十六进制数字
     * <pre>
     *     CharUtil.digit16('A') = 10 <br>
     *     CharUtil.digit16('B') = 11 <br>
     *     CharUtil.digit16('C') = 12 <br>
     *     CharUtil.digit16('&') = -1 <br>
     * </pre>
     * @author LiuQi
     */
    public static int digit16(final int char_) {
        //  返回十六进制数字，如果 char_ 不是有效的十六进制数字，则返回 -1。
        return Character.digit(char_, 16);
    }

    /**
     * equals 比较两个字符是否相等
     *
     * @param char_           被比较字符一
     * @param char__          被比较字符二
     * @param caseInsensitive 是否忽略大小写
     * @return boolean 如果相等返回 true，否则返回 false。
     * <pre>
     *     CharUtil.equals('A', 'a', true) = true <br>
     *     CharUtil.equals('B', 'b', false) = false <br>
     *     CharUtil.equals('C', 'C', false) = true <br>
     * </pre>
     * @author LiuQi
     */
    public static boolean equals(final char char_, final char char__, final boolean caseInsensitive) {
        // 返回 true 如果 char_ 和 char__ 相等，否则返回 false。
        if (caseInsensitive) return Character.toLowerCase(char_) == Character.toLowerCase(char__);
        return char_ == char__;
    }

    /**
     * toString 将字符转换为字符串
     *
     * @param char_ 被转换的字符
     * @return String 字符的字符串表示形式
     * <pre>
     *     CharUtil.toString('A') = "65" <br>
     *     CharUtil.toString('C') = "67" <br>
     *     CharUtil.toString('™') = "™"
     *  </pre>
     * @author LiuQi
     */
    public static String toString(final char char_) {
        // 返回 char_ 的字符串表示形式。
        return ASCIIStrCache.toString(char_);
    }
}
