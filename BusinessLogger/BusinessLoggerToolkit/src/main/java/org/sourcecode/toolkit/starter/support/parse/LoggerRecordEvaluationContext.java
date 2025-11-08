package org.sourcecode.toolkit.starter.support.parse;


import org.sourcecode.toolkit.context.LoggerRecordContext;
import org.springframework.context.expression.MethodBasedEvaluationContext;
import org.springframework.core.ParameterNameDiscoverer;

import java.lang.reflect.Method;
import java.util.Map;

/**
 * @ClassName LoggerRecordEvaluationContext
 * @Description LoggerRecordEvaluationContext
 * @Author LiuQi
 */
public class LoggerRecordEvaluationContext extends MethodBasedEvaluationContext {
    public LoggerRecordEvaluationContext(Object rootObject, Method method, Object[] arguments, ParameterNameDiscoverer parameterNameDiscoverer, Object value, String errorMessage) {
        super(rootObject, method, arguments, parameterNameDiscoverer);
        Map<String, Object> variables = LoggerRecordContext.getVariables();
        Map<String, Object> globalVariable = LoggerRecordContext.getGlobalVariableMap();
        if (variables != null) {
            setVariables(variables);
        }
        if (globalVariable != null && !globalVariable.isEmpty()) {
            globalVariable.entrySet()
                    .forEach(stringObjectEntry -> {
                        if (lookupVariable(stringObjectEntry.getKey()) == null) {
                            setVariable(stringObjectEntry.getKey(), stringObjectEntry.getValue());
                        }
                    });
        }
        setVariable("_result", value);
        setVariable("_errorMessage", errorMessage);
    }
}
