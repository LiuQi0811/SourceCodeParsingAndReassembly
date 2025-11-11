package org.sourcecode.toolkit.starter.support.util;


import org.springframework.lang.Nullable;

import java.util.Collection;

/**
 * @ClassName Util
 * @Description Util
 * @Author LiuQi
 */
public abstract class Util {
    public static final String EMPTY = "";
    public static boolean isEmpty(@Nullable Object value) {
        return value == null || value.equals("");
    }

    public static boolean isEmpty(@Nullable Collection<?> collection) {
        return collection == null || collection.isEmpty();
    }

    public static boolean hasText(@Nullable String valueStr) {
        return valueStr != null && !valueStr.isBlank();
    }
}
