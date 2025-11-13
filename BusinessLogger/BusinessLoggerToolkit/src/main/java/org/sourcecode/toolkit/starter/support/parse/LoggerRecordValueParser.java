package org.sourcecode.toolkit.starter.support.parse;


import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.sourcecode.toolkit.bean.MethodExecuteResult;
import org.sourcecode.toolkit.service.impl.DiffParseFunction;
import org.sourcecode.toolkit.starter.support.util.Util;
import org.springframework.beans.BeansException;
import org.springframework.beans.factory.BeanFactory;
import org.springframework.beans.factory.BeanFactoryAware;
import org.springframework.context.expression.AnnotatedElementKey;
import org.springframework.expression.EvaluationContext;

import java.lang.reflect.Method;
import java.util.Collection;
import java.util.HashMap;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * @ClassName LoggerRecordValueParser
 * @Description LoggerRecordValueParser
 * @Author LiuQi
 */
public class LoggerRecordValueParser implements BeanFactoryAware {
    private static final Logger LOGGER = LoggerFactory.getLogger(LoggerRecordValueParser.class);
    private static final Pattern PATTERN = Pattern.compile("\\{\\s*(\\w*)\\s*\\{(.*?)}}");
    public static final String COMMA = ",";
    private final LoggerRecordExpressionEvaluator loggerRecordExpressionEvaluator = new LoggerRecordExpressionEvaluator();
    private LoggerFunctionParser loggerFunctionParser;
    protected BeanFactory beanFactory;
    private DiffParseFunction diffParseFunction;
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
                        Object value = loggerRecordExpressionEvaluator.parseExpression(expression, annotatedElementKey, evaluationContext);
                        String functionReturnValue = loggerFunctionParser.getFunctionReturnValue(null, value, expression, functionName);
                        String functionCallInstanceKey = loggerFunctionParser.getFunctionCallInstanceKey(functionName, expression);
                        functionNameAndReturnValueMap.put(functionCallInstanceKey, functionReturnValue);
                    }
                }
            }
        });
        return functionNameAndReturnValueMap;
    }

    public void setLoggerFunctionParser(LoggerFunctionParser loggerFunctionParser) {
        this.loggerFunctionParser = loggerFunctionParser;
    }

    public void setDiffParseFunction(DiffParseFunction diffParseFunction) {
        this.diffParseFunction = diffParseFunction;
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
                        expression = getDiffFunctionValue(evaluationContext, annotatedElementKey, expression);
                        sameDiff = Objects.equals(Util.EMPTY, expression);
                    } else {
                        Object value = loggerRecordExpressionEvaluator.parseExpression(expression, annotatedElementKey, evaluationContext);
                        expression = loggerFunctionParser.getFunctionReturnValue(beforeFunctionNameAndReturnMap, value, expression, functionName);
                    }
                    matcher.appendReplacement(parsedStrBuffer, Matcher.quoteReplacement(expression == null ? Util.EMPTY : expression));
                }
                matcher.appendTail(parsedStrBuffer);
                expressionValues.put(expressionTemplate, recordSameDiff(sameDiff, diffSameWhetherSaveLogger) ? parsedStrBuffer.toString() : expressionTemplate);
            } else {
                expressionValues.put(expressionTemplate, expressionTemplate);
            }
        }
        return expressionValues;
    }

    private String getDiffFunctionValue(EvaluationContext evaluationContext, AnnotatedElementKey annotatedElementKey, String expression) {
        String[] params = parseDiffFunction(expression);
        if (params.length == 1) {
            LOGGER.info("  // TODO 1 {}", params);
        } else if (params.length == 2) {
            Object sourceObject = loggerRecordExpressionEvaluator.parseExpression(params[0], annotatedElementKey, evaluationContext);
            Object targetObject = loggerRecordExpressionEvaluator.parseExpression(params[1], annotatedElementKey, evaluationContext);
            expression = diffParseFunction.diff(sourceObject, targetObject);
        }
        return expression;
    }

    private String[] parseDiffFunction(String expression) {
        if (expression.contains(COMMA) && Util.strCount(expression, COMMA) == 1) {
            return expression.split(COMMA);
        }
        return new String[]{expression};
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
