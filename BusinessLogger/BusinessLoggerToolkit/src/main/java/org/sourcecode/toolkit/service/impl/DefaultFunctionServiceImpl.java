package org.sourcecode.toolkit.service.impl;


import org.sourcecode.toolkit.service.IFunctionService;
import org.sourcecode.toolkit.service.IParseFunction;

/**
 * @ClassName DefaultFunctionServiceImpl
 * @Description DefaultFunctionServiceImpl
 * @Author LiuQi
 */
public class DefaultFunctionServiceImpl implements IFunctionService {
    private final ParseFunctionFactory parseFunctionFactory;

    public DefaultFunctionServiceImpl(ParseFunctionFactory parseFunctionFactory) {
        this.parseFunctionFactory = parseFunctionFactory;
    }

    @Override
    public boolean beforeFunction(String functionName) {
        return parseFunctionFactory.isBeforeFunction(functionName);
    }

    @Override
    public String apply(String functionName, Object value) {
        IParseFunction function = parseFunctionFactory.getFunction(functionName);
        if (function == null) {
            return value.toString();
        }
        return function.apply(value);
    }
}
