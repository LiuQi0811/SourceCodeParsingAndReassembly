package org.sourcecode.toolkit.starter.support.parse;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sourcecode.toolkit.service.IFunctionService;
import org.sourcecode.toolkit.starter.support.util.Util;

import java.util.Map;

/**
 * @ClassName LoggerFunctionParser
 * @Description LoggerFunctionParser
 * @Author LiuQi
 */
public class LoggerFunctionParser {
    private static final Logger LOGGER = LoggerFactory.getLogger(LoggerFunctionParser.class);
    private final IFunctionService functionService;

    public LoggerFunctionParser(IFunctionService functionService) {
        this.functionService = functionService;
    }

    public boolean beforeFunction(String functionName) {
        return functionService.beforeFunction(functionName);
    }

    public String getFunctionReturnValue(Map<String, String> beforeFunctionNameAndReturnMap, Object value, String expression, String functionName) {
        if (Util.isEmpty(functionName)) {
            return value == null ? "" : value.toString();
        }
        String functionReturnValue = "";

        // TODO
        LOGGER.info(" // TODO ....");
        return functionReturnValue;
    }

}
