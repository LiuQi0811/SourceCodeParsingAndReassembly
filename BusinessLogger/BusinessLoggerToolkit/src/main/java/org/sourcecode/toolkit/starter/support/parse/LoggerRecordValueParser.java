package org.sourcecode.toolkit.starter.support.parse;


import org.sourcecode.toolkit.bean.MethodExecuteResult;
import org.sourcecode.toolkit.service.impl.DiffParseFunction;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.beans.factory.BeanFactoryAware;
import org.springframework.context.expression.AnnotatedElementKey;
import org.springframework.expression.EvaluationContext;

import java.lang.reflect.Method;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * @ClassName LoggerRecordValueParser
 * @Description LoggerRecordValueParser
 * @Author LiuQi
 */
public class LoggerRecordValueParser implements BeanFactoryAware {
    private static final Pattern PATTERN = Pattern.compile("\\{\\s*(\\w*)\\s*\\{(.*?)}}");
    private final LoggerRecordExpressionEvaluator loggerRecordExpressionEvaluator = new LoggerRecordExpressionEvaluator();
    private LoggerFunctionParser loggerFunctionParser;
    protected BeanFactory beanFactory;
    protected boolean diffSameWhetherSaveLogger;

    public Map<String, String> processBeforeExecuteFunctionTemplate(Collection<String> templates, Class<?> targetClass, Method method, Object[] arguments) {
        Map<String, String> functionNameAndReturnValueMap = new HashMap<>();
        EvaluationContext evaluationContext = loggerRecordExpressionEvaluator.createEvaluationContext(method, arguments, targetClass, null, null, beanFactory);
        templates.forEach(expressionTemplate -> {
            if (expressionTemplate.contains("{")) {
                Matcher matcher = PATTERN.matcher(expressionTemplate);
                while (matcher.find()) {
                    String expression = matcher.group(2);
                    if (expression.contains("#_result") || expression.contains("#_errorMessage")) {
                        continue;
                    }
                    AnnotatedElementKey annotatedElementKey = new AnnotatedElementKey(method, targetClass);
                    String functionName = matcher.group(1);
                    if (loggerFunctionParser.beforeFunction(functionName)) {
                        System.out.println(" evaluationContext " + evaluationContext);
                        System.out.println(" annotatedElementKey " + annotatedElementKey);
                        System.out.println(" DAY_BY_DAY " + functionName);
                    }
                }
            }

        });
        return functionNameAndReturnValueMap;
    }

    public void setLoggerFunctionParser(LoggerFunctionParser loggerFunctionParser) {
        this.loggerFunctionParser = loggerFunctionParser;
    }

    public Map<String, String> processTemplate(Collection<String> templates, MethodExecuteResult methodExecuteResult, Map<String, String> beforeFunctionNameAndReturnMap) {
        Map<String, String> expressionValues = new HashMap<>();
        EvaluationContext evaluationContext = loggerRecordExpressionEvaluator.createEvaluationContext(methodExecuteResult.getMethod(),
                methodExecuteResult.getArguments(),
                methodExecuteResult.getTargetClass(),
                methodExecuteResult.getResult(),
                methodExecuteResult.getErrorMessage(),
                beanFactory
        );
        for (String expressionTemplate : templates) {
            if (expressionTemplate.contains("{")) {
                Matcher matcher = PATTERN.matcher(expressionTemplate);
                StringBuffer parsedStrBuffer = new StringBuffer();
                AnnotatedElementKey annotatedElementKey = new AnnotatedElementKey(methodExecuteResult.getMethod(), methodExecuteResult.getTargetClass());
                boolean sameDiff = false;
                while (matcher.find()) {
                    String expression = matcher.group(2);
                    String functionName = matcher.group(1);
                    if (DiffParseFunction.DIFF_FUNCTION_NAME.equals(functionName)) {
                        // TODO
                    } else {
                        Object value = loggerRecordExpressionEvaluator.parseExpression(expression, annotatedElementKey, evaluationContext);
                        expression = loggerFunctionParser.getFunctionReturnValue(beforeFunctionNameAndReturnMap, value, expression, functionName);
                    }
                    matcher.appendReplacement(parsedStrBuffer, Matcher.quoteReplacement(expression == null ? "" : expression));
                }
                matcher.appendTail(parsedStrBuffer);
                expressionValues.put(expressionTemplate, recordSameDiff(sameDiff, diffSameWhetherSaveLogger) ? parsedStrBuffer.toString() : expressionTemplate);
            } else {
                expressionValues.put(expressionTemplate, expressionTemplate);
            }
        }
        return expressionValues;
    }

    private boolean recordSameDiff(boolean sameDiff, boolean diffSameWhetherSaveLogger) {
        if (diffSameWhetherSaveLogger) {
            return true;
        }
        if (!diffSameWhetherSaveLogger && sameDiff) {
            return false;
        }
        return true;
    }

    @Override
    public void setBeanFactory(BeanFactory beanFactory) throws BeansException {
        this.beanFactory = beanFactory;
    }
}
