package org.sourcecode.toolkit.starter.support.parse;


import org.sourcecode.toolkit.service.IFunctionService;
import org.sourcecode.toolkit.starter.support.util.Util;

import java.util.Map;

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

    public String getFunctionReturnValue(Map<String, String> beforeFunctionNameAndReturnMap, Object value, String expression, String functionName) {
        if (Util.isEmpty(functionName)) {
            return value == null ? Util.EMPTY : value.toString();
        }
        String functionReturnValue = "";
        String functionCallInstanceKey = getFunctionCallInstanceKey(functionName, expression);
        if (beforeFunctionNameAndReturnMap != null && beforeFunctionNameAndReturnMap.containsKey(functionCallInstanceKey)) {
            functionReturnValue = beforeFunctionNameAndReturnMap.get(functionCallInstanceKey);
        } else {
            functionReturnValue = functionService.apply(functionName, value);
        }
        return functionReturnValue;
    }

    public String getFunctionCallInstanceKey(String functionName, String expression) {
        return functionName + expression;
    }

}
