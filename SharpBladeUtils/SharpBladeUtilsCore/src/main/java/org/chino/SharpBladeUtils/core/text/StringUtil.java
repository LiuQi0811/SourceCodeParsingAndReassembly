package org.chino.SharpBladeUtils.core.text;

import org.chino.SharpBladeUtils.core.array.ArrayUtil;
import org.chino.SharpBladeUtils.core.util.CharsetUtil;

import java.nio.ByteBuffer;
import java.nio.charset.Charset;

/**
 * @ClassName StringUtil
 * @Description StringUtil 字符串处理工具
 * @Author LiuQi
 * @Date 2025/2/19 15:31
 * @Version 1.0
 */
public class StringUtil extends CharSequenceUtil implements StringPool {

    /**
     * utf8Str 将对象转为UTF-8编码的字符串
     *
     * @param data {@link Object} 数据
     * @return {@link String} 处理后的字符串
     * @author LiuQi
     */
    public static String utf8Str(final Object data) {
        // 返回 {@code toStr(data, CharsetUtil.UTF_8)} 方法的调用结果
        return toStr(data, CharsetUtil.UTF_8);
    }

    /**
     * toStr 将对象转为字符串
     *
     * @param data    {@link Object} 数据
     * @param charset {@link Charset} 字符集
     * @return {@link String} 处理后的字符串
     * @author LiuQi
     */
    public static String toStr(final Object data, final Charset charset) {
        // 如果数据为空，则直接返回null
        if (data == null) return null;
        if (data instanceof String) { // 字符串类型
            // 返回强转后字符串
            return (String) data;
        } else if (data instanceof char[]) { // char字符数组类型
            System.out.println(" char字符数组类型 ");
        } else if (data instanceof byte[]) { // byte字节数组类型
            System.out.println(" byte字节数组类型 ");
        } else if (data instanceof Byte[]) { // Byte字节数组类型
            System.out.println(" Byte字节数组类型 ");
        } else if (data instanceof ByteBuffer[]) { // ByteBuffer字节缓冲数组类型
            System.out.println(" ByteBuffer字节缓冲数组类型 ");
        } else if (ArrayUtil.isArray(data)) { // Array数组类型
            System.out.println(" Array数组类型 ");
        }
        // TODO 其他类型 转换字符串逻辑待优化 ........
        // 返回 toString 处理的字符串
        return data.toString();
    }

}
