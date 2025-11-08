package org.sourcecode.toolkit.service.impl;


import org.sourcecode.toolkit.service.IFunctionService;

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
}
