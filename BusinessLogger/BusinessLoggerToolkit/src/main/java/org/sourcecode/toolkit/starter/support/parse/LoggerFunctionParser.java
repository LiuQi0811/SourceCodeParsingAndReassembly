package org.sourcecode.toolkit.starter.support.parse;


import org.sourcecode.toolkit.service.IFunctionService;

/**
 * @ClassName LoggerFunctionParser
 * @Description LoggerFunctionParser
 * @Author LiuQi
 */
public class LoggerFunctionParser {
    private final IFunctionService functionService;

    public LoggerFunctionParser(IFunctionService functionService) {
        this.functionService = functionService;
    }

    public boolean beforeFunction(String functionName) {
        return functionService.beforeFunction(functionName);
    }
}
