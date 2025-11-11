package org.sourcecode.toolkit.service;


/**
 * @ClassName IParseFunction
 * @Description IParseFunction
 * @Author LiuQi
 */
public interface IParseFunction {
    String functionName();

    default boolean executeBefore() {
        return false;
    }

    String apply(Object value);
}
