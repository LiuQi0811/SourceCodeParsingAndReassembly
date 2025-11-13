package org.sourcecode.toolkit.starter.support.util;


import org.springframework.lang.Nullable;

import java.util.Collection;
import java.util.Map;

/**
 * @ClassName Util
 * @Description Util
 * @Author LiuQi
 */
public abstract class Util {
    public static final String EMPTY = "";
    public static final String DOLLAR = "$";

    public static boolean isEmpty(@Nullable Object value) {
        return value == null || value.equals("");
    }

    public static boolean isEmpty(@Nullable Map<?, ?> mapValue) {
        return mapValue == null || mapValue.isEmpty();
    }

    public static boolean isEmpty(@Nullable Collection<?> collection) {
        return collection == null || collection.isEmpty();
    }

    public static boolean hasText(@Nullable String valueStr) {
        return valueStr != null && !valueStr.isBlank();
    }

    public static int strCount(String srcText, String findText) {
        int count = 0;
        int index = 0;
        while ((index = srcText.indexOf(findText, index)) != -1) {
            index = index + findText.length();
            count++;
        }
        return count;
    }

    public static boolean startsWithIgnoreCase(@Nullable String str, @Nullable String prefix) {
        return str != null && prefix != null && str.length() >= prefix.length() && str.regionMatches(true, 0, prefix, 0, prefix.length());
    }

    public static boolean endsWithIgnoreCase(@Nullable String str, @Nullable String suffix) {
        return str != null && suffix != null && str.length() >= suffix.length() && str.regionMatches(true, str.length() - suffix.length(), suffix, 0, suffix.length());
    }
}
