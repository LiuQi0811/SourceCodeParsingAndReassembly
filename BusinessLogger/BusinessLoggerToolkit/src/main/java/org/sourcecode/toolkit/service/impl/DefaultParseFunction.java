package org.sourcecode.toolkit.service.impl;


import org.sourcecode.toolkit.service.IParseFunction;

/**
 * @ClassName DefaultParseFunction
 * @Description DefaultParseFunction
 * @Author LiuQi
 */
public class DefaultParseFunction implements IParseFunction {
    @Override
    public String functionName() {
        return null;
    }

    @Override
    public boolean executeBefore() {
        return true;
    }

    @Override
    public String apply(Object value) {
        return "";
    }
}
