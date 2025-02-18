package org.chino.SharpBladeUtils.core.regex;

import org.junit.jupiter.api.Test;

import java.util.regex.Pattern;

/**
 * @ClassName ReUtilTest
 * @Description ReUtilTest 正则处理工具单元测试类
 * @Author LiuQi
 * @Date 2025/2/18 15:15
 * @Version 1.0
 */
public class ReUtilTest {

    /**
     * getTest 获取匹配内容测试
     *
     * @author LiuQi
     */
    @Test
    public void getTest() {
        ReUtil.get(Pattern.compile("\\w{2}"), "abcdefgQWER123456!@#$", matcher -> {
            // 匹配内容输出
            System.out.println(matcher.group());
        });
    }
}
