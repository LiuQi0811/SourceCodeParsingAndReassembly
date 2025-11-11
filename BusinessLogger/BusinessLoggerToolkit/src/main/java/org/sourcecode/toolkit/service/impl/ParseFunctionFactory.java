package org.sourcecode.toolkit.service.impl;


import org.sourcecode.toolkit.service.IParseFunction;
import org.sourcecode.toolkit.starter.support.util.Util;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * @ClassName ParseFunctionFactory
 * @Description ParseFunctionFactory
 * @Author LiuQi
 */
public class ParseFunctionFactory {
    private Map<String, IParseFunction> allFunctionMap;

    public ParseFunctionFactory(final List<IParseFunction> parseFunctions) {
        if (Util.isEmpty(parseFunctions)) {
            return;
        }
        allFunctionMap = new HashMap<>();
        for (IParseFunction parseFunction : parseFunctions) {
            if (Util.isEmpty(parseFunction.functionName())) {
                continue;
            }
            allFunctionMap.put(parseFunction.functionName(), parseFunction);
        }
    }

    public boolean isBeforeFunction(String functionName) {
        return allFunctionMap.get(functionName) != null && allFunctionMap.get(functionName).executeBefore();
    }
}
